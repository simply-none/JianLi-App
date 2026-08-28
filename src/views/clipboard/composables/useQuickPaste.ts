// 快速粘贴面板的组合式逻辑：搜索（防抖） / 键盘导航 / 写入剪贴板并自动粘贴。
// 与页面列表解耦，任何入口（小窗、命令面板）都可复用。
import { ref } from 'vue'
import { clipboardApi } from '../api/clipboardApi'
import type { ClipboardItem } from '../types'

// 面板只取最近若干条，不做分页滚动
const QUICK_LIMIT = 30
// 输入防抖间隔
const INPUT_DEBOUNCE = 200

export function useQuickPaste() {
  const keyword = ref('')
  const items = ref<ClipboardItem[]>([])
  const loading = ref(false)
  // 当前键盘高亮项
  const activeIndex = ref(0)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  async function query() {
    loading.value = true
    try {
      const res = await clipboardApi.query({
        keyword: keyword.value || undefined,
        limit: QUICK_LIMIT,
        offset: 0,
      })
      items.value = res.success ? ((res.data as ClipboardItem[]) ?? []) : []
      activeIndex.value = 0
    } catch {
      items.value = []
    } finally {
      loading.value = false
    }
  }

  // 关键词输入：防抖后重查，避免每敲一个字都打一次库
  function onKeywordInput() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(query, INPUT_DEBOUNCE)
  }

  // 上下移动高亮项
  function move(delta: number) {
    if (!items.value.length) return
    const next = activeIndex.value + delta
    activeIndex.value = Math.max(0, Math.min(items.value.length - 1, next))
  }

  /**
   * 粘贴当前高亮项：写入系统剪贴板 → 关闭面板 → 尝试模拟 Ctrl+V。
   * 自动粘贴失败不影响结果，内容已在剪贴板，用户手动粘贴即可。
   */
  async function pasteActive(opts: { hide: () => void; autoPaste?: boolean }) {
    const item = items.value[activeIndex.value]
    if (!item || item.id == null) return
    const res = await clipboardApi.write(item.id, 'raw')
    if (!res.success) return
    opts.hide()
    if (opts.autoPaste) void clipboardApi.simulatePaste()
  }

  return {
    keyword,
    items,
    loading,
    activeIndex,
    query,
    onKeywordInput,
    move,
    pasteActive,
  }
}
