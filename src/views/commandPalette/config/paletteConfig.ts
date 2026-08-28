import type { CommandType } from '../types'

/** 小窗名：与主进程 createOtherWindow 的 arg、window-mode:{name} 保持一致 */
export const WINDOW_NAME = 'commandPaletteMiniWindow'

/** 小窗配置在 basic_info 里的键 */
export const STORE_KEY = `window-mode:${WINDOW_NAME}`

/** 默认唤出快捷键（用户可在「快捷键注册」页改成任意组合） */
export const DEFAULT_SHORTCUT = 'Ctrl+Space'

/** 输入防抖：剪贴板/笔记查询走 IPC，避免每敲一个字都查库 */
export const DEBOUNCE_MS = 120

/** 单个数据源最多返回条数 */
export const MAX_PER_SOURCE = 8

/** 结果区最多展示条数（防止长列表把小窗撑爆） */
export const MAX_TOTAL = 30

/** 空关键词时各源返回的推荐条数 */
export const DEFAULT_LIMIT = 5

/** 各分类的展示元数据 */
export const TYPE_META: Record<CommandType, { label: string; color: string }> = {
  route: { label: '功能', color: 'var(--color-info)' },
  action: { label: '动作', color: 'var(--color-primary)' },
  note: { label: '笔记', color: 'var(--color-success)' },
  todo: { label: '待办', color: 'var(--color-warning)' },
  habit: { label: '习惯', color: 'var(--color-error)' },
}

/**
 * 作用域前缀：输入以这些字符开头时，只检索指定数据源。
 * 例：`@会议` 只搜笔记，`#买菜` 只搜待办，`/记账` 只搜功能与动作，`!读书` 只搜习惯。
 */
export const SCOPE_PREFIX_MAP: Record<string, string[]> = {
  '@': ['note'],
  '#': ['todo'],
  '/': ['route', 'action'],
  '!': ['habit'],
}

/** 作用域前缀的展示文案，渲染在输入框右侧 */
export const SCOPE_LABEL: Record<string, string> = {
  '@': '笔记',
  '#': '待办',
  '/': '功能',
  '!': '习惯',
}

/** 从上到下：默认展示顺序（route 分组内部按此顺序排序） */
export const PREFERRED_ROUTES: string[] = [
  'home',
  'todoList',
  'categorizableNotes',
  'clipboard',
  'accounting',
  'newTips',
  'pomodoroRecord',
  'ebookReader',
  'stock',
  'fileRela',
  'setting',
  'windowMode',
]
