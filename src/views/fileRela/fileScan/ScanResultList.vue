// 原子组件：扫描结果列表（统计卡 + 分页勾选表 + 查看 + 复制到文件夹）
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ScanResult } from './types';

const props = defineProps<{ files: ScanResult[] }>();
const emit = defineEmits<{
  preview: [ScanResult];
  copy: [ScanResult[]];
}>();

const page = ref(1);
const pageSize = ref(100);
const selectedSet = ref<Set<string>>(new Set());

// 新扫描结果到达：默认全选
watch(
  () => props.files,
  (list) => {
    selectedSet.value = new Set(list.map((f) => f.path));
    page.value = 1;
  },
  { immediate: true }
);

const totalSize = computed(() => props.files.reduce((s, f) => s + (f.size || 0), 0));
const selectedCount = computed(() => props.files.filter((f) => selectedSet.value.has(f.path)).length);

const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return props.files.slice(start, start + pageSize.value);
});

function isSelected(p: string) {
  return selectedSet.value.has(p);
}
function toggle(p: string, v: boolean) {
  const s = new Set(selectedSet.value);
  if (v) s.add(p);
  else s.delete(p);
  selectedSet.value = s;
}
function selectAll() {
  selectedSet.value = new Set(props.files.map((f) => f.path));
}
function selectNone() {
  selectedSet.value = new Set();
}

function getSelectedFiles(): ScanResult[] {
  return props.files.filter((f) => selectedSet.value.has(f.path));
}

function formatSize(n: number): string {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return (i === 0 ? v : v.toFixed(1)) + ' ' + units[i];
}

function onCopy() {
  const sel = getSelectedFiles();
  if (!sel.length) return;
  emit('copy', sel);
}

defineExpose({ getSelectedFiles });
</script>

<template>
  <div class="scan-result" v-if="files.length">
    <div class="result-head">
      <span class="stat">
        匹配 <b>{{ files.length }}</b> 项 · 约 <b>{{ formatSize(totalSize) }}</b>
        <template v-if="selectedCount !== files.length">
          ，将复制 <b class="copy-text">{{ selectedCount }}</b> 项
        </template>
      </span>
      <span class="tools">
        <el-button link size="small" type="primary" @click="selectAll">全选</el-button>
        <el-button link size="small" @click="selectNone">全不选</el-button>
        <el-button size="small" type="primary" :disabled="!selectedCount" @click="onCopy">
          复制到文件夹
        </el-button>
      </span>
    </div>

    <el-table :data="pageRows" class="result-table" max-height="360" size="small">
      <el-table-column width="48" align="center">
        <template #default="{ row }">
          <el-checkbox :model-value="isSelected(row.path)" @change="(v: any) => toggle(row.path, !!v)" />
        </template>
      </el-table-column>
      <el-table-column prop="name" label="文件名" min-width="160" show-overflow-tooltip />
      <el-table-column label="大小" width="100">
        <template #default="{ row }">{{ formatSize(row.size) }}</template>
      </el-table-column>
      <el-table-column prop="path" label="路径" min-width="220" show-overflow-tooltip />
      <el-table-column label="操作" width="80" align="center">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="emit('preview', row)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager" v-if="files.length > pageSize">
      <el-pagination
        layout="prev, pager, next"
        :total="files.length"
        :page-size="pageSize"
        :current-page="page"
        @current-change="(p: number) => { page = p; }"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.scan-result {
  border: 0.5px solid var(--border-tertiary, #e5e6eb);
  border-radius: 8px;
  padding: 12px;
}
.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
  gap: 12px;
  flex-wrap: wrap;
}
.copy-text {
  color: var(--el-color-primary, #409eff);
}
.tools {
  display: flex;
  gap: 4px;
  align-items: center;
}
.result-table {
  width: 100%;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
</style>
