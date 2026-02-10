<template>
  <umo-editor ref="editorRef" v-bind="options" />
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
.fileRela-form {
  padding: 24px;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
}

.setting-title {
  padding-left: 3px;
  border-bottom: 6px solid #6d6d6d;
  width: 100%;
  font-weight: 600;
}

.setting-form {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  background-color: #ffffff;
}

.setting-handle {
  width: 100%;
  text-align: right;
}

.cache-list {
  word-break: break-all;
}

:deep(.today) {
  color: #409eff;
  font-weight: 900;
}
.notebook-panel {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 24px;
  padding-bottom: 24px;

  .notebook-list {
    flex: 1;
    width: 0;
  }
  .notebook-date-note-is {
    height: 5px;
    width: 5px;
    position: absolute;
    left: 50%;
    text-align: center;
    transform: translate(-50%, -6px);
    border-radius: 50%;
    background: #409eff;
  }
}
</style>
