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

watch(() => props, (n) => {
  console.log('newP watch', n);
  if (!n) return;
  myPosition.value = n
}, {
  immediate: true,
  deep: true,
})

watch(() => myPosition.value, (n) => {
  console.log('newP watch', n);
}, {
  immediate: true,
  deep: true,
})

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
  console.log('newP', newP);
  console.log('newP screenWidth', screenWidth, 'screenHeight', screenHeight);
  return newP
}

function dragEndCont({ x, y }) {
  console.log('newP dragEndCont', x, y);
  myPosition.value = fixMyPosition({
    ...myPosition.value,
    x,
    y,
  })
  emit('update', myPosition.value)
}

function resizeEndCont({ x, y, w, h }) {
  console.log('newP resizeEndCont', x, y, w, h);
  myPosition.value = fixMyPosition({
    ...myPosition.value,
    x,
    y,
    w,
    h,
  })
  emit('update', myPosition.value)
}

onMounted(() => {
  fixMyPosition(myPosition.value)
  window.addEventListener('resize', () => {
    emit('update', fixMyPosition(myPosition.value))
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', () => { })
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