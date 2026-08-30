/**
 * 排版 UI - 模块字段元数据
 * ------------------------------------------------------------------
 * 定义每个模块「可调试原子字段」的 id 与显示名，
 * 供排版弹窗的字段行与条目头字段 chips 共用。
 */

import type { ModuleId } from '../../../engine/types'

/** 字段元数据 */
export interface FieldMeta {
  /** 字段 id（对应 ModuleStyle.fields 覆盖表 key） */
  id: string
  /** 显示名 */
  label: string
}

/** 各模块可调试字段 */
export const MODULE_FIELD_META: Record<ModuleId, FieldMeta[]> = {
  basics: [
    { id: 'name', label: '姓名' },
    { id: 'jobIntent', label: '求职意向' },
    { id: 'phone', label: '电话' },
    { id: 'email', label: '邮箱' },
    { id: 'gender', label: '性别' },
    { id: 'age', label: '年龄' },
    { id: 'city', label: '城市' },
  ],
  education: [
    { id: 'school', label: '学校' },
    { id: 'major', label: '专业' },
    { id: 'degree', label: '学历' },
    { id: 'description', label: '描述文本' },
  ],
  work: [
    { id: 'company', label: '公司' },
    { id: 'position', label: '职位' },
    { id: 'description', label: '描述文本' },
  ],
  project: [
    { id: 'name', label: '项目名' },
    { id: 'role', label: '角色' },
    { id: 'description', label: '描述文本' },
  ],
  skills: [{ id: 'skillName', label: '技能名' }],
  evaluation: [{ id: 'text', label: '评价文本' }],
}

/** 各模块条目头字段 id → 显示名（EntryHeaderGroup chips 用） */
export const ENTRY_FIELD_LABELS: Record<string, Record<string, string>> = {
  education: { school: '学校', major: '专业', degree: '学历' },
  work: { company: '公司', position: '职位' },
  project: { name: '项目名', role: '角色' },
}
