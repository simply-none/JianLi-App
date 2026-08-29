/**
 * HTTP 状态码 → 用户可读错误信息映射（主进程）
 * ------------------------------------------------------------------
 * 供下载引擎的探测（probe）与分段下载（segmentDownloader）统一使用，
 * 把常见 HTTP 状态码翻译成「原因 + 建议动作」的中文提示。
 */

/** 状态码 → 错误描述映射 */
const HTTP_ERROR_MAP: Record<number, string> = {
  400: "请求无效（HTTP 400），链接可能已失效",
  401: "需要登录认证（HTTP 401），请先在浏览器登录后重试",
  402: "需要付费访问（HTTP 402）",
  403: "服务器拒绝访问（HTTP 403），可能需要登录或该链接有防盗链限制",
  404: "资源不存在（HTTP 404），链接可能已失效",
  405: "请求方法不被允许（HTTP 405）",
  407: "代理需要认证（HTTP 407），请检查代理设置",
  408: "请求超时（HTTP 408），请重试",
  409: "请求冲突（HTTP 409）",
  410: "资源已永久移除（HTTP 410）",
  412: "请求条件不满足（HTTP 412）",
  413: "文件超出服务器允许的大小（HTTP 413）",
  414: "链接过长（HTTP 414）",
  415: "服务器不支持的媒体类型（HTTP 415）",
  416: "服务器不支持该分段请求（HTTP 416），已自动尝试其他下载方式",
  418: "服务器拒绝响应（HTTP 418）",
  429: "请求过于频繁（HTTP 429），请稍后重试",
  451: "因法律原因不可用（HTTP 451）",
  500: "服务器内部错误（HTTP 500）",
  501: "服务器不支持该请求（HTTP 501）",
  502: "网关错误（HTTP 502），请稍后重试",
  503: "服务暂不可用（HTTP 503），请稍后重试",
  504: "网关超时（HTTP 504），请稍后重试",
  505: "HTTP 版本不受支持（HTTP 505）",
  507: "服务器存储空间不足（HTTP 507）",
  511: "需要网络认证（HTTP 511），请先完成网络登录",
};

/**
 * 生成用户可读的 HTTP 错误信息
 * @param status 必填，HTTP 状态码
 * @param statusText 可选，原始状态文本（映射未命中时拼接展示）
 * @returns 形如「服务器拒绝访问（HTTP 403），...」的错误描述；未命中映射时返回 "HTTP 418 Not Acceptable" 形式
 */
export function httpErrorMessage(status: number, statusText?: string): string {
  const mapped = HTTP_ERROR_MAP[status];
  if (mapped) return mapped;
  const text = (statusText || "").trim();
  return text ? `HTTP ${status} ${text}` : `HTTP ${status} 未知错误`;
}
