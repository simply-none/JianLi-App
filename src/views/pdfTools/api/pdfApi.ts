/**
 * PDF 工具箱渲染端 IPC 封装
 * 所有调用经 preload 暴露的 window.ipcRenderer.pdf.* 桥接，渲染端不直接 import electron。
 */
import type {
  SplitConfig,
  PdfActionResult,
  CropMargins,
  DecorateOpts,
  WatermarkOpts,
  CoverOpts,
  RedactOpts,
  PageLabelRange,
} from '../types';

// 经 preload 桥接；用 any 适配 window 上未显式声明的 pdf 命名空间
const pdfBridge = (window as any).ipcRenderer.pdf as {
  pickFiles(): Promise<{ success: boolean; canceled?: boolean; files?: string[]; error?: string }>;
  pickDir(): Promise<{ success: boolean; canceled?: boolean; dir?: string }>;
  pickImage(): Promise<{ success: boolean; canceled?: boolean; path?: string }>;
  pickSave(defaultName: string): Promise<{ success: boolean; canceled?: boolean; filePath?: string }>;
  merge(files: string[], outputPath: string): Promise<PdfActionResult>;
  organize(file: string, outputPath: string, pageMap: { index: number; rotation?: number }[]): Promise<PdfActionResult>;
  split(file: string, outputDir: string, baseName: string, mode: SplitConfig): Promise<PdfActionResult>;
  writeFiles(dir: string, files: { name: string; base64: string }[]): Promise<PdfActionResult>;
  // 二期
  insert(file: string, outputPath: string, insertFile: string, atIndex: number, insertIndices?: number[]): Promise<PdfActionResult>;
  replace(file: string, outputPath: string, replaceFile: string, targetStart: number, replaceIndices?: number[]): Promise<PdfActionResult>;
  duplicate(file: string, outputPath: string, indices: number[]): Promise<PdfActionResult>;
  crop(file: string, outputPath: string, margins: CropMargins): Promise<PdfActionResult>;
  decorate(file: string, outputPath: string, opts: DecorateOpts): Promise<PdfActionResult>;
  watermark(file: string, outputPath: string, opts: WatermarkOpts): Promise<PdfActionResult>;
  addCover(file: string, outputPath: string, opts: CoverOpts): Promise<PdfActionResult>;
  resize(file: string, outputPath: string, size: { w: number; h: number }): Promise<PdfActionResult>;
  flatten(file: string, outputPath: string): Promise<PdfActionResult>;
  // 三期
  compress(file: string, outputPath: string): Promise<PdfActionResult>;
  redact(file: string, outputPath: string, opts: RedactOpts): Promise<PdfActionResult>;
  encrypt(): Promise<PdfActionResult>;
  decrypt(): Promise<PdfActionResult>;
  pageLabels(file: string, outputPath: string, labels: PageLabelRange[]): Promise<PdfActionResult>;
  attach(file: string, outputPath: string, data: string | Uint8Array, fileName: string, mime?: string): Promise<PdfActionResult>;
  /** 读取 PDF 内嵌附件列表（阅读器「附件」面板） */
  getAttachments(file: string): Promise<PdfActionResult>;
  /** 导出（另存）指定嵌入附件到磁盘（index 为列表序号） */
  extractAttachment(file: string, index: number, outputPath: string): Promise<PdfActionResult>;
};

export const pdfApi = {
  /** 选择多个 PDF 文件 */
  pickFiles: () => pdfBridge.pickFiles(),
  /** 选择输出目录 */
  pickDir: () => pdfBridge.pickDir(),
  /** 选择单个图片文件 */
  pickImage: () => pdfBridge.pickImage(),
  /** 保存对话框 */
  pickSave: (defaultName: string) => pdfBridge.pickSave(defaultName),
  /** 合并 */
  merge: (files: string[], outputPath: string) => pdfBridge.merge(files, outputPath),
  /** 组织页面 */
  organize: (file: string, outputPath: string, pageMap: { index: number; rotation?: number }[]) =>
    pdfBridge.organize(file, outputPath, pageMap),
  /** 拆分 */
  split: (file: string, outputDir: string, baseName: string, mode: SplitConfig) =>
    pdfBridge.split(file, outputDir, baseName, mode),
  /** 批量写文件 */
  writeFiles: (dir: string, files: { name: string; base64: string }[]) => pdfBridge.writeFiles(dir, files),
  // ---- 二期 ----
  /** 在指定位置插入另一文件页面 */
  insert: (file: string, outputPath: string, insertFile: string, atIndex: number, insertIndices?: number[]) =>
    pdfBridge.insert(file, outputPath, insertFile, atIndex, insertIndices),
  /** 用另一文件替换某段页面 */
  replace: (file: string, outputPath: string, replaceFile: string, targetStart: number, replaceIndices?: number[]) =>
    pdfBridge.replace(file, outputPath, replaceFile, targetStart, replaceIndices),
  /** 复制选中页 */
  duplicate: (file: string, outputPath: string, indices: number[]) => pdfBridge.duplicate(file, outputPath, indices),
  /** 裁剪白边 */
  crop: (file: string, outputPath: string, margins: CropMargins) => pdfBridge.crop(file, outputPath, margins),
  /** 页码/页眉/页脚 */
  decorate: (file: string, outputPath: string, opts: DecorateOpts) => pdfBridge.decorate(file, outputPath, opts),
  /** 文字水印 */
  watermark: (file: string, outputPath: string, opts: WatermarkOpts) => pdfBridge.watermark(file, outputPath, opts),
  /** 添加封面 */
  addCover: (file: string, outputPath: string, opts: CoverOpts) => pdfBridge.addCover(file, outputPath, opts),
  /** 统一尺寸 */
  resize: (file: string, outputPath: string, size: { w: number; h: number }) => pdfBridge.resize(file, outputPath, size),
  /** 展平标注 */
  flatten: (file: string, outputPath: string) => pdfBridge.flatten(file, outputPath),
  // ---- 三期 ----
  /** 压缩减体 */
  compress: (file: string, outputPath: string) => pdfBridge.compress(file, outputPath),
  /** 密文遮盖 */
  redact: (file: string, outputPath: string, opts: RedactOpts) => pdfBridge.redact(file, outputPath, opts),
  /** 加密（需外部引擎，返回提示） */
  encrypt: () => pdfBridge.encrypt(),
  /** 解密（需外部引擎，返回提示） */
  decrypt: () => pdfBridge.decrypt(),
  /** 页面标签 */
  pageLabels: (file: string, outputPath: string, labels: PageLabelRange[]) => pdfBridge.pageLabels(file, outputPath, labels),
  /** 嵌入附件 */
  attach: (file: string, outputPath: string, data: string | Uint8Array, fileName: string, mime?: string) =>
    pdfBridge.attach(file, outputPath, data, fileName, mime),
  /** 读取内嵌附件列表（供 PDF 阅读器附件面板展示/下载） */
  getAttachments: (file: string) => pdfBridge.getAttachments(file),
  /** 导出（另存）指定嵌入附件到磁盘 */
  extractAttachment: (file: string, index: number, outputPath: string) =>
    pdfBridge.extractAttachment(file, index, outputPath),
};
