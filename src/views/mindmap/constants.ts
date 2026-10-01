/**
 * 思维导图 —— 常量集中处（间距 / 尺寸 / 文案 / 色板 / 快捷键说明）。
 *
 * ⚠️ 与 `components/MindNode.vue` 的 CSS 存在**数值耦合**：
 *   `NODE_MIN_WIDTH` / `NODE_MAX_WIDTH` / `NODE_PADDING_X/Y` / `fontSizeOf()`
 *   必须与节点样式（字号、内边距、max-width）保持一致，否则首帧估算尺寸会明显偏离实测值
 *   （虽然第二段布局会修正，但首帧跳动会很难看）。改一侧请同步另一侧。
 */

import type { MindBranchColor, MindColorKey, MindLayoutDir, MindSide } from './types'

/** vue-flow 实例 id：**必须**显式指定，避免与「流程图」模块的默认 store 互相污染 */
export const MINDMAP_FLOW_ID = 'mindmap'

/** 数据表名 */
export const MINDMAP_TABLE = 'mindmap'

/** 表 `mindmap` 的主键 */
export const MINDMAP_PRIMARY_KEY = 'id'

/** 树结构版本号 */
export const MIND_DOC_VERSION = 1

/** 文档默认名 / 根节点默认文本 */
export const DEFAULT_DOC_NAME = '未命名导图'
export const DEFAULT_ROOT_TEXT = '中心主题'

/** 新建子节点时的默认文本（随即进入编辑态，用户直接覆盖即可） */
export const DEFAULT_CHILD_TEXT = '新主题'

/** 单个节点文本长度上限（防御性，避免超长文本把画布撑爆） */
export const MAX_NODE_TEXT_LEN = 200

/** 单个节点备注长度上限 */
export const MAX_NOTE_LEN = 1000

/** 撤销栈上限（超出丢弃最旧的一条） */
export const MAX_HISTORY = 80

/** 节点尺寸上下限（与 MindNode.vue 的 CSS 对应） */
export const NODE_MIN_WIDTH = 72
export const NODE_MAX_WIDTH = 264
export const NODE_MIN_HEIGHT = 34

/**
 * 节点图标（emoji）占用的水平宽度 —— 含它右侧的间距。
 * ⚠️ 与 `MindNode.vue` 里 `.mind-node__icon` 的 `font-size` + `gap` 存在**数值耦合**：
 *    图标盒 18px + 与文本之间 6px = 24px。只改一侧会让首帧估算与实测差出 24px。
 */
export const NODE_ICON_WIDTH = 24

/** 节点图标最多允许的**码点数**（emoji 是代理对，不能用 `.length` 数） */
export const MAX_ICON_CODEPOINTS = 4

/** 链接长度上限（防御性） */
export const MAX_LINK_LEN = 500

/** 单次「导出为待办」最多生成多少条（超出截断，避免一次写爆待办表） */
export const MAX_EXPORT_TODOS = 200

/** 内边距（节点盒） */
export const NODE_PADDING_X = 14
export const NODE_PADDING_Y = 8

/* ------------------------------------------------------------------ 间距 */

/** 左右类布局：层级之间的水平间距 */
export const H_GAP = 56
/** 左右类布局：兄弟节点之间的垂直间距 */
export const V_GAP = 12
/** `down` 布局：兄弟节点之间的水平间距（比 V_GAP 宽一些，横向排开才不会挤） */
export const VERT_SIBLING_GAP = 24
/** `down` 布局：层级之间的垂直间距 */
export const VERT_LEVEL_GAP = 44
/** 鱼骨图：主干上相邻两根支骨的起点间距 */
export const FISHBONE_GAP = 120
/** 鱼骨图：支骨的竖直投影长度（斜率 45° ⇒ 水平投影同值） */
export const FISHBONE_RISE = 96
/** 时间轴：主轴相邻两个里程碑的间距 */
export const TIMELINE_GAP = 132
/** 时间轴：一层节点离主轴的竖直距离（上/下交错） */
export const TIMELINE_OFFSET = 64

/**
 * 首帧尺寸估算参数（实测尺寸就绪前的兜底）。
 * 全角字符按 1 em 估、半角按 asciiRatio 估 —— 中文场景下是最接近的近似，
 * 英文文本会略微高估，但可接受：估算只用于「第一帧不要挤成一团」，
 * 第二段布局立刻用实测值覆盖。
 */
export const ESTIMATE = {
  asciiRatio: 0.55,
  /**
   * **默认字号（13px）下的单行行高估计值**。
   *
   * ⚠️ 它不是一个「干净」的数（`line-height: 1.4` 推算出来应该是 18.2），
   *    而是**含了节点 1px 上下边框补偿**的经验值：实测 `.mind-node` 的 `offsetHeight`
   *    = 上下内边距 16 + 上下边框 2 + 行盒 1.4×字号 ⇒ 默认态 36.2 → 36，
   *    而 `ceil(lineHeight + paddingY×2)` 用 20 恰好也得到 36 ⇒ **默认态估算与实测逐像素相等**。
   *    若改成 1.4×字号，默认态反而会少 1~2px（丢失了那 2px 边框）。
   *    （对照断言见 `C:\src\tmp\mm_fontsync_test.cjs` 的 E 组：估算 vs 真实 `offsetHeight`。）
   *
   * 消费侧（`utils/measure.ts`）会按 `字号 / DEFAULT_FONT_SIZE` **等比缩放**它 ——
   * 所以它恒等于「字号 = 13 时的行高」，改这个数只影响默认态。
   * 估算只决定**首帧**观感，第二段布局一律用实测值，因此它不参与任何持久化数据。
   */
  lineHeight: 20,
  minWidth: NODE_MIN_WIDTH,
  maxWidth: NODE_MAX_WIDTH,
  paddingX: NODE_PADDING_X,
  paddingY: NODE_PADDING_Y,
} as const

/* ------------------------------------------------------------------ 字号 */

/**
 * **基准字号（px）** = 二级及更深层级节点的字号；根 / 一级相对它各加一个固定增量。
 *
 * 为什么写成「基准 + 增量」而不是三档写死：字号要能**全图统一调**（画布右上角「设置」）。
 * 写成增量后 `fontSizeOf(level, 13)` 恰好等于 15 / 13.5 / 13 —— 与改造前**逐像素一致**，
 * 所以老数据零迁移，库里也不需要存一个「默认字号」占位。
 */
export const DEFAULT_FONT_SIZE = 13

/** 基准字号的调整区间：再小读不清、再大节点之间会互相压 */
export const MIN_FONT_SIZE = 10
export const MAX_FONT_SIZE = 24

/** 根 / 一级相对基准的增量（⇒ 默认态正好是 15 / 13.5） */
const FONT_STEP_ROOT = 2
const FONT_STEP_L1 = 0.5

/** 字号档位元信息（UI 的滑块用；`step` 允许半档，避免只能整数级跳） */
export const FONT_SIZE_RANGE = { min: MIN_FONT_SIZE, max: MAX_FONT_SIZE, step: 0.5 } as const

/**
 * 把任意输入夹进合法字号区间。
 * ⚠️ 非有限数（含 `NaN` / `Infinity` / 字符串 / `undefined`）一律回落 `DEFAULT_FONT_SIZE` ——
 *    这是**反序列化**（手改 JSON）与**调用方传参**共用的唯一一道闸，别在两处各写一份。
 */
export function clampFontSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_FONT_SIZE
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value))
}

/**
 * 各层级字号（与 `MindNode.vue` 的内联 `font-size` 同步）。
 *
 * @param level 可见树深度（根 = 0）
 * @param base  文档级基准字号（`MindDocData.fontSize`）；缺省 / `undefined` = `DEFAULT_FONT_SIZE`
 */
export function fontSizeOf(level: number, base: number = DEFAULT_FONT_SIZE): number {
  const size = clampFontSize(base)
  if (level <= 0) return size + FONT_STEP_ROOT
  if (level === 1) return size + FONT_STEP_L1
  return size
}

/** 字体族字符串长度上限（防御性：挡住手改 JSON 塞进来的超长串） */
export const MAX_FONT_FAMILY_LEN = 120

/**
 * 「跟随应用字体」的哨兵值（画布设置字体下拉的第一项）。
 *
 * ⚠️ 它**不会**被写进文档数据：`utils/tree.ts` 的 `normalizeFontFamily` 把它归一成
 *    `undefined`，渲染侧于是完全不覆盖 `font-family`（继承应用的全局字体）。
 *    选这个词是因为它同时是一条合法 CSS 关键字，语义不会歧义。
 */
export const FONT_INHERIT_VALUE = 'inherit'

/** 各层级字重（与 MindNode.vue 的 CSS 同步） */
export function fontWeightOf(level: number): number {
  return level <= 1 ? 600 : 400
}

/* ------------------------------------------------------------------ Handle */

/**
 * Handle id 约定 —— **节点组件与边必须共用这一套常量**，否则连线会飞到错误的位置。
 * 命名：`{left|right|top|bottom}{In|Out}`，In = 作为目标的落点，Out = 作为源头的起点。
 * 左右两对给 `both` / `right` / `left` 用，上下两对给 `down` 用。
 */
export const HANDLE = {
  rightOut: 'r-out',
  rightIn: 'r-in',
  leftOut: 'l-out',
  leftIn: 'l-in',
  bottomOut: 'b-out',
  topIn: 't-in',
} as const

/** 该布局方向是否使用左右 Handle（`down` 用上下） */
export function isHorizontalLayout(dir: MindLayoutDir): boolean {
  return dir !== 'down'
}

/**
 * 某条边的两端 Handle。
 * - `down`：父「下出」连子「上入」；
 * - 其余按子节点相对根的侧向：右侧 → 父「右出」连子「左入」，左侧镜像。
 *
 * ⚠️ **必须与 `nodeHandles()` 保持自洽**：边的两端 id 必须是父 / 子节点真实渲染出来的
 *    Handle，否则 vue-flow 的 `getEdgeHandle()` 会 `find` 不到并返回 `null`，
 *    而 `getHandlePosition()` 在 handle 为 null 时会**兜底成「节点顶部正中」（target）
 *    / 「节点底部正中」（source）** —— 不报错、不告警，只是连线忽然挂到节点上下边缘上，
 *    看起来像「线跑到节点头顶绕过去」。
 *    （本项目踩过一次：`MindNode.vue` 的 target 判定条件写反，所有子节点的入线都被
 *      兜底到了上边缘正中。见 `nodeHandles` 的断言。）
 *
 * @param dir  当前布局方向
 * @param side 子节点相对根的侧向（`down` 布局下无意义）
 */
export function edgeHandles(
  dir: MindLayoutDir,
  side: MindSide,
): { sourceHandle: string; targetHandle: string } {
  if (dir === 'down') {
    return { sourceHandle: HANDLE.bottomOut, targetHandle: HANDLE.topIn }
  }
  return side === 'left'
    ? { sourceHandle: HANDLE.leftOut, targetHandle: HANDLE.rightIn }
    : { sourceHandle: HANDLE.rightOut, targetHandle: HANDLE.leftIn }
}

/** 一个节点实际渲染出来的 Handle id（按类型分组） */
export interface MindNodeHandles {
  /** source 型 Handle id（该节点作为边起点时用） */
  source: string[]
  /** target 型 Handle id（该节点作为边落点时用） */
  target: string[]
}

/**
 * 某个节点**实际渲染哪些 Handle** —— 这里是 Handle 的**唯一真相**，
 * `MindNode.vue` 只负责按它渲染，`edgeHandles()` 只负责取其中两个。
 *
 * 渲染矩阵：
 * | 布局 | 节点 | source | target |
 * |---|---|---|---|
 * | 左右类 | 根 | `l-out` + `r-out`（两侧都长，且无父可连） | — |
 * | 左右类 | 右侧子节点 | `r-out` | `l-in`（父在左，落到左侧） |
 * | 左右类 | 左侧子节点 | `l-out` | `r-in`（父在右，落到右侧） |
 * | 向下 | 根 | `b-out` | — |
 * | 向下 | 子节点 | `b-out` | `t-in` |
 *
 * ⚠️ 左右类里「子节点的 target 在**父那一侧**」是最容易写反的一点：
 *    右侧子节点的父在它左边 ⇒ target 是 `l-in`；左侧子节点反之。
 *    写反了不会报错，只会让连线落到上边缘正中（见 `edgeHandles` 的说明）。
 */
export function nodeHandles(isRoot: boolean, side: MindSide, dir: MindLayoutDir): MindNodeHandles {
  if (dir === 'down') {
    return {
      source: [HANDLE.bottomOut],
      target: isRoot ? [] : [HANDLE.topIn],
    }
  }
  if (isRoot) {
    return { source: [HANDLE.leftOut, HANDLE.rightOut], target: [] }
  }
  return side === 'left'
    ? { source: [HANDLE.leftOut], target: [HANDLE.rightIn] }
    : { source: [HANDLE.rightOut], target: [HANDLE.leftIn] }
}

/* ------------------------------------------------------------------ 色板 */

/**
 * 可选的主题色板（分支色 / 背景色 / 文字色**共用同一套 6 色**）。
 * 只暴露 key，实际颜色在 `styles/palette.scss` 里用主题令牌派生
 * （`--mm-tone-blue` 等），因此换主题时节点与连线会一起变，不需要改任何数据。
 *
 * 为什么三个语义共用一份列表：它们本来就是「同一个色 dim 下的三种用法」
 * （描边 / 铺底 / 文字），共用之后右键菜单与属性弹窗可以遍历同一个数组渲染色板，
 * 加一色只需改这里一处。
 */
export const MIND_COLORS: { value: MindColorKey; label: string }[] = [
  { value: 'blue', label: '蓝' },
  { value: 'teal', label: '青' },
  { value: 'green', label: '绿' },
  { value: 'amber', label: '琥珀' },
  { value: 'coral', label: '珊瑚' },
  { value: 'purple', label: '紫' },
]

/** 合法色 key 集合（反序列化时用于校验，挡住手改 JSON 塞进来的脏值） */
export const MIND_COLOR_VALUES: MindColorKey[] = MIND_COLORS.map((item) => item.value)

/** 色 key → 实色 CSS 变量引用（分支描边、色条、文字色共用） */
export function toneVar(color: MindColorKey): string {
  return `var(--mm-tone-${color})`
}

/**
 * 色 key → **低透铺底**色 CSS 变量引用（背景色专用）。
 * 实色直接当背景会把压在上面的文字吃掉，所以背景色一律走 `-soft` 这一组
 * （实色与主题卡片底 color-mix 出来的「淡淡一层」）。
 */
export function toneSoftVar(color: MindColorKey): string {
  return `var(--mm-tone-${color}-soft)`
}

/**
 * 分支色 → CSS 变量引用（节点描边 / 色条与连线共用，保证两者同色）。
 * 与 `toneVar` 指向的是同一个实色（`--mm-branch-*` 是 `--mm-tone-*` 的别名），
 * 保留独立命名只是为了让「分支」这个语义在代码里可读。
 */
export function branchVar(color: MindBranchColor): string {
  return `var(--mm-branch-${color})`
}

/* ---------------------------------------------------------------- 布局选项 */

/** 布局方向的可选项（工具条分段按钮用） */
export const LAYOUT_OPTIONS: { value: MindLayoutDir; label: string }[] = [
  { value: 'both', label: '左右' },
  { value: 'right', label: '右向' },
  { value: 'left', label: '左向' },
  { value: 'down', label: '向下' },
  { value: 'fishbone', label: '鱼骨' },
  { value: 'timeline', label: '时间轴' },
]

/** 合法布局方向集合（反序列化时用于校验） */
export const LAYOUT_DIR_VALUES: MindLayoutDir[] = LAYOUT_OPTIONS.map((item) => item.value)

/**
 * 该方向的边是否画直线（而不是贝塞尔）。
 * 鱼骨图的支骨是**斜直线**，用贝塞尔会把「骨」画弯，一眼就不像鱼骨了。
 * ⚠️ 这个判断同时被画布（`useMindGraph` 的 edge.type）与 SVG 导出（`svgExport.curvePath`）
 *    消费，改这里两处一起变，不会出现「屏幕上是斜线、导出变成弧线」。
 */
export function isStraightEdge(dir: MindLayoutDir): boolean {
  return dir === 'fishbone'
}

/** 工具条「布局」分段按钮在窄窗口下需要换行，这里给出每行最多几个（纯展示用） */
export const LAYOUT_BUTTONS_PER_ROW = 6

/* ---------------------------------------------------------------- 快捷键 */

/** 一条快捷键说明（帮助弹窗按 group 分组渲染） */
export interface MindShortcutHint {
  /** 分组标题 */
  group: string
  /** 按键展示文案 */
  keys: string
  /** 行为说明 */
  desc: string
}

/**
 * 快捷键说明。
 * ⚠️ 必须与 `useMindShortcuts` 的实际绑定保持一致 —— 帮助弹窗直接渲染这份文案，
 *    不存在「文档写了但没实现」或「改了按键忘了改说明」的问题。
 */
export const SHORTCUT_HINTS: MindShortcutHint[] = [
  { group: '节点', keys: '节点上右键', desc: '打开节点操作菜单（子节点 / 同级 / 复制 / 剪切 / 颜色…）' },
  { group: '节点', keys: 'Tab', desc: '为选中节点添加子节点' },
  { group: '节点', keys: 'Enter', desc: '添加同级节点（根节点则添加子节点）' },
  { group: '节点', keys: 'F2 / 双击', desc: '重命名选中节点' },
  { group: '节点', keys: 'Delete / Backspace', desc: '删除选中节点及其子树' },
  { group: '节点', keys: 'Space', desc: '折叠 / 展开选中节点' },
  { group: '节点', keys: '↑ / ↓', desc: '在兄弟节点间移动选中' },
  { group: '节点', keys: '← / →', desc: '跳到父节点 / 第一个子节点' },
  { group: '节点', keys: 'Ctrl + C / X / V', desc: '复制 / 剪切子树、粘贴为选中节点的子节点（剪贴板跨文档共享）' },
  { group: '节点', keys: '双击空白处', desc: '在最近的节点下新建子节点' },
  { group: '节点', keys: 'Shift + 拖拽空白', desc: '框选多个节点（Delete 批量删除，色板批量改色）' },
  { group: '节点', keys: '拖到目标节点上松手', desc: '把该节点（含子树）挂为目标节点的子节点' },

  { group: '文档', keys: 'Ctrl + S', desc: '保存到本地数据库' },
  { group: '文档', keys: 'Ctrl + Z', desc: '撤销' },
  { group: '文档', keys: 'Ctrl + Shift + Z / Ctrl + Y', desc: '重做' },

  { group: '视图', keys: 'Ctrl + F', desc: '打开 / 关闭节点搜索' },
  { group: '视图', keys: 'Ctrl + 0', desc: '画布适应内容' },
  { group: '视图', keys: 'Ctrl + A', desc: '折叠全部 / 再按展开全部' },
  { group: '视图', keys: 'Ctrl + Shift + O', desc: '打开 / 关闭左侧大纲' },
]

/** 分组标题的展示顺序（与 SHORTCUT_HINTS 的书写顺序一致） */
export const SHORTCUT_GROUPS: string[] = ['节点', '文档', '视图']

/* ---------------------------------------------------------------- 视图偏好 */

/**
 * MiniMap 开关的 localStorage 键。
 * ⚠️ 刻意**不进 `mindmap` 表的数据**：缩略图开不开是「这台机器上我喜欢怎么看」，
 *    不是文档内容 —— 同一份导图在别人的机器上应该按别人的偏好渲染。
 *    这与 ebook 的阅读设置走 localStorage 是同一个惯例。
 */
export const MINIMAP_STORAGE_KEY = 'mindmap:minimap-open'

/** 大纲面板宽度（px）；`index.vue` 的 flex 布局与开合动画都用它 */
export const OUTLINE_WIDTH = 260

/** 节点超过这个数量时，MiniMap 默认关闭（每个节点一个 rect，大图会明显掉帧） */
export const MINIMAP_NODE_LIMIT = 300

/**
 * 跨窗口「待打开导图」的桥接键（写主进程 electron-store）。
 *
 * 命令面板跑在**独立小窗**里，两个窗口不共享 JS 运行时 —— 小窗没法直接调主窗口的
 * `useMindView.requestOpen`。链路是：小窗 `setStore`（主进程 store 两个窗口共享）
 * → 小窗发 `palette-navigate` 让主窗口切到导图页 → 导图页挂载时 `getStore` 取回 id。
 * 全程复用现成的 `get-store` / `set-store` 通道，**零主进程改动**。
 */
export const OPEN_DOC_STORE_KEY = 'mindmap:open-doc'

/* ---------------------------------------------------------------- 文案 */

/** 右键菜单 / 大纲里共用的动作文案（多处引用，避免各写一份漂移） */
export const MIND_MENU_TEXT = {
  cut: '剪切',
  copy: '复制节点',
  paste: '粘贴为子节点',
  focus: '聚焦此分支',
  unfocus: '退出聚焦',
  backToAll: '返回全图',
  exportTodos: '导出为待办',
} as const
