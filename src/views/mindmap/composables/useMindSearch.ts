/**
 * 思维导图 —— 节点搜索（模块级单例）。
 *
 * 搜索范围是**整棵树**，不受折叠影响 —— 用户搜的是内容，不是当前视图；
 * 命中一个被折叠藏起来的节点时，`pick()` 会先把它这一路的祖先展开，
 * 再选中并请求画布定位（三件事的顺序不能颠倒：不先展开，画布上根本没有那个节点）。
 *
 * 匹配规则刻意做得「笨」但可预期：大小写不敏感的子串匹配，按树的深度优先顺序返回。
 * 不做模糊 / 拼音 / 打分排序 —— 导图上的节点文本普遍很短，
 * 子串匹配已经足够，而打分排序会让「同名节点谁排前面」变得难以解释。
 */

import { computed, ref, watch } from 'vue'

import type { MindNode } from '../types'
import { collectSubtreeIds } from '../utils/tree'
import { useMindDoc } from './useMindDoc'
import { useMindView } from './useMindView'

/** 命中的节点 */
export interface MindSearchHit {
  id: string
  text: string
  /** 祖先文本路径（不含自身），用作结果行下方的面包屑 */
  breadcrumb: string
  /** 深度（根 = 0） */
  level: number
  /** 是否带备注（结果行给个小标记） */
  hasNote: boolean
}

/** 最多返回多少条命中（避免长列表把下拉撑爆） */
const MAX_HITS = 60

/**
 * 纯函数：深度优先遍历整棵树，返回命中的节点。
 * 关键词为空（或全空白）时返回空数组。
 */
export function searchNodes(root: MindNode, query: string, limit = MAX_HITS): MindSearchHit[] {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return []

  const hits: MindSearchHit[] = []
  const walk = (node: MindNode, trail: string[], level: number) => {
    if (hits.length >= limit) return
    if (node.text.toLowerCase().includes(keyword)) {
      hits.push({
        id: node.id,
        text: node.text,
        breadcrumb: trail.join(' / '),
        level,
        hasNote: Boolean(node.note),
      })
    }
    if (node.children.length) {
      const nextTrail = [...trail, node.text]
      node.children.forEach(child => walk(child, nextTrail, level + 1))
    }
  }

  walk(root, [], 0)
  return hits
}

/* ------------------------------------------------------------ 单例状态 */

/** 搜索面板是否展开 */
const open = ref(false)
/** 关键词 */
const query = ref('')
/** 键盘上下键高亮的第几条 */
const activeIndex = ref(0)

// 关键词一变就把高亮拉回第一条（模块级一次性注册，与单例同生命周期）
watch(query, () => {
  activeIndex.value = 0
})

export function useMindSearch() {
  const mind = useMindDoc()
  const view = useMindView()

  const hits = computed(() => searchNodes(mind.tree.value, query.value))

  function show() {
    open.value = true
  }

  function close() {
    if (!open.value && !query.value) return
    open.value = false
    query.value = ''
    activeIndex.value = 0
  }

  function toggle() {
    if (open.value) close()
    else show()
  }

  /** 上下移动高亮（循环） */
  function moveCursor(step: number) {
    const total = hits.value.length
    if (!total) return
    activeIndex.value = (activeIndex.value + step + total) % total
  }

  /**
   * 选中并定位到第 index 条命中。
   * 顺序：**退出聚焦（若命中的在聚焦子树外）→ 展开祖先 → 选中 → 请求画布定位 → 关面板**。
   *
   * ⚠️ 搜索范围是整棵树（见文件头），所以很可能命中聚焦之外的节点。
   *    不先退出聚焦的话，「展开祖先 + 选中」都会执行、节点也确实被选中了，
   *    但画布上根本渲染不出它（聚焦态只渲染那棵子树）—— 表现成「点了搜索结果什么都没发生」，
   *    是最难解释的一类 bug。所以这里必须先判、先退出。
   */
  function pick(index: number = activeIndex.value): string | undefined {
    const hit = hits.value[index]
    if (!hit) return undefined
    const focusId = view.focusRootId.value
    if (focusId && !collectSubtreeIds(mind.tree.value, focusId).includes(hit.id)) {
      view.exitFocus()
    }
    mind.revealNode(hit.id)
    mind.select(hit.id)
    view.requestFocus(hit.id)
    close()
    return hit.id
  }

  return { open, query, hits, activeIndex, show, close, toggle, moveCursor, pick }
}
