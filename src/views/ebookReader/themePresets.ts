import type { EbookTheme, EbookBgType } from '@/store/useEbookReader';

/**
 * 阅读区主题预设：各预设主题对应的「阅读区」默认背景色与文字颜色。
 * 注意：这里只定义阅读区（正文）的配色，外层工具栏/抽屉主题由 index.vue 的
 * `theme-day/night/eye` CSS 变量控制，二者解耦——切换预设主题时阅读区与工具栏同步，
 * 而用户在设置抽屉里自定义的背景色/图/文字色仅作用于阅读区正文。
 */

/** 各预设主题的阅读区默认背景色 */
export const READING_PRESET_BG: Record<EbookTheme, string> = {
  day: '#ffffff',
  night: '#1a1a1a',
  eye: '#c7edcc',
};

/** 各预设主题的阅读区默认文字颜色 */
export const READING_PRESET_TEXT: Record<EbookTheme, string> = {
  day: '#333333',
  night: '#cccccc',
  eye: '#2c3e50',
};

/** 设置抽屉「主题」预设卡片所需信息（含图标名与展示色，图标名需与 LucideIcon 已注册图标匹配） */
export const THEME_PRESETS: {
  /** 主题标识 */
  name: EbookTheme;
  /** 中文标签 */
  label: string;
  /** 图标名称（LucideIcon） */
  icon: string;
  /** 卡片展示背景色 */
  bg: string;
  /** 卡片展示文字色 */
  text: string;
}[] = [
  { name: 'day', label: '日间', icon: 'Sun', bg: READING_PRESET_BG.day, text: READING_PRESET_TEXT.day },
  { name: 'night', label: '夜间', icon: 'Moon', bg: READING_PRESET_BG.night, text: READING_PRESET_TEXT.night },
  { name: 'eye', label: '护眼', icon: 'Eye', bg: READING_PRESET_BG.eye, text: READING_PRESET_TEXT.eye },
];

/**
 * 根据当前背景配置解析阅读区实际背景 CSS 值
 * - image 且已选图：返回 `url("dataURL") repeat`（按图片原始尺寸平铺，不拉伸）
 * - color 且已选色：返回该颜色
 * - 其余（preset / image 未选图 / color 未选色）：回退到主题预设背景
 *
 * @param bgType 背景类型
 * @param bgColor 背景色（color 模式）
 * @param bgImage 背景图 data URL（image 模式）
 * @param theme 当前主题预设
 * @returns 可直接用于 CSS background 的属性值
 */
export function resolveReadingBg(
  bgType: EbookBgType,
  bgColor: string,
  bgImage: string,
  theme: EbookTheme
): string {
  if (bgType === 'image' && bgImage) {
    return `url("${bgImage}") repeat`;
  }
  if (bgType === 'color' && bgColor) {
    return bgColor;
  }
  return READING_PRESET_BG[theme];
}

/**
 * 根据当前文字颜色配置解析阅读区实际文字颜色（空字符串回退到主题预设文字色）
 *
 * @param textColor 自定义文字颜色
 * @param theme 当前主题预设
 * @returns 可直接用于 CSS color 的属性值
 */
export function resolveReadingText(textColor: string, theme: EbookTheme): string {
  return textColor || READING_PRESET_TEXT[theme];
}
