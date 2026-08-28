import type { CommandItem, CommandSource } from '../types'
import { matchScore, byScoreDesc } from '../utils/score'
import { truncate } from '../utils/text'
import { DEFAULT_LIMIT, MAX_PER_SOURCE } from '../config/paletteConfig'
import { fetchHabitDefs, fetchCheckins, upsertCheckin } from '@/views/habit/api/habitApi'
import { todayStr, timeToStr } from '@/views/habit/utils/streak'
import { dispatchChainActions } from '@/views/habit/chainActions'
import type { HabitDef } from '@/views/habit/types'
import { ElMessage } from 'element-plus'

/**
 * 习惯数据源（`!` 作用域）。
 * 与 note/todo 源一致：自己走 IPC 查库，不依赖命令面板所在的渲染进程 store，
 * 避免跨窗口触发提醒引擎的重复同步。
 * 回车即「打卡」——这是习惯最核心的动作，从命令面板一键完成，
 * 并在写库后派发链式动作（待办完成 / 笔记日志等），与主流程行为一致。
 */
export const habitSource: CommandSource = {
  id: 'habit',
  label: '习惯',

  async search(query) {
    const q = query.trim()
    const [defs, checkins] = await Promise.all([fetchHabitDefs(), fetchCheckins()])

    const today = todayStr()
    const doneSet = new Set(
      checkins.filter((c) => c.date === today).map((c) => c.habitKey)
    )

    let list = defs
    if (q) {
      list = defs.filter(
        (h) =>
          matchScore(q, h.name) > 0 ||
          matchScore(q, h.remark || '') > 0 ||
          h.name.includes(q) ||
          (h.remark || '').includes(q)
      )
    }

    const scored = list.map((h) => {
      const done = doneSet.has(h.key)
      const score = q
        ? Math.max(matchScore(q, h.name), matchScore(q, h.remark || '') - 15)
        : done
          ? 0.5 // 已打卡的稍微沉底，方便今天还没打的排前面
          : 1
      return { h, done, score }
    })

    return byScoreDesc(scored)
      .slice(0, q ? MAX_PER_SOURCE : DEFAULT_LIMIT)
      .map(({ h, done }) => buildItem(h, done))
  },
}

function buildItem(habit: HabitDef, doneToday: boolean): CommandItem {
  return {
    id: `habit:${habit.key}`,
    type: 'habit',
    title: (doneToday ? '✓ ' : '') + truncate(habit.name, 40),
    subtitle: doneToday
      ? '今日已打卡 · 回车可再打卡（覆盖）'
      : habit.remark
        ? truncate(habit.remark, 30)
        : '未打卡 · 回车即打卡',
    icon: doneToday ? 'CircleCheck' : 'AlarmClockCheck',
    score: 0, // 排序已在 search 内完成
    run: async ({ hidePalette }) => {
      hidePalette()
      const date = todayStr()
      const record = {
        key: `${habit.key}#${date}`,
        habitKey: habit.key,
        date,
        time: timeToStr(new Date()),
        value: '',
        note: '',
        source: 'palette' as const,
      }
      const ok = await upsertCheckin(record)
      if (!ok) {
        ElMessage.error(`「${habit.name}」打卡失败`)
        return
      }
      // 写库成功后派发链式动作（待办完成 / 笔记日志等），失败只提示不阻断
      try {
        const results = await dispatchChainActions(habit, record as any)
        const failed = results.filter((r) => !r.ok)
        if (failed.length) {
          ElMessage.warning(`「${habit.name}」打卡成功，但串接未全部完成：${failed.map((f) => f.message).join('；')}`)
          return
        }
      } catch (err) {
        ElMessage.warning(`「${habit.name}」打卡成功，但串接动作异常`)
        return
      }
      ElMessage.success(`「${habit.name}」打卡成功`)
    },
  }
}
