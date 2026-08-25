<template>
  <!-- <DraggableContainer style="width: 0; height: 0; position: unset;"> -->
  <Vue3DraggableResizable :init-h="myPosition.h" :init-w="myPosition.w" v-model:x="myPosition.x"
    v-model:y="myPosition.y" v-model:w="myPosition.w" v-model:h="myPosition.h" @drag-end="dragEndCont"
    @resize-end="resizeEndCont">
    <div class='myPosition'>
      <slot></slot>
    </div>
  </Vue3DraggableResizable>
  <!-- </DraggableContainer> -->
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import Vue3DraggableResizable, { DraggableContainer } from 'vue3-draggable-resizable'
import 'vue3-draggable-resizable/dist/Vue3DraggableResizable.css'

const props = defineProps({
  x: { type: Number, default: 10 },
  y: { type: Number, default: 10 },
  w: { type: Number, default: 100 },
  h: { type: Number, default: 100 },
})
const emit = defineEmits(['update']);

const myPosition = ref({
  x: 10,
  y: 10,
  w: 100,
  h: 100,
})

// 同步父组件传入的位置/尺寸：必须拷贝为「普通对象」，
// 直接把 props（只读代理）赋给 myPosition 会导致 v-model 写入时报 "target is readonly"
watch(
  () => [props.x, props.y, props.w, props.h],
  ([x, y, w, h]) => {
    myPosition.value = { x, y, w, h }
  },
  { immediate: true }
)

// 修正myPosition
function fixMyPosition(pos) {
  const newP = { x: pos.x, y: pos.y, w: pos.w, h: pos.h }
  if (newP.x < 0) { newP.x = 0 }
  if (newP.y < 0) { newP.y = 0 }
  if (newP.w < 100) { newP.w = 100 }
  if (newP.h < 100) { newP.h = 100 }
  // 窗口的宽高
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  // 边际间距
  const gap = 20

  const maxX = screenWidth - newP.w;
  const maxY = screenHeight - newP.h;
  if (newP.w > screenWidth) { newP.w = screenWidth }
  if (newP.h > screenHeight) { newP.h = screenHeight }
  if (newP.x > maxX) { newP.x = maxX - gap }
  if (newP.y > maxY) { newP.y = maxY - gap }
  return newP
}

function dragEndCont({ x, y }) {
  myPosition.value = fixMyPosition({
    ...myPosition.value,
    x,
    y,
  })
  emit('update', myPosition.value)
}

function resizeEndCont({ x, y, w, h }) {
  myPosition.value = fixMyPosition({
    ...myPosition.value,
    x,
    y,
    w,
    h,
  })
  emit('update', myPosition.value)
}

function handleResize() {
  emit('update', fixMyPosition(myPosition.value))
}

onMounted(() => {
  myPosition.value = fixMyPosition(myPosition.value)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

</script>

<style lang="scss" scoped>
div {
  padding: 2px;
}

.myPosition {
  width: 100%;
  height: 100%;

  &:active {
    border: 1px solid #000;
  }
}
</style>