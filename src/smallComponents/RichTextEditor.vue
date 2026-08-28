<template>
  <div class="rich-text-editor" :class="['rte-' + themeClass]">
    <QuillEditor
      v-model:content="content"
      content-type="html"
      theme="snow"
      :enable="!isReadOnly"
      :toolbar="isReadOnly ? false : resolvedToolbar"
      :placeholder="placeholder"
      @ready="onReady"
      @text-change="onTextChange"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 富文本编辑器（原子组件）
 * 内部基于 @vueup/vue-quill，对外 API 兼容原 MdEditor：
 * - v-model / update:modelValue（HTML 字符串）
 * - on-change(html) / on-save(html, Promise<html>)
 * - expose.triggerSave() / getHTML() / getQuill() / focus()
 *
 * 只读判定（关键）：完全由调用方显式传入的 props 决定
 *   - editable=false 或 readonly=true  ⇒ 只读
 *   - 其余（含未传）一律可编辑（默认态）
 * 可编辑态通过 Quill 的 :enable 响应式控制（vue-quill 的 enable 带 watch，
 * 可实时切换；而 readOnly 仅在初始化时生效，故不依赖它）。
 *
 * 内容同步：编辑器常驻挂载，但 @vueup/vue-quill 的 v-model:content 在挂载后
 * 不会可靠地把外部变化的 HTML 推入编辑区。因此 watch(props.modelValue) 时直接
 * 调用 Quill API（clipboard.dangerouslyPasteHTML）写入，确保切换笔记 / 初始
 * 载入都能刷新；程序写入触发 text-change(source==='api')，handler 中跳过以免回环。
 */
import { ref, watch, computed } from 'vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import { useRichTextEditor } from '@/composables/useRichTextEditor'

const props = withDefaults(
  defineProps<{
    /** 编辑器内容（HTML 字符串） */
    modelValue?: string
    /** 主题，仅影响外壳暗色样式 */
    theme?: 'light' | 'dark'
    /** 显式只读（如查看笔记态）。true ⇒ 只读 */
    readonly?: boolean
    /** 可编辑。默认 true；显式 false ⇒ 只读（如预览窗） */
    editable?: boolean
    /** 自定义工具栏，覆盖默认；false 表示隐藏工具栏 */
    toolbar?: any[] | false
    /** 占位提示 */
    placeholder?: string
  }>(),
  {
    modelValue: '',
    theme: 'light',
    readonly: false,
    editable: true,
    toolbar: undefined,
    placeholder: '',
  }
)

const emit = defineEmits<{
  'update:modelValue': [val: string]
  'on-change': [val: string]
  'on-save': [val: string, htmlPromise: Promise<string>]
}>()

const { isReadOnly, resolvedToolbar } = useRichTextEditor(props, emit)

const themeClass = computed(() => (props.theme === 'dark' ? 'dark' : 'light'))

/** 编辑器内容（HTML）。内部 ref，由外部 modelValue 同步 */
const content = ref(props.modelValue ?? '')

let quillInstance: any = null

/** 把外部 HTML 直接写入 Quill 实例（绕过 v-model 挂载后不刷新内容的限制） */
function setQuillContent(html: string) {
  if (!quillInstance) return
  const next = html || ''
  if (next === quillInstance.root.innerHTML) return
  quillInstance.clipboard.dangerouslyPasteHTML(next)
  // 光标移到末尾，避免停留在旧位置
  try {
    quillInstance.setSelection(quillInstance.getLength(), 0)
  } catch {
    /* 只读态 setSelection 可能无效，忽略 */
  }
}

function onReady(quill: any) {
  quillInstance = quill
  // 可编辑态由模板 :enable="!isReadOnly" 响应式控制（vue-quill 的 enable 带 watch）；
  // 这里仅兜底写入初始内容（应对挂载时内容已就绪但未被 Quill 采用的情况）
  setQuillContent(props.modelValue ?? '')
}

/** 外部 modelValue 变化（如切换笔记 / 初始载入）时直接写入 Quill */
watch(
  () => props.modelValue,
  (val) => {
    const next = val ?? ''
    content.value = next
    setQuillContent(next)
  },
  { immediate: true }
)

/** 编辑器内容变化：回写 v-model 并触发 on-change（沿用原 MdEditor 回调） */
function onTextChange(_delta: any, _old: any, source?: string) {
  // 由 setQuillContent 程序写入触发，跳过避免回环 / 重复提交
  if (source === 'api') return
  const html = quillInstance?.root?.innerHTML ?? content.value
  emit('update:modelValue', html)
  emit('on-change', html)
}

/** 触发保存：emit on-save(html, Promise<html>)，兼容原 MdEditor 签名 */
function triggerSave() {
  const html = quillInstance?.root?.innerHTML ?? content.value
  emit('on-save', html, Promise.resolve(html))
}

defineExpose({
  triggerSave,
  getHTML: () => quillInstance?.root?.innerHTML ?? content.value,
  getQuill: () => quillInstance,
  focus: () => quillInstance?.focus?.(),
})
</script>

<style scoped lang="scss">
.rich-text-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #fff;
  border: 1px solid #d7d7d7;
  border-radius: 6px;
  overflow: hidden;
  box-sizing: border-box;

  /* 工具栏固定高度，不随编辑区伸缩 */
  :deep(.ql-toolbar.ql-snow) {
    flex-shrink: 0;
    border: none;
    border-bottom: 1px solid #e5e5e5;
    padding: 8px;
  }

  /* 编辑容器填满剩余空间 */
  :deep(.ql-container.ql-snow) {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    height: auto;
    border: none;
    overflow: hidden;
    font-size: 14px;
  }

  /* 实际可编辑区撑满高度，超出滚动（关键：否则编辑区塌缩成空白） */
  :deep(.ql-editor) {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    line-height: 1.65;
  }

  :deep(.ql-editor.ql-blank::before) {
    color: #9a9a9a;
    font-style: normal;
  }
}

/* 暗色主题 */
.rich-text-editor.rte-dark {
  background: #1f1f1f;
  border-color: #5c5c5c;
  color: #e0e0e0;

  :deep(.ql-toolbar.ql-snow) {
    border-bottom-color: #3a3a3a;

    .ql-stroke {
      stroke: #cfcfcf;
    }
    .ql-fill {
      fill: #cfcfcf;
    }
    .ql-picker {
      color: #cfcfcf;
    }
  }

  :deep(.ql-container.ql-snow) {
    color: #e0e0e0;
    background: #1f1f1f;
  }

  :deep(.ql-editor.ql-blank::before) {
    color: #8a8a8a;
  }
}
</style>
