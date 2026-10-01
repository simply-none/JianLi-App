<!--
  思维导图 —— 框选矩形（纯展示，原子组件）。

  只做一件事：把一个矩形画出来。命中计算在调用方（`MindCanvas` 收 pointer 事件、
  `utils/geometry.ts` 算相交），**组件里没有一行业务逻辑** ——
  这样选框的观感与命中判定可以各自独立地改，不会互相牵动。

  为什么自绘而不是启用 vue-flow 内建的 selection（三条理由，见模块文档 P9）：
    · 左键 `panOnDrag` 平移与框选抢同一个手势；
    · 内建选中态会与自管的 `selectedIds` 形成**两个真源**（节点选中环读谁？）；
    · 内建 selection 对自定义节点的表现不可控。
  自绘约几十行、全在自己手里，代价（多写一点 pointer 处理）远小于收益。

  ⚠️ 坐标是**相对 `.mind-canvas` 的像素坐标**（调用方已把 clientX/Y 减掉容器 rect），
     与画布坐标（`screenToFlowCoordinate` 那一套）**不是一回事** —— 不要混用（坑 36）。
-->
<template>
  <div
    class="mind-selection"
    :style="{
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    }"
  />
</template>

<script setup lang="ts">
defineProps<{
  left: number
  top: number
  width: number
  height: number
}>()
</script>

<style scoped lang="scss">
.mind-selection {
  position: absolute;
  z-index: 4;
  border: 1px solid var(--mm-selection-border);
  border-radius: 2px;
  background: var(--mm-selection-fill);
  /* 选框本身绝不能吃掉指针事件：否则 pointermove/pointerup 会落到它身上，
     拖动到「刚画出来的框」上就会断掉 —— 这是自制框选最容易踩的一脚。 */
  pointer-events: none;
}
</style>
