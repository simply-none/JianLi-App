<template>
  <div class="home">
    <poetSmallComponents></poetSmallComponents>
    <currentStatusComponents></currentStatusComponents>
    <distanceToNextStatusComponents></distanceToNextStatusComponents>
  </div>
</template>

<script setup>
import poetSmallComponents from '@/smallComponents/poet.vue'
import currentStatusComponents from '@/smallComponents/currentStatus.vue';
import distanceToNextStatusComponents from '@/smallComponents/distanceToNextStatus.vue';
import 'vue3-draggable-resizable/dist/Vue3DraggableResizable.css'
</script>

<style lang="scss" scoped>
.home {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: #696969;
}
</style>