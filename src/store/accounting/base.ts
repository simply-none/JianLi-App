/**
 * 记账 store 子模块 - 共享基础设施
 *
 * 提供各子模块（budget / recurring）与主 store 共用的 IPC 封装与时间工具，
 * 避免在多个文件里重复定义。
 */

/** new-sql 系列通道的统一调用封装（启动已 initNewSqlite，表与列自动创建） */
export function accountingIpc<T = any>(channel: string, payload: any): Promise<T> {
  return window.ipcRenderer.handlePromise(channel, payload) as Promise<T>
}

/** 当前时间字符串 YYYY-MM-DD HH:mm:ss */
export function nowStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 今天日期字符串 YYYY-MM-DD */
export function todayStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 当前月份字符串 YYYY-MM */
export function currentMonthStr(): string {
  return todayStr().slice(0, 7)
}
