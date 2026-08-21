/**
 * 使 wheel / mousewheel 事件在未显式传 options 时默认以 passive 方式注册。
 *
 * 背景：ECharts（底层 zrender）在每次 echarts.init 时都会在图表容器上无条件注册
 * 非 passive 的 mousewheel / wheel DOM 监听器，Chrome 因此输出
 * "[Violation] Added non-passive event listener to a scroll-blocking 'mousewheel' event"。
 * 上游 echarts 认为这不是 bug（dataZoom 需要 preventDefault 阻止页面滚动），
 * 所以在此做一次性全局兜底：仅当第三个参数为 undefined 时补上 { passive: true }，
 * 消除该警告；dataZoom 滚轮缩放仍可触发，只是不再阻止页面滚动。
 * 显式传入 { passive: false } 的监听器（如截图标注、EPUB 翻页）不受影响。
 */
const PASSIVE_TYPES = new Set(['wheel', 'mousewheel'])

let installed = false

export function installPassiveScrollListeners (): void {
  if (installed) return
  installed = true

  const original = EventTarget.prototype.addEventListener
  EventTarget.prototype.addEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    let opts = options
    if (opts === undefined && PASSIVE_TYPES.has(type)) {
      opts = { passive: true }
    }
    original.call(this, type, listener, opts)
  }
}
