<template>
  <el-form class="fileRela-form" label-width="108" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">应用缓存</div>
      </template>
    </el-form-item>

    <el-form-item label="数据还原" class="mode-wrapper">
      <UploadVue :limit="1" @updateData="handleChange">
        <template #btnHandle>
          <div></div>
        </template>
      </UploadVue>
    </el-form-item>
    <el-form-item v-if="Object.keys(uploadCacheData).length > 0" label="待还原数据" class="mode-wrapper">
      <div class="cache-list" title="Vertical list with border" direction="vertical" :column="4" :size="''" border>
        <div v-for="(item, key, index) in uploadCacheData" class="cache-item-wrapper">
          <div class="cache-key">{{ key }}</div>
          <!-- 如果是Array -->
          <div class="cache-item level-2" v-if="Array.isArray(item)">
            <div v-for="(item2, key2) in item" class="cache-item level-3">
              <div class="cache-item level-4">{{ key2 + 1 }}: {{ item2 }}</div>
            </div>
          </div>
          <!-- 如果是Object -->
          <div v-else-if="typeof item === 'object'" class="cache-item level-2">
            <div v-for="(item2, key2) in item" class="cache-item level-3">
              <div class="cache-key">{{ key2 }}</div>
              <div class="cache-item level-4">{{ item2 }}</div>
            </div>
          </div>
          <!-- 如果是String -->
          <div v-else class="cache-item  level-2">
            <div class="cache-item level-3">{{ item }}</div>
          </div>
        </div>
        <el-button type="primary" @click="restore">备份还原</el-button>

      </div>
    </el-form-item>
    <el-form-item label="数据备份" class="mode-wrapper">
      <el-button type="primary" @click="generateRestore">开始备份</el-button>
    </el-form-item>
    <el-form-item label="当前缓存数据" class="mode-wrapper">
      <div class="cache-list" title="Vertical list with border" direction="vertical" :column="4" :size="''" border>
        <div v-for="(item, key, index) in cacheData" class="cache-item-wrapper">
          <div class="cache-key">{{ key }}</div>
          <!-- 如果是Array -->
          <div class="cache-item level-2" v-if="Array.isArray(item)">
            <div v-for="(item2, key2) in item" class="cache-item level-3">
              <div class="cache-item level-4">{{ key2 + 1 }}: {{ item2 }}</div>
            </div>
          </div>
          <!-- 如果是Object -->
          <div v-else-if="typeof item === 'object'" class="cache-item level-2">
            <div v-for="(item2, key2) in item" class="cache-item level-3">
              <div class="cache-key">{{ key2 }}</div>
              <div class="cache-item level-4">{{ item2 }}</div>
            </div>
          </div>
          <!-- 如果是String -->
          <div v-else class="cache-item  level-2">
            <div class="cache-item level-3">{{ item }}</div>
          </div>
        </div>
      </div>
    </el-form-item>
  </el-form>

</template>

<script setup lang="ts">
import { h, ref, reactive, watch, computed, toRaw, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox } from 'element-plus';
import useCacheSetStore from '@/store/useCacheSet'
import { send, sendSync } from '@/utils/common';
import moment from 'moment';
import UploadVue from '@/components/upload.vue';
import { open } from '@/utils/confirmDialog'

const { fileCachePathC } = storeToRefs(useCacheSetStore());
const cacheData = ref<ObjectType>({})
const uploadCacheData = ref<ObjectType>({})
getCacheData()

function getCacheData() {
  const res = sendSync('get-stort-all', '')
  console.log(res, 'res res');
  cacheData.value = res
}

function generateRestore() {
  const data = toRaw(cacheData.value)
  const path = fileCachePathC.value + '/渐离App数据备份_' + moment().format('YYYY-MM-DD_HH-mm-ss') + '.json'
  const res = sendSync('export-data-to-json', {
    path,
    data
  })
  console.log(res, 'res res');
  if (res == 'ok') {
    const msg = ElMessage({
      duration: 0,
      showClose: true,
      message: h('p', { style: 'line-height: 1; font-size: 14px' }, [
        h('div', {
          style: 'font-size: 16px;font-weight: 600;',
        }, '备份成功'),
        h('div', {
          style: 'padding-top: 12px;',
        }, {
          default: () => '备份路径:' + path
        }),
        h('div', {
          style: 'color: #409eff;padding: 12px 0;cursor: pointer;',
          onClick: () => {
            console.log('VNode clicked', msg);
            send('open-file-in-assets-manager', {
              path: path
            })
            msg.close()
          },
        }, '点击打开'),
      ]),
    })
  } else {
    ElMessage.error('备份失败')
  }
}

function handleChange(uploadRef: any, fileList: any) {
  console.log(uploadRef, fileList, 'fileList fileList');
  // 解析file，获取文件数据
  const file = fileList[0].raw as unknown as any
  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = function (e: any) {
    const res = reader.result as string
    console.log(res, 'res')
    uploadCacheData.value = JSON.parse(res || '') || {}
  };
}

function restore() {
  open(
    '确认还原数据吗？',
    15,
    restoreData,
  )
}

function restoreData() {
  console.log('restore');
  const data = toRaw(uploadCacheData.value)
  const length = Object.keys(data).length
  if (length <= 0) {
    ElMessage.error('请选择备份文件')
    return
  }
  console.log(data, 'data');
  const res = sendSync('replace-store', data)
  console.log(res, 'res')
  ElMessage.success('还原成功')
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

.setting-form {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  background-color: #ffffff;
}

.cache-list {
  word-break: break-all;
}

.cache-item-wrapper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;

  &+& {
    padding-top: 12px;
    padding-bottom: 12px;
    border-top: 2px solid #e8e8e8
  }

  .cache-key {
    width: 120px;
    font-weight: 600;
    line-height: 1;
    word-break: break-all;
  }

  .cache-item {
    color: #828282;
    flex: 1;

  }
  .level-2 {
    word-break: break-all;
  }

  .level-3 {
    display: flex;
    align-items: center;

    .cache-key {
      width: unset;
      padding-right: 24px;
    }
  }
  .level-4 {
    word-break: break-all;
  }
}
</style>
