/**
 * EpubReader 渲染/标注逻辑抽取时共享的上下文契约
 *
 * 原 EpubReader.vue 中 rendition / book / annotations 等是模块作用域的可变状态，
 * 拆分到 useEpubRender / useEpubHighlight 两个 composable 后无法再共享模块作用域，
 * 故统一收敛到一个 ctx 对象，两个 composable 都通过 ctx.* 读写共享状态。
 * 类型检查会捕获任何遗漏的 ctx. 限定（未限定即报 "找不到名称"），作为安全网。
 */
import { ref, type Ref } from 'vue';
import type { Book, Rendition, Contents } from 'epubjs';
import type { EpubAnnotation } from '../types';

/** EpubReader 的 Props 定义（与组件 defineProps 一致） */
export interface EpubReaderProps {
  /** 文件绝对路径 */
  filePath: string;
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
  /** 正文行距倍率（作用于 epub body line-height） */
  lineHeight?: number;
  /** 分栏数：1 单栏、2 双栏（通过 rendition.spread 控制） */
  columnCount?: number;
  /** 翻页模式：true=滚动（scrolled），false=翻页（paginated） */
  scrollMode?: boolean;
  /** 页边距，单位 px（作用于 .epub-viewport 容器 padding，而非 iframe body margin） */
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
  /** 字间距，单位 px（0 表示不额外加宽），仅 epub 生效 */
  letterSpacing?: number;
  /** 段间距，单位 px（0 表示使用默认），仅 epub 生效 */
  paragraphSpacing?: number;
  /** 首行缩进，单位 em（0 表示不缩进），仅 epub 生效 */
  firstLineIndent?: number;
  /** 下划线 / 双下划线 与文字之间的间隙，单位 px（0 表示贴着基线），仅 epub 生效 */
  underlineGap?: number;
}

/** 渲染/标注逻辑共享的上下文对象 */
export interface EpubCtx {
  /** epubjs Rendition 实例（可变，render 中创建/销毁） */
  rendition: Rendition | null;
  /** epubjs Book 实例（可变，render 中创建/销毁） */
  book: Book | null;
  /** epub 渲染容器引用（DOM） */
  readerRef: Ref<HTMLElement | null>;
  /** 加载状态 */
  loading: Ref<boolean>;
  /** 当前阅读百分比文本 */
  progressText: Ref<string>;
  /** 当前页码信息：当前章节内页码 / 本章总页数 */
  pageInfo: Ref<{ current: number; total: number }>;
  /** 最后一次 relocated 得到的 CFI */
  currentCfi: Ref<string>;
  /** 当前所在阅读位置的 href（用于书签标题与目录高亮，空串表示未知） */
  currentHref: Ref<string>;
  /** 翻页动画方向 */
  turnDirection: Ref<'forward' | 'back' | null>;
  /** 浮动工具条是否显示 */
  toolbarVisible: Ref<boolean>;
  /** 浮动工具条定位 x 坐标 */
  toolbarX: Ref<number>;
  /** 浮动工具条定位 y 坐标 */
  toolbarY: Ref<number>;
  /** 当前选区临时信息 */
  currentSelection: Ref<{ cfiRange: string; text: string } | null>;
  /** 笔记编辑弹窗显示状态 */
  noteDialogVisible: Ref<boolean>;
  /** 当前正在编辑的标注记录 id */
  currentEditAnnotationId: Ref<number | null>;
  /** 笔记编辑弹窗中的输入内容 */
  noteInput: Ref<string>;
  /** 当前文件的标注列表 */
  annotations: Ref<EpubAnnotation[]>;
  /** 进度持久化防抖定时器句柄 */
  saveTimer: ReturnType<typeof setTimeout> | null;
  /** locations 是否已生成 */
  locationsReady: boolean;
  /** 最近一次 mouseup 的视口 x 坐标 */
  lastMouseX: number;
  /** 最近一次 mouseup 的视口 y 坐标 */
  lastMouseY: number;
  /** 刷新标注重入保护标记 */
  isRefreshing: boolean;
  /** 刷新期间是否再次发生字体 / 字号变更 */
  pendingRefresh: boolean;
  /** 鼠标滚轮翻页累加器 */
  wheelAccum: number;
  /** 滚轮空闲计时器 */
  wheelIdleTimer: ReturnType<typeof setTimeout> | null;
  /** 重载防抖定时器 */
  reloadTimer: ReturnType<typeof setTimeout> | null;
  /** ResizeObserver 实例 */
  resizeObserver: ResizeObserver | null;
  /** 是否已完成首次渲染 */
  initialRenderDone: boolean;
  /** 选区回调（render 注册监听后转发给 highlight 的 handleSelected） */
  onSelected?: (cfiRange: string, contents: Contents) => void;
  /** iframe mouseup 回调（render 注册监听后转发给 highlight 的 handleRenditionMouseup） */
  onRenditionMouseup?: (ev: MouseEvent) => void;
  /** 加载标注回调（render 在 display 完成后转发给 highlight 的 loadAnnotations） */
  loadAnnotations?: (filePath: string) => Promise<void>;
  /** 加载书签回调（render 在 display 完成后转发给 bookmarks 的 loadBookmarks） */
  loadBookmarks?: (filePath: string) => Promise<void>;
  /** 初始化真实页码（pageList）回调（render 在 book 就绪后转发给 pageNumbers 的 setupPageNumbers） */
  setupPageNumbers?: () => Promise<void>;
  /** 更新真实页码显示回调（render 在 relocated 时转发给 pageNumbers 的 updatePrintPage） */
  updatePrintPage?: (cfi: string) => void;
  /** 重新装饰 mark / markStrong 标注的 SVG 回调（render 在 relocated 时转发给 highlight 的 decorateAllMarks，用于切章后补全离屏标注的装饰） */
  decorateAnnotationMarks?: () => void;
  /** 更新页码信息回调（highlight 的 refreshAnnotations 结束后转发给 render 的 updatePageInfo） */
  updatePageInfo?: () => void;
  /** 重新定位标注回调（render 的字体/字号/行距/页边距监听变化后转发给 highlight 的 refreshAnnotations） */
  refreshAnnotations?: () => Promise<void>;
  /** 组件 emit 函数 */
  emit: (event: any, ...args: any[]) => void;
  /** 组件 props */
  props: EpubReaderProps;
  /** 阅读设置 store 的 settings ref（划线颜色/类型、翻页效果等） */
  settings: Ref<any>;
}

/**
 * 创建 EpubCtx 初始实例（所有可变状态以 ref 初始化）
 *
 * @param props - 组件 props
 * @param emit - 组件 emit
 * @param settings - 阅读设置 store 的 settings ref
 * @param readerRef - 渲染容器 ref
 * @returns 初始化完成的 ctx 对象
 */
export function createEpubCtx(
  props: EpubReaderProps,
  emit: (event: any, ...args: any[]) => void,
  settings: Ref<any>,
  readerRef: Ref<HTMLElement | null>
): EpubCtx {
  return {
    rendition: null,
    book: null,
    readerRef,
    loading: ref(false),
    progressText: ref('0%'),
    pageInfo: ref({ current: 1, total: 1 }),
    currentCfi: ref(''),
    currentHref: ref(''),
    turnDirection: ref<'forward' | 'back' | null>(null),
    toolbarVisible: ref(false),
    toolbarX: ref(0),
    toolbarY: ref(0),
    currentSelection: ref(null),
    noteDialogVisible: ref(false),
    currentEditAnnotationId: ref(null),
    noteInput: ref(''),
    annotations: ref<EpubAnnotation[]>([]),
    saveTimer: null,
    locationsReady: false,
    lastMouseX: 0,
    lastMouseY: 0,
    isRefreshing: false,
    pendingRefresh: false,
    wheelAccum: 0,
    wheelIdleTimer: null,
    reloadTimer: null,
    resizeObserver: null,
    initialRenderDone: false,
    emit,
    props,
    settings,
  };
}
