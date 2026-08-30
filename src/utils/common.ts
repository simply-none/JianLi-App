import { isProxy, isRef, toRaw, unref } from "vue"
import moment from 'moment';

// 数据表名称
export const pomodoroStatusTable = 'pomodoro_status'
export const basicInfoTable = 'basic_info'

// 从store中获取数据
export function getStore(key: string) {
  return window.ipcRenderer.sendSync('get-store', key)
}

/**
 * 把 Vue 的 ref / reactive / readonly 代理递归还原为纯对象。
 * ipcRenderer.send / sendSync 走的是「结构化克隆」算法，Proxy 无法被克隆，
 * 会抛出 DataCloneError: An object could not be cloned。
 * 仅对顶层 toRaw 不够：progressMap 形如 Record<string, EbookProgress>，
 * 其值是嵌套对象，展开响应式对象时会把内部值重新包成 Proxy，必须递归展开。
 * @param value 任意值（可能含 Vue ref / 代理）
 * @param seen 已访问对象集合，防止循环引用导致栈溢出
 * @returns 可被结构化克隆的纯对象
 */
export function toPlain(value: any, seen = new WeakSet()): any {
  if (value === null || value === undefined) return value;
  if (isRef(value)) return toPlain(unref(value), seen);
  if (isProxy(value)) return toPlain(toRaw(value), seen);
  // 二进制类型保持原样，交给结构化克隆序列化：
  // 否则会被当成普通对象用 Object.keys 遍历而塌缩成 {}，
  // 导致主进程 Buffer.from 收到空对象而报 ERR_INVALID_ARG_TYPE。
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return value;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return value;
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) return value; // TypedArray / DataView
  if (typeof value === 'object') {
    // 原始类型（Date 等结构化克隆原生支持）直接返回
    if (value instanceof Date || value instanceof RegExp || value instanceof Map || value instanceof Set) {
      return value;
    }
    if (seen.has(value)) return value; // 循环引用时原样返回，避免无限递归
    seen.add(value);
    if (Array.isArray(value)) return value.map((v) => toPlain(v, seen));
    const out: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      out[key] = toPlain(value[key], seen);
    }
    return out;
  }
  return value;
}

// 设置store中的数据，其中value的值必须正确
export function setStore(key: 'multi-field' | string, value: any) {
  // 递归还原 Vue 代理/ref 为纯对象，避免结构化克隆失败（见 toPlain 注释）
  value = toPlain(value)
  window.ipcRenderer.sendSync('set-store', key, value)
}

// 发送同步数据
export function sendSync(key: string, value: any) {
  // 还原 Vue 代理/ref 为纯对象，避免结构化克隆失败
  value = toPlain(value)
  return window.ipcRenderer.sendSync(key, value) 
}

// 发送异步数据
export function send(key: string, value: any, ops?: any) {
  // 递归还原 Vue 代理/ref 为纯对象，避免结构化克隆失败（见 toPlain 注释）
  value = toPlain(value)
  ops = toPlain(ops)
  window.ipcRenderer.send(key, value, ops)
}

// 发送异步数据，参数是key: string, ...args: any[]
export function sendMany(key: string, ...args: any[]) {
  // 递归还原每个参数为纯对象，避免结构化克隆失败
  const plainArgs = args.map((a) => toPlain(a))
  window.ipcRenderer.send(key, ...plainArgs)
}

// 获取窗口配置，从 SQLite 的 basic_info 表中读取 window-mode:{windowName}
export function getWindowConfig(windowName: string): ObjectType {
  try {
    const key = `window-mode:${windowName}`;
    let config: ObjectType | string = getStore(key);
    if (config && typeof config === 'string') {
      config = JSON.parse(config)
    }
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      return config;
    }
    return {};
  } catch (err) {
    console.error(err, 'getWindowConfig error')
    return {}
  }
}

/**
 * 写入/更新业务表数据（newSql 数据层）
 *
 * 走 new-sql:upsert 通道：主键冲突时更新，否则插入。
 * 表不存在时主进程会按 config.primaryKey 自动建表并补唯一索引。
 *
 * @param params.tableName 必填，目标表名
 * @param params.data 必填，写入的数据对象（自动还原 Vue 代理）
 * @param params.config 可选，{ primaryKey } 指定主键字段，默认 id
 * @returns 成功返回主进程结果对象；失败返回 false
 */
export const setSqlData = async ({
  tableName,
  data,
  config,
}: {
  tableName: string,
  data: Object,
  config?: Object,
}) => {
  const curTime = moment().format('YYYY-MM-DD HH:mm:ss')

  return window.ipcRenderer.handlePromise('new-sql:upsert', {
    tableName: tableName,
    data: {
      ...toPlain(data),
      create_time: curTime,
    },
    config: toPlain(config)
  }).catch(err => {
    console.error(err, 'setSqlData error')
    return false
  })
}

/**
 * 查询业务表数据（newSql 数据层）
 *
 * 走 new-sql:query 通道。注意与旧 query-data 的差异：
 * whereStr / orderBy / orderByDesc / limit / offset 必须放在顶层，
 * conditions 里只放等值过滤字段。
 *
 * @param params.tableName 必填，目标表名
 * @param params.conditions 可选，等值过滤条件对象 {字段:值}
 * @param params.rest 可选，顶层查询选项（whereStr/orderBy/orderByDesc/limit/offset/SqlStr 等）
 * @returns 成功返回 { success: true, data: 行数组 }；失败返回 []
 */
export const getSqlData = async ({
  tableName,
  conditions,
  ...rest
}: {
  tableName: string,
  conditions?: Object,
} & Record<string, any>) => {
  return window.ipcRenderer.handlePromise('new-sql:query', {
    tableName: tableName,
    conditions: toPlain(conditions),
    ...toPlain(rest),
  }).catch(err => {
    console.error(err, 'getSqlData error')
    return []
  })
}

// 番茄钟状态记录：走 newSql.ts 的 new-sql:record-pomodoro 通道（主进程带去重，防主窗口/小窗双写）
export const setPomodoroStatus = async (data: Object) => {
  const curTime = moment().format('YYYY-MM-DD HH:mm:ss')
  return window.ipcRenderer.handlePromise('new-sql:record-pomodoro', {
    ...toPlain(data),
    create_time: curTime,
  }).catch(err => {
    console.error(err, 'setPomodoroStatus error')
    return false
  })
}

// 番茄钟记录删除：走 newSql.ts 的 new-sql:delete 通道（按 condition 构造 WHERE）
export const deletePomodoroStatus = async (condition: Object) => {
  const res = await window.ipcRenderer.handlePromise('new-sql:delete', {
    tableName: pomodoroStatusTable,
    condition: toPlain(condition),
  }).catch(err => {
    console.error(err, 'deletePomodoroStatus error')
    return { success: false }
  })
  return res?.success === true
}

/**
 * 删除业务表数据（newSql 数据层）
 *
 * 走 new-sql:delete 通道，按 condition 等值条件构造 WHERE 删除。
 *
 * @param params.tableName 必填，目标表名
 * @param params.conditions 必填，删除条件对象 {字段:值}，不能为空
 * @returns 成功返回主进程结果对象；失败返回 false
 */
export const deleteSqlData = async ({
  tableName,
  conditions,
}: {
  tableName: string,
  conditions: Object,
}) => {
  return window.ipcRenderer.handlePromise('new-sql:delete', {
    tableName: tableName,
    condition: toPlain(conditions),
  }).catch(err => {
    console.error(err, 'deleteSqlData error')
    return false
  })
}