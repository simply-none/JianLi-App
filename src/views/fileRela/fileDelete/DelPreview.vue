// 原子组件：删除预览（统计卡 + 分页预览表 + 跨页选中）
// 仅渲染当前页 DOM，元数据中不含文件内容；删除时再按需拉全量计算计划。
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { sendSync } from '@/utils/common';
import type { ListFolderItem } from '../rename/engine';
import type { DeleteFilter, ListFolderResult } from './types';

const props = defineProps<{
  folder: string;
  filter: DeleteFilter;
}>();

const page = ref(1);
const pageSize = ref(100);
const pageRows = ref<ListFolderItem[]>([]);
const total = ref(0);
const totalSize = ref(0);
const loading = ref(false);
const excludedSet = ref<Set<string>>(new Set()); // 显式取消勾选的路径（默认全选）

// 过滤参数（与 list-folder / copy-folder 完全一致）
function listArgs(p: number, size: number) {
  const f = props.filter;
  return {
    dir: props.folder,
    recursive: f.recursive,
    includeDirs: false,
    include: f.nameInclude,
    ignore: f.nameExclude,
    includeSuffix: f.suffixInclude,
    ignoreSuffix: f.suffixExclude,
    includeFolder: f.folderInclude,
    ignoreFolder: f.folderExclude,
    page: p,
    pageSize: size,
  };
}

function loadPage() {
  if (!props.folder) {
    pageRows.value = [];
    total.value = 0;
    totalSize.value = 0;
    return;
  }
  loading.value = true;
  try {
    const res = sendSync('list-folder', listArgs(page.value, pageSize.value)) as ListFolderResult;
    let items = res?.items || [];
    let t = res?.total || 0;
    // 页码越界修正（改条件后总数变少）：收敛到末页重拉
    const maxPage = Math.max(1, Math.ceil(t / pageSize.value));
    if (page.value > maxPage) {
      page.value = maxPage;
      const r2 = sendSync('list-folder', listArgs(page.value, pageSize.value)) as ListFolderResult;
      items = r2?.items || [];
      t = r2?.total || 0;
    }
    pageRows.value = items;
    total.value = t;
    totalSize.value = res?.totalSize || 0;
  } catch (e) {
    console.error('list-folder 失败:', e);
    pageRows.value = [];
    total.value = 0;
    totalSize.value = 0;
  } finally {
    loading.value = false;
  }
}

const selectedCount = computed(
  () => pageRows.value.filter((f) => !excludedSet.value.has(f.path)).length
);

function isExcluded(path: string) {
  return excludedSet.value.has(path);
}
function toggleRow(path: string, val: boolean) {
  const s = new Set(excludedSet.value);
  if (val) s.delete(path);
  else s.add(path);
  excludedSet.value = s;
}
// 全选：清空排除集（所有匹配项将删除）
function selectAll() {
  excludedSet.value = new Set();
}
// 全不选：拉全量，把每一项都加入排除集
function selectNone() {
  if (!props.folder) return;
  const res = sendSync('list-folder', listArgs(1, 0)) as ListFolderResult;
  excludedSet.value = new Set((res?.items || []).map((f) => f.path));
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

// 条件/文件夹变化：回第 1 页、清空排除、重拉
const filterKey = computed(() => {
  const f = props.filter;
  return JSON.stringify([
    f.recursive,
    f.nameInclude,
    f.nameExclude,
    f.suffixInclude,
    f.suffixExclude,
    f.folderInclude,
    f.folderExclude,
  ]);
});
watch(
  () => [props.folder, filterKey.value],
  () => {
    page.value = 1;
    excludedSet.value = new Set();
    loadPage();
  }
);

function rowClass({ row }: { row: ListFolderItem }) {
  return row && isExcluded(row.path) ? 'row-excluded' : '';
}

// 暴露给父组件：计算删除计划（显式路径 + 选中数 + 总大小）
function getDeletePlan(): { paths: string[]; count: number; size: number } {
  if (!props.folder) return { paths: [], count: 0, size: 0 };
  const res = sendSync('list-folder', listArgs(1, 0)) as ListFolderResult;
  const items = res?.items || [];
  const sel = items.filter((f) => !excludedSet.value.has(f.path));
  return {
    paths: sel.map((f) => f.path),
    count: sel.length,
    size: sel.reduce((s, f) => s + (f.size || 0), 0),
  };
}

function refresh() {
  excludedSet.value = new Set();
  loadPage();
}

defineExpose({ getDeletePlan, refresh });
</script>

<template>
  <div class="del-preview">
    <div class="preview-head">
      <span>
        匹配
        <b class="sel-text">{{ total }}</b>
        项 ·
        约 <b class="sel-text">{{ formatSize(totalSize) }}</b>
        <template v-if="selectedCount !== total">
          ，将删除 <b class="del-text">{{ selectedCount }}</b> 项
        </template>
      </span>
      <span class="preview-tools">
        <el-button link size="small" type="primary" @click="selectAll">全选</el-button>
        <el-button link size="small" @click="selectNone">全不选</el-button>
      </span>
    </div>

    <el-table
      :data="pageRows"
      class="preview-table"
      max-height="320"
      size="small"
      :row-class-name="rowClass"
      v-loading="loading"
    >
      <el-table-column width="48" align="center">
        <template #default="{ row }">
          <el-checkbox
            :model-value="!isExcluded(row.path)"
            @change="(v: any) => toggleRow(row.path, !!v)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="name" label="文件名" min-width="160" show-overflow-tooltip />
      <el-table-column label="大小" width="100">
        <template #default="{ row }">{{ formatSize(row.size) }}</template>
      </el-table-column>
      <el-table-column prop="path" label="路径" min-width="200" show-overflow-tooltip />
    </el-table>

    <div class="pager" v-if="total > pageSize">
      <el-pagination
        layout="prev, pager, next"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="(p: number) => { page = p; loadPage(); }"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.del-preview {
  border: 0.5px solid var(--border-tertiary, #e5e6eb);
  border-radius: 8px;
  padding: 12px;
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.sel-text {
  color: var(--text-primary);
}

.del-text {
  color: var(--el-color-danger, #f56c6c);
}

.preview-tools {
  display: flex;
  gap: 4px;
}

.preview-table {
  width: 100%;
}

.row-excluded {
  opacity: 0.45;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
</style>
