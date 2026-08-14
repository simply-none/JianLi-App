/**
 * EpubReader 标注 / 划线 / 笔记 composable
 *
 * 与 useEpubRender 共享同一个 ctx（见 epubContext.ts）。本 composable 负责：
 *   - 选中文本后的浮动工具条（划线 / 笔记）交互
 *   - 划线/高亮的增删改（SVG 样式、下划线二次着色、本地列表与数据库同步）
 *   - 笔记编辑弹窗、按 id 移除/编辑标注
 *   - 加载并恢复已保存标注、字体/字号变更后重新定位标注
 * 渲染/翻页/进度逻辑见 useEpubRender。
 */
import { ElMessage, ElMessageBox } from 'element-plus';
import type { Contents } from 'epubjs';
import { HIGHLIGHT_COLOR_MAP } from '../highlightConfig';
import type { EpubCtx } from './epubContext';

export function useEpubHighlight(ctx: EpubCtx) {
  /** 根据颜色名称获取 CSS 颜色值 */
  function getColorValue(colorName: string): string {
    return HIGHLIGHT_COLOR_MAP[colorName] || HIGHLIGHT_COLOR_MAP.yellow;
  }

  /**
   * 将颜色名解析为 epub.js SVG 高亮所需的 fill / stroke 颜色与透明度。
   */
  function parseColor(colorName: string): { fill: string; opacity: string } {
    const rgba = getColorValue(colorName);
    const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!m) {
      return { fill: '#FFEB3B', opacity: '0.4' };
    }
    const [, r, g, b, a] = m;
    const fill =
      '#' +
      [r, g, b].map((x) => Number(x).toString(16).padStart(2, '0')).join('').toUpperCase();
    return { fill, opacity: a ?? '1' };
  }

  /** 将 UI 划线类型映射为 epub.js 支持的标注类型（删除线/双下划线在 epub 里都走 underline 覆盖层，再做 SVG 后处理） */
  function uiTypeToEpub(type: string): 'highlight' | 'underline' {
    return type === 'underline' || type === 'mark' || type === 'markStrong'
      ? 'underline'
      : 'highlight';
  }

  /**
   * 根据 UI 划线类型返回 epub.js 标注的 className。
   * mark / markStrong 在 epub-highlight 基础上追加专属 class，便于（切章后）重新定位并装饰 SVG。
   */
  function getAnnotationClassName(type: string): string {
    if (type === 'mark') return 'epub-highlight epub-strike';
    if (type === 'markStrong') return 'epub-highlight epub-double';
    return 'epub-highlight';
  }

  /**
   * 根据类型与颜色生成 epub.js annotations 所需的 SVG 属性对象。
   *
   * 关键：epub.js 的 Underline.render() 会为每个文本框画一个 <rect fill="none">（仅用于定位），
   * 再画一条 <line> 作为真正的下划线。若把 stroke 直接写在 <g> 上，<rect> 会继承 stroke 而渲染出
   * 一圈「边框」（即用户反馈的异常效果）。因此下划线类型改为把颜色写入 <g> 的 inline style 的
   * CSS 变量（--hl-stroke / --hl-stroke-opacity），由 EpubReader.vue 的全局 CSS 针对 <line> 着色、
   * 针对 <rect> 强制 stroke:none——既能着色又不会产生边框，且能抵御 epub.js 在翻页/缩放时重建 SVG
   * 节点导致的内联属性丢失（这正是旧版 MutationObserver 二次着色 hack 的脆弱点）。
   */
  function getTypeStyles(type: string, colorName: string): Record<string, string> {
    const { fill, opacity } = parseColor(colorName);
    switch (type) {
      case 'underline':
      case 'mark':
      case 'markStrong':
        // 不在此处写 stroke：避免 <rect> 继承后产生边框。颜色通过 inline style 的 CSS 变量传递。
        // mark / markStrong 借用 underline 覆盖层（底部单线）作为基底，再由 decorateMark 做 SVG 后处理。
        return {
          style: `--hl-stroke:${fill};--hl-stroke-opacity:${opacity};mix-blend-mode:multiply`,
        };
      case 'highlight':
      default:
        return {
          fill,
          'fill-opacity': opacity,
          'mix-blend-mode': 'multiply',
        };
    }
  }

  /**
   * 对 epub.js 生成的标注 SVG 组（<g>）做后处理，把 underline 覆盖层改造成删除线 / 双下划线。
   *
   * epub.js 的 Underline 对【每行换行片段】各画一个 <rect>（定位框）+ 一条底部 <line>。
   * - 删除线(mark)：把每条 <line> 的 y 移到行高正中（保留原线，仅改坐标；颜色仍由 CSS 变量 --hl-stroke 着色）。
   * - 双下划线(markStrong)：在底部 <line> 下方用「同文档」再插一条 <line>。
   * 幂等：已装饰过的组会带 data-decorated 标记，重复调用直接跳过，避免双下划线被重复叠加。
   *
   * @param mark - epub.js Annotation 实例的 .mark（即 <g> SVG 组），可能为 undefined（标注尚未挂到当前视图）
   * @param type - UI 划线类型
   */
  function decorateMark(mark: any, type: string): void {
    if (!mark || !mark.element) return;
    const g = mark.element as SVGGElement;
    if (g.getAttribute('data-decorated') === type) return;
    const rects = Array.from(g.querySelectorAll('rect')) as SVGRectElement[];
    const lines = Array.from(g.querySelectorAll('line')) as SVGLineElement[];
    const SVG_NS = 'http://www.w3.org/2000/svg';
    rects.forEach((rect, i) => {
      const x = parseFloat(rect.getAttribute('x') || '0');
      const y = parseFloat(rect.getAttribute('y') || '0');
      const h = parseFloat(rect.getAttribute('height') || '0');
      const w = parseFloat(rect.getAttribute('width') || '0');
      const line = lines[i];
      if (type === 'mark') {
        const midY = y + h / 2;
        if (line) {
          line.setAttribute('y1', String(midY));
          line.setAttribute('y2', String(midY));
        }
      } else if (type === 'markStrong') {
        const bottom = y + h; // 现有 underline 位于 bottom-1
        const extra = g.ownerDocument.createElementNS(SVG_NS, 'line');
        extra.setAttribute('x1', String(x));
        extra.setAttribute('x2', String(x + w));
        extra.setAttribute('y1', String(bottom + 3));
        extra.setAttribute('y2', String(bottom + 3));
        // 颜色 / 线宽 / 线帽由 EpubReader.vue 的 g.epub-highlight > line 全局 CSS 统一着色
        g.appendChild(extra);
      }
    });
    g.setAttribute('data-decorated', type);
  }

  /**
   * 遍历当前所有标注，对 mark / markStrong 类型重新执行 SVG 装饰。
   * 用于在「切章后 epub.js 才把离屏标注挂到新视图」的场景下补装饰（handleRelocated 中调用）。
   */
  function decorateAllMarks(): void {
    if (!ctx.rendition) return;
    const store = (ctx.rendition.annotations as any)?._annotations;
    if (!store) return;
    for (const ann of ctx.annotations.value) {
      if (ann.type !== 'mark' && ann.type !== 'markStrong') continue;
      const hash = encodeURI(ann.anchor + 'underline');
      const annotation = store[hash];
      if (annotation && annotation.mark) {
        decorateMark(annotation.mark, ann.type);
      }
    }
  }

  /**
   * rendition selected 事件回调：用户选中文本后触发，显示浮动工具条。
   */
  function handleSelected(cfiRange: string, contents: Contents) {
    if (!ctx.rendition) return;
    let text = '';
    try {
      const range = ctx.rendition.getRange(cfiRange);
      text = range?.toString() ?? '';
    } catch (err) {
      console.error('rendition.getRange 失败', err);
    }
    if (!text && contents?.window) {
      try {
        text = contents.window.getSelection()?.toString() ?? '';
      } catch (err) {
        console.error('获取 iframe 选区文本失败', err);
      }
    }
    if (!text) {
      ctx.toolbarVisible.value = false;
      return;
    }
    ctx.currentSelection.value = { cfiRange, text };
    ctx.toolbarX.value = ctx.lastMouseX;
    ctx.toolbarY.value = ctx.lastMouseY;
    ctx.toolbarVisible.value = true;
  }

  /**
   * 划线核心流程：保存到数据库 → 添加高亮 → 更新本地列表 → 通知父组件。
   */
  async function addHighlight(
    cfiRange: string,
    text: string,
    note = '',
    color = 'yellow',
    type = 'highlight'
  ): Promise<void> {
    if (!ctx.rendition) return;
    try {
      const res = await window.ipcRenderer.ebook.addAnnotation({
        filePath: ctx.props.filePath,
        format: 'epub',
        anchor: cfiRange,
        text,
        note,
        color,
        type,
      });
      if (!res?.success || typeof res.id !== 'number') {
        ElMessage.error(`添加划线失败：${res?.error || '未知错误'}`);
        return;
      }
      const id = res.id;
      const styles = getTypeStyles(type, color);
      const epubType = uiTypeToEpub(type);
      const className = getAnnotationClassName(type);
      const data = { id, note, cfiRange, color, type };
      const cb = () => onHighlightClick(id, cfiRange, note);
      if (epubType === 'underline') {
        const ann = ctx.rendition.annotations.underline(cfiRange, data, cb, className, styles);
        decorateMark((ann as any)?.mark, type);
      } else {
        ctx.rendition.annotations.highlight(cfiRange, data, cb, className, styles);
      }
      ctx.annotations.value.push({ id, anchor: cfiRange, text, note, color, type });
      ctx.emit('annotations-updated', ctx.annotations.value);
    } catch (err) {
      console.error('添加划线异常', err);
      ElMessage.error('添加划线失败');
    }
  }

  /** 点击「划线」按钮：对当前选区执行纯划线流程（note 为空），关闭工具条 */
  async function onToolbarHighlight(): Promise<void> {
    const sel = ctx.currentSelection.value;
    if (!sel) return;
    const color = ctx.settings.value.highlightColor;
    const type = ctx.settings.value.highlightType;
    ctx.currentSelection.value = null;
    ctx.toolbarVisible.value = false;
    await addHighlight(sel.cfiRange, sel.text, '', color, type);
  }

  /** 点击「笔记」按钮：先划线保存，再弹输入框录入笔记 */
  async function onToolbarNote(): Promise<void> {
    const sel = ctx.currentSelection.value;
    if (!sel) return;
    const color = ctx.settings.value.highlightColor;
    const type = ctx.settings.value.highlightType;
    ctx.currentSelection.value = null;
    ctx.toolbarVisible.value = false;
    await addHighlight(sel.cfiRange, sel.text, '', color, type);
    const created = ctx.annotations.value[ctx.annotations.value.length - 1];
    if (!created) return;
    try {
      const { value } = await ElMessageBox.prompt('请输入笔记', '添加笔记', {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputType: 'textarea',
      });
      const res = await window.ipcRenderer.ebook.updateAnnotation({
        id: created.id,
        note: value,
        color,
        type,
      });
      if (!res?.success) {
        ElMessage.error(`保存笔记失败：${res?.error || '未知错误'}`);
        return;
      }
      created.note = value;
      ctx.emit('annotations-updated', ctx.annotations.value);
    } catch {
      // 用户取消，保留为纯划线
    }
  }

  /** 点击已有高亮的回调：带笔记则进编辑弹窗，纯划线则直接删除 */
  function onHighlightClick(id: number, cfiRange: string, noteFromCb?: string): void {
    const annotation = ctx.annotations.value.find((a) => a.id === id);
    if (!annotation) return;
    const hasNote = !!(annotation.note || noteFromCb);
    if (hasNote) {
      editAnnotationNote(id);
    } else {
      void removeHighlight(id, cfiRange);
    }
  }

  /** 删除划线：确认 → IPC 删除 → 移除 rendition 高亮 → 更新本地列表 → 通知父组件 */
  async function removeHighlight(id: number, cfiRange: string): Promise<void> {
    try {
      await ElMessageBox.confirm('确认删除该划线？', '提示', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      });
    } catch {
      return;
    }
    try {
      const res = await window.ipcRenderer.ebook.removeAnnotation(id);
      if (!res?.success) {
        ElMessage.error(`删除划线失败：${res?.error || '未知错误'}`);
        return;
      }
      if (ctx.rendition) {
        const ann = ctx.annotations.value.find((a) => a.id === id);
        const epubType = uiTypeToEpub(ann?.type || 'highlight');
        ctx.rendition.annotations.remove(cfiRange, epubType);
      }
      const idx = ctx.annotations.value.findIndex((a) => a.id === id);
      if (idx !== -1) {
        ctx.annotations.value.splice(idx, 1);
      }
      ctx.emit('annotations-updated', ctx.annotations.value);
    } catch (err) {
      console.error('删除划线异常', err);
      ElMessage.error('删除划线失败');
    }
  }

  /** 打开笔记编辑弹窗 */
  function editAnnotationNote(id: number): void {
    const annotation = ctx.annotations.value.find((a) => a.id === id);
    if (!annotation) return;
    ctx.currentEditAnnotationId.value = id;
    ctx.noteInput.value = annotation.note || '';
    ctx.noteDialogVisible.value = true;
  }

  /** 保存当前弹窗中的笔记内容 */
  async function saveNote(): Promise<void> {
    const id = ctx.currentEditAnnotationId.value;
    if (id === null) return;
    const annotation = ctx.annotations.value.find((a) => a.id === id);
    if (!annotation) return;

    try {
      const res = await window.ipcRenderer.ebook.updateAnnotation({
        id,
        note: ctx.noteInput.value,
        color: annotation.color || 'yellow',
        type: annotation.type || 'highlight',
      });
      if (!res?.success) {
        ElMessage.error(`保存笔记失败：${res?.error || '未知错误'}`);
        return;
      }
      annotation.note = ctx.noteInput.value;
      ctx.emit('annotations-updated', ctx.annotations.value);
      ElMessage.success('笔记已保存');
      ctx.noteDialogVisible.value = false;
    } catch (err) {
      console.error('保存笔记异常', err);
      ElMessage.error('保存笔记失败');
    }
  }

  /** 删除当前正在编辑的标注（笔记弹窗底部「删除划线」按钮） */
  async function deleteCurrentAnnotation(): Promise<void> {
    const id = ctx.currentEditAnnotationId.value;
    if (id === null) return;
    const annotation = ctx.annotations.value.find((a) => a.id === id);
    if (!annotation) return;
    await removeHighlight(id, annotation.anchor);
    ctx.noteDialogVisible.value = false;
  }

  /** 笔记编辑弹窗关闭后的清理工作 */
  function onNoteDialogClosed(): void {
    ctx.currentEditAnnotationId.value = null;
    ctx.noteInput.value = '';
  }

  /** 加载并恢复已保存的划线高亮 */
  async function loadAnnotations(filePath: string): Promise<void> {
    if (!ctx.rendition) return;
    try {
      const res = await window.ipcRenderer.ebook.getAnnotations(filePath);
      if (!res?.success || !Array.isArray(res.data)) {
        return;
      }
      ctx.annotations.value = [];
      for (const record of res.data) {
        const id = record.id;
        const cfiRange = record.anchor;
        const note = record.note ?? '';
        const color = record.color || 'yellow';
        const type = record.type || 'highlight';
        try {
          const styles = getTypeStyles(type, color);
          const epubType = uiTypeToEpub(type);
          const className = getAnnotationClassName(type);
          const data = { id, note, cfiRange, color, type };
          const cb = () => onHighlightClick(id, cfiRange, note);
          if (epubType === 'underline') {
            const ann = ctx.rendition.annotations.underline(cfiRange, data, cb, className, styles);
            decorateMark((ann as any)?.mark, type);
          } else {
            ctx.rendition.annotations.highlight(cfiRange, data, cb, className, styles);
          }
          ctx.annotations.value.push({
            id,
            anchor: cfiRange,
            text: record.text,
            note,
            color,
            type,
          });
        } catch (err) {
          console.error('恢复单条划线失败', record, err);
        }
      }
      ctx.emit('annotations-updated', ctx.annotations.value);
    } catch (err) {
      console.error('加载划线列表失败', err);
    }
  }

  /** 跳转到指定划线位置（供父组件通过 ref 调用） */
  function jumpToAnnotation(anchor: string): void {
    if (!ctx.rendition || !anchor) return;
    ctx.rendition.display(anchor);
  }

  /**
   * 字体大小 / 字体切换后重新定位标注（移除旧 SVG → 等重排 → 按 cfiRange 重新添加）。
   */
  async function refreshAnnotations(): Promise<void> {
    if (!ctx.rendition) return;
    const list = ctx.annotations.value.slice();
    if (list.length === 0) return;
    if (ctx.isRefreshing) {
      ctx.pendingRefresh = true;
      return;
    }
    ctx.isRefreshing = true;
    try {
      for (const ann of list) {
        const epubType = uiTypeToEpub(ann.type);
        try {
          ctx.rendition.annotations.remove(ann.anchor, epubType);
        } catch (err) {
          console.error('移除旧划线失败', ann.anchor, err);
        }
      }
      await new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        } else {
          setTimeout(resolve, 60);
        }
      });
      if (!ctx.rendition) return;
      for (const ann of list) {
        if (!ctx.annotations.value.some((a) => a.id === ann.id)) continue;
        try {
          const styles = getTypeStyles(ann.type, ann.color);
          const epubType = uiTypeToEpub(ann.type);
          const className = getAnnotationClassName(ann.type);
          const data = { id: ann.id, note: ann.note, cfiRange: ann.anchor, color: ann.color, type: ann.type };
          const cb = () => onHighlightClick(ann.id, ann.anchor, ann.note);
          if (epubType === 'underline') {
            const created = ctx.rendition.annotations.underline(ann.anchor, data, cb, className, styles);
            decorateMark((created as any)?.mark, ann.type);
          } else {
            ctx.rendition.annotations.highlight(ann.anchor, data, cb, className, styles);
          }
        } catch (err) {
          console.error('重新添加划线失败', ann, err);
        }
      }
    } finally {
      ctx.isRefreshing = false;
      ctx.updatePageInfo?.();
      if (ctx.pendingRefresh) {
        ctx.pendingRefresh = false;
        void refreshAnnotations();
      }
    }
  }

  /** 按 id 移除本地划线（不调 IPC，持久化由父组件负责） */
  function removeAnnotationById(id: number): void {
    const ann = ctx.annotations.value.find((a) => a.id === id);
    if (!ann) return;
    if (ctx.rendition) {
      try {
        const epubType = uiTypeToEpub(ann.type || 'highlight');
        ctx.rendition.annotations.remove(ann.anchor, epubType);
      } catch (err) {
        console.error('移除 rendition 高亮失败', err);
      }
    }
    ctx.annotations.value = ctx.annotations.value.filter((a) => a.id !== id);
    ctx.emit('annotations-updated', ctx.annotations.value);
  }

  // 暴露给 render composable / 模板的回调与公开方法
  ctx.onSelected = handleSelected;
  ctx.loadAnnotations = loadAnnotations;
  ctx.refreshAnnotations = refreshAnnotations;
  ctx.decorateAnnotationMarks = decorateAllMarks;

  return {
    toolbarVisible: ctx.toolbarVisible,
    toolbarX: ctx.toolbarX,
    toolbarY: ctx.toolbarY,
    onToolbarHighlight,
    onToolbarNote,
    noteDialogVisible: ctx.noteDialogVisible,
    onNoteDialogClosed,
    noteInput: ctx.noteInput,
    deleteCurrentAnnotation,
    saveNote,
    jumpToAnnotation,
    removeAnnotationById,
    editAnnotationNote,
  };
}
