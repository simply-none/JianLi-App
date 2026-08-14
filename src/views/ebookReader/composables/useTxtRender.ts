/**
 * TxtReader 渲染 / 分页 / 翻页 / 进度 / 主题 composable（路线一：排版交给浏览器）
 *
 * 与 useTxtHighlight 共享同一个 ctx（见 txtContext.ts）。本 composable 只负责
 * 「把 txt 文件加载并呈现」相关能力：
 *   - 文件读取，整章正文作为单元素连续流渲染
 *   - paginated 模式用 CSS 多列（column-width/column-gap/column-fill:auto）+ translateX 翻页；
 *     scroll 模式单列连续、原生纵向滚动
 *   - 分段高亮的渲染计算（pageSegments）及高亮段样式
 *   - 进度计算与 emit（以全文字符偏移为锚点，与分页方式解耦）
 *   - 阅读区背景/文字色、字体、行距、分栏、页边距的动态样式
 *   - 容器尺寸 / 排版变化重载（按偏移恢复位置）、生命周期与响应 props 的监听
 *
 * 关键不变量：分页由浏览器排版引擎完成，断行断页天然正确，绝不裁切半行到可视区外；
 * 进度/划线锚点用全文字符偏移，与「按页数」解耦，字号/分栏/窗口变化后按偏移恢复。
 */
import { computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { HIGHLIGHT_COLOR_MAP } from '../highlightConfig';
import { resolveReadingBg, resolveReadingText } from '../themePresets';
import useGlobalSetting from '@/store/useGlobalSetting';
import type { TxtCtx, Segment } from './txtContext';

/** 翻页模式下相邻屏幕之间的列间距（px），同时作为每屏内列与列的间距 */
const PAGE_GAP = 28;

export function useTxtRender(ctx: TxtCtx) {
  /** 阅读模式：scroll=滚动，否则 paginated=翻页（来自 props.scrollMode） */
  const mode = computed<'scroll' | 'paginated'>(() =>
    ctx.props.scrollMode ? 'scroll' : 'paginated'
  );

  /** 总页数（paginated 由布局测量得到；scroll 恒为 1） */
  const totalPages = ctx.totalPages;

  /** 整章正文分段渲染：按划线把全文切成交替的普通段/高亮段，每段带全局 data-start */
  const pageSegments = computed<Segment[]>(() => {
    const text = ctx.fullContent.value;
    if (!text) return [];
    const intersected = ctx.annotations.value
      .filter((a) => a.start < text.length && a.end > 0 && a.end > a.start)
      .map((a) => ({
        id: a.id,
        start: Math.max(0, a.start),
        end: Math.min(a.end, text.length),
        color: a.color,
        type: a.type,
        note: a.note,
      }))
      .sort((x, y) => x.start - y.start);

    const segments: Segment[] = [];
    let cursor = 0;
    for (const a of intersected) {
      if (a.end <= cursor) continue;
      const segStart = Math.max(a.start, cursor);
      if (segStart > cursor) {
        segments.push({
          text: text.substring(cursor, segStart),
          isHighlight: false,
          annotationId: null,
          globalStart: cursor,
          color: '',
          type: '',
          note: '',
        });
      }
      segments.push({
        text: text.substring(segStart, a.end),
        isHighlight: true,
        annotationId: a.id,
        globalStart: segStart,
        color: a.color,
        type: a.type,
        note: a.note,
      });
      cursor = a.end;
    }
    if (cursor < text.length) {
      segments.push({
        text: text.substring(cursor),
        isHighlight: false,
        annotationId: null,
        globalStart: cursor,
        color: '',
        type: '',
        note: '',
      });
    }
    return segments;
  });

  /** 主题 class 计算属性 */
  const themeClass = computed(() => `theme-${ctx.props.theme}`);

  /** 阅读区实际背景 CSS 值 */
  const readerBg = computed(() =>
    resolveReadingBg(ctx.props.bgType ?? 'preset', ctx.props.bgColor ?? '', ctx.props.bgImage ?? '', ctx.props.theme)
  );

  /** 阅读区实际文字颜色 */
  const readerText = computed(() => resolveReadingText(ctx.props.textColor ?? '', ctx.props.theme));

  /** 合并中文/英文正文字体为 CSS font-family 值 */
  const fontFamilyValue = computed(() => {
    const cn = ctx.props.fontFamily || "'Microsoft YaHei', 'PingFang SC'";
    const en = ctx.props.fontFamilyEn || 'sans-serif';
    return `${cn}, ${en}`;
  });

  /** 正文本地行距倍率（缺省 1.8） */
  const lineHeight = computed(() => ctx.props.lineHeight ?? 1.8);
  /** 分栏数（缺省 1 单栏） */
  const columnCount = computed(() => ctx.props.columnCount ?? 1);
  /** 页边距 px（缺省 24） */
  const margin = computed(() => ctx.props.margin ?? 24);

  /** 由可用宽度与每屏列数算出单列宽（px） */
  function columnWidthFor(availW: number, cols: number): number {
    const n = Math.max(1, cols);
    return Math.max(1, (availW - (n - 1) * PAGE_GAP) / n);
  }

  /** 实测视口可用宽高（px），写入响应式 ref 供 flowStyle / measureLayout 共用，保证两者一致 */
  function readViewport() {
    const vp = ctx.viewportRef.value;
    if (!vp) return;
    const m = ctx.props.margin ?? 24;
    ctx.viewportWidth.value = Math.max(0, vp.clientWidth - m * 2);
    ctx.viewportHeight.value = Math.max(0, vp.clientHeight - m * 2);
  }

  /** 正文流的内联样式：paginated 多列分页 / scroll 单列滚动 */
  const flowStyle = computed<Record<string, string>>(() => {
    const base: Record<string, string> = {
      fontSize: `${ctx.props.fontSize || 16}px`,
      fontFamily: fontFamilyValue.value,
      lineHeight: String(lineHeight.value),
    };
    if (mode.value === 'scroll') {
      base.columnCount = '1';
      base.columnWidth = 'auto';
      base.columnFill = 'auto';
      base.maxWidth = '720px';
      base.margin = '0 auto';
      base.height = 'auto';
      base.transform = 'none';
    } else {
      // 列宽/列高用 JS 实测的具体 px，避免 calc()/百分比在 getComputedStyle 下解析失真
      const cols = Math.max(1, ctx.props.columnCount ?? 1);
      const availW = ctx.viewportWidth.value;
      const colW = availW > 0 ? columnWidthFor(availW, cols) : 0;
      const step = colW + PAGE_GAP;
      base.columnWidth = `${colW}px`;
      base.columnGap = `${PAGE_GAP}px`;
      base.columnCount = 'auto';
      base.columnFill = 'auto';
      base.height = ctx.viewportHeight.value > 0 ? `${ctx.viewportHeight.value}px` : '100%';
      base.transform =
        step > 0 ? `translateX(${-ctx.currentPage.value * cols * step}px)` : 'translateX(0)';
    }
    return base;
  });

  /** 根据颜色名称（或自定义 CSS 颜色字符串）获取 CSS 颜色值；未命中预设则原样返回（自定义色） */
  function getColorValue(colorName: string): string {
    return HIGHLIGHT_COLOR_MAP[colorName] || colorName || HIGHLIGHT_COLOR_MAP.yellow;
  }

  /** 根据类型获取高亮样式类名 */
  function getTypeClass(type: string): string {
    switch (type) {
      case 'underline':
        return 'txt-underline';
      case 'mark':
        return 'txt-strike';
      case 'markStrong':
        return 'txt-double';
      case 'highlight':
      default:
        return 'txt-highlight';
    }
  }

  /** 获取高亮段的内联样式对象 */
  function getSegmentStyle(segment: Segment): Record<string, string> {
    if (!segment.isHighlight) return {};
    const colorValue = getColorValue(segment.color);
    switch (segment.type) {
      case 'underline':
        return {
          'text-decoration': `underline ${colorValue}`,
          'text-decoration-thickness': '2px',
          'text-underline-offset': '3px',
        };
      case 'mark':
        return {
          'text-decoration': `line-through ${colorValue}`,
          'text-decoration-thickness': '2px',
        };
      case 'markStrong':
        return {
          'text-decoration': `underline ${colorValue}`,
          'text-decoration-thickness': '2px',
          'text-underline-offset': '3px',
          'text-decoration-style': 'double',
        };
      case 'highlight':
      default:
        return {
          'background-color': colorValue,
        };
    }
  }

  // ===== 布局测量与字符偏移 ↔ 页码映射 =====

  /**
   * 测量布局：用 JS 实测的视口可用宽高算出列步进，再由 .txt-flow 的 scrollWidth
   * 推算总列数与总屏数。scroll 模式：单列，总屏数恒为 1。
   * 注意：列宽用 readViewport() 得到的 px 值，不依赖 getComputedStyle 解析 column-width（calc 会失真）。
   */
  function measureLayout() {
    const flow = ctx.flowRef.value;
    if (!flow) return;
    const cols = Math.max(1, ctx.props.columnCount ?? 1);
    const availW = ctx.viewportWidth.value;
    let step = 0;
    if (availW > 0) {
      const colW = columnWidthFor(availW, cols);
      step = colW + PAGE_GAP;
    }
    ctx.colStep.value = step;
    ctx.cols.value = cols;

    if (ctx.props.scrollMode) {
      ctx.totalPages.value = 1;
      return;
    }
    if (step <= 0) {
      ctx.totalPages.value = 1;
      return;
    }
    // 多列布局下，超出视口宽度的列会向右溢出，scrollWidth 即全部列的总宽
    const totalColumns = Math.max(1, Math.round((flow.scrollWidth + PAGE_GAP) / step));
    ctx.totalPages.value = Math.max(1, Math.ceil(totalColumns / cols));
  }

  /** 把全局字符偏移映射为 DOM Range（遍历 .txt-flow 的文本节点累加长度） */
  function rangeAtOffset(offset: number): Range {
    const flow = ctx.flowRef.value!;
    const range = document.createRange();
    let remaining = Math.max(0, offset);
    const walker = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT, null);
    let node = walker.nextNode();
    while (node) {
      const len = node.textContent?.length ?? 0;
      if (remaining <= len) {
        range.setStart(node, remaining);
        range.collapse(true);
        return range;
      }
      remaining -= len;
      node = walker.nextNode();
    }
    range.selectNodeContents(flow);
    range.collapse(false);
    return range;
  }

  /** 由 Range 起点反推全文字符偏移（利用浏览器实际渲染文本，含 pre-wrap 换行） */
  function globalOffsetAtRange(range: Range): number {
    const flow = ctx.flowRef.value;
    if (!flow) return -1;
    const pre = document.createRange();
    pre.setStart(flow, 0);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
  }

  /** 取视口某客户端坐标处的字符偏移（Chromium 用 caretRangeFromPoint） */
  function offsetAtClientPoint(x: number, y: number): number {
    const doc = document as any;
    let range: Range | null = null;
    if (typeof doc.caretRangeFromPoint === 'function') {
      range = doc.caretRangeFromPoint(x, y) as Range | null;
    } else {
      const pos = doc.caretPositionFromPoint?.(x, y);
      if (pos && pos.offsetNode) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (!range) return -1;
    return globalOffsetAtRange(range);
  }

  /**
   * 把全局字符偏移映射为页码（paginated）。
   * 临时取消 transform 以读取 Range 的真实布局 x，再换算到列/屏。
   */
  function offsetToPage(offset: number): number {
    const flow = ctx.flowRef.value;
    if (!flow || ctx.totalPages.value <= 1) return 0;
    const range = rangeAtOffset(offset);
    const prev = flow.style.transform;
    flow.style.transform = 'none';
    const flowRect = flow.getBoundingClientRect();
    const rects = range.getClientRects();
    const x = rects.length ? rects[0].left : flowRect.left;
    flow.style.transform = prev;
    const step = ctx.colStep.value;
    if (step <= 0) return 0;
    const column = Math.round((x - flowRect.left) / step);
    const cols = Math.max(1, ctx.cols.value);
    return Math.max(0, Math.min(ctx.totalPages.value - 1, Math.floor(column / cols)));
  }

  /** 当前屏首字符的全局偏移（paginated 模式：临时翻到该屏后取视口左上角） */
  function startOffsetOfPage(page: number): number {
    const flow = ctx.flowRef.value;
    const vp = ctx.viewportRef.value;
    if (!flow || !vp) return 0;
    const prev = flow.style.transform;
    flow.style.transform = `translateX(${-page * ctx.cols.value * ctx.colStep.value}px)`;
    const rect = vp.getBoundingClientRect();
    const off = offsetAtClientPoint(rect.left + 2, rect.top + 2);
    flow.style.transform = prev;
    return off < 0 ? 0 : off;
  }

  /** scroll 模式：当前滚动位置对应首字符偏移 */
  function offsetAtScrollTop(): number {
    const vp = ctx.viewportRef.value;
    if (!vp) return 0;
    const rect = vp.getBoundingClientRect();
    const off = offsetAtClientPoint(rect.left + 2, rect.top + 2);
    return off < 0 ? 0 : off;
  }

  /** scroll 模式：滚动到指定偏移 */
  function scrollToOffset(offset: number) {
    const flow = ctx.flowRef.value;
    const vp = ctx.viewportRef.value;
    if (!flow || !vp) return;
    const rects = rangeAtOffset(offset).getClientRects();
    if (!rects.length) return;
    const vpRect = vp.getBoundingClientRect();
    vp.scrollTop += rects[0].top - vpRect.top;
  }

  /** 当前阅读位置（按字符偏移） */
  function currentStartOffset(): number {
    if (ctx.props.scrollMode) return offsetAtScrollTop();
    return startOffsetOfPage(ctx.currentPage.value);
  }

  /** 跳转到指定全局字符偏移 */
  function jumpToOffset(offset: number) {
    const clamped = Math.max(0, Math.min(offset, ctx.fullContent.value.length));
    if (ctx.props.scrollMode) {
      scrollToOffset(clamped);
      ctx.currentPage.value = 0;
    } else {
      ctx.currentPage.value = offsetToPage(clamped);
    }
    ctx.sliderValue.value = ctx.currentPage.value + 1;
    emitProgress();
  }

  /** 计算并向上 emit 当前阅读进度（cfi = 当前首字符偏移） */
  function emitProgress() {
    if (!ctx.fullContent.value) return;
    const offset = currentStartOffset();
    const total = ctx.fullContent.value.length || 1;
    const percent = Math.min(100, Math.round((offset / total) * 100));
    ctx.emit('progress-update', { cfi: String(offset), percent });
  }

  /** 加载 txt 文件内容并测量布局、恢复进度与划线 */
  async function loadContent(filePath: string) {
    if (!filePath) return;
    ctx.loading.value = true;
    try {
      const res = await window.ipcRenderer.ebook.readTxt(filePath);
      if (res?.error) {
        ElMessage.error(res.error);
        return;
      }
      // 统一换行为 \n：渲染文本、划线锚点共用同一套字符偏移空间，避免 CRLF 偏移漂移。
      ctx.fullContent.value = (res?.content ?? '').replace(/\r\n?/g, '\n');
      await nextTick();
      // 先实测视口尺寸写入响应式 ref，再 flush（nextTick + 双 rAF）让 flowStyle 用真实列宽重排，
      // 最后 measureLayout 读取 scrollWidth 才是多列布局下的真实总列数（否则首帧 column-width 为 0 → 只 1 页）
      readViewport();
      await nextTick();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      measureLayout();
      await restoreProgress(filePath);
      await ctx.loadAnnotations?.(filePath);
      ctx.initialRenderDone = true;
    } catch (err: any) {
      ElMessage.error(`加载文件失败：${err?.message || String(err)}`);
    } finally {
      ctx.loading.value = false;
    }
  }

  /** 恢复上次阅读进度（从数据库读取 offset 后跳转到对应屏/位置） */
  async function restoreProgress(filePath: string) {
    try {
      const res = await window.ipcRenderer.ebook.getProgress(filePath);
      if (res?.success && res.data?.cfi) {
        const offset = parseInt(res.data.cfi, 10);
        if (!isNaN(offset) && offset > 0) jumpToOffset(offset);
      }
    } catch (err) {
      console.error('恢复阅读进度失败', err);
    }
  }

  /** 跳转到指定划线锚点所在位置（供父组件通过 ref 调用） */
  function jumpToAnnotation(anchor: string) {
    const parts = anchor.split('-');
    const start = parseInt(parts[0], 10);
    if (!isNaN(start)) jumpToOffset(start);
  }

  /** 翻到上一屏 */
  function prevPage() {
    if (ctx.currentPage.value <= 0) return;
    ctx.currentPage.value--;
    ctx.sliderValue.value = ctx.currentPage.value + 1;
    emitProgress();
  }

  /** 翻到下一屏 */
  function nextPage() {
    if (ctx.currentPage.value >= ctx.totalPages.value - 1) return;
    ctx.currentPage.value++;
    ctx.sliderValue.value = ctx.currentPage.value + 1;
    emitProgress();
  }

  /** 阅读区左侧边缘点击：上一页 */
  function onEdgePrev() {
    if (ctx.loading.value) return;
    prevPage();
  }

  /** 阅读区右侧边缘点击：下一页 */
  function onEdgeNext() {
    if (ctx.loading.value) return;
    nextPage();
  }

  /** 鼠标滚轮：paginated 模式累加阈值翻页；scroll 模式让原生滚动 */
  function onWheelPageTurn(e: WheelEvent) {
    if (ctx.props.scrollMode) return;
    if (ctx.props.wheelPageEnabled === false) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    const raw = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    const sensitivity = ctx.props.wheelPageSensitivity ?? 5;
    ctx.wheelAccum += raw * unit * (sensitivity / 5);
    const THRESHOLD = 100;
    if (Math.abs(ctx.wheelAccum) >= THRESHOLD) {
      const dir = ctx.wheelAccum > 0 ? 1 : -1;
      ctx.wheelAccum = 0;
      if (dir > 0) nextPage();
      else prevPage();
    }
    e.preventDefault();
    if (ctx.wheelIdleTimer) clearTimeout(ctx.wheelIdleTimer);
    ctx.wheelIdleTimer = setTimeout(() => {
      ctx.wheelAccum = 0;
    }, 200);
  }

  /** scroll 模式滚动时（节流）emit 进度 */
  let scrollEmitTimer: ReturnType<typeof setTimeout> | null = null;
  function onScroll() {
    if (!ctx.props.scrollMode) return;
    if (scrollEmitTimer) return;
    scrollEmitTimer = setTimeout(() => {
      scrollEmitTimer = null;
      emitProgress();
    }, 250);
  }

  /** 滑块值变化时跳转到对应屏 */
  function onSliderChange(val: number | number[]) {
    const page = Array.isArray(val) ? val[0] : val;
    if (page < 1 || page > ctx.totalPages.value) return;
    ctx.currentPage.value = page - 1;
    ctx.sliderValue.value = page;
    emitProgress();
  }

  /**
   * 排版/尺寸变化重载：保留当前阅读位置（按偏移），重新测量后跳回。防抖 200ms。
   */
  function scheduleReload() {
    if (ctx.reloadTimer) clearTimeout(ctx.reloadTimer);
    ctx.reloadTimer = setTimeout(async () => {
      if (!ctx.props.filePath || !ctx.viewportRef.value) return;
      const saved = currentStartOffset();
      readViewport();
      await nextTick();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      measureLayout();
      jumpToOffset(saved);
    }, 200);
  }

  // ===== 生命周期与监听 =====
  onMounted(() => {
    if (ctx.props.filePath) {
      loadContent(ctx.props.filePath);
    }
    ctx.resizeObserver = new ResizeObserver(() => {
      if (!ctx.initialRenderDone) return;
      // 先更新实测视口尺寸，触发 flowStyle 重排列宽，再防抖重载
      readViewport();
      scheduleReload();
    });
    const observeTarget = ctx.viewportRef.value ?? ctx.txtContainer.value;
    if (observeTarget) ctx.resizeObserver.observe(observeTarget);
  });

  // 排版类设置变化会改变容量/列数，需重新测量并按偏移恢复位置
  watch(
    () => [
      ctx.props.fontSize,
      ctx.props.lineHeight,
      ctx.props.columnCount,
      ctx.props.margin,
      ctx.props.scrollMode,
    ],
    () => {
      if (!ctx.initialRenderDone) return;
      scheduleReload();
    }
  );

  watch(
    () => ctx.props.filePath,
    (newPath) => {
      ctx.annotations.value = [];
      ctx.toolbarVisible.value = false;
      ctx.currentSelection.value = null;
      ctx.currentPage.value = 0;
      ctx.sliderValue.value = 1;
      if (newPath) {
        loadContent(newPath);
      } else {
        ctx.fullContent.value = '';
        ctx.totalPages.value = 1;
        ctx.currentPage.value = 0;
        ctx.sliderValue.value = 1;
      }
    }
  );

  onUnmounted(() => {
    if (ctx.resizeObserver) {
      ctx.resizeObserver.disconnect();
      ctx.resizeObserver = null;
    }
    if (ctx.reloadTimer) {
      clearTimeout(ctx.reloadTimer);
      ctx.reloadTimer = null;
    }
    if (scrollEmitTimer) {
      clearTimeout(scrollEmitTimer);
      scrollEmitTimer = null;
    }
    if (ctx.wheelIdleTimer) {
      clearTimeout(ctx.wheelIdleTimer);
      ctx.wheelIdleTimer = null;
    }
  });

  return {
    themeClass,
    readerBg,
    readerText,
    loading: ctx.loading,
    onWheelPageTurn,
    onScroll,
    mode,
    flowStyle,
    fontFamilyValue,
    lineHeight,
    columnCount,
    margin,
    pageSegments,
    getTypeClass,
    getSegmentStyle,
    onEdgePrev,
    onEdgeNext,
    currentPage: ctx.currentPage,
    totalPages,
    prevPage,
    nextPage,
    sliderValue: ctx.sliderValue,
    onSliderChange,
    jumpToAnnotation,
  };
}
