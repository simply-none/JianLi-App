/**
 * PdfReader 渲染/标注逻辑共享的上下文契约
 *
 * 与 TxtReader 的 txtContext 同理，把「渲染（usePdfRender）」与「标注（usePdfHighlight）」
 * 之间需要共享的可变状态收敛到 ctx 对象，二者通过 ctx.* 读写；类型检查会捕获遗漏的 ctx. 限定。
 *
 * 设计要点（PDF 采用 pdf.js Canvas 连续滚动渲染）：
 *   - 每一页渲染为一个 .pdf-page（含 <canvas> + 文本层 + 划线层），整本文档在 .pdf-scroll 容器内纵向连续排列。
 *   - 翻页/滚动两种模式下 DOM 结构一致；区别仅在于导航输入行为（翻页模式用滚轮/边缘点击翻页，滚动模式自由滚动）。
 *   - 划线用「页面索引 + 归一化矩形（相对该页渲染尺寸 0~1）」存储，缩放下仍正确；恢复时按当前页尺寸换算成像素矩形叠加。
 *   - 进度锚点用当前页码（字符串），与页面几何解耦，字号/缩放变化后按页码恢复。
 */
import { ref, type Ref, reactive } from 'vue';

/** 单条 PDF 划线高亮数据结构（本地维护） */
export interface PdfAnnotation {
  /** 自增主键（来自数据库） */
  id: number;
  /** 跳转锚点："page:rects"（rects 为 PDF 空间角点数组的 JSON），用于笔记抽屉点击跳转定位 */
  anchor: string;
  /** 所在页码（1 起始） */
  page: number;
  /** 划线矩形数组。
   *  新格式：PDF 坐标空间的两个角点 [x1, y1, x2, y2]（y 轴向上），重绘时由当前 viewport.convertToViewportPoint 还原为 css 像素，缩放/布局变化下像素级对齐。
   *  旧格式（兼容）：相对该页渲染尺寸的归一化矩形（0~1）。renderHighlights 会按值范围自动识别。 */
  rects: number[][];
  /** 选中的原文摘录 */
  text: string;
  /** 笔记内容，可空 */
  note: string;
  /** 高亮颜色标识，如 'yellow' */
  color: string;
  /** 划线类型：'highlight'（高亮）、'underline'（下划线）等 */
  type: string;
  /** 创建时间（ISO 字符串） */
  createdAt: string;
  /** 更新时间（ISO 字符串）；与创建时间相同表示从未修改过 */
  updatedAt: string;
}

/** 当前选区临时信息 */
export interface PdfSelection {
  /** 选区所在页码（1 起始） */
  page: number;
  /** 归一化矩形数组 */
  rects: number[][];
  /** 选中的原文摘录 */
  text: string;
}

/** 单页渲染尺寸（css px，由 pdf.js viewport 决定，随缩放变化） */
export interface PdfPageSize {
  w: number;
  h: number;
}

/** PdfReader 的 Props 定义（与组件 defineProps 一致） */
export interface PdfReaderProps {
  /** 文件绝对路径 */
  filePath: string;
  /** 当前文件内容身份（原始内容 sha256，多副本共用标注/进度），由父组件透传 */
  contentHash?: string;
  /** 阅读主题：day 白天、night 夜间、eye 护眼 */
  theme: 'day' | 'night' | 'eye';
  /** 阅读区背景类型：preset 跟随主题 / color 纯色 / image 背景图 */
  bgType?: 'preset' | 'color' | 'image';
  /** 阅读区背景色（bgType 为 'color' 时生效） */
  bgColor?: string;
  /** 阅读区背景图 data URL（bgType 为 'image' 时生效） */
  bgImage?: string;
  /** 阅读区文字颜色（空字符串表示跟随主题预设文字色） */
  textColor?: string;
  /** 是否显示底部翻页/导航控制栏 */
  bottomBarVisible?: boolean;
  /** 翻页模式：false=翻页（paginated）、true=滚动（scroll） */
  scrollMode?: boolean;
  /** 是否启用阅读区左右边缘点击翻页 */
  edgeClickEnabled?: boolean;
  /** 边缘点击翻页感应区宽度百分比，默认 10 */
  edgeClickPercent?: number;
  /** 是否启用鼠标滚轮翻页 */
  wheelPageEnabled?: boolean;
  /** 鼠标滚轮翻页灵敏度 1-10，默认 5 */
  wheelPageSensitivity?: number;
  /** 下划线/双下划线 与文字之间的间隙（px），防止划线贴向下一行；默认 2 */
  underlineGap?: number;
  /** 划线（下划线/删除线/双下划线）线宽（px），默认 2 */
  hlLineThickness?: number;
  /** 高亮背景块上下外扩间距（px），避免高亮紧贴上下行；默认 2 */
  hlRowPaddingY?: number;
  /** PDF 适应方式：'width' 适应宽度（页宽撑满阅读区）/ 'height' 适应高度（单页高度≈视口高，一屏一页） */
  pdfFitMode?: 'width' | 'height';
}

/** 渲染/标注逻辑共享的上下文对象 */
export interface PdfCtx {
  /** 当前文件路径 */
  filePath: string;
  /** 当前文件内容身份（原始内容 sha256，多副本共用标注/进度），由 props 透传 */
  contentHash: string;
  /** PDF 文档代理（pdf.js，非响应式，存于闭包外字段） */
  pdfDoc: any;
  /** 总页数 */
  numPages: Ref<number>;
  /** 当前页码（1 起始，随滚动更新） */
  currentPage: Ref<number>;
  /** 总页数（= numPages，供模板展示） */
  totalPages: Ref<number>;
  /** 当前缩放倍数 */
  scale: Ref<number>;
  /** 基础缩放（首次 fit-width 计算值，用于缩放复位） */
  baseScale: Ref<number>;
  /** 加载状态 */
  loading: Ref<boolean>;
  /** 阅读器根容器 */
  containerRef: Ref<HTMLElement | null>;
  /** 滚动容器 */
  scrollRef: Ref<HTMLElement | null>;
  /** 每页元素引用（按页码） */
  pageRefs: Map<number, HTMLElement>;
  /** 每页 canvas 引用 */
  canvasRefs: Map<number, HTMLCanvasElement>;
  /** 每页文本层 div 引用 */
  textRefs: Map<number, HTMLElement>;
  /** 每页划线层 div 引用 */
  hlRefs: Map<number, HTMLElement>;
  /** 每页渲染尺寸（css px），响应式供模板绑定 */
  pageSizes: Record<number, PdfPageSize>;
  /** 首页在「当前缩放」下的尺寸（作为未测量页的占位估计，供懒渲染布局近似） */
  firstPageSize: Ref<PdfPageSize>;
  /** 每页当前 viewport（含缩放/旋转变换），用于划线坐标在 PDF 空间与 css 像素间换算 */
  pageViewports: Map<number, any>;
  /** 已渲染的页码集合（懒渲染，避免一次渲染全部页） */
  renderedPages: Set<number>;
  /** 正在渲染中的页码集合（同步标记，防止同一页被并发调用 render 导致 canvas 占用冲突） */
  renderingPages: Set<number>;
  /** 本地维护的划线列表 */
  annotations: Ref<PdfAnnotation[]>;
  /** 浮动工具条是否显示 */
  toolbarVisible: Ref<boolean>;
  /** 浮动工具条定位 x（视口坐标 px） */
  toolbarX: Ref<number>;
  /** 浮动工具条定位 y（视口坐标 px） */
  toolbarY: Ref<number>;
  /** 临时存储当前选区信息（mouseup 后存入，工具条按钮点击时消费） */
  currentSelection: Ref<PdfSelection | null>;
  /** 笔记编辑弹窗显示状态 */
  noteDialogVisible: Ref<boolean>;
  /** 当前正在编辑的标注记录 id */
  currentEditAnnotationId: Ref<number | null>;
  /** 笔记编辑弹窗输入内容 */
  noteInput: Ref<string>;
  /** 是否已销毁（组件卸载后置 true，取消进行中的渲染） */
  disposed: boolean;
  /** 进行中的每页渲染任务（page 序号 -> RenderTask），用于取消上一次未完成渲染，避免同一 canvas 并发 render */
  renderTasks: Map<number, any>;
  /** 是否已完成首次渲染 */
  initialRenderDone: boolean;
  /** 标注加载回调（render 在 loadDocument 完成后转发给 highlight 的 loadAnnotations） */
  loadAnnotations?: (filePath: string) => Promise<void>;
  /** 在指定页重绘划线层（render 渲染完一页后调用，highlight 增删后也可主动调用） */
  renderHighlights?: (page: number) => void;
  /** 点击划线层中的高亮块（data-id 携带标注 id）时的回调，由 usePdfHighlight 赋值 */
  onHighlightClick?: (id: number) => void;
  /** 跳转到指定页码（缩放/目录/书签/搜索共用，由 usePdfRender 注册） */
  goToPage?: (page: number, smooth?: boolean) => void;
  /** 加载 PDF 目录/outline（由 usePdfOutline 注册，loadDocument 完成后调用） */
  loadOutline?: (filePath: string) => Promise<void>;
  /** 加载 PDF 书签列表（由 usePdfBookmarks 注册，loadDocument 完成后调用） */
  loadBookmarks?: (filePath: string) => Promise<void>;
  /** 组件 emit 函数 */
  emit: (event: any, ...args: any[]) => void;
  /** 组件 props */
  props: PdfReaderProps;
  /** 阅读设置 store 的 settings ref（划线颜色/类型由右上角「阅读设置」预设） */
  settings: Ref<any>;
}

/**
 * 创建 PdfCtx 初始实例
 */
export function createPdfCtx(
  props: PdfReaderProps,
  emit: (event: any, ...args: any[]) => void,
  settings: Ref<any>,
  containerRef: Ref<HTMLElement | null>,
  scrollRef: Ref<HTMLElement | null>
): PdfCtx {
  return {
    filePath: props.filePath,
    contentHash: props.contentHash || '',
    pdfDoc: null,
    numPages: ref(0),
    currentPage: ref(1),
    totalPages: ref(0),
    scale: ref(1),
    baseScale: ref(1),
    loading: ref(false),
    containerRef,
    scrollRef,
    pageRefs: new Map(),
    canvasRefs: new Map(),
    textRefs: new Map(),
    hlRefs: new Map(),
    pageSizes: reactive({}) as Record<number, PdfPageSize>,
    firstPageSize: ref<PdfPageSize>({ w: 0, h: 0 }),
    pageViewports: new Map(),
    renderedPages: new Set(),
    renderingPages: new Set(),
    annotations: ref<PdfAnnotation[]>([]),
    toolbarVisible: ref(false),
    toolbarX: ref(0),
    toolbarY: ref(0),
    currentSelection: ref<PdfSelection | null>(null),
    noteDialogVisible: ref(false),
    currentEditAnnotationId: ref<number | null>(null),
    noteInput: ref(''),
    disposed: false,
    renderTasks: new Map(),
    initialRenderDone: false,
    emit,
    props,
    settings,
  };
}
