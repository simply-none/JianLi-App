/**
 * 富文本编辑器功能封装（composable）
 *
 * 职责：
 * - 用 v-model:content(html) 与 Quill 双向同步
 * - 合并 preview / readonly / editable 为只读态
 * - 暴露 triggerSave（emit on-save，沿用原 MdEditor 回调签名）
 *
 * 这样 RichTextEditor.vue 只负责「薄壳接线」，逻辑集中在此，便于复用与测试。
 */
import { computed } from 'vue'
import { defaultToolbar } from '@/smallComponents/quillToolbar'

export interface RichTextEditorProps {
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
}

export function useRichTextEditor(props: RichTextEditorProps, emit: any) {
  /**
   * 只读判定：只列举「明确不可读」的情形，其余一律可编辑。
   *   - readonly === true（显式只读，如查看态）
   *   - editable === false（显式不可编辑，如预览窗）
   * 不使用「A || B || C」式的隐式并集，避免默认值 / 未传的边界把本应可编辑的
   * 编辑器误判为只读。是否可读完全由调用方显式传入的 props 决定。
   */
  const isReadOnly = computed(() => {
    if (props.readonly === true) return true
    if (props.editable === false) return true
    return false
  })

  /** 工具栏：false 隐藏；自定义优先；否则用默认 */
  const resolvedToolbar = computed(() => {
    if (props.toolbar === false) return false
    if (Array.isArray(props.toolbar) && props.toolbar.length) return props.toolbar
    return defaultToolbar
  })

  return { isReadOnly, resolvedToolbar }
}
