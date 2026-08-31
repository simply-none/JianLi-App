<!--
  2FA 测试小窗（薄壳）：只负责窗口容器与留白，交互全部交给 AppTwoFactorPanel。
  刻意不做失焦监听：透明窗圆角外点击会穿透到下层应用并让本窗口失焦，
  一旦监听失焦关闭用户点一下边缘就没了。关闭只走面板关闭按钮 / Esc。
-->
<template>
  <div class="app-2fa-mini-window">
    <AppTwoFactorPanel />
  </div>
</template>

<script setup lang="ts">
import AppTwoFactorPanel from "./components/AppTwoFactorPanel.vue";
</script>

<style scoped lang="scss">
.app-2fa-mini-window {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  // 留白越小越好：透明区域点击会穿透到下层应用
  padding: 3px;
}
</style>
