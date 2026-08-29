<template>
  <el-table :data="headerRows" size="small" class="headers-table" max-height="100%">
    <el-table-column prop="key" label="名称" width="260" />
    <el-table-column prop="value" label="值" show-overflow-tooltip />
  </el-table>
</template>

<script setup lang="ts">
/**
 * 响应头表格：键值两列展示（名称过长时省略，悬停查看完整值）
 */
import { computed } from 'vue'

/** 组件 props 定义 */
const props = defineProps<{
  /** 响应头键值对象 */
  headers: Record<string, string>;
}>()

/** 表格行数据（对象 → 数组） */
const headerRows = computed(() =>
  Object.entries(props.headers || {}).map(([key, value]) => ({ key, value }))
)
</script>

<style scoped lang="scss">
.headers-table {
  width: 100%;
}
</style>
