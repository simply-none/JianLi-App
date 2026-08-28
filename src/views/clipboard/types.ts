// 剪切板数据类型定义

export interface ClipboardItem {
  id?: number
  text: string
  html?: string
  image?: string
  rtf?: string
  bookmark?: string
  findText?: string
  create_time?: string
}

// 查询参数：普通查询（关键词）+ 高级查询（时间范围）+ 分页
export interface ClipboardQueryParams {
  keyword?: string
  startTime?: string
  endTime?: string
  limit?: number
  offset?: number
}
