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
import useEbookReader from '@/store/useEbookReader';
import type { TxtCtx, Segment } from './txtContext';

/** 翻页模式下相邻屏幕之间的列间距（px），同时作为每屏内列与列的间距 */
const PAGE_GAP = 28;

export function useTxtRender(ctx: TxtCtx) {
  // 按书进度映射（本地存储兜底，进程退出时 IPC 来不及落库也能恢复）
  const ebookStore = useEbookReader();
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

  /** 由可用宽度与每屏列数算出单列宽（px），增加最小宽度保护，避免异常小列宽 */
  function columnWidthFor(availW: number, cols: number): number {
    const n = Math.max(1, cols);
    const safeW = isFinite(availW) && availW > 0 ? availW : 1;
    const raw = (safeW - (n - 1) * PAGE_GAP) / n;
    // 单栏时列宽不应小于 200px，多栏时不应小于 150px；防止首帧 viewportWidth=0 时产生极窄列
    const minW = n === 1 ? 200 : 150;
    return Math.max(minW, raw);
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
      const m = ctx.props.margin ?? 24;
      // 优先用响应式 viewportWidth；若首帧尚未写入（为 0），回退到直接读取 DOM 宽度，避免 column-width 为 0
      const fallbackW = Math.max(0, (ctx.viewportRef.value?.clientWidth ?? 0) - m * 2);
      const availW = ctx.viewportWidth.value || fallbackW;
      const colW = availW > 0 ? columnWidthFor(availW, cols) : 0;
      const step = colW + PAGE_GAP;
      base.columnWidth = `${colW}px`;
      base.columnGap = `${PAGE_GAP}px`;
      base.columnCount = 'auto';
      base.columnFill = 'auto';
      base.height = ctx.viewportHeight.value > 0 ? `${ctx.viewportHeight.value}px` : '100%';
      base.transform =
        step > 0 ? `translateX(${-ctx.currentPage.value * cols * step}px)` : 'translateX(0)';
      // 翻页平滑过渡：paginated 模式下随 currentPage 变化的位移加缓动，避免硬跳晃眼；
      // scroll 模式不放 transition（由原生滚动/滚轮接管）
      base.transition = 'transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)';
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

  /** 获取高亮段的内联样式对象（样式取自「当前标注类型的预设」，切换类型即整体变化） */
  function getSegmentStyle(segment: Segment): Record<string, string> {
    if (!segment.isHighlight) return {};
    const map: any = ebookStore.settings.annotationStyles;
    const ts = (map && map[segment.type]) || { color: 'yellow', underlineGap: 2, lineThickness: 2, rowPaddingY: 2 };
    const colorValue = getColorValue(ts.color);
    switch (segment.type) {
      case 'underline':
        return {
          'text-decoration': `underline ${colorValue}`,
          'text-decoration-thickness': `${ts.lineThickness || 2}px`,
          'text-underline-offset': `${ts.underlineGap || 2}px`,
        };
      case 'mark':
        return {
          'text-decoration': `line-through ${colorValue}`,
          'text-decoration-thickness': `${ts.lineThickness || 2}px`,
        };
      case 'markStrong':
        return {
          'text-decoration': `underline ${colorValue}`,
          'text-decoration-thickness': `${ts.lineThickness || 2}px`,
          'text-underline-offset': `${ts.underlineGap || 2}px`,
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

  // 进度 / 当前位置的计算统一采用「基于 rangeAtOffset + getBoundingClientRect 的确定性二分定位」，
  // 不再使用 caretRangeFromPoint 命中测试：命中测试会被加载遮罩等覆盖元素拦截，
  // 曾导致进度被误算成书籍末尾或 0。故移除原先的 globalOffsetAtRange / offsetAtClientPoint。

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
    // 注意：rangeAtOffset 返回的是折叠（零宽）Range，getClientRects() 在 Chromium 下会返回空数组，
    // 故用 getBoundingClientRect()（折叠 Range 也能返回插入符所在位置的矩形）。
    const rect = range.getBoundingClientRect();
    const x = rect.left;
    flow.style.transform = prev;
    const step = ctx.colStep.value;
    if (step <= 0) return 0;
    const column = Math.round((x - flowRect.left) / step);
    const cols = Math.max(1, ctx.cols.value);
    return Math.max(0, Math.min(ctx.totalPages.value - 1, Math.floor(column / cols)));
  }

  /**
   * 当前屏首字符的全局偏移（paginated 模式）。
   * 废弃原先的 caretRangeFromPoint 命中测试（会被加载遮罩等覆盖元素拦截，
   * 导致进度被算成 0 或末尾）。改为在「offset → 页码」映射上二分，
   * 直接定位该屏首字符偏移，完全不依赖任何 DOM 命中，结果稳定。
   */
  function startOffsetOfPage(page: number): number {
    const total = ctx.fullContent.value.length;
    if (page <= 0 || total <= 0) return 0;
    let lo = 0, hi = total, ans = total;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (offsetToPage(mid) >= page) {
        ans = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return ans;
  }

  /** scroll 模式：当前滚动位置对应首字符偏移（二分定位可见区首字符，不依赖命中测试） */
  function offsetAtScrollTop(): number {
    const vp = ctx.viewportRef.value;
    const flow = ctx.flowRef.value;
    if (!vp || !flow) return 0;
    const vpRect = vp.getBoundingClientRect();
    const total = ctx.fullContent.value.length;
    if (total <= 0) return 0;
    let lo = 0, hi = total, ans = 0;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const rect = rangeAtOffset(mid).getBoundingClientRect();
      // rect.top - vpRect.top：该字符相对视口可见区顶部的位置（随滚动变化，单调不减）
      if (rect.top - vpRect.top >= 0) {
        ans = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return ans;
  }

  /** scroll 模式：滚动到指定偏移 */
  function scrollToOffset(offset: number) {
    const flow = ctx.flowRef.value;
    const vp = ctx.viewportRef.value;
    if (!flow || !vp) return;
    // 注意：rangeAtOffset 返回的是折叠（零宽）Range，getClientRects() 在 Chromium 下会返回空数组，
    // 故必须用 getBoundingClientRect()（折叠 Range 也能返回插入符所在位置的矩形）。
    const rect = rangeAtOffset(offset).getBoundingClientRect();
    const vpRect = vp.getBoundingClientRect();
    vp.scrollTop += rect.top - vpRect.top;
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
    const cfi = String(offset);
    ctx.currentCfi.value = cfi;
    ctx.emit('progress-update', { cfi, percent, filePath: ctx.props.filePath });
  }

  /**
   * 立即把当前阅读进度落库（取消防抖/节流的滚动定时器并同步 emit）。
   * 在组件卸载 / 切换文件前调用，避免最后一次滚动（250ms 节流窗口内）的位置丢失，
   * 从而导致下次打开时恢复到更早的位置。优先使用已缓存的最近位置，DOM 已销毁时仍可靠。
   */
  function flushProgress(filePathOverride?: string) {
    if (scrollEmitTimer) {
      clearTimeout(scrollEmitTimer);
      scrollEmitTimer = null;
    }
    if (scrollEndTimer) {
      clearTimeout(scrollEndTimer);
      scrollEndTimer = null;
    }
    let cfi = ctx.currentCfi.value;
    if (!cfi && ctx.fullContent.value && (ctx.viewportRef.value || ctx.flowRef.value)) {
      try {
        cfi = String(currentStartOffset());
      } catch {
        cfi = '';
      }
    }
    if (!cfi) return;
    const total = ctx.fullContent.value.length || 1;
    const offset = parseInt(cfi, 10) || 0;
    const percent = Math.min(100, Math.round((offset / total) * 100));
    const filePath = filePathOverride || ctx.props.filePath;
    ctx.emit('progress-update', { cfi, percent, filePath });
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
      // 先关闭加载遮罩：让加载动画尽早消失，避免遮罩淡出动画在阅读区之上停留。
      // 进度计算现已改为确定性的二分定位，不再依赖命中测试，此处仅用于改善体验。
      ctx.loading.value = false;
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

  /** 恢复上次阅读进度（从数据库读取 offset 后跳转到对应屏/位置；DB 无记录时回退本地按书映射） */
  async function restoreProgress(filePath: string) {
    try {
      let offset = 0;
      const res = await window.ipcRenderer.ebook.getProgress(filePath, ctx.contentHash || '');
      if (res?.success && res.data?.cfi) {
        const dbOffset = parseInt(res.data.cfi, 10);
        if (!isNaN(dbOffset) && dbOffset > 0) offset = dbOffset;
      }
      // 数据库无记录（或退出时 IPC 来不及落库）：回退本地按书进度映射，保证进度不丢
      if (!offset) {
        const local = ebookStore.getBookProgress(filePath);
        if (local?.cfi) {
          const localOffset = parseInt(local.cfi, 10);
          if (!isNaN(localOffset) && localOffset > 0) offset = localOffset;
        }
      }
      if (offset > 0) jumpToOffset(offset);
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
  /** scroll 模式滚动停止后（防抖）emit 进度，捕获精确停留位置，缩小退出恢复偏差 */
  let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
  function onScroll() {
    if (!ctx.props.scrollMode) return;
    if (!scrollEmitTimer) {
      scrollEmitTimer = setTimeout(() => {
        scrollEmitTimer = null;
        emitProgress();
      }, 250);
    }
    if (scrollEndTimer) clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(() => {
      scrollEndTimer = null;
      emitProgress();
    }, 150);
  }

  /** 滑块值变化时跳转到对应屏 */
  function onSliderChange(val: number | number[]) {
    const page = Array.isArray(val) ? val[0] : val;
    if (page < 1 || page > ctx.totalPages.value) return;
    ctx.currentPage.value = page - 1;
    ctx.sliderValue.value = page;
    emitProgress();
  }

  // ===== 拖拽选区增强：滚动模式贴边自动滚动 / 翻页模式贴边自动翻页 =====
  // TXT 整本是单一 DOM（CSS 多列分页 / 单列滚动），原生选区天然支持跨列（即跨页）。
  // 这里只在「拖拽到视口边缘」时辅助原生选区：滚动模式滚视口、翻页模式翻页，
  // 原生选区会随内容移动自动续接；松手后 useTxtHighlight.onMouseUp 照常读取选区并算偏移。
  const SELECT_EDGE = 42; // 触发边缘区宽度(px)
  const FLIP_COOLDOWN = 1000; // 翻页间隔(ms)：放慢节奏，避免一下子翻多页
  const FLIP_DWELL = 300; // 进入边缘区后需驻留(ms)才允许翻页，避免光标快速划过误翻
  let isSelecting = false;
  let selectionClassAdded = false;
  let lastFlipAt = 0;
  let inEdgeZone = false; // 当前光标是否处于左右边缘翻页区
  let edgeEnterAt = 0; // 进入边缘区的时刻，用于驻留判定

  /** 当前是否存在非折叠的文本选区 */
  function selectionActive(): boolean {
    const sel = window.getSelection();
    return !!sel && !sel.isCollapsed && sel.toString().length > 0;
  }

  function onViewportMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    isSelecting = true;
    // 新一次拖拽开始前，清除上一轮可能残留的边缘驻留状态
    inEdgeZone = false;
    edgeEnterAt = 0;
  }

  function onViewportMouseMove(e: MouseEvent) {
    if (!isSelecting || !selectionActive()) return;
    // 真实选区已开始后才禁用边缘翻页区，避免其 user-select:none 拦截选区向边缘延伸；
    // 普通点击（无选区）不会进入这里，故点击翻页不受影响。
    if (!selectionClassAdded) {
      selectionClassAdded = true;
      ctx.txtContainer.value?.classList.add('is-selecting');
    }
    const vp = ctx.viewportRef.value;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (ctx.props.scrollMode) {
      // 滚动模式：上下贴边按比例滚动视口，原生选区随内容移动续接
      const h = rect.height;
      if (y < SELECT_EDGE) {
        vp.scrollTop -= Math.max(2, (SELECT_EDGE - y) * 0.6);
      } else if (y > h - SELECT_EDGE) {
        vp.scrollTop += Math.max(2, (y - (h - SELECT_EDGE)) * 0.6);
      }
    } else {
      // 翻页模式：左右贴边翻页（同 DOM，transform 不改变 DOM，原生选区跨列续接）
      const w = rect.width;
      const atRight = x > w - SELECT_EDGE;
      const atLeft = x < SELECT_EDGE;
      if (atRight || atLeft) {
        const now = Date.now();
        if (!inEdgeZone) {
          // 刚进入边缘区：记录进入时刻，需先驻留 FLIP_DWELL 才翻页，
          // 避免光标快速划过边缘时连续误翻多页（"一下子划了好几页"）。
          inEdgeZone = true;
          edgeEnterAt = now;
        }
        if (now - edgeEnterAt >= FLIP_DWELL && now - lastFlipAt >= FLIP_COOLDOWN) {
          lastFlipAt = now;
          if (atRight) nextPage();
          else prevPage();
        }
      } else {
        inEdgeZone = false;
      }
    }
  }

  function onDocMouseUp() {
    if (!isSelecting) return;
    isSelecting = false;
    if (selectionClassAdded) {
      selectionClassAdded = false;
      ctx.txtContainer.value?.classList.remove('is-selecting');
    }
  }

  /**
   * 排版/尺寸变化重载：保留当前阅读位置（按偏移），重新测量后跳回。防抖 200ms。
   * 注意：记忆位置时不能用 currentStartOffset()——切换 scrollMode 时该函数在
   * 「新 scrollMode + 新布局」下计算，位置指示器（scrollTop / currentPage）已被重置为 0，
   * 会得到 0 而非真实位置。故改用与模式无关的 ctx.currentCfi（每次翻页/滚动/恢复都会写入）。
   */
  function scheduleReload() {
    if (ctx.reloadTimer) clearTimeout(ctx.reloadTimer);
    // 切换模式/设置时，布局会先闪到顶部再重排，loading 遮罩盖住这次闪烁（进度已不依赖命中测试，安全）。
    const saved = ctx.currentCfi.value ? parseInt(ctx.currentCfi.value, 10) || 0 : 0;
    ctx.loading.value = true;
    ctx.reloadTimer = setTimeout(async () => {
      try {
        if (!ctx.props.filePath || !ctx.viewportRef.value) return;
        readViewport();
        await nextTick();
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        measureLayout();
        jumpToOffset(saved);
      } catch (err) {
        console.error('重新排版失败', err);
      } finally {
        ctx.loading.value = false;
      }
    }, 200);
  }

  // ===== 生命周期与监听 =====
  // 进程退出前（关闭窗口）补一次落库：flushProgress 会同步写入本地按书进度映射，
  // 即使 saveProgress 的 IPC 来不及落库，下次打开也能从本地映射恢复真实位置。
  function handleBeforeUnload() {
    flushProgress();
  }
  onMounted(() => {
    if (ctx.props.filePath) {
      loadContent(ctx.props.filePath);
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    ctx.resizeObserver = new ResizeObserver(() => {
      if (!ctx.initialRenderDone) return;
      // 先更新实测视口尺寸，触发 flowStyle 重排列宽，再防抖重载
      readViewport();
      scheduleReload();
    });
    const observeTarget = ctx.viewportRef.value ?? ctx.txtContainer.value;
    if (observeTarget) ctx.resizeObserver.observe(observeTarget);
    // 拖拽选区增强：在视口上监听 mousedown/mousemove（贴边自动滚动/翻页），document 上监听 mouseup 收尾
    const vpEl = ctx.viewportRef.value;
    if (vpEl) {
      vpEl.addEventListener('mousedown', onViewportMouseDown);
      vpEl.addEventListener('mousemove', onViewportMouseMove);
    }
    document.addEventListener('mouseup', onDocMouseUp);
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
    (newPath, oldPath) => {
      // 切书前先取消可能挂起的重新排版（否则旧书的 reload 定时器会在新书加载后误触发）
      if (ctx.reloadTimer) {
        clearTimeout(ctx.reloadTimer);
        ctx.reloadTimer = null;
      }
      // 切书时清理可能残留的拖拽选区状态（避免旧书的 is-selecting class / 标志位带到新书）
      isSelecting = false;
      inEdgeZone = false;
      edgeEnterAt = 0;
      if (selectionClassAdded) {
        selectionClassAdded = false;
        ctx.txtContainer.value?.classList.remove('is-selecting');
      }
      // 切书前先落库旧书的当前位置（用旧路径，避免误写进新书条目）
      flushProgress(oldPath);
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
    // 卸载前立即落库当前阅读位置，避免最后一次滚动位置丢失
    flushProgress();
    window.removeEventListener('beforeunload', handleBeforeUnload);
    const vpEl = ctx.viewportRef.value;
    if (vpEl) {
      vpEl.removeEventListener('mousedown', onViewportMouseDown);
      vpEl.removeEventListener('mousemove', onViewportMouseMove);
    }
    document.removeEventListener('mouseup', onDocMouseUp);
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
    if (scrollEndTimer) {
      clearTimeout(scrollEndTimer);
      scrollEndTimer = null;
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
