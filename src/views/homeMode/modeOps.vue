<template>
  <el-form-item>
    <template #label>
      <div class="setting-title">模式选项</div>
    </template>
  </el-form-item>
  <el-form-item label="日常模式" class="mode-wrapper">
    <el-select v-model="homeModeCc.work.value" value-key="value" placeholder="Select" style="width: 226px"
      @change="changeHomeMode('work')">
      <el-option v-for="item in homeModeOpsCc" :key="item.value" :label="item.label" :value="item.value" />
    </el-select>
  </el-form-item>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const mode = ref('');
const homeModeCc = ref({
  work: {
    value: 'work',
    label: '日常模式',
    forceWorkTimes: 0,
    appBgColor: '#000000',
    isStartup: true,
    appInnerColor: '#00ffbf',
  },

})

const homeModeOpsCc = ref([
  {
    value: 'work',
    label: '日常模式',
  }, 
])

const changeHomeMode = (value: string) => {
  homeModeCc.value.work.value = value; 
}

</script>

<style lang="scss" scoped></style>