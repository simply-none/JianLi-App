/**
 * 主题对话 - 富文本（vue-quill）辅助函数
 * ------------------------------------------------------------------
 * 设计约定：
 *   - 对话内容 `content` 一律以「字符串」存储，兼容两种情况：
 *       1) 纯文本（无标签）—— 折叠 / 纯文本模式下录入；
 *       2) HTML（来自 vue-quill）—— 展开富文本编辑且应用了格式时录入。
 *   - conversation 表通过 `is_rich` 列（'0'/'1'）显式标记内容类型，
 *     该字段同时驱动「展示用组件」与「编辑弹窗用编辑器」：
 *       is_rich='1' -> 展示走 v-html（HTML 渲染）、编辑弹窗用 QuillEditor；
 *       is_rich='0' -> 展示按纯文本转义、编辑弹窗用普通 textarea。
 *   - 写入时由 `isRichContent` 按内容是否含实际格式自动归一化：
 *     含格式 -> 存 HTML + is_rich='1'；否则 -> 去标签存纯文本 + is_rich='0'。
 */

/** 判断字符串是否包含 HTML 标签（粗略但足够用于区分纯文本 / 富文本） */
export function isHtml(s: string | undefined | null): boolean {
  if (!s) return false;
  return /<[a-z!][\s\S]*>/i.test(s);
}

/**
 * 判断一段 HTML 是否为「富文本」（含实际格式），用于写入时决定 is_rich：
 * 仅由 <p>/<br> 包裹的纯文本视为非富文本；包含 b/i/u/a/ul/ol/blockquote/h1-3
 * 等格式标签才视为富文本。
 */
export function isRichContent(html: string | undefined | null): boolean {
  if (!html) return false;
  const stripped = String(html)
    .replace(/<\/?(p|br)\b[^>]*>/gi, '') // 去掉结构性 p / br
    .replace(/&nbsp;/gi, '')
    .replace(/\s+/g, '');
  return stripped.includes('<') || stripped.includes('>');
}

/** HTML 转义：用于纯文本内容走 v-html 时还原 `{{ }}` 的转义语义 */
export function escapeHtml(s: string | undefined | null): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 去掉 HTML 标签并解码实体，得到纯文本。
 * 用于：判空、列表/摘要预览。
 */
export function stripTags(html: string | undefined | null): string {
  if (!html) return '';
  return String(html)
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, '\n') // 块级结尾 -> 换行
    .replace(/<br\s*\/?>/gi, '\n') // 换行符 -> 换行
    .replace(/<[^>]+>/g, '') // 其余标签移除
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * 把任意内容（纯文本或已有 HTML）转成 vue-quill 可识别的 HTML 种子。
 * - 已是 HTML：原样返回（避免重复包裹）；
 * - 纯文本：转义后按行拆成 `<br>`，整体包进 `<p>`，保证 quill 初始化结构合法。
 */
export function toQuillContent(text: string | undefined | null): string {
  if (!text) return '';
  if (isHtml(text)) return text as string;
  const escaped = escapeHtml(text);
  const body = escaped.split(/\n/).map((l) => (l === '' ? '<br>' : l)).join('<br>');
  return `<p>${body}</p>`;
}

/** 摘要：去标签 + 折叠空白 + 截断，供列表/弹窗预览使用 */
export function snippetOf(text: string | undefined | null, max = 60): string {
  const t = stripTags(text).replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max) + '…' : t || '(空对话)';
}
