/**
 * 习惯打卡数据层（功能化）：封装与主进程 newSql 的 IPC 通信。
 *
 * 通道选型（重要，别乱改）：
 * - 读：`new-sql:query`（内部 query() 只做 ensureTableExists(tableName)，不按 SQL 推导列）
 *   → 可以安全使用 SELECT *，且支持 conditions.SqlStr 直传完整 SQL。
 * - 写：`new-sql:upsert`（列由 data 的 key 推导，内部 ensureTableColumns 会自动补列）。
 * - 删：`new-sql:delete`（内部 del() 只做 ensureTableExists(tableName)，不推导列）。
 *
 * 为什么不用裸 `new-sql:execute`：
 * 它的 execute() 用 extractColumnNames 从 SQL 里猜列名，并对已存在的表执行 ALTER ADD COLUMN。
 * 而 SELECT * / DELETE / INSERT OR REPLACE 这几种语句它都猜不出列名，会兜底返回
 * ['name','value','created_at']，把这些垃圾列加到业务表上。所以本项目禁止用它跑习惯表的读写。
 *
 * 关于建表与主键：
 * - 两张表都以 `key`（TEXT）作为业务主键，upsert 走 `ON CONFLICT(key)` 实现幂等覆盖。
 * - SQLite 不允许通过 ALTER 给既存表追加主键列，底层 newSql 已改为「先加普通列 + 再建唯一索引」
 *   来等价实现主键唯一约束；且 query() 也支持透传 primaryKey，使首次建表即用正确主键。
 * - ensureHabitTables() 在加载时幂等地把表结构摆正（补 key 列 + 唯一索引），兼容历史破表。
 */

import type { HabitChainActionConfig, HabitCheckin, HabitDef } from "../types";

/** 习惯定义表 */
const TABLE_DEF = "habit_def";
/** 打卡记录表 */
const TABLE_CHECKIN = "habit_checkin";
/** 两张表的主键字段名 */
const PK = "key";

interface IpcResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/** 统一调用 preload 暴露的 ipcRenderer.invoke */
function invoke<T = any>(channel: string, args?: any): Promise<IpcResult<T>> {
  return (window as any).ipcRenderer.invoke(channel, args);
}

/** 取出行数组：兼容 data 直接是数组，或 data.rows 两种返回形态 */
function pickRows(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

/**
 * 容错解析：库中数组字段以 JSON 字符串存储，
 * 若历史数据存成了真实数组（或直接为空）也能兼容。
 */
function safeParse<T>(raw: any, fallback: T): T {
  if (raw === null || raw === undefined || raw === "") return fallback;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

/**
 * 确保两张表存在且具备 key 主键列（幂等，重复调用无害）。
 *
 * 历史兼容：习惯表若曾被查询以默认的 id 主键先行创建（缺 key 列），
 * 这里补建 key 列并加唯一索引，等价于主键，供 upsert 的 ON CONFLICT(key) 使用。
 * 即便不调用本函数，底层 newSql 在 upsert 时也会自动补建，这里只是提前把结构摆正。
 */
async function runSql(table: string, sql: string): Promise<void> {
  try {
    await invoke("new-sql:query", { tableName: table, SqlStr: sql });
  } catch (e) {
    // 重复列 / 索引已存在等可忽略
    console.warn(`[habit] 执行 ${sql} 失败（可忽略）:`, e);
  }
}

export async function ensureHabitTables(): Promise<void> {
  for (const t of [TABLE_DEF, TABLE_CHECKIN]) {
    // 1) 先确保表存在（带 key 主键）；2) 补建 key 列；3) 建唯一索引
    await runSql(t, `SELECT 1 FROM ${t} LIMIT 1`);
    await runSql(t, `ALTER TABLE ${t} ADD COLUMN ${PK} TEXT`);
    await runSql(t, `CREATE UNIQUE INDEX IF NOT EXISTS uq_${t}_${PK} ON ${t}(${PK})`);
  }
}

/** 数据库行 → HabitDef */
function toHabitDef(row: any): HabitDef {
  return {
    key: row?.key ?? "",
    name: row?.name ?? "",
    remark: row?.remark ?? "",
    freqType: row?.freqType === "weekly" ? "weekly" : "daily",
    weekDays: safeParse<number[]>(row?.weekDays, []),
    reminderTimes: safeParse<string[]>(row?.reminderTimes, []),
    enabled: Number(row?.enabled ?? 1),
    chainActions: safeParse<HabitChainActionConfig[]>(row?.chainActions, []),
    createTime: row?.createTime ?? "",
    updateTime: row?.updateTime ?? "",
  };
}

/** 数据库行 → HabitCheckin */
function toHabitCheckin(row: any): HabitCheckin {
  return {
    key: row?.key ?? "",
    habitKey: row?.habitKey ?? "",
    date: row?.date ?? "",
    time: row?.time ?? "",
    value: row?.value ?? "",
    note: row?.note ?? "",
    source: row?.source ?? "manual",
  };
}

/** 读取全部习惯定义（按创建时间正序） */
export async function fetchHabitDefs(): Promise<HabitDef[]> {
  try {
    const res = await invoke("new-sql:query", {
      tableName: TABLE_DEF,
      primaryKey: PK,
      conditions: { SqlStr: `SELECT * FROM ${TABLE_DEF} ORDER BY createTime ASC` },
    });
    if (!res?.success) {
      console.error("[habit] 读取习惯定义失败:", res?.error);
      return [];
    }
    return pickRows(res.data).map(toHabitDef);
  } catch (err) {
    console.error("[habit] 读取习惯定义异常:", err);
    return [];
  }
}

/** 读取全部打卡记录（按日期倒序） */
export async function fetchCheckins(): Promise<HabitCheckin[]> {
  try {
    const res = await invoke("new-sql:query", {
      tableName: TABLE_CHECKIN,
      primaryKey: PK,
      conditions: { SqlStr: `SELECT * FROM ${TABLE_CHECKIN} ORDER BY date DESC` },
    });
    if (!res?.success) {
      console.error("[habit] 读取打卡记录失败:", res?.error);
      return [];
    }
    return pickRows(res.data).map(toHabitCheckin);
  } catch (err) {
    console.error("[habit] 读取打卡记录异常:", err);
    return [];
  }
}

/** 新增 / 更新一条习惯定义（主键 key，冲突即更新） */
export async function upsertHabitDef(habit: HabitDef): Promise<boolean> {
  const res = await invoke("new-sql:upsert", {
    tableName: TABLE_DEF,
    data: {
      key: habit.key,
      name: habit.name,
      remark: habit.remark,
      freqType: habit.freqType,
      weekDays: JSON.stringify(habit.weekDays ?? []),
      reminderTimes: JSON.stringify(habit.reminderTimes ?? []),
      enabled: Number(habit.enabled ?? 1),
      chainActions: JSON.stringify(habit.chainActions ?? []),
      createTime: habit.createTime,
      updateTime: habit.updateTime,
    },
    config: { primaryKey: PK },
  });
  if (!res?.success) {
    console.error("[habit] 保存习惯定义失败:", res?.error);
    return false;
  }
  return true;
}

/** 删除一条习惯定义 */
export async function deleteHabitDef(key: string): Promise<boolean> {
  const res = await invoke("new-sql:delete", {
    tableName: TABLE_DEF,
    condition: { key },
  });
  if (!res?.success) {
    console.error("[habit] 删除习惯定义失败:", res?.error);
    return false;
  }
  return true;
}

/** 新增 / 更新一条打卡记录（主键 '<habitKey>#<date>'，一天一条，重复打卡即覆盖） */
export async function upsertCheckin(record: HabitCheckin): Promise<boolean> {
  const res = await invoke("new-sql:upsert", {
    tableName: TABLE_CHECKIN,
    data: {
      key: record.key,
      habitKey: record.habitKey,
      date: record.date,
      time: record.time,
      value: record.value ?? "",
      note: record.note ?? "",
      source: record.source ?? "manual",
    },
    config: { primaryKey: PK },
  });
  if (!res?.success) {
    console.error("[habit] 保存打卡记录失败:", res?.error);
    return false;
  }
  return true;
}

/** 删除一条打卡记录（撤销打卡） */
export async function deleteCheckin(key: string): Promise<boolean> {
  const res = await invoke("new-sql:delete", {
    tableName: TABLE_CHECKIN,
    condition: { key },
  });
  if (!res?.success) {
    console.error("[habit] 删除打卡记录失败:", res?.error);
    return false;
  }
  return true;
}

/** 删除某个习惯的全部打卡记录（删除习惯时联动清理） */
export async function deleteCheckinsByHabit(habitKey: string): Promise<boolean> {
  const res = await invoke("new-sql:delete", {
    tableName: TABLE_CHECKIN,
    condition: { habitKey },
  });
  if (!res?.success) {
    console.error("[habit] 清理打卡记录失败:", res?.error);
    return false;
  }
  return true;
}
