<!-- vue3 setup 模板 -->
<template>
  <div class="com-upload">
    <el-upload class="upload-demo" :auto-upload="false" :multiple="props.multiply" :limit="props.limit" ref="uploadRef"
      v-model:file-list="fileList" :on-success="handleAvatarSuccess" :before-upload="beforeAvatarUpload"
      :show-file-list="true" :on-exceed="handleExceed" :on-change="handleChange">
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
      <div class="el-upload__tip" slot="tip">只能上传jpg/png文件，且不超过500kb</div>
    </el-upload>

    <slot name="btnHandle">
      <div>
        <el-button @click="save">保存</el-button>
      </div>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage, genFileId } from 'element-plus';
import type { UploadFile } from 'element-plus'
import useCacheSetStore from '@/store/useCacheSet'
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
})
const emit = defineEmits(['updateData'])

const { fileCachePathC } = storeToRefs(useCacheSetStore())

const uploadRef = ref();
const fileList = ref<UploadFile[]>([]);
watch(() => fileList.value, (n) => {
  emit('updateData', uploadRef.value, n)
})

function handleAvatarSuccess(res: any, file: any) {
  console.log(res, file);
}

function beforeAvatarUpload(file: any) {
  console.log(file);
  return true;
}

function handleChange(file: any, list: any) {
  console.log(file, list, 'list list');

}

// 超出limit时，触发的函数
function handleExceed(file: any, list: any) {
  console.log(file, list, props.limit == 1);
  if (props.limit == 1) {
    // fileList.value = list[list.length - 1]
    // 覆盖
    uploadRef.value.clearFiles()
    const fileO = file[0]
    fileO.uid = genFileId()
    uploadRef.value!.handleStart(fileO)
    console.log(fileO, 'fileO')
    console.log(file, list);
    return true
  }
  if (list.length > props.limit) {
    // fileList.value = list.slice(0, props.limit)
    // 提示
    ElMessage.error(`当前限制选择 ${props.limit} 个文件，本次选择了 ${file.length} 个文件，共选择了 ${list.length} 个文件`);
    console.log(file, list);
  }
}

function readerFile({
  file,
  chunkLength,
  curentChunk,
  path,
  name,
  tempSplit,
}: {
  file: any, chunkLength: number, curentChunk: number,
  path: string, name: string, tempSplit: string,
}) {
  let reader = new FileReader();

  reader.onload = function (e: any) {
    const res = reader.result
    console.log(res, 'res')

    // 获取res的类型 使用toString.call
    const type = Object.prototype.toString.call(res)
    console.log(type, 'type')

    const val = sendSync('save-file', {
      content: res,
      chunkLength,
      path,
      name,
      tempSplit,
      currentChunkIndex: curentChunk,
    })

    console.log(val, 'val')

  };
  reader.readAsArrayBuffer(file);
}

function save() {
  const filePath = fileCachePathC.value + '/' + fileList.value[0].name
  console.log(filePath, 'filePath')

  const file = fileList.value[0].raw as unknown as any
  const size = file.size

  // 循环遍历size，并切割file
  let chunkSize = 1024 * 1024 * 200; // 500MB
  if (size < 300 * 1024 * 1024) {
    chunkSize = Math.floor(size / 5)
  }

  // 计算chunk的数量
  let chunkCount = Math.ceil(size / chunkSize);

  for (let i = 0; i < chunkCount; i++) {
    let chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
    readerFile({
      file: chunk,
      path: fileCachePathC.value + '/',
      name: fileList.value[0].name,
      tempSplit: '.temp.',
      chunkLength: chunkCount,
      curentChunk: i,
    })
  }

}

</script>

<style lang="scss" scoped></style>