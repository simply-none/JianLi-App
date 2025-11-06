<template>
  <div class="home-rest2" @contextmenu="contextmenuFn">
    <importSmallComponents ref="importSmallComponentsRef" :modeName="modeName"></importSmallComponents>
  </div>
</template>

<script setup>
import { ref, toRaw, watch, computed } from 'vue'
import importSmallComponents from '@/components/importSmallComponents.vue';

const importSmallComponentsRef = ref()
const modeName = ref('custom')

const contextmenuFn = (event) => {
  importSmallComponentsRef.value.contextmenuFn(event)
}
</script>

<style lang="scss" scoped>
.home-rest2 {
  width: 100%;
  height: 100%;
  position: relative;
  user-select: none;
}
</style>