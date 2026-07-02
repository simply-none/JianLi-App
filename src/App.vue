<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { watch, ref } from 'vue';
import useOpenWindow from '@/hooks/useOpenWindow';
import useRuntimeVariables from '@/store/useRuntimeVariables';
import useTheme from '@/store/useTheme';
import { layoutRouters } from '@/router';
import { ElMessageBox } from 'element-plus';

const router = useRouter()
const route = useRoute()
const { activeRouteName } = storeToRefs(useRuntimeVariables())
const { updateActiveRouteName } = useRuntimeVariables()

// 主题切换 — 将 data-theme 设置到 html 根元素
const { currentTheme } = storeToRefs(useTheme())
watch(currentTheme, (theme) => {
  document.documentElement.setAttribute('data-theme', theme)
}, { immediate: true })

// 路由过渡动画控制
const layoutRouteNames = new Set(layoutRouters.map(r => r.name))
const transitionName = ref(route.name === 'home' ? '' : 'page-fade')
router.beforeEach((to, from, next) => {
  const fromIsHome = from.name === 'home'
  const fromIsLayout = layoutRouteNames.has(from.name)
  const toIsLayout = layoutRouteNames.has(to.name)
  // 从 home 出发、或从设置页离开到其他页面，无动画
  transitionName.value = fromIsHome || (fromIsLayout && !toIsLayout) ? '' : 'page-fade'
  next()
})

// 使用不同窗口打开时分别处理的hook
useOpenWindow()

// 监听事件
window.ipcRenderer.on('open-match-page', (event, url) => {
  router.push({
    name: url,
  })
  updateActiveRouteName(url)
})

// 监听确认隐藏窗口事件
window.ipcRenderer.on('confirm-hide-app', (event, confirm) => {
  if (confirm) {
    // 使用elMessageBox.confirm
    ElMessageBox.confirm('确定要隐藏应用吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }).then(() => {
      // 确认隐藏应用,发送给主进程处理
      window.ipcRenderer.send("hide-app");
    }).catch(() => {
      // 取消隐藏应用
    });
  } else {
    // 拒绝隐藏应用
    // ...
  }
})



</script>

<template>
  <router-view v-slot="{ Component }">
    <el-config-provider :locale="zhCn">
      <transition :name="transitionName" mode="out-in">
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
