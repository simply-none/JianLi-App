/**
 * 主题对话 - 类型与常量定义
 * ------------------------------------------------------------------
 * 表结构设计（均基于 newSql 自动建表，主键为自增整数 id）：
 *
 * 1) conversation_theme 对话主题表
 *    - id          主题id（主键，自增）
 *    - title       主题标题（主题字段，用于搜索）
 *    - tags        主题标签，JSON 字符串数组（如 ["3","5"]）
 *    - create_time 创建时间
 *    - update_time 更新时间
 *    - remark      备注
 *
 * 2) conversation 对话表
 *    - id            对话id（主键，自增）【必须】
 *    - theme_id      所属主题id（对话跟着主题走）
 *    - content       对话内容【必须】
 *    - ref_ids      引用ids，JSON 字符串数组（可引用一个或多个历史对话，可多次引用）【必须】
 *                    注意：早期曾用 `references` 作列名，但它是 SQLite 保留字，会导致 INSERT/UPDATE 报
 *                    SQLITE_ERROR: near "references": syntax error，故统一改用 `ref_ids`。
 *    - tags          对话标签，JSON 字符串数组【必须】
 *    - create_time   创建时间【必须】
 *    - annotate_time 对话标注时间（标注/批注时间，可选）【必须】
 *    - pinned        是否置顶（'0'/'1'）
 *    - is_deleted    软删除标记（'0'/'1'）
 *
 * 3) conversation_tag 对话标签表（对话与主题共用）
 *    - id        标签id（主键，自增）
 *    - name      标签名称
 *    - color     标签颜色
 *    - scope     适用范围：conversation（对话）/ theme（主题）
 *    - create_time 创建时间
 */

export const TABLE = {
  THEME: 'conversation_theme',
  CONVERSATION: 'conversation',
  TAG: 'conversation_tag',
} as const;

/** 标签适用范围 */
export const TAG_SCOPE = {
  CONVERSATION: 'conversation',
  THEME: 'theme',
} as const;

/** 默认标签配色（新建标签时按顺序取色） */
export const TAG_COLORS = [
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#0ea5e9',
];

export interface ThemeItem {
  id: number;
  title: string;
  tags: string;
  create_time: string;
  update_time: string;
  remark?: string;
}

export interface ConversationItem {
  id: number;
  theme_id: number;
  content: string;
  ref_ids: string;
  tags: string;
  create_time: string;
  annotate_time: string;
  pinned?: string;
  is_deleted?: string;
}

export interface TagItem {
  id: number;
  name: string;
  color: string;
  scope: string;
  create_time: string;
}
