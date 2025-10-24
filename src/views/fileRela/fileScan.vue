<template>
  <el-form class="" label-width="108" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">文件扫描</div>
      </template>
    </el-form-item>
    <!-- 文件夹复制测试 -->
    <el-form-item label="扫描位置" class="mode-wrapper file-move">
      <el-input spellcheck="false" v-model="scanPath" placeholder="请选择" style="width: 100%" disabled :title="scanPath">
        <template #append>
          <el-button @click="selectScanPath">
            选择目录
          </el-button>
        </template>
      </el-input>
    </el-form-item>
    <!-- 扫描后缀 -->
    <el-form-item label="扫描后缀包含" class="mode-wrapper file-move">
      <el-input spellcheck="false" v-model="scanSuffix" placeholder="请输入: png、jpeg、mp4、doc..." style="width: 100%"
        @keyup.enter="selectScanSuffix">
        <template #append>
          <el-button @click="selectScanSuffix">
            添加
          </el-button>
        </template>
      </el-input>
      <!-- 后缀包含的列表 -->
      <div class="copy-include-list">
        <el-tag v-for="(item, index) in scanSuffixList" :key="index" closable @close="removeScanSuffix(item)">
          {{ item }}
        </el-tag>
      </div>
    </el-form-item>
    
    <!-- 扫描选项 -->
    <el-form-item label="扫描选项" class="mode-wrapper file-move">
      <el-form-item label="扫描深度" class="mode-wrapper file-move">
        <el-input spellcheck="false" v-model="scanOptions.deep" type="number" placeholder="0表示无限层级" />
      </el-form-item>
      <el-form-item label="大小写敏感" class="mode-wrapper file-move">
        <el-switch
          v-model="scanOptions.caseSensitiveMatch"
          inline-prompt
          :active-icon="Check"
          :inactive-icon="Close"
        />
      </el-form-item>
      <el-form-item label="只包含目录" class="mode-wrapper file-move">
        <el-switch
          v-model="scanOptions.onlyDirectories"
          inline-prompt
          :active-icon="Check"
          :inactive-icon="Close"
        />
      </el-form-item>
      <el-form-item label="只包含文件" class="mode-wrapper file-move">
        <el-switch
          v-model="scanOptions.onlyFiles"
          inline-prompt
          :active-icon="Check"
          :inactive-icon="Close"
        />
      </el-form-item>
    </el-form-item>

    <el-form-item>
      <el-button @click="startScan" type="primary">
        开始扫描
      </el-button>
    </el-form-item>
  </el-form>

  <!-- 写一个扫描结果弹窗，弹窗内容为扫描到的文件列表 -->
  <el-dialog v-model="scanResultVisible" title="扫描结果" v-loading="scanLoading">
    <!-- 扫描时间间隔 -->
    <div class="scan-handle">
      <div>扫描时间间隔: {{ scanTimeGap }}，共计{{ scanResultFiles.length }}个结果</div>
      <el-button type="primary" :disabled="scanResultFiles.length == 0"
        @click="saveToDB(scanResultFiles)">保存数据</el-button>
    </div>
    <!-- 用虚拟化表格el-table-v2展示结果 -->
    <div class="scan-table" ref="scanTableRef">
      <el-table-v2 :columns="columns" :data="scanResultFiles" :width="scanColWidth" :height="400" />
    </div>
  </el-dialog>

  <!-- 展示资源内容 -->
  <el-dialog v-if="showResVisible" v-model="showResVisible" title="资源展示" @before-close="beforeCloseShowRes">
    <div class="show-res">
      <div class="show-res-arrow show-res-prev" @click="lookResPrev">
        <el-icon><ArrowLeftBold /></el-icon>
      </div>
      <!-- 如果是图片资源 -->
      <div v-if="!curRes || !curRes.name"></div>
      <el-image v-else-if="curType(curRes) == 'image'" :src="fileProtocol + encodeURIComponent(curRes.path)">
        <template #error>
          <div>图片加载失败</div>
          <div>{{ curRes.name }}</div>
        </template>
      </el-image>
      <!-- 视频
      <video v-else-if="curType(curRes) == 'video'" :src="fileProtocol + encodeURIComponent(curRes.path)" controls width="100%">
        您的浏览器不支持video标签
      </video>
      <div class="show-res-arrow show-res-next" @click="lookResNext">
        <el-icon><ArrowRightBold /></el-icon>
      </div> -->
      <div v-else>
        <div>
          {{ JSON.stringify(props.defaultAppPaths, null, 2) }}
        </div>
        <div>文件类型暂不支持展示</div>
        <div>文件名：{{ curRes.name }}</div>
        <div>文件类型：{{ curRes.ext }}</div>
        <div>文件路径：{{ curRes.path }}</div>
        <div>
          <el-button type="primary" @click="openFile(curRes)">打开文件</el-button>
        </div>
      </div>
    </div>
  </el-dialog>

</template>

<script setup lang="tsx">
import { ref, reactive, watch, computed, toRaw, onMounted, unref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import UploadVue from '@/components/upload.vue';
import useCacheSetStore from '@/store/useCacheSet'
import { send, sendSync } from '@/utils/common';
import { ElButton, ElTag, ElMessage, ElRow } from 'element-plus';
import type { Column, RowClassNameGetter } from 'element-plus'
import { ArrowLeftBold, ArrowRightBold, Check, Close } from '@element-plus/icons-vue'
import { fileProtocol } from '@/var';

const props = defineProps({
  defaultAppPaths: {
    type: Object,
    default: () => {},
  }
})

const { fileCachePathC } = storeToRefs(useCacheSetStore());

const fileCachePathCc = ref(fileCachePathC.value);

watch(() => fileCachePathC.value, (newVal) => {
  fileCachePathCc.value = newVal;
})

const columns = ref<Column<any>[]>([
  {
    key: 'name',
    title: '文件路径',
    dataKey: 'name',
    width: 600,
  },
  {
    key: 'operations',
    title: '操作',
    cellRenderer: (cellData) => (
      <ElRow>
        <ElButton size="small" onClick={() => lookRes(cellData)}>查看</ElButton>
      </ElRow>
    ),
    width: 150,
    align: 'center',
  },
])

// 扫描结果弹窗
const scanOptions = ref({
  deep: 0,
  onlyDirectories: false,
  onlyFiles: true,
  caseSensitiveMatch: true,
})
const scanResultVisible = ref(false);
const scanResultFiles = ref<ObjectType[]>([]);
const scanLoading = ref(false);
// 扫描时间间隔
const scanStartTime = ref();
const scanTimeGap = ref('');
const scanTableRef = ref();
const scanColWidth = computed(() => {
  return scanTableRef.value?.clientWidth || 600;
})

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
    // 开始扫描
    console.log('后缀', toRaw(scanSuffixList.value))
    scanLoading.value = true;
    scanResultVisible.value = true;
    scanStartTime.value = Date.now();
    scanResultFiles.value = []
    scanTimeGap.value = ''

    window.ipcRenderer.send('start-scan', {
      startPath,
      extensions: toRaw(scanSuffixList.value),
      options: toRaw(scanOptions.value),
    })
  } catch (error) {
    console.error('扫描失败:', error);
  }
}

window.ipcRenderer.on('start-scan', (event, files) => {
  console.log('扫描元数据', files)
  scanResultFiles.value = files
  console.log(scanResultFiles.value, 'scanResultFiles.value')
  scanLoading.value = false;
  const timeGap = Date.now() - scanStartTime.value;
  // 格式化时间间隔: 时分秒
  // 格式化时间间隔: 时分秒
  const h = Math.floor(timeGap / 1000 / 60 / 60);
  const m = Math.floor(timeGap / 1000 / 60 % 60);
  const s = Math.floor(timeGap / 1000 % 60);
  scanTimeGap.value = `${h ? h + '时' : ''}${m ? m + '分' : ''}${s ? s + '秒' : ''}` || '1秒内';
})

let tableName = ref('sys_search_file')
function saveToDB(data: any[]) {
  window.ipcRenderer.handlePromise('userDb:set-data', {
    tableName: tableName.value,
    data: toRaw(data),
    config: {
    }
  }).then(result => {
    if (result.success) {
      console.log('设置成功:', result.data);
      ElMessage.success('搜索结果保存成功')
    } else {
      console.log('设置失败:', result.error);
    }
  })
}

const showResVisible = ref(false)
const curRes = ref<ObjectType>({
  name: ''
})

const curType = (obj: ObjectType) => {
  // 如果obj.name包含图片类型，返回 'image'
  const imageType = ['.jpg', '.png', '.jpeg', '.gif']
  const isImage = imageType.some(type => obj.name.includes(type))
  if (isImage) return 'image'

  // 如果是视频类型, 返回 video
  const videoType = ['.mp4']
  const isVideo = videoType.some(type => obj.name.includes(type))
  if (isVideo) return 'video'
}

const lookRes = (data: ObjectType) => {
  console.log(data, 'data')
  curRes.value = {
    ...data,
    ...data.rowData,
  }
  showResVisible.value = true
}

const lookResPrev = () => {
  const isLastIndex = 0 == curRes.value.rowIndex
  if (isLastIndex) {
    lookRes({
      ...scanResultFiles.value[scanResultFiles.value.length - 1],
      rowIndex: scanResultFiles.value.length - 1,
    })
  } else {
    lookRes({
      ...scanResultFiles.value[curRes.value.rowIndex - 1],
      rowIndex: curRes.value.rowIndex - 1
    })
  }
}

const lookResNext = () => {
  const isLastIndex = scanResultFiles.value.length == curRes.value.rowIndex
  if (isLastIndex) {
    lookRes({
      ...scanResultFiles.value[0],
      rowIndex: 0,
    })
  } else {
    lookRes({
      ...scanResultFiles.value[curRes.value.rowIndex + 1],
      rowIndex: curRes.value.rowIndex + 1
    })
  }
}

const beforeCloseShowRes = () => {
  showResVisible.value = false
}

const openFile = (obj: ObjectType) => {
  const ext = obj.name.split('.').pop() || ''
  window.ipcRenderer.handlePromise('open-file-by-default-app', {
    filePath: obj.path,
    defaultAppPath: props.defaultAppPaths[`.${ext}`]?.path || '',
  }).then(res => {
    console.log(res, `打开文件${obj.path}`)
  })
}

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

.copy-include-list {
  display: flex;
  padding-top: 6px;
  gap: 6px;
}

.scan-handle {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.show-res {
  position: relative;
  height: 600px;
  .el-image {
    position: absolute;
    top: 50%;
    transform: translate(0, -50%);
  }
  video {
    height: 100%;
  }
  &-arrow {
    position: absolute;
    top: 50%;
    transform: translate(0, -50%);
    width: 36px;
    height: 100px;
    display: flex;
    align-items: center;
    padding: 3px;
    box-sizing: border-box;
    z-index: 1;
    cursor: pointer;
  }
  &-prev {
    left: 0;
  }
  &-next {
    right: 0;
  }
}


</style>
