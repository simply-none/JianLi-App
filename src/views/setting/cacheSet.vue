<template>
  <el-form class="setting-home-mode-form" label-width="108" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">缓存设置</div>
      </template>
    </el-form-item>
    <el-form-item label="文件存放目录" class="mode-wrapper">
      <el-input v-model="fileCachePathCc" placeholder="请选择" style="width: 100%" disabled :title="fileCachePathCc">
        <template #append>
          <el-button @click="selectFileDir">
            选择目录
          </el-button>
        </template>
      </el-input>
    </el-form-item>
  </el-form>

</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, toRaw, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import UploadVue from '@/components/upload.vue';
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

</script>

<style scoped lang="scss">
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
