/**
 * 内置浏览器数据层（SQLite，经 newSql IPC 通道）
 * ------------------------------------------------------------------
 * 通道选型（与 habitApi 同套路，勿用裸 new-sql:execute）：
 * - 读：`new-sql:query`（内部只做 ensureTableExists，不按 SQL 推导列，可安全 SELECT *）
 * - 写：`new-sql:upsert`（列由 data 的 key 推导，自动补列；primaryKey='key'）
 * - 删：`new-sql:delete`
 *
 * 表结构：
 * - browser_history  浏览历史：key(=url, 唯一索引) / title / visit_count / last_visit_time
 * - browser_bookmark 书签：     key(=url, 唯一索引) / title / create_time
 *
 * 主键约定：SQLite 不允许 ALTER 加主键，采用「补普通 key 列 + 唯一索引」等价实现（见 ensureBrowserTables）。
 * 访问计数自增等读改写场景使用「查-后-写」逻辑，避免依赖 ON CONFLICT 表达式。
 */

/** 浏览历史表名 */
const TABLE_HISTORY = "browser_history";
/** 书签表名 */
const TABLE_BOOKMARK = "browser_bookmark";
/** 业务主键字段（存 url） */
const PK = "key";

/** 浏览历史记录 */
export interface HistoryRecord {
  /** 地址（唯一键） */
  key: string;
  /** 页面标题 */
  title: string;
  /** 访问次数 */
  visit_count: number;
  /** 最后访问时间（YYYY-MM-DD HH:mm:ss） */
  last_visit_time: string;
}

/** 书签记录 */
export interface BookmarkRecord {
  /** 地址（唯一键） */
  key: string;
  /** 页面标题 */
  title: string;
  /** 收藏时间（YYYY-MM-DD HH:mm:ss） */
  create_time: string;
}

/** 统一 IPC 调用（preload 已通用暴露 invoke） */
function invoke<T = any>(channel: string, args?: any): Promise<T> {
  return (window as any).ipcRenderer.invoke(channel, args) as Promise<T>;
}

/** IPC 结果统一形态 */
interface IpcResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/** 取行数组：兼容 data 直接为数组或 data.rows 两种返回形态 */
function pickRows(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

/** SQL 字符串字面量转义（防单引号注入/语法错误） */
function sqlEscape(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** 当前时间（与项目其他表一致的时间格式） */
function now(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * 判断地址是否值得记录进历史（过滤新标签页/内部页）
 * @param url 必填，待判断地址
 * @returns true 表示可记录
 */
export function isRecordableUrl(url: string): boolean {
  if (!url) return false;
  if (url === "newtab" || url.startsWith("newtab")) return false;
  if (/^(about|chrome|devtools|chrome-extension|data|javascript):/i.test(url)) return false;
  return /^https?:\/\//i.test(url) || /^file:\/\//i.test(url);
}

// ------------------------------------------------------------------
// 建表（幂等，重复调用无害）
// ------------------------------------------------------------------

/** 容错执行 SQL（重复列/索引已存在等错误可忽略） */
async function runSql(table: string, sql: string): Promise<void> {
  try {
    await invoke("new-sql:query", { tableName: table, SqlStr: sql });
  } catch (e) {
    console.warn(`[browser] 执行建表语句失败（可忽略）: ${sql}`, e);
  }
}

/** 建表/补列/建唯一索引（幂等） */
export async function ensureBrowserTables(): Promise<void> {
  for (const t of [TABLE_HISTORY, TABLE_BOOKMARK]) {
    await runSql(t, `SELECT 1 FROM ${t} LIMIT 1`);
    await runSql(t, `ALTER TABLE ${t} ADD COLUMN ${PK} TEXT`);
    await runSql(t, `CREATE UNIQUE INDEX IF NOT EXISTS uq_${t}_${PK} ON ${t}(${PK})`);
  }
}

// 模块级建表 Promise：保证进程内只执行一次，且调用方都等同一个结果
let ensurePromise: Promise<void> | null = null;

/** 确保表已就绪（懒执行，重复调用复用同一 Promise） */
function ensureReady(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = ensureBrowserTables().catch((e) => {
      // 失败后清空缓存，下次调用可重试
      ensurePromise = null;
      throw e;
    });
  }
  return ensurePromise;
}

// ------------------------------------------------------------------
// 浏览历史
// ------------------------------------------------------------------

/**
 * 记录一次访问（存在则 visit_count+1 并刷新标题/时间；不存在则插入）
 * @param url 必填，访问地址（需可记录，调用方可先用 isRecordableUrl 过滤）
 * @param title 可选，页面标题
 * @returns 是否写入成功
 */
export async function addHistory(url: string, title: string = ""): Promise<boolean> {
  if (!isRecordableUrl(url)) return false;
  try {
    await ensureReady();
    const res = await invoke<IpcResult>("new-sql:query", {
      tableName: TABLE_HISTORY,
      conditions: { SqlStr: `SELECT * FROM ${TABLE_HISTORY} WHERE ${PK} = ${sqlEscape(url)} LIMIT 1` },
    });
    if (!res?.success) return false;
    const row = pickRows(res.data)[0];
    const time = now();
    if (row) {
      // 已有记录：次数 +1，刷新标题与最后访问时间
      const upd = await invoke<IpcResult>("new-sql:update", {
        tableName: TABLE_HISTORY,
        data: {
          title: title || row?.title || "",
          visit_count: Number(row?.visit_count ?? 1) + 1,
          last_visit_time: time,
        },
        condition: { [PK]: url },
      });
      return !!upd?.success;
    }
    const ins = await invoke<IpcResult>("new-sql:insert", {
      tableName: TABLE_HISTORY,
      data: { [PK]: url, title, visit_count: 1, last_visit_time: time },
      config: { primaryKey: PK },
    });
    return !!ins?.success;
  } catch (e) {
    console.error("[browser] 写入浏览历史失败:", e);
    return false;
  }
}

/**
 * 查询浏览历史（按最后访问时间倒序）
 * @param limit 可选，条数上限，默认 200
 * @param keyword 可选，过滤关键词（匹配标题或地址）
 * @returns 历史记录列表（失败返回空数组）
 */
export async function fetchHistory(limit: number = 200, keyword: string = ""): Promise<HistoryRecord[]> {
  try {
    await ensureReady();
    let sql = `SELECT * FROM ${TABLE_HISTORY}`;
    if (keyword.trim()) {
      sql += ` WHERE title LIKE ${sqlEscape(`%${keyword.trim()}%`)} OR ${PK} LIKE ${sqlEscape(`%${keyword.trim()}%`)}`;
    }
    sql += ` ORDER BY last_visit_time DESC LIMIT ${Math.max(1, Math.floor(limit))}`;
    const res = await invoke<IpcResult>("new-sql:query", { tableName: TABLE_HISTORY, conditions: { SqlStr: sql } });
    if (!res?.success) return [];
    return pickRows(res.data) as HistoryRecord[];
  } catch (e) {
    console.error("[browser] 查询浏览历史失败:", e);
    return [];
  }
}

/**
 * 查询最常访问站点（供新标签页展示）
 * @param limit 可选，条数上限，默认 8
 * @returns 历史记录列表（按访问次数、最后访问时间倒序）
 */
export async function fetchTopSites(limit: number = 8): Promise<HistoryRecord[]> {
  try {
    await ensureReady();
    const sql = `SELECT * FROM ${TABLE_HISTORY} ORDER BY visit_count DESC, last_visit_time DESC LIMIT ${Math.max(1, Math.floor(limit))}`;
    const res = await invoke<IpcResult>("new-sql:query", { tableName: TABLE_HISTORY, conditions: { SqlStr: sql } });
    if (!res?.success) return [];
    return pickRows(res.data) as HistoryRecord[];
  } catch (e) {
    console.error("[browser] 查询常用站点失败:", e);
    return [];
  }
}

/**
 * 删除单条历史
 * @param url 必填，要删除的地址
 * @returns 是否删除成功
 */
export async function deleteHistory(url: string): Promise<boolean> {
  try {
    await ensureReady();
    const res = await invoke<IpcResult>("new-sql:delete", { tableName: TABLE_HISTORY, condition: { [PK]: url } });
    return !!res?.success;
  } catch (e) {
    console.error("[browser] 删除浏览历史失败:", e);
    return false;
  }
}

/** 清空全部浏览历史 */
export async function clearHistory(): Promise<boolean> {
  try {
    await ensureReady();
    const res = await invoke<IpcResult>("new-sql:query", {
      tableName: TABLE_HISTORY,
      conditions: { SqlStr: `DELETE FROM ${TABLE_HISTORY}` },
    });
    return !!res?.success;
  } catch (e) {
    console.error("[browser] 清空浏览历史失败:", e);
    return false;
  }
}

// ------------------------------------------------------------------
// 书签
// ------------------------------------------------------------------

/**
 * 查询全部书签（按收藏时间倒序）
 * @returns 书签列表（失败返回空数组）
 */
export async function fetchBookmarks(): Promise<BookmarkRecord[]> {
  try {
    await ensureReady();
    const res = await invoke<IpcResult>("new-sql:query", {
      tableName: TABLE_BOOKMARK,
      conditions: { SqlStr: `SELECT * FROM ${TABLE_BOOKMARK} ORDER BY create_time DESC` },
    });
    if (!res?.success) return [];
    return pickRows(res.data) as BookmarkRecord[];
  } catch (e) {
    console.error("[browser] 查询书签失败:", e);
    return [];
  }
}

/**
 * 新增/更新书签（同地址覆盖标题）
 * @param url 必填，书签地址
 * @param title 可选，书签标题
 * @returns 是否成功
 */
export async function addBookmark(url: string, title: string = ""): Promise<boolean> {
  if (!isRecordableUrl(url)) return false;
  try {
    await ensureReady();
    const res = await invoke<IpcResult>("new-sql:upsert", {
      tableName: TABLE_BOOKMARK,
      data: { [PK]: url, title, create_time: now() },
      config: { primaryKey: PK },
    });
    return !!res?.success;
  } catch (e) {
    console.error("[browser] 添加书签失败:", e);
    return false;
  }
}

/**
 * 删除书签
 * @param url 必填，要删除的地址
 * @returns 是否成功
 */
export async function removeBookmark(url: string): Promise<boolean> {
  try {
    await ensureReady();
    const res = await invoke<IpcResult>("new-sql:delete", { tableName: TABLE_BOOKMARK, condition: { [PK]: url } });
    return !!res?.success;
  } catch (e) {
    console.error("[browser] 删除书签失败:", e);
    return false;
  }
}
