/**
 * PDF 工具箱类型定义
 */

/** 工具卡片元信息（仪表盘展示） */
export interface PdfToolMeta {
  /** 工具唯一 key */
  key: PdfToolKey;
  /** 标题 */
  title: string;
  /** 描述 */
  desc: string;
  /** Lucide 图标名（须在 LucideIcon nameMap 中注册） */
  icon: string;
  /** 强调色（CSS 变量名或具体色，用于卡片左侧色条） */
  accent: string;
}

/** 支持的工具：一期(merge/split/organize/exportImages) · 二期 · 三期 */
export type PdfToolKey =
  | 'merge'
  | 'split'
  | 'organize'
  | 'exportImages'
  // 二期：页面修饰处理
  | 'insert'
  | 'replace'
  | 'duplicate'
  | 'crop'
  | 'decorate'
  | 'watermark'
  | 'cover'
  | 'resize'
  | 'detectBlank'
  | 'flatten'
  // 三期：文档级
  | 'compress'
  | 'redact'
  | 'security'
  | 'pageLabels'
  | 'attach'
  | 'compare';

/** 已选中的源文件信息 */
export interface PdfFileItem {
  /** 绝对路径 */
  path: string;
  /** 文件名 */
  name: string;
  /** 页数（已知时） */
  pages?: number;
}

/** 拆分模式（与主进程 SplitMode 对应） */
export type SplitConfig =
  | { type: 'range'; ranges: Array<[number, number]> }
  | { type: 'everyN'; n: number }
  | { type: 'oddEven' };

/** 组织页面中单页状态（基于源文件页码，可旋转/标记删除） */
export interface OrganizePageState {
  /** 源文件 0 基页码 */
  srcIndex: number;
  /** 旋转角度 0/90/180/270 */
  rotation: number;
  /** 是否在最终输出中（false=删除） */
  kept: boolean;
}

/** 操作结果反馈 */
export interface PdfActionResult {
  success: boolean;
  canceled?: boolean;
  error?: string;
  outputPath?: string;
  pages?: number;
  files?: string[];
  count?: number;
  /** 附件列表（getAttachments 返回） */
  attachments?: PdfAttachmentItem[];
}

/** PDF 内嵌附件条目（供阅读器「附件」面板展示与下载） */
export interface PdfAttachmentItem {
  /** 附件文件名（如 说明.txt） */
  name: string;
  /** MIME 类型（取自嵌入文件流 /Subtype，可能为空串） */
  mime: string;
  /** 原始字节数（解码后） */
  size: number;
  /** base64 内容；列表查询不返回字节，仅导出时由主进程直接写盘 */
  data?: string;
}

// ============ 二期/三期工具参数类型 ============

/** 四边裁剪边距（pt） */
export interface CropMargins {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** 页码/页眉/页脚 配置 */
export interface DecorateOpts {
  pageNumbers?: {
    position: 'bottom-center' | 'bottom-right' | 'top-center';
    start: number;
    style: 'arabic' | 'roman' | 'letter';
    prefix?: string;
    suffix?: string;
  };
  header?: { text: string };
  footer?: { text: string; divider?: boolean };
}

/** 水印配置 */
export interface WatermarkOpts {
  text: string;
  /** RGB 0~1 */
  color: [number, number, number];
  angle: number;
  fontSize: number;
}

/** 封面配置 */
export interface CoverOpts {
  title?: string;
  imagePath?: string;
  w?: number;
  h?: number;
}

/** 密文遮盖配置 */
export interface RedactOpts {
  mode: 'whole' | 'rects';
  pages?: number[];
  /** 每个矩形：[左上角x, 左上角y, 宽, 高]（pt，原点左上） */
  rects?: number[][];
}

/** 页面标签样式（映射到 PDF /S） */
export type PageLabelStyle = 'decimal' | 'upperRoman' | 'lowerRoman' | 'upperLetter' | 'lowerLetter';
/** 页面标签区间：start=0基起始页；startNum=该区间起始编号（默认 1） */
export interface PageLabelRange {
  start: number;
  style: PageLabelStyle;
  prefix?: string;
  startNum?: number;
}

/** 空白页检测结果 */
export interface BlankDetectResult {
  /** 检测为空白的 0 基页码集合 */
  blankIndices: number[];
  /** 总页数 */
  total: number;
}
