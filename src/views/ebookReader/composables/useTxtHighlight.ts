/**
 * TxtReader 标注 / 划线 / 笔记 composable
 *
 * 与 useTxtRender 共享同一个 ctx（见 txtContext.ts）。本 composable 负责：
 *   - 选中文本后的浮动工具条（划线 / 笔记）交互
 *   - 划线/高亮的增删改（数据库同步、本地列表维护、pageSegments 自动响应式渲染）
 *   - 笔记编辑弹窗、按 id 移除/编辑标注
 *   - 加载并恢复已保存标注
 * 渲染/分页/翻页/进度逻辑见 useTxtRender。
 */
import { ElMessage, ElMessageBox } from 'element-plus';
import type { TxtCtx, TxtAnnotation } from './txtContext';

export function useTxtHighlight(ctx: TxtCtx) {
  /**
   * 加载指定文件的划线列表（解析 "start-end" 锚点为全文字符偏移）。
   */
  async function loadAnnotations(filePath: string) {
    try {
      const res = await window.ipcRenderer.ebook.getAnnotations(filePath, ctx.contentHash || '');
      if (res?.success && Array.isArray(res.data)) {
        ctx.annotations.value = (res.data as AnnotationRecord[]).map((r): TxtAnnotation => {
          const parts = (r.anchor || '').split('-');
          const start = parseInt(parts[0], 10) || 0;
          const end = parseInt(parts[1], 10) || 0;
          return {
            id: r.id,
            start,
            end,
            text: r.text || '',
            note: r.note || '',
            color: r.color || 'yellow',
            type: r.type || 'highlight',
            createdAt: r.created_at || '',
            updatedAt: r.updated_at || '',
          };
        });
        ctx.emit('annotations-updated', ctx.annotations.value);
      }
    } catch (err) {
      console.error('加载划线失败', err);
    }
  }

  /**
   * 新增划线高亮：持久化到数据库后 push 到本地 annotations 触发响应式重渲染。
   */
  async function addHighlight(
    start: number,
    end: number,
    text: string,
    note: string = '',
    color: string = 'yellow',
    type: string = 'highlight'
  ): Promise<number | null> {
    try {
      const anchor = `${start}-${end}`;
      const res = await window.ipcRenderer.ebook.addAnnotation({
        filePath: ctx.props.filePath,
        format: 'txt',
        anchor,
        text,
        note,
        color,
        type,
        contentHash: ctx.contentHash || '',
      });
      if (!res?.success || typeof res.id !== 'number') {
        ElMessage.error('添加划线失败');
        return null;
      }
      const now = new Date().toISOString();
      ctx.annotations.value.push({
        id: res.id,
        start,
        end,
        text,
        note,
        color,
        type,
        createdAt: now,
        updatedAt: now,
      });
      ctx.emit('annotations-updated', ctx.annotations.value);
      return res.id;
    } catch (err: any) {
      ElMessage.error(`添加划线失败：${err?.message || String(err)}`);
      return null;
    }
  }

  /**
   * 根据 Range 的 container 与 offset 计算全局字符偏移。
   * 采用「从 .txt-flow 起点构造 Range 到目标点、取 toString().length」的方式，
   * 与渲染所用的全文字符偏移空间天然一致，且不依赖 data-start 命中，
   * 在 CSS 多列分页 / 单列滚动 / 跨分段边界等所有布局下都正确。
   * 修复旧实现：当 endContainer 为元素节点（选区触及分段边界/正文结尾）时，
   * closest('[data-start]') 会返回 -1 或漏算段内偏移，导致 onMouseUp 判定 start>=end 而隐藏工具条，
   * 表现为「TXT 划线点了没反应 / 失效」。
   */
  function getGlobalOffset(container: Node, offset: number): number {
    const flow = ctx.flowRef.value;
    if (!flow) return -1;
    try {
      const range = document.createRange();
      range.setStart(flow, 0);
      range.setEnd(container, offset);
      return range.toString().length;
    } catch {
      return -1;
    }
  }

  /**
   * 鼠标抬起事件处理：计算选区全局偏移并定位浮动工具条。
   */
  function onMouseUp(_e: MouseEvent) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      ctx.toolbarVisible.value = false;
      return;
    }
    const text = selection.toString();
    if (!text) {
      ctx.toolbarVisible.value = false;
      return;
    }
    const range = selection.getRangeAt(0);
    const start = getGlobalOffset(range.startContainer, range.startOffset);
    const end = getGlobalOffset(range.endContainer, range.endOffset);
    if (start < 0 || end < 0 || start >= end) {
      ctx.toolbarVisible.value = false;
      return;
    }
    ctx.currentSelection.value = { start, end, text };
    // 工具条定位到选区「结束端」（用户松手处），比整体并集矩形中心更直观且必在可视区；
    // 折叠 Range 在部分浏览器无矩形时退回选区整体矩形兜底。
    const endRange = document.createRange();
    let rx = 0;
    let ry = 0;
    try {
      endRange.setStart(range.endContainer, range.endOffset);
      endRange.collapse(true);
      const endRect = endRange.getBoundingClientRect();
      if (endRect.width || endRect.height) {
        rx = endRect.left + endRect.width / 2;
        ry = endRect.bottom;
      } else {
        const r = range.getBoundingClientRect();
        rx = r.left + r.width / 2;
        ry = r.bottom;
      }
    } catch {
      const r = range.getBoundingClientRect();
      rx = r.left + r.width / 2;
      ry = r.bottom;
    }
    ctx.toolbarX.value = rx;
    ctx.toolbarY.value = ry;
    ctx.toolbarVisible.value = true;
  }

  /** 工具条「划线」按钮：对当前选区执行纯划线（无笔记） */
  async function onToolbarHighlight(): Promise<void> {
    if (!ctx.currentSelection.value) return;
    const { start, end, text } = ctx.currentSelection.value;
    const type = ctx.settings.value.highlightType;
    const color = (ctx.settings.value.annotationStyles[type]?.color) || 'yellow';
    await addHighlight(start, end, text, '', color, type);
    ctx.toolbarVisible.value = false;
    window.getSelection()?.removeAllRanges();
    ctx.currentSelection.value = null;
  }

  /** 工具条「笔记」按钮：先保存纯划线，再弹窗输入笔记内容 */
  async function onToolbarNote(): Promise<void> {
    if (!ctx.currentSelection.value) return;
    const { start, end, text } = ctx.currentSelection.value;
    const type = ctx.settings.value.highlightType;
    const color = (ctx.settings.value.annotationStyles[type]?.color) || 'yellow';
    const id = await addHighlight(start, end, text, '', color, type);
    if (id !== null) {
      try {
        const { value } = await ElMessageBox.prompt('请输入笔记', '添加笔记', {
          confirmButtonText: '保存',
          cancelButtonText: '取消',
          inputType: 'textarea',
          appendTo: (document.fullscreenElement as HTMLElement | null) || document.body,
        });
        const note = (value || '').trim();
        if (note) {
          const upd = await window.ipcRenderer.ebook.updateAnnotation({ id, note, color, type });
          if (upd?.success) {
            const ann = ctx.annotations.value.find((a) => a.id === id);
            if (ann) ann.note = note;
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
      const res = await window.ipcRenderer.ebook.updateAnnotation({ id: ann.id, note });
      if (res?.success) {
        ann.note = note;
        ann.updatedAt = new Date().toISOString();
        ctx.emit('annotations-updated', ctx.annotations.value);
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

  /** 按 id 删除本地划线：确认 → IPC 删除 → 同步本地列表 */
  async function deleteAnnotationById(annotationId: number): Promise<void> {
    try {
      await ElMessageBox.confirm('确认删除该划线？', '提示', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        appendTo: (document.fullscreenElement as HTMLElement | null) || document.body,
      });
    } catch {
      return;
    }
    try {
      const res = await window.ipcRenderer.ebook.removeAnnotation(annotationId);
      if (res?.success) {
        ctx.annotations.value = ctx.annotations.value.filter((a) => a.id !== annotationId);
        ctx.emit('annotations-updated', ctx.annotations.value);
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
   * 点击已有高亮段：弹出操作菜单（转为笔记 / 删除），不再直接删除。
   */
  async function onHighlightClick(e: MouseEvent, annotationId: number | null, noteFromSeg?: string) {
    if (annotationId === null) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;

    const ann = ctx.annotations.value.find((a) => a.id === annotationId);
    if (!ann) return;
    const hasNote = !!(ann.note || noteFromSeg);

    // 定位：TXT 无 iframe，点击事件的 clientX/Y 即父视口坐标，直接取为精确点击点
    const x = e.clientX || ctx.toolbarX.value;
    const y = e.clientY || ctx.toolbarY.value;
    openAnnotationMenu(annotationId, x, y, hasNote);
  }

  /** 打开已有标注的操作菜单（提供「转为笔记」「删除」） */
  function openAnnotationMenu(id: number, x: number, y: number, hasNote: boolean): void {
    ctx.menuAnnotationId.value = id;
    ctx.menuHasNote.value = hasNote;
    ctx.menuX.value = x;
    ctx.menuY.value = y;
    ctx.menuVisible.value = true;
  }

  /** 菜单「转为笔记/编辑笔记」：关闭菜单并打开笔记编辑弹窗 */
  function onMenuConvert(): void {
    const id = ctx.menuAnnotationId.value;
    if (id === null) return;
    ctx.menuVisible.value = false;
    editAnnotationNote(id);
  }

  /** 菜单「删除」：关闭菜单并走删除确认流程（复用 deleteAnnotationById） */
  function onMenuDelete(): void {
    const id = ctx.menuAnnotationId.value;
    if (id === null) return;
    ctx.menuVisible.value = false;
    void deleteAnnotationById(id);
  }

  /** 按 id 移除本地划线（不调 IPC，持久化由父组件负责） */
  function removeAnnotationById(id: number): void {
    ctx.annotations.value = ctx.annotations.value.filter((a) => a.id !== id);
    ctx.emit('annotations-updated', ctx.annotations.value);
  }

  // 暴露给 render composable / 模板的回调与公开方法
  ctx.loadAnnotations = loadAnnotations;

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
    menuVisible: ctx.menuVisible,
    menuX: ctx.menuX,
    menuY: ctx.menuY,
    menuHasNote: ctx.menuHasNote,
    onMenuConvert,
    onMenuDelete,
  };
}
