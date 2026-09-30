/**
 * 天气页「玻璃底图表」配色
 *
 * 背景与动机：
 * 天气页是「动态渐变背景 + 毛玻璃卡片」，**页面自身恒为深色渐变**（亮档主题走
 * `sunny.day` 这类中深蓝，暗档走 `dayDark` 更深档）。而 `utils/chartTheme.ts` 的
 * `THEME_COLORS[theme].labelColor / axisLabel / gridLine` 是为「主题实色卡片」
 * 设计的——亮档主题下是 `#374151` / `#6b7280` / `#e5e7eb`（深灰文字 + 极浅网格）。
 * 直接搬到渐变蓝底上就会**发灰、发脏、网格几乎不可见**，与页面 `--glass-text-*`
 * 的白色文字体系完全两个口径 ⇒ 用户反馈「图表样式不协调」。
 *
 * 因此本模块**不走 `THEME_COLORS` 的文字/网格色**，改为：
 * - 图表文字层恒用白色系（与 `--glass-text-*` 同口径，随明暗档微调透明度）；
 * - 网格线用白色低透明（与 `--glass-divider` 同族，替代浅灰实色）；
 * - tooltip 恒为深色半透明玻璃 + 白字（唯一在深底与浅底上都稳的选择）；
 * - 温度 / 降水的**语义色相保留**，只按明暗档调明度（与改造前一致）。
 *
 * ⚠️ **第二轮修正（用户反馈「浅色主题下图表数据不直观」）**：
 * 光把文字改白还不够 —— **数据本身要在渐变蓝底上「跳」出来**。三条措施：
 * 1. **折线 / 折点拆成两组色**：`high`/`low` 给长线条（弱对比即可，亮档略压深），
 *    `highPoint`/`lowPoint` 给圆点与数值标签（**高明度**，亮档用 `#ffd57c`/`#cbe6ff`）。
 *    原因是亮档压深后的暖黄 `#c9971f` 与冷蓝 `#2f7fb8` 都**偏暗且与蓝底同色系**，
 *    圆点会「融进」背景（与截图里几乎看不见的浅蓝点完全吻合）。
 * 2. **区间带必须半透明**（`bandFill`）：不透明的竖条会盖住折线，越画越难读。
 * 3. **网格再压暗一档**（亮档 `.1 → .07`），把注意力让给数据而不是网格。
 *
 * 为什么是 computed 而不是读 CSS 变量：ECharts 的 option 是 JS 对象，无法承接
 * CSS 变量；页面渐变本身也是内联样式（`useWeatherTheme.backgroundStyle`），
 * 没有可供读取的「有效背景色」。故此处按 `useThemeMode()` 的明暗档取色。
 * 暗档主题的渐变更深 ⇒ 文字层级整体再提亮一档。
 */
import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useThemeMode } from '@/utils/themeMode'

/** 天气页玻璃底图表的完整配色集 */
export interface GlassChartColors {
  /** 主文字（折线数值标签） */
  text: string
  /** 次文字（图例 / x 轴标签） */
  textSoft: string
  /** 弱文字（次坐标轴标签 / 低温标签） */
  textFaint: string
  /** 网格 / 分割线 */
  grid: string
  /** tooltip 底色 */
  tooltipBg: string
  /** tooltip 边框 */
  tooltipBorder: string
  /** tooltip 文字 */
  tooltipText: string
  /** tooltip 轴指示器（折线竖线 / 柱状阴影） */
  inkSoft: string
  /** 折线点描边 */
  ink: string
  /**
   * 温差区间带的「实际有色段」填充
   *
   * ⚠️ 必须带足够透明度：区间带夹在两条折线之间，不透明会**盖住折线**，
   * 反而让数据更难看懂（用户反馈的「数据不直观」就包含这一条）。
   */
  bandFill: string
  /** 高温暖黄：**折线用**（弱对比长线条，暗档用亮暖黄最清晰） */
  high: string
  /**
   * 高温暖黄：**折点圆点 / 数值标签用**（强对比短元素）
   *
   * 亮档下 `high` 的深暖黄 `#c9971f` 压在同样偏暖的渐变蓝上对比不足，
   * 圆点与标签改用亮暖黄 `#ffd57c` 才「跳」得出来（与列表态图标口径一致）。
   */
  highPoint: string
  /** 低温冷蓝：**折线用** */
  low: string
  /**
   * 低温冷蓝：**折点圆点 / 数值标签用**
   *
   * 亮档下压深的 `low` 与蓝底同色相 ⇒ 圆点几乎「融进」背景，
   * 故圆点与标签改用高明度浅蓝 `#cbe6ff`（= CSS 侧 `--glass-precip` 暗档值）。
   */
  lowPoint: string
}

/**
 * 取天气页玻璃底图表配色（随主题明暗档响应式变化）
 * @returns 全部色值的 computed 集合
 */
export function useGlassChartColors(): ComputedRef<GlassChartColors> {
  const { isDark } = useThemeMode()

  return computed<GlassChartColors>(() => {
    const dark = isDark.value
    return {
      // 页面底恒为深色渐变：文字走白色系，暗档再提亮一档
      text: dark ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.92)',
      textSoft: dark ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.68)',
      textFaint: dark ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.5)',
      // 网格线：浅灰实色在渐变底上会「发白脏」，改用白色低透明（同 --glass-divider 族）；
      // 亮档再压低一档，避免与白色文字抢注意力（原 .1 仍偏亮）
      grid: dark ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.07)',
      // tooltip：深色玻璃底 + 白字，是深底 / 浅底上都能保证可读的通用解
      tooltipBg: dark ? 'rgba(12,18,30,0.94)' : 'rgba(20,26,40,0.9)',
      tooltipBorder: 'rgba(255,255,255,0.16)',
      tooltipText: dark ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.94)',
      inkSoft: dark ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.34)',
      ink: dark ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.75)',
      // 区间带：半透明着色，夹在双线之间只是「垫底」，不遮盖折线
      bandFill: dark ? hexToRgba('#9ecbff', 0.3) : hexToRgba('#cbe6ff', 0.36),
      // 折线：暗档用亮色，亮档略压深以在浅底上「立」住
      high: dark ? '#ffd57c' : '#e0aa3a',
      low: dark ? '#9ecbff' : '#3e93cc',
      // 折点 / 标签：亮档改用高明度色，否则深暖黄 / 冷蓝会融进渐变底
      highPoint: '#ffd57c',
      lowPoint: '#cbe6ff',
    }
  })
}

/**
 * 把 `#rgb` / `#rrggbb` 转成 `rgba()` 字符串
 *
 * 本模块内部用于派生「区间带半透明填充」等色值；非 hex 输入原样返回。
 * @param color 颜色值
 * @param alpha 透明度（0~1）
 * @returns rgba() 字符串或原值
 */
function hexToRgba(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return color
  let body = m[1]
  if (body.length === 3) body = body.replace(/./g, (ch) => ch + ch)
  const r = parseInt(body.slice(0, 2), 16)
  const g = parseInt(body.slice(2, 4), 16)
  const b = parseInt(body.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
