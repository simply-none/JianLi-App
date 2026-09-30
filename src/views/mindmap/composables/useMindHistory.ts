/**
 * 思维导图 —— 撤销 / 重做（快照栈，模块级单例）。
 *
 * 为什么用「整份 data 的快照」而不是「操作日志 + 反向操作」：
 *   树的每次改动都是 immutable 的（见 utils/tree.ts），未被触碰的子树按引用复用，
 *   所以一份快照的实际内存开销远小于「看起来」的体积；
 *   而反向操作要为每种操作各写一条逆运算（删除要记住原位置、折叠要记住原状态……），
 *   漏一条就是「撤销之后图坏了」。快照式不会出错，代价也可控。
 *
 * ⚠️ 快照存的是**整份 `MindDocData`（含 layout）**，所以「切换布局」也能撤销。
 *
 * ⚠️ 本模块**不 import useMindDoc**（避免循环依赖）：
 *   谁持有当前状态谁负责调用 —— `record(prev)` 传入改动**前**的快照，
 *   `undo(current) / redo(current)` 传入**当前**状态并拿回要恢复的那一份。
 *
 * 粒度约定（与用户直觉对齐）：
 *   - 每次真实的树改动 = 一步（增 / 删 / 改文本 / 折叠 / 批量折叠 / 切布局）
 *   - 连续同类型的小改动**不做合并**：内联编辑一次提交就是一次，撤销一步回退一次
 *   - 拖动节点不入栈（坐标是派生数据、不落库，重排后本就会被覆盖）
 *   - 打开 / 新建 / 导入文档会清空历史 —— 否则会撤进「上一份文档」里去
 */

import { computed, ref } from 'vue'

import { MAX_HISTORY } from '../constants'
import type { MindDocData } from '../types'

/** 撤销栈：存放「改动前」的快照，栈顶 = 最近一次改动的上一态 */
const past = ref<MindDocData[]>([])
/** 重做栈：撤销时把当前态压进来，新改动会整体清空 */
const future = ref<MindDocData[]>([])

export function useMindHistory() {
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  /** 可撤销的步数（给按钮 tooltip 用） */
  const depth = computed(() => past.value.length)

  /** 记录一次「改动前」的快照；任何新改动都会让重做栈失效 */
  function record(previous: MindDocData) {
    past.value.push(previous)
    if (past.value.length > MAX_HISTORY) past.value.shift()
    if (future.value.length) future.value = []
  }

  /** 取出上一个快照（同时把当前态压入重做栈）；无可撤销时返回 undefined */
  function undo(current: MindDocData): MindDocData | undefined {
    const previous = past.value.pop()
    if (!previous) return undefined
    future.value.push(current)
    return previous
  }

  /** 取出下一个快照；无可重做时返回 undefined */
  function redo(current: MindDocData): MindDocData | undefined {
    const next = future.value.pop()
    if (!next) return undefined
    past.value.push(current)
    return next
  }

  /** 清空两个栈（打开 / 新建 / 导入文档时调用） */
  function clear() {
    if (past.value.length) past.value = []
    if (future.value.length) future.value = []
  }

  return { canUndo, canRedo, depth, record, undo, redo, clear }
}
