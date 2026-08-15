/// <reference types="vite/client" />
/// <reference types="vite-plugin-jsonx/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// 为了在Electron中使用，我们需要扩展全局的Window对象
interface Window {
  // expose in the `electron/preload/index.ts`
  ipcRenderer: import('electron').IpcRenderer & {
    handlePromise: <T = any>(onName: string, args: ObjectType) => Promise<T>;
    // 剪贴板 API
    clipboard: {
      readText: () => string;
      writeText: (text: string) => void;
    };
    // TTS 语音合成 API
    tts: {
      // 通用接口
      speak: (text: string, options?: any) => Promise<{ success: boolean; error?: string }>;
      stop: () => Promise<{ success: boolean }>;
      getVoices: () => Promise<any>;
      isAvailable: () => Promise<any>;
      // 系统 TTS
      system: {
        speak: (text: string, options?: any) => Promise<{ success: boolean; error?: string }>;
        stop: () => Promise<{ success: boolean }>;
        getVoices: () => Promise<string[]>;
        isAvailable: () => Promise<boolean>;
      };
    };
    // 电子书阅读 API
    ebook: {
      // 读取 txt 文件内容（自动检测编码）
      readTxt: (filePath: string) => Promise<any>;
      // 以 base64 读取任意文件原始字节（PDF 等二进制格式）
      readFileBytes: (filePath: string) => Promise<{ base64?: string; error?: string }>;
      // 计算文件原始内容 sha256（内容身份）
      computeFileHash: (filePath: string) => Promise<{ success: boolean; hash?: string; error?: string }>;
      // 获取电子书阅读进度
      getProgress: (filePath: string, contentHash?: string) => Promise<any>;
      // 保存电子书阅读进度
      saveProgress: (data: { filePath: string; format: string; name?: string; cfi: string; percent: number; contentHash?: string }) => Promise<any>;
      // 获取书架列表（按上次阅读时间倒序）
      getBookshelf: () => Promise<{ success: boolean; data?: BookshelfRecord[]; error?: string }>;
      // 添加或更新书架记录（upsert，保留首次添加时间）
      addToBookshelf: (data: { filePath: string; name: string; format: string; percent: number; contentHash?: string }) => Promise<{ success: boolean; error?: string }>;
      // 按 file_path 删除书架记录
      removeFromBookshelf: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      // 获取全部分类（按创建时间升序），每条含可选颜色 color
      getCategories: () => Promise<{ success: boolean; data?: { id: number; name: string; color?: string }[]; error?: string }>;
      // 新增分类（按名称去重，幂等；color 可选，十六进制色值）
      addCategory: (name: string, color?: string) => Promise<{ success: boolean; id?: number; existed?: boolean; error?: string }>;
      // 修改分类（名称 / 颜色），仅更新传入字段
      updateCategory: (data: { id: number; name?: string; color?: string | null }) => Promise<{ success: boolean; error?: string }>;
      // 删除分类（同时删除其下所有书-分类映射）
      deleteCategory: (id: number) => Promise<{ success: boolean; error?: string }>;
      // 获取书与分类的映射（bookPath 可选：传入返回该书分类 id 数组，不传返回 { [book_path]: number[] }）
      getBookCategories: (bookPath?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      // 替换某本书关联的分类集合
      setBookCategories: (data: { bookPath: string; categoryIds: number[] }) => Promise<{ success: boolean; error?: string }>;
      // 获取指定文件的笔记与划线列表（按创建时间升序）
      getAnnotations: (filePath: string, contentHash?: string) => Promise<{ success: boolean; data?: AnnotationRecord[]; error?: string }>;
      // 新增一条笔记与划线记录（返回新记录自增 id）
      addAnnotation: (data: { filePath: string; format: string; anchor: string; text: string; note?: string | null; color?: string; type?: string; contentHash?: string }) => Promise<{ success: boolean; id?: number; error?: string }>;
      // 按 id 更新笔记内容、高亮颜色与类型
      updateAnnotation: (data: { id: number; note?: string | null; color?: string; type?: string }) => Promise<{ success: boolean; error?: string }>;
      // 按 id 删除笔记与划线记录
      removeAnnotation: (id: number) => Promise<{ success: boolean; error?: string }>;
      // 按 file_path 批量删除笔记与划线记录（scope: 'note' | 'highlight' | 'all'）
      removeAnnotations: (data: { filePath: string; scope: 'note' | 'highlight' | 'all'; contentHash?: string }) => Promise<{ success: boolean; deleted?: number; error?: string }>;
      // 批量统计每本书的笔记、划线与书签数量（key 为 content_hash 或 file_path）
      getAnnotationCounts: (filePaths: string[], contentHashes?: string[]) => Promise<{ success: boolean; data?: { key: string; paths: string[]; noteCount: number; highlightCount: number; bookmarkCount: number }[]; error?: string }>;
      // 导出笔记与划线为 Markdown 文件
      exportAnnotations: (data: { filePath?: string; title?: string; contentHash?: string }) => Promise<{ success: boolean; savedPath?: string; error?: string }>;
      // 获取指定文件的书签列表（按阅读顺序升序）
      getBookmarks: (filePath: string, contentHash?: string) => Promise<{ success: boolean; data?: BookmarkRecord[]; error?: string }>;
      // 新增一条书签（返回新记录自增 id）
      addBookmark: (data: { filePath: string; format: string; cfi: string; label?: string | null; percent?: number; contentHash?: string }) => Promise<{ success: boolean; id?: number; error?: string }>;
      // 按 id 删除书签
      removeBookmark: (id: number) => Promise<{ success: boolean; error?: string }>;
      // 保存书籍基本信息（标题/作者/封面），由渲染进程解析后回传，供书架列表秒出
      saveBookMeta: (data: { filePath: string; name?: string; format?: string; title?: string; author?: string; cover?: string; contentHash?: string }) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

type ShowContentType = { error: boolean }

/**
 * 书架记录结构（对应主进程 ebook_bookshelf 表的行字段，snake_case 与数据库一致）
 */
type BookshelfRecord = {
  /** 文件绝对路径（主键） */
  file_path: string;
  /** 文件名（含扩展名） */
  name: string;
  /** 文件格式：'txt' 或 'epub' */
  format: string;
  /** 阅读百分比 0-100 */
  percent: number;
  /** 上次阅读时间（ISO 字符串） */
  last_read_at: string;
  /** 首次添加时间（ISO 字符串） */
  added_at: string;
  /** 书籍标题（从 EPUB/PDF 元数据解析，无则空串，回退文件名） */
  title: string;
  /** 作者（从 EPUB/PDF 元数据解析，无则空串） */
  author: string;
  /** 封面图 data URL（JPEG/PNG base64，无则空串） */
  cover: string;
  /** 文件原始内容 sha256（内容身份，用于换路径重新导入时复用标注/进度） */
  content_hash: string;
};

/**
 * 笔记与划线记录结构（对应主进程 ebook_annotation 表的行字段，snake_case 与数据库一致）
 */
type AnnotationRecord = {
  /** 自增主键 */
  id: number;
  /** 文件绝对路径 */
  file_path: string;
  /** 文件格式：'txt' 或 'epub' */
  format: string;
  /** 定位锚点（EPUB 用 cfiRange 字符串；TXT 用 "start-end" 字符偏移字符串如 "1520-1545"） */
  anchor: string;
  /** 选中的原文摘录 */
  text: string;
  /** 笔记内容，可空 */
  note: string | null;
  /** 高亮颜色标识，默认 'yellow' */
  color: string;
  /** 划线类型：'highlight'（高亮）、'underline'（下划线）等，默认 'highlight' */
  type: string;
  /** 创建时间（ISO 字符串） */
  created_at: string;
  /** 更新时间（ISO 字符串） */
  updated_at: string;
};

/**
 * 书签记录结构（对应主进程 ebook_bookmark 表的行字段，snake_case 与数据库一致）
 */
type BookmarkRecord = {
  /** 自增主键 */
  id: number;
  /** 文件绝对路径 */
  file_path: string;
  /** 文件格式：'txt' 或 'epub' */
  format: string;
  /** 定位锚点（EPUB 用 cfi 字符串；TXT 用字符偏移字符串如 "1520"） */
  cfi: string;
  /** 书签标题（如当前章节名），可空 */
  label: string | null;
  /** 阅读百分比 0-100，用于排序 */
  percent: number;
  /** 创建时间（ISO 字符串） */
  created_at: string;
};

// 生成JavaScript对象的类型
type ObjectKey = string | number | symbol;
type ObjectType = Record<ObjectKey, any>;
