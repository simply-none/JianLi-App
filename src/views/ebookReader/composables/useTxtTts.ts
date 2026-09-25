/**
 * useTxtTts —— TXT 朗读适配器（接入 useBookTts 调度层）
 *
 * 职责（仅 TXT）：
 *   - 复用 TxtCtx 全文字符偏移：从「当前阅读位置」到文末，按标点切句
 *   - 句子级 + Web 逐字高亮：基于字符偏移构造 Range，用覆盖层（overlay）高亮
 *     （覆盖层挂在 .txt-flow 内，随翻页 transform / 滚动自动跟随，且不改动正文 DOM）
 *   - 翻页 / 滚动跟随：ensureVisible 在句子不在当前屏时调用 render.jumpToOffset / scrollToOffset
 *   - 断点续读：断点串 = 起始全局字符偏移
 *
 * 注意：仅在渲染进程；不新增依赖。
 */
import { onUnmounted } from 'vue';
import type { TxtCtx } from './txtContext';
import { useBookTts, type TtsAdapter, type TtsSentence } from './useBookTts';
import type { TTSBoundaryEvent } from '@/utils/tts/types';
import { splitSentences } from './ttsSentences';

/** 渲染层暴露给适配器的翻页 / 滚动 / 当前位置 API（结构兼容 useTxtRender 返回值） */
export interface TxtRenderApi {
  jumpToOffset(offset: number): void;
  scrollToOffset(offset: number): void;
  currentStartOffset(): number;
}

const SENTENCE_COLOR = 'rgba(108, 92, 231, 0.26)';
const WORD_COLOR = 'rgba(245, 158, 11, 0.58)';

/** 覆盖层高亮：在 .txt-flow 内挂一层 absolute 容器，按 Range 的 clientRects 画高亮块 */
class TxtOverlay {
  private layer: HTMLDivElement | null = null;
  private sentenceEls: HTMLDivElement[] = [];
  private wordEls: HTMLDivElement[] = [];
  constructor(private flowRef: () => HTMLElement | null) {}

  private ensureLayer(): HTMLDivElement | null {
    const flow = this.flowRef();
    if (!flow) return null;
    if (!this.layer) {
      // 建立定位上下文，使覆盖层坐标相对 .txt-flow（随翻页 transform / 滚动自然跟随）
      if (getComputedStyle(flow).position === 'static') {
        flow.style.position = 'relative';
      }
      const layer = document.createElement('div');
      layer.className = 'tts-overlay-layer';
      layer.style.position = 'absolute';
      layer.style.left = '0';
      layer.style.top = '0';
      layer.style.right = '0';
      layer.style.bottom = '0';
      layer.style.pointerEvents = 'none';
      layer.style.zIndex = '5';
      flow.appendChild(layer);
      this.layer = layer;
    }
    return this.layer;
  }

  clearSentence() {
    for (const el of this.sentenceEls) el.remove();
    this.sentenceEls = [];
  }

  clearWord() {
    for (const el of this.wordEls) el.remove();
    this.wordEls = [];
  }

  clearAll() {
    this.clearSentence();
    this.clearWord();
    if (this.layer) {
      this.layer.remove();
      this.layer = null;
    }
  }

  /** 在给定 Range 上绘制高亮（可能跨多行，逐 rect 画块） */
  private paint(range: Range, color: string, store: HTMLDivElement[]) {
    const flow = this.flowRef();
    const layer = this.ensureLayer();
    if (!flow || !layer) return;
    const flowRect = flow.getBoundingClientRect();
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r.width === 0 || r.height === 0) continue;
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.left = `${r.left - flowRect.left}px`;
      el.style.top = `${r.top - flowRect.top}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
      el.style.backgroundColor = color;
      el.style.borderRadius = '2px';
      el.style.pointerEvents = 'none';
      layer.appendChild(el);
      store.push(el);
    }
  }

  highlightSentence(range: Range) {
    this.clearSentence();
    this.clearWord();
    this.paint(range, SENTENCE_COLOR, this.sentenceEls);
  }

  highlightWord(range: Range) {
    this.clearWord();
    this.paint(range, WORD_COLOR, this.wordEls);
  }
}

/** 在 .txt-flow 内构造 [start,end) 字符偏移对应的 Range */
function rangeFromOffsets(flow: HTMLElement, start: number, end: number): Range | null {
  const doc = flow.ownerDocument;
  const walker = doc.createTreeWalker(flow, NodeFilter.SHOW_TEXT, null);
  let pos = 0;
  let sNode: Text | undefined;
  let sOff = 0;
  let eNode: Text | undefined;
  let eOff = 0;
  let n = walker.nextNode() as Text | null;
  while (n) {
    const len = n.textContent?.length ?? 0;
    if (sNode === undefined && start <= pos + len) {
      sNode = n;
      sOff = start - pos;
    }
    if (end <= pos + len) {
      eNode = n;
      eOff = end - pos;
      break;
    }
    pos += len;
    n = walker.nextNode() as Text | null;
  }
  if (!sNode || !eNode) return null;
  const range = doc.createRange();
  range.setStart(sNode, Math.max(0, sOff));
  range.setEnd(eNode, Math.max(0, Math.min(eOff, (eNode.textContent || '').length)));
  return range;
}

export function useTxtTts(ctx: TxtCtx, render: TxtRenderApi) {
  const bookTts = useBookTts();
  const overlay = new TxtOverlay(() => ctx.flowRef.value);

  let pendingRestoreOffset = -1;

  const adapter: TtsAdapter = {
    bookKey: ctx.contentHash || ctx.props.filePath,
    format: 'txt',

    buildQueue(): TtsSentence[] {
      const text = ctx.fullContent.value;
      if (!text) return [];
      const startOffset =
        pendingRestoreOffset >= 0 ? pendingRestoreOffset : render.currentStartOffset();
      pendingRestoreOffset = -1;
      const sub = text.slice(startOffset);
      if (!sub.trim()) return [];
      const segs = splitSentences(sub);
      return segs.map((s) => {
        const absStart = startOffset + s.start;
        return {
          text: s.text,
          globalStart: absStart,
          globalEnd: startOffset + s.end,
          bp: String(absStart),
        };
      });
    },

    onSentenceStart(_index: number, sentence: TtsSentence): void {
      const flow = ctx.flowRef.value;
      if (!flow) return;
      const range = rangeFromOffsets(flow, sentence.globalStart as number, sentence.globalEnd as number);
      if (range) overlay.highlightSentence(range);
    },

    onBoundary(_index: number, sentence: TtsSentence, e: TTSBoundaryEvent): void {
      if (e.name !== 'word') return;
      const flow = ctx.flowRef.value;
      if (!flow) return;
      const base = sentence.globalStart as number;
      const start = base + e.charIndex;
      const len = e.charLength ?? Math.max(1, sentence.text.length - e.charIndex);
      const range = rangeFromOffsets(flow, start, start + len);
      if (range) overlay.highlightWord(range);
    },

    clearHighlight(): void {
      overlay.clearAll();
    },

    ensureVisible(_index: number, sentence: TtsSentence): void {
      const offset = sentence.globalStart as number;
      if (ctx.props.scrollMode) {
        render.scrollToOffset(offset);
      } else {
        render.jumpToOffset(offset);
      }
    },

    restoreFromBreakpoint(bp: string): number {
      const off = parseInt(bp, 10);
      pendingRestoreOffset = isNaN(off) ? -1 : off;
      return 0;
    },

    dispose(): void {
      overlay.clearAll();
      pendingRestoreOffset = -1;
    },
  };

  bookTts.registerAdapter(adapter);

  onUnmounted(() => {
    bookTts.unregisterAdapter(adapter);
  });

  return adapter;
}
