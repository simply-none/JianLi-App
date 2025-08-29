<template>
  <layout-vue isPadding>
    <template #main>
      <el-form class="setting-form" label-width="108" label-position="left" :style="{
        // backgroundColor: appInnerColorCc,
      }">
        <el-form-item>
          <template #label>
            <div class="setting-title">样式美化</div>
          </template>
        </el-form-item>
        <el-form-item label="应用背景颜色">
          <el-color-picker v-model="appBgColorCc" show-alpha @change="changeAppBgColor" /><span>{{ appBgColorCc
          }}</span>
        </el-form-item>
        <el-form-item label="页面背景颜色">
          <el-color-picker v-model="appInnerColorCc" show-alpha @change="changeAppInnerColor" /><span>{{ appInnerColorCc
          }}</span>
        </el-form-item>
      </el-form>
    </template>
  </layout-vue>

</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, toRaw } from 'vue';

import LayoutVue from '@/components/layout.vue';
import useGlobalSetting from '@/store/useGlobalSetting';
import { storeToRefs } from 'pinia';

const { setForceWorkTimes, setAppBgColor, setAppInnerColor, setIsStartup, setHomeMode, setGlobalFont, setHomeModeOps } = useGlobalSetting();
const { isStartupC, forceWorkTimesC, todayForceWorkTimesC, appBgColorC, appInnerColorC, globalFontC, globalFontOpsC, homeModeOpsC, curStatusC } = storeToRefs(useGlobalSetting());

const appBgColorCc = ref(JSON.parse(JSON.stringify(appBgColorC.value)))
const appInnerColorCc = ref(JSON.parse(JSON.stringify(appInnerColorC.value)))

function changeAppBgColor(value: string) {
  setAppBgColor(value);
}

function changeAppInnerColor(value: string) {
  setAppInnerColor(value);
}

</script>

<style scoped lang="scss">
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

// 主页模式
:deep(.mode-wrapper) {
  .el-form-item__content {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>