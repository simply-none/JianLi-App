<template>
  <!-- 【高级查询】折叠面板（删除场景）：时间范围筛选 + 按条件删除 + 去重删除 -->
  <div v-show="open" class="clipboard-advanced">
    <div class="advanced-fields">
      <div class="field">
        <span class="field-label">起始时间</span>
        <el-date-picker
          v-model="start"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          placeholder="开始时间"
          :clearable="true"
        />
      </div>
      <div class="field">
        <span class="field-label">结束时间</span>
        <el-date-picker
          v-model="end"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          placeholder="结束时间"
          :clearable="true"
        />
      </div>
    </div>

    <div class="advanced-actions">
      <el-button @click="$emit('query')">
        <LucideIcon name="Search" :size="14" />
        查询
      </el-button>
      <el-button type="danger" @click="$emit('delete-by-condition')">
        <LucideIcon name="Trash2" :size="14" />
        按时间范围删除
      </el-button>
      <el-button type="warning" @click="$emit('dedup')">
        <LucideIcon name="Copy" :size="14" />
        删除重复项
      </el-button>
      <el-button text @click="$emit('close')">收起</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'

const props = defineProps<{
  open: boolean
  startTime: string
  endTime: string
}>()

const emit = defineEmits<{
  (e: 'update:startTime', v: string): void
  (e: 'update:endTime', v: string): void
  (e: 'query'): void
  (e: 'delete-by-condition'): void
  (e: 'dedup'): void
  (e: 'close'): void
}>()

// 本地绑定（el-date-picker 需要可写引用），变更回传父级
const start = computed({
  get: () => props.startTime || '' as string,
  set: (v: string) => emit('update:startTime', v || ''),
})
const end = computed({
  get: () => props.endTime || '' as string,
  set: (v: string) => emit('update:endTime', v || ''),
})
</script>

<style scoped lang="scss">
.clipboard-advanced {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;

  .advanced-fields {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .field-label {
        font-size: 12px;
        color: var(--text-muted);
      }
    }
  }

  .advanced-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;

    .el-button + .el-button {
      margin-left: 0 !important;
    }
  }
}
</style>
