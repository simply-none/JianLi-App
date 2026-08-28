/**
 * 命令面板的类型契约。
 * 这里是「渲染端自建契约」：主进程源码不允许被渲染端 import，
 * 跨窗口通信一律走 IPC，本文件只描述纯前端的数据结构。
 */

/** 命令项分类：决定分组标题、图标与右侧类型标签 */
export type CommandType = 'route' | 'action' | 'note' | 'todo' | 'habit'

/** 面板执行动作时可用的上下文 */
export interface CommandContext {
  /** 隐藏命令面板小窗（不是销毁，下次唤出直接复用） */
  hidePalette: () => void
  /** 显示主窗口并跳转到某个布局内路由（传 RouteNames 里的名字） */
  navigate: (routeName: string) => void
}

export interface CommandItem {
  /** 全局唯一 id，建议 `{sourceId}:{业务主键}`，避免跨源重复导致 v-for key 冲突 */
  id: string
  type: CommandType
  /** 主标题 */
  title: string
  /** 副标题（摘要 / 时间 / 描述），可为空 */
  subtitle?: string
  /** LucideIcon 图标名 */
  icon: string
  /** 排序分，越大越靠前；由各数据源给出原始分，注册表再叠加作用域加权 */
  score: number
  /** 回车执行：跳转、打开小窗、写入数据等 */
  run: (ctx: CommandContext) => void | Promise<void>
}

/**
 * 数据源。新增一个可搜索的模块只需实现这个接口并注册进 useCommandSources，
 * 面板本体不需要任何改动。
 */
export interface CommandSource {
  id: string
  /** 分组展示名 */
  label: string
  /**
   * 从关键词（已去掉作用域前缀）检索命令项。
   * 约定：关键词为空时返回该源的「默认推荐」（最近 / 常用若干条）。
   * 抛错由注册表兜底，不影响其它数据源。
   */
  search: (query: string) => Promise<CommandItem[]>
}
