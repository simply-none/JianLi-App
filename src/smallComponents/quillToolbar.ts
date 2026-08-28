/**
 * 标准富文本工具栏（原子配置）
 * 可被 RichTextEditor 的 `toolbar` prop 覆盖。
 */
export const defaultToolbar: any[] = [
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ header: [1, 2, 3, false] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ script: 'sub' }, { script: 'sup' }],
  ['link', 'image'],
  ['clean'],
]
