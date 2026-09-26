/**
 * 可视化流水线 IPC 薄封装
 *
 * 读：new-sql:read（主进程新增，仅 SELECT、只读连接、参数化）
 * 写：new-sql:transaction（既有通道，runInTx + withWriteLock，失败自动回滚）
 * 自省：new-sql:listTables / new-sql:tableInfo（既有通道）
 */
import type { CompileResult } from "./compiler";

export interface IpcResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/** 执行只读 SELECT */
export async function runRead(sql: string, params: any[] = []): Promise<IpcResult<any[]>> {
  return window.ipcRenderer.handlePromise("new-sql:read", { sql, params });
}

/** 在单一事务中执行写语句（失败自动回滚） */
export async function runWrite(sqls: string[], params: any[][] = []): Promise<IpcResult> {
  return window.ipcRenderer.handlePromise("new-sql:transaction", { sqls, params });
}

/** 数据库全部表名 */
export async function listTables(): Promise<string[]> {
  const res: IpcResult<string[]> = await window.ipcRenderer.handlePromise("new-sql:listTables", {});
  return res.success && Array.isArray(res.data) ? res.data : [];
}

/** 某表的列名清单 */
export async function tableColumns(tableName: string): Promise<string[]> {
  const res: IpcResult<any[]> = await window.ipcRenderer.handlePromise("new-sql:tableInfo", { tableName });
  return res.success && Array.isArray(res.data) ? res.data.map((item: any) => item.name) : [];
}

/** 探针：统计「截至某节点」的行数，返回 { rows, ms } */
export async function probeNode(
  sql: string,
  params: any[]
): Promise<{ ok: boolean; rows?: number; ms: number; error?: string }> {
  const start = performance.now();
  const res = await runRead(sql, params);
  const ms = Math.round((performance.now() - start) * 10) / 10;
  if (!res.success) return { ok: false, ms, error: res.error };
  const rows = Array.isArray(res.data) && res.data.length > 0 ? Number(res.data[0]?.cnt ?? 0) : 0;
  return { ok: true, rows, ms };
}

/** 运行编译产物：有写回语句则走事务，否则只读执行主查询 */
export async function runCompiled(compiled: CompileResult): Promise<IpcResult<any[]>> {
  if (!compiled.ok || !compiled.select) return { success: false, error: compiled.errors.join("；") };
  if (compiled.insertSql) {
    const txRes = await runWrite([compiled.insertSql], [compiled.insertParams || []]);
    if (!txRes.success) return txRes;
    // 写完回读一次，让用户直接看到写回后的结果
    return runRead(compiled.select.sql, compiled.select.params);
  }
  return runRead(compiled.select.sql, compiled.select.params);
}
