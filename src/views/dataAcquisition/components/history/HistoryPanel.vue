<template>
  <div class="history-panel">
    <div class="history-header">
      <el-input
        v-model="keyword"
        size="small"
        placeholder="按任务名搜索"
        clearable
        class="history-search"
        @input="emit('search', keyword)"
      />
      <el-button size="small" @click="emit('refresh')">刷新</el-button>
      <el-button size="small" type="danger" plain :disabled="!history.length" @click="onClear">
        清空
      </el-button>
    </div>

    <div v-if="!history.length" class="history-empty">暂无采集历史</div>

    <el-table v-else :data="history" size="small" border stripe :max-height="tableMaxHeight">
      <el-table-column label="任务" prop="taskName" min-width="150" show-overflow-tooltip />
      <el-table-column label="状态" width="84">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="条数" prop="itemCount" width="70" align="right" />
      <el-table-column label="耗时" width="86">
        <template #default="{ row }">{{ formatElapsed(row.elapsed) }}</template>
      </el-table-column>
      <el-table-column label="时间" width="150">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="失败原因" prop="error" min-width="140" show-overflow-tooltip />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" text type="primary" :disabled="!row.data?.length" @click="emit('view', row)">
            查看
          </el-button>
          <el-button size="small" text type="primary" @click="emit('rerun', row)">重跑</el-button>
          <el-button size="small" text type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 历史结果查看弹窗 -->
    <el-dialog v-model="viewVisible" :title="`结果：${viewItem?.taskName || ''}`" width="860px" destroy-on-close>
      <ResultView :records="viewItem?.data || []" :export-name="viewItem?.taskName" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 采集历史面板
 * ------------------------------------------------------------------
 * 历史列表（状态/条数/耗时/时间/失败原因），
 * 支持查看结果弹窗、按配置重跑、单条删除与清空。
 * 数据由父组件传入与刷新。
 */
import { ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { HistoryItem } from '../../types'
import ResultView from '../result/ResultView.vue'

/** 组件属性 */
const props = defineProps<{
  /** 历史列表 */
  history: HistoryItem[];
}>()

/** 组件事件 */
const emit = defineEmits<{
  /** 关键字变化触发搜索（携带当前关键字） */
  (e: 'search', keyword: string): void;
  /** 请求刷新列表 */
  (e: 'refresh'): void;
  /** 查看某条历史结果 */
  (e: 'view', item: HistoryItem): void;
  /** 按历史配置重跑 */
  (e: 'rerun', item: HistoryItem): void;
  /** 请求删除某条历史 */
  (e: 'delete', id: number): void;
  /** 请求清空全部历史 */
  (e: 'clear'): void;
}>()

/** 结果查看弹窗可见性 */
const viewVisible = ref(false)
/** 搜索关键字（按任务名过滤） */
const keyword = ref('')
/** 当前查看的历史项 */
const viewItem = ref<HistoryItem | null>(null)

/** 表格最大高度（px，自适应视口） */
const tableMaxHeight = Math.max(240, Math.floor(window.innerHeight * 0.55))

// 查看事件同样打开弹窗（父组件也可监听，这里内置弹窗直接展示）
defineExpose({
  /** 打开结果查看弹窗（供父组件转发 view 事件） */
  openView(item: HistoryItem) {
    viewItem.value = item
    viewVisible.value = true
  },
});

/**
 * 状态标签类型映射
 * @param status 状态字符串
 * @returns 标签类型
 */
function statusType(status: string): 'success' | 'warning' | 'danger' {
  if (status === 'success') return 'success'
  if (status === 'stopped') return 'warning'
  return 'danger'
}

/**
 * 状态文案映射
 * @param status 状态字符串
 * @returns 中文文案
 */
function statusText(status: string): string {
  if (status === 'success') return '成功'
  if (status === 'stopped') return '停止'
  return '失败'
}

/**
 * 耗时格式化
 * @param ms 毫秒
 * @returns 展示文本
 */
function formatElapsed(ms: number): string {
  if (!ms) return '-'
  return ms > 60000 ? `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s` : `${(ms / 1000).toFixed(1)}s`
}

/**
 * 时间格式化（本地时间）
 * @param ts 毫秒时间戳
 * @returns 展示文本
 */
function formatTime(ts: number): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

/**
 * 删除单条历史（二次确认）
 * @param row 历史行
 */
async function onDelete(row: HistoryItem): Promise<void> {
  await ElMessageBox.confirm('确定删除该条历史？', '删除确认', { type: 'warning' })
  emit('delete', row.id)
}

/**
 * 清空全部历史（二次确认）
 */
async function onClear(): Promise<void> {
  await ElMessageBox.confirm('确定清空全部采集历史？此操作不可恢复。', '清空确认', { type: 'warning' })
  emit('clear')
}
</script>

<style scoped>
.history-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.history-header {
  display: flex;
  gap: 8px;
}
.history-search {
  width: 220px;
}
.history-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 20px 0;
  text-align: center;
}
</style>
