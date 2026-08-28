// 小窗设置页的配置清单（数据驱动）。
// 新增一个小窗只需在此追加一条 WINDOW_SECTIONS 记录，页面与逻辑无需改动。
// 注意：storeKey 必须与该小窗在 useWindowMode / 主进程里使用的 window-mode:xxx 保持一致。

/** 小窗标识：页面内索引配置与 store 的键 */
export type WindowKey =
  | 'pomodoro'
  | 'notebook'
  | 'quickNote'
  | 'todo'
  | 'themeConversation'
  | 'accounting'
  | 'stock'
  | 'clipboard'

/** 通用可选项（皮肤、排版等） */
export interface NamedOption {
  label: string
  value: string
}

/** 尺寸预设 */
export interface SizeOption {
  label: string
  width: number
  height: number
}

/** 小窗配置数据结构（与落到 basic_info 的 window-mode:xxx 内容一致） */
export interface WindowConfig {
  position: string
  width: number
  height: number
  gap: number
  x: number
  y: number
  skin?: string
  layout?: string
}

/** 区块展示哪些配置项 */
export interface SectionFields {
  position: boolean
  size: boolean
  gap: boolean
  skin: boolean
  layout: boolean
}

export interface WindowSection {
  key: WindowKey
  title: string
  /** LucideIcon 图标名 */
  icon: string
  /** 落库用的 store 键，实际写入 window-mode:{storeKey} */
  storeKey: string
  fields: SectionFields
  sizeOptions: SizeOption[]
  /** 皮肤候选项，存在且 fields.skin 为真时才渲染 */
  skinOptions?: NamedOption[]
  /** 排版候选项，存在且 fields.layout 为真时才渲染 */
  layoutOptions?: NamedOption[]
}

// —— 公共候选项 ——
export const POSITION_OPTIONS: NamedOption[] = [
  { value: 'top-left', label: '↖' },
  { value: 'center-top', label: '↑' },
  { value: 'top-right', label: '↗' },
  { value: 'center-left', label: '←' },
  { value: 'center', label: '●' },
  { value: 'center-right', label: '→' },
  { value: 'bottom-left', label: '↙' },
  { value: 'center-bottom', label: '↓' },
  { value: 'bottom-right', label: '↘' },
]

export const GAP_OPTIONS: number[] = [10, 20, 30, 50]

export const SKIN_OPTIONS: NamedOption[] = [
  { label: '默认(白)', value: 'white' },
  { label: '珊瑚橙', value: 'coral' },
  { label: '薄荷绿', value: 'mint' },
  { label: '星空蓝', value: 'sky' },
  { label: '薰衣草', value: 'lavender' },
  { label: '樱花粉', value: 'sakura' },
  { label: '琥珀金', value: 'amber' },
  { label: '暗夜黑', value: 'dark' },
  { label: '薄雾灰', value: 'gray' },
  { label: '极光青', value: 'aurora' },
]

// —— 各小窗的尺寸预设 ——
const POMODORO_SIZE_OPTIONS: SizeOption[] = [
  { label: '108×81', width: 108, height: 81 },
  { label: '200×100', width: 200, height: 100 },
  { label: '300×150', width: 300, height: 150 },
]

const NOTEBOOK_SIZE_OPTIONS: SizeOption[] = [
  { label: '600×400', width: 600, height: 400 },
  { label: '800×600', width: 800, height: 600 },
  { label: '1024×768', width: 1024, height: 768 },
]

const QUICK_NOTE_SIZE_OPTIONS: SizeOption[] = [
  { label: '400×300', width: 400, height: 300 },
  { label: '600×400', width: 600, height: 400 },
  { label: '800×500', width: 800, height: 500 },
]

const THEME_CONVERSATION_SIZE_OPTIONS: SizeOption[] = [
  { label: '900×700', width: 900, height: 700 },
  { label: '1000×900', width: 1000, height: 900 },
  { label: '1200×1000', width: 1200, height: 1000 },
]

const ACCOUNTING_SIZE_OPTIONS: SizeOption[] = [
  { label: '320×480', width: 320, height: 480 },
  { label: '360×520', width: 360, height: 520 },
  { label: '400×600', width: 400, height: 600 },
]

const STOCK_SIZE_OPTIONS: SizeOption[] = [
  { label: '320×480', width: 320, height: 480 },
  { label: '360×560', width: 360, height: 560 },
  { label: '400×640', width: 400, height: 640 },
]

const CLIPBOARD_SIZE_OPTIONS: SizeOption[] = [
  { label: '460×480', width: 460, height: 480 },
  { label: '520×560', width: 520, height: 560 },
  { label: '600×680', width: 600, height: 680 },
]

// —— 各小窗的排版预设 ——
const POMODORO_LAYOUT_OPTIONS: NamedOption[] = [
  { label: '默认', value: 'default' },
  { label: '简约', value: 'simple' },
  { label: '圆形', value: 'circle' },
  { label: '紧凑', value: 'compact' },
  { label: '经典', value: 'classic' },
  { label: '翻页', value: 'flip' },
]

const QUICK_NOTE_LAYOUT_OPTIONS: NamedOption[] = [
  { label: '极简卡片', value: 'minimal' },
  { label: '毛玻璃', value: 'glass' },
  { label: '双栏侧边', value: 'sidebar' },
  { label: '经典编辑器', value: 'classic' },
]

// 剪贴板面板的排版：列表（文本为主）/ 图文网格（图片为主）
const CLIPBOARD_LAYOUT_OPTIONS: NamedOption[] = [
  { label: '列表', value: 'list' },
  { label: '图文网格', value: 'grid' },
]

/** 全部小窗区块（顺序即页面展示顺序） */
export const WINDOW_SECTIONS: WindowSection[] = [
  {
    key: 'pomodoro',
    title: '番茄钟小窗口',
    icon: 'Timer',
    storeKey: 'pomodoro',
    fields: { position: true, size: true, gap: true, skin: true, layout: true },
    sizeOptions: POMODORO_SIZE_OPTIONS,
    skinOptions: SKIN_OPTIONS,
    layoutOptions: POMODORO_LAYOUT_OPTIONS,
  },
  {
    key: 'notebook',
    title: '笔记本小窗口',
    icon: 'LibraryBig',
    storeKey: 'notebook',
    fields: { position: true, size: true, gap: true, skin: false, layout: false },
    sizeOptions: NOTEBOOK_SIZE_OPTIONS,
  },
  {
    key: 'quickNote',
    title: '快速记录小窗口',
    icon: 'PenLine',
    storeKey: 'quickNote',
    fields: { position: true, size: true, gap: true, skin: true, layout: true },
    sizeOptions: QUICK_NOTE_SIZE_OPTIONS,
    skinOptions: SKIN_OPTIONS,
    layoutOptions: QUICK_NOTE_LAYOUT_OPTIONS,
  },
  {
    key: 'todo',
    title: '待办小窗口',
    icon: 'CheckSquare',
    storeKey: 'todoMiniWindow',
    fields: { position: true, size: true, gap: true, skin: true, layout: false },
    sizeOptions: QUICK_NOTE_SIZE_OPTIONS,
    skinOptions: SKIN_OPTIONS,
  },
  {
    key: 'themeConversation',
    title: '主题对话小窗口',
    icon: 'MessagesSquare',
    storeKey: 'themeConversationMini',
    fields: { position: true, size: true, gap: true, skin: true, layout: false },
    sizeOptions: THEME_CONVERSATION_SIZE_OPTIONS,
    skinOptions: SKIN_OPTIONS,
  },
  {
    key: 'accounting',
    title: '记账小窗口',
    icon: 'Wallet',
    storeKey: 'accountingMini',
    fields: { position: true, size: true, gap: true, skin: true, layout: false },
    sizeOptions: ACCOUNTING_SIZE_OPTIONS,
    skinOptions: SKIN_OPTIONS,
  },
  {
    key: 'stock',
    title: '股票小窗口',
    icon: 'TrendingUp',
    storeKey: 'stockMini',
    fields: { position: true, size: true, gap: true, skin: true, layout: false },
    sizeOptions: STOCK_SIZE_OPTIONS,
    skinOptions: SKIN_OPTIONS,
  },
  {
    key: 'clipboard',
    title: '剪贴板快速粘贴',
    icon: 'Copy',
    storeKey: 'clipboardMiniWindow',
    fields: { position: true, size: true, gap: true, skin: true, layout: true },
    sizeOptions: CLIPBOARD_SIZE_OPTIONS,
    skinOptions: SKIN_OPTIONS,
    layoutOptions: CLIPBOARD_LAYOUT_OPTIONS,
  },
]
