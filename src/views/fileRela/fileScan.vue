<template>
  <div class="file-scan-card">
    <div class="card-header">
      <h3 class="card-title">
        <el-icon><Search /></el-icon>
        文件扫描
      </h3>
    </div>
    
    <div class="card-body">
      <div class="form-item">
        <span class="form-label">扫描位置</span>
        <div class="path-input-wrap">
          <el-input v-model="scanPath" placeholder="请选择目录" disabled :title="scanPath">
            <template #append>
              <el-button @click="selectScanPath">
                <el-icon><Folder /></el-icon>
                选择目录
              </el-button>
            </template>
          </el-input>
        </div>
      </div>
      
      <div class="form-item">
        <span class="form-label">扫描后缀</span>
        <div class="suffix-input-wrap">
          <el-input v-model="scanSuffix" placeholder="如: png、jpeg、mp4" @keyup.enter="selectScanSuffix">
            <template #append>
              <el-button @click="selectScanSuffix">添加</el-button>
            </template>
          </el-input>
        </div>
        <div class="tag-list">
          <el-tag v-for="(item, index) in scanSuffixList" :key="index" closable @close="removeScanSuffix(item)">
            {{ item }}
          </el-tag>
        </div>
      </div>
      
      <div class="options-grid">
        <div class="option-item">
          <span class="option-label">扫描深度</span>
          <el-input v-model="scanOptions.deep" type="number" placeholder="0表示无限层级" class="option-input" />
        </div>
        <div class="option-item">
          <span class="option-label">大小写敏感</span>
          <el-switch v-model="scanOptions.caseSensitiveMatch" />
        </div>
        <div class="option-item">
          <span class="option-label">只包含目录</span>
          <el-switch v-model="scanOptions.onlyDirectories" />
        </div>
        <div class="option-item">
          <span class="option-label">只包含文件</span>
          <el-switch v-model="scanOptions.onlyFiles" />
        </div>
      </div>
      
      <div class="action-row">
        <el-button type="primary" @click="startScan" class="scan-btn">
          <el-icon><Search /></el-icon>
          开始扫描
        </el-button>
      </div>
    </div>
  </div>

  <el-dialog v-model="scanResultVisible" title="扫描结果" width="800px" v-loading="scanLoading">
    <div class="scan-handle">
      <div>扫描耗时: {{ scanTimeGap }}，共计 {{ scanResultFiles.length }} 个结果</div>
      <el-button type="primary" :disabled="scanResultFiles.length === 0" @click="saveToDB(scanResultFiles)">保存数据</el-button>
    </div>
    <div class="scan-table">
      <el-table-v2 :columns="columns" :data="scanResultFiles" :width="scanColWidth" :height="400" />
    </div>
  </el-dialog>

  <el-dialog v-if="showResVisible" v-model="showResVisible" title="资源展示" @before-close="beforeCloseShowRes">
    <div class="show-res">
      <div class="show-res-arrow show-res-prev" @click="lookResPrev">
        <el-icon><ArrowLeft /></el-icon>
      </div>
      <div v-if="!curRes || !curRes.name"></div>
      <el-image v-else-if="curType(curRes) === 'image'" :src="fileProtocol + encodeURIComponent(curRes.path)" class="res-image" />
      <div v-else>
        <div class="res-info">
          <div>文件类型暂不支持展示</div>
          <div>文件名：{{ curRes.name }}</div>
          <div>文件路径：{{ curRes.path }}</div>
          <el-button type="primary" @click="openFile(curRes)">打开文件</el-button>
        </div>
      </div>
      <div class="show-res-arrow show-res-next" @click="lookResNext">
        <el-icon><ArrowRight /></el-icon>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="tsx">
import { ref, computed, toRaw } from 'vue';
import { Search, Folder, ArrowLeft, ArrowRight } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import type { Column } from 'element-plus';
import { sendSync } from '@/utils/common';
import { fileProtocol } from '@/var';

const props = defineProps({
  defaultAppPaths: {
    type: Object,
    default: () => ({})
  }
});

const columns = ref<Column<any>[]>([
  {
    key: 'name',
    title: '文件路径',
    dataKey: 'name',
    width: 600
  },
  {
    key: 'operations',
    title: '操作',
    cellRenderer: (cellData: any) => (
      <el-button size="small" onClick={() => lookRes(cellData)}>查看</el-button>
    ),
    width: 150,
    align: 'center'
  }
]);

const scanOptions = ref({
  deep: 0,
  onlyDirectories: false,
  onlyFiles: true,
  caseSensitiveMatch: true
});

const scanResultVisible = ref(false);
const scanResultFiles = ref<ObjectType[]>([]);
const scanLoading = ref(false);
const scanStartTime = ref(0);
const scanTimeGap = ref('');
const scanTableRef = ref();

const scanColWidth = computed(() => {
  return scanTableRef.value?.clientWidth || 600;
});

const scanPath = ref('');
function selectScanPath() {
  const res = sendSync('get-file-list', 'select-dir');
  scanPath.value = res[0];
}

const scanSuffix = ref('');
const scanSuffixList = ref<string[]>([]);
function selectScanSuffix() {
  scanSuffix.value = scanSuffix.value.trim();
  if (scanSuffix.value) {
    scanSuffixList.value.push(scanSuffix.value);
    scanSuffix.value = '';
  }
}

function removeScanSuffix(item: string) {
  scanSuffixList.value = scanSuffixList.value.filter(val => val !== item);
}

const startScan = async () => {
  const startDefaultPath = 'C:\\';
  const startPath = scanPath.value || startDefaultPath;

  if (scanSuffixList.value.length === 0) {
    ElMessage.error('请添加扫描后缀');
    return;
  }

  try {
    scanLoading.value = true;
    scanResultVisible.value = true;
    scanStartTime.value = Date.now();
    scanResultFiles.value = [];
    scanTimeGap.value = '';

    window.ipcRenderer.send('start-scan', {
      startPath,
      extensions: toRaw(scanSuffixList.value),
      options: toRaw(scanOptions.value)
    });
  } catch (error) {
    console.error('扫描失败:', error);
  }
};

window.ipcRenderer.on('start-scan', (_event: any, files: any[]) => {
  scanResultFiles.value = files;
  scanLoading.value = false;
  const timeGap = Date.now() - scanStartTime.value;
  const h = Math.floor(timeGap / 1000 / 60 / 60);
  const m = Math.floor(timeGap / 1000 / 60 % 60);
  const s = Math.floor(timeGap / 1000 % 60);
  scanTimeGap.value = `${h ? h + '时' : ''}${m ? m + '分' : ''}${s ? s + '秒' : ''}` || '1秒内';
});

function saveToDB(data: any[]) {
  window.ipcRenderer.handlePromise('userDb:set-data', {
    tableName: 'sys_search_file',
    data: toRaw(data),
    config: {}
  }).then(result => {
    if (result.success) {
      ElMessage.success('搜索结果保存成功');
    }
  });
}

const showResVisible = ref(false);
const curRes = ref<ObjectType>({ name: '' });

const curType = (obj: ObjectType) => {
  const imageType = ['.jpg', '.png', '.jpeg', '.gif'];
  return imageType.some(type => obj.name.includes(type)) ? 'image' : '';
};

const lookRes = (data: ObjectType) => {
  curRes.value = { ...data, ...data.rowData };
  showResVisible.value = true;
};

const lookResPrev = () => {
  const index = curRes.value.rowIndex || 0;
  const newIndex = index === 0 ? scanResultFiles.value.length - 1 : index - 1;
  lookRes({ ...scanResultFiles.value[newIndex], rowIndex: newIndex });
};

const lookResNext = () => {
  const index = curRes.value.rowIndex || 0;
  const newIndex = index === scanResultFiles.value.length - 1 ? 0 : index + 1;
  lookRes({ ...scanResultFiles.value[newIndex], rowIndex: newIndex });
};

const beforeCloseShowRes = () => {
  showResVisible.value = false;
};

const openFile = (obj: ObjectType) => {
  const ext = obj.name.split('.').pop() || '';
  window.ipcRenderer.handlePromise('open-file-by-default-app', {
    filePath: obj.path,
    defaultAppPath: props.defaultAppPaths[`.${ext}`]?.path || ''
  });
};
</script>

<style scoped lang="scss">
.file-scan-card {
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

.form-item {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.path-input-wrap,
.suffix-input-wrap {
  width: 100%;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.option-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.option-input {
  width: 120px;
}

.action-row {
  display: flex;
  justify-content: center;
}

.scan-btn {
  padding: 10px 32px;
}

.scan-handle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.scan-table {
  width: 100%;
}

.show-res {
  position: relative;
  height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.res-image {
  max-width: 100%;
  max-height: 500px;
}

.res-info {
  text-align: center;
  padding: 20px;
}

.show-res-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  cursor: pointer;
  border-radius: 50%;
  z-index: 1;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }
}

.show-res-prev {
  left: 10px;
}

.show-res-next {
  right: 10px;
}
</style>