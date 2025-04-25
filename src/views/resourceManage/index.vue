<template>
  <el-form class="fileRela-form" label-width="108" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">资源管理</div>
      </template>
    </el-form-item>

    <el-form-item label="图片" class="mode-wrapper">
      <UploadVue :limit="1" @updateData="handleChange">
      </UploadVue>
    </el-form-item>
    <!-- 展示图片 -->
    <el-form-item label="图片" class="mode-wrapper">
      <div class="mode-ops">
        <div class="mode-item" v-for="img in imageResourceCc">
          <div v-if="img.val" class="mode-label">{{ img.origin }}</div>
          <el-image v-if="img.val" style="width: 100px; height: 100px" :src="fileProtocol + img.val"
            :preview-src-list="computedRes" fit="cover">
            <template #progress="{ activeIndex, total }">
              <div class="rm-img">
                <div>{{ activeIndex + 1 + '-' + total }}</div>
                <div>{{ imageResourceCc[activeIndex].origin }}</div>
              </div>
            </template>
          </el-image>
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
import useResourceManage from '@/store/useResourceManage';
import { send, sendSync } from '@/utils/common';
import moment from 'moment';
import UploadVue from '@/components/upload.vue';
import { open } from '@/utils/confirmDialog'
import { fileProtocol } from '@/var';

const { imageResourceC } = storeToRefs(useResourceManage())
const imageResourceCc = ref(JSON.parse(JSON.stringify(imageResourceC.value || [])))
console.log(imageResourceCc.value, 'imageResourceCc', imageResourceC.value)
watch(() => imageResourceC.value, (n) => {
  imageResourceCc.value = JSON.parse(JSON.stringify(n || []))
  console.log(imageResourceCc.value, 'imageResourceCc', imageResourceC.value)
}, {
  immediate: true,
  deep: true,
})

const { fileCachePathC } = storeToRefs(useCacheSetStore());

const computedRes = computed(() => {
  return imageResourceCc.value.filter((item: ObjectType) => {
    return item.val;
  }).map((item: ObjectType) => {
    return fileProtocol + item.val;
  })
})

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

.rm-img {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
