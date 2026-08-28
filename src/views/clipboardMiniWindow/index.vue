<template>
  <!--
    剪贴板快速粘贴小窗（薄壳）：只负责窗口容器与留白，交互全部交给 QuickPastePanel。
    这里刻意不做任何键盘 / 失焦监听：
    1. 小窗是透明窗口，圆角外的透明区域点击会穿透到下层应用并让本窗口失焦，
       一旦监听失焦关闭，用户点一下面板边缘窗口就没了；
    2. Esc 等按键由面板在 document 上统一处理，避免重复响应。
  -->
  <div class="clipboard-mini-window">
    <QuickPastePanel />
  </div>
</template>

<script setup lang="ts">
import QuickPastePanel from './QuickPastePanel.vue'
</script>

<style scoped lang="scss">
.clipboard-mini-window {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  // 留白越小越好：透明区域点击会穿透到下层应用
  padding: 3px;
}
</style>
