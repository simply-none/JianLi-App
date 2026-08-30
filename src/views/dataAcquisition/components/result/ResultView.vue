<template>
  <div class="result-view">
    <div class="result-header">
      <el-radio-group v-model="viewMode" size="small">
        <el-radio-button value="table">表格</el-radio-button>
        <el-radio-button value="json">JSON</el-radio-button>
      </el-radio-group>
      <span v-if="records.length" class="result-count">共 {{ records.length }} 条</span>
      <el-button size="small" :disabled="!records.length" @click="onExport">导出 CSV</el-button>
    </div>

    <div v-if="!records.length" class="result-empty">暂无数据（先试运行采集）</div>

    <template v-else>
      <el-table
        v-if="viewMode === 'table'"
        :data="pagedRecords"
        size="small"
        border
        stripe
        class="result-table"
        :max-height="tableMaxHeight"
      >
        <el-table-column type="index" label="#" width="52" fixed />
        <el-table-column
          v-for="col in columns"
          :key="col"
          :prop="col"
          :label="col"
          :min-width="140"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ formatCell(row[col]) }}
          </template>
        </el-table-column>
      </el-table>
      <el-input
        v-else
        :model-value="jsonText"
        type="textarea"
        :rows="20"
        readonly
        class="result-json"
        spellcheck="false"
      />
      <el-pagination
        v-if="viewMode === 'table' && records.length > pageSize"
        v-model:current-page="page"
        :page-size="pageSize"
        :total="records.length"
        layout="prev, pager, next, total"
        size="small"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 采集结果视图
 * ------------------------------------------------------------------
 * 动态列表格（列取自记录键并集）与 JSON 双视图，分页展示，
 * 支持 CSV 导出（带 BOM）。
 */
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { exportRecords } from '../../composables/useHistory'

/** 组件属性 */
const props = defineProps<{
  /** 采集记录数组 */
  records: any[];
  /** 导出文件名基础 */
  exportName?: string;
}>()

/** 视图模式 */
const viewMode = ref<'table' | 'json'>('table')
/** 表格当前页 */
const page = ref(1)
/** 每页条数 */
const pageSize = 50
/** 表格最大高度（px，自适应视口） */
const tableMaxHeight = Math.max(240, Math.floor(window.innerHeight * 0.5))

/** 记录的列集合（首条记录键 + 其余记录新增键的并集） */
const columns = computed(() => {
  const set = new Set<string>()
  for (const row of props.records.slice(0, 200)) {
    Object.keys(row || {}).forEach((k) => set.add(k))
  }
  return Array.from(set)
})

/** 当前页记录切片 */
const pagedRecords = computed(() => {
  const start = (page.value - 1) * pageSize
  return props.records.slice(start, start + pageSize)
})

/** 记录 JSON 文本（超长截断防卡顿） */
const jsonText = computed(() => {
  try {
    const text = JSON.stringify(props.records, null, 2)
    return text.length > 200000 ? text.slice(0, 200000) + '\n...（超长截断）' : text
  } catch {
    return ''
  }
})

/**
 * 单元格值格式化（数组分号连接，对象 JSON 化，其余 String 化）
 * @param value 单元格原始值
 * @returns 展示文本
 */
function formatCell(value: any): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join('; ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * 导出当前结果为 CSV
 */
async function onExport(): Promise<void> {
  const saved = await exportRecords(props.records, props.exportName || '采集结果')
  if (saved) {
    ElMessage.success(`已导出：${saved}`)
  }
}
</script>

<style scoped>
.result-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.result-count {
  flex: 1;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.result-empty {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 20px 0;
  text-align: center;
}
.result-table {
  width: 100%;
}
.result-json {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}
</style>
