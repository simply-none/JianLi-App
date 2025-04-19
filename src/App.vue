<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import useOpenWindow from '@/hooks/useOpenWindow';

// 使用不同窗口打开时分别处理的hook
useOpenWindow()

</script>

<template>
  <router-view v-slot="{ Component }">
    <el-config-provider :locale="zhCn">
      <transition>
        <component :is="Component" />
      </transition>
    </el-config-provider>
  </router-view>
</template>

<style lang="scss">
html,
body,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

.page {
  width: 100%;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;

  &-container {
    width: 100%;
    height: 100%;
    padding: 12px;
    overflow-y: auto;
    box-sizing: border-box;
  }
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
</style>
