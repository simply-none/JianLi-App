<!-- vue3 setup 模板 -->
<template>
  <div class="com-upload">
    <el-upload 
      class="upload-demo" 
      :auto-upload="false" 
      :multiple="props.multiply" 
      :limit="props.limit" 
      ref="uploadRef"
      v-model:file-list="fileList" 
      :on-success="handleAvatarSuccess" 
      :before-upload="beforeAvatarUpload"
      :show-file-list="true" 
      :on-exceed="handleExceed" 
      :on-change="handleChange"
      :on-remove="handleRemove"
      :disabled="uploading"
    >
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
      <div class="el-upload__tip" slot="tip">支持上传图片、文本、视频、音频及其他文件格式</div>
    </el-upload>

    <slot name="btnHandle" v-if="!props.autoSave">
      <div class="upload-actions">
        <el-button 
          type="primary" 
          :disabled="!canSave || uploading"
          :loading="uploading"
          @click="save"
        >
          {{ uploading ? '上传中...' : '保存' }}
        </el-button>
        <el-button 
          v-if="fileList.length > 0" 
          :disabled="uploading"
          @click="clearFiles"
        >
          清空
        </el-button>
      </div>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage, genFileId } from 'element-plus';
import type { UploadFile } from 'element-plus'
import useCacheSetStore from '@/store/useCacheSet'
import useResourceManage from '@/store/useResourceManage';
import { storeToRefs } from 'pinia';
import { sendSync } from '@/utils/common';

const props = defineProps({
  limit: {
    type: Number,
    default: 20,
  },
  multiply: {
    type: Boolean,
    default: false,
  },
  autoSave: {
    type: Boolean,
    default: false,
  }
})

const emit = defineEmits(['updateData', 'getFilePath', 'uploadSuccess', 'uploadError'])

const { imageResourceC } = storeToRefs(useResourceManage())
const { setImageResource } = useResourceManage()
const { fileCachePathC } = storeToRefs(useCacheSetStore())

const uploadRef = ref();
const fileList = ref<UploadFile[]>([]);
const uploading = ref(false);
const uploadedCount = ref(0);

const canSave = computed(() => {
  return fileList.value.length > 0 && fileList.value.every(f => f.raw);
});

watch(() => fileList.value, (n) => {
  emit('updateData', uploadRef.value, n)
  if (props.autoSave && canSave.value) {
    save() 
  }
}, { deep: true })

function handleAvatarSuccess(res: any, file: any) {
  console.log(res, file);
}

function beforeAvatarUpload(file: any) {
  const isLt500M = file.size / 1024 / 1024 < 500;
  if (!isLt500M) {
    ElMessage.error('单个文件大小不能超过500MB!');
    return false;
  }
  return true;
}

function handleChange(file: any, list: any) {
  console.log(file, list, 'list list');
}

function handleRemove(file: UploadFile, list: UploadFile[]) {
  console.log('Removed file:', file.name);
  fileList.value = list;
  emit('updateData', uploadRef.value, list);
}

function handleExceed(files: any[], list: UploadFile[]) {
  console.log(files, list, props.limit == 1);
  if (props.limit == 1) {
    uploadRef.value.clearFiles()
    const fileO = files[0]
    fileO.uid = genFileId()
    uploadRef.value!.handleStart(fileO)
    return true
  }
  const exceedCount = list.length - props.limit;
  if (exceedCount > 0) {
    ElMessage.error(`当前限制选择 ${props.limit} 个文件，超出了 ${exceedCount} 个文件`);
  }
}

function readerFile({
  file,
  chunkLength,
  curentChunk,
  path,
  name,
  tempSplit,
  onProgress,
}: {
  file: any, chunkLength: number, curentChunk: number,
  path: string, name: string, tempSplit: string,
  onProgress?: (current: number, total: number) => void,
}) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();

    reader.onload = function (e: any) {
      const res = reader.result;

      const val = sendSync('save-file', {
        content: res,
        chunkLength,
        path,
        name,
        tempSplit,
        currentChunkIndex: curentChunk,
      })

      if (!(val || '').includes('error')) {
        resolve(val);
      } else {
        reject(val);
      }
    };

    reader.onerror = function () {
      reject('文件读取失败');
    };

    reader.readAsArrayBuffer(file);
  });
}

async function saveFile(file: UploadFile) {
  if (!file.raw) {
    ElMessage.warning('文件对象无效');
    return false;
  }

  const rawFile = file.raw as unknown as File;
  const size = rawFile.size;

  if (!fileCachePathC.value) {
    ElMessage.error('未设置文件缓存路径');
    return false;
  }

  let chunkSize = 1024 * 1024 * 200;
  if (size < 300 * 1024 * 1024) {
    chunkSize = Math.floor(size / 5) || 1024 * 1024;
  }

  let chunkCount = Math.ceil(size / chunkSize);
  let lastResult: string | null = null;

  try {
    for (let i = 0; i < chunkCount; i++) {
      let chunk = rawFile.slice(i * chunkSize, (i + 1) * chunkSize);
      const result = await readerFile({
        file: chunk,
        path: fileCachePathC.value + '/',
        name: file.name,
        tempSplit: '.temp.',
        chunkLength: chunkCount,
        curentChunk: i,
      });
      lastResult = result as string;
    }

    if (lastResult) {
      emit('getFilePath', lastResult);
      setImageResource({
        val: lastResult,
        name: lastResult,
        origin: file.name || lastResult,
      });
      ElMessage.success(`文件 "${file.name}" 上传成功`);
      return true;
    } else {
      throw new Error('文件保存结果为空');
    }
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : '文件上传失败';
    ElMessage.error(`文件 "${file.name}" 上传失败: ${errorMsg}`);
    emit('uploadError', { file, error });
    return false;
  }
}

async function save() {
  if (!canSave.value) {
    ElMessage.warning('没有可上传的文件');
    return;
  }

  if (!fileCachePathC.value) {
    ElMessage.error('请先设置文件缓存路径');
    return;
  }

  uploading.value = true;
  uploadedCount.value = 0;

  try {
    for (const file of fileList.value) {
      if (!file.raw) continue;
      const success = await saveFile(file);
      if (success) {
        uploadedCount.value++;
        clearFiles()
      }
    }

    if (uploadedCount.value > 0) {
      emit('uploadSuccess', { count: uploadedCount.value, total: fileList.value.length });
    }
  } finally {
    uploading.value = false;
  }
}

function clearFiles() {
  if (uploading.value) {
    ElMessage.warning('正在上传中，无法清空');
    return;
  }
  uploadRef.value?.clearFiles();
  fileList.value = [];
  uploadedCount.value = 0;
  emit('updateData', uploadRef.value, []);
}
</script>

<style lang="scss" scoped>
.upload-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
</style>
