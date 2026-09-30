<!--
  思维导图 —— 内联文本编辑（原子组件，只负责输入与提交，不碰树）。
  - 必须带 `nodrag` / `nowheel`：否则在文本框里划选会拖动节点、滚轮会缩放画布。
  - Enter 提交、Shift+Enter 换行、Esc 取消、失焦提交。
  - 高度自适应内容（避免长文本被裁切）。
-->
<template>
  <textarea
    ref="textareaRef"
    v-model="draft"
    class="mind-node-editor nodrag nowheel"
    rows="1"
    spellcheck="false"
    @input="resize"
    @keydown.stop
    @keydown.enter.exact.prevent="commit"
    @keydown.esc.prevent="cancel"
    @click.stop
    @dblclick.stop
    @pointerdown.stop
    @wheel.stop
    @blur="commit"
  />
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

const props = defineProps<{
  /** 初始文本 */
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'commit', value: string): void
  (e: 'cancel'): void
}>()

const textareaRef = ref<HTMLTextAreaElement>()
const draft = ref(props.modelValue)
/** 防止 Enter 提交后 blur 再次提交（提交两次会产生两条无用操作） */
let settled = false

/** 高度自适应：先置 auto 再取 scrollHeight */
function resize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function commit() {
  if (settled) return
  settled = true
  emit('commit', draft.value)
}

function cancel() {
  if (settled) return
  settled = true
  emit('cancel')
}

onMounted(async () => {
  await nextTick()
  resize()
  const el = textareaRef.value
  if (!el) return
  el.focus()
  el.select()
})
</script>

<style scoped lang="scss">
.mind-node-editor {
  width: 100%;
  min-width: 60px;
  padding: 0;
  border: none;
  outline: none;
  resize: none;
  overflow: hidden;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1.4;
  cursor: text;
}
</style>
