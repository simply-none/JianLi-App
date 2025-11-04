<template>
  <el-form class="pomodoro-record" label-width="120" label-position="left">
    <!-- 系统信息 -->
    <system-info></system-info>
  </el-form>
</template>

<script setup lang="ts">
import systemInfo from './systemInfo.vue';
</script>

<style scoped lang="scss">
.pomodoro-record {
  padding: 24px;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
}
</style>
