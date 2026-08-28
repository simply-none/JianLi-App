import { computed, onBeforeUnmount, ref } from 'vue'
import type { CommandContext, CommandItem } from '../types'
import { useCommandSources } from './useCommandSources'
import { DEBOUNCE_MS } from '../config/paletteConfig'

/** 解析输入：以 @ / # / / ! 开头时进入对应作用域，剩余部分才是真正关键词 */
const SCOPE_PATTERN = /^([@#/!])([\s\S]*)$/

/**
 * 命令面板的状态机：关键词 → 作用域 → 结果列表 → 选中项 → 执行。
 * 面板组件只负责渲染，所有逻辑收敛在这里。
 */
export function useCommandPalette(context: CommandContext) {
  const { search } = useCommandSources()

  const keyword = ref('')
  const items = ref<CommandItem[]>([])
  const loading = ref(false)
  const activeIndex = ref(0)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  /** 查询序号：只有最后一次查询的结果才允许写入 items，防止慢查询覆盖新结果 */
  let searchSeq = 0

  /** 作用域前缀：'' 表示搜全部 */
  const scope = computed(() => {
    const matched = SCOPE_PATTERN.exec(keyword.value)
    return matched ? matched[1] : ''
  })

  /** 去掉作用域前缀后的真正关键词 */
  const query = computed(() => {
    const matched = SCOPE_PATTERN.exec(keyword.value)
    return (matched ? matched[2] : keyword.value).trim()
  })

  /** 立即查询（跳过防抖），供初始化与窗口重新显示时调用 */
  async function queryNow() {
    const seq = ++searchSeq
    loading.value = true
    try {
      const result = await search(query.value, { scope: scope.value })
      // 期间又发起了新查询，丢弃本次结果
      if (seq !== searchSeq) return
      items.value = result
      // 结果可能变短，避免 activeIndex 越界
      if (activeIndex.value >= items.value.length) {
        activeIndex.value = Math.max(0, items.value.length - 1)
      }
    } finally {
      if (seq === searchSeq) loading.value = false
    }
  }

  /** 输入变化：防抖后查询 */
  function onKeywordChange() {
    activeIndex.value = 0
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      void queryNow()
    }, DEBOUNCE_MS)
  }

  /** 上下移动选中项（到头循环） */
  function move(delta: number) {
    const total = items.value.length
    if (!total) return
    activeIndex.value = (activeIndex.value + delta + total) % total
  }

  /** 执行指定项；执行前后都会隐藏面板 */
  async function runAt(index: number) {
    const item = items.value[index]
    if (!item) return
    await item.run(context)
  }

  /** 执行当前选中项 */
  function runActive() {
    return runAt(activeIndex.value)
  }

  /** 重置为干净状态，窗口每次重新显示时调用 */
  function reset() {
    keyword.value = ''
    activeIndex.value = 0
    void queryNow()
  }

  onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
  })

  return {
    keyword,
    items,
    loading,
    activeIndex,
    scope,
    query,
    queryNow,
    onKeywordChange,
    move,
    runAt,
    runActive,
    reset,
  }
}
