<template>
  <div class="editor-wrapper">
    <umo-editor ref="editorRef" v-bind="options" />
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed, toRaw, onMounted } from 'vue';

import { UmoEditor } from '@umoteam/editor';
import '@umoteam/editor/style'

const props = defineProps({
  options: {
    type: Object,
    default: () => ({}),
  },
})

const editorRef = ref(null);

const getContentExcerpt = () => {
  return editorRef.value.getContentExcerpt();
}

const getContent = (type) => {
  return editorRef.value.getContent(type);
}

const setContent = (content) => {
  editorRef.value.setContent(content);
}

defineExpose({
  getContentExcerpt,
  getContent,
  setContent
})
</script>

<style scoped lang="scss">
.editor-wrapper {
  width: 100%;
  height: 100%;
  min-height: 400px;
}
</style>