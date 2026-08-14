/**
 * 书架功能 composable
 * 抽取原 index.vue 中「书架视图」相关的状态与操作（列表、徽标数量、打开/移除/加入/导出），
 * 让 index.vue 仅保留阅读视图与跨组件编排逻辑。
 *
 * 说明：
 * - openBook 通过 opts.openBook 回调上抛给父组件，由父组件负责 setCurrentFile + 切换视图，
 *   避免 composable 反向依赖 index 的 loadFile。
 * - 笔记/划线抽屉（openShelfAnnotations）仍由父组件处理，因为涉及 annotationSourceFile / annotations / drawer 状态。
 */
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox } from 'element-plus';
import useEbookReader from '@/store/useEbookReader';
import type { BookshelfItem } from '@/store/useEbookReader';
import { getFileName, getFormat, checkFileExists } from '../utils/fileUtils';

export interface UseBookshelfOptions {
  /** 打开书时调用的加载器（由父组件提供，负责写入 store 并切换到阅读视图） */
  openBook: (item: BookshelfItem) => void;
}

export interface ExportResult {
  success: boolean;
  savedPath?: string;
  error?: string;
}

/**
 * 统一处理导出结果：成功提示、取消静默、失败提示错误
 *
 * @param res - 导出 IPC 返回结果
 */
export function handleExportResult(res: ExportResult | undefined): void {
  if (res?.success) {
    ElMessage.success('笔记已导出');
  } else if (res?.error && res.error !== '已取消导出') {
    ElMessage.error(res.error);
  }
}

export function useBookshelf(opts: UseBookshelfOptions) {
  const store = useEbookReader();
  // 书架列表（响应式，与原 index.vue 中 storeToRefs 解构结果一致）
  const { bookshelf } = storeToRefs(store);
  const { addToBookshelf, removeFromBookshelf } = store;

  /** 每本书的笔记/划线数量映射（path -> { noteCount, highlightCount }），用于书架卡片徽标 */
  const annotationCountMap = ref<Record<string, { noteCount: number; highlightCount: number }>>({});

  /**
   * 刷新每本书的笔记/划线数量（供书架卡片徽标显示）
   * 调用主进程批量统计接口，失败时静默（徽标保持原值）
   */
  async function refreshCounts(): Promise<void> {
    const paths = bookshelf.value.map((b) => b.path);
    if (paths.length === 0) {
      annotationCountMap.value = {};
      return;
    }
    try {
      const res = await window.ipcRenderer.ebook.getAnnotationCounts(paths);
      if (res?.success) {
        const map: Record<string, { noteCount: number; highlightCount: number }> = {};
        (res.data || []).forEach((d) => {
          map[d.filePath] = { noteCount: d.noteCount, highlightCount: d.highlightCount };
        });
        annotationCountMap.value = map;
      }
    } catch (err) {
      console.error('刷新笔记数量失败', err);
    }
  }

  /**
   * 点击书架卡片打开对应电子书
   * 流程：先检查文件存在性 → 不存在则提示并询问是否移除 → 存在则上抛给父组件加载
   *
   * @param item - 书架条目信息，包含 path、name、format 等
   */
  async function openBook(item: BookshelfItem): Promise<void> {
    const exists = await checkFileExists(item.path);
    if (!exists) {
      // 文件不存在（可能已被移动或删除），提示并询问是否从书架移除
      try {
        await ElMessageBox.confirm(
          '文件不存在，可能已被移动或删除。是否从书架移除该书？',
          '提示',
          {
            confirmButtonText: '移除',
            cancelButtonText: '取消',
            type: 'warning',
          }
        );
        await removeFromBookshelf(item.path);
        ElMessage.success('已从书架移除');
      } catch {
        // 用户点击取消，不做任何操作
      }
      return;
    }
    // 文件存在，上抛给父组件加载并切换到阅读视图
    opts.openBook(item);
  }

  /**
   * 删除书架书籍前的确认弹窗
   * 用户确认后调用 removeFromBookshelf 并刷新徽标
   *
   * @param item - 书架条目信息
   */
  async function removeBook(item: BookshelfItem): Promise<void> {
    try {
      await ElMessageBox.confirm('确认从书架移除该书？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      });
      await removeFromBookshelf(item.path);
      ElMessage.success('已从书架移除');
      // 同步刷新卡片徽标数量
      refreshCounts();
    } catch {
      // 用户点击取消，不做操作
    }
  }

  /**
   * 书架视图下：打开外部电子书文件并加入书架
   * 停留在书架视图（不切换到阅读视图），支持多选，仅接受 txt / epub，其余格式忽略并提示
   */
  async function addExternal(): Promise<void> {
    // 多选打开文件对话框（multiSelections 由主进程 get-file-list 转发给 getFilePath）
    const result = window.ipcRenderer.sendSync('get-file-list', {
      openFile: true,
      type: ['file'],
      multiSelections: true,
    });
    // 用户取消或返回非数组
    if (!result || !Array.isArray(result) || result.length === 0) return;

    let added = 0;
    let skipped = 0;
    for (const filePath of result) {
      const fileName = getFileName(filePath);
      const format = getFormat(fileName);
      // 仅接受 txt / epub，其它格式跳过并计数
      if (!format) {
        skipped++;
        continue;
      }
      // 已存在的书沿用其原有进度（percent），避免被 0 覆盖
      const existingItem = bookshelf.value.find((b) => b.path === filePath);
      await addToBookshelf({
        path: filePath,
        name: fileName,
        format,
        percent: existingItem ? existingItem.percent : 0,
        lastReadAt: new Date().toISOString(),
        addedAt: new Date().toISOString(),
      });
      added++;
    }

    // 刷新每本书的笔记/划线数量徽标（addToBookshelf 内部已重新 loadBookshelf）
    refreshCounts();

    if (added > 0) {
      ElMessage.success(`已添加 ${added} 本书到书架`);
    }
    if (skipped > 0) {
      ElMessage.warning(`已忽略 ${skipped} 个不支持的文件（当前仅支持 txt、epub）`);
    }
  }

  /**
   * 导出单本书的笔记与划线为 Markdown（弹出保存对话框）
   *
   * @param item - 书架条目
   */
  async function exportBook(item: BookshelfItem): Promise<void> {
    const title = `${item.name.replace(/\.[^.]+$/, '')}笔记与划线`;
    const res = await window.ipcRenderer.ebook.exportAnnotations({
      filePath: item.path,
      title,
    });
    handleExportResult(res);
  }

  /**
   * 导出全部书的笔记与划线为 Markdown（弹出保存对话框）
   */
  async function exportAll(): Promise<void> {
    const res = await window.ipcRenderer.ebook.exportAnnotations({
      title: '全部电子书笔记与划线',
    });
    handleExportResult(res);
  }

  return {
    bookshelf,
    annotationCountMap,
    refreshCounts,
    openBook,
    removeBook,
    addExternal,
    exportBook,
    exportAll,
  };
}
