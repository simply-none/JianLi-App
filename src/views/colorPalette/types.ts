/**
 * 调色板工具 - 本地类型定义
 *
 * 注意：本目录为渲染端功能模块，禁止 import 任何 electron/* 类型，
 * 颜色计算与数据访问均通过 IPC（window.ipcRenderer）在运行时完成。
 */

/** HSV 颜色：色相 0-360，饱和度 0-100，明度 0-100（UI 友好区间） */
export interface HSV {
  h: number
  s: number
  v: number
}

/** RGB 颜色：各分量 0-255 */
export interface RGB {
  r: number
  g: number
  b: number
}

/** RGBA 颜色：rgb 各分量 0-255，a 透明度 0-1（1 为完全不透明） */
export interface RGBA extends RGB {
  a: number
}

/** HSL 颜色：色相 0-360，饱和度 0-100，亮度 0-100 */
export interface HSL {
  h: number
  s: number
  l: number
}

/** HSLA 颜色：HSL + 透明度 a（0-1） */
export interface HSLA extends HSL {
  a: number
}

/** 配色方案类型 */
export type HarmonyType =
  | 'complementary' // 互补
  | 'analogous' // 类比
  | 'triadic' // 三角
  | 'splitComplementary' // 分裂互补
  | 'tetradic' // 四角（正方形布局，严格 90°）
  | 'monochromatic' // 单色
  | 'rectangle' // 矩形双互补（两组互补色角度不等）
  | 'doubleSplit' // 双分裂互补（基色与互补色两侧各取一色）
  | 'accentedAnalogous' // 类比 + 互补强调
  | 'diadic' // 二色邻近

/** 色盲模拟类型 */
export type ColorBlindType = 'protanopia' | 'deuteranopia' | 'tritanopia'

/** 数据库表名（与 store 中建表语句保持一致） */
export const COLOR_PALETTE_TABLE = 'color_palette'
export const COLOR_FAVORITE_TABLE = 'color_favorite'

/** 已保存的色板（持久化到 color_palette 表） */
export interface SavedPalette {
  /** 主键：以名称作为唯一键，重名则覆盖 */
  key: string
  name: string
  /** 颜色列表（HEX 字符串的 JSON 数组） */
  colors: string
  created_at: string
  updated_at: string
}

/** 快速收藏的单个颜色（持久化到 color_favorite 表） */
export interface ColorFavorite {
  key: string
  hex: string
  created_at: string
}

/** 配色方案元信息（用于 UI 展示与文案） */
export const HARMONY_META: Record<HarmonyType, { label: string; desc: string }> = {
  complementary: { label: '互补色', desc: '色环对位 180°，对比强烈' },
  analogous: { label: '类比色', desc: '相邻 30°，和谐自然' },
  triadic: { label: '三角色', desc: '等分 120°，平衡活泼' },
  splitComplementary: { label: '分裂互补', desc: '互补两侧各 30°，对比柔和' },
  tetradic: { label: '四角色', desc: '两组互补 90°（正方形），丰富但不易驾驭' },
  monochromatic: { label: '单色', desc: '同色相不同明度/饱和度' },
  rectangle: { label: '矩形双互补', desc: '两组互补色角度不等，4 色，比四角更灵活' },
  doubleSplit: { label: '双分裂互补', desc: '基色与互补色两侧各取一色，共 5 色' },
  accentedAnalogous: { label: '类比+互补', desc: '相邻类色 + 1 个互补作强调，共 4 色' },
  diadic: { label: '二色邻近', desc: '相邻 60°，柔和双色' },
}

/** 色盲类型元信息 */
export const COLOR_BLIND_META: Record<ColorBlindType, { label: string }> = {
  protanopia: { label: '红色盲 (Protanopia)' },
  deuteranopia: { label: '绿色盲 (Deuteranopia)' },
  tritanopia: { label: '蓝色盲 (Tritanopia)' },
}
