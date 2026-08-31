/**
 * 二维码历史 / 模板持久化（全局统一 qr_history + qr_template 两张表）。
 * ------------------------------------------------------------------
 * - 来源统一：source 列区分「qrCode 页面」与其它业务模块，便于按来源筛选。
 * - 走 newSql 三件套（query / upsert / delete），严禁裸 new-sql:execute。
 * - 表结构由主进程 initQrCode 用 ensureTableExists 建好（带 key 主键 +
 *   source 列），此处只负责读写，避免渲染端触发自动建表 / hack 列。
 */
import type {
  QrHistoryRecord,
  QrTemplate,
  QrStyleOptions,
  QrPayloadType,
} from './types';
import { toPlain } from '@/utils/common';

const HISTORY_TABLE = 'qr_history';
const TEMPLATE_TABLE = 'qr_template';

/** 渲染端 IPC 封装（handlePromise 由 preload 暴露） */
function ipc(channel: string, payload: any): Promise<any> {
  return window.ipcRenderer.handlePromise(channel, toPlain(payload));
}

/** 生成主键（优先随机 UUID，非安全上下文回退） */
function genKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'qr-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }
}

export interface AddHistoryInput {
  /** 必填，来源模块标识（如 'qrCode' / 'habit' / 'contact'） */
  source: string;
  type: QrPayloadType;
  content: string;
  style?: QrStyleOptions | null;
  note?: string;
  /** 可选，不传则自动生成 */
  key?: string;
}

/** 写入一条历史（按 key upsert） */
export async function addQrHistory(
  input: AddHistoryInput,
): Promise<QrHistoryRecord | null> {
  const record: QrHistoryRecord = {
    key: input.key || genKey(),
    source: input.source,
    type: input.type,
    content: input.content,
    style: input.style ?? null,
    note: input.note ?? '',
    created_at: new Date().toISOString(),
  };
  const res = await ipc('new-sql:upsert', {
    tableName: HISTORY_TABLE,
    data: record,
    config: { primaryKey: 'key', primaryKeyType: 'TEXT' },
  });
  if (res?.success) return record;
  console.error('[qr-history] addQrHistory failed', res);
  return null;
}

/** 查询历史（可按 source 过滤、分页，默认按时间倒序） */
export async function getQrHistory(opts?: {
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<QrHistoryRecord[]> {
  const res = await ipc('new-sql:query', {
    tableName: HISTORY_TABLE,
    conditions: opts?.source ? { source: opts.source } : {},
    orderBy: 'created_at',
    orderByDesc: true,
    limit: opts?.limit,
    offset: opts?.offset,
  });
  const rows = res?.data ?? res?.rows ?? [];
  return Array.isArray(rows) ? (rows as QrHistoryRecord[]) : [];
}

/** 删除一条历史 */
export async function deleteQrHistory(key: string): Promise<boolean> {
  const res = await ipc('new-sql:delete', {
    tableName: HISTORY_TABLE,
    condition: { key },
  });
  return res?.success === true;
}

/** 清空某来源或全部历史 */
export async function clearQrHistory(source?: string): Promise<boolean> {
  const sql = source
    ? `DELETE FROM ${HISTORY_TABLE} WHERE source = '${source.replace(/'/g, "''")}'`
    : `DELETE FROM ${HISTORY_TABLE}`;
  const res = await ipc('new-sql:query', {
    tableName: HISTORY_TABLE,
    conditions: { SqlStr: sql },
  });
  return res?.success === true;
}

/** 新增 / 更新模板 */
export async function saveQrTemplate(input: {
  key?: string;
  name: string;
  source: string;
  type: QrPayloadType;
  content: string;
  style?: QrStyleOptions | null;
}): Promise<QrTemplate | null> {
  const record: QrTemplate = {
    key: input.key || genKey(),
    name: input.name,
    source: input.source,
    type: input.type,
    content: input.content,
    style: input.style ?? null,
    created_at: new Date().toISOString(),
  };
  const res = await ipc('new-sql:upsert', {
    tableName: TEMPLATE_TABLE,
    data: record,
    config: { primaryKey: 'key', primaryKeyType: 'TEXT' },
  });
  if (res?.success) return record;
  console.error('[qr-history] saveQrTemplate failed', res);
  return null;
}

/** 查询模板（可按 source 过滤） */
export async function getQrTemplates(source?: string): Promise<QrTemplate[]> {
  const res = await ipc('new-sql:query', {
    tableName: TEMPLATE_TABLE,
    conditions: source ? { source } : {},
    orderBy: 'created_at',
    orderByDesc: true,
  });
  const rows = res?.data ?? res?.rows ?? [];
  return Array.isArray(rows) ? (rows as QrTemplate[]) : [];
}

/** 删除模板 */
export async function deleteQrTemplate(key: string): Promise<boolean> {
  const res = await ipc('new-sql:delete', {
    tableName: TEMPLATE_TABLE,
    condition: { key },
  });
  return res?.success === true;
}
