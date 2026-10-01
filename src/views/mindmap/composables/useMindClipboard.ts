/**
 * 思维导图 —— 模块级剪贴板（复制 / 剪切 / 粘贴子树）。
 *
 * 三条刻意定下的语义（都写在这里，免得将来被「优化」掉）：
 *
 * 1. **不碰系统剪贴板**。导图节点不是文本，写进系统剪贴板只有坏处
 *    （用户在别处 Ctrl+V 会粘出一段莫名其妙的节点文本）。所以这里是**模块级内存剪贴板**。
 *
 * 2. **剪贴板里存的是「子树快照」**，而**每次粘贴都重新 clone 一遍**换新 id。
 *    ⇒ 同一份快照可以连贴多次，得到的副本 id 全集互不相交（不会出现「两个节点同 id」这种
 *    会让 vue-flow 内部 map 错乱的状态）。
 *
 * 3. **剪切 = 复制快照 + 删除原节点**，删除走 `useMindDoc.removeNodeById`
 *    ⇒ 它经 `commit()`，所以 Ctrl+Z 能把整步「剪切」一次找回来（而不是只回来一半）。
 *
 * ⚠️ 因为是**模块级单例**，剪贴板天然**跨文档可用**：在 A 图复制、切到 B 图粘贴，
 *    副本带着它的文本 / 备注 / 三类颜色 / 图标 / 链接一起过去，只有 id 与 `pos` 是新的。
 *    这是特性而不是副作用 —— 用户想跨图搬一棵子树时不必先导出再导入。
 *
 * ⚠️ 根节点：**可以复制**（副本挂到根下，与「复制节点」对根的退化行为一致），
 *    **不可以剪切**（根是文档本体，剪了就没有图了）。
 */

import { computed, ref } from 'vue'

import type { MindNode } from '../types'
import { useMindDoc } from './useMindDoc'

/** 剪贴板内容（子树快照）；null = 空 */
const clipboard = ref<MindNode | null>(null)

export function useMindClipboard() {
  const mind = useMindDoc()

  const hasClipboard = computed(() => clipboard.value !== null)

  /**
   * 复制某节点整棵子树到剪贴板。
   * @returns 是否有内容进了剪贴板（节点不存在时 false）
   */
  function copy(id: string): boolean {
    const snapshot = mind.snapshotById(id)
    if (!snapshot) return false
    clipboard.value = snapshot
    return true
  }

  /**
   * 剪切某节点整棵子树：复制快照 + 从树上摘掉。
   * 根节点返回 false（剪了整张图就没了）。
   */
  function cut(id: string): boolean {
    if (!id || id === mind.tree.value.id) return false
    if (!copy(id)) return false
    return mind.removeNodeById(id)
  }

  /**
   * 把剪贴板内容粘贴为 `targetId`（缺省 = 当前选中节点）的子节点。
   * @returns 新节点 id；剪贴板为空 / 目标不存在时 undefined（且**不产生任何撤销步**）
   */
  function paste(targetId?: string): string | undefined {
    const snapshot = clipboard.value
    if (!snapshot) return undefined
    const parentId = targetId || mind.pasteTargetId()
    return mind.pasteChild(parentId, snapshot)
  }

  /** 清空剪贴板（当前没有 UI 入口，留给将来的「清空」菜单项 / 测试用） */
  function clear() {
    clipboard.value = null
  }

  return { clipboard, hasClipboard, copy, cut, paste, clear }
}
