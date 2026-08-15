/**
 * PdfReader 标注 / 划线 / 笔记 composable
 *
 * 与 usePdfRender 共享同一个 ctx（见 pdfContext.ts）。本 composable 负责：
 *   - 选中文本后的浮动工具条（划线 / 笔记）交互
 *   - 划线/高亮的增删改（数据库同步、本地列表维护、调用 render 的 renderHighlights 重绘 overlay）
 *   - 笔记编辑弹窗、按 id 移除/编辑标注
 *   - 加载并恢复已保存标注
 *
 * 与 TXT 的区别在于锚点格式：
 *   - TXT 用 "start-end" 全文字符偏移；
 *   - PDF 用 "page:rects"：页码 + 矩形数组。
 *     新划线以 pdf.js 官方 viewport 坐标体系存储：矩形为「PDF 坐标空间的两个角点 [x1,y1,x2,y2]」
 *     （y 轴向上），由选区顶点相对 canvas 左上角换算得到；重绘时用当前 viewport.convertToViewportPoint
 *     还原为 css 像素，缩放/布局变化下与页面文字像素级对齐。旧版归一化矩形（0~1）仍兼容。
 *
 * 渲染/分页/翻页/进度逻辑见 usePdfRender。
 */
import { ElMessage, ElMessageBox } from 'element-plus';
import type { PdfCtx, PdfAnnotation, PdfSelection } from './pdfContext';

/** 解析数据库 anchor（"page:rects"）为页码与归一化矩形数组 */
function parseAnchor(anchor: string): { page: number; rects: number[][] } {
  let page = 0;
  let rects: number[][] = [];
  try {
    const idx = (anchor || '').indexOf(':');
    if (idx > 0) {
      page = parseInt(anchor.slice(0, idx), 10) || 0;
      const parsed = JSON.parse(anchor.slice(idx + 1));
      if (Array.isArray(parsed)) rects = parsed;
    }
  } catch {
    rects = [];
  }
  return { page, rects };
}

export function usePdfHighlight(ctx: PdfCtx) {
  /**
   * 加载指定文件的划线列表（解析 "page:rects" 锚点为页码 + 归一化矩形数组）。
   */
  async function loadAnnotations(filePath: string) {
    try {
      const res = await window.ipcRenderer.ebook.getAnnotations(filePath);
      if (res?.success && Array.isArray(res.data)) {
        ctx.annotations.value = (res.data as AnnotationRecord[]).map((r): PdfAnnotation => {
          const { page, rects } = parseAnchor(r.anchor || '');
          return {
            id: r.id,
            anchor: r.anchor || '',
            page,
            rects,
            text: r.text || '',
            note: r.note || '',
            color: r.color || 'yellow',
            type: r.type || 'highlight',
            createdAt: r.created_at || '',
            updatedAt: r.updated_at || '',
          };
        });
        ctx.emit('annotations-updated', ctx.annotations.value);
        // 已渲染的页立即重绘划线层
        for (const n of ctx.renderedPages) ctx.renderHighlights?.(n);
      }
    } catch (err) {
      console.error('加载划线失败', err);
    }
  }

  /**
   * 新增划线高亮：持久化到数据库后 push 到本地 annotations 并触发响应式重绘。
   */
  async function addHighlight(
    page: number,
    rects: number[][],
    text: string,
    note: string = '',
    color: string = 'yellow',
    type: string = 'highlight'
  ): Promise<number | null> {
    try {
      const anchor = `${page}:${JSON.stringify(rects)}`;
      const res = await window.ipcRenderer.ebook.addAnnotation({
        filePath: ctx.props.filePath,
        format: 'pdf',
        anchor,
        text,
        note,
        color,
        type,
      });
      if (!res?.success || typeof res.id !== 'number') {
        ElMessage.error('添加划线失败');
        return null;
      }
      const now = new Date().toISOString();
      const ann: PdfAnnotation = { id: res.id, anchor, page, rects, text, note, color, type, createdAt: now, updatedAt: now };
      ctx.annotations.value.push(ann);
      ctx.emit('annotations-updated', ctx.annotations.value);
      ctx.renderHighlights?.(page);
      return res.id;
    } catch (err: any) {
      ElMessage.error(`添加划线失败：${err?.message || String(err)}`);
      return null;
    }
  }

  /**
   * 鼠标抬起事件处理：从选区计算「页码 + 归一化矩形数组」并定位浮动工具条。
   * PDF 文本层由 pdf.js 生成，选区落在 .pdf-text-layer 内的 span 上；
   * 通过选区起点元素向上找到 .pdf-page 得到页码，再按页面元素矩形把每个 client rect 归一化。
   */
  function onMouseUp(_e: MouseEvent) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      ctx.toolbarVisible.value = false;
      return;
    }
    const text = selection.toString();
    if (!text.trim()) {
      ctx.toolbarVisible.value = false;
      return;
    }
    const range = selection.getRangeAt(0);
    const startNode = range.startContainer;
    const startEl =
      startNode.nodeType === Node.ELEMENT_NODE
        ? (startNode as Element)
        : startNode.parentElement;
    const pageEl = startEl?.closest('.pdf-page') as HTMLElement | null;
    if (!pageEl) {
      ctx.toolbarVisible.value = false;
      return;
    }
    const page = Number(pageEl.getAttribute('data-page'));
    // 用 canvas 元素与其当前 viewport 做坐标换算（比 .pdf-page 更精确，消除子像素错位）
    const canvas = ctx.canvasRefs.get(page);
    const viewport = ctx.pageViewports.get(page);
    if (!page || !canvas || !viewport) {
      ctx.toolbarVisible.value = false;
      return;
    }
    const canvasRect = canvas.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) {
      ctx.toolbarVisible.value = false;
      return;
    }
    const clientRects = range.getClientRects();
    const rects: number[][] = [];
    for (let i = 0; i < clientRects.length; i++) {
      const rc = clientRects[i];
      // 选区矩形顶点相对 canvas 左上角的 css 像素坐标（viewport 坐标系：原点左上、y 向下）
      const vx1 = rc.left - canvasRect.left;
      const vy1 = rc.top - canvasRect.top;
      const vx2 = rc.right - canvasRect.left;
      const vy2 = rc.bottom - canvasRect.top;
      // 换算到 PDF 坐标空间（y 轴向上），存储为两个角点 [x1,y1,x2,y2]。
      // 重绘时用当前 viewport.convertToViewportPoint 还原，缩放/布局变化下仍像素级对齐。
      const [px1, py1] = viewport.convertToPdfPoint(vx1, vy1);
      const [px2, py2] = viewport.convertToPdfPoint(vx2, vy2);
      rects.push([px1, py1, px2, py2]);
    }
    if (!rects.length) {
      ctx.toolbarVisible.value = false;
      return;
    }
    const sel: PdfSelection = { page, rects, text };
    ctx.currentSelection.value = sel;
    // 工具条定位到选区「结束端」（用户松手处），比整体并集矩形中心更直观且必在可视区
    const endRect = clientRects[clientRects.length - 1];
    ctx.toolbarX.value = endRect.left + endRect.width / 2;
    ctx.toolbarY.value = endRect.bottom;
    ctx.toolbarVisible.value = true;
  }

  /** 工具条「划线」按钮：对当前选区执行纯划线（无笔记） */
  async function onToolbarHighlight(): Promise<void> {
    if (!ctx.currentSelection.value) return;
    const { page, rects, text } = ctx.currentSelection.value;
    const type = ctx.settings.value.highlightType;
    const color = (ctx.settings.value.annotationStyles[type]?.color) || 'yellow';
    await addHighlight(page, rects, text, '', color, type);
    ctx.toolbarVisible.value = false;
    window.getSelection()?.removeAllRanges();
    ctx.currentSelection.value = null;
  }

  /** 工具条「笔记」按钮：先保存纯划线，再弹窗输入笔记内容 */
  async function onToolbarNote(): Promise<void> {
    if (!ctx.currentSelection.value) return;
    const { page, rects, text } = ctx.currentSelection.value;
    const type = ctx.settings.value.highlightType;
    const color = (ctx.settings.value.annotationStyles[type]?.color) || 'yellow';
    const id = await addHighlight(page, rects, text, '', color, type);
    if (id !== null) {
      try {
        const { value } = await ElMessageBox.prompt('请输入笔记', '添加笔记', {
          confirmButtonText: '保存',
          cancelButtonText: '取消',
          inputType: 'textarea',
        });
        const note = (value || '').trim();
        if (note) {
          const upd = await window.ipcRenderer.ebook.updateAnnotation({ id, note, color, type });
          if (upd?.success) {
            const ann = ctx.annotations.value.find((a) => a.id === id);
            if (ann) {
              ann.note = note;
              ann.updatedAt = new Date().toISOString();
              ctx.renderHighlights?.(ann.page);
            }
            ctx.emit('annotations-updated', ctx.annotations.value);
          }
        }
      } catch {
        // 用户取消输入，保留纯划线
      }
    }
    ctx.toolbarVisible.value = false;
    window.getSelection()?.removeAllRanges();
    ctx.currentSelection.value = null;
  }

  /** 打开笔记编辑弹窗 */
  function editAnnotationNote(annotationId: number): void {
    const ann = ctx.annotations.value.find((a) => a.id === annotationId);
    if (!ann) return;
    ctx.currentEditAnnotationId.value = annotationId;
    ctx.noteInput.value = ann.note || '';
    ctx.noteDialogVisible.value = true;
  }

  /** 保存当前弹窗中的笔记内容 */
  async function saveNote(): Promise<void> {
    const id = ctx.currentEditAnnotationId.value;
    if (id === null) return;
    const ann = ctx.annotations.value.find((a) => a.id === id);
    if (!ann) return;

    const note = ctx.noteInput.value.trim();
    try {
      // 回写 color/type，避免 updateAnnotation 默认覆盖为 yellow/highlight
      const res = await window.ipcRenderer.ebook.updateAnnotation({
        id: ann.id,
        note,
        color: ann.color,
        type: ann.type,
      });
      if (res?.success) {
        ann.note = note;
        ann.updatedAt = new Date().toISOString();
        ctx.emit('annotations-updated', ctx.annotations.value);
        ctx.renderHighlights?.(ann.page);
        ElMessage.success('笔记已保存');
        ctx.noteDialogVisible.value = false;
      } else {
        ElMessage.error('笔记保存失败');
      }
    } catch (err: any) {
      ElMessage.error(`笔记保存失败：${err?.message || String(err)}`);
    }
  }

  /** 删除当前正在编辑的标注（笔记弹窗底部「删除划线」按钮） */
  async function deleteCurrentAnnotation(): Promise<void> {
    const id = ctx.currentEditAnnotationId.value;
    if (id === null) return;
    await deleteAnnotationById(id);
    ctx.noteDialogVisible.value = false;
  }

  /** 按 id 删除本地划线：确认 → IPC 删除 → 同步本地列表 + 重绘 */
  async function deleteAnnotationById(annotationId: number): Promise<void> {
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
      const ann = ctx.annotations.value.find((a) => a.id === annotationId);
      const page = ann?.page;
      const res = await window.ipcRenderer.ebook.removeAnnotation(annotationId);
      if (res?.success) {
        ctx.annotations.value = ctx.annotations.value.filter((a) => a.id !== annotationId);
        ctx.emit('annotations-updated', ctx.annotations.value);
        if (page) ctx.renderHighlights?.(page);
        ElMessage.success('已删除划线');
      } else {
        ElMessage.error('删除划线失败');
      }
    } catch (err: any) {
      ElMessage.error(`删除划线失败：${err?.message || String(err)}`);
    }
  }

  /** 笔记编辑弹窗关闭后的清理工作 */
  function onNoteDialogClosed(): void {
    ctx.currentEditAnnotationId.value = null;
    ctx.noteInput.value = '';
  }

  /**
   * 点击已有高亮块：带笔记则进编辑弹窗，纯划线则直接删除。
   */
  async function onHighlightClick(annotationId: number): Promise<void> {
    if (!annotationId) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return; // 正在选区时不误触

    const ann = ctx.annotations.value.find((a) => a.id === annotationId);
    if (!ann) return;
    const hasNote = !!ann.note;

    if (hasNote) {
      editAnnotationNote(ann.id);
    } else {
      await deleteAnnotationById(ann.id);
    }
  }

  /** 按 id 移除本地划线（不调 IPC，持久化由父组件负责） */
  function removeAnnotationById(id: number): void {
    const ann = ctx.annotations.value.find((a) => a.id === id);
    const page = ann?.page;
    ctx.annotations.value = ctx.annotations.value.filter((a) => a.id !== id);
    ctx.emit('annotations-updated', ctx.annotations.value);
    if (page) ctx.renderHighlights?.(page);
  }

  // 暴露给 render composable / 模板的回调与公开方法
  ctx.loadAnnotations = loadAnnotations;
  ctx.onHighlightClick = onHighlightClick;

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
    onHighlightClick,
    onMouseUp,
    removeAnnotationById,
    editAnnotationNote,
  };
}
