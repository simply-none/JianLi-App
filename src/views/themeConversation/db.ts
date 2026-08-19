/**
 * 主题对话 - 数据库访问层
 * ------------------------------------------------------------------
 * 统一封装对 newSql.ts（electron/main/module/newSql.ts）暴露的 IPC 通道的调用。
 * newSql 提供的通道：
 *   - new-sql:query    查询（支持 conditions / whereStr / SqlStr / orderBy 等）
 *   - new-sql:insert   插入（自动建表、自动扩展列，支持自定义主键）
 *   - new-sql:update   更新
 *   - new-sql:delete   删除
 *   - new-sql:execute  执行任意 SQL（用于跨表搜索等复杂查询）
 *
 * 所有表主键统一使用自增整数 id（newSql 默认主键），引用关系用 JSON 字符串数组存储。
 */

const ipc: any = (window as any).ipcRenderer;

/**
 * 去除 Vue reactive Proxy，转成可被 IPC 结构化克隆（structured clone）的纯数据。
 * 否则把 reactive 数组/对象（如编辑弹窗的 form.tags）传给 ipcRenderer.invoke 时，
 * 会因为 Proxy 无法被克隆而抛出「An object could not be cloned」。
 * 本功能涉及的数据库数据均为 字符串 / 数字 / 字符串数组，JSON 往返不会丢失信息。
 */
function cloneForIpc<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
}

/** 查询：返回行数组 */
export async function dbQuery(options: any): Promise<any[]> {
  const res = await ipc.handlePromise('new-sql:query', cloneForIpc(options));
  if (!res || !res.success) {
    throw new Error((res && res.error) || '查询失败');
  }
  return res.data || [];
}

/** 插入：返回 { lastID, changes } */
export async function dbInsert(tableName: string, data: Record<string, any>, primaryKey = 'id'): Promise<any> {
  const res = await ipc.handlePromise('new-sql:insert', cloneForIpc({ tableName, data, config: { primaryKey } }));
  if (!res || !res.success) {
    throw new Error((res && res.error) || '插入失败');
  }
  return res.data;
}

/** 更新：返回 { changes } */
export async function dbUpdate(tableName: string, data: Record<string, any>, condition: Record<string, any>): Promise<any> {
  const res = await ipc.handlePromise('new-sql:update', cloneForIpc({ tableName, data, condition }));
  if (!res || !res.success) {
    throw new Error((res && res.error) || '更新失败');
  }
  return res.data;
}

/** 删除：返回 { changes } */
export async function dbDelete(tableName: string, condition: Record<string, any>): Promise<any> {
  const res = await ipc.handlePromise('new-sql:delete', cloneForIpc({ tableName, condition }));
  if (!res || !res.success) {
    throw new Error((res && res.error) || '删除失败');
  }
  return res.data;
}

/** 执行任意 SQL：SELECT 返回 rows 数组 */
export async function dbExecute(sql: string, params: any[] = []): Promise<any[]> {
  const res = await ipc.handlePromise('new-sql:execute', cloneForIpc({ sql, params }));
  if (!res || !res.success) {
    throw new Error((res && res.error) || '执行失败');
  }
  const d = res.data;
  // execute 的 SELECT 结果放在 data.rows 中
  return (d && d.rows) ? d.rows : (Array.isArray(d) ? d : []);
}
