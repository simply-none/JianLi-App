/**
 * 排版引擎 - 类型定义
 * ------------------------------------------------------------------
 * 定义「配置驱动的简历排版」全部类型：页面全局 → 模块 → 组件 → 原子字段。
 * 配置为纯 JSON 可序列化结构，存入 SQLite resume_layout 表；
 * 未配置的字段/组件继承默认值（defaultConfig），保证配置树不爆炸。
 */

/** 字号档位 key（delta 为相对全局正文字号的偏移 pt） */
export type SizeKey = 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | 'xxl' | 'huge' | 'giant'

/** 灰阶档位（灰黑白色调约束下的梯度，数值越大越深） */
export type InkLevel = 1000 | 900 | 850 | 750 | 650 | 500 | 450 | 250

/** 原子字段/文本样式（每个字段独立可调的核心结构） */
export interface TextStyle {
  /** 是否显示（原子字段显隐开关） */
  visible: boolean
  /** 字号档位 */
  size: SizeKey
  /** 字重：400 常规 / 500 中等 / 600 半粗 / 700 加粗 */
  weight: 400 | 500 | 600 | 700
  /** 灰阶档位 */
  ink: InkLevel
  /** 字距（px，可为负） */
  letterSpacing: number
  /** 斜体 */
  italic: boolean
}

/** 分隔符样式（同组字段间的连接方式，如「北京大学 · 软件工程」） */
export interface SeparatorStyle {
  /** 类型：space 空格 / dot 间隔点 / bar 竖线 / slash 斜杠 / none 紧贴 */
  type: 'space' | 'dot' | 'bar' | 'slash' | 'none'
  /** 两侧间距 px */
  gap: number
  /** 分隔符灰阶 */
  ink: InkLevel
}

/** 装饰线配置（标题/头部装饰） */
export interface LineDecoration {
  /** 是否启用 */
  enabled: boolean
  /** 位置：after 标题右侧延伸 / below 标题下方 */
  position: 'after' | 'below'
  /** 类型：solid 直线 / segment 线段 / dashed 虚线 / dotted 虚点 */
  kind: 'solid' | 'segment' | 'dashed' | 'dotted'
  /** 渐细（左粗右细线性渐变，仅 solid/segment 有效） */
  taper: boolean
  /** 粗细 px */
  thickness: number
  /** 长度：full 通栏 / short 短线段(72px) / text 与标题文字同宽 */
  lengthMode: 'full' | 'short' | 'text'
  /** 与文字的间距 px */
  gap: number
  /** 线条灰阶 */
  ink: InkLevel
}

/** 章节标题组件配置 */
export interface SectionTitleStyle {
  /** 标题文本样式 */
  text: TextStyle
  /** 标题装饰线 */
  line: LineDecoration
}

/** 条目头组件配置（如「浙江大学 · 软件工程 · 硕士 + 右侧日期」） */
export interface EntryHeaderStyle {
  /** 参与条目头的字段 id 顺序（各模块含义不同，如 edu: school/major/degree） */
  fieldOrder: string[]
  /** 条目头字段基础样式（各字段未覆盖时继承） */
  textStyle: TextStyle
  /** 字段间分隔符 */
  separator: SeparatorStyle
  /** 日期位置：right 同行右端 / inline 条目头之后 / hide 隐藏 */
  datePlacement: 'right' | 'inline' | 'hide'
  /** 日期起止连接符（– / ~ / 至 / 空格） */
  dateConnector: string
  /** 日期原子样式 */
  dateStyle: TextStyle
}

/** 列表组件配置（描述内容） */
export interface ListStyle {
  /** 符号：dot 圆点 / dash 短横 / number 数字 / none 纯段落 */
  marker: 'dot' | 'dash' | 'number' | 'none'
  /** 符号灰阶 */
  markerInk: InkLevel
  /** 缩进 px */
  indent: number
  /** 条目间距 px */
  itemGap: number
  /** 文本样式 */
  text: TextStyle
}

/** 技能熟练度圆点配置 */
export interface SkillsDotStyle {
  /** 圆点尺寸 px */
  size: number
  /** 圆点间距 px */
  gap: number
  /** 实心圆灰阶 */
  onInk: InkLevel
  /** 空心圆灰阶 */
  offInk: InkLevel
}

/** 基本信息模块头部配置（姓名 + 求职意向 + 联系方式行，保持既有结构仅调样式） */
export interface BasicsHeaderStyle {
  /** 头部装饰线（姓名行下方） */
  line: LineDecoration
  /** 姓名与求职意向的间距 px */
  intentGap: number
  /** 联系方式行与姓名行的间距 px */
  contactGap: number
  /** 联系方式行字段顺序（phone/email/gender/age/city） */
  contactOrder: string[]
  /** 联系方式行字段间分隔符 */
  contactSeparator: SeparatorStyle
}

/** 模块 id */
export type ModuleId = 'basics' | 'education' | 'work' | 'project' | 'skills' | 'evaluation'

/** 模块排版配置（各组件按模块内容可选；字段级覆盖放 fields） */
export interface ModuleStyle {
  /** 模块 id */
  id: ModuleId
  /** 是否显示 */
  visible: boolean
  /** 章节标题（basics 无标题，为空） */
  title?: SectionTitleStyle
  /** 基本信息头部专属配置 */
  header?: BasicsHeaderStyle
  /** 条目头（education/work/project） */
  entryHeader?: EntryHeaderStyle
  /** 列表（education/work/project 描述、skills 无、evaluation 无） */
  list?: ListStyle
  /** 纯文本模块（evaluation） */
  textStyle?: TextStyle
  /** 技能圆点（skills） */
  dots?: SkillsDotStyle
  /** 原子字段样式覆盖表：字段 id → 样式（未配置继承组件默认） */
  fields?: Record<string, Partial<TextStyle> & { visible?: boolean }>
}

/** 页面全局样式 */
export interface PageStyle {
  /** 正文字号 pt（8-12） */
  fontSize: number
  /** 全局行高（1.2-1.8） */
  lineHeight: number
  /** 字体族：sans 无衬线 / serif 衬线 */
  fontFamily: 'sans' | 'serif'
  /** 页面水平边距 mm（8-20） */
  paddingX: number
  /** 页面垂直边距 mm（8-20） */
  paddingY: number
  /** 模块间距 px */
  sectionGap: number
  /** 条目间距 px */
  entryGap: number
}

/** 简历排版配置（完整可序列化结构，存 resume_layout.config） */
export interface ResumeLayoutConfig {
  /** 结构版本号（后续迁移用） */
  version: 1
  /** 页面全局 */
  page: PageStyle
  /** 模块配置数组（顺序即渲染顺序，可删减排序） */
  modules: ModuleStyle[]
}
