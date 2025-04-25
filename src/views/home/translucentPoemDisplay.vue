<template>
  <div class="home">
    <DraggableContainer style="width: 0; height: 0; position: unset;">
    <poetSmallComponents></poetSmallComponents>
    <currentStatusComponents></currentStatusComponents>
    <distanceToNextStatusComponents></distanceToNextStatusComponents>
    </DraggableContainer>
  </div>
</template>

<script setup>
import poetSmallComponents from '@/smallComponents/poet.vue'
import currentStatusComponents from '@/smallComponents/currentStatus.vue';
import distanceToNextStatusComponents from '@/smallComponents/distanceToNextStatus.vue';
import Vue3DraggableResizable, { DraggableContainer } from 'vue3-draggable-resizable'
import 'vue3-draggable-resizable/dist/Vue3DraggableResizable.css'
</script>

<style lang="scss" scoped>
.home {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: #696969;
  position: relative;
}
</style>