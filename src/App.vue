<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import useOpenWindow from '@/hooks/useOpenWindow';
import useRuntimeVariables from '@/store/useRuntimeVariables';

const router = useRouter()
const route = useRoute()
const { activeRouteName } = storeToRefs(useRuntimeVariables())
const { updateActiveRouteName } = useRuntimeVariables()

// 使用不同窗口打开时分别处理的hook
useOpenWindow()

// 监听事件
window.ipcRenderer.on('open-match-page', (event, url) => {
  router.push({
    name: url,
  })
  updateActiveRouteName(url)
})

</script>

<template>
  <router-view v-slot="{ Component }">
    <el-config-provider :locale="zhCn">
      <transition :name="route.name === 'home' ? '' : 'page-fade'" mode="out-in">
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

/* ========== 路由切换动画 ========== */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ========== 通用工具类 ========== */
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
