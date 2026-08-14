/**
 * 电子书划线/标注的「颜色」与「样式」统一配置
 *
 * 此前颜色与类型的可选项分散在 AnnotationToolbar.vue（用户操作入口）、
 * EpubReader.vue 与 TxtReader.vue（渲染映射）三处重复定义，三者需手动保持一致。
 * 这里集中维护一份，供：
 * - 右上角「阅读设置」抽屉（颜色/样式选择 UI）使用；
 * - EpubReader / TxtReader 的渲染映射（HIGHLIGHT_COLOR_MAP）使用。
 *
 * 划线颜色/类型作为全局偏好存入阅读设置 store，选中文本后点击「划线/笔记」
 * 即按 store 中预设的颜色与样式直接标注，无需每次手动选择，便于沉浸式阅读。
 */

/** 划线颜色标识 */
export type HighlightColorName =
  | 'yellow'
  | 'green'
  | 'blue'
  | 'pink'
  | 'orange'
  | 'purple';

/** 划线类型：高亮 / 下划线 / 删除线(mark) / 双下划线(markStrong) */
export type HighlightTypeName = 'highlight' | 'underline' | 'mark' | 'markStrong';

/** 颜色选项配置 */
export interface HighlightColorOption {
  /** 颜色标识，存入数据库与 store */
  name: HighlightColorName;
  /** 中文标签 */
  label: string;
  /** CSS 颜色值（带透明度） */
  value: string;
}

/** 划线类型选项配置 */
export interface HighlightTypeOption {
  /** 类型标识，存入数据库与 store */
  name: HighlightTypeName;
  /** 中文标签 */
  label: string;
  /** 类型图标（emoji） */
  icon: string;
}

/** 划线颜色可选项 */
export const HIGHLIGHT_COLORS: HighlightColorOption[] = [
  { name: 'yellow', label: '黄色', value: 'rgba(255,235,59,0.4)' },
  { name: 'green', label: '绿色', value: 'rgba(129,199,132,0.4)' },
  { name: 'blue', label: '蓝色', value: 'rgba(100,181,246,0.4)' },
  { name: 'pink', label: '粉色', value: 'rgba(244,143,177,0.4)' },
  { name: 'orange', label: '橙色', value: 'rgba(255,183,77,0.4)' },
  { name: 'purple', label: '紫色', value: 'rgba(186,160,227,0.4)' },
];

/** 划线类型可选项 */
export const HIGHLIGHT_TYPES: HighlightTypeOption[] = [
  { name: 'highlight', label: '高亮', icon: '🟨' },
  { name: 'underline', label: '下划线', icon: '📝' },
  { name: 'mark', label: '删除线', icon: '🗵' },
  { name: 'markStrong', label: '双下划线', icon: '📏' },
];

/**
 * 颜色名称到 CSS 颜色值的映射（供 Epub/Txt 两处渲染高亮使用）。
 * 与 HIGHLIGHT_COLORS 的 value 保持一致，单点定义避免重复。
 */
export const HIGHLIGHT_COLOR_MAP: Record<string, string> = {
  yellow: 'rgba(255,235,59,0.4)',
  green: 'rgba(129,199,132,0.4)',
  blue: 'rgba(100,181,246,0.4)',
  pink: 'rgba(244,143,177,0.4)',
  orange: 'rgba(255,183,77,0.4)',
  purple: 'rgba(186,160,227,0.4)',
};

/** 默认划线颜色 */
export const DEFAULT_HIGHLIGHT_COLOR: HighlightColorName = 'yellow';
/** 默认划线类型 */
export const DEFAULT_HIGHLIGHT_TYPE: HighlightTypeName = 'highlight';

/**
 * 根据颜色名称（或自定义 CSS 颜色字符串）获取 CSS 颜色值。
 * 命中预设名则返回对应值；否则把入参当「自定义 CSS 颜色」原样返回；
 * 空值最终回退到黄色，避免渲染端拿到非法色值。
 *
 * @param colorName - 预设颜色名（'yellow' 等）或自定义 CSS 颜色字符串（'#FF0000'、'rgba(...)'）
 * @returns CSS 颜色值
 */
export function getHighlightColorValue(colorName: string): string {
  if (colorName && HIGHLIGHT_COLOR_MAP[colorName]) return HIGHLIGHT_COLOR_MAP[colorName];
  if (colorName) return colorName;
  return HIGHLIGHT_COLOR_MAP.yellow;
}

/**
 * 判断某个颜色字符串是否为「预设颜色名」（而非自定义 CSS 颜色）。
 * 用于在设置抽屉中区分预设色块高亮与「自定义颜色」高亮。
 *
 * @param color - 颜色字符串（预设名或自定义 CSS 颜色）
 * @returns 是否为预设色名
 */
export function isPresetColorName(color: string): boolean {
  return !!color && HIGHLIGHT_COLORS.some((c) => c.name === color);
}
