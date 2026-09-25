/**
 * useEpubTts —— EPUB 朗读适配器（接入 useBookTts 调度层）
 *
 * 职责（仅 EPUB）：
 *   - 抽取「当前章节」可见正文文本，逐句切分并计算每句的 EpubCFI range
 *   - 句子级高亮：复用「手动划线」同一条渲染通道（rendition.annotations.highlight），
 *     画在 iframe 内部 SVG 上（必然在文字之上），所有引擎生效。
 *   - Web 引擎逐字高亮：在句子 Range 内用 sub-range 计算逐词 Range，反算 CFI 后叠加琥珀橙块（仅 Web 的 onboundary 触发）
 *   - 翻页跟随：ensureVisible 在句子不在当前页时自动 display 到该句所在页
 *   - 章节续接：hasNextQueue / nextQueue 翻到下一章并重新抽取
 *   - 断点续读：断点串 = 句子起始 CFI（point CFI）；restoreFromBreakpoint 先定位再切片队列
 *
 * 注意：仅在渲染进程；不新增依赖；CFI 计算依赖 epubjs 的 Contents API（cfiFromRange / range）。
 * 高亮刻意**复用** epub.js 的 annotations.highlight()（与 useEpubHighlight 手动划线同一通道，
 * SVG 在 iframe 内渲染，比父层覆盖层稳定）——这是此前「父层覆盖层跨 iframe 合成层级/坐标换算
 * 在部分环境下不显示」的根本修正。
 */
import { onUnmounted } from 'vue';
import type { Book, Contents } from 'epubjs';
import type { EpubCtx } from './epubContext';
import { useBookTts, type TtsAdapter, type TtsSentence } from './useBookTts';
import type { TTSBoundaryEvent } from '@/utils/tts/types';
import { splitSentences } from './ttsSentences';

/**
 * EPUB 朗读高亮配色（用于 epub.js `annotations.highlight` 的 SVG 样式）。
 * 关键：必须走 **hex fill + fill-opacity（≤0.4）**，**绝不可传 rgba() 作 fill 属性**，
 * 也**不可开 mix-blend-mode**（深色主题下 multiply 会把色块压暗看不见）。
 * 这两条与 useEpubHighlight 的 'highlight' 类型（getTypeStyles）完全一致，已在「手动划线」中验证可用。
 *
 * 朗读高亮复用「手动划线」同一条渲染通道：SVG 画在 iframe 内部、必然在文字之上，
 * 不再用父层定位覆盖层（跨 iframe 合成层级 / 坐标换算在部分环境下不稳定，是此前多次「不显示」的根因）。
 * epub.js 的 annotations 自带 `inject` 渲染钩子，翻页 / 换主题重排后自动把暂存的高亮重新挂到新视图，无需手动重画。
 */
const SENTENCE_STYLE: Record<string, string> = {
  fill: '#6C5CE7',
  'fill-opacity': '0.26',
};
/** 逐字高亮配色：琥珀橙，叠在句子高亮之上表示当前读到的词 */
const WORD_STYLE: Record<string, string> = {
  fill: '#F59E0B',
  'fill-opacity': '0.58',
};

/** 把 CFI 中的整数步进取出来用于大小比较（忽略 ! 与 : ） */
function cfiToInts(cfi: string): number[] {
  if (!cfi) return [];
  const cleaned = cfi.replace(/\!/g, '/').replace(/:\d+/g, '');
  const matches = cleaned.match(/\/(\d+)/g);
  if (!matches) return [];
  return matches.map((m) => parseInt(m.slice(1), 10));
}

/** 比较两段 CFI 的先后（<0 表示 a 在 b 前） */
function cfiCompare(a: string, b: string): number {
  const ia = cfiToInts(a);
  const ib = cfiToInts(b);
  const len = Math.min(ia.length, ib.length);
  for (let i = 0; i < len; i++) {
    if (ia[i] !== ib[i]) return ia[i] - ib[i];
  }
  return ia.length - ib.length;
}

/** 取 range CFI 的起始点 CFI（用于 display 定位与可见性比较） */
function cfiStartOf(rangeCfi: string): string {
  if (!rangeCfi) return '';
  const idx = rangeCfi.indexOf(',');
  return idx >= 0 ? rangeCfi.slice(0, idx) : rangeCfi;
}

/**
 * 在按 cfiStart 升序排列的句子队列里，找到「最后一句起始 CFI ≤ 可见位置 CFI」的下标，
 * 即当前屏幕上正在阅读的那一句（或刚滚过的一句）。句子队列有序，用二分，O(log n)。
 */
function findStartIndexByCfi(queue: TtsSentence[], viewStartCfi: string): number {
  let lo = 0;
  let hi = queue.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cfiCompare(queue[mid].cfiStart as string, viewStartCfi) <= 0) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export function useEpubTts(ctx: EpubCtx) {
  const bookTts = useBookTts();

  let pendingRestoreCfi = '';
  let lastDisplayedStart = '';
  let lastDisplayedEnd = '';
  let currentHref = '';
  // 缓存当前句子的 CFI 与 Range，供逐字高亮复用，避免每词重新解析句子 CFI
  let currentSentenceCfi = '';
  let currentWordCfi = '';
  let currentSentenceRange: Range | null = null;

  /**
   * 跨可见视图安全解析 CFI→Range（epub.js 自带，按 CFI 的 spinePos 筛选可见视图）。
   * 若 getRange 返回空（视图尚未可见），兜底扫描所有已加载 Contents 用其 document 直接解析
   * （toRange 只依赖「正确的文档」，不依赖 spinePos）——保证有效 CFI 一定能拿到 Range。
   */
  function resolveRange(cfiRange: string): Range | null {
    let range: Range | null = null;
    try {
      range = (ctx.rendition?.getRange(cfiRange) as Range | null) || null;
    } catch {
      range = null;
    }
    if (range) return range;
    const list = ctx.rendition?.getContents() as Contents[] | undefined;
    if (list && list.length) {
      for (const c of list) {
        try {
          const r = c.range(cfiRange);
          if (r) {
            range = r;
            break;
          }
        } catch {
          /* 该视图 document 不匹配此 CFI，尝试下一个 */
        }
      }
    }
    return range;
  }

  /** 找持有指定 document 的 Contents（用于把「词 Range」反算成 CFI） */
  function findContentsForDoc(doc: Document | null): Contents | null {
    if (!doc) return null;
    const list = ctx.rendition?.getContents() as Contents[] | undefined;
    if (!list || !list.length) return null;
    return list.find((c) => c.document === doc) || null;
  }

  /** 移除当前逐词高亮（按 cfi+type 去重，移除即清除） */
  function removeWord(): void {
    if (currentWordCfi) {
      try {
        ctx.rendition?.annotations.remove(currentWordCfi, 'highlight');
      } catch {
        /* ignore */
      }
      currentWordCfi = '';
    }
  }

  /**
   * 句级高亮：复用「手动划线」同一条渲染通道（rendition.annotations.highlight）。
   * - 样式走 SENTENCE_STYLE（hex fill + fill-opacity，已验证可用）；
   * - 先移除上一句再添加当前句，保证任意时刻仅一句高亮；
   * - annotations 自带 inject 渲染钩子，翻页/换主题重排后自动重挂到新视图，无需手动安全网。
   */
  function addSentenceHighlight(cfiRange: string) {
    if (!cfiRange) return;
    if (currentSentenceCfi && currentSentenceCfi !== cfiRange) {
      try {
        ctx.rendition?.annotations.remove(currentSentenceCfi, 'highlight');
      } catch {
        /* ignore */
      }
    }
    removeWord();
    currentSentenceCfi = cfiRange;
    try {
      ctx.rendition?.annotations.highlight(
        cfiRange,
        { tts: true, kind: 'sentence' },
        undefined,
        'epub-highlight',
        SENTENCE_STYLE
      );
    } catch (err) {
      console.warn('[TTS] 句子高亮添加失败', err);
    }
    // 缓存 Range 供逐词高亮复用（避免每词重解析 CFI）
    currentSentenceRange = resolveRange(cfiRange);
  }

  /** 逐字高亮：在句子 Range 内取子 Range → 反算 CFI → 叠加琥珀橙块（仅 Web 引擎的 onboundary 触发） */
  function addWordHighlight(parentCfiRange: string, offset: number, len: number) {
    if (!parentCfiRange) return;
    let parentRange = currentSentenceRange;
    if (!parentRange || parentCfiRange !== currentSentenceCfi) {
      parentRange = resolveRange(parentCfiRange);
      if (parentCfiRange === currentSentenceCfi) currentSentenceRange = parentRange;
    }
    if (!parentRange) return;
    const sub = subRangeWithin(parentRange, offset, Math.max(1, len));
    if (!sub) return;
    const contents = findContentsForDoc(sub.startContainer.ownerDocument as Document);
    if (!contents) return;
    let wordCfi: string | null = null;
    try {
      wordCfi = contents.cfiFromRange(sub);
    } catch {
      wordCfi = null;
    }
    if (!wordCfi) return;
    removeWord();
    currentWordCfi = wordCfi;
    try {
      ctx.rendition?.annotations.highlight(
        wordCfi,
        { tts: true, kind: 'word' },
        undefined,
        'epub-highlight',
        WORD_STYLE
      );
    } catch (err) {
      console.warn('[TTS] 逐词高亮添加失败', err);
    }
  }

  function getRendition() {
    return ctx.rendition;
  }

  function getContents(): Contents | null {
    const r = ctx.rendition;
    if (!r) return null;
    const list = r.getContents();
    if (!list || list.length === 0) return null;
    if (list.length === 1) return list[0];
    // 分页模式会预载相邻章，getContents 可能含多个视图：
    // 优先取与「当前阅读位置」同 section 的内容，避免取到相邻章而读错章节
    const loc = r.currentLocation() as any;
    const idx = loc?.start?.index;
    if (typeof idx === 'number') {
      const hit = (list as any[]).find((c) => c.sectionIndex === idx);
      if (hit) return hit as Contents;
    }
    return list[0];
  }

  /** 等待一次 rendered 事件（或超时兜底），用于章节切换后安全抽取文本 */
  function displayAndWait(target: string): Promise<void> {
    const r = ctx.rendition;
    if (!r) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        r.off('rendered', onRendered);
        resolve();
      };
      const onRendered = () => finish();
      r.on('rendered', onRendered);
      try {
        const p = r.display(target);
        if (p && typeof (p as Promise<void>).then === 'function') {
          (p as Promise<void>).then(() => setTimeout(finish, 20)).catch(finish);
        }
      } catch {
        /* ignore */
      }
      setTimeout(finish, 900);
    });
  }

  /**
   * 在有序、连续（node[i].end === node[i+1].start）的文本节点数组里，
   * 用二分查找定位全局偏移 pos 所在的文本节点与节点内偏移。
   * 复杂度 O(log n)，替代原先逐节点线性扫描，避免「句数 × 节点数」的爆炸。
   */
  function nodeForOffset(
    nodes: { node: Text; start: number; end: number }[],
    pos: number
  ): { node: Text; off: number } | null {
    if (nodes.length === 0) return null;
    let lo = 0;
    let hi = nodes.length - 1;
    // 找到最大的 idx 使 nodes[idx].start <= pos
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (nodes[mid].start <= pos) lo = mid + 1;
      else hi = mid - 1;
    }
    let idx = hi;
    if (idx < 0) idx = 0;
    const n = nodes[idx];
    if (!n) return null;
    if (pos > n.end) pos = n.end; // 落在边界间隙时夹紧（理论不会发生）
    return { node: n.node, off: Math.max(0, pos - n.start) };
  }

  /** 根据全局字符区间 [start,end) 在章节文档内构造 Range 并生成 CFI range 串 */
  function makeCfiRange(
    contents: Contents,
    nodes: { node: Text; start: number; end: number }[],
    start: number,
    end: number
  ): string | null {
    const s = nodeForOffset(nodes, start);
    const e = nodeForOffset(nodes, end);
    if (!s || !e) return null;
    if (s.node === e.node && s.off >= e.off) return null; // 退化区间
    const doc = (contents.document as Document) || document;
    const range = doc.createRange();
    const sLen = s.node.textContent?.length ?? 0;
    const eLen = e.node.textContent?.length ?? 0;
    range.setStart(s.node, Math.max(0, Math.min(s.off, sLen)));
    range.setEnd(e.node, Math.max(0, Math.min(e.off, eLen)));
    try {
      return contents.cfiFromRange(range);
    } catch {
      return null;
    }
  }

  /** 从某个 Contents 抽取当前章节正文并切句，返回带 CFI 的句子数组 */
  function extractQueueFromContents(contents: Contents): TtsSentence[] {
    const doc = contents.document as Document;
    if (!doc || !doc.body) return [];
    const body = doc.body;

    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const el = (node as Text).parentElement;
        if (!el) return NodeFilter.FILTER_REJECT;
        const tag = el.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'head' || tag === 'title') {
          return NodeFilter.FILTER_REJECT;
        }
        // 跳过导航 / 页眉页脚等非正文区域
        if (el.closest('nav, header, footer')) return NodeFilter.FILTER_REJECT;
        if (!(node.textContent || '').trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    // 仅保存 node 引用与全局偏移，避免对每个文本节点调用 cfiFromNode（OOM 元凶之一）
    const nodes: { node: Text; start: number; end: number }[] = [];
    let full = '';
    let prevParent: Element | null = null;
    let n = walker.nextNode() as Text | null;
    while (n) {
      let t = n.textContent || '';
      let prefix = '';
      const parent = n.parentElement;
      if (prevParent && parent && prevParent !== parent && !/^\s/.test(t)) {
        prefix = ' ';
      }
      nodes.push({
        node: n,
        start: full.length,
        end: full.length + prefix.length + t.length,
      });
      full += prefix + t;
      prevParent = parent;
      n = walker.nextNode() as Text | null;
    }

    if (!full.trim()) return [];

    const segments = splitSentences(full);
    const result: TtsSentence[] = [];
    for (const seg of segments) {
      const cfiRange = makeCfiRange(contents, nodes, seg.start, seg.end);
      if (!cfiRange) continue;
      const start = cfiStartOf(cfiRange);
      result.push({ text: seg.text, cfiRange, cfiStart: start, bp: start });
    }
    return result;
  }

  /** 在父 Range 内取 [offset, offset+len) 的子 Range（用于逐字高亮） */
  function subRangeWithin(parent: Range, offset: number, len: number): Range | null {
    const doc =
      parent.commonAncestorContainer.ownerDocument ||
      (parent.commonAncestorContainer as Document);
    const root = parent.commonAncestorContainer;
    const walker = doc.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return parent.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const range = doc.createRange();
    let pos = 0;
    let startSet = false;
    let endSet = false;
    let n = walker.nextNode();
    while (n) {
      const tlen = n.textContent?.length ?? 0;
      if (!startSet && pos + tlen > offset) {
        range.setStart(n, Math.max(0, offset - pos));
        startSet = true;
      }
      if (startSet && pos + tlen >= offset + len) {
        range.setEnd(n, Math.max(0, offset + len - pos));
        endSet = true;
        break;
      }
      pos += tlen;
      n = walker.nextNode();
    }
    if (!startSet) return null;
    if (!endSet) range.setEnd(parent.endContainer, parent.endOffset);
    return range;
  }

  /** 内部：抽取当前章节并把队列切片到断点句（供 buildQueue 复用，避免作为 TtsAdapter 多余字段） */
  function extractAndSlice(bp: string): TtsSentence[] {
    const contents = getContents();
    if (!contents) return [];
    const queue = extractQueueFromContents(contents);
    const idx = queue.findIndex((s) => (s.cfiStart as string) === bp);
    return idx > 0 ? queue.slice(idx) : queue;
  }

  const adapter: TtsAdapter = {
    bookKey: ctx.contentHash || ctx.props.filePath,
    format: 'epub',

    async buildQueue(): Promise<TtsSentence[]> {
      const r = getRendition();
      if (!r) return [];
      // 跨会话断点续读：先定位到断点 CFI，再精确切片到该句（保持「关掉 App 后重开续读」）
      if (pendingRestoreCfi) {
        const bp = pendingRestoreCfi;
        pendingRestoreCfi = '';
        await displayAndWait(bp);
        const q = extractAndSlice(bp);
        if (q.length) return q;
      }
      const contents = getContents();
      if (!contents) return [];
      const loc = r.currentLocation() as any;
      const viewStartCfi = (loc?.start?.cfi as string) || '';
      const viewHref = (loc?.start?.href as string) || '';
      currentHref = viewHref || currentHref;
      const queue = extractQueueFromContents(contents);
      // 从「当前可见阅读位置」开始朗读，而不是章节 / 首页开头：
      // 取当前屏幕顶部 CFI，切片到该位置所在的句子（或刚滚过的那句）
      if (viewStartCfi) {
        const idx = findStartIndexByCfi(queue, viewStartCfi);
        if (idx > 0) return queue.slice(idx);
      }
      return queue;
    },

    onSentenceStart(_index: number, sentence: TtsSentence): void {
      addSentenceHighlight(sentence.cfiRange as string);
    },

    onBoundary(_index: number, sentence: TtsSentence, e: TTSBoundaryEvent): void {
      // 仅 Web 的逐词边界触发逐字高亮；整句边界已由句子级高亮覆盖
      if (e.name !== 'word') return;
      const len = e.charLength ?? Math.max(1, sentence.text.length - e.charIndex);
      addWordHighlight(sentence.cfiRange as string, e.charIndex, len);
    },

    clearHighlight(): void {
      if (currentSentenceCfi) {
        try {
          ctx.rendition?.annotations.remove(currentSentenceCfi, 'highlight');
        } catch {
          /* ignore */
        }
      }
      removeWord();
      currentSentenceCfi = '';
      currentSentenceRange = null;
    },

    async ensureVisible(_index: number, sentence: TtsSentence): Promise<void> {
      const r = getRendition();
      if (!r) return;
      const cfiStart = sentence.cfiStart as string;
      if (!cfiStart) return;
      const loc = r.currentLocation() as any;
      // 极少数情况取不到当前阅读位置（currentLocation 为空）：直接定位到该句，
      // 保证「朗读位置」始终可见，绝不盲读丢失跟随（也不会每句盲目 display 抖动）
      if (!loc || !loc.start || !loc.start.cfi) {
        await displayAndWait(cfiStart);
        return;
      }
      const startCfi = (loc.start.cfi as string) || lastDisplayedStart;
      const endCfi = (loc.end?.cfi as string) || lastDisplayedEnd;
      const visible =
        !!startCfi &&
        !!endCfi &&
        cfiCompare(startCfi, cfiStart) <= 0 &&
        cfiCompare(cfiStart, endCfi) <= 0;
      lastDisplayedStart = startCfi || '';
      lastDisplayedEnd = endCfi || '';
      // 不在当前可见页/视口内：翻页（分页）或滚动（滚动模式）到该句
      if (!visible) {
        await displayAndWait(cfiStart);
      }
    },

    hasNextQueue(): boolean {
      const book = ctx.book as Book | null;
      if (!book || !(book.spine as any)?.spineItems || !currentHref) {
        const loc = ctx.rendition?.currentLocation();
        currentHref = ((loc?.start as any)?.href as string) || currentHref;
        if (!book || !(book.spine as any)?.spineItems || !currentHref) return false;
      }
      const items = (book.spine as any).spineItems as any[];
      const idx = items.findIndex((it) => it.href === currentHref);
      return idx >= 0 && idx < items.length - 1;
    },

    async nextQueue(): Promise<TtsSentence[]> {
      const book = ctx.book as Book | null;
      const items = (book?.spine as any)?.spineItems as any[] | undefined;
      if (!items || !currentHref) return [];
      const idx = items.findIndex((it) => it.href === currentHref);
      if (idx < 0 || idx >= items.length - 1) return [];
      const nextItem = items[idx + 1];
      await displayAndWait(nextItem.href);
      currentHref = nextItem.href;
      const contents = getContents();
      if (!contents) return [];
      return extractQueueFromContents(contents);
    },

    restoreFromBreakpoint(bp: string): number {
      // 记录断点 CFI，buildQueue 中先定位再切片；返回 0（切片在 buildQueue 内完成）
      pendingRestoreCfi = bp;
      return 0;
    },

    dispose(): void {
      this.clearHighlight();
      pendingRestoreCfi = '';
      lastDisplayedStart = '';
      lastDisplayedEnd = '';
      currentSentenceRange = null;
    },
  };

  bookTts.registerAdapter(adapter);

  onUnmounted(() => {
    adapter.clearHighlight();
    bookTts.unregisterAdapter(adapter);
  });

  return adapter;
}
