<template>
  <DraggableContainer style="width: 0; height: 0;">
    <Vue3DraggableResizable :init-h="myPosition.h" :init-w="myPosition.w" v-model:x="myPosition.x"
      v-model:y="myPosition.y" v-model:w="myPosition.w" v-model:h="myPosition.h" @drag-end="dragEndCont"
      @resize-end="resizeEndCont">
      <div class='myPosition'>
        <slot></slot>
      </div>
    </Vue3DraggableResizable>
  </DraggableContainer>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import Vue3DraggableResizable, { DraggableContainer } from 'vue3-draggable-resizable'
import 'vue3-draggable-resizable/dist/Vue3DraggableResizable.css'

const props = defineProps({
  x: { type: Number, default: 10 },
  y: { type: Number, default: 10 },
  w: { type: Number, default: 100 },
  h: { type: Number, default: 100 },
})
const emit = defineEmits(['update']);

const myPosition = computed({
  get() {
    return { x: props.x, y: props.y, w: props.w, h: props.h }
  },
  set() { }
})

function dragEndCont() {
  emit('update', myPosition.value)
}

function resizeEndCont() {
  emit('update', myPosition.value)
}

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