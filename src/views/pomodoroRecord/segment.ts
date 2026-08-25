// 番茄钟记录「时间段」计算的单一数据源。
//
// 数据库 pomodoro_status 每行记录的是某个状态（工作/休息/强制锁屏）的「创建（进入）时间」。
// 番茄钟各状态都配置有固定的时间间隔（work/rest 有，lock 无固定间隔）。
// 单条记录的「时间段」需按以下规则推导（与提醒列表/小窗同口径）：
//   A. 创建时间 + 间隔 >= 下一条记录的创建时间  → 段尾 = 下一条记录的创建时间
//   B. 创建时间 + 间隔 <  下一条记录的创建时间  → 段尾 = 创建时间 + 间隔
// 即 段尾 = min(下一条创建时间, 创建时间 + 间隔)。
// 强制锁屏(lock) 无固定间隔 → 返回 null，调用方据此不做截断，段尾恒为「下一条创建时间」(解锁时刻)。
//
// 间隔配置权威来源：reminders 表 id='pomodoro' 行的 states 字段（按 key 匹配），而非派生的 getStore 值。

import useNewReminder from '@/store/useNewReminder'

/**
 * 获取某状态配置的时间间隔（毫秒）。
 * @param type 状态 key：work / rest / lock / screen / 自定义
 * @returns 配置间隔毫秒；lock(间隔为0) / 未匹配 / 未知状态返回 null（无固定间隔，不截断）
 */
export function getConfiguredIntervalMs (type: string): number | null {
  const reminderStore = useNewReminder()
  const pomodoro = reminderStore.reminders.find(
    (r: any) => r.id === 'pomodoro' && r.mode === 'stateful'
  )
  if (!pomodoro || !Array.isArray(pomodoro.states)) return null

  // 按 key 精确匹配（不依赖 states 顺序），与番茄钟实际 states 定义一致
  const state = pomodoro.states.find((s: any) => s.key === type)
  if (!state) return null

  const duration = Number(state.duration)
  const unit = Number(state.unit)
  // lock: duration 0 → 无固定间隔；duration/unit 任一缺失也视为无间隔
  if (!duration || !unit) return null

  return duration * unit
}
