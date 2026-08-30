/**
 * 简历模块 - 类型定义
 * ------------------------------------------------------------------
 * 定义简历数据结构、模板接口与数据库行结构。
 * 简历数据以 JSON 形式整体存入 SQLite 的 data 列，读取后解析回此结构。
 */

/** 基本信息（无头像设计，纯文字排版） */
export interface ResumeBasics {
  /** 姓名 */
  name: string
  /** 求职意向（目标岗位） */
  jobIntent: string
  /** 联系电话 */
  phone: string
  /** 电子邮箱 */
  email: string
  /** 性别 */
  gender: string
  /** 年龄 */
  age: string
  /** 所在城市 */
  city: string
}

/** 教育背景条目 */
export interface ResumeEducationItem {
  /** 学校名称 */
  school: string
  /** 专业名称 */
  major: string
  /** 学历（如 本科/硕士） */
  degree: string
  /** 开始时间（如 2020.09） */
  startTime: string
  /** 结束时间（如 2024.06） */
  endTime: string
  /** 补充描述（主修课程/绩点等） */
  description: string
}

/** 工作经历条目 */
export interface ResumeWorkItem {
  /** 公司名称 */
  company: string
  /** 担任职位 */
  position: string
  /** 开始时间 */
  startTime: string
  /** 结束时间（在职中可填「至今」） */
  endTime: string
  /** 工作内容描述（建议换行分隔多条） */
  description: string
}

/** 项目经验条目 */
export interface ResumeProjectItem {
  /** 项目名称 */
  name: string
  /** 担任角色 */
  role: string
  /** 开始时间 */
  startTime: string
  /** 结束时间 */
  endTime: string
  /** 项目描述（职责与产出） */
  description: string
}

/** 技能特长条目 */
export interface ResumeSkillItem {
  /** 技能名称 */
  name: string
  /** 熟练度 1-5 */
  level: number
}

/** 简历完整数据（JSON 存储结构） */
export interface ResumeData {
  /** 基本信息 */
  basics: ResumeBasics
  /** 教育背景列表 */
  education: ResumeEducationItem[]
  /** 工作经历列表 */
  work: ResumeWorkItem[]
  /** 项目经验列表 */
  project: ResumeProjectItem[]
  /** 技能特长列表 */
  skills: ResumeSkillItem[]
  /** 自我评价 */
  evaluation: string
}

/** 数据库中的简历记录（data 列解析后的形态） */
export interface ResumeRecord {
  /** 记录 id（自增主键） */
  id: number
  /** 简历名称（唯一索引） */
  name: string
  /** 模板 id（当前为 compact） */
  templateId: string
  /** 简历内容 */
  data: ResumeData
  /** 创建时间戳（ms） */
  createdAt: number
  /** 更新时间戳（ms） */
  updatedAt: number
}

/** 简历模板接口：每个模板一个渲染函数，输入数据与排版配置输出完整 A4 HTML */
export interface ResumeTemplate {
  /** 模板唯一标识 */
  id: string
  /** 模板显示名称 */
  name: string
  /** 模板风格简述（用于画廊提示） */
  desc: string
  /**
   * 渲染简历为完整 HTML 字符串（内联样式，A4 纸张）
   * @param data 简历数据
   * @param config 排版配置（可空，空则使用引擎默认）
   * @returns 完整 HTML 文档字符串（预览与 PDF 导出共用）
   */
  render: (data: ResumeData, config?: import('./engine/types').ResumeLayoutConfig) => string
}

/** 重导出排版引擎类型（消费方可统一从本文件导入） */
export type {
  SizeKey,
  InkLevel,
  TextStyle,
  SeparatorStyle,
  LineDecoration,
  SectionTitleStyle,
  EntryHeaderStyle,
  ListStyle,
  SkillsDotStyle,
  BasicsHeaderStyle,
  ModuleId,
  ModuleStyle,
  PageStyle,
  ResumeLayoutConfig,
} from './engine/types'
