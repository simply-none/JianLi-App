<template>
  <div class="file-card">
    <div class="card-header del-header">
      <h3 class="card-title">
        <el-icon><LucideIcon name="Trash2" /></el-icon>
        文件删除
      </h3>
      <el-checkbox v-model="delShowProgress" class="progress-toggle">进度检测</el-checkbox>
    </div>
    <div class="card-body">
      <div class="del-section">
        <!-- 选择目标文件夹 -->
        <div class="path-item">
          <div class="path-head">
            <span class="path-label">目标文件夹</span>
          </div>
          <el-input v-model="delFolder" placeholder="请选择要删除的文件夹" disabled :title="delFolder">
            <template #append>
              <el-button @click="selectDelFolder" class="path-btn">
                <el-icon><LucideIcon name="Folder" /></el-icon>
                选择目录
              </el-button>
            </template>
          </el-input>
        </div>

        <!-- 第一排：删除模式 -->
        <div class="filter-section">
          <div class="filter-row">
            <span class="filter-label">模式</span>
            <el-radio-group v-model="delMode" class="radio-group">
              <el-radio value="all">整体删除</el-radio>
              <el-radio value="suffix">文件类型删除</el-radio>
              <el-radio value="fuzzy">模糊匹配文件名</el-radio>
              <el-radio value="folder">模糊匹配文件夹</el-radio>
            </el-radio-group>
          </div>
          <!-- 文件类型删除：每输入一个类型，回车或点“加入”生成一个 tag -->
          <el-input v-if="delMode === 'suffix'" v-model="delSuffixInput" placeholder="输入文件类型，如: .log、.tmp，回车添加" class="filter-input-wide" @keyup.enter="addSuffixTag">
            <template #append>
              <el-button @click="addSuffixTag">加入</el-button>
            </template>
          </el-input>
          <div v-if="delMode === 'suffix' && delSuffixTags.length" class="tag-wrap">
            <el-tag v-for="(t, i) in delSuffixTags" :key="i" closable @close="removeSuffixTag(i)" class="type-tag">{{ t }}</el-tag>
          </div>
          <!-- 模糊匹配文件名 / 文件夹：按关键字包含 -->
          <el-input v-else-if="delMode === 'fuzzy' || delMode === 'folder'" v-model="delPattern" :placeholder="delMode === 'folder' ? '输入文件夹名包含的关键字' : '输入文件名包含的关键字'" class="filter-input-wide">
            <template #append>
              <el-button @click="onDelClick">开始删除</el-button>
            </template>
          </el-input>
          <div v-else class="mode-tip">将删除整个文件夹（含子目录）</div>
        </div>

        <!-- 第二排：遍历 / 彻底删除 -->
        <div class="opt-row">
          <el-checkbox v-model="delRecursive">遍历子目录</el-checkbox>
          <el-checkbox v-model="delThorough">彻底删除（不勾则移至回收站）</el-checkbox>
        </div>

        <div class="copy-btn-wrap">
          <el-button type="danger" @click="onDelClick" class="del-btn">
            <el-icon><LucideIcon name="Trash2" /></el-icon>
            开始删除
          </el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="delProgressVisible" title="文件删除进度" width="440px" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false" append-to-body>
      <div class="progress-body">
        <el-progress :percentage="delProgressPercent" :stroke-width="14" />
        <div class="progress-meta">已删除 {{ delProgressCurrent }} / {{ delProgressTotal }} 项</div>
        <div class="progress-current" :title="delProgressCurrentPath">{{ delProgressCurrentPath || '准备中…' }}</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { send, sendSync } from '@/utils/common';
import { ElMessage } from 'element-plus';

// 目标文件夹
const delFolder = ref('');
function selectDelFolder() {
  const res = sendSync('get-file-list', 'select-dir');
  delFolder.value = res[0];
}

// 删除模式：整体删除 / 文件类型(后缀) / 模糊匹配文件名
const delMode = ref<'all' | 'suffix' | 'fuzzy' | 'folder'>('all');
const delSuffixInput = ref(''); // 文件类型模式：当前正在输入的单个类型
const delSuffixTags = ref<string[]>([]); // 文件类型 tag 列表（传入后端的 suffixes）
const delPattern = ref('');     // 模糊匹配模式输入
const delRecursive = ref(false); // 是否遍历子目录
const delThorough = ref(false);  // 是否彻底删除（false=移入回收站）

// 进度检测：仅当勾选时弹窗；后端始终上报真实进度，前端按开关决定是否展示
const delShowProgress = ref(false);
const delProgressVisible = ref(false);
const delProgressCurrent = ref(0);
const delProgressTotal = ref(0);
const delProgressCurrentPath = ref('');
const delProgressPercent = computed(() => {
  if (!delProgressTotal.value) return 0;
  return Math.min(100, Math.round((delProgressCurrent.value / delProgressTotal.value) * 100));
});

// 文件类型规范化：去空格、转小写、补前导点（如 log → .log）
function normalizeSuffix(s: string): string {
  const t = s.trim().toLowerCase();
  return t.startsWith('.') ? t : '.' + t;
}
// 回车 / 点“加入”把当前输入加为一个文件类型 tag
function addSuffixTag() {
  const raw = delSuffixInput.value.trim();
  if (!raw) return;
  const tag = normalizeSuffix(raw);
  if (!delSuffixTags.value.includes(tag)) {
    delSuffixTags.value.push(tag);
  }
  delSuffixInput.value = '';
}
// 移除某个文件类型 tag
function removeSuffixTag(i: number) {
  delSuffixTags.value.splice(i, 1);
}

let errFlag = ref(false);
function onDelClick() {
  if (!delFolder.value) {
    ElMessage.warning('请先选择目标文件夹');
    return;
  }
  if (delMode.value === 'suffix' && !delSuffixTags.value.length) {
    ElMessage.warning('请先添加要删除的文件类型');
    return;
  }
  if ((delMode.value === 'fuzzy' || delMode.value === 'folder') && !delPattern.value.trim()) {
    ElMessage.warning(delMode.value === 'folder' ? '请输入要匹配的文件夹名关键字' : '请输入要匹配的文件名关键字');
    return;
  }
  // 文件类型模式：直接传入 tag 数组（每个 tag 已规范化：带点 + 小写）
  const suffixes = delSuffixTags.value;

  const args = {
    folder: delFolder.value,
    mode: delMode.value,
    suffixes: delMode.value === 'suffix' ? suffixes : undefined,
    pattern: delMode.value === 'fuzzy' || delMode.value === 'folder' ? delPattern.value : undefined,
    recursive: delRecursive.value,
    recycleBin: !delThorough.value
  };
  errFlag.value = true;
  delProgressCurrent.value = 0;
  delProgressTotal.value = 0;
  delProgressCurrentPath.value = '';
  if (delShowProgress.value) delProgressVisible.value = true;
  send('delete-files', args);
}

const onDeleteFilesProgress = (_event: any, data: { current: number; total: number; currentPath: string }) => {
  if (!delProgressVisible.value) return;
  delProgressCurrent.value = data.current;
  delProgressTotal.value = data.total;
  delProgressCurrentPath.value = data.currentPath;
};

const onDeleteFiles = (_event: any, res: any) => {
  if (!errFlag.value) return;
  errFlag.value = false;
  if (delProgressVisible.value) delProgressVisible.value = false;
  if (res == null) {
    ElMessage.success('删除成功');
  } else {
    ElMessage({
      message: '删除失败: ' + res,
      type: 'error',
      duration: 5000
    });
  }
};
onMounted(() => {
  window.ipcRenderer.on('delete-files', onDeleteFiles);
  window.ipcRenderer.on('delete-files-progress', onDeleteFilesProgress);
});
onUnmounted(() => {
  window.ipcRenderer.removeAllListeners('delete-files');
  window.ipcRenderer.removeAllListeners('delete-files-progress');
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

.del-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.path-item {
  width: 100%;
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

.path-btn {
  padding: 0 12px;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  flex-wrap: wrap;
}

.filter-input-wide {
  width: 100%;
}

.tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.type-tag {
  font-size: 13px;
}

.mode-tip {
  font-size: 13px;
  color: var(--text-muted);
}

.opt-row {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.copy-btn-wrap {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}

.del-btn {
  padding: 10px 40px;
}

.del-header {
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
}

.progress-meta {
  font-size: 13px;
  color: var(--text-secondary);
}

.progress-body {
  min-height: 96px;
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
