/**
 * EpubReader 渲染 / 翻页 / 进度 / 主题 composable
 *
 * 与 useEpubHighlight 共享同一个 ctx（见 epubContext.ts）。本 composable 只负责
 * 「把书渲染出来并正确呈现」相关能力：
 *   - 文件读取、创建 Book/Rendition、注册主题、display
 *   - 翻页（上一页/下一页、边缘点击、滚轮、键盘）、翻页动画
 *   - 进度与页码计算、locations 补算
 *   - 主题 / 字号 / 字体 / 行距 / 页边距 / 分栏 / 翻页模式的样式注入
 *   - 容器尺寸变化重载、生命周期与响应 props 的监听
 * 标注/划线逻辑见 useEpubHighlight。
 */
import { computed, watch, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';
import ePub, { Rendition } from 'epubjs';
import { resolveReadingBg, resolveReadingText } from '../themePresets';
import useGlobalSetting from '@/store/useGlobalSetting';
import useEbookReader from '@/store/useEbookReader';
import type { EpubCtx } from './epubContext';

/** 阅读主题类型：day 白天、night 夜间、eye 护眼 */
type EbookTheme = 'day' | 'night' | 'eye';

export function useEpubRender(ctx: EpubCtx) {
  /**
   * 提取 EPUB 书籍基本信息（标题/作者/封面）并通过 ctx.emit('book-meta') 回传父组件。
   * epubjs 的 book.loaded.metadata 提供 title/creator； book.loaded.cover 仅 resolve 出
   * 封面资源在压缩包内的路径字符串（如 /cover.jpeg），并非 Blob，不可直接当图片地址。
   * 因此封面须从 book.archive.getBase64(book.cover) 读取原始字节并转 base64 dataURL，
   * 既能正确显示，又能持久化（blob: URL 跨会话会失效，而 dataURL 可稳定存库）。
   * 以「即发即弃」方式调用，不阻塞首屏渲染。
   *
   * @param book - epubjs Book 实例（用 any 绕过 epubjs 不完整的 .d.ts）
   */
  async function renderBookMeta(book: any): Promise<void> {
    try {
      const meta = await book.loaded.metadata;
      let cover = '';
      try {
        await book.loaded.cover; // 确保封面路径已解析并写入 book.cover
        if (book.cover && book.archive) {
          // getBase64 内部会 url.substr(1) 去掉首斜杠查 zip 条目，故入参必须带前导 '/'
          const coverHref = book.cover.charAt(0) === '/' ? book.cover : '/' + book.cover;
          const dataUrl = await book.archive.getBase64(coverHref);
          if (dataUrl) cover = dataUrl;
        }
      } catch (err) {
        console.error('提取 EPUB 封面失败', err);
      }
      const title = (meta && (meta.title || meta.bookTitle)) || '';
      const author = (meta && (meta.creator || meta.author)) || '';
      ctx.emit('book-meta', { title, author, cover });
    } catch (err) {
      console.error('提取 EPUB 基本信息失败', err);
    }
  }

  // 按书进度映射（本地存储兜底，进程退出时 IPC 来不及落库也能恢复）
  const ebookStore = useEbookReader();
  /** 主题 class 计算属性 */
  const themeClass = computed(() => `theme-${ctx.props.theme}`);

  /** 页码展示文本，如 "3 / 12" */
  const pageText = computed(
    () => `${ctx.pageInfo.value.current} / ${ctx.pageInfo.value.total}`
  );

  /** 所有 epub 阅读主题名（与 EbookTheme 一致），用于兜底清理 body 上的残留主题 class */
  const EPUB_THEME_NAMES: EbookTheme[] = ['day', 'night', 'eye'];

  /**
   * epub 正文（iframe）内「与背景/文字色无关」的兜底规则，注册到 epubjs 的 `default` 主题。
   * 背景色 / 文字色不放在这里——它们随设置动态变化，由 applyReadingStyle() 用 themes.override() 注入。
   */
  const EPUB_THEME_RULES: Record<string, Record<string, string>> = {
    body: { transition: 'background-color 0.3s ease, color 0.3s ease' },
    'body.night a': { color: '#88aaff !important' },
  };

  /**
   * 注册 epubjs 主题样式（class 限定的兜底规则）。
   * 注册的是 `default` 主题（而非三个独立主题），避免反复切换时规则堆积。
   */
  function registerThemes(rend: Rendition) {
    rend.themes.default(EPUB_THEME_RULES);
  }

  /**
   * 按当前设置把「背景色 / 背景图 / 文字色」注入 epub 正文（iframe body）。
   * 通过 themes.override(..., true) 实现，反复修改不堆积规则，且新章节自动重套用。
   */
  function applyReadingStyle() {
    if (!ctx.rendition) return;
    const bg = resolveReadingBg(
      ctx.props.bgType ?? 'preset',
      ctx.props.bgColor ?? '',
      ctx.props.bgImage ?? '',
      ctx.props.theme
    );
    const text = resolveReadingText(ctx.props.textColor ?? '', ctx.props.theme);
    ctx.rendition.themes.override('background', bg, true);
    ctx.rendition.themes.override('color', text, true);
  }

  /**
   * 兜底同步 iframe body 上的主题 class：只保留当前主题，移除其余主题 class。
   */
  function syncThemeClass(theme: EbookTheme) {
    const frames = ctx.readerRef.value?.querySelectorAll('iframe');
    frames?.forEach((frame) => {
      const body = frame.contentDocument?.body;
      if (!body) return;
      EPUB_THEME_NAMES.forEach((name) => {
        body.classList.toggle(name, name === theme);
      });
    });
  }

  /**
   * 通过 jlocal 协议读取本地 epub 文件为 ArrayBuffer。
   */
  async function loadFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
    const url = 'jlocal:///' + filePath;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`文件读取失败，HTTP 状态码：${response.status}`);
    }
    return await response.arrayBuffer();
  }

  /**
   * 初始化并渲染 epub：加载文件 → 创建 Book → renderTo → 注册主题 → display。
   */
  async function renderEpub(filePath: string) {
    if (!ctx.readerRef.value) return;
    ctx.loading.value = true;

    try {
      const arrayBuffer = await loadFileAsArrayBuffer(filePath);
      const book = ePub(arrayBuffer);
      ctx.book = book;
      // 提取书籍基本信息（标题/作者/封面），即发即弃，不阻塞渲染
      void renderBookMeta(book);
      const rendition = book.renderTo(ctx.readerRef.value, {
        width: '100%',
        height: '100%',
        allowScriptedContent: true,
        flow: ctx.props.scrollMode ? 'scrolled' : 'paginated',
        spread: spreadValue(ctx.props.columnCount ?? 1),
      });
      ctx.rendition = rendition;

      registerThemes(rendition);
      applyTheme(ctx.props.theme);
      applyFontSize(ctx.props.fontSize);
      applyFont();
      applyLineHeight();

      book.loaded.navigation
        .then((nav) => {
          ctx.emit('toc-loaded', nav.toc || []);
          ctx.emit('landmarks-loaded', nav.landmarks || []);
        })
        .catch((err) => {
          console.error('加载目录失败', err);
        });

      book.ready
        .then(() => book.locations.generate(1024))
        .then(() => {
          ctx.locationsReady = true;
          refreshProgressAfterLocations();
        })
        .catch((err) => {
          console.error('生成 locations 失败', err);
        });

      rendition.on('relocated', handleRelocated);
      rendition.on('selected', ctx.onSelected as any);
      rendition.on('mouseup', handleRenditionMouseup);
      rendition.on('rendered', () => syncThemeClass(ctx.props.theme));

      // 在 iframe 内部文档挂载滚轮监听：epub 内容渲染在 iframe 中，其滚轮事件不会冒泡到外层
      (rendition.hooks as any).content.register((contents: any) => {
        const doc = contents?.document as Document | undefined;
        if (doc) {
          doc.addEventListener('wheel', onWheelPageTurn, { passive: false });
          // 滚动模式选区自动滚动兜底：选区拖到 iframe 上下边缘时滚动内容文档
          doc.addEventListener('mousemove', onContentMouseMove, { passive: true });
          // 点击 iframe 内非划线区域时关闭「标注操作菜单」：iframe 内 click 不会冒泡到父文档，
          // 父文档的 document click 监听收不到，故需在此补一条（点中划线本身不关，由 cb 重新定位）
          doc.addEventListener('click', onContentClick);
        }
          // 内容挂载后注入「字间距 / 段间距 / 首行缩进」扩展样式
          applyTypographyExtrasToContent(contents);
          // 内容挂载后注入强制样式：覆盖 epub 内部写死的排版/颜色，跟随阅读设置
          injectForcedStyle(contents);
      });

      const savedCfi = await restoreProgress(filePath);
      if (savedCfi) {
        await rendition.display(savedCfi);
      } else {
        await rendition.display();
      }

      await ctx.loadAnnotations?.(filePath);
      await ctx.loadBookmarks?.(filePath);
      await ctx.setupPageNumbers?.();
    } catch (err: any) {
      ElMessage.error(`加载电子书失败：${err?.message || String(err)}`);
      cleanup();
    } finally {
      ctx.loading.value = false;
    }
  }

  /**
   * 恢复上次阅读进度（从数据库读取 cfi；DB 无记录时回退本地按书映射）。
   */
  async function restoreProgress(filePath: string): Promise<string> {
    try {
      const res = await window.ipcRenderer.ebook.getProgress(filePath, ctx.contentHash || '');
      if (res?.success && res.data?.cfi) {
        return res.data.cfi;
      }
    } catch (err) {
      console.error('恢复阅读进度失败', err);
    }
    // 数据库无记录（退出时 IPC 来不及落库）：回退本地按书进度映射
    const local = ebookStore.getBookProgress(filePath);
    if (local?.cfi) return local.cfi;
    return '';
  }

  /**
   * 触发翻页过渡动画（在 relocated 中、内容切换后调用）。
   */
  function playPageTurn(): void {
    const effect = ctx.settings.value.pageEffect;
    const dir = ctx.turnDirection.value;
    ctx.turnDirection.value = null;
    if (effect === 'none' || !dir || ctx.props.scrollMode || !ctx.readerRef.value) return;

    const el = ctx.readerRef.value;
    const allClasses = [
      'page-turn-slide-forward',
      'page-turn-slide-back',
      'page-turn-cover-forward',
      'page-turn-cover-back',
      'page-turn-flip3d-forward',
      'page-turn-flip3d-back',
    ];
    allClasses.forEach((c) => el.classList.remove(c));
    void el.offsetWidth;
    const cls = `page-turn-${effect}-${dir}`;
    el.classList.add(cls);
    const onEnd = () => {
      el.classList.remove(cls);
      el.removeEventListener('animationend', onEnd);
    };
    el.addEventListener('animationend', onEnd);
  }

  /**
   * relocated 事件回调：位置变化时更新进度。
   */
  function handleRelocated(location: any) {
    const cfi = location?.start?.cfi;
    if (!cfi) return;
    ctx.currentCfi.value = cfi;
    if (typeof location?.start?.href === 'string') {
      ctx.currentHref.value = location.start.href;
      ctx.emit('current-href', location.start.href);
    }
    applyProgress(location);
    updatePageInfo();
    ctx.updatePrintPage?.(cfi);
    ctx.decorateAnnotationMarks?.();
    playPageTurn();
  }

  /**
   * 计算并应用阅读进度（进度文本 + 防抖写库）。
   */
  function applyProgress(location: any) {
    const cfi = location?.start?.cfi;
    if (!cfi) return;

    let percent = 0;
    if (typeof location?.start?.percentage === 'number') {
      percent = Math.round(location.start.percentage * 100);
    } else if (ctx.locationsReady && ctx.book) {
      const p = ctx.book.locations.percentageFromCfi(cfi);
      if (typeof p === 'number') {
        percent = Math.round(p * 100);
      }
    }
    if (percent === 0 && !ctx.locationsReady && ctx.book?.spine) {
      const total =
        typeof (ctx.book.spine as any).length === 'number' ? (ctx.book.spine as any).length : 0;
      const idx = typeof location?.start?.index === 'number' ? location.start.index : -1;
      if (total > 0 && idx >= 0) {
        percent = Math.round(((idx + 1) / total) * 100);
      }
    }
    percent = Math.max(0, Math.min(100, percent));
    ctx.progressText.value = `${percent}%`;

    if (ctx.saveTimer) clearTimeout(ctx.saveTimer);
    ctx.saveTimer = setTimeout(() => {
      ctx.emit('progress-update', { cfi, percent, filePath: ctx.props.filePath });
    }, 500);
  }

  /**
   * locations 生成完成后，用当前 CFI 重新计算精确进度。
   */
  function refreshProgressAfterLocations() {
    const cfi = ctx.currentCfi.value;
    if (!cfi || !ctx.book) return;
    const p = ctx.book.locations.percentageFromCfi(cfi);
    if (typeof p === 'number') {
      const percent = Math.max(0, Math.min(100, Math.round(p * 100)));
      ctx.progressText.value = `${percent}%`;
      ctx.emit('progress-update', { cfi, percent, filePath: ctx.props.filePath });
    }
    updatePageInfo();
  }

  /**
   * 从 located 对象更新页码信息。
   */
  function applyPageInfo(loc: any) {
    const start = loc?.start;
    if (!start || !start.displayed) return;
    const current = typeof start.displayed.page === 'number' ? start.displayed.page : 1;
    const total = typeof start.displayed.total === 'number' ? start.displayed.total : 1;
    if (total > 0) {
      ctx.pageInfo.value = { current, total };
    }
  }

  /**
   * 更新当前页码信息（兼容同步返回与 Promise 两种情形）。
   */
  function updatePageInfo() {
    if (!ctx.rendition) return;
    const loc = ctx.rendition.currentLocation();
    if (loc && typeof (loc as any).then === 'function') {
      (loc as any).then((result: any) => applyPageInfo(result)).catch(() => {});
    } else {
      applyPageInfo(loc);
    }
  }

  /**
   * 容器 mouseup 事件处理：记录视口坐标。
   */
  function onReaderMouseup(e: MouseEvent) {
    ctx.lastMouseX = e.clientX;
    ctx.lastMouseY = e.clientY;
    // 外层选区检测为空时不做处理，真正的隐藏逻辑在 handleRenditionMouseup（iframe 内）中
  }

  /**
   * rendition 转发的 iframe mouseup 事件处理：换算坐标 + 选区为空则隐藏工具条。
   */
  function handleRenditionMouseup(ev: MouseEvent) {
    const iframe = ctx.readerRef.value?.querySelector('iframe');
    const rect = iframe?.getBoundingClientRect();
    if (rect) {
      ctx.lastMouseX = rect.left + ev.clientX;
      ctx.lastMouseY = rect.top + ev.clientY;
    } else {
      ctx.lastMouseX = ev.clientX;
      ctx.lastMouseY = ev.clientY;
    }

    try {
      const iframeWindow = iframe?.contentWindow;
      if (iframeWindow) {
        const selection = iframeWindow.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString()) {
          ctx.toolbarVisible.value = false;
          ctx.currentSelection.value = null;
        }
      }
    } catch (err) {
      console.warn('检测 iframe 选区失败：可能是跨域限制', err);
    }
  }

  /**
   * 应用主题（select 更新内部 _current，并兜底归一化 body 主题 class + 注入动态背景/文字色）。
   */
  function applyTheme(theme: EbookTheme) {
    if (!ctx.rendition) return;
    ctx.rendition.themes.select(theme);
    syncThemeClass(theme);
    applyReadingStyle();
  }

  /** 应用字体大小 */
  function applyFontSize(size: number) {
    if (!ctx.rendition) return;
    ctx.rendition.themes.fontSize(`${size}px`);
  }

  /** 应用正文（中/英文）字体 */
  function applyFont() {
    if (!ctx.rendition) return;
    const cn = ctx.props.fontFamily || '';
    const en = ctx.props.fontFamilyEn || '';
    const list = [cn, en].filter(Boolean);
    if (list.length === 0) {
      (ctx.rendition.themes as any).removeOverride('font-family');
      return;
    }
    list.push('sans-serif');
    ctx.rendition.themes.font(list.join(', '));
  }

  /** 将分栏数映射为 epub.js 的 spread 取值 */
  function spreadValue(count: number): 'none' | 'always' {
    return count >= 2 ? 'always' : 'none';
  }

  /** 应用正文行距 */
  function applyLineHeight() {
    if (!ctx.rendition) return;
    ctx.rendition.themes.override('line-height', `${ctx.props.lineHeight ?? 1.8}`);
  }

  /**
   * 将「字间距 / 段间距 / 首行缩进」注入到单个 iframe 内容（Contents）。
   * 这些属性需要定位到 <p> 等块级元素，无法用 themes.override（仅作用于 body）实现，
   * 因此直接往 iframe 的 <head> 注入一段受控的 <style>（带固定 id，重复设置时先移除旧节点，
   * 避免规则无限累积）；该样式独立于主题系统，不会与 background/color/line-height 冲突。
   *
   * @param contents - epubjs 当前渲染的 Contents 实例
   */
  function applyTypographyExtrasToContent(contents: any) {
    const doc = contents?.document as Document | undefined;
    if (!doc) return;
    const existing = doc.getElementById('ebook-typo-style');
    if (existing) existing.remove();

    const letterSpacing = ctx.props.letterSpacing ?? 0;
    const paragraphSpacing = ctx.props.paragraphSpacing ?? 0;
    const firstLineIndent = ctx.props.firstLineIndent ?? 0;
    if (!letterSpacing && !paragraphSpacing && !firstLineIndent) return;

    const parts: string[] = [];
    if (letterSpacing) {
      parts.push(`body { letter-spacing: ${letterSpacing}px; }`);
    }
    if (paragraphSpacing || firstLineIndent) {
      const decls: string[] = [];
      if (paragraphSpacing) decls.push(`margin-top: ${paragraphSpacing}px`);
      if (firstLineIndent) decls.push(`text-indent: ${firstLineIndent}em`);
      parts.push(`p { ${decls.join('; ')}; }`);
    }
    if (parts.length === 0) return;

    const styleEl = doc.createElement('style');
    styleEl.id = 'ebook-typo-style';
    styleEl.textContent = parts.join('\n');
    doc.head.appendChild(styleEl);
  }

  /** 将排版扩展样式应用到当前全部已渲染内容 */
  function applyTypographyExtras() {
    if (!ctx.rendition) return;
    const contents = (ctx.rendition as any).getContents?.() || [];
    contents.forEach((c: any) => applyTypographyExtrasToContent(c));
  }

  /**
   * 强制覆盖 epub 内部写死的样式，使正文排版（字号/字体/行距/字间距/颜色）与背景强制跟随阅读设置。
   *
   * 背景：epubjs 的 themes.fontSize/font/override 只往 iframe 的 `body` 写规则（且 font-size/font-family
   * 不带 !important），一旦 epub 正文元素自带内联样式（如 `<p style="font-size:20px">`）或自身 CSS 优先级更高，
   * 就会盖过 body 规则，导致用户设置对该部分内容完全失效。
   *
   * 做法：往每个已渲染 iframe 的 <head> 注入一段带 `!important` 的专属样式表：
   *   1) body 写实际设置值；
   *   2) 正文文本元素（p/div/span/li/a/h1~h6 之外的常规文本容器）强制 `inherit !important`，
   *      从而用「继承」抹掉其内部写死的字号/字体/行距/字间距/颜色；
   *   3) 标题（h1~h6）保留 epub 原有的相对比例：首次挂载内容时测量一次 原hX字号/原body字号 的比值，
   *      之后按「设置字号 × 比值」缩放，既跟着设置走又保留层级。
   * 该表带固定 id，重复设置时先移除旧节点，避免规则无限累积。
   */
  const EPUB_FORCED_STYLE_ID = 'ebook-forced-style';
  /** 每个 iframe 文档只测量一次原始基准字号与各标题层级比例，缓存避免被已注入的强制字号污染 */
  const forcedRatioCache = new WeakMap<Document, { ratios: Record<string, number> }>();
  /** 强制继承排版属性的正文文本元素（标题另算，不参与继承覆盖） */
  const FORCED_TEXT_TAGS = [
    'p', 'div', 'span', 'li', 'a', 'td', 'th', 'blockquote', 'pre', 'code',
    'em', 'strong', 'b', 'i', 'u', 'small', 'sub', 'sup', 'label',
    'figcaption', 'caption', 'dl', 'dt', 'dd', 'table', 'tr', 'section', 'article',
  ];

  /** 测量并缓存当前文档各标题层级相对 body 的字号比例（仅首次挂载时真正测量） */
  function measureRatios(doc: Document): Record<string, number> {
    const cached = forcedRatioCache.get(doc);
    if (cached) return cached.ratios;
    const base0 = parseFloat(getComputedStyle(doc.body).fontSize) || 16;
    const ratios: Record<string, number> = {};
    for (let lvl = 1; lvl <= 6; lvl++) {
      const el = doc.querySelector(`h${lvl}`);
      if (!el) continue;
      const hs = parseFloat(getComputedStyle(el as Element).fontSize);
      if (hs && base0) ratios[`h${lvl}`] = hs / base0;
    }
    forcedRatioCache.set(doc, { ratios });
    return ratios;
  }

  /** 构建强制样式表的 CSS 文本 */
  function buildForcedCss(ratios: Record<string, number>): string {
    const size = ctx.props.fontSize || 16;
    const cn = ctx.props.fontFamily || '';
    const en = ctx.props.fontFamilyEn || '';
    const fontList = [cn, en].filter(Boolean).concat('sans-serif').join(', ');
    const lh = ctx.props.lineHeight ?? 1.8;
    const ls = ctx.props.letterSpacing ?? 0;
    const bg = resolveReadingBg(
      ctx.props.bgType ?? 'preset',
      ctx.props.bgColor ?? '',
      ctx.props.bgImage ?? '',
      ctx.props.theme
    );
    const text = resolveReadingText(ctx.props.textColor ?? '', ctx.props.theme);

    const parts: string[] = [];
    // 1) body 写实际设置值（背景/文字色也在此强制，确保跟随主题）
    parts.push(
      `body { font-size: ${size}px !important; font-family: ${fontList} !important; ` +
        `line-height: ${lh} !important; letter-spacing: ${ls}px !important; ` +
        `color: ${text} !important; background: ${bg} !important; }`
    );
    // 2) 正文文本元素强制继承，抹掉内部写死的字体/字号/行距/字间距/颜色
    parts.push(
      `${FORCED_TEXT_TAGS.join(',')} { font-size: inherit !important; ` +
        `font-family: inherit !important; line-height: inherit !important; ` +
        `letter-spacing: inherit !important; color: inherit !important; }`
    );
    // 3) 标题：保留 epub 原相对比例（按 原hX/原body 比值缩放），字体/行距/字间距/颜色跟随设置
    Object.entries(ratios).forEach(([tag, r]) => {
      if (!isFinite(r) || r <= 0) return;
      const hsize = (size * r).toFixed(2);
      parts.push(
        `${tag} { font-size: ${hsize}px !important; font-family: inherit !important; ` +
          `line-height: ${lh} !important; letter-spacing: ${ls}px !important; ` +
          `color: inherit !important; }`
      );
    });
    return parts.join('\n');
  }

  /** 向单个 iframe 内容注入（或刷新）强制样式表 */
  function injectForcedStyle(contents: any) {
    const doc = contents?.document as Document | undefined;
    if (!doc || !doc.head) return;
    const ratios = measureRatios(doc);
    const css = buildForcedCss(ratios);
    const old = doc.getElementById(EPUB_FORCED_STYLE_ID);
    if (old) old.remove();
    const styleEl = doc.createElement('style');
    styleEl.id = EPUB_FORCED_STYLE_ID;
    styleEl.textContent = css;
    doc.head.appendChild(styleEl);
  }

  /** 将强制样式表应用到当前全部已渲染内容（设置变更时调用） */
  function applyForcedStyle() {
    if (!ctx.rendition) return;
    const contents = (ctx.rendition as any).getContents?.() || [];
    contents.forEach((c: any) => injectForcedStyle(c));
  }

  /*
   * 页边距不在此处应用：epubjs 在分页布局中对 iframe body 写死 `margin: 0 !important`
   * （epubjs/lib/contents.js columns() 中的 `this.css("margin", "0", true)`），
   * 因此 `themes.override('margin', ...)` 永远被压制、无任何效果；
   * 且在分栏分页下给 body 加 margin 会破坏 epubjs 的分页宽度计算（末栏被裁切）。
   * 正确做法：由模板给 `.epub-viewport` 加容器 padding，渲染容器随之收缩，再重新分页。
   */

  /** 应用翻页模式与分栏（flow / spread） */
  function applyLayout() {
    if (!ctx.rendition) return;
    ctx.rendition.flow(ctx.props.scrollMode ? 'scrolled' : 'paginated');
    ctx.rendition.spread(spreadValue(ctx.props.columnCount ?? 1));
  }

  /** 翻页方向滞留保护：若 relocated 未触发（如已到首/末页边界，next/prev 不移动），
   * 超时清除 turnDirection，避免之后任意跳转（点目录/拖进度）误带上翻页动画造成「眼花缭乱」。 */
  let turnDirectionTimer: ReturnType<typeof setTimeout> | undefined;
  function clearTurnDirectionLater() {
    if (turnDirectionTimer) clearTimeout(turnDirectionTimer);
    turnDirectionTimer = setTimeout(() => {
      ctx.turnDirection.value = null;
    }, 700);
  }

  /** 翻到上一页 */
  function prevPage() {
    if (!ctx.rendition) return;
    ctx.turnDirection.value = 'back';
    ctx.rendition.prev?.();
    clearTurnDirectionLater();
  }

  /** 翻到下一页 */
  function nextPage() {
    if (!ctx.rendition) return;
    ctx.turnDirection.value = 'forward';
    ctx.rendition.next?.();
    clearTurnDirectionLater();
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

  /** 鼠标滚轮翻页：纵向滚轮映射为上一页/下一页，达到阈值才翻一页 */
  function onWheelPageTurn(e: WheelEvent) {
    if (ctx.props.wheelPageEnabled === false) return;
    // 滚动模式（scrolled）下由 epubjs 原生处理内容上下滚动，此处不接管翻页，
    // 否则会阻止默认滚动并改为按页/章节跳转，与内容平滑滚动冲突
    if (ctx.props.scrollMode === true) return;
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

  /**
   * iframe 内容区 click 处理：点击非划线区域时关闭「标注操作菜单」。
   * 点击划线本身（class 含 .epub-highlight）不在此关闭，由 useEpubHighlight 的 cb 重新定位菜单。
   */
  function onContentClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (target && !target.closest('.epub-highlight')) {
      ctx.menuVisible.value = false;
    }
  }

  /**
   * iframe 内容区 mousemove 兜底：滚动模式（scrolled）下，选区拖拽到 iframe 上下边缘时
   * 自动滚动其内容文档，使原生选区能继续延伸到可视区之外。
   * epub.js 在 scrolled 模式下浏览器通常会原生处理选区自动滚动，此处仅做兜底增强：
   * 仅在确有选区且贴边时滚动，且不阻止默认行为，避免与原生滚动互相干扰。
   */
  function onContentMouseMove(e: MouseEvent) {
    if (ctx.props.scrollMode !== true) return;
    const doc = e.currentTarget as Document | null;
    const win = doc?.defaultView as Window | undefined;
    if (!win) return;
    const sel = win.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString()) return;
    const EDGE = 42;
    const h = win.innerHeight;
    const y = e.clientY;
    if (y < EDGE) {
      win.scrollBy(0, -Math.max(2, (EDGE - y) * 0.6));
    } else if (y > h - EDGE) {
      win.scrollBy(0, Math.max(2, (y - (h - EDGE)) * 0.6));
    }
  }

  /** 键盘事件处理：左右键翻页 */
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      prevPage();
    } else if (e.key === 'ArrowRight') {
      nextPage();
    }
  }

  /** 跳转到指定 cfi 或 href（供父组件通过 ref 调用，实现目录跳转） */
  function displayTarget(target: string) {
    if (!ctx.rendition || !target) return;
    // 非顺序翻页：清除翻页方向，避免误触发翻页动画
    if (turnDirectionTimer) clearTimeout(turnDirectionTimer);
    ctx.turnDirection.value = null;
    ctx.rendition.display(target);
  }

  /**
   * 立即把当前阅读进度落库（取消防抖定时器并同步 emit）。
   * 在组件卸载 / 切换文件前的 cleanup 中调用，避免最后一次翻页（500ms 防抖窗口内）的位置丢失，
   * 从而导致下次打开时恢复到更早的位置。
   */
  function flushProgress() {
    // 优先取「此刻真实阅读位置」：滚动模式下 epub.js 的 relocated 事件有 ~30ms 防抖 + RAF 延迟，
    // 若直接退出，ctx.currentCfi 会停留在稍早的位置（缓慢滚动时尤其明显，恢复后偏前一点）。
    // 用 rendition.currentLocation() 实时读取当前滚动位置，得到更精确的落库 CFI。
    let cfi = '';
    try {
      const live: any = ctx.rendition?.currentLocation();
      if (live && typeof live.then !== 'function' && live.start?.cfi) {
        cfi = live.start.cfi;
      }
    } catch {
      cfi = '';
    }
    if (!cfi && ctx.currentCfi.value) cfi = ctx.currentCfi.value;
    if (!cfi) return;

    if (ctx.saveTimer) {
      clearTimeout(ctx.saveTimer);
      ctx.saveTimer = null;
    }
    let percent = 0;
    if (ctx.locationsReady && ctx.book) {
      const p = ctx.book.locations.percentageFromCfi(cfi);
      if (typeof p === 'number') percent = Math.round(p * 100);
    } else {
      const m = /(\d+)%/.exec(ctx.progressText.value);
      if (m) percent = parseInt(m[1], 10);
    }
    ctx.emit('progress-update', { cfi, percent, filePath: ctx.props.filePath });
  }

  /** 清理 epubjs 资源 */
  function cleanup() {
    // 卸载 / 切换文件前，先把尚未落库的进度立即写出，避免丢失最后一次位置
    flushProgress();
    if (ctx.saveTimer) {
      clearTimeout(ctx.saveTimer);
      ctx.saveTimer = null;
    }
    if (ctx.rendition) {
      try {
        ctx.rendition.destroy();
      } catch (err) {
        console.error('销毁 rendition 失败', err);
      }
      ctx.rendition = null;
    }
    if (ctx.book) {
      try {
        ctx.book.destroy();
      } catch (err) {
        console.error('销毁 book 失败', err);
      }
      ctx.book = null;
    }
    ctx.locationsReady = false;
    ctx.annotations.value = [];
    ctx.toolbarVisible.value = false;
    ctx.currentSelection.value = null;
  }

  /**
   * 阅读区尺寸/布局变化时重新加载电子书（防抖 300ms，保存当前 CFI 并在重建后恢复）。
   */
  function scheduleReload() {
    if (ctx.reloadTimer) clearTimeout(ctx.reloadTimer);
    ctx.reloadTimer = setTimeout(async () => {
      if (!ctx.props.filePath || !ctx.readerRef.value) return;
      const currentCfi = ctx.rendition?.location?.start?.cfi || '';
      if (ctx.rendition) {
        try {
          ctx.rendition.destroy();
        } catch (e) {
          console.error(e);
        }
      }
      if (ctx.book) {
        try {
          ctx.book.destroy();
        } catch (e) {
          console.error(e);
        }
      }
      ctx.rendition = null;
      ctx.book = null;
      ctx.locationsReady = false;
      await renderEpub(ctx.props.filePath);
      if (currentCfi && ctx.rendition) {
        try {
          (ctx.rendition as Rendition).display(currentCfi);
        } catch {
          (ctx.rendition as Rendition).display();
        }
      }
    }, 300);
  }

  // 将 updatePageInfo 暴露给 highlight composable（refreshAnnotations 结束后刷新页码）
  ctx.updatePageInfo = updatePageInfo;

  // ===== 生命周期与监听 =====
  // 进程退出前（关闭窗口）补一次落库：flushProgress 会同步写入本地按书进度映射，
  // 即使 saveProgress 的 IPC 来不及落库，下次打开也能从本地映射恢复真实位置。
  function handleBeforeUnload() {
    flushProgress();
  }
  onMounted(() => {
    if (ctx.props.filePath) {
      renderEpub(ctx.props.filePath).then(() => {
        ctx.initialRenderDone = true;
      });
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeydown);
    ctx.resizeObserver = new ResizeObserver(() => {
      if (!ctx.initialRenderDone) return;
      scheduleReload();
    });
    if (ctx.readerRef.value) ctx.resizeObserver.observe(ctx.readerRef.value);
  });

  const globalSettingStore = useGlobalSetting();
  const { sidebarVisible, topbarVisible } = storeToRefs(globalSettingStore);
  watch([sidebarVisible, topbarVisible], () => {
    if (!ctx.initialRenderDone) return;
    scheduleReload();
  });

  watch(
    () => ctx.props.filePath,
    (newPath) => {
      cleanup();
      ctx.progressText.value = '0%';
      ctx.pageInfo.value = { current: 1, total: 1 };
      if (newPath) {
        renderEpub(newPath);
      }
    }
  );

  watch(
    () => ctx.props.theme,
    (newTheme) => {
      applyTheme(newTheme);
      applyForcedStyle();
    }
  );

  watch(
    () => [ctx.props.bgType, ctx.props.bgColor, ctx.props.bgImage, ctx.props.textColor],
    () => {
      applyReadingStyle();
      applyForcedStyle();
    }
  );

  watch(
    () => ctx.props.fontSize,
    (newSize) => {
      applyFontSize(newSize);
      applyForcedStyle();
      if (ctx.refreshAnnotations) void ctx.refreshAnnotations();
      requestAnimationFrame(() => updatePageInfo());
    }
  );

  watch(
    () => [ctx.props.fontFamily, ctx.props.fontFamilyEn],
    () => {
      applyFont();
      applyForcedStyle();
      if (ctx.refreshAnnotations) void ctx.refreshAnnotations();
      requestAnimationFrame(() => updatePageInfo());
    }
  );

  watch(
    () => ctx.props.lineHeight,
    () => {
      applyLineHeight();
      applyForcedStyle();
      if (ctx.refreshAnnotations) void ctx.refreshAnnotations();
      requestAnimationFrame(() => updatePageInfo());
    }
  );

  // 字间距 / 段间距 / 首行缩进：注入到 iframe 内容的扩展样式，变更时重新应用到全部已渲染内容
  watch(
    () => [ctx.props.letterSpacing, ctx.props.paragraphSpacing, ctx.props.firstLineIndent],
    () => {
      applyTypographyExtras();
      applyForcedStyle();
    }
  );

  // 页边距变化：容器 padding 改变 → 渲染区尺寸变化 → 需按新宽高重新分页。
  // 与 ResizeObserver 共用 scheduleReload 的 300ms 防抖，二者叠加只会触发一次重载；
  // 重载过程中会重新 display(cfi) 并重新加载标注，故无需额外 refreshAnnotations/updatePageInfo。
  watch(
    () => ctx.props.margin,
    () => {
      scheduleReload();
    }
  );

  watch(
    () => ctx.props.columnCount,
    () => {
      applyLayout();
    }
  );

  watch(
    () => ctx.props.scrollMode,
    () => {
      applyLayout();
      requestAnimationFrame(() => updatePageInfo());
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
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    cleanup();
  });

  return {
    themeClass,
    pageText,
    loading: ctx.loading,
    progressText: ctx.progressText,
    onWheelPageTurn,
    onReaderMouseup,
    onEdgePrev,
    onEdgeNext,
    prevPage,
    nextPage,
    displayTarget,
  };
}
