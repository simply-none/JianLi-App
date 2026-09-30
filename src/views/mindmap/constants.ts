/**
 * 思维导图 —— 常量集中处（间距 / 尺寸 / 文案 / 色板 / 快捷键说明）。
 *
 * ⚠️ 与 `components/MindNode.vue` 的 CSS 存在**数值耦合**：
 *   `NODE_MIN_WIDTH` / `NODE_MAX_WIDTH` / `NODE_PADDING_X/Y` / `fontSizeOf()`
 *   必须与节点样式（字号、内边距、max-width）保持一致，否则首帧估算尺寸会明显偏离实测值
 *   （虽然第二段布局会修正，但首帧跳动会很难看）。改一侧请同步另一侧。
 */

import type { MindBranchColor, MindLayoutDir, MindSide } from './types'

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

/**
 * 首帧尺寸估算参数（实测尺寸就绪前的兜底）。
 * 全角字符按 1 em 估、半角按 asciiRatio 估 —— 中文场景下是最接近的近似，
 * 英文文本会略微高估，但可接受：估算只用于「第一帧不要挤成一团」，
 * 第二段布局立刻用实测值覆盖。
 */
export const ESTIMATE = {
  asciiRatio: 0.55,
  lineHeight: 20,
  minWidth: NODE_MIN_WIDTH,
  maxWidth: NODE_MAX_WIDTH,
  paddingX: NODE_PADDING_X,
  paddingY: NODE_PADDING_Y,
} as const

/** 各层级字号（与 MindNode.vue 的 CSS 同步） */
export function fontSizeOf(level: number): number {
  if (level <= 0) return 15
  if (level === 1) return 13.5
  return 13
}

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
 * 可选的**分支色**。
 * 只暴露 key，实际颜色在 `MindCanvas.vue` 的非 scoped 样式块里用主题令牌派生
 * （`--mm-branch-blue` 等），因此换主题时节点与连线会一起变，不需要改任何数据。
 */
export const BRANCH_COLORS: { value: MindBranchColor; label: string }[] = [
  { value: 'blue', label: '蓝' },
  { value: 'teal', label: '青' },
  { value: 'green', label: '绿' },
  { value: 'amber', label: '琥珀' },
  { value: 'coral', label: '珊瑚' },
  { value: 'purple', label: '紫' },
]

/** 合法分支色集合（反序列化时用于校验，挡住手改 JSON 塞进来的脏值） */
export const BRANCH_COLOR_VALUES: MindBranchColor[] = BRANCH_COLORS.map((item) => item.value)

/** 分支色 → CSS 变量引用（节点与连线共用，保证两者同色） */
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
]

/** 合法布局方向集合（反序列化时用于校验） */
export const LAYOUT_DIR_VALUES: MindLayoutDir[] = LAYOUT_OPTIONS.map((item) => item.value)

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
  { group: '节点', keys: 'Tab', desc: '为选中节点添加子节点' },
  { group: '节点', keys: 'Enter', desc: '添加同级节点（根节点则添加子节点）' },
  { group: '节点', keys: 'F2 / 双击', desc: '重命名选中节点' },
  { group: '节点', keys: 'Delete / Backspace', desc: '删除选中节点及其子树' },
  { group: '节点', keys: 'Space', desc: '折叠 / 展开选中节点' },
  { group: '节点', keys: '↑ / ↓', desc: '在兄弟节点间移动选中' },
  { group: '节点', keys: '← / →', desc: '跳到父节点 / 第一个子节点' },

  { group: '文档', keys: 'Ctrl + S', desc: '保存到本地数据库' },
  { group: '文档', keys: 'Ctrl + Z', desc: '撤销' },
  { group: '文档', keys: 'Ctrl + Shift + Z / Ctrl + Y', desc: '重做' },

  { group: '视图', keys: 'Ctrl + F', desc: '打开 / 关闭节点搜索' },
  { group: '视图', keys: 'Ctrl + 0', desc: '画布适应内容' },
  { group: '视图', keys: 'Ctrl + A', desc: '折叠全部 / 再按展开全部' },
]

/** 分组标题的展示顺序（与 SHORTCUT_HINTS 的书写顺序一致） */
export const SHORTCUT_GROUPS: string[] = ['节点', '文档', '视图']
