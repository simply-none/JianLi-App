<template>
  <el-form class="fileRela-form" label-width="108" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">资源管理</div>
      </template>
    </el-form-item>

    <el-form-item label="图片" class="mode-wrapper">
      <UploadVue :limit="1" @updateData="handleChange">
        <template #btnHandle>
          <div></div>
        </template>
      </UploadVue>
    </el-form-item>
    <!-- 展示图片 -->
    <el-form-item label="图片" class="mode-wrapper">
      <div class="mode-ops">
        <div class="mode-item">
          <div class="mode-label">图片路径</div>
          <div class="mode-value">{{ fileCachePathC }}</div>
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

function handleChange(data: any) {
  console.log(data, 'data'); 
}


</script>

<style scoped lang="scss">
.fileRela-form {
  padding: 24px;
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
