<template>
  <el-page-header :icon="ArrowLeft" @back="back">
    <template #content>
      <span class="title">{{ title }}</span>
    </template>
    <template #extra>
      <div class="version">
        <span class="app-name">渐离App</span>
        <span class="version-number">{{ pkg.version }}</span>
      </div>
    </template>
  </el-page-header>
</template>

<script lang="ts" setup>
import { ArrowLeft } from '@element-plus/icons-vue'
import pkg from '../../package.json'

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  hideBack: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['back'])

function back () {
  emit('back')
}
</script>

<style lang="scss" scoped>
.version {
  display: flex;
  flex-direction: row;
  color: #5f5f5f;
  gap: 6px;
  .app-name {
    font-size: 1.2em;
    font-weight: 600;
  }
}
</style>