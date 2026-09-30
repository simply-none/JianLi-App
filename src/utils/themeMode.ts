/**
 * 主题明暗档位判定
 *
 * 背景：项目没有「当前主题是否暗色」的统一标记，`data-theme` 只存主题 ID
 * （如 `dark` / `nord` / `glass`）。需要跟随明暗做取色的模块（天气页渐变、
 * 玻璃卡片、自绘图表等）都得自己判断。
 *
 * 做法：**不手工维护主题名单**（容易与 `themeOptions` 脱节），而是读取该主题
 * 在 `chartTheme.ts` 里声明的 `cardBg`（正是一套「卡片底色」的权威声明），
 * 按相对亮度自动分档。这样日后新增主题只要在 `THEME_COLORS` 登记即自动生效。
 *
 * 也正因如此：`THEME_COLORS` 新增主题时必须同时补齐，否则会回落 light 档。
 */
import { computed, type ComputedRef } from 'vue'
import { storeToRefs } from 'pinia'
import useTheme from '@/store/useTheme'
import { THEME_COLORS } from './chartTheme'

/** 明暗档位 */
export type ThemeMode = 'light' | 'dark'

/** 相对亮度阈值：高于此值判为亮色主题，低于判为暗色 */
const LUMINANCE_THRESHOLD = 0.5

/**
 * 解析颜色字符串为 [r, g, b]（0~255）
 *
 * 支持 `#rgb` / `#rrggbb` / `rgb()` / `rgba()`，解析失败返回 null。
 * 无 alpha 通道的颜色（如 `#ffffff`）alpha 视为 1。
 * @param color 颜色字符串
 * @returns RGB 三元组，或 null（无法解析）
 */
function parseRgb(color: string): [number, number, number] | null {
  const s = String(color || '').trim()
  if (!s) return null

  // #rgb / #rrggbb
  if (s.startsWith('#')) {
    let hex = s.slice(1)
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
    if (hex.length !== 6) return null
    const n = Number.parseInt(hex, 16)
    if (Number.isNaN(n)) return null
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }

  // rgb() / rgba()
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (m) {
    return [Number(m[1]), Number(m[2]), Number(m[3])]
  }
  return null
}

/**
 * 计算颜色的相对亮度（0 = 纯黑，1 = 纯白）
 *
 * 采用 ITU-R BT.601 加权（人眼对绿最敏感），对本用途足够且计算廉价。
 * @param color 颜色字符串
 * @returns 亮度 0~1；无法解析时返回 1（按亮色处理，最保守）
 */
export function luminance(color: string): number {
  const rgb = parseRgb(color)
  if (!rgb) return 1
  const [r, g, b] = rgb
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/**
 * 判定某主题属于明档还是暗档
 *
 * 依据该主题的 `cardBg` 亮度。注意 `glass` 之类的半透明色（`rgba(30,30,50,.6)`）
 * 解析出的是其**固有色**，深紫底仍会被正确判为暗色。
 * @param theme 主题名
 * @returns `'light'` 或 `'dark'`
 */
export function themeMode(theme: string): ThemeMode {
  const colors = THEME_COLORS[theme as keyof typeof THEME_COLORS] || THEME_COLORS.light
  return luminance(colors.cardBg) >= LUMINANCE_THRESHOLD ? 'light' : 'dark'
}

/**
 * 响应式获取当前主题的明暗档位
 *
 * 主题切换时 `mode` 自动更新，可用于 `computed` 依赖与 `watch` 触发重绘。
 * @returns `mode` = 当前档位；`isDark` = 是否暗色
 */
export function useThemeMode(): {
  mode: ComputedRef<ThemeMode>
  isDark: ComputedRef<boolean>
} {
  const { currentTheme } = storeToRefs(useTheme())
  const mode = computed<ThemeMode>(() => themeMode(currentTheme.value))
  const isDark = computed(() => mode.value === 'dark')
  return { mode, isDark }
}
