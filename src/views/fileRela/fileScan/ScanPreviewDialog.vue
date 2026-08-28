// 原子组件：结果预览（图片预览 / 打开文件）
<script setup lang="ts">
import { computed } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { fileProtocol } from '@/var';
import type { ScanResult } from './types';

const props = defineProps<{ item: ScanResult | null; modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [boolean] }>();

const isImage = computed(() => {
  const n = props.item?.name || '';
  return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].some((t) => n.toLowerCase().includes(t));
});
const imgSrc = computed(() =>
  props.item ? fileProtocol + encodeURIComponent(props.item.path) : ''
);

function openFile() {
  if (!props.item) return;
  const ext = props.item.name.split('.').pop() || '';
  window.ipcRenderer.handlePromise('open-file-by-default-app', {
    filePath: props.item.path,
    defaultAppPath: '',
  });
}

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <app-dialog :model-value="modelValue" title="资源展示" width="680px" @update:model-value="(v:any)=>close()" @close="close">
    <div class="show-res" v-if="item">
      <template v-if="isImage">
        <el-image :src="imgSrc" class="res-image" fit="contain" />
      </template>
      <div v-else class="res-info">
        <div>文件类型暂不支持预览</div>
        <div>文件名：{{ item.name }}</div>
        <div>路径：{{ item.path }}</div>
        <el-button type="primary" @click="openFile">打开文件</el-button>
      </div>
    </div>
  </app-dialog>
</template>

<style scoped lang="scss">
.show-res {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.res-image {
  max-width: 100%;
  max-height: 480px;
}
.res-info {
  text-align: center;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}
</style>
