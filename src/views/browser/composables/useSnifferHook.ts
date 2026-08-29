/**
 * 内置浏览器 - 视频嗅探页面 Hook（方案 B）
 * ------------------------------------------------------------------
 * 职责：向 webview 页面主世界（MAIN world）注入 JS Hook，覆盖主流视频站的
 * 「媒体数据经 XHR/fetch 拉取」场景（MSE 流），主进程 webRequest 无法识别：
 * - fetch hook：媒体类响应（video/audio/m3u8/octet-stream）直接记录；
 *   JSON/文本响应扫描其中内嵌的媒体直链（B 站 playurl、抖音 API 等）；
 * - XHR hook：同上（responseText 仅在可读时扫描）；
 * - 捕获结果写入页面全局 window.__SNIFF_EVENTS__（上限 500，防溢出）；
 * - 渲染端按需「排水」（drain）：splice 取走全部事件并转发主进程合并。
 *
 * 注入时机：webview dom-ready 时（与夜间模式注入同点），每次导航自动重注入；
 * 注入方式：webview.executeJavaScript（主世界执行，不受页面 CSP 限制）。
 */
import { getWebview } from "./useWebviewBridge";

/** 页面 Hook 事件结构（与主进程 PageSniffEvent 一致） */
export interface HookEvent {
  /** 事件种类：media=媒体响应；scan=文本中提取的直链 */
  kind: "media" | "scan";
  /** 资源地址 */
  url: string;
  /** MIME 类型（可空） */
  mime?: string;
  /** 内容长度（可空） */
  size?: number;
}

/** 页面事件缓冲上限（超出丢弃最旧，防止常驻内存膨胀） */
const MAX_EVENTS = 500;

/**
 * 构建页面嗅探 Hook 脚本（注入到页面主世界执行）
 * 说明：脚本以 IIFE 形式运行，重复注入有 window.__SNIFF_HOOK__ 幂等守卫；
 * 内部不做类型判断（主进程统一识别），只负责收集候选 URL。
 * @returns 可执行 JS 脚本字符串
 */
export function buildSnifferHook(): string {
  return `(function () {
  if (window.__SNIFF_HOOK__) return;
  window.__SNIFF_HOOK__ = true;
  var events = (window.__SNIFF_EVENTS__ = window.__SNIFF_EVENTS__ || []);
  var MAX = ${MAX_EVENTS};
  function push(ev) {
    try {
      if (!ev || !ev.url || !/^https?:/i.test(ev.url)) return;
      if (events.length >= MAX) events.splice(0, events.length - MAX + 1);
      ev.foundAt = Date.now();
      events.push(ev);
    } catch (e) {}
  }
  // 媒体直链提取正则：扩展名类
  var URL_RE = /https?:\\/\\/[^"'\\\\\\s<>\\(\\)]+?\\.(?:mp4|m3u8|mpd|flv|m4s|mp3|aac|m4a|ts|webm)(?:\\?[^"'\\\\\\s<>\\(\\)]*)?/gi;
  // YouTube videoplayback 无扩展名直链
  var GF_RE = /https?:\\/\\/[^"'\\\\\\s<>\\(\\)]*googlevideo\\.com\\/videoplayback[^"'\\\\\\s<>\\(\\)]*/gi;
  // 从文本（JSON API 响应等）扫描媒体直链
  function scanText(text) {
    try {
      if (!text || text.length > 5000000) return;
      var found = {};
      var m;
      URL_RE.lastIndex = 0;
      while ((m = URL_RE.exec(text))) found[m[0]] = 1;
      GF_RE.lastIndex = 0;
      while ((m = GF_RE.exec(text))) found[m[0]] = 1;
      Object.keys(found).forEach(function (u) { push({ kind: 'scan', url: u }); });
    } catch (e) {}
  }
  // 媒体类 content-type 判断
  function isMediaCt(ct) { return /video\\/|audio\\/|mpegurl|dash\\+xml|octet-stream/i.test(ct || ''); }
  // ---- fetch hook ----
  var of = window.fetch;
  if (of) {
    window.fetch = function () {
      var args = arguments;
      var u = (args[0] && args[0].url) || args[0];
      var p = of.apply(this, args);
      try {
        p.then(function (res) {
          try {
            var ct = res.headers.get('content-type') || '';
            if (isMediaCt(ct)) {
              push({ kind: 'media', url: String(u), mime: ct, size: Number(res.headers.get('content-length')) || 0 });
            } else if (/json|text/i.test(ct)) {
              res.clone().text().then(scanText).catch(function () {});
            }
          } catch (e) {}
        }).catch(function () {});
      } catch (e) {}
      return p;
    };
  }
  // ---- XHR hook ----
  var oo = XMLHttpRequest.prototype.open;
  var os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    try { this.__sniffUrl = url; } catch (e) {}
    return oo.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    try {
      xhr.addEventListener('load', function () {
        try {
          var ct = xhr.getResponseHeader('content-type') || '';
          var u = String(xhr.responseURL || xhr.__sniffUrl || '');
          var len = Number(xhr.getResponseHeader('content-length')) || 0;
          if (isMediaCt(ct)) {
            push({ kind: 'media', url: u, mime: ct, size: len });
          } else if (/json|text/i.test(ct) && (!len || len < 5000000)) {
            var t = (!xhr.responseType || xhr.responseType === 'text') ? xhr.responseText : '';
            scanText(t);
          }
        } catch (e) {}
      });
    } catch (e) {}
    return os.apply(this, arguments);
  };
})();`;
}

/**
 * 向指定标签的 webview 注入嗅探 Hook（dom-ready 时调用；失败静默，不影响页面）
 * @param tabId 必填，标签 ID
 */
export function injectSnifferHook(tabId: string) {
  const wv = getWebview(tabId);
  if (!wv) return;
  try {
    wv.executeJavaScript(buildSnifferHook()).catch(() => {});
  } catch {
    // webview 尚未就绪时忽略
  }
}

/**
 * 排水：取走页面缓冲中的全部待处理事件（splice 原子取出，页面侧清空）
 * @param tabId 必填，标签 ID
 * @returns 事件数组；webview 未就绪返回空数组
 */
export async function drainSnifferEvents(tabId: string): Promise<HookEvent[]> {
  const wv = getWebview(tabId);
  if (!wv) return [];
  try {
    const events = await wv.executeJavaScript(
      "(window.__SNIFF_EVENTS__ ? window.__SNIFF_EVENTS__.splice(0, window.__SNIFF_EVENTS__.length) : [])"
    );
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}
