<!--
  习惯打卡小窗（薄壳）：只负责窗口容器与留白，交互全部交给 HabitCheckinPanel。
  这里刻意不做任何失焦监听：小窗是透明窗口，圆角外的透明区域点击会穿透到下层应用并让本窗口失焦，
  一旦监听失焦关闭，用户点一下面板边缘窗口就没了。关闭只走面板的关闭按钮 / Esc。
-->
<template>
  <div class="habit-mini-window">
    <HabitCheckinPanel />
  </div>
</template>

<script setup lang="ts">
import HabitCheckinPanel from "./components/HabitCheckinPanel.vue";
</script>

<style scoped lang="scss">
.habit-mini-window {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  // 留白越小越好：透明区域点击会穿透到下层应用
  padding: 3px;
}
</style>
