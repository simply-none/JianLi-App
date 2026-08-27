<template>
  <div class="file-card">
    <div class="card-header copy-header">
      <h3 class="card-title">
        <el-icon><LucideIcon name="Files" /></el-icon>
        文件转移
      </h3>
      <el-checkbox v-model="showProgress" class="progress-toggle">进度检测</el-checkbox>
    </div>
    <div class="card-body">
      <div class="copy-section">
        <!-- 模式：移动 / 复制 -->
        <div class="mode-row">
          <span
            class="mode-tab"
            :class="{ active: op === 'move' }"
            @click="op = 'move'"
          >移动</span>
          <span
            class="mode-tab"
            :class="{ active: op === 'copy' }"
            @click="op = 'copy'"
          >复制</span>
          <span class="mode-hint">{{ op === 'move' ? '转移后删除源' : '保留源文件' }}</span>
        </div>

        <!-- 原位置 / 目标位置 双栏 + 互换 -->
        <div class="path-row">
          <div class="path-item">
            <div class="path-head">
              <span class="path-label">原位置</span>
              <span class="cache-fill-link" @click="fillCacheOrigin">填入缓存位置</span>
            </div>
            <el-input v-model="copyOrigin" placeholder="请选择原文件夹" disabled :title="copyOrigin">
              <template #append>
                <el-button @click="selectCopyPath" class="path-btn">
                  <el-icon><LucideIcon name="Folder" /></el-icon>
                  选择目录
                </el-button>
              </template>
            </el-input>
          </div>
          <div class="arrow-wrap">
            <el-icon class="arrow-icon" @click="swapPath"><LucideIcon name="ArrowRight" /></el-icon>
          </div>
          <div class="path-item">
            <div class="path-head">
              <span class="path-label">目标位置</span>
              <span class="cache-fill-link" @click="fillCacheTarget">填入缓存位置</span>
            </div>
            <el-input v-model="copyTarget" placeholder="请选择目标文件夹" disabled :title="copyTarget">
              <template #append>
                <el-button @click="selectCopyTarget" class="path-btn">
                  <el-icon><LucideIcon name="Folder" /></el-icon>
                  选择目录
                </el-button>
              </template>
            </el-input>
          </div>
        </div>

        <!-- 筛选面板（名称 + 类型，含/不含标签共存） -->
        <div class="filter-section">
          <div class="filter-row">
            <span class="filter-label">名称</span>
            <el-radio-group v-model="nameMode" class="radio-group">
              <el-radio value="include">含</el-radio>
              <el-radio value="exclude">不含</el-radio>
            </el-radio-group>
            <el-input v-model="nameKeyword" placeholder="输入名称关键词，回车添加" class="filter-input" @keyup.enter="addNameTag">
              <template #append><el-button @click="addNameTag">添加</el-button></template>
            </el-input>
          </div>
          <div class="tag-list">
            <div class="tag-line" v-if="nameIncludeList.length">
              <span class="tag-prefix include-prefix">名称包含：</span>
              <el-tag v-for="(t, i) in nameIncludeList" :key="'ni'+i" type="success" closable @close="removeNameTag('include', i)">{{ t }}</el-tag>
            </div>
            <div class="tag-line" v-if="nameExcludeList.length">
              <span class="tag-prefix exclude-prefix">名称不包含：</span>
              <el-tag v-for="(t, i) in nameExcludeList" :key="'ne'+i" type="danger" closable @close="removeNameTag('exclude', i)">{{ t }}</el-tag>
            </div>
          </div>
          <div class="filter-row">
            <span class="filter-label">类型</span>
            <el-radio-group v-model="suffixMode" class="radio-group">
              <el-radio value="include">含</el-radio>
              <el-radio value="exclude">不含</el-radio>
            </el-radio-group>
            <el-input v-model="suffixKeyword" placeholder="如 .jpg、.png，回车添加" class="filter-input" @keyup.enter="addSuffixTag">
              <template #append><el-button @click="addSuffixTag">添加</el-button></template>
            </el-input>
          </div>
          <div class="tag-list">
            <div class="tag-line" v-if="suffixIncludeList.length">
              <span class="tag-prefix include-prefix">类型包含：</span>
              <el-tag v-for="(t, i) in suffixIncludeList" :key="'si'+i" type="success" closable @close="removeSuffixTag('include', i)">{{ t }}</el-tag>
            </div>
            <div class="tag-line" v-if="suffixExcludeList.length">
              <span class="tag-prefix exclude-prefix">类型不包含：</span>
              <el-tag v-for="(t, i) in suffixExcludeList" :key="'se'+i" type="danger" closable @close="removeSuffixTag('exclude', i)">{{ t }}</el-tag>
            </div>
          </div>
          <div class="filter-row">
            <span class="filter-label">文件夹</span>
            <el-radio-group v-model="folderMode" class="radio-group">
              <el-radio value="include">含</el-radio>
              <el-radio value="exclude">不含</el-radio>
            </el-radio-group>
            <el-input v-model="folderKeyword" placeholder="如 temp、备份，回车添加" class="filter-input" @keyup.enter="addFolderTag">
              <template #append><el-button @click="addFolderTag">添加</el-button></template>
            </el-input>
          </div>
          <div class="tag-list">
            <div class="tag-line" v-if="folderIncludeList.length">
              <span class="tag-prefix include-prefix">文件夹包含：</span>
              <el-tag v-for="(t, i) in folderIncludeList" :key="'fi'+i" type="success" closable @close="removeFolderTag('include', i)">{{ t }}</el-tag>
            </div>
            <div class="tag-line" v-if="folderExcludeList.length">
              <span class="tag-prefix exclude-prefix">文件夹不包含：</span>
              <el-tag v-for="(t, i) in folderExcludeList" :key="'fe'+i" type="danger" closable @close="removeFolderTag('exclude', i)">{{ t }}</el-tag>
            </div>
          </div>
          <div class="opt-row">
            <el-checkbox v-model="recursive">包含子目录（保留结构）</el-checkbox>
            <span class="filter-label" style="width:auto;">重名时</span>
            <el-select v-model="strategy" class="strategy-select" size="small">
              <el-option label="自动加序号" value="rename" />
              <el-option label="跳过" value="skip" />
              <el-option label="覆盖" value="overwrite" />
            </el-select>
          </div>
        </div>

        <!-- 转移后重命名（复用批量重命名规则引擎） -->
        <div class="rename-block">
          <div class="rule-title">
            <el-switch v-model="renameEnabled" size="small" />
            <span>转移后重命名</span>
          </div>
          <RenameRulesPanel v-model="rules" v-if="renameEnabled" />
        </div>

        <!-- 实时预览 -->
        <div class="preview-block" v-if="copyOrigin">
          <div class="preview-head">
            <span>
              预览（共 <b>{{ totalFiltered }}</b> 项匹配，
              <b class="sel-text">将转移 {{ transferCount }}</b> 项）
            </span>
            <span class="preview-tools">
              <el-checkbox :model-value="allSelected" :indeterminate="someSelected" @change="onHeaderCheck">全选所有匹配项</el-checkbox>
            </span>
          </div>
          <el-table :data="previewList" class="preview-table" max-height="300" size="small" :row-class-name="rowClassName">
            <el-table-column width="46" align="center" class-name="col-check">
              <template #header><el-checkbox :model-value="allSelected" @change="onHeaderCheck" /></template>
              <template #default="{ row }">
                <el-checkbox v-if="!row.excluded" :model-value="row.selected" @change="(v: any) => onRowCheck(row.oldPath, v)" />
              </template>
            </el-table-column>
            <el-table-column label="原文件名" min-width="180">
              <template #default="{ row }"><span class="cell-name" :title="row.oldPath">{{ row.oldName }}</span></template>
            </el-table-column>
            <el-table-column label="大小" width="80">
              <template #default="{ row }">{{ row.sizeLabel }}</template>
            </el-table-column>
            <el-table-column label="目标文件名" min-width="180">
              <template #default="{ row }">
                <span class="cell-name" :class="{ willRename: row.selected && !row.excluded && row.renamed, unchanged: !row.renamed }">{{ row.newName }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.excluded" type="info" size="small" effect="plain">已排除</el-tag>
                <el-tag v-else-if="!row.selected" type="info" size="small" effect="plain">未选中</el-tag>
                <el-tag v-else-if="row.renamed" type="success" size="small">将重命名</el-tag>
                <el-tag v-else type="success" size="small">将转移</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <div class="preview-pager" v-if="totalFiltered > pageSize">
            <el-pagination
              layout="total, sizes, prev, pager, next, jumper"
              :total="totalFiltered"
              :page-size="pageSize"
              :current-page="currentPage"
              :page-sizes="[50, 100, 200, 500]"
              @current-change="(p: number) => { currentPage = p; refreshPage(); }"
              @size-change="(s: number) => { pageSize = s; currentPage = 1; refreshPage(); }"
              small
              background
            />
          </div>
        </div>

        <div class="open-target-hint">
          目标目录：
          <span class="open-target-link" :title="effectiveTarget || '目标目录地址'" @click="openTargetDir">{{ effectiveTarget || '目标目录地址' }}</span>
        </div>
        <div class="copy-btn-wrap">
          <el-checkbox v-model="openAfter" class="open-after">完成后打开目标</el-checkbox>
          <el-button type="primary" @click="onStart" class="copy-btn" :disabled="!canStart">
            <el-icon><LucideIcon name="Files" /></el-icon>
            开始转移（{{ transferCount }}）
          </el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="progressVisible" :title="phase === 'rename' ? '转移后重命名进度' : '文件转移进度'" width="440px" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false" append-to-body>
      <div class="progress-body">
        <el-progress :percentage="progressPercent" :stroke-width="14" />
        <div class="progress-meta">已处理 {{ progressCurrent }} / {{ progressTotal }} 项</div>
        <div class="progress-current" :title="progressCurrentPath">{{ progressCurrentPath || '准备中…' }}</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { send, sendSync } from '@/utils/common';
import { ElMessage } from 'element-plus';
import { storeToRefs } from 'pinia';
import useCacheSetStore from '@/store/useCacheSet';
import RenameRulesPanel from './rename/RenameRulesPanel.vue';
import { computeNewName, createDefaultRules, type RenameRules, type ListFolderItem } from './rename/engine';

// 操作模式：移动（默认，转移后删源）/ 复制（保留源）
const op = ref<'copy' | 'move'>('move');

// 源 / 目标
const copyOrigin = ref('');
const copyTarget = ref('');
function selectCopyPath() {
  const res = sendSync('get-file-list', 'select-dir');
  if (res && res.length) {
    copyOrigin.value = res[0];
    refreshList();
  }
}
function selectCopyTarget() {
  const res = sendSync('get-file-list', 'select-dir');
  if (res && res.length) copyTarget.value = res[0];
}
function swapPath() {
  const t = copyOrigin.value;
  copyOrigin.value = copyTarget.value;
  copyTarget.value = t;
  refreshList();
}

// 缓存位置回填
const { fileCachePathC } = storeToRefs(useCacheSetStore());
function fillCacheOrigin() {
  if (!fileCachePathC.value) return ElMessage.warning('请先在设置中配置缓存位置');
  copyOrigin.value = fileCachePathC.value;
  refreshList();
}
function fillCacheTarget() {
  if (!fileCachePathC.value) return ElMessage.warning('请先在设置中配置缓存位置');
  copyTarget.value = fileCachePathC.value;
}

// 筛选：名称（含/不含）+ 类型（含/不含），标签共存
const nameMode = ref<'include' | 'exclude'>('include');
const nameKeyword = ref('');
const nameIncludeList = ref<string[]>([]);
const nameExcludeList = ref<string[]>([]);
function addNameTag() {
  const v = nameKeyword.value.trim();
  if (!v) return;
  (nameMode.value === 'include' ? nameIncludeList : nameExcludeList).value.push(v);
  nameKeyword.value = '';
}
function removeNameTag(kind: 'include' | 'exclude', i: number) {
  (kind === 'include' ? nameIncludeList : nameExcludeList).value.splice(i, 1);
}

const suffixMode = ref<'include' | 'exclude'>('include');
const suffixKeyword = ref('');
const suffixIncludeList = ref<string[]>([]);
const suffixExcludeList = ref<string[]>([]);
function normSuffix(s: string): string {
  const t = s.trim().toLowerCase().replace(/^\./, '');
  return t ? '.' + t : '';
}
function addSuffixTag() {
  const v = normSuffix(suffixKeyword.value);
  if (!v) return;
  (suffixMode.value === 'include' ? suffixIncludeList : suffixExcludeList).value.push(v);
  suffixKeyword.value = '';
}
function removeSuffixTag(kind: 'include' | 'exclude', i: number) {
  (kind === 'include' ? suffixIncludeList : suffixExcludeList).value.splice(i, 1);
}

// 文件夹（子目录）筛选：名称（含/不含），作用于整棵子树
const folderMode = ref<'include' | 'exclude'>('exclude');
const folderKeyword = ref('');
const folderIncludeList = ref<string[]>([]);
const folderExcludeList = ref<string[]>([]);
function addFolderTag() {
  const v = folderKeyword.value.trim();
  if (!v) return;
  (folderMode.value === 'include' ? folderIncludeList : folderExcludeList).value.push(v);
  folderKeyword.value = '';
}
function removeFolderTag(kind: 'include' | 'exclude', i: number) {
  (kind === 'include' ? folderIncludeList : folderExcludeList).value.splice(i, 1);
}

const recursive = ref(true);                 // 包含子目录（保留结构）
const strategy = ref<'overwrite' | 'skip' | 'rename'>('rename'); // 重名策略，默认自动加序号

// 转移后重命名：复用规则引擎
const renameEnabled = ref(false);
const rules = reactive(createDefaultRules()) as RenameRules;

// 路径工具（渲染进程无 node）
function pathSep(p: string): string {
  return p.includes('\\') ? '\\' : '/';
}
function basename(p: string): string {
  return p.split(/[\\/]/).pop() || p;
}
// 源文件相对源根的子目录（用于拼接到目标，保留完整层级，匹配后端拷贝落点）
function relDirOf(abs: string, src: string): string {
  const r = abs.slice(src.length).replace(/^[\\/]/, ''); // 相对路径（含文件名）
  const k = Math.max(r.lastIndexOf('/'), r.lastIndexOf('\\'));
  return k >= 0 ? r.slice(0, k) : '';
}
function formatSize(n: number): string {
  if (!n) return '0';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return (i === 0 ? v : v.toFixed(1)) + u[i];
}

// 实际目标目录：目标位置 + 源末级名（与后端拷贝落点一致）
const effectiveTarget = computed(() => {
  if (!copyTarget.value || !copyOrigin.value) return '';
  return copyTarget.value.replace(/[\\/]$/, '') + pathSep(copyTarget.value) + basename(copyOrigin.value);
});

// ===== 预览：后端按页返回（list-folder 已支持过滤+分页），前端只持当前页，省内存 =====
const currentPage = ref(1);
const pageSize = ref(100);
const pageRows = ref<ListFolderItem[]>([]);   // 仅当前页文件
const totalFiltered = ref(0);                  // 过滤后总条数（驱动分页器）
const selectAllMatched = ref(true);            // 默认「全选所有匹配项」；手动改单行后置 false
const selectedMap = ref<Map<string, boolean>>(new Map()); // 跨页选中态（按路径记忆）

// 统一的 list-folder 参数（过滤条件与 copy-folder 完全一致）
function listFolderArgs(page: number, size: number) {
  return {
    dir: copyOrigin.value,
    recursive: recursive.value,
    includeDirs: false,
    include: nameIncludeList.value,
    ignore: nameExcludeList.value,
    includeSuffix: suffixIncludeList.value,
    ignoreSuffix: suffixExcludeList.value,
    includeFolder: folderIncludeList.value,
    ignoreFolder: folderExcludeList.value,
    page,
    pageSize: size,
  };
}

// 拉取当前页
function refreshPage() {
  if (!copyOrigin.value) {
    pageRows.value = [];
    totalFiltered.value = 0;
    return;
  }
  try {
    const res = sendSync('list-folder', listFolderArgs(currentPage.value, pageSize.value)) as
      { items: ListFolderItem[]; total: number };
    let items = res?.items || [];
    let total = res?.total || 0;
    // 页码越界修正（如改条件后总数变少）：收敛到末页并重拉一次
    const maxPage = Math.max(1, Math.ceil(total / pageSize.value));
    if (currentPage.value > maxPage) {
      currentPage.value = maxPage;
      const r2 = sendSync('list-folder', listFolderArgs(currentPage.value, pageSize.value)) as
        { items: ListFolderItem[]; total: number };
      items = r2?.items || [];
      total = r2?.total || 0;
    }
    pageRows.value = items;
    totalFiltered.value = total;
  } catch (e) {
    console.error('list-folder 失败:', e);
    pageRows.value = [];
    totalFiltered.value = 0;
  }
}

// 拉取全部匹配项（动作时一次性构建 renameItems，不在预览期常驻内存）
function fetchAllMatched(): ListFolderItem[] {
  if (!copyOrigin.value) return [];
  try {
    const res = sendSync('list-folder', listFolderArgs(1, 0)) as
      { items: ListFolderItem[]; total: number };
    return res?.items || [];
  } catch (e) {
    console.error('list-folder(全量) 失败:', e);
    return [];
  }
}

// 路径/条件变化：回到第 1 页、清空跨页选中，再拉当前页
function refreshList() {
  currentPage.value = 1;
  selectedMap.value.clear();
  selectAllMatched.value = true;
  refreshPage();
}
// 含子目录切换时刷新预览
watch(recursive, refreshList);
// 任意筛选条件变化时，重新按页拉取（原 previewList 为 computed 自动响应，现改为显式刷新）
watch(
  [nameIncludeList, nameExcludeList, suffixIncludeList, suffixExcludeList, folderIncludeList, folderExcludeList],
  () => refreshList(),
  { deep: true }
);

// 当前页展示行（由 pageRows 派生，应用重命名规则；过滤已在后端完成）
const previewList = computed(() => {
  return pageRows.value.map((f) => {
    const idx = f.index ?? 0;
    const newName = renameEnabled.value ? computeNewName(f, idx, rules) : f.name;
    const selected = selectAllMatched.value ? true : (selectedMap.value.get(f.path) ?? false);
    return {
      oldPath: f.path,
      oldName: f.name,
      newName,
      sizeLabel: formatSize(f.size),
      excluded: false,
      selected,
      renamed: renameEnabled.value && newName !== f.name,
    };
  });
});

// 已选数量（跨页）：全选标记 => 总匹配数；否则统计 selectedMap 中为 true 的路径
const transferCount = computed(() => {
  if (selectAllMatched.value) return totalFiltered.value;
  let c = 0;
  selectedMap.value.forEach((v) => { if (v) c++; });
  return c;
});
const excludedCount = computed(() => 0); // 过滤已下沉后端，预览只展示匹配项
const canStart = computed(() => !!copyOrigin.value && !!copyTarget.value && transferCount.value > 0);
// 表头「全选」：全选标记即为全选；部分选中用于 indeterminate
const allSelected = computed(() => selectAllMatched.value);
const someSelected = computed(() => !selectAllMatched.value && transferCount.value > 0 && transferCount.value < totalFiltered.value);

// 表头勾选：切换「全选所有匹配项」
function onHeaderCheck(v: any) {
  selectAllMatched.value = !!v;
  if (selectAllMatched.value) selectedMap.value.clear();
}
// 单行勾选：首次手动改时先把当前页其余项「物化」到 selectedMap，再标记该行
function onRowCheck(path: string, v: any) {
  if (selectAllMatched.value) {
    pageRows.value.forEach((f) => selectedMap.value.set(f.path, true));
    selectAllMatched.value = false;
  }
  selectedMap.value.set(path, !!v);
}

function rowClassName({ row }: { row: { excluded: boolean; selected: boolean; renamed: boolean } }) {
  if (row.excluded) return 'row-excluded';
  if (!row.selected) return 'row-unselected';
  if (row.renamed) return 'row-will-rename';
  return 'row-will-copy';
}

function openTargetDir() {
  if (!effectiveTarget.value) return ElMessage.warning('请先选择目标位置');
  send('open-folder', effectiveTarget.value);
}

// 进度 / 阶段
const showProgress = ref(false);
const openAfter = ref(false);
const progressVisible = ref(false);
const progressCurrent = ref(0);
const progressTotal = ref(0);
const progressCurrentPath = ref('');
const progressPercent = computed(() => (progressTotal.value ? Math.min(100, Math.round((progressCurrent.value / progressTotal.value) * 100)) : 0));
const phase = ref<'copy' | 'rename'>('copy');

// 待重命名映射（拷贝成功后用于第二阶段原地重命名）
const renameItems = ref<{ oldPath: string; newPath: string }[]>([]);

let started = ref(false);
function onStart() {
  if (!copyOrigin.value || !copyTarget.value) {
    ElMessage.warning('请先选择原位置与目标位置');
    return;
  }
  if (totalFiltered.value === 0) {
    ElMessage.warning('没有可转移的文件');
    return;
  }
  // 拼接目标落点（与后端一致：目标 + 源末级名 + 相对子目录）
  const target = effectiveTarget.value;
  const sep = pathSep(target);
  // 第二阶段重命名映射：分页下当前页不全，一次性拉全量匹配项构建
  let ren: { oldPath: string; newPath: string }[] = [];
  if (renameEnabled.value) {
    const all = fetchAllMatched();
    ren = all
      .filter((f) => selectAllMatched.value || selectedMap.value.get(f.path) === true)
      .map((f) => {
        const newName = computeNewName(f, f.index ?? 0, rules);
        if (newName === f.name) return null;
        const rd = relDirOf(f.path, copyOrigin.value);
        const oldP = [target, rd, f.name].filter(Boolean).join(sep);
        const newP = [target, rd, newName].filter(Boolean).join(sep);
        return { oldPath: oldP, newPath: newP };
      })
      .filter((x): x is { oldPath: string; newPath: string } => x !== null);
  }
  renameItems.value = ren;

  started.value = true;
  progressCurrent.value = 0;
  progressTotal.value = totalFiltered.value + (ren.length ? ren.length : 0);
  progressCurrentPath.value = '';
  phase.value = 'copy';
  if (showProgress.value) progressVisible.value = true;

  // 第一阶段：拷贝 / 移动（后端按筛选条件只复制可转移文件）
  send('copy-folder', {
    source: copyOrigin.value,
    target,
    include: nameIncludeList.value,
    ignore: nameExcludeList.value,
    includeSuffix: suffixIncludeList.value,
    ignoreSuffix: suffixExcludeList.value,
    includeFolder: folderIncludeList.value,
    ignoreFolder: folderExcludeList.value,
    preserveTimestamps: true,
    recursive: recursive.value,
    op: op.value,
    strategy: strategy.value,
  });
}

const onCopyProgress = (_e: any, data: { current: number; total: number; currentPath: string }) => {
  if (!progressVisible.value) return;
  progressCurrent.value = data.current;
  progressTotal.value = data.total;
  progressCurrentPath.value = data.currentPath;
};
const onRenameProgress = (_e: any, data: { current: number; total: number; currentPath: string }) => {
  if (!progressVisible.value) return;
  progressCurrent.value = data.current;
  progressTotal.value = data.total;
  progressCurrentPath.value = data.currentPath;
};

const onCopyFolder = (_e: any, res: any) => {
  if (!started.value) return;
  if (!res || res.ok === false) {
    // 失败
    started.value = false;
    progressVisible.value = false;
    ElMessage({ message: '转移失败: ' + (res?.error || res), type: 'error', duration: 5000 });
    return;
  }
  const skipped = res.skipped || 0;
  // 若启用重命名且有实际重命名项，进入第二阶段
  if (renameEnabled.value && renameItems.value.length) {
    phase.value = 'rename';
    progressCurrent.value = 0;
    progressTotal.value = renameItems.value.length;
    progressCurrentPath.value = '';
    progressVisible.value = showProgress.value;
    send('rename-files', { items: renameItems.value, strategy: 'auto' });
    return;
  }
  finishTransfer(skipped);
};

const onRenameFiles = (_e: any, res: any) => {
  if (!started.value || phase.value !== 'rename') return;
  if (res == null) {
    finishTransfer(0);
  } else if (res.error) {
    started.value = false;
    progressVisible.value = false;
    ElMessage({ message: '重命名失败: ' + res.error, type: 'error', duration: 5000 });
  } else {
    finishTransfer(0);
  }
};

function finishTransfer(skipped: number) {
  started.value = false;
  progressVisible.value = false;
  const msg = renameEnabled.value && renameItems.value.length
    ? `转移并重命名完成，共 ${renameItems.value.length} 项`
    : '转移完成';
  ElMessage.success(skipped ? `${msg}，跳过 ${skipped} 个同名文件` : msg);
  if (openAfter.value && effectiveTarget.value) send('open-folder', effectiveTarget.value);
  // 移动模式源已删除；清空预览避免残留
  if (op.value === 'move') {
    pageRows.value = [];
    totalFiltered.value = 0;
    selectedMap.value.clear();
    selectAllMatched.value = true;
    currentPage.value = 1;
  }
}

onMounted(() => {
  window.ipcRenderer.on('copy-folder', onCopyFolder);
  window.ipcRenderer.on('copy-folder-progress', onCopyProgress);
  window.ipcRenderer.on('rename-files', onRenameFiles);
  window.ipcRenderer.on('rename-files-progress', onRenameProgress);
});
onUnmounted(() => {
  window.ipcRenderer.removeAllListeners('copy-folder');
  window.ipcRenderer.removeAllListeners('copy-folder-progress');
  window.ipcRenderer.removeAllListeners('rename-files');
  window.ipcRenderer.removeAllListeners('rename-files-progress');
});
</script>

<style scoped lang="scss">
.file-card {
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.card-body {
  padding: 20px;
}

.copy-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.mode-row {
  display: flex;
  align-items: center;
  gap: 8px;

  .mode-tab {
    padding: 5px 18px;
    border-radius: 8px;
    font-size: 13px;
    background: var(--bg-base, #f2f3f5);
    color: var(--text-secondary);
    cursor: pointer;
    user-select: none;

    &.active {
      background: var(--color-primary);
      color: #fff;
    }
  }

  .mode-hint {
    font-size: 12px;
    color: var(--text-muted);
    margin-left: 4px;
  }
}

.path-row {
  display: flex;
  align-items: center;
  gap: 16px;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
}

.path-item {
  flex: 1;
}

.path-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.path-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.cache-fill-link {
  font-size: 12px;
  color: var(--color-primary);
  cursor: pointer;
  user-select: none;

  &:hover {
    text-decoration: underline;
  }
}

.path-btn {
  padding: 0 12px;
}

.arrow-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
}

.arrow-icon {
  font-size: 20px;
  color: var(--text-muted);
  cursor: pointer;

  &:hover {
    color: var(--color-primary);
  }
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-base, #f7f8fa);
  border-radius: 8px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  width: 40px;
}

.radio-group {
  display: flex;
  gap: 16px;
}

.filter-input {
  flex: 1;
  max-width: 320px;
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tag-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 28px;
}

.tag-prefix {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.include-prefix {
  color: #18a058;
}

.exclude-prefix {
  color: #d03050;
}

.opt-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.strategy-select {
  width: 130px;
}

.rename-block {
  border: 0.5px dashed var(--color-primary, #3b6cff);
  border-radius: 8px;
  padding: 10px 12px;

  .rule-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 10px;
  }
}

.preview-block {
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 12px 14px;
}

.preview-head {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;

  b {
    color: var(--color-primary);
  }

  .skip-text {
    color: #e6a23c;
  }
}

.preview-table {
  width: 100%;

  :deep(.row-excluded) {
    opacity: 0.5;
  }

  :deep(.row-unselected) {
    opacity: 0.6;
  }

  :deep(.row-will-rename) {
    background: rgba(64, 158, 255, 0.12);

    .cell-name.willRename {
      color: var(--color-primary);
      font-weight: 700;
    }
  }

  :deep(.col-check .cell) {
    display: flex;
    justify-content: center;
  }
}

.preview-tools {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.cell-name {
  word-break: break-all;
  font-family: monospace;

  &.unchanged {
    color: var(--text-muted);
  }
}

.open-target-hint {
  font-size: 13px;
  color: var(--text-muted);
  word-break: break-all;
}

.open-target-link {
  color: var(--color-primary);
  cursor: pointer;
  user-select: none;

  &:hover {
    text-decoration: underline;
  }
}

.copy-btn-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.open-after {
  margin-right: auto;
}

.copy-btn {
  padding: 10px 32px;
}

.copy-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.progress-toggle {
  margin-left: auto;
}

.progress-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 96px;
}

.progress-meta {
  font-size: 13px;
  color: var(--text-secondary);
}

.progress-current {
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-all;
  max-height: 96px;
  overflow-y: auto;
  line-height: 1.6;
}
</style>
