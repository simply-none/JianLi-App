// 剪切板数据类型定义

export interface ClipboardItem {
  id?: number
  text: string
  html?: string
  /** 图片条目的 dataURL（PNG），空字符串表示非图片条目 */
  image?: string
  rtf?: string
  bookmark?: string
  findText?: string
  create_time?: string
  /** 累计被复制使用的次数 */
  use_count?: number
  /** 最近一次被复制使用的时间 */
  last_used?: string
}

/** 内容类型筛选：全部 / 纯文本 / 图片 / 链接 */
export type ClipboardKind = 'all' | 'text' | 'image' | 'link'

/** 复制模式：raw 保留原格式（富文本/图片），text 只取纯文本 */
export type ClipboardCopyMode = 'raw' | 'text'

// 查询参数：普通查询（关键词）+ 高级查询（时间范围）+ 类型筛选 + 分页
export interface ClipboardQueryParams {
  keyword?: string
  startTime?: string
  endTime?: string
  kind?: ClipboardKind
  limit?: number
  offset?: number
}

/** 卡片发出的复制请求：条目 + 复制模式 */
export interface ClipboardCopyPayload {
  item: ClipboardItem
  mode: ClipboardCopyMode
}
