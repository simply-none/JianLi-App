/**
 * 下载任务持久化层（主进程，直接使用 newSql 模块）
 * ------------------------------------------------------------------
 * 表：download_task（id TEXT PRIMARY KEY）
 * 注意事项（对齐 db-pitfalls）：
 * - 表结构由本模块显式 CREATE（幂等），绝不依赖 new-sql:execute 的自动建表劫持；
 * - upsert 走 ON CONFLICT(id)，id 为显式主键，安全；
 * - headers / segments 等复杂字段以 JSON 字符串存储，读出时解析。
 */
import { insert, query, update, del, execute } from "../newSql.ts";
import type { DownloadTaskInfo, SegmentState, TaskCategory, TaskStatus } from "./types.ts";

/** 数据库行信息：任务信息 + 运行时扩展字段（分段进度 / 请求头） */
export type TaskRowInfo = DownloadTaskInfo & {
  /** 分段进度（JSON 解析后） */
  segments?: SegmentState[];
  /** 请求头（JSON 解析后） */
  headers?: Record<string, string>;
};

/** 任务表名 */
const TABLE = "download_task";

/**
 * 幂等建表（进程内只执行一次，重复调用无害）
 * @returns Promise，建表完成（失败会抛出）
 */
async function ensureTable(): Promise<void> {
  await execute(`CREATE TABLE IF NOT EXISTS download_task (
    id TEXT PRIMARY KEY,
    url TEXT,
    filename TEXT,
    save_path TEXT,
    save_dir TEXT,
    status TEXT,
    total_size INTEGER,
    received_size INTEGER,
    category TEXT,
    accept_ranges INTEGER,
    connections INTEGER,
    segments TEXT,
    headers TEXT,
    error_msg TEXT,
    created_at TEXT,
    completed_at TEXT
  )`);
}

/** 建表缓存：首次调用后复用，失败清空以便重试 */
let ensurePromise: Promise<void> | null = null;

/**
 * 确保表就绪（懒执行，所有读写前调用）
 * @returns Promise，表已就绪
 */
function ensureReady(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = ensureTable().catch((e) => {
      ensurePromise = null;
      throw e;
    });
  }
  return ensurePromise;
}

/**
 * 数据库行 → 任务信息（解析 JSON 字段、还原数值类型）
 * @param row 必填，数据库行
 * @returns 任务信息对象
 */
function rowToInfo(row: any): TaskRowInfo {
  return {
    id: row.id,
    url: row.url,
    filename: row.filename,
    savePath: row.save_path,
    saveDir: row.save_dir,
    status: row.status as TaskStatus,
    totalSize: Number(row.total_size || 0),
    receivedSize: Number(row.received_size || 0),
    category: (row.category || "other") as TaskCategory,
    speed: 0,
    acceptRanges: Number(row.accept_ranges) === 1,
    connections: Number(row.connections || 1),
    errorMsg: row.error_msg || "",
    createdAt: row.created_at || "",
    completedAt: row.completed_at || "",
  };
}

/**
 * 新增任务记录
 * @param info 必填，任务信息（含运行时扩展字段 headers/segments）
 * @returns 是否写入成功
 */
export async function saveTask(info: any): Promise<boolean> {
  try {
    await ensureReady();
    await insert({
      tableName: TABLE,
      data: {
        id: info.id,
        url: info.url,
        filename: info.filename,
        save_path: info.savePath,
        save_dir: info.saveDir,
        status: info.status,
        total_size: info.totalSize,
        received_size: info.receivedSize,
        category: info.category,
        accept_ranges: info.acceptRanges ? 1 : 0,
        connections: info.connections,
        segments: JSON.stringify(info.segments || []),
        headers: JSON.stringify(info.headers || {}),
        error_msg: info.errorMsg || "",
        created_at: info.createdAt,
        completed_at: info.completedAt || "",
      },
      config: { primaryKey: "id" },
    });
    return true;
  } catch (e) {
    console.error("[downloader] 新增任务记录失败:", e);
    return false;
  }
}

/**
 * 按字段更新任务记录（仅传需要更新的列）
 * @param id 必填，任务 ID
 * @param fields 必填，要更新的字段（驼峰 key，内部映射为列名）
 * @returns 是否更新成功
 */
export async function updateTaskFields(id: string, fields: Partial<Record<string, any>>): Promise<boolean> {
  try {
    await ensureReady();
    // 驼峰 → 列名映射
    const colMap: Record<string, string> = {
      status: "status",
      totalSize: "total_size",
      receivedSize: "received_size",
      connections: "connections",
      segments: "segments",
      headers: "headers",
      errorMsg: "error_msg",
      filename: "filename",
      savePath: "save_path",
      completedAt: "completed_at",
    };
    const data: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      const col = colMap[k];
      if (!col) continue;
      if (k === "segments" || k === "headers") {
        data[col] = JSON.stringify(v);
      } else if (k === "savePath") {
        data[col] = v;
      } else {
        data[col] = v;
      }
    }
    if (Object.keys(data).length === 0) return true;
    await update({ tableName: TABLE, data, condition: { id } });
    return true;
  } catch (e) {
    console.error("[downloader] 更新任务记录失败:", e);
    return false;
  }
}

/**
 * 删除任务记录
 * @param id 必填，任务 ID
 * @returns 是否删除成功
 */
export async function deleteTask(id: string): Promise<boolean> {
  try {
    await ensureReady();
    await del({ tableName: TABLE, condition: { id } });
    return true;
  } catch (e) {
    console.error("[downloader] 删除任务记录失败:", e);
    return false;
  }
}

/**
 * 查询全部任务（按创建时间倒序）
 * @returns 任务信息数组（含解析后的分段状态 segments），失败返回空数组
 */
export async function listTasks(): Promise<TaskRowInfo[]> {
  try {
    await ensureReady();
    const rows: any[] = await query({
      tableName: TABLE,
      conditions: { SqlStr: `SELECT * FROM ${TABLE} ORDER BY created_at DESC, id DESC` },
    });
    return (rows || []).map((row) => {
      const info = rowToInfo(row);
      // 解析分段与请求头 JSON（损坏时兜底为空）
      try { info.segments = JSON.parse(row.segments || "[]"); } catch { info.segments = []; }
      try { info.headers = JSON.parse(row.headers || "{}"); } catch { info.headers = {}; }
      return info;
    });
  } catch (e) {
    console.error("[downloader] 查询任务列表失败:", e);
    return [];
  }
}

/**
 * 查询单个任务（用于引擎恢复运行态）
 * @param id 必填，任务 ID
 * @returns 任务信息（含 segments/headers），不存在返回 null
 */
export async function getTask(id: string): Promise<TaskRowInfo | null> {
  try {
    await ensureReady();
    const rows: any[] = await query({
      tableName: TABLE,
      conditions: { SqlStr: `SELECT * FROM ${TABLE} WHERE id = '${String(id).replace(/'/g, "''")}' LIMIT 1` },
    });
    const row = rows?.[0];
    if (!row) return null;
    const info = rowToInfo(row);
    try { info.segments = JSON.parse(row.segments || "[]"); } catch { info.segments = []; }
    try { info.headers = JSON.parse(row.headers || "{}"); } catch { info.headers = {}; }
    return info;
  } catch (e) {
    console.error("[downloader] 查询任务失败:", e);
    return null;
  }
}
