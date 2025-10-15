<template>
  <el-form class="fileRela-form" label-width="108" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">文件上传测试</div>
      </template>
    </el-form-item>
    <!-- 文件上传测试 -->
    <el-form-item label="文件上传测试" class="mode-wrapper">
      <upload-vue :limit="1" @update-data="updateDataFn" />
    </el-form-item>

    <!-- 分割线 -->
    <el-divider></el-divider>
    <el-form-item>
      <template #label>
        <div class="setting-title">文件转移</div>
      </template>
    </el-form-item>
    <!-- 文件夹复制测试 -->
    <el-form-item label="文件转移" class="mode-wrapper file-move">
      <el-form-item label="原位置" style="width: 100%;">
        <el-input v-model="copyOrigin" placeholder="请选择" style="width: 100%" disabled :title="copyOrigin">
          <template #append>
            <el-button @click="selectCopyPath">
              选择目录
            </el-button>
          </template>
        </el-input>
      </el-form-item>
      <el-form-item label="目标位置" style="width: 100%;">
        <el-input v-model="copyTarget" placeholder="请选择" style="width: 100%" disabled :title="copyTarget">
          <template #append>
            <el-button @click="selectCopyTarget">
              选择目录
            </el-button>
          </template>
        </el-input>
      </el-form-item>
      <!-- 包含还是排除 -->
      <el-form-item label="包含还是排除">
        <el-radio-group v-model="copyType" @change="changeCopyType">
          <el-radio value="include">包含</el-radio>
          <el-radio value="exclude">排除</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="名称包含" v-if="copyType == 'include'">
        <el-input v-model="copyInclude" placeholder="请输入" style="width: 100%" @keyup.enter="selectCopyInclude">
          <template #append>
            <el-button @click="selectCopyInclude">
              添加
            </el-button>
          </template>
        </el-input>
        <!-- 名称包含的列表 -->
        <div class="copy-include-list">
          <el-tag v-for="(item, index) in copyIncludeList" :key="index" closable @close="removeCopyInclude(item)">
            {{ item }}
          </el-tag>
        </div>
      </el-form-item>
      <el-form-item label="名称排除" v-else>
        <el-input v-model="copyExclude" placeholder="请输入" style="width: 100%" @keyup.enter="selectCopyExclude">
          <template #append>
            <el-button @click="selectCopyExclude">
              添加
            </el-button>
          </template>
        </el-input>
        <!-- 名称排除的列表 -->
        <div class="copy-exclude-list">
          <el-tag v-for="(item, index) in copyExcludeList" :key="index" closable @close="removeCopyExclude(item)">
            {{ item }}
          </el-tag>
        </div>
      </el-form-item>
      <!-- 包含还是排除特定的文件后缀 -->
      <el-form-item label="后缀包含还是排除">
        <el-radio-group v-model="copyTypeSuffix" @change="changeCopyTypeSuffix">
          <el-radio value="include">包含</el-radio>
          <el-radio value="exclude">排除</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="后缀包含" v-if="copyTypeSuffix == 'include'">
        <el-input v-model="copyIncludeSuffix" placeholder="请输入：.png、.jpeg、.mp4、.doc" style="width: 100%"
          @keyup.enter="selectCopyIncludeSuffix">
          <template #append>
            <el-button @click="selectCopyIncludeSuffix">
              添加
            </el-button>
          </template>
        </el-input>
        <!-- 名称包含的列表 -->
        <div class="copy-include-list">
          <el-tag v-for="(item, index) in copyIncludeSuffixList" :key="index" closable
            @close="removeCopyIncludeSuffix(item)">
            {{ item }}
          </el-tag>
        </div>
      </el-form-item>
      <el-form-item label="后缀排除" v-else>
        <el-input v-model="copyExcludeSuffix" placeholder="请输入" style="width: 100%"
          @keyup.enter="selectCopyExcludeSuffix">
          <template #append>
            <el-button @click="selectCopyExcludeSuffix">
              添加
            </el-button>
          </template>
        </el-input>
        <!-- 名称排除的列表 -->
        <div class="copy-exclude-list">
          <el-tag v-for="(item, index) in copyExcludeSuffixList" :key="index" closable
            @close="removeCopyExcludeSuffix(item)">
            {{ item }}
          </el-tag>
        </div>
      </el-form-item>

    </el-form-item>
    <el-form-item>
      <el-button @click="copyDir" type="primary">
        复制转移
      </el-button>
    </el-form-item>

    <!-- 分割线 -->
    <el-divider></el-divider>
    <!-- 文件扫描 -->
    <FileScanVue></FileScanVue>
  </el-form>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, toRaw, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import UploadVue from '@/components/upload.vue';
import FileScanVue from './fileScan.vue';
import useCacheSetStore from '@/store/useCacheSet'
import { send, sendSync } from '@/utils/common';
import { ElMessage } from 'element-plus';

const { fileCachePathC } = storeToRefs(useCacheSetStore());
const { setFileCachePath } = useCacheSetStore();

const fileCachePathCc = ref(fileCachePathC.value);

watch(() => fileCachePathC.value, (newVal) => {
  fileCachePathCc.value = newVal;
})

const copyOrigin = ref('');
function selectFileDir() {
  const res = sendSync('get-file-list', 'select-dir');
  console.log(res);
  if (Array.isArray(res)) {
    fileCachePathCc.value = res[0];
    setFileCachePath(fileCachePathCc.value);
  }
}
function selectCopyPath() {
  const res = sendSync('get-file-list', 'select-dir');
  copyOrigin.value = res[0];
  console.log(res);
}

const copyTarget = ref('');
function selectCopyTarget() {
  const res = sendSync('get-file-list', 'select-dir');
  copyTarget.value = res[0];
  console.log(res);
}

const scanPath = ref('');
function selectScanPath() {
  const res = sendSync('get-file-list', 'select-dir');
  scanPath.value = res[0];
  console.log(res);
}

const scanSuffix = ref('');
const scanSuffixList = ref<string[]>([]);
function selectScanSuffix() {
  // 去除首尾空格
  scanSuffix.value = scanSuffix.value.trim();
  if (scanSuffix.value) {
    scanSuffixList.value.push(scanSuffix.value);
    scanSuffix.value = '';
  }
}

function removeScanSuffix(item: string) {
  scanSuffixList.value = scanSuffixList.value.filter((val) => val !== item);
}

const startScan = async () => {
  const startDefaultPath = 'C:\\'
  const startPath = scanPath.value || startDefaultPath;

  // 如果后缀为空，则不进行扫描
  if (scanSuffixList.value.length === 0) {
    ElMessage.error('请添加扫描后缀');
    return;
  }

  try {
    // 设置进度监听
    window.ipcRenderer.on('scan-progress', (e, progress) => {
      console.log(`扫描中: ${progress.currentDir}, 已找到: ${progress.totalFound}`);
    });

    // 扫描完成
    window.ipcRenderer.on('scan-complete', (e, progress) => {
      console.log(`扫描完成: ${progress.currentDir}, 已找到: ${progress.totalFound}`);
    });

    // 开始扫描
    console.log('后缀', toRaw(scanSuffixList.value))
    const musicFiles = await window.ipcRenderer.handlePromise('start-scan', {
      startPath,
      extensions: toRaw(scanSuffixList.value),
    });
    console.log('扫描完成，找到音乐文件:', musicFiles.length);

    // 移除监听
    // removeProgressListener();
  } catch (error) {
    console.error('扫描失败:', error);
  }
}

const stopScan = () => {
  window.ipcRenderer.handlePromise('cancel-scan', {}).then(res => {
    console.log('取消扫描:', res);
  }).catch(err => {
    console.log('取消扫描失败:', err);
  })
}

const copyType = ref('include');
const copyInclude = ref('');
const copyIncludeList = ref<string[]>([]);
function selectCopyInclude() {
  // 去除首尾空格
  copyInclude.value = copyInclude.value.trim();
  if (copyInclude.value) {
    copyIncludeList.value.push(copyInclude.value);
    copyInclude.value = '';
  }
}
function removeCopyInclude(item: string) {
  copyIncludeList.value = copyIncludeList.value.filter((val) => val !== item);
}
const copyExclude = ref('');
const copyExcludeList = ref<string[]>([]);
function selectCopyExclude() {
  // 去除首尾空格
  copyExclude.value = copyExclude.value.trim();
  if (copyExclude.value) {
    copyExcludeList.value.push(copyExclude.value);
    copyExclude.value = '';
  }
}
function removeCopyExclude(item: string) {
  copyExcludeList.value = copyExcludeList.value.filter((val) => val !== item);
}

const copyTypeSuffix = ref('include')
const copyIncludeSuffix = ref('');
const copyIncludeSuffixList = ref<string[]>([]);

function selectCopyIncludeSuffix() {
  // 去除首尾空格
  copyIncludeSuffix.value = copyIncludeSuffix.value.trim();
  if (copyIncludeSuffix.value) {
    copyIncludeSuffixList.value.push(copyIncludeSuffix.value);
    copyIncludeSuffix.value = '';
  }
}
function removeCopyIncludeSuffix(item: string) {
  copyIncludeSuffixList.value = copyIncludeSuffixList.value.filter((val) => val !== item);
}

const copyExcludeSuffix = ref('');
const copyExcludeSuffixList = ref<string[]>([]);
function selectCopyExcludeSuffix() {
  // 去除首尾空格
  copyExcludeSuffix.value = copyExcludeSuffix.value.trim();
  if (copyExcludeSuffix.value) {
    copyExcludeSuffixList.value.push(copyExcludeSuffix.value);
    copyExcludeSuffix.value = '';
  }
}
function removeCopyExcludeSuffix(item: string) {
  copyExcludeSuffixList.value = copyExcludeSuffixList.value.filter((val) => val !== item);
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
  console.log(pathArr, 'pathArr');
  const copyArgs = {
    source: copyOrigin.value,
    target: fileCachePathCc.value + '/' +
      pathArr[pathArr.length - 1],
    ignore: toRaw(copyExcludeList.value),
    include: toRaw(copyIncludeList.value),
    includeSuffix: toRaw(copyIncludeSuffixList.value),
    ignoreSuffix: toRaw(copyExcludeSuffixList.value),
  }
  console.log(copyArgs, 'copyArgs');
  errFlag.value = true;
  send('copy-folder', copyArgs);
}

function updateDataFn(data: any, data2: any) {
  console.log(data, data2, 'data');
}
onMounted(() => {
  window.ipcRenderer.on('copy-folder', (event: any, res: any) => {
    console.log(res, 'res');
    if (!errFlag.value) {
      return;
    }
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
  })
})

</script>

<style scoped lang="scss">
.fileRela-form {
  padding: 24px;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
}

.setting-title {
  padding-left: 3px;
  border-bottom: 6px solid #6d6d6d;
  width: 100%;
  font-weight: 600;
}

.cur-status {
  &-work {
    &::before {
      content: '•';
      color: #00ffbf;
      display: inline-block;
    }

    &::rest {
      content: '•';
      color: #ff0303;
      display: inline-block;
    }
  }
}

.setting-form {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  background-color: #ffffff;
}

// 主页模式
:deep(.mode-wrapper) {
  .el-form-item__content {
    flex-direction: column;
    align-items: flex-start;
  }
}

.mode-ops {
  width: 100%;

  .mode-item {
    display: flex;
    margin-bottom: 10px;
  }

  .mode-label {
    width: 150px;
  }
}

:deep(.file-move) {
  .el-form-item__content {
    .el-form-item {
      margin-top: 10px;

      .el-form-item__label {
        height: unset;
        line-height: 1.2em;
        display: flex;
        align-items: center;
      }
    }
  }
}
</style>
