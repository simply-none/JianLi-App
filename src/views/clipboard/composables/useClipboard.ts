// 剪切板组合式逻辑：普通查询 / 分页加载 / 单删 / 批量删 / 清空 / 高级查询(时间范围) / 去重 / 复制。
// 所有数据库操作经 clipboardApi（newSql 后端），UI 组件只消费本模块暴露的状态与方法。
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { clipboardApi } from '../api/clipboardApi'
import type { ClipboardItem } from '../types'

const PAGE_SIZE = 50

export function useClipboard() {
  const items = ref<ClipboardItem[]>([])
  const loading = ref(false)
  const hasMore = ref(true)

  // 普通查询关键词
  const keyword = ref('')
  // 高级查询（删除场景）：时间范围
  const startTime = ref('')
  const endTime = ref('')
  const advancedOpen = ref(false)

  // 批量选择
  const selectedIds = ref<number[]>([])

  function buildParams(offset: number) {
    return {
      keyword: keyword.value || undefined,
      startTime: startTime.value || undefined,
      endTime: endTime.value || undefined,
      limit: PAGE_SIZE,
      offset,
    }
  }

  async function fetch(reset = false) {
    if (reset) {
      items.value = []
      hasMore.value = true
    }
    if (loading.value || !hasMore.value) return
    loading.value = true
    const offset = reset ? 0 : items.value.length
    try {
      const res = await clipboardApi.query(buildParams(offset))
      if (res.success && res.data) {
        const list = res.data as ClipboardItem[]
        if (reset) items.value = list
        else items.value.push(...list)
        hasMore.value = list.length >= PAGE_SIZE
      } else {
        ElMessage.error('查询失败')
      }
    } catch {
      ElMessage.error('查询异常')
    } finally {
      loading.value = false
    }
  }

  // 普通查询
  function search() {
    fetch(true)
  }

  // 重置：清空关键词与高级条件
  function reset() {
    keyword.value = ''
    startTime.value = ''
    endTime.value = ''
    fetch(true)
  }

  function loadMore() {
    fetch(false)
  }

  // 复制
  function copy(text: string) {
    ;(window as any).ipcRenderer.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  }

  // 单条删除
  async function deleteItem(item: ClipboardItem) {
    if (item.id == null) return
    try {
      const res = await clipboardApi.delete(item.id)
      if (res.success) {
        ElMessage.success('删除成功')
        items.value = items.value.filter((i) => i.id !== item.id)
        selectedIds.value = selectedIds.value.filter((id) => id !== item.id)
      } else {
        ElMessage.error('删除失败')
      }
    } catch {
      ElMessage.error('删除失败')
    }
  }

  // 批量删除选中
  async function deleteSelected() {
    if (selectedIds.value.length === 0) return
    const count = selectedIds.value.length
    try {
      const res = await clipboardApi.deleteMany(selectedIds.value)
      if (res.success) {
        ElMessage.success(`已删除 ${count} 项`)
        items.value = items.value.filter((i) => i.id == null || !selectedIds.value.includes(i.id))
        selectedIds.value = []
      } else {
        ElMessage.error('删除失败')
      }
    } catch {
      ElMessage.error('删除失败')
    }
  }

  // 清空全部
  async function clearAll() {
    try {
      await ElMessageBox.confirm('确定要清空所有剪贴板记录吗？此操作不可恢复。', '确认清空', {
        confirmButtonText: '清空',
        cancelButtonText: '取消',
        type: 'warning',
      })
    } catch {
      return
    }
    try {
      const res = await clipboardApi.clear()
      if (res.success) {
        ElMessage.success('已清空剪贴板历史')
        items.value = []
        selectedIds.value = []
        hasMore.value = true
      } else {
        ElMessage.error('清空失败')
      }
    } catch {
      ElMessage.error('清空失败')
    }
  }

  // 高级查询：按当前条件（时间范围 + 关键词）查询
  function advancedSearch() {
    fetch(true)
  }

  // 高级查询：按时间范围删除
  async function deleteByCondition() {
    if (!startTime.value && !endTime.value) {
      ElMessage.warning('请先设置时间范围')
      return
    }
    try {
      await ElMessageBox.confirm('将删除该时间范围内的所有剪贴板记录，此操作不可恢复。', '按条件删除', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      })
    } catch {
      return
    }
    try {
      const res = await clipboardApi.deleteByCondition({ startTime: startTime.value, endTime: endTime.value })
      if (res.success) {
        ElMessage.success('已按条件删除')
        fetch(true)
      } else {
        ElMessage.error('删除失败')
      }
    } catch {
      ElMessage.error('删除失败')
    }
  }

  // 高级查询：去重删除
  async function dedup() {
    try {
      await ElMessageBox.confirm('将删除内容重复的剪贴板记录，每组仅保留一条。', '去重删除', {
        confirmButtonText: '去重',
        cancelButtonText: '取消',
        type: 'warning',
      })
    } catch {
      return
    }
    try {
      const res = await clipboardApi.dedup()
      if (res.success) {
        ElMessage.success('已删除重复项')
        fetch(true)
      } else {
        ElMessage.error('去重失败')
      }
    } catch {
      ElMessage.error('去重失败')
    }
  }

  function toggleSelect(id?: number) {
    if (id == null) return
    const idx = selectedIds.value.indexOf(id)
    if (idx >= 0) selectedIds.value.splice(idx, 1)
    else selectedIds.value.push(id)
  }

  function clearSelection() {
    selectedIds.value = []
  }

  return {
    items,
    loading,
    hasMore,
    keyword,
    startTime,
    endTime,
    advancedOpen,
    selectedIds,
    search,
    reset,
    loadMore,
    copy,
    deleteItem,
    deleteSelected,
    clearAll,
    advancedSearch,
    deleteByCondition,
    dedup,
    toggleSelect,
    clearSelection,
  }
}
