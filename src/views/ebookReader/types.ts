/** 目录项数据结构（与 epubjs NavItem 兼容） */
export interface TocItem {
  /** 目录项 id */
  id: string;
  /** 目录项链接（href 或 cfi） */
  href: string;
  /** 目录项显示文本 */
  label: string;
  /** 子目录项 */
  subitems?: TocItem[];
}

/** 扁平化后的目录项（含层级深度，用于缩进显示） */
export interface FlatTocItem extends TocItem {
  /** 层级深度，0 为顶层 */
  depth: number;
}

/** 阅读器子组件实例类型（displayTarget 仅 EpubReader 暴露） */
export interface ReaderComponentInstance {
  /** 跳转到指定目标（cfi 或 href），仅 EpubReader 实现 */
  displayTarget?: (target: string) => void;
  /** 跳转到划线位置，两种阅读组件均实现 */
  jumpToAnnotation?: (anchor: string) => void;
  /** 按 id 移除本地划线（笔记抽屉删除后同步子组件高亮），两种阅读组件均实现 */
  removeAnnotationById?: (id: number) => void;
  /** 按 id 编辑笔记（弹出输入框），两种阅读组件均实现 */
  editAnnotationNote?: (id: number) => void;
}

/** 笔记抽屉展示用的统一标注项（兼容 epub 与 txt 两种子组件 payload） */
export interface AnnotationDisplayItem {
  /** 标注 id（数据库主键） */
  id: number;
  /** 定位锚点（epub 为 cfiRange；txt 为 "start-end"），用于跳转 */
  anchor: string;
  /** 原文摘录 */
  text: string;
  /** 笔记内容，可为空 */
  note: string;
}

/** EPUB 标注数据结构（本地维护的划线/笔记项） */
export interface EpubAnnotation {
  /** 标注记录主键 id（来自数据库自增主键） */
  id: number;
  /** 定位锚点（epubjs 的 cfiRange 字符串，可用于 rendition.display 跳转） */
  anchor: string;
  /** 选中的原文摘录 */
  text: string;
  /** 笔记内容，空字符串表示无笔记 */
  note: string;
  /** 高亮颜色标识，如 'yellow'、'green'、'blue' 等 */
  color: string;
  /** 划线类型：'highlight'（高亮）、'underline'（下划线）、'wavy'（波浪线） */
  type: string;
}
