/**
 * 调色板工具 - 颜色算法（纯函数，无副作用）
 *
 * 涵盖：HEX / RGB / HSL / HSV 互转、配色方案生成、
 * WCAG 对比度计算、色盲模拟。全部为纯函数，便于单测与复用。
 */

import type { ColorBlindType, HarmonyType, HSL, HSLA, HSV, RGB, RGBA } from './types'
import { NAMED_COLORS } from './colorNames'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// ============ HEX <-> RGB ============

/**
 * 规范化各种 HEX 写法（#abc / #rgba / #aabbcc / #rrggbbaa，可带或不带 #）。
 * 返回小写且已展开的完整形式：含 alpha 通道时返回 8 位，否则 6 位；非法返回 null。
 */
export function parseHex(input: string): string | null {
  let h = input.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  } else if (/^[0-9a-fA-F]{4}$/.test(h)) {
    // #rgba → #rrggbbaa
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (/^[0-9a-fA-F]{6}$/.test(h)) return '#' + h.toLowerCase()
  if (/^[0-9a-fA-F]{8}$/.test(h)) return '#' + h.toLowerCase()
  return null
}

/** 从 HEX（6 或 8 位）中提取透明度，返回 0-1（无 alpha 通道视为 1） */
export function parseAlpha(hex: string): number {
  const norm = parseHex(hex)
  if (!norm || norm.length < 9) return 1
  return parseInt(norm.slice(7, 9), 16) / 255
}

/** 渐变 CSS 字符串是否含透明色标（8 位 HEX alpha<255 或 rgba 的 a<1） */
export function gradientHasAlpha(css: string): boolean {
  const hex8 = css.match(/#[0-9a-fA-F]{8}/g)
  if (hex8) {
    for (const h of hex8) {
      if (parseInt(h.slice(7, 9), 16) < 255) return true
    }
  }
  const rgba = css.match(/rgba?\([^)]+\)/g)
  if (rgba) {
    for (const r of rgba) {
      const parts = r.slice(r.indexOf('(') + 1, -1).split(',').map((s) => parseFloat(s.trim()))
      const a = parts[3]
      if (a !== undefined && a < 1) return true
    }
  }
  return false
}

export function hexToRgb(hex: string): RGB {
  const norm = parseHex(hex) || '#000000'
  // 取前 6 位（忽略 alpha 通道）
  const n = parseInt(norm.slice(1, 7), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** 从 HEX（6 或 8 位）解析为 RGBA，a 为 0-1 */
export function hexToRgba(hex: string): RGBA {
  return { ...hexToRgb(hex), a: parseAlpha(hex) }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const p = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')
  return `#${p(r)}${p(g)}${p(b)}`
}

/** RGB + 透明度（0-1）→ 8 位 HEX（#RRGGBBAA） */
export function rgbToHexa({ r, g, b }: RGB, a = 1): string {
  const pa = (v: number) =>
    clamp(Math.round(v * 255), 0, 255)
      .toString(16)
      .padStart(2, '0')
  return `#${rgbToHex({ r, g, b }).slice(1)}${pa(a)}`
}

/** RGBA → 8 位 HEX */
export function rgbaToHex({ r, g, b, a }: RGBA): string {
  return rgbToHexa({ r, g, b }, a)
}

/**
 * 将 8 位 HEX 在 alpha 完全不透明（AA === 'ff'）时缩写为 6 位，便于展示与复制。
 */
export function toShortHex(hex: string): string {
  const norm = parseHex(hex)
  if (norm && norm.length === 9 && norm.endsWith('ff')) return norm.slice(0, 7)
  return norm || hex
}

// ============ RGB <-> HSV（UI 区间：h 0-360, s/v 0-100） ============

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6
    else if (max === gg) h = (bb - rr) / d + 2
    else h = (rr - gg) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s: s * 100, v: max * 100 }
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const ss = s / 100
  const vv = v / 100
  const c = vv * ss
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const m = vv - c
  let r1 = 0
  let g1 = 0
  let b1 = 0
  if (hp < 1) [r1, g1, b1] = [c, x, 0]
  else if (hp < 2) [r1, g1, b1] = [x, c, 0]
  else if (hp < 3) [r1, g1, b1] = [0, c, x]
  else if (hp < 4) [r1, g1, b1] = [0, x, c]
  else if (hp < 5) [r1, g1, b1] = [x, 0, c]
  else [r1, g1, b1] = [c, 0, x]
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  }
}

// ============ RGB <-> HSL（h 0-360, s/l 0-100） ============

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6
    else if (max === gg) h = (bb - rr) / d + 2
    else h = (rr - gg) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { h, s: s * 100, l: l * 100 }
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const ss = s / 100
  const ll = l / 100
  const c = (1 - Math.abs(2 * ll - 1)) * ss
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const m = ll - c / 2
  let r1 = 0
  let g1 = 0
  let b1 = 0
  if (hp < 1) [r1, g1, b1] = [c, x, 0]
  else if (hp < 2) [r1, g1, b1] = [x, c, 0]
  else if (hp < 3) [r1, g1, b1] = [0, c, x]
  else if (hp < 4) [r1, g1, b1] = [0, x, c]
  else if (hp < 5) [r1, g1, b1] = [x, 0, c]
  else [r1, g1, b1] = [c, 0, x]
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  }
}

/** RGB + 透明度（0-1）→ HSLA */
export function rgbToHsla({ r, g, b }: RGB, a = 1): HSLA {
  return { ...rgbToHsl({ r, g, b }), a }
}

// ============ 便捷封装 ============

export function hexToHsv(hex: string): HSV {
  return rgbToHsv(hexToRgb(hex))
}

export function hsvToHex(hsv: HSV): string {
  return rgbToHex(hsvToRgb(hsv))
}

/** HSV + 透明度（0-1）→ 8 位 HEX（#RRGGBBAA） */
export function hsvToHexa(hsv: HSV, a = 1): string {
  return rgbToHexa(hsvToRgb(hsv), a)
}

export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex))
}

export function hslToHex(hsl: HSL): string {
  return rgbToHex(hslToRgb(hsl))
}

/** 旋转色相（保持 s/v 不变），结果归一化到 0-360 */
export function rotateHue(hsv: HSV, deg: number): HSV {
  return { ...hsv, h: (hsv.h + deg + 360) % 360 }
}

// ============ 配色方案生成 ============

/**
 * 基于基准色生成配色方案。
 * 返回 HSV 数组（含基准色本身），由调用方负责转 HEX。
 */
export function generateHarmony(base: HSV, type: HarmonyType): HSV[] {
  switch (type) {
    case 'complementary':
      return [base, rotateHue(base, 180)]
    case 'analogous':
      return [rotateHue(base, -30), base, rotateHue(base, 30)]
    case 'triadic':
      return [base, rotateHue(base, 120), rotateHue(base, 240)]
    case 'splitComplementary':
      return [base, rotateHue(base, 150), rotateHue(base, 210)]
    case 'tetradic':
      return [base, rotateHue(base, 90), rotateHue(base, 180), rotateHue(base, 270)]
    case 'rectangle':
      // 两组互补色但角度不等（基色 + 互补，再各偏移 30°），4 色
      return [
        base,
        rotateHue(base, 30),
        rotateHue(base, 180),
        rotateHue(base, 210),
      ]
    case 'doubleSplit':
      // 基色两侧 ±30° 与互补两侧 ±30°，共 5 色
      return [
        base,
        rotateHue(base, 30),
        rotateHue(base, -30),
        rotateHue(base, 150),
        rotateHue(base, 210),
      ]
    case 'accentedAnalogous':
      // 相邻类色 ±30° + 1 个互补色作强调，共 4 色
      return [base, rotateHue(base, 30), rotateHue(base, -30), rotateHue(base, 180)]
    case 'diadic':
      // 柔和双色：基色与基色 +60°
      return [base, rotateHue(base, 60)]
    case 'monochromatic': {
      // 同色相，按明度/饱和度生成 5 个梯度
      const out: HSV[] = []
      const steps = [0.35, 0.55, 0.75, 0.9, 1]
      for (const f of steps) {
        out.push({
          h: base.h,
          s: clamp(base.s * (0.6 + f * 0.5), 0, 100),
          v: clamp(base.v * f + (1 - f) * 30, 0, 100),
        })
      }
      return out
    }
    default:
      return [base]
  }
}

// ============ WCAG 对比度 ============

const srgbToLinear = (c: number) => {
  const cs = c / 255
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
}

/** 相对亮度（0-1） */
/**
 * 颜色命名：在 NAMED_COLORS 中找 RGB 欧氏距离最近的命名色。
 * @returns 名称、标准色值、偏差（0-441，越小越接近）
 */
export function nearestColorName(hex: string): { name: string; hex: string; distance: number } {
  const t = hexToRgb(hex)
  let bestName = NAMED_COLORS[0][0]
  let bestHex = NAMED_COLORS[0][1]
  let bestD = Infinity
  for (const [name, c] of NAMED_COLORS) {
    const rgb = hexToRgb(c)
    const d = (rgb.r - t.r) ** 2 + (rgb.g - t.g) ** 2 + (rgb.b - t.b) ** 2
    if (d < bestD) {
      bestD = d
      bestName = name
      bestHex = c
    }
  }
  return { name: bestName, hex: bestHex, distance: Math.sqrt(bestD) }
}

export function relativeLuminance({ r, g, b }: RGB): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

/**
 * 将带透明度的前景色按 alpha 合成到不透明背景上，得到实际可见的 RGB。
 * 用于对比度/色盲等需要「透明叠底」效果的场合。
 */
export function compositeAlpha(fg: RGBA, bg: RGB): RGB {
  const a = clamp(fg.a, 0, 1)
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  }
}

/** 两个颜色之间的对比度比值（1-21） */
export function contrastRatio(rgb1: RGB, rgb2: RGB): number {
  const l1 = relativeLuminance(rgb1)
  const l2 = relativeLuminance(rgb2)
  const a = Math.max(l1, l2)
  const b = Math.min(l1, l2)
  return (a + 0.05) / (b + 0.05)
}

export interface WcagResult {
  /** 普通文本 AA（>=4.5） */
  AA: boolean
  /** 大号文本 AA（>=3） */
  AALarge: boolean
  /** 普通文本 AAA（>=7） */
  AAA: boolean
  /** 大号文本 AAA（>=4.5） */
  AAALarge: boolean
  ratio: number
}

export function wcag(level: number): WcagResult {
  return {
    ratio: level,
    AA: level >= 4.5,
    AALarge: level >= 3,
    AAA: level >= 7,
    AAALarge: level >= 4.5,
  }
}

// ============ 色盲模拟（Brettel/Viénot 近似矩阵，作用于线性 RGB） ============

const CB_MATRIX: Record<ColorBlindType, [number, number, number, number, number, number, number, number, number]> = {
  // [r_out, g_out, b_out] = M · [r_lin, g_lin, b_lin]
  protanopia: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
  deuteranopia: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
  tritanopia: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
}

const linearToSrgb = (c: number) => {
  const v = clamp(c, 0, 1)
  return (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255
}

/** 将 RGB 按指定色盲类型模拟后的近似颜色 */
export function simulateColorBlind(rgb: RGB, type: ColorBlindType): RGB {
  const r = srgbToLinear(rgb.r)
  const g = srgbToLinear(rgb.g)
  const b = srgbToLinear(rgb.b)
  const m = CB_MATRIX[type]
  return {
    r: Math.round(linearToSrgb(m[0] * r + m[1] * g + m[2] * b)),
    g: Math.round(linearToSrgb(m[3] * r + m[4] * g + m[5] * b)),
    b: Math.round(linearToSrgb(m[6] * r + m[7] * g + m[8] * b)),
  }
}

// ============ 导出文本生成 ============

/** 生成 CSS 变量（:root { --color-1: #xxx }） */
export function toCssVariables(colors: string[], prefix = 'color'): string {
  const lines = colors.map((c, i) => `  --${prefix}-${i + 1}: ${c};`)
  return `:root {\n${lines.join('\n')}\n}`
}

/** 生成 SCSS 变量 */
export function toScss(colors: string[], prefix = 'color'): string {
  return colors.map((c, i) => `$${prefix}-${i + 1}: ${c};`).join('\n')
}

/** 生成 JSON（与主题皮肤兼容，含 alpha / rgba 字段） */
export function toJson(colors: string[], name = 'palette'): string {
  const obj = {
    name,
    colors: colors.map((c, i) => {
      const rgba = hexToRgba(c)
      return {
        id: i + 1,
        hex: c,
        alpha: Math.round(rgba.a * 100) / 100,
        rgba: `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`,
      }
    }),
  }
  return JSON.stringify(obj, null, 2)
}

// ============ OkLab / OkLCH（感知均匀色彩空间） ============
// 与 HSL/HSV 不同，Oklab 在视觉上近似均匀：在 Oklab 中做明度插值或颜色混合，
// 中间色不会像 HSL/HSV 那样发灰、发暗，是专业配色引擎（色阶、渐变、混合）的标配。
// 公式采用 Björn Ottosson 公布的官方矩阵。

/** OkLab 颜色：L 亮度 ~0-1，a/b 为对抗色轴（无界，通常 -0.4~0.4） */
export interface OKLab {
  L: number
  a: number
  b: number
}

/** OkLCH 颜色：L 亮度，C 彩度（>=0），H 色相角（度，0-360） */
export interface OKLCH {
  L: number
  C: number
  H: number
}

/** sRGB 单通道（0-1）线性化（gamma 解码） */
function srgbChannelToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** 线性 RGB 单通道（0-1）→ sRGB（0-1，gamma 编码），不做钳制（供色域检测） */
function linearToSrgbChannelUnclamped(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/** RGB(0-255) → OkLab */
export function rgbToOklab({ r, g, b }: RGB): OKLab {
  const rL = srgbChannelToLinear(r / 255)
  const gL = srgbChannelToLinear(g / 255)
  const bL = srgbChannelToLinear(b / 255)
  const l = 0.4122214708 * rL + 0.5363325363 * gL + 0.0514459929 * bL
  const m = 0.2119034982 * rL + 0.6806995451 * gL + 0.1073969566 * bL
  const s = 0.0883024619 * rL + 0.2817188376 * gL + 0.6299787005 * bL
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  }
}

/** OkLab → RGB(0-255) */
export function oklabToRgb({ L, a, b }: OKLab): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_
  const rL = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const gL = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bL = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  return {
    r: clamp(Math.round(linearToSrgbChannelUnclamped(rL) * 255), 0, 255),
    g: clamp(Math.round(linearToSrgbChannelUnclamped(gL) * 255), 0, 255),
    b: clamp(Math.round(linearToSrgbChannelUnclamped(bL) * 255), 0, 255),
  }
}

/** OkLab → OkLCH */
export function oklabToOklch({ L, a, b }: OKLab): OKLCH {
  const C = Math.sqrt(a * a + b * b)
  let H = (Math.atan2(b, a) * 180) / Math.PI
  if (H < 0) H += 360
  return { L, C, H }
}

/** OkLCH → OkLab */
export function oklchToOklab({ L, C, H }: OKLCH): OKLab {
  const hr = (H * Math.PI) / 180
  return { L, a: C * Math.cos(hr), b: C * Math.sin(hr) }
}

/** HEX → OkLCH（忽略 alpha 通道，按 RGB 计算） */
export function hexToOklch(hex: string): OKLCH {
  return oklabToOklch(rgbToOklab(hexToRgb(hex)))
}

/** OkLCH → HEX（6 位，色阶/导出均不透明） */
export function oklchToHex({ L, C, H }: OKLCH): string {
  return rgbToHex(oklabToRgb(oklchToOklab({ L, C, H })))
}

/**
 * 将 OkLCH 颜色钳制进 sRGB 色域：保持 L/H 不变，从 C 起逐步衰减彩度，
 * 直到 r/g/b 都在 [0,1] 范围内。避免高彩度浅/深色溢出导致色彩失真。
 */
export function gamutClipOklch({ L, C, H }: OKLCH): OKLCH {
  const toRaw = (cc: number) => {
    const { a, b } = oklchToOklab({ L, C: cc, H })
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b
    const s_ = L - 0.0894841775 * a - 1.291485548 * b
    const l = l_ * l_ * l_
    const m = m_ * m_ * m_
    const s = s_ * s_ * s_
    const rL = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    const gL = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    const bL = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    return { r: linearToSrgbChannelUnclamped(rL), g: linearToSrgbChannelUnclamped(gL), b: linearToSrgbChannelUnclamped(bL) }
  }
  let cc = C
  let raw = toRaw(cc)
  let guard = 0
  while ((raw.r < 0 || raw.r > 1 || raw.g < 0 || raw.g > 1 || raw.b < 0 || raw.b > 1) && cc > 0.0002 && guard < 40) {
    cc *= 0.9
    raw = toRaw(cc)
    guard++
  }
  return { L, C: cc, H }
}

/**
 * 基于基准色生成 Tailwind 风格色阶（50–950 共 11 档）。
 * 固定基色的色相 H 与彩度 C，沿 OKLCH 亮度 L 轴取 Tailwind 实测感知亮度曲线扫出各档；
 * 浅/深档按光照明度自适应收敛彩度并做色域钳制，保证每档都是合法 HEX 且观感均匀。
 */
export function generateScale(baseHex: string): { step: number; hex: string }[] {
  const base = hexToOklch(baseHex)
  // 各档目标亮度（OKLCH L），取自 Tailwind 调色板实测感知明度
  const ramp: [number, number][] = [
    [50, 0.975],
    [100, 0.925],
    [200, 0.855],
    [300, 0.785],
    [400, 0.705],
    [500, 0.625],
    [600, 0.525],
    [700, 0.435],
    [800, 0.345],
    [900, 0.255],
    [950, 0.185],
  ]
  // 彩度随亮度收敛系数：极浅/极深档彩度需压低，否则易溢出 sRGB 色域
  const chromaFactor = (L: number): number => {
    if (L >= 0.95) return 0.2
    if (L >= 0.88) return 0.4
    if (L <= 0.2) return 0.3
    if (L <= 0.3) return 0.55
    return 1
  }
  return ramp.map(([step, L]) => {
    const clipped = gamutClipOklch({ L, C: base.C * chromaFactor(L), H: base.H })
    return { step, hex: oklchToHex(clipped) }
  })
}

/** 在 OkLab 空间对两个颜色做线性插值（t: 0-1），用于感知均匀的渐变/混合 */
export function mixOklab(c1: OKLab, c2: OKLab, t: number): OKLab {
  return {
    L: c1.L + (c2.L - c1.L) * t,
    a: c1.a + (c2.a - c1.a) * t,
    b: c1.b + (c2.b - c1.b) * t,
  }
}
