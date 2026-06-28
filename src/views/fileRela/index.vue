<template>
  <div class="file-rela-container">
    <!-- <div class="page-header">
      <h2 class="page-title">文件管理</h2>
    </div> -->

    <div class="cards-grid">
      <div class="file-card">
        <div class="card-header">
          <h3 class="card-title">
            <el-icon><LucideIcon name="UploadCloud" /></el-icon>
            文件上传测试
          </h3>
        </div>
        <div class="card-body">
          <upload-vue :limit="1" @update-data="updateDataFn" />
        </div>
      </div>

      <div class="file-card">
        <div class="card-header">
          <h3 class="card-title">
            <el-icon><LucideIcon name="Files" /></el-icon>
            文件转移
          </h3>
        </div>
        <div class="card-body">
          <div class="copy-section">
            <div class="path-row">
              <div class="path-item">
                <span class="path-label">原位置</span>
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
                <span class="path-label">目标位置</span>
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
                <el-input v-model="copyInclude" placeholder="输入关键词" @keyup.enter="selectCopyInclude" class="filter-input">
                  <template #append>
                    <el-button @click="selectCopyInclude">添加</el-button>
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
                <el-input v-model="copyIncludeSuffix" placeholder="如: .png、.jpeg" @keyup.enter="selectCopyIncludeSuffix" class="filter-input">
                  <template #append>
                    <el-button @click="selectCopyIncludeSuffix">添加</el-button>
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

            <div class="copy-btn-wrap">
              <el-button type="primary" @click="copyDir" class="copy-btn">
                <el-icon><LucideIcon name="Files" /></el-icon>
                复制转移
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <FileScanVue :defaultAppPaths="defaultAppPaths"></FileScanVue>

      <div class="file-card">
        <div class="card-header">
          <h3 class="card-title">
            <el-icon><LucideIcon name="GamepadDirectional" /></el-icon>
            默认应用
          </h3>
        </div>
        <div class="card-body">
          <DefaultApp @updateDefaultAppPaths="updateDefaultAppPaths"></DefaultApp>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import UploadVue from '@/components/upload.vue';
import FileScanVue from './fileScan.vue';
import DefaultApp from './defaultApp.vue';
import { send, sendSync } from '@/utils/common';
import { ElMessage } from 'element-plus';

const defaultAppPaths = ref<Record<string, ObjectType>>({});
const updateDefaultAppPaths = (list: Record<string, ObjectType>) => {
  defaultAppPaths.value = list;
};

const copyOrigin = ref('');
function selectCopyPath() {
  const res = sendSync('get-file-list', 'select-dir');
  copyOrigin.value = res[0];
}

const copyTarget = ref('');
function selectCopyTarget() {
  const res = sendSync('get-file-list', 'select-dir');
  copyTarget.value = res[0];
}

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

let errFlag = ref(false);
function copyDir() {
  const pathArr = copyOrigin.value.split(/\/+|\\+/);
  const copyArgs = {
    source: copyOrigin.value,
    target: (copyTarget.value || fileCachePathCc.value) + '/' + pathArr[pathArr.length - 1],
    ignore: copyExcludeList.value,
    include: copyIncludeList.value,
    includeSuffix: copyIncludeSuffixList.value,
    ignoreSuffix: copyExcludeSuffixList.value
  };
  errFlag.value = true;
  send('copy-folder', copyArgs);
}

function updateDataFn(data: any, data2: any) {
  console.log(data, data2);
}

const fileCachePathCc = ref('');
onMounted(() => {
  window.ipcRenderer.on('copy-folder', (_event: any, res: any) => {
    if (!errFlag.value) return;
    errFlag.value = false;
    if (res == null) {
      ElMessage.success('复制成功');
    } else {
      ElMessage({
        message: '复制失败: ' + res,
        type: 'error',
        duration: 5000
      });
    }
  });
});
</script>

<style scoped lang="scss">
.file-rela-container {
  // padding: 24px;
  box-sizing: border-box;
  min-height: 100%;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

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
  margin-bottom: 8px;
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

.copy-btn {
  padding: 10px 40px;
}
</style>