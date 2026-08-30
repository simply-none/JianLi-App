/**
 * 资源管理数据层（SQLite，经 newSql IPC 通道）
 * ------------------------------------------------------------------
 * 通道选型（与 browserApi 同套路）：
 * - 读：`new-sql:query`（SqlStr 直传 SQL，返回行在 data.rows）
 * - 写：`new-sql:upsert`（primaryKey='key'）/ `new-sql:delete`
 * - DDL：`new-sql:execute` 仅用于显式 CREATE TABLE / CREATE INDEX（列定义齐全，无自动建表劫持风险）
 *
 * 表结构：resource
 * - key(主键=落盘绝对路径) / name / path / type / size / ext / is_starred / created_at
 *
 * 旧数据迁移：首次调用 ensureReady 时读取 electron-store 旧键 imageResource
 * （[{val,name,origin}]），逐条转为新表记录，完成后写入迁移标记，仅执行一次。
 */
import type { ResourceItem, ResourceType, SortField, SortOrder } from '../types';
import { getFileType } from '../utils/fileType';
import { getStore, setStore, toPlain } from '@/utils/common';

/** 资源表名 */
const TABLE = 'resource';
/** 业务主键字段（存落盘绝对路径） */
const PK = 'key';
/** 旧数据迁移完成标记的存储键 */
const MIGRATED_FLAG = 'resource:legacy-migrated';

/** 统一 IPC 调用 */
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
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ------------------------------------------------------------------
// 建表与迁移（幂等）
// ------------------------------------------------------------------

/** 容错执行 DDL（列/索引已存在等错误可忽略） */
async function runDdl(sql: string): Promise<void> {
  try {
    await invoke('new-sql:execute', toPlain({ sql }));
  } catch (e) {
    console.warn('[resource] 执行 DDL 失败（可忽略）:', e);
  }
}

/**
 * 旧数据迁移：读取 electron-store 旧键 imageResource 并入库（仅首次执行一次）
 *
 * @returns {Promise<void>} 无返回值；失败仅打印警告，不阻塞主流程
 */
async function migrateLegacyData(): Promise<void> {
  try {
    if (getStore(MIGRATED_FLAG)) return;
    const legacy = getStore('imageResource');
    if (Array.isArray(legacy) && legacy.length > 0) {
      const rows = legacy
        .filter((it: any) => it && it.val)
        .map((it: any) => {
          // 兼容 file:// 前缀的旧路径
          const path = String(it.val).replace(/^file:\/\//, '');
          return {
            [PK]: path,
            name: it.origin || it.name || path.split(/[\\/]/).pop() || path,
            path,
            type: getFileType(it.origin || path),
            size: 0,
            ext: (it.origin || path).split('.').pop()?.toLowerCase() || '',
            is_starred: 0,
            created_at: now(),
          };
        });
      if (rows.length > 0) {
        await invoke('new-sql:upsert', toPlain({
          tableName: TABLE,
          data: rows,
          config: { primaryKey: PK, primaryKeyType: 'TEXT' },
        }));
      }
    }
    setStore(MIGRATED_FLAG, true);
  } catch (e) {
    console.error('[resource] 旧资源数据迁移失败:', e);
  }
}

/** 建表/补列/建唯一索引（幂等，重复调用无害） */
export async function ensureResourceTables(): Promise<void> {
  await runDdl(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      key TEXT PRIMARY KEY,
      name TEXT,
      path TEXT,
      type TEXT,
      size INTEGER DEFAULT 0,
      ext TEXT,
      is_starred INTEGER DEFAULT 0,
      created_at TEXT
    )
  `);
  await runDdl(`CREATE UNIQUE INDEX IF NOT EXISTS uq_${TABLE}_${PK} ON ${TABLE}(${PK})`);
  await migrateLegacyData();
}

/** 模块级建表 Promise：进程内只执行一次，调用方都等同一个结果 */
let ensurePromise: Promise<void> | null = null;

/** 确保表已就绪（懒执行，重复调用复用同一 Promise） */
function ensureReady(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = ensureResourceTables().catch((e) => {
      ensurePromise = null;
      throw e;
    });
  }
  return ensurePromise;
}

// ------------------------------------------------------------------
// 查询
// ------------------------------------------------------------------

/** 列表查询条件 */
export interface ListQuery {
  /** 关键词（匹配文件名），空串不过滤 */
  keyword?: string;
  /** 类型筛选列表，空数组或 undefined 不过滤 */
  types?: ResourceType[];
  /** 排序字段，默认 created_at */
  sortBy?: SortField;
  /** 排序方向，默认 desc */
  order?: SortOrder;
}

/**
 * 查询资源列表
 *
 * @param {ListQuery} [query] - 可选查询条件（关键词/类型/排序）
 * @returns {Promise<ResourceItem[]>} 资源列表，失败返回空数组
 */
export async function listResources(query: ListQuery = {}): Promise<ResourceItem[]> {
  try {
    await ensureReady();
    const where: string[] = [];
    const keyword = (query.keyword || '').trim();
    if (keyword) {
      where.push(`name LIKE ${sqlEscape(`%${keyword}%`)}`);
    }
    if (query.types && query.types.length > 0) {
      const inList = query.types.map((t) => sqlEscape(t)).join(', ');
      where.push(`type IN (${inList})`);
    }
    const sortBy = query.sortBy || 'created_at';
    const order = query.order || 'desc';
    // 排序字段白名单，防注入
    const sortColumn = ['created_at', 'name', 'size'].includes(sortBy) ? sortBy : 'created_at';
    const sql = `SELECT * FROM ${TABLE}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${sortColumn} ${order === 'asc' ? 'ASC' : 'DESC'}`;
    const res = await invoke<IpcResult>('new-sql:query', toPlain({
      tableName: TABLE,
      conditions: { SqlStr: sql },
    }));
    if (!res?.success) return [];
    return pickRows(res.data) as ResourceItem[];
  } catch (e) {
    console.error('[resource] 查询资源列表失败:', e);
    return [];
  }
}

// ------------------------------------------------------------------
// 写入
// ------------------------------------------------------------------

/** 新增资源入参 */
export interface AddResourceParams {
  /** 落盘绝对路径（必填） */
  path: string;
  /** 原始文件名（必填） */
  name: string;
  /** 文件大小（字节） */
  size?: number;
}

/**
 * 检测同名同大小文件是否已入库（上传去重）
 *
 * @param {string} name - 文件名（必填）
 * @param {number} size - 文件大小（必填）
 * @returns {Promise<boolean>} true 表示已存在
 */
export async function existsResource(name: string, size: number): Promise<boolean> {
  try {
    await ensureReady();
    const res = await invoke<IpcResult>('new-sql:query', toPlain({
      tableName: TABLE,
      conditions: {
        SqlStr: `SELECT ${PK} FROM ${TABLE} WHERE name = ${sqlEscape(name)} AND size = ${Number(size) || 0} LIMIT 1`,
      },
    }));
    if (!res?.success) return false;
    return pickRows(res.data).length > 0;
  } catch (e) {
    console.error('[resource] 查重失败:', e);
    return false;
  }
}

/**
 * 新增资源记录（上传成功后调用）
 *
 * @param {AddResourceParams} params - 资源信息（path/name 必填）
 * @returns {Promise<boolean>} 是否写入成功
 */
export async function addResource(params: AddResourceParams): Promise<boolean> {
  try {
    await ensureReady();
    const path = String(params.path).replace(/^file:\/\//, '');
    const res = await invoke<IpcResult>('new-sql:upsert', toPlain({
      tableName: TABLE,
      data: {
        [PK]: path,
        name: params.name || path.split(/[\\/]/).pop() || path,
        path,
        type: getFileType(params.name || path),
        size: Number(params.size) || 0,
        ext: (params.name || path).split('.').pop()?.toLowerCase() || '',
        is_starred: 0,
        created_at: now(),
      },
      config: { primaryKey: PK, primaryKeyType: 'TEXT' },
    }));
    return !!res?.success;
  } catch (e) {
    console.error('[resource] 新增资源失败:', e);
    return false;
  }
}

/**
 * 删除资源记录
 *
 * @param {string} key - 资源主键（落盘绝对路径，必填）
 * @returns {Promise<boolean>} 是否删除成功
 */
export async function deleteResource(key: string): Promise<boolean> {
  try {
    await ensureReady();
    const res = await invoke<IpcResult>('new-sql:delete', toPlain({
      tableName: TABLE,
      condition: { [PK]: key },
    }));
    return !!res?.success;
  } catch (e) {
    console.error('[resource] 删除资源记录失败:', e);
    return false;
  }
}

/**
 * 切换收藏状态
 *
 * @param {string} key - 资源主键（必填）
 * @param {boolean} starred - 目标收藏状态（必填）
 * @returns {Promise<boolean>} 是否更新成功
 */
export async function toggleStar(key: string, starred: boolean): Promise<boolean> {
  try {
    await ensureReady();
    const res = await invoke<IpcResult>('new-sql:update', toPlain({
      tableName: TABLE,
      data: { is_starred: starred ? 1 : 0 },
      condition: { [PK]: key },
    }));
    return !!res?.success;
  } catch (e) {
    console.error('[resource] 更新收藏状态失败:', e);
    return false;
  }
}

// ------------------------------------------------------------------
// 文件级操作（主进程 resource 模块）
// ------------------------------------------------------------------

/**
 * 读取文本文件内容（预览用）
 *
 * @param {string} path - 文件绝对路径（必填）
 * @returns {Promise<{ content: string; truncated: boolean } | null>} 成功返回内容与截断标记，失败返回 null
 */
export async function readTextFile(path: string): Promise<{ content: string; truncated: boolean } | null> {
  try {
    const res = await invoke<IpcResult<{ content: string; truncated: boolean }>>(
      'resource:read-text-file',
      toPlain({ path }),
    );
    if (!res?.success) return null;
    return { content: res.data?.content || '', truncated: !!res.data?.truncated };
  } catch (e) {
    console.error('[resource] 读取文本失败:', e);
    return null;
  }
}

/**
 * 删除物理文件（仅允许删除缓存目录内的文件）
 *
 * @param {string} path - 文件绝对路径（必填）
 * @param {string} cacheDir - 资源缓存目录白名单（必填，取自 fileCachePath 设置）
 * @returns {Promise<boolean>} 是否删除成功（文件不存在视为成功）
 */
export async function deletePhysicalFile(path: string, cacheDir: string): Promise<boolean> {
  try {
    const res = await invoke<IpcResult>('resource:delete-file', toPlain({ path, cacheDir }));
    if (!res?.success) {
      console.error('[resource] 删除物理文件失败:', res?.error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[resource] 删除物理文件失败:', e);
    return false;
  }
}
