<!-- vue3 setup 模板 -->
<template>
  <div class="com-upload">
    <el-upload class="upload-demo" :auto-upload="false" :multiple="false" :limit="1" v-model:file-list="fileList"
      :on-success="handleAvatarSuccess" :before-upload="beforeAvatarUpload" :show-file-list="true"
      :on-exceed="handleExceed" :on-change="handleChange">
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
      <div class="el-upload__tip" slot="tip">只能上传jpg/png文件，且不超过500kb</div>
    </el-upload>

    <div>
      <el-button @click="save">保存</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { UploadFile } from 'element-plus'
import useCacheSetStore from '@/store/useCacheSet'
import { storeToRefs } from 'pinia';
import { sendSync } from '@/utils/common';

const { fileCachePathC } = storeToRefs(useCacheSetStore())

const fileList = ref<UploadFile[]>([]);

function handleAvatarSuccess(res: any, file: any) {
  console.log(res, file);
}

function beforeAvatarUpload(file: any) {
  console.log(file);
  return true;
}

function handleChange(file: any, list: any) {
  if (list.length > 1) {
    fileList.value = list.slice(0, 1);
    console.log(file, list);
  }
}

function handleExceed(files: any, fileList: any) {
  ElMessage.error(`当前限制选择 1 个文件，本次选择了 ${files.length} 个文件，共选择了 ${fileList.length} 个文件`);
}

function readerFile(file: any , filePath: any, chunkLength: number, curentChunk: number) {
  let reader = new FileReader();

  reader.onload = function (e: any) {
    const res = reader.result
    console.log(res,'res')

    // 获取res的类型 使用toString.call
    const type = Object.prototype.toString.call(res)
    console.log(type,'type')


    const val = sendSync('save-file', {
      filePath: filePath,
      content: res,
      chunkLength,
      curentChunk,
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
  let start = 0;
  let end = 1024 * 1024 * 200; // 500MB
  let chunkSize = 1024 * 1024 * 200; // 500MB
  if (size < 300 * 1024 * 1024) {
    end = Math.floor(size / 10)
    chunkSize = Math.floor(size / 10)
  }

  // 计算chunk的数量
  let chunkCount = Math.ceil(size / chunkSize);

  // while (start < size) {
  //   let chunk = file.slice(start, end);
  //   readerFile(chunk, filePath + start, chunkCount, start);
  //   start += chunkSize;
  //   end += chunkSize;
  // }
  // 上面的while循环改成for循环
  for (let i = 0; i < chunkCount; i++) {
    let chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
    readerFile(chunk, filePath + '.temp.' + i * chunkSize, chunkCount, i);
  }

}

</script>

<style lang="scss" scoped></style>