/**
 * TxtReader 渲染/标注逻辑抽取时共享的上下文契约
 *
 * TxtReader 不使用 epubjs，而是把整章正文作为「单元素连续流」交给浏览器用 CSS 多列
 * 布局分页（paginated）或纵向滚动（scroll）。所有跨「渲染」与「标注」逻辑共享的可变
 * 状态收敛到 ctx 对象，两个 composable 都通过 ctx.* 读写；类型检查会捕获任何遗漏的
 * ctx. 限定。
 *
 * 设计要点（路线一：排版交给浏览器，根治「内容跑到可视区外看不到」）：
 *   - paginated 模式：.txt-flow 设 column-width/column-gap/column-fill:auto，浏览器按整屏
 *     自动断行断页；翻页用 transform: translateX 位移，永不裁切半行。
 *   - scroll 模式：.txt-flow 单列连续，原生纵向滚动。
 *   - 划线锚点用全文字符偏移（start-end），与分页方式解耦；渲染时整章拆段渲染高亮 span。
 */
import { ref, type Ref } from 'vue';

/** 单页分段渲染结构（由 pageSegments 生成，覆盖整章正文） */
export interface Segment {
  /** 该段文本内容 */
  text: string;
  /** 是否为高亮段 */
  isHighlight: boolean;
  /** 高亮段对应的划线记录 id；普通段为 null */
  annotationId: number | null;
  /** 该段在全文中的起始字符偏移量（用于 data-start 属性） */
  globalStart: number;
  /** 高亮颜色标识，如 'yellow'；普通段为空字符串 */
  color: string;
  /** 划线类型：'highlight'、'underline'、'mark'（删除线）、'markStrong'（双下划线）；普通段为空字符串 */
  type: string;
  /** 笔记内容，仅高亮段携带；普通段为空字符串 */
  note: string;
}

/** 划线高亮数据结构（本地维护，start/end 为全文字符偏移） */
export interface TxtAnnotation {
  /** 划线记录自增主键 */
  id: number;
  /** 划线起始字符在全文中的偏移量 */
  start: number;
  /** 划线结束字符在全文中的偏移量（exclusive） */
  end: number;
  /** 选中的原文摘录 */
  text: string;
  /** 笔记内容，可为空字符串 */
  note: string;
  /** 高亮颜色标识，如 'yellow'、'green'、'blue' 等 */
  color: string;
  /** 划线类型：'highlight'（高亮）、'underline'（下划线）、'mark'（删除线）、'markStrong'（双下划线） */
  type: string;
  /** 创建时间（ISO 字符串） */
  createdAt: string;
  /** 更新时间（ISO 字符串） */
  updatedAt: string;
}

/** TxtReader 的 Props 定义（与组件 defineProps 一致） */
export interface TxtReaderProps {
  /** 文件绝对路径 */
  filePath: string;
  /** 当前文件内容身份（原始内容 sha256，多副本共用标注/进度），由父组件透传 */
  contentHash?: string;
  /** 字体大小，单位 px */
  fontSize: number;
  /** 中文正文字体（CSS font-family 值，可为空表示使用默认字体） */
  fontFamily?: string;
  /** 英文正文字体（CSS font-family 值，可为空表示使用默认字体） */
  fontFamilyEn?: string;
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
  /** 正文行距倍率（作用于 .txt-flow line-height） */
  lineHeight?: number;
  /** 分栏数：1 单栏、2 双栏（paginated 模式下每屏显示的列数） */
  columnCount?: number;
  /** 翻页模式：false=翻页（paginated）、true=滚动（scroll） */
  scrollMode?: boolean;
  /** 页边距，单位 px（作用于 .txt-viewport 内边距） */
  margin?: number;
  /** 是否显示底部翻页控制栏 */
  bottomBarVisible?: boolean;
  /** 是否启用阅读区左右边缘点击翻页（上一页/下一页） */
  edgeClickEnabled?: boolean;
  /** 边缘点击翻页感应区宽度百分比（阅读区左右各占该百分比），默认 10 */
  edgeClickPercent?: number;
  /** 是否启用鼠标滚轮翻页（在阅读区滚动滚轮上一页/下一页） */
  wheelPageEnabled?: boolean;
  /** 鼠标滚轮翻页灵敏度（1-10，越大越灵敏），默认 5 */
  wheelPageSensitivity?: number;
}

/** 当前选区临时信息 */
export interface TxtSelection {
  /** 划线起始全局字符偏移 */
  start: number;
  /** 划线结束全局字符偏移（exclusive） */
  end: number;
  /** 选中的原文摘录 */
  text: string;
}

/** 渲染/标注逻辑共享的上下文对象 */
export interface TxtCtx {
  /** 全文内容（已统一换行为 \n） */
  fullContent: Ref<string>;
  /** 当前页码（0 起始，paginated 模式有效；scroll 模式恒为 0） */
  currentPage: Ref<number>;
  /** 当前阅读位置的最近一次已知字符偏移（字符串，供退出/切书前 flush 落库） */
  currentCfi: Ref<string>;
  /** 总页数（paginated 模式由布局测量得到；scroll 模式恒为 1） */
  totalPages: Ref<number>;
  /** 滑块绑定值（1 起始，对应 currentPage + 1） */
  sliderValue: Ref<number>;
  /** 加载状态 */
  loading: Ref<boolean>;
  /** TXT 阅读器根容器（供 ResizeObserver 监听尺寸变化） */
  txtContainer: Ref<HTMLElement | null>;
  /** 阅读区视口（裁切容器：paginated 时 overflow hidden，scroll 时 overflow auto） */
  viewportRef: Ref<HTMLElement | null>;
  /** 正文连续流容器（CSS 多列分页 / 单列滚动，翻页用 translateX 位移） */
  flowRef: Ref<HTMLElement | null>;
  /** 每列步进宽度 = 列宽 + 列间距（px），由布局测量得到 */
  colStep: Ref<number>;
  /** 每屏列数（= props.columnCount，paginated 模式有效） */
  cols: Ref<number>;
  /** 阅读区内可用宽度（px，= 视口 clientWidth - 2×页边距），由 JS 实测，避免解析 calc() 失真 */
  viewportWidth: Ref<number>;
  /** 阅读区内可用高度（px，= 视口 clientHeight - 2×页边距），用具体 px 给 .txt-flow 高度，规避 height:100% 解析不稳 */
  viewportHeight: Ref<number>;
  /** 本地维护的划线列表（与数据库同步） */
  annotations: Ref<TxtAnnotation[]>;
  /** 浮动工具条是否显示 */
  toolbarVisible: Ref<boolean>;
  /** 浮动工具条定位 x 坐标（相对视口，px） */
  toolbarX: Ref<number>;
  /** 浮动工具条定位 y 坐标（相对视口，px） */
  toolbarY: Ref<number>;
  /** 临时存储当前选区信息（mouseup 后存入，工具条按钮点击时消费） */
  currentSelection: Ref<TxtSelection | null>;
  /** 笔记编辑弹窗显示状态 */
  noteDialogVisible: Ref<boolean>;
  /** 当前正在编辑的标注记录 id */
  currentEditAnnotationId: Ref<number | null>;
  /** 笔记编辑弹窗中的输入内容 */
  noteInput: Ref<string>;
  /** 已有划线操作菜单显示状态（点击划线后弹出，提供「转为笔记」「删除」） */
  menuVisible: Ref<boolean>;
  /** 操作菜单定位 x 坐标（相对视口，px） */
  menuX: Ref<number>;
  /** 操作菜单定位 y 坐标（相对视口，px） */
  menuY: Ref<number>;
  /** 操作菜单当前标注是否带笔记（决定首项是「转为笔记」还是「编辑笔记」） */
  menuHasNote: Ref<boolean>;
  /** 操作菜单当前操作的标注 id */
  menuAnnotationId: Ref<number | null>;
  /** 鼠标滚轮翻页累加器 */
  wheelAccum: number;
  /** 滚轮空闲计时器 */
  wheelIdleTimer: ReturnType<typeof setTimeout> | null;
  /** 重载防抖定时器 */
  reloadTimer: ReturnType<typeof setTimeout> | null;
  /** ResizeObserver 实例 */
  resizeObserver: ResizeObserver | null;
  /** 是否已完成首次渲染（跳过初始挂载时的尺寸检测） */
  initialRenderDone: boolean;
  /** 加载标注回调（render 在 loadContent 完成后转发给 highlight 的 loadAnnotations） */
  loadAnnotations?: (filePath: string) => Promise<void>;
  /** 组件 emit 函数 */
  emit: (event: any, ...args: any[]) => void;
  /** 组件 props */
  props: TxtReaderProps;
  /** 阅读设置 store 的 settings ref（划线颜色/类型、翻页效果等） */
  settings: Ref<any>;
  /** 当前文件内容身份（原始内容 sha256，多副本共用标注/进度），由 props 透传 */
  contentHash: string;
}

/**
 * 创建 TxtCtx 初始实例（所有可变状态以 ref 初始化）
 */
export function createTxtCtx(
  props: TxtReaderProps,
  emit: (event: any, ...args: any[]) => void,
  settings: Ref<any>,
  txtContainer: Ref<HTMLElement | null>,
  viewportRef: Ref<HTMLElement | null>,
  flowRef: Ref<HTMLElement | null>
): TxtCtx {
  return {
    fullContent: ref(''),
    currentPage: ref(0),
    currentCfi: ref(''),
    totalPages: ref(1),
    sliderValue: ref(1),
    loading: ref(false),
    txtContainer,
    viewportRef,
    flowRef,
    colStep: ref(0),
    cols: ref(1),
    viewportWidth: ref(0),
    viewportHeight: ref(0),
    annotations: ref<TxtAnnotation[]>([]),
    toolbarVisible: ref(false),
    toolbarX: ref(0),
    toolbarY: ref(0),
    currentSelection: ref<TxtSelection | null>(null),
    noteDialogVisible: ref(false),
    currentEditAnnotationId: ref<number | null>(null),
    noteInput: ref(''),
    menuVisible: ref(false),
    menuX: ref(0),
    menuY: ref(0),
    menuHasNote: ref(false),
    menuAnnotationId: ref<number | null>(null),
    wheelAccum: 0,
    wheelIdleTimer: null,
    reloadTimer: null,
    resizeObserver: null,
    initialRenderDone: false,
    emit,
    props,
    contentHash: props.contentHash || '',
    settings,
  };
}
