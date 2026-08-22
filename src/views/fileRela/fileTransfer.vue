<template>
  <div class="file-card">
    <div class="card-header copy-header">
      <h3 class="card-title">
        <el-icon><LucideIcon name="Files" /></el-icon>
        文件转移
      </h3>
      <el-checkbox v-model="copyShowProgress" class="progress-toggle">进度检测</el-checkbox>
    </div>
    <div class="card-body">
      <div class="copy-section">
        <div class="path-row">
          <div class="path-item">
            <div class="path-head">
              <span class="path-label">原位置</span>
              <span class="cache-fill-link" @click="fillCacheOrigin">填入缓存位置</span>
            </div>
            <el-input v-model="copyOrigin" placeholder="请选择" disabled :title="copyOrigin">
              <template #append>
                <el-button @click="selectCopyPath" class="path-btn">
                  <el-icon><LucideIcon name="Folder" /></el-icon>
                  选择目录
                </el-button>
              </template>
            </el-input>
          </div>
          <div class="arrow-wrap">
            <el-icon class="arrow-icon"><LucideIcon name="ArrowRight" /></el-icon>
          </div>
          <div class="path-item">
            <div class="path-head">
              <span class="path-label">目标位置</span>
              <span class="cache-fill-link" @click="fillCacheTarget">填入缓存位置</span>
            </div>
            <el-input v-model="copyTarget" placeholder="请选择" disabled :title="copyTarget">
              <template #append>
                <el-button @click="selectCopyTarget" class="path-btn">
                  <el-icon><LucideIcon name="Folder" /></el-icon>
                  选择目录
                </el-button>
              </template>
            </el-input>
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-row">
            <span class="filter-label">名称</span>
            <el-radio-group v-model="copyType" @change="changeCopyType" class="radio-group">
              <el-radio value="include">包含</el-radio>
              <el-radio value="exclude">排除</el-radio>
            </el-radio-group>
            <el-input v-if="copyType === 'include'" v-model="copyInclude" placeholder="输入关键词" @keyup.enter="selectCopyInclude" class="filter-input">
              <template #append>
                <el-button @click="selectCopyInclude">添加</el-button>
              </template>
            </el-input>
            <el-input v-else v-model="copyExclude" placeholder="输入排除关键词" @keyup.enter="selectCopyExclude" class="filter-input">
              <template #append>
                <el-button @click="selectCopyExclude">添加</el-button>
              </template>
            </el-input>
          </div>
          <div class="tag-list">
            <el-tag v-for="(item, index) in copyIncludeList" :key="index" closable @close="removeCopyInclude(item)">
              {{ item }}
            </el-tag>
            <el-tag v-for="(item, index) in copyExcludeList" :key="index" closable @close="removeCopyExclude(item)" type="danger">
              {{ item }}
            </el-tag>
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-row">
            <span class="filter-label">后缀</span>
            <el-radio-group v-model="copyTypeSuffix" @change="changeCopyTypeSuffix" class="radio-group">
              <el-radio value="include">包含</el-radio>
              <el-radio value="exclude">排除</el-radio>
            </el-radio-group>
            <el-input v-if="copyTypeSuffix === 'include'" v-model="copyIncludeSuffix" placeholder="如: .png、.jpeg" @keyup.enter="selectCopyIncludeSuffix" class="filter-input">
              <template #append>
                <el-button @click="selectCopyIncludeSuffix">添加</el-button>
              </template>
            </el-input>
            <el-input v-else v-model="copyExcludeSuffix" placeholder="如: .png、.jpeg" @keyup.enter="selectCopyExcludeSuffix" class="filter-input">
              <template #append>
                <el-button @click="selectCopyExcludeSuffix">添加</el-button>
              </template>
            </el-input>
          </div>
          <div class="tag-list">
            <el-tag v-for="(item, index) in copyIncludeSuffixList" :key="index" closable @close="removeCopyIncludeSuffix(item)">
              {{ item }}
            </el-tag>
            <el-tag v-for="(item, index) in copyExcludeSuffixList" :key="index" closable @close="removeCopyExcludeSuffix(item)" type="danger">
              {{ item }}
            </el-tag>
          </div>
        </div>

        <div class="open-target-hint">
          点击打开
          <span class="open-target-link" :title="resolvedTargetPath || '目标目录地址'" @click="openTargetDir">{{ resolvedTargetPath || '目标目录地址' }}</span>
        </div>
        <div class="copy-btn-wrap">
          <el-button type="primary" @click="copyDir" class="copy-btn">
            <el-icon><LucideIcon name="Files" /></el-icon>
            复制转移
          </el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="copyProgressVisible" title="文件转移进度" width="440px" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false" append-to-body>
      <div class="progress-body">
        <el-progress :percentage="copyProgressPercent" :stroke-width="14" />
        <div class="progress-meta">已复制 {{ copyProgressCurrent }} / {{ copyProgressTotal }} 个文件</div>
        <div class="progress-current" :title="copyProgressCurrentPath">{{ copyProgressCurrentPath || '准备中…' }}</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { send, sendSync } from '@/utils/common';
import { ElMessage } from 'element-plus';
import { storeToRefs } from 'pinia';
import useCacheSetStore from '@/store/useCacheSet';

// 源目录
const copyOrigin = ref('');
function selectCopyPath() {
  const res = sendSync('get-file-list', 'select-dir');
  copyOrigin.value = res[0];
}

// 目标目录
const copyTarget = ref('');
function selectCopyTarget() {
  const res = sendSync('get-file-list', 'select-dir');
  copyTarget.value = res[0];
}

// 缓存位置：取自设置页配置的 fileCachePath（持久化），用于「填入缓存位置」一键回填
const { fileCachePathC } = storeToRefs(useCacheSetStore());
const fillCacheOrigin = () => {
  if (!fileCachePathC.value) {
    ElMessage.warning('请先在设置中配置缓存位置');
    return;
  }
  copyOrigin.value = fileCachePathC.value;
};
const fillCacheTarget = () => {
  if (!fileCachePathC.value) {
    ElMessage.warning('请先在设置中配置缓存位置');
    return;
  }
  copyTarget.value = fileCachePathC.value;
};

// 名称过滤（包含/排除）
const copyType = ref('include');
const copyInclude = ref('');
const copyIncludeList = ref<string[]>([]);
function selectCopyInclude() {
  copyInclude.value = copyInclude.value.trim();
  if (copyInclude.value) {
    copyIncludeList.value.push(copyInclude.value);
    copyInclude.value = '';
  }
}
function removeCopyInclude(item: string) {
  copyIncludeList.value = copyIncludeList.value.filter(val => val !== item);
}

const copyExclude = ref('');
const copyExcludeList = ref<string[]>([]);
function selectCopyExclude() {
  copyExclude.value = copyExclude.value.trim();
  if (copyExclude.value) {
    copyExcludeList.value.push(copyExclude.value);
    copyExclude.value = '';
  }
}
function removeCopyExclude(item: string) {
  copyExcludeList.value = copyExcludeList.value.filter(val => val !== item);
}

// 后缀过滤（包含/排除）
const copyTypeSuffix = ref('include');
const copyIncludeSuffix = ref('');
const copyIncludeSuffixList = ref<string[]>([]);
function selectCopyIncludeSuffix() {
  copyIncludeSuffix.value = copyIncludeSuffix.value.trim();
  if (copyIncludeSuffix.value) {
    copyIncludeSuffixList.value.push(copyIncludeSuffix.value);
    copyIncludeSuffix.value = '';
  }
}
function removeCopyIncludeSuffix(item: string) {
  copyIncludeSuffixList.value = copyIncludeSuffixList.value.filter(val => val !== item);
}

const copyExcludeSuffix = ref('');
const copyExcludeSuffixList = ref<string[]>([]);
function selectCopyExcludeSuffix() {
  copyExcludeSuffix.value = copyExcludeSuffix.value.trim();
  if (copyExcludeSuffix.value) {
    copyExcludeSuffixList.value.push(copyExcludeSuffix.value);
    copyExcludeSuffix.value = '';
  }
}
function removeCopyExcludeSuffix(item: string) {
  copyExcludeSuffixList.value = copyExcludeSuffixList.value.filter(val => val !== item);
}

function changeCopyType(val: string) {
  if (val === 'include') {
    copyExcludeList.value = [];
  } else {
    copyIncludeList.value = [];
  }
}

function changeCopyTypeSuffix(val: string) {
  if (val === 'include') {
    copyExcludeSuffixList.value = [];
  } else {
    copyIncludeSuffixList.value = [];
  }
}

// 进度检测：仅当勾选时弹窗；后端始终上报真实进度，前端按开关决定是否展示
const copyShowProgress = ref(false);
const copyProgressVisible = ref(false);
const copyProgressCurrent = ref(0);
const copyProgressTotal = ref(0);
const copyProgressCurrentPath = ref('');
const copyProgressPercent = computed(() => {
  if (!copyProgressTotal.value) return 0;
  return Math.min(100, Math.round((copyProgressCurrent.value / copyProgressTotal.value) * 100));
});

// 实际目标目录地址：用户选中的目标目录 + 源目录末级名（与后端 copyDir 拼接规则一致）
const resolvedTargetPath = computed(() => {
  if (!copyTarget.value) return '';
  if (!copyOrigin.value) return copyTarget.value;
  const seg = copyOrigin.value.split(/[\\/]/).pop();
  return `${copyTarget.value}/${seg}`;
});
function openTargetDir() {
  if (!resolvedTargetPath.value) {
    ElMessage.warning('请先选择目标位置');
    return;
  }
  send('open-folder', resolvedTargetPath.value);
}

let errFlag = ref(false);
function copyDir() {
  if (!copyOrigin.value) {
    ElMessage.warning('请先选择原位置');
    return;
  }
  if (!copyTarget.value) {
    ElMessage.warning('请先选择目标位置');
    return;
  }
  const pathArr = copyOrigin.value.split(/\/+|\\+/);
  const copyArgs = {
    source: copyOrigin.value,
    target: copyTarget.value + '/' + pathArr[pathArr.length - 1],
    ignore: copyExcludeList.value,
    include: copyIncludeList.value,
    includeSuffix: copyIncludeSuffixList.value,
    ignoreSuffix: copyExcludeSuffixList.value
  };
  errFlag.value = true;
  copyProgressCurrent.value = 0;
  copyProgressTotal.value = 0;
  copyProgressCurrentPath.value = '';
  if (copyShowProgress.value) copyProgressVisible.value = true;
  send('copy-folder', copyArgs);
}

const onCopyFolderProgress = (_event: any, data: { current: number; total: number; currentPath: string }) => {
  if (!copyProgressVisible.value) return;
  copyProgressCurrent.value = data.current;
  copyProgressTotal.value = data.total;
  copyProgressCurrentPath.value = data.currentPath;
};

const onCopyFolder = (_event: any, res: any) => {
  if (!errFlag.value) return;
  errFlag.value = false;
  if (copyProgressVisible.value) copyProgressVisible.value = false;
  if (res == null) {
    ElMessage.success('转移成功');
    copyOrigin.value = '';
    copyTarget.value = '';
  } else {
    ElMessage({
      message: '复制失败: ' + res,
      type: 'error',
      duration: 5000
    });
  }
};
onMounted(() => {
  window.ipcRenderer.on('copy-folder', onCopyFolder);
  window.ipcRenderer.on('copy-folder-progress', onCopyFolderProgress);
});
onUnmounted(() => {
  window.ipcRenderer.removeAllListeners('copy-folder');
  window.ipcRenderer.removeAllListeners('copy-folder-progress');
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
  gap: 20px;
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
  margin-bottom: 0;
}

.path-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.cache-fill-link {
  font-size: 12px;
  color: var(--el-color-primary);
  cursor: pointer;
  user-select: none;
}

.cache-fill-link:hover {
  text-decoration: underline;
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
}

.filter-input {
  flex: 1;
  max-width: 280px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.copy-btn-wrap {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}

.open-target-hint {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
}

.open-target-link {
  color: var(--el-color-primary);
  cursor: pointer;
  user-select: none;
  word-break: break-all;
}

.open-target-link:hover {
  text-decoration: underline;
}

.copy-btn {
  padding: 10px 40px;
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
}

.progress-meta {
  font-size: 13px;
  color: var(--text-secondary);
}

.progress-current {
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-all;
  max-height: 40px;
  overflow: hidden;
}
</style>
