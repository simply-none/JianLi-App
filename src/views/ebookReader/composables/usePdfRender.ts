/**
 * PdfReader 渲染 / 分页 / 翻页 / 缩放 / 进度 / 主题 composable
 *
 * 与 usePdfHighlight 共享同一个 ctx（见 pdfContext.ts）。本 composable 负责：
 *   - 通过主进程 read-file-bytes 读取 PDF 二进制，交给 pdf.js 解析
 *   - 连续滚动渲染：每页一个 .pdf-page（<canvas> + 文本层 + 划线层），整本在容器内纵向排列
 *   - 懒渲染：只渲染可视区附近的页（避免一次渲染全部页卡死），滚动/翻页时按需补渲染
 *   - 缩放（fit-width 基础缩放 + 放大/缩小）、页码导航（上一页/下一页/滑块/边缘点击/滚轮翻页）
 *   - 进度计算与 emit（以当前页码为锚点，与缩放/字号解耦）
 *   - 阅读区背景/文字色、主题的动态样式，以及生命周期与响应 props 的监听
 *
 * 安全：pdf.js v6 已移除基于 eval 的字体支持路径（旧版 isEvalSupported 选项不复存在），
 * CVE-2024-4367 涉及的「恶意字体触发 JS 执行」风险在该版本中已不存在，按默认加载即可。
 */
import { computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import * as pdfjsLib from 'pdfjs-dist';
// 主线程侧 polyfill：Chromium 134 缺 Map/WeakMap.getOrInsertComputed(145+) 与
// Uint8Array.toHex(140+)，pdf.js v6 主线程渲染/解析时会调用，需在加载文档前补齐。
// 同一文件也由 worker 入口引入，保证 worker realm 同样具备补丁。
import '../workers/pdfPolyfill';
import { resolveReadingBg, resolveReadingText } from '../themePresets';
import { getHighlightColorValue } from '../highlightConfig';
import useEbookReader from '@/store/useEbookReader';
import type { PdfCtx, PdfPageSize } from './pdfContext';

// pdf.js Worker 通过 workerPort 注入（见 ensurePdfWorker）：
// 复用官方 pdf.worker，但前置一个 polyfill，兼容 Electron 36(Chromium 134)
// 缺失 Uint8Array.prototype.toHex 等原生方法导致的 “n.toHex is not a function”。
let pdfWorkerPort: Worker | null = null;
function ensurePdfWorker(): Worker {
  if (!pdfWorkerPort) {
    pdfWorkerPort = new Worker(new URL('../workers/pdfWorker.ts', import.meta.url), {
      type: 'module',
    });
    pdfjsLib.GlobalWorkerOptions.workerPort = pdfWorkerPort;
  }
  return pdfWorkerPort;
}

/** 将 base64 字符串解码为 Uint8Array（供 pdf.js 加载） */
function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function usePdfRender(ctx: PdfCtx) {
  const ebookStore = useEbookReader();

  /** 第 1 页在 scale=1 下的原始宽高（px），供 fit-width / fit-height 计算 baseScale 复用 */
  let basePageW = 0;
  let basePageH = 0;
  /** 窗口/阅读区尺寸变化后的防抖适应重算定时器 */
  let pdfResizeTimer: ReturnType<typeof setTimeout> | null = null;
  /** 监听阅读区尺寸变化的 ResizeObserver（PDF 缩放需随窗口/分栏变化重算） */
  let pdfResizeObserver: ResizeObserver | null = null;

  /**
   * 根据当前适应方式（fit-width / fit-height）计算基础缩放：
   *  - width：缩放使单页宽度撑满阅读区（左右留安全边距），即原有 fit-width 行为；
   *  - height：缩放使单页高度约等于视口高度（上下留 padding），实现「一屏一页」。
   * 结果与窗口/阅读区尺寸实时相关，窗口变化时由 ResizeObserver 重新计算。
   */
  function computeBaseScale(mode: 'width' | 'height'): number {
    const sc = ctx.scrollRef.value;
    if (!sc || !basePageW || !basePageH) return ctx.scale.value;
    const clamped = (s: number) => Math.min(3, Math.max(0.3, s));
    if (mode === 'height') {
      const availH = sc.clientHeight - 32; // 上下 padding 16*2
      return clamped(availH / basePageH);
    }
    const availW = sc.clientWidth - 48; // 左右安全边距 24*2，与原加载逻辑一致
    return clamped(availW / basePageW);
  }

  /** 防抖重算基础缩放并按新缩放重绘（仅在缩放变化明显时触发，避免无谓重渲染） */
  function resizeRefit(): void {
    if (pdfResizeTimer) clearTimeout(pdfResizeTimer);
    pdfResizeTimer = setTimeout(() => {
      if (!ctx.pdfDoc || !basePageW) return;
      const next = computeBaseScale(ctx.props.pdfFitMode || 'width');
      if (Math.abs(next - ctx.baseScale.value) < 0.002) return;
      ctx.baseScale.value = next;
      void applyScale(next);
    }, 200);
  }


  /**
   * PDF 采用「整本连续纵向排列」的渲染布局（所有页堆叠在单个滚动容器内），
   * 因此阅读器固定运行在连续滚动模式：滚轮交给浏览器原生纵向滚动，
   * 可逐页完整浏览（含每页下半部分），不再走「整页翻页」逻辑。
   * 全局 settings.scrollMode 对 PDF 不生效（翻页模式需要单页布局，当前 PDF 未实现）。
   */
  const mode = computed<'scroll' | 'paginated'>(() => 'scroll');

  /** 页数枚举（供 v-for） */
  const pageList = computed(() => Array.from({ length: ctx.numPages.value }, (_, i) => i + 1));

  /** 主题 class */
  const themeClass = computed(() => `theme-${ctx.props.theme}`);

  /** 阅读区背景 CSS */
  const readerBg = computed(() =>
    resolveReadingBg(ctx.props.bgType ?? 'preset', ctx.props.bgColor ?? '', ctx.props.bgImage ?? '', ctx.props.theme)
  );
  /** 阅读区文字色 */
  const readerText = computed(() => resolveReadingText(ctx.props.textColor ?? '', ctx.props.theme));

  /** 当前缩放百分比（仅展示用） */
  const scalePercent = computed(() => Math.round(ctx.scale.value * 100));

  // ===== 渲染 =====

  /**
   * 预计算所有页面在指定缩放下的尺寸（写入响应式 pageSizes，供模板布局）。
   * 一次性遍历所有页的 viewport，使后续 offsetTop/可视区计算正确，再按需懒渲染 canvas。
   */
  async function computeAllPageSizes(scale: number): Promise<void> {
    const doc = ctx.pdfDoc;
    if (!doc) return;
    for (let n = 1; n <= ctx.numPages.value; n++) {
      try {
        const page = await doc.getPage(n);
        const vp = page.getViewport({ scale });
        // 用 viewport 的原始（可能含小数）css 尺寸，使 .pdf-page / canvas / 划线层
        // 与 viewport 坐标空间完全一致，划线坐标换算后像素级对齐（不再被 Math.floor 引入偏差）
        ctx.pageSizes[n] = { w: vp.width, h: vp.height } as PdfPageSize;
      } catch {
        /* 单页失败不影响其它页 */
      }
    }
  }

  /** 取消某页进行中的渲染任务（不等待） */
  function cancelPageTask(num: number): void {
    const t = ctx.renderTasks.get(num);
    if (t) {
      try {
        t.cancel();
      } catch {
        /* ignore */
      }
      ctx.renderTasks.delete(num);
    }
  }

  /** 等待所有进行中的渲染任务结束（缩放重渲染前调用，避免「same canvas」冲突） */
  async function cancelAllRenderTasks(): Promise<void> {
    const tasks = [...ctx.renderTasks.values()];
    ctx.renderTasks.clear();
    ctx.renderingPages.clear();
    await Promise.all(
      tasks.map((t) =>
        Promise.resolve()
          .then(() => t?.cancel?.())
          .catch(() => {})
      )
    );
  }

  /** 清空单页的 canvas / 文本层 / 划线层，并从已渲染集合中移除 */
  function clearPage(num: number): void {
    cancelPageTask(num);
    ctx.renderingPages.delete(num);
    const canvas = ctx.canvasRefs.get(num);
    const textEl = ctx.textRefs.get(num);
    const hlEl = ctx.hlRefs.get(num);
    if (canvas) {
      const c2d = canvas.getContext('2d');
      c2d?.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (textEl) textEl.innerHTML = '';
    if (hlEl) hlEl.innerHTML = '';
    ctx.renderedPages.delete(num);
  }

  /** 清空所有已渲染页（缩放变化时调用） */
  function clearAllPages(): void {
    for (const n of [...ctx.renderedPages]) clearPage(n);
  }

  /**
   * 渲染单页（canvas + 文本层），并补画该页已有划线。
   * 通过 renderedPages 集合去重，重复调用安全。
   */
  async function renderPage(num: number): Promise<void> {
    if (ctx.disposed) return;
    if (num < 1 || num > ctx.numPages.value) return;
    if (ctx.renderedPages.has(num)) return;
    // 同步防并发：同一页已在渲染途中（renderedPages 仅在文本层完成后才加入），避免同一 canvas 被并发 render
    if (ctx.renderingPages.has(num)) return;
    const doc = ctx.pdfDoc;
    if (!doc) return;
    const canvas = ctx.canvasRefs.get(num);
    const textEl = ctx.textRefs.get(num);
    const hlEl = ctx.hlRefs.get(num);
    if (!canvas || !textEl || !hlEl) return;

    ctx.renderingPages.add(num);
    try {
      // 兜底：取消该页可能残留的渲染任务（理论上上面的 guard 已挡住并发，这里防止缩放取消后残留）
      const existing = ctx.renderTasks.get(num);
      if (existing) {
        try {
          await existing.cancel();
        } catch {
          /* ignore */
        }
        ctx.renderTasks.delete(num);
      }
      const page = await doc.getPage(num);
      if (ctx.disposed) return;
      const outputScale = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: ctx.scale.value });
      // 缓存该页当前 viewport，供划线坐标在 PDF 空间与 css 像素间换算（官方 viewer 同款做法）
      ctx.pageViewports.set(num, viewport);
      // 用 viewport 的原始（可能含小数）css 尺寸作为页面尺寸，使各叠加层与 viewport 坐标空间一致
      ctx.pageSizes[num] = { w: viewport.width, h: viewport.height } as PdfPageSize;
      await nextTick();
      const cw = Math.floor(viewport.width * outputScale);
      const ch = Math.floor(viewport.height * outputScale);
      if (canvas.width !== cw) canvas.width = cw;
      if (canvas.height !== ch) canvas.height = ch;
      // 注意：canvas 的 css 尺寸沿用 viewport 原始宽度（含小数），与坐标换算空间严格对齐；
      // 仅 backing store（canvas.width/height）取整，不影响显示对齐
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return;
      const renderTask = page.render({
        canvasContext: ctx2d,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      } as any);
      ctx.renderTasks.set(num, renderTask);
      await renderTask.promise;
      if (ctx.disposed) return;
      ctx.renderTasks.delete(num);
      // 文本层（可选区）
      textEl.innerHTML = '';
      // pdf.js v6 TextLayer 的容器尺寸与每个文字 span 的 fontSize/坐标都依赖宿主注入的
      // CSS 变量 --total-scale-factor（当前缩放）与 --scale-round-x/y（取整步长）。
      // 若未定义，文本层容器塌陷、span 字号与坐标错位，导致在主文档中无法选中文字，
      // 进而选中文字后的「划线/笔记」浮动工具条不会弹出（EPUB 走 iframe 不受影响）。
      // 此处按官方 viewer 的方式显式注入，确保文本层与 canvas 像素对齐、可选中。
      textEl.style.setProperty('--total-scale-factor', String(ctx.scale.value));
      textEl.style.setProperty('--scale-round-x', '1px');
      textEl.style.setProperty('--scale-round-y', '1px');
      const textContent = await page.getTextContent();
      if (ctx.disposed) return;
      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: textContent,
        container: textEl,
        viewport,
      } as any);
      await textLayer.render();
      if (ctx.disposed) return;
      // 兜底：保证文本层容器与 canvas 同尺寸（避免 round()/var 解析异常时容器塌陷导致选不中）
      textEl.style.width = `${Math.floor(viewport.width)}px`;
      textEl.style.height = `${Math.floor(viewport.height)}px`;
      // 补画划线（renderHighlights 由本 composable 注册到 ctx）
      ctx.renderHighlights?.(num);
      ctx.renderedPages.add(num);
    } catch (err: any) {
      if (err?.name === 'RenderingCancelledException') return;
      console.error('渲染 PDF 页失败', num, err);
    } finally {
      ctx.renderingPages.delete(num);
    }
  }

  /** 计算当前可视区页码范围 [first, last]（基于各页 offsetTop 与滚动位置） */
  function getVisibleRange(): [number, number] {
    const sc = ctx.scrollRef.value;
    if (!sc) return [1, Math.min(2, ctx.numPages.value)];
    const top = sc.scrollTop;
    const vh = sc.clientHeight;
    let first = ctx.numPages.value;
    let last = 1;
    ctx.pageRefs.forEach((el, num) => {
      const st = el.offsetTop;
      const h = ctx.pageSizes[num]?.h || 0;
      if (st < top + vh && st + h > top) {
        if (num < first) first = num;
        if (num > last) last = num;
      }
    });
    if (first > last) {
      first = 1;
      last = Math.min(2, ctx.numPages.value);
    }
    return [first, last];
  }

  /** 渲染可视区附近（±1 页）的页，未渲染的补渲染 */
  function ensureRenderedRange(): void {
    if (ctx.disposed || !ctx.pdfDoc) return;
    const [first, last] = getVisibleRange();
    const lo = Math.max(1, first - 1);
    const hi = Math.min(ctx.numPages.value, last + 1);
    for (let n = lo; n <= hi; n++) renderPage(n);
  }

  // ===== 进度 / 当前页 =====

  /** 依据滚动位置更新当前页码 */
  function computeCurrentPage(): void {
    const sc = ctx.scrollRef.value;
    if (!sc) return;
    const top = sc.scrollTop + 2;
    let cur = 1;
    ctx.pageRefs.forEach((el, num) => {
      if (el.offsetTop <= top) cur = Math.max(cur, num);
    });
    if (cur !== ctx.currentPage.value) ctx.currentPage.value = cur;
  }

  /** 计算并向上 emit 当前阅读进度（cfi = 当前页码） */
  function emitProgress(): void {
    if (!ctx.numPages.value) return;
    const percent = Math.min(100, Math.round((ctx.currentPage.value / ctx.numPages.value) * 100));
    ctx.emit('progress-update', { cfi: String(ctx.currentPage.value), percent, filePath: ctx.filePath });
  }

  /** 立即落库当前进度（卸载/切书前调用） */
  function flushProgress(filePathOverride?: string): void {
    if (!ctx.numPages.value) return;
    const filePath = filePathOverride || ctx.props.filePath || ctx.filePath;
    ctx.emit('progress-update', { cfi: String(ctx.currentPage.value), percent: Math.min(100, Math.round((ctx.currentPage.value / ctx.numPages.value) * 100)), filePath });
  }

  // ===== 导航 =====

  /** 跳转到指定页（滚动使该页顶部对齐视口顶部） */
  function goToPage(num: number, smooth = false): void {
    const sc = ctx.scrollRef.value;
    const el = ctx.pageRefs.get(num);
    if (!sc || !el) return;
    sc.scrollTo({ top: el.offsetTop, behavior: smooth ? 'smooth' : 'auto' });
  }

  /** 翻到上一页 */
  function prevPage(): void {
    if (ctx.currentPage.value <= 1) return;
    goToPage(ctx.currentPage.value - 1, true);
  }
  /** 翻到下一页 */
  function nextPage(): void {
    if (ctx.currentPage.value >= ctx.numPages.value) return;
    goToPage(ctx.currentPage.value + 1, true);
  }
  /** 缩放复位到 fit-width 基础缩放 */
  function zoomReset(): void {
    applyScale(ctx.baseScale.value);
  }
  /**
   * 跳转到指定划线锚点（anchor = "page:rects"，由父组件笔记抽屉点击传入）。
   * 与 goToPage 只滚到页首不同，这里会按 rects 解析出页内精确位置，
   * 把划线定位到视口上 30% 处（下方留出阅读空间），避免「只跳到页首、找不到对应行」。
   *
   * @param anchor - 划线锚点（页码 + 矩形数组，矩形为 PDF 空间角点或归一化矩形）
   * @param id - 标注 id（可选），传入后跳转完成会闪烁对应划线，便于定位
   */
  async function jumpToAnnotation(anchor: string, id?: number): Promise<void> {
    if (!anchor) return;
    // 解析页码与矩形数组
    let page = 0;
    let rects: number[][] = [];
    try {
      const idx = anchor.indexOf(':');
      if (idx > 0) {
        page = parseInt(anchor.slice(0, idx), 10) || 0;
        const parsed = JSON.parse(anchor.slice(idx + 1));
        if (Array.isArray(parsed)) rects = parsed as number[][];
      } else {
        page = parseInt(anchor, 10) || 0;
      }
    } catch {
      page = 0;
      rects = [];
    }
    if (page < 1 || page > ctx.numPages.value) return;
    const sc = ctx.scrollRef.value;
    const pageEl = ctx.pageRefs.get(page);
    if (!sc || !pageEl) return;

    // 兜底：无法换算页内坐标时，至少滚到该页顶部（与原 goToPage 行为一致）
    let targetY = pageEl.offsetTop;

    const firstRect = rects.find((r) => Array.isArray(r) && r.length >= 4);
    if (firstRect) {
      const isNormalized = firstRect.every((v) => v >= -0.001 && v <= 1.001);
      if (isNormalized) {
        // 旧格式：归一化矩形（0~1），直接用当前页尺寸换算
        const size = ctx.pageSizes[page];
        if (size) targetY = pageEl.offsetTop + firstRect[1] * size.h - sc.clientHeight * 0.3;
      } else {
        // 新格式：PDF 空间角点，用当前缩放的 viewport 还原为 css 像素
        let viewport = ctx.pageViewports.get(page);
        if (!viewport && ctx.pdfDoc) {
          try {
            const pg = await ctx.pdfDoc.getPage(page);
            viewport = pg.getViewport({ scale: ctx.scale.value });
          } catch {
            viewport = undefined;
          }
        }
        if (viewport) {
          const [ax, ay] = viewport.convertToViewportPoint(firstRect[0], firstRect[1]);
          const [bx, by] = viewport.convertToViewportPoint(firstRect[2], firstRect[3]);
          const cssTop = Math.min(ay, by); // viewport y 向下，较小值为上沿
          targetY = pageEl.offsetTop + cssTop - sc.clientHeight * 0.3;
        }
      }
    }

    const maxScroll = Math.max(0, sc.scrollHeight - sc.clientHeight);
    targetY = Math.max(0, Math.min(targetY, maxScroll));
    sc.scrollTo({ top: targetY, behavior: 'smooth' });

    // 滚动渲染到位后闪烁对应划线（懒渲染：页面在滚动时才会 render）
    if (typeof id === 'number') flashAnnotation(page, id);
  }

  /** 滚动完成后闪烁对应划线：划线层为懒渲染，需轮询等待 [data-id] 出现后再闪烁 */
  function flashAnnotation(page: number, id: number): void {
    let tries = 0;
    const maxTries = 30; // 约 1.5s
    const timer = window.setInterval(() => {
      const hlEl = ctx.hlRefs.get(page);
      const el = hlEl?.querySelector(`.pdf-hl[data-id="${id}"]`) as HTMLElement | null;
      if (el) {
        window.clearInterval(timer);
        el.classList.add('is-flash');
        window.setTimeout(() => el.classList.remove('is-flash'), 1400);
        return;
      }
      if (++tries >= maxTries) window.clearInterval(timer);
    }, 50);
  }
  /** 左侧边缘点击：上一页 */
  function onEdgePrev(): void {
    if (ctx.loading.value) return;
    prevPage();
  }
  /** 右侧边缘点击：下一页 */
  function onEdgeNext(): void {
    if (ctx.loading.value) return;
    nextPage();
  }

  /** 滑块跳转 */
  function onSliderChange(val: number | number[]): void {
    const p = Array.isArray(val) ? val[0] : val;
    if (p < 1 || p > ctx.numPages.value) return;
    goToPage(p, true);
  }

  // ===== 缩放 =====

  /** 应用新缩放：取消进行中的渲染、清空已渲染、重算所有页尺寸、按需重新渲染 */
  async function applyScale(newScale: number): Promise<void> {
    const clamped = Math.min(5, Math.max(0.3, newScale));
    // 先取消并等待所有进行中的渲染结束，否则缩放后重渲染会与旧任务抢同一 canvas
    await cancelAllRenderTasks();
    ctx.scale.value = clamped;
    clearAllPages();
    await computeAllPageSizes(clamped);
    await nextTick();
    ensureRenderedRange();
  }
  /** 放大 */
  function zoomIn(): void {
    applyScale(ctx.scale.value * 1.2);
  }
  /** 缩小 */
  function zoomOut(): void {
    applyScale(ctx.scale.value / 1.2);
  }

  // ===== 事件 =====

  let progressTimer: ReturnType<typeof setTimeout> | null = null;
  /** 滚动：更新当前页、补渲染、节流 emit 进度 */
  function onScroll(): void {
    if (ctx.disposed) return;
    computeCurrentPage();
    ensureRenderedRange();
    if (!progressTimer) {
      progressTimer = setTimeout(() => {
        progressTimer = null;
        emitProgress();
      }, 300);
    }
  }

  let wheelAccum = 0;
  let wheelIdleTimer: ReturnType<typeof setTimeout> | null = null;
  /** 滚轮：翻页模式累加阈值翻页；滚动模式让原生滚动 */
  function onWheel(e: WheelEvent): void {
    if (mode.value === 'scroll') return; // 连续滚动模式：原生滚动，不拦截滚轮
    if (ctx.props.wheelPageEnabled === false) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    const raw = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    const sensitivity = ctx.props.wheelPageSensitivity ?? 5;
    wheelAccum += raw * unit * (sensitivity / 5);
    const THRESHOLD = 100;
    if (Math.abs(wheelAccum) >= THRESHOLD) {
      const dir = wheelAccum > 0 ? 1 : -1;
      wheelAccum = 0;
      if (dir > 0) nextPage();
      else prevPage();
    }
    e.preventDefault();
    if (wheelIdleTimer) clearTimeout(wheelIdleTimer);
    wheelIdleTimer = setTimeout(() => {
      wheelAccum = 0;
    }, 200);
  }

  // ===== 加载 / 生命周期 =====

  /** 恢复上次阅读进度（按页码滚动到对应页） */
  async function restoreProgress(filePath: string): Promise<void> {
    try {
      let page = 0;
      const res = await window.ipcRenderer.ebook.getProgress(filePath);
      if (res?.success && res.data?.cfi) {
        const p = parseInt(res.data.cfi, 10);
        if (!isNaN(p) && p > 0) page = p;
      }
      if (!page) {
        const local = ebookStore.getBookProgress(filePath);
        if (local?.cfi) {
          const p = parseInt(local.cfi, 10);
          if (!isNaN(p) && p > 0) page = p;
        }
      }
      if (page > 0 && page <= ctx.numPages.value) {
        await nextTick();
        goToPage(page);
      }
    } catch (err) {
      console.error('恢复 PDF 阅读进度失败', err);
    }
  }

  /**
   * 提取 PDF 书籍基本信息（标题/作者/封面）并通过 ctx.emit('book-meta') 回传父组件。
   * 标题/作者取自 pdfDoc.getMetadata().info；封面将第 1 页渲染为缩略图 dataURL。
   * 以「即发即弃」方式调用，不阻塞首屏渲染。
   */
  async function renderBookMeta(): Promise<void> {
    if (!ctx.pdfDoc) return;
    try {
      const meta = await ctx.pdfDoc.getMetadata();
      const info: any = (meta && meta.info) || {};
      const title = (info.Title as string) || '';
      const author = (info.Author as string) || '';
      // 封面：第 1 页渲染为缩略图（限制宽度约 240px，JPEG 压缩以减小体积）
      let cover = '';
      try {
        const page = await ctx.pdfDoc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1, 240 / base.width);
        const vp = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx2d = canvas.getContext('2d');
        if (ctx2d) {
          await page.render({ canvasContext: ctx2d, viewport: vp }).promise;
          cover = canvas.toDataURL('image/jpeg', 0.7);
        }
      } catch (err) {
        console.error('提取 PDF 封面失败', err);
      }
      ctx.emit('book-meta', { title, author, cover });
    } catch (err) {
      console.error('提取 PDF 基本信息失败', err);
    }
  }

  /** 加载 PDF 文档：读字节 → 解析 → 预计算尺寸 → 渲染可视区 → 恢复进度 → 加载划线 */
  async function loadDocument(filePath: string): Promise<void> {
    if (!filePath) return;
    ctx.loading.value = true;
    try {
      const res = await window.ipcRenderer.ebook.readFileBytes(filePath);
      if (res?.error) {
        ElMessage.error(res.error);
        return;
      }
      const bytes = base64ToUint8Array(res.base64!);
      // 确保 PDF worker 已注入（含 toHex 等 polyfill），再解析文档
      ensurePdfWorker();
      // 说明：pdf.js v6 已移除基于 eval 的字体支持路径（即旧版 isEvalSupported 选项），
      // CVE-2024-4367 涉及的「恶意字体触发 JS 执行」风险在该版本中已不存在，无需再显式关闭。
      const task = pdfjsLib.getDocument({ data: bytes });
      ctx.pdfDoc = await task.promise;
      ctx.numPages.value = ctx.pdfDoc.numPages;
      ctx.totalPages.value = ctx.pdfDoc.numPages;

      // 适应方式基础缩放：记录第 1 页原始尺寸，再按当前模式（width/height）计算 baseScale
      const first = await ctx.pdfDoc.getPage(1);
      const baseVp = first.getViewport({ scale: 1 });
      basePageW = baseVp.width;
      basePageH = baseVp.height;
      const fitMode = ctx.props.pdfFitMode || 'width';
      ctx.baseScale.value = computeBaseScale(fitMode);
      ctx.scale.value = ctx.baseScale.value;

      await nextTick();
      await computeAllPageSizes(ctx.scale.value);
      await nextTick();
      ctx.loading.value = false;
      ensureRenderedRange();
      await restoreProgress(filePath);
      await ctx.loadAnnotations?.(filePath);
      // 加载目录/outline 与书签列表（按钮在 index.vue 对 epub/pdf 均可用）
      await ctx.loadOutline?.(filePath);
      await ctx.loadBookmarks?.(filePath);
      // 提取书籍基本信息（标题/作者/封面），即发即弃，不阻塞阅读
      void renderBookMeta();
      ctx.initialRenderDone = true;
    } catch (err: any) {
      ElMessage.error(`加载 PDF 失败：${err?.message || String(err)}`);
    } finally {
      ctx.loading.value = false;
    }
  }

  function handleBeforeUnload(): void {
    flushProgress();
  }

  onMounted(() => {
    if (ctx.props.filePath) loadDocument(ctx.props.filePath);
    window.addEventListener('beforeunload', handleBeforeUnload);
    // 阅读区尺寸变化（窗口缩放 / 侧边栏收起展开等）→ 按当前适应方式重新计算缩放并重绘
    pdfResizeObserver = new ResizeObserver(() => {
      if (!ctx.initialRenderDone) return;
      resizeRefit();
    });
    if (ctx.scrollRef.value) pdfResizeObserver.observe(ctx.scrollRef.value);
  });

  // 切书：先落库旧书进度，再加载新书
  watch(
    () => ctx.props.filePath,
    (newPath, oldPath) => {
      flushProgress(oldPath);
      ctx.annotations.value = [];
      ctx.toolbarVisible.value = false;
      ctx.currentSelection.value = null;
      ctx.currentPage.value = 1;
      ctx.numPages.value = 0;
      ctx.totalPages.value = 0;
      clearAllPages();
      if (ctx.pdfDoc) {
        try {
          ctx.pdfDoc.destroy();
        } catch {
          /* ignore */
        }
        ctx.pdfDoc = null;
      }
      if (newPath) loadDocument(newPath);
    }
  );

  // 适应方式（width/height）变化：重新计算基础缩放并应用（应设置抽屉切换）
  watch(
    () => ctx.props.pdfFitMode,
    () => {
      if (!ctx.pdfDoc || !basePageW) return;
      ctx.baseScale.value = computeBaseScale(ctx.props.pdfFitMode || 'width');
      void applyScale(ctx.baseScale.value);
    }
  );

  onUnmounted(() => {
    ctx.disposed = true;
    flushProgress();
    window.removeEventListener('beforeunload', handleBeforeUnload);
    if (pdfResizeTimer) {
      clearTimeout(pdfResizeTimer);
      pdfResizeTimer = null;
    }
    if (pdfResizeObserver) {
      pdfResizeObserver.disconnect();
      pdfResizeObserver = null;
    }
    for (const t of ctx.renderTasks.values()) {
      try {
        t?.cancel?.();
      } catch {
        /* ignore */
      }
    }
    ctx.renderTasks.clear();
    ctx.renderingPages.clear();
    if (ctx.pdfDoc) {
      try {
        ctx.pdfDoc.destroy();
      } catch {
        /* ignore */
      }
      ctx.pdfDoc = null;
    }
  });

  // 把「重绘划线」回调注册到 ctx，供 highlight composable 调用
  /**
   * 把标注画到该页的划线叠加层。
   * 坐标换算采用 pdf.js 官方 viewport 体系（与自带标注层一致）：
   *   - 新格式 rects 存「PDF 坐标空间的两个角点 [x1,y1,x2,y2]」→ 用当前 viewport.convertToViewportPoint 还原成 css 像素；
   *   - 旧格式 rects 为归一化矩形（0~1）→ 用页面尺寸直接换算（兼容历史数据）。
   * 这样无论缩放/布局如何变化，划线都与页面文字像素级对齐。
   */
  /** 把 rgb/rgba/hex 颜色转成指定透明度的 rgba 字符串（高亮背景用较低透明度，保证文字透出） */
  function withAlpha(color: string, a: number): string {
    const m = color.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(',').map((s) => parseFloat(s.trim()));
      return `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${a})`;
    }
    const h = color.match(/^#([0-9a-f]{6})$/i);
    if (h) {
      const n = parseInt(h[1], 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }
    return color;
  }

  function renderHighlights(page: number): void {
    const hlEl = ctx.hlRefs.get(page);
    if (!hlEl) return;
    hlEl.innerHTML = '';
    const size = ctx.pageSizes[page];
    const viewport = ctx.pageViewports.get(page);
    if (!size) return;
    for (const ann of ctx.annotations.value) {
      if (ann.page !== page) continue;
      // 笔记标记只在该标注的「首个线段」渲染一次（noteRendered 标记），
      // 避免多行划线时每行都多出一条线、以及高亮类型被误加下边线的问题。
      let noteRendered = false;
      // 先把每条 rect 换算成 css 像素，再做「同一视觉行合并」，
      // 解决多行/换行文本每行产生多个 client rect、导致下划线/删除线/双下划线
      // 在中间行（换行段）多出一条线的问题。
      const items: { left: number; top: number; width: number; height: number }[] = [];
      for (const r of ann.rects) {
        let left = 0;
        let top = 0;
        let width = 0;
        let height = 0;
        // 旧格式识别：四个分量都在 [-0.001, 1.001] 内视为归一化矩形
        const isNormalized = r.length === 4 && r.every((v) => v >= -0.001 && v <= 1.001);
        if (isNormalized) {
          left = r[0] * size.w;
          top = r[1] * size.h;
          width = (r[2] - r[0]) * size.w;
          height = (r[3] - r[1]) * size.h;
        } else if (viewport) {
          // 新格式：PDF 空间角点 → 当前 viewport 的 css 像素（原点 canvas 左上、y 向下）
          const [ax, ay] = viewport.convertToViewportPoint(r[0], r[1]);
          const [bx, by] = viewport.convertToViewportPoint(r[2], r[3]);
          left = Math.min(ax, bx);
          top = Math.min(ay, by);
          width = Math.abs(bx - ax);
          height = Math.abs(by - ay);
        } else {
          continue; // 无 viewport 无法换算，跳过该条
        }
        items.push({ left, top, width, height });
      }
      // 1) 取整：消除子像素抖动导致的伪重叠/伪分离（同一视觉行被算成两条）。
      const snap = (v: number) => Math.round(v);
      const snapped = items
        .map((it) => ({
          left: snap(it.left),
          top: snap(it.top),
          width: snap(it.width),
          height: snap(it.height),
        }))
        .filter((it) => it.width > 0 && it.height > 0);
      // 2) 精确去重：捕获端偶尔会把同一视觉行存成两条完全一致的矩形，
      //    先剔除精确重复项，避免中间行高亮叠两层（颜色更深）/ 划线多画一条。
      const seen = new Set<string>();
      const dedup: typeof snapped = [];
      for (const it of snapped) {
        const key = `${it.left},${it.top},${it.width},${it.height}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push(it);
      }
      // 3) 同一视觉行合并：按 top、left 升序；若当前矩形与上一矩形在垂直方向显著重叠
      //    （重叠比例 > 50%，即属于同一视觉行），且水平方向有交集或紧邻，则合并为一条。
      //    这样每个视觉行只画一条线，彻底消除「多行划线时中间行多出一条线 / 高亮更深」的问题，
      //    同时保留换行文本（不同视觉行重叠≈0）各自成一条的正确表现。
      dedup.sort((a, b) => a.top - b.top || a.left - b.left);
      const merged: typeof dedup = [];
      for (const it of dedup) {
        const last = merged[merged.length - 1];
        if (last) {
          const vOverlap = Math.max(
            0,
            Math.min(last.top + last.height, it.top + it.height) - Math.max(last.top, it.top)
          );
          const overlapRatio = vOverlap / Math.min(last.height, it.height);
          const hOverlapOrAdjacent =
            it.left <= last.left + last.width + 4 && it.left + it.width >= last.left - 4;
          if (overlapRatio > 0.5 && hOverlapOrAdjacent) {
            const newLeft = Math.min(last.left, it.left);
            const newRight = Math.max(last.left + last.width, it.left + it.width);
            const newTop = Math.min(last.top, it.top);
            const newBottom = Math.max(last.top + last.height, it.top + it.height);
            last.left = newLeft;
            last.top = newTop;
            last.width = newRight - newLeft;
            last.height = newBottom - newTop;
            continue;
          }
        }
        merged.push({ ...it });
      }
      const map: any = ebookStore.settings.annotationStyles;
      const typeStyle = map[ann.type] ||
        { color: ann.color, underlineGap: 2, lineThickness: 2, rowPaddingY: 2 };
      const baseColor = getHighlightColorValue(typeStyle.color || ann.color);
      for (const m of merged) {
        const div = document.createElement('div');
        // 始终带类型 class（pdf-hl--highlight/underline/mark/markStrong），由 CSS 决定具体表现，
        // 避免历史「三种线型都画成同一条单下划线」的 bug；划线颜色经 --hl-color 变量传给 CSS。
        div.className = `pdf-hl pdf-hl--${ann.type || 'highlight'}`;
        div.setAttribute('data-id', String(ann.id));
        // 划线线宽 / 线相对行底部的上抬间隙 / 高亮背景上下外扩间距，
        // 均取自「当前标注类型的样式预设」（按格式分别存储），随类型切换整体变化。
        const lineThickness = typeStyle.lineThickness ?? 2;
        const lineOffsetY = typeStyle.underlineGap ?? 2;
        const rowPadY = typeStyle.rowPaddingY ?? 2;
        div.style.setProperty('--hl-line-thickness', `${lineThickness}px`);
        div.style.setProperty('--hl-line-offset-y', `${lineOffsetY}px`);
        div.style.setProperty('--hl-row-pad-y', `${rowPadY}px`);
        div.style.left = `${m.left}px`;
        div.style.top = `${m.top}px`;
        div.style.width = `${m.width}px`;
        div.style.height = `${m.height}px`;
        // 高亮：背景用较低透明度，让底层 canvas 黑字透过半透明背景清晰可见；
        // 不修改文本层 span 颜色——文本层透明字与 canvas 黑字重叠会产生重影，故仅用背景层着色
        if (ann.type === 'highlight') {
          div.style.setProperty('--hl-color', withAlpha(baseColor, 0.28));
        } else {
          div.style.setProperty('--hl-color', baseColor);
        }
        hlEl.appendChild(div);
        // 笔记标记仅在该标注首个线段渲染一次（noteRendered 标记），
        // 解决「多行划线时中间每行多出一条线 / 高亮类型也被误加下边线」的问题。
        if (ann.note && !noteRendered) {
          const mark = document.createElement('span');
          mark.className = 'pdf-hl-note';
          div.appendChild(mark);
          noteRendered = true;
        }
      }
    }
  }
  ctx.renderHighlights = renderHighlights;
  // 把「跳转到指定页码」回调注册到 ctx，供书签/搜索/目录 composable 调用
  ctx.goToPage = goToPage;

  /**
   * 标注数据变化（加载 / 新增 / 编辑 / 删除）时，重绘所有「已渲染页」的划线层。
   *
   * 这是修复「PDF 划线已存库但页面不回显」的关键：PDF 的划线是独立于 canvas 的叠加层，
   * 必须靠 renderHighlights 在其自身生命周期重绘（与 pdf.js v6 高亮编辑器层解耦于页面 render() 的设计一致）。
   * 仅靠 renderPage 末尾与 loadAnnotations 的循环会在以下竞态下漏绘：
   *   1) 标注从 DB 加载完成时，目标页（尤其 restoreProgress 滚动到的页）尚未渲染，循环拿不到该页；
   *   2) 页已渲染，但当时标注列表为空，renderPage 末尾的 renderHighlights 用空列表绘制，之后不再重绘。
   * 用 deep watch 兜底：标注一变，所有已渲染页立即重画（未渲染页仍由 renderPage 末尾的 renderHighlights 覆盖）。
   */
  watch(
    () => ctx.annotations.value,
    () => {
      for (const n of [...ctx.renderedPages]) ctx.renderHighlights?.(n);
    },
    { deep: true }
  );

  /**
   * 划线样式参数（线宽 / 线间隙 / 高亮行上下间距）变化（阅读设置抽屉中调整）时，
   * 重绘所有已渲染页，使调整即时生效，无需重新打开文档。
   */
  watch(
    () => ebookStore.settings.annotationStyles,
    () => {
      for (const n of [...ctx.renderedPages]) ctx.renderHighlights?.(n);
    },
    { deep: true }
  );

  return {
    themeClass,
    readerBg,
    readerText,
    loading: ctx.loading,
    onScroll,
    onWheel,
    onHlClick: (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const hl = target.closest('.pdf-hl') as HTMLElement | null;
      if (hl) {
        const id = Number(hl.getAttribute('data-id'));
        if (id) ctx.onHighlightClick?.(id);
      }
    },
    mode,
    pageList,
    scalePercent,
    currentPage: ctx.currentPage,
    totalPages: ctx.totalPages,
    prevPage,
    nextPage,
    onEdgePrev,
    onEdgeNext,
    onSliderChange,
    zoomIn,
    zoomOut,
    zoomReset,
    scale: ctx.scale,
    goToPage,
    jumpToAnnotation,
    renderHighlights,
    // 提供给 highlight 调用，重新加载划线后重绘画线
    rerenderAllHighlights: () => {
      for (const n of ctx.renderedPages) renderHighlights(n);
    },
  };
}
