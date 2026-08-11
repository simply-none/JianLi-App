<template>
  <div class="epub-reader" :class="themeClass" v-loading="loading" element-loading-text="正在加载电子书...">
    <!-- epub 渲染容器：epubjs 会将内容渲染到此元素；监听 mouseup 记录鼠标坐标，用于浮动工具条定位 -->
    <div ref="readerRef" class="epub-viewer" @mouseup="onReaderMouseup"></div>

    <!-- 选中文本后弹出的浮动工具条：提供「划线」「笔记」两个操作 -->
    <AnnotationToolbar
      :visible="toolbarVisible"
      :x="toolbarX"
      :y="toolbarY"
      @highlight="onToolbarHighlight"
      @note="onToolbarNote"
      @close="toolbarVisible = false"
    />

    <!-- 底部翻页控制区 -->
    <div class="epub-footer">
      <el-button size="small" :disabled="loading" @click="prevPage">
        <LucideIcon name="ArrowLeft" :size="14" />
        上一页
      </el-button>
      <span class="progress-text">{{ progressText }}</span>
      <el-button size="small" :disabled="loading" @click="nextPage">
        下一页
        <LucideIcon name="ArrowRight" :size="14" />
      </el-button>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * EPUB 标注数据结构（本地维护的划线/笔记项）
 * 与主进程 AnnotationRecord 对应，但仅保留前端所需字段（anchor 即 cfiRange）
 * 通过 emit('annotations-updated') 与 defineExpose 暴露给父组件使用
 */
export interface EpubAnnotation {
  /** 标注记录主键 id（来自数据库自增主键） */
  id: number;
  /** 定位锚点（epubjs 的 cfiRange 字符串，可用于 rendition.display 跳转） */
  anchor: string;
  /** 选中的原文摘录 */
  text: string;
  /** 笔记内容，空字符串表示无笔记 */
  note: string;
  /** 高亮颜色标识，如 'yellow'、'green'、'blue' 等 */
  color: string;
  /** 划线类型：'highlight'（高亮）、'underline'（下划线）、'wavy'（波浪线） */
  type: string;
}
</script>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
// 浮动工具条组件：选中文本后弹出，提供「划线」「笔记」两个操作
import AnnotationToolbar from './AnnotationToolbar.vue';
// epubjs 默认导出 ePub 工厂函数，命名导出 Book/Rendition/NavItem/Contents 类型
import ePub, { Book, Rendition, NavItem, Contents } from 'epubjs';

/** 阅读主题类型：day 白天、night 夜间、eye 护眼 */
type EbookTheme = 'day' | 'night' | 'eye';

/** 组件 Props 定义 */
const props = defineProps<{
  /** 文件绝对路径 */
  filePath: string;
  /** 字体大小，单位 px */
  fontSize: number;
  /** 中文正文字体（CSS font-family 值，可为空表示使用默认字体） */
  fontFamily?: string;
  /** 英文正文字体（CSS font-family 值，可为空表示使用默认字体） */
  fontFamilyEn?: string;
  /** 阅读主题：day 白天、night 夜间、eye 护眼 */
  theme: EbookTheme;
}>();

/** 组件 Emits 定义 */
const emit = defineEmits<{
  /** 阅读进度更新事件 */
  (
    e: 'progress-update',
    payload: { cfi: string; percent: number }
  ): void;
  /** 显示目录事件（可选触发） */
  (e: 'show-toc'): void;
  /** 目录加载完成事件 */
  (e: 'toc-loaded', payload: NavItem[]): void;
  /** 标注列表变更事件：新增/编辑/删除划线或笔记后触发，payload 为最新标注列表 */
  (e: 'annotations-updated', payload: EpubAnnotation[]): void;
}>();

/** epub 渲染容器引用 */
const readerRef = ref<HTMLElement | null>(null);
/** 加载状态 */
const loading = ref(false);
/** 当前阅读百分比文本 */
const progressText = ref('0%');
/** 记录最后一次 relocated 得到的 CFI，供 locations 生成完成后补算精确进度 */
const currentCfi = ref('');

/** epubjs Book 实例 */
let book: Book | null = null;
/** epubjs Rendition 实例 */
let rendition: Rendition | null = null;
/** 进度持久化防抖定时器句柄 */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** locations 是否已生成（用于判断百分比是否可用） */
let locationsReady = false;

/** 高亮颜色映射：颜色名称到 CSS 颜色值的映射 */
const COLOR_MAP: Record<string, string> = {
  yellow: 'rgba(255,235,59,0.4)',
  green: 'rgba(129,199,132,0.4)',
  blue: 'rgba(100,181,246,0.4)',
  pink: 'rgba(244,143,177,0.4)',
  orange: 'rgba(255,183,77,0.4)',
  purple: 'rgba(186,160,227,0.4)',
};

/**
 * 根据颜色名称获取 CSS 颜色值
 *
 * @param colorName - 颜色名称
 * @returns CSS 颜色值
 */
function getColorValue(colorName: string): string {
  return COLOR_MAP[colorName] || COLOR_MAP.yellow;
}

/**
 * 将颜色名解析为 epub.js SVG 高亮所需的 fill / stroke 颜色与透明度
 * epub.js 以 SVG <rect> / <line> 叠加渲染高亮，颜色由 fill（高亮）或 stroke（下划线）属性控制，
 * 而非 CSS background-color；且 rgba(...) 中的 alpha 需拆分为 fill-opacity / stroke-opacity，
 * 否则 epub.js 会回退到默认黄色（fill: yellow）。
 *
 * @param colorName - 颜色名称（yellow/green/blue/...）
 * @returns fill 为十六进制颜色字符串，opacity 为透明度字符串
 */
function parseColor(colorName: string): { fill: string; opacity: string } {
  const rgba = getColorValue(colorName); // 形如 rgba(255,235,59,0.4)
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) {
    return { fill: '#FFEB3B', opacity: '0.4' };
  }
  const [, r, g, b, a] = m;
  const fill =
    '#' +
    [r, g, b]
      .map((x) => Number(x).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  return { fill, opacity: a ?? '1' };
}

/**
 * 将 UI 划线类型映射为 epub.js 支持的标注类型
 * epub.js 仅有 highlight / underline / mark 三种；波浪线（wavy）无原生支持，
 * 降级渲染为 underline（数据库中仍保留 'wavy'，供笔记面板与编辑使用）。
 *
 * @param type - UI 划线类型
 * @returns epub.js 标注类型
 */
function uiTypeToEpub(type: string): 'highlight' | 'underline' {
  return type === 'underline' || type === 'wavy' ? 'underline' : 'highlight';
}

/** 下划线 / 波浪线标注的线条着色观察器，按 cfiRange 记录，删除标注时断开 */
const underlineObservers = new Map<string, MutationObserver>();

/**
 * 为 epub.js 的 underline 标注线条设置颜色
 * epub.js 的 Underline.render 将 <line> 的 stroke 写死为 black，无法通过 styles 改色，
 * 因此需在线条生成后手动为每个 <line> 设置 stroke / stroke-width；并通过 MutationObserver
 * 在标注因滚动 / 缩放重新渲染时保持颜色（每次重新渲染都会重新创建 <line>）。
 *
 * @param mark - epub.js 返回的标注 mark 对象（含 element）
 * @param cfiRange - 标注锚点，用于管理观察器生命周期
 * @param colorName - 颜色名称
 */
function recolorUnderline(mark: any, cfiRange: string, colorName: string): void {
  const el = mark?.element as SVGElement | undefined;
  if (!el) return;
  const apply = () => {
    const { fill } = parseColor(colorName);
    el.querySelectorAll('line').forEach((line) => {
      line.setAttribute('stroke', fill);
      line.setAttribute('stroke-width', '2');
    });
  };
  apply();
  const obs = new MutationObserver(apply);
  obs.observe(el, { childList: true, subtree: true });
  underlineObservers.set(cfiRange, obs);
}

/**
 * 断开并移除某标注的下划线着色观察器（删除标注时调用）
 *
 * @param cfiRange - 标注锚点
 */
function disposeUnderlineObserver(cfiRange: string): void {
  const obs = underlineObservers.get(cfiRange);
  if (obs) {
    obs.disconnect();
    underlineObservers.delete(cfiRange);
  }
}

/**
 * 根据类型与颜色生成 epub.js annotations 所需的 SVG 属性对象
 *
 * @param type - 划线类型 ('highlight' | 'underline' | 'wavy')
 * @param colorName - 颜色名称
 * @returns epubjs 标注所需的属性对象（fill/fill-opacity 或 stroke/stroke-opacity）
 */
function getTypeStyles(type: string, colorName: string): Record<string, string> {
  const { fill, opacity } = parseColor(colorName);
  switch (type) {
    case 'underline':
    case 'wavy':
      // 在 <g> 上设置 stroke 作为兜底；真正的线条着色由 recolorUnderline 二次处理
      return {
        stroke: fill,
        'stroke-opacity': opacity,
        'stroke-width': '2',
        'mix-blend-mode': 'multiply',
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

/** 当前文件的标注列表（本地维护，与数据库同步；新增/编辑/删除后实时更新） */
const annotations = ref<EpubAnnotation[]>([]);
/** 浮动工具条是否显示 */
const toolbarVisible = ref(false);
/** 浮动工具条定位 x 坐标（相对视口，px） */
const toolbarX = ref(0);
/** 浮动工具条定位 y 坐标（相对视口，px） */
const toolbarY = ref(0);
/** 当前选区临时信息，null 表示无活动选区；用于工具条操作时获取 cfiRange 与文本 */
const currentSelection = ref<{ cfiRange: string; text: string } | null>(null);

/** 最近一次 mouseup 的视口 x 坐标（用于浮动工具条定位） */
let lastMouseX = 0;
/** 最近一次 mouseup 的视口 y 坐标（用于浮动工具条定位） */
let lastMouseY = 0;

/** 主题 class 计算属性 */
const themeClass = computed(() => `theme-${props.theme}`);

/**
 * 注册 epubjs 主题
 * day：白底黑字；night：深色背景浅色字；eye：护眼绿底深色字
 *
 * @param rend - epubjs Rendition 实例
 * @returns 无返回值
 */
function registerThemes(rend: Rendition) {
  // 白天主题
  rend.themes.register('day', {
    body: { background: '#ffffff', color: '#333333' },
  });
  // 夜间主题
  rend.themes.register('night', {
    body: { background: '#1a1a1a', color: '#cccccc' },
    a: { color: '#88aaff' },
  });
  // 护眼主题
  rend.themes.register('eye', {
    body: { background: '#c7edcc', color: '#2c3e50' },
  });
}

/**
 * 通过 jlocal 协议读取本地 epub 文件为 ArrayBuffer
 * 利用项目已注册的 jlocal:// 协议（支持 fetch API）
 *
 * @param filePath - epub 文件绝对路径
 * @returns 成功返回 ArrayBuffer；失败抛出异常
 * @throws Error - 文件读取失败时抛出包含错误信息的异常
 */
async function loadFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
  const url = 'jlocal:///' + filePath;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`文件读取失败，HTTP 状态码：${response.status}`);
  }
  return await response.arrayBuffer();
}

/**
 * 初始化并渲染 epub
 * 加载文件 → 创建 Book → renderTo → 注册主题 → display
 *
 * @param filePath - epub 文件绝对路径
 * @returns 成功返回 void；失败弹出 ElMessage 错误提示
 */
async function renderEpub(filePath: string) {
  if (!readerRef.value) return;
  loading.value = true;

  try {
    // 读取文件为 ArrayBuffer
    const arrayBuffer = await loadFileAsArrayBuffer(filePath);
    // 创建 Book 实例
    book = ePub(arrayBuffer);
    // 渲染到容器
    rendition = book.renderTo(readerRef.value, {
      width: '100%',
      height: '100%',
      allowScriptedContent: true,
    });

    // 注册并应用主题
    registerThemes(rendition);
    applyTheme(props.theme);
    applyFontSize(props.fontSize);
    applyFont();

    // 加载目录并通知父组件
    book.loaded.navigation
      .then((nav) => {
        emit('toc-loaded', nav.toc || []);
      })
      .catch((err) => {
        console.error('加载目录失败', err);
      });

    // 后台生成 locations 以支持百分比计算（不阻塞渲染）
    book.ready
      .then(() => {
        return book!.locations.generate(1024);
      })
      .then(() => {
        locationsReady = true;
        // locations 就绪后，用当前 CFI 补算一次精确进度（初始 display 时可能算出 0%）
        refreshProgressAfterLocations();
      })
      .catch((err) => {
        console.error('生成 locations 失败', err);
      });

    // 监听位置变化，更新进度
    rendition.on('relocated', handleRelocated);
    // 监听文本选区：用户在 iframe 内选中文本后触发，弹出浮动工具条
    rendition.on('selected', handleSelected);
    // 监听 iframe 内 mouseup：epubjs 会将 iframe 的 DOM 事件转发到 rendition，
    // 用于记录鼠标坐标（需换算为外层视口坐标）以便定位浮动工具条
    rendition.on('mouseup', handleRenditionMouseup);

    // 恢复上次阅读进度
    const savedCfi = await restoreProgress(filePath);
    if (savedCfi) {
      await rendition.display(savedCfi);
    } else {
      await rendition.display();
    }

    // 显示完成后加载并恢复已保存的划线高亮（display 完成后当前 section 已渲染；
    // 其它 section 的高亮由 epubjs 在翻页时自动注入）
    await loadAnnotations(filePath);
  } catch (err: any) {
    ElMessage.error(`加载电子书失败：${err?.message || String(err)}`);
    cleanup();
  } finally {
    loading.value = false;
  }
}

/**
 * 恢复上次阅读进度
 * 从数据库读取 cfi 记录，用于 rendition.display(cfi)
 *
 * @param filePath - epub 文件绝对路径
 * @returns 成功返回 cfi 字符串；无记录或失败返回空字符串
 */
async function restoreProgress(filePath: string): Promise<string> {
  try {
    const res = await window.ipcRenderer.ebook.getProgress(filePath);
    if (res?.success && res.data?.cfi) {
      return res.data.cfi;
    }
  } catch (err) {
    console.error('恢复阅读进度失败', err);
  }
  return '';
}

/**
 * relocated 事件回调：位置变化时更新进度
 * 防抖处理避免频繁写库
 *
 * @param location - epubjs Location 对象
 * @returns 无返回值
 */
function handleRelocated(location: any) {
  const cfi = location?.start?.cfi;
  if (!cfi) return;
  // 记录当前 CFI，供 locations 生成完成后补算精确进度
  currentCfi.value = cfi;
  applyProgress(location);
}

/**
 * 计算并应用阅读进度（进度文本 + 防抖写库）
 *
 * 百分比计算优先级：
 * 1) epub.js 自带 percentage（locations 就绪时由 rendition 直接算出，最可靠）
 * 2) 否则用 locations.percentageFromCfi 自行计算（需 locations 就绪）
 * 3) 兜底：locations 未就绪（生成失败/尚未完成）时，用当前章节序号大致估算，
 *    避免出现「进度恒为 0%」的问题（否则底部进度与书架进度都会卡在 0）
 *
 * @param location - epubjs Location 对象
 * @returns 无返回值
 */
function applyProgress(location: any) {
  const cfi = location?.start?.cfi;
  if (!cfi) return;

  let percent = 0;
  if (typeof location?.start?.percentage === 'number') {
    percent = Math.round(location.start.percentage * 100);
  } else if (locationsReady && book) {
    const p = book.locations.percentageFromCfi(cfi);
    if (typeof p === 'number') {
      percent = Math.round(p * 100);
    }
  }
  if (percent === 0 && !locationsReady && book?.spine) {
    // 注意：book.spine.length 是数值属性（非函数），需直接取值
    const total = typeof book.spine.length === 'number' ? book.spine.length : 0;
    const idx = typeof location?.start?.index === 'number' ? location.start.index : -1;
    if (total > 0 && idx >= 0) {
      percent = Math.round(((idx + 1) / total) * 100);
    }
  }
  percent = Math.max(0, Math.min(100, percent));
  progressText.value = `${percent}%`;

  // 防抖 emit 进度更新（500ms 内多次翻页只 emit 最后一次）
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    emit('progress-update', { cfi, percent });
  }, 500);
}

/**
 * locations 生成完成后，用当前 CFI 重新计算精确进度。
 *
 * 初始 rendition.display(cfi) 在 locations 尚未就绪时即触发 relocated，
 * 此时拿不到 percentage，进度会暂显 0%。此处待 locations 就绪后补算一次，
 * 确保打开书时底部进度与书架进度显示真实百分比。
 *
 * @returns 无返回值
 */
function refreshProgressAfterLocations() {
  const cfi = currentCfi.value;
  if (!cfi || !book) return;
  const p = book.locations.percentageFromCfi(cfi);
  if (typeof p === 'number') {
    const percent = Math.max(0, Math.min(100, Math.round(p * 100)));
    progressText.value = `${percent}%`;
    // 立即同步一次书架进度（不防抖），保证打开即显示正确百分比
    emit('progress-update', { cfi, percent });
  }
}

/**
 * 容器 mouseup 事件处理
 * 监听外层 .epub-viewer 容器自身的 mouseup（如点击容器边距时），
 * 直接记录视口坐标。注意：iframe 内部的 mouseup 不会冒泡到外层文档，
 * 故 iframe 内的 mouseup 由 handleRenditionMouseup 单独处理
 * 同时检测外层文档选区，若选区为空则隐藏工具条
 *
 * @param e - 鼠标事件对象
 * @returns 无返回值
 */
function onReaderMouseup(e: MouseEvent) {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  
  // 检测选区是否为空，为空则隐藏工具条
  // 注：若点击的是 iframe 内部，此处外层选区为空是正常的，
  // 真正的选区检测在 handleRenditionMouseup 中处理
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString()) {
    // 只有当外层也没有选区时才隐藏，避免与 iframe 内的选区冲突
    // 简单处理：如果当前工具条可见，且没有新的 selected 事件触发，
    // 可以延迟一帧检查（或直接由 handleRenditionMouseup 负责）
  }
}

/**
 * rendition 转发的 iframe mouseup 事件处理
 * epubjs 将 iframe 内的 DOM 事件转发到 rendition，此处接收 mouseup；
 * iframe 内的 clientX/clientY 是相对 iframe 视口的，需加上 iframe 在外层文档中的偏移
 * 换算为外层视口坐标，供浮动工具条（position:fixed）定位使用
 * 同时检测 iframe 内选区，若选区为空则隐藏工具条
 *
 * @param ev - epubjs 转发的 iframe 内 MouseEvent 对象
 * @returns 无返回值
 */
function handleRenditionMouseup(ev: MouseEvent) {
  // 查找 epubjs 创建的 iframe 元素，用于获取其在外层文档中的位置
  const iframe = readerRef.value?.querySelector('iframe');
  const rect = iframe?.getBoundingClientRect();
  if (rect) {
    // iframe 内坐标 + iframe 在外层视口的偏移 = 外层视口坐标
    lastMouseX = rect.left + ev.clientX;
    lastMouseY = rect.top + ev.clientY;
  } else {
    // 兜底：找不到 iframe 时直接使用（坐标可能略有偏差，但不影响功能）
    lastMouseX = ev.clientX;
    lastMouseY = ev.clientY;
  }
  
  // 检测 iframe 内选区是否为空，为空则隐藏工具条
  // 这处理了用户点击取消选中（如点击空白处）的情况
  try {
    const iframeWindow = iframe?.contentWindow;
    if (iframeWindow) {
      const selection = iframeWindow.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString()) {
        // 选区为空，隐藏工具条
        toolbarVisible.value = false;
        currentSelection.value = null;
      }
    }
  } catch (err) {
    console.warn('检测 iframe 选区失败：可能是跨域限制', err);
  }
}

/**
 * rendition selected 事件回调：用户选中文本后触发
 * 获取选中文本（优先用 rendition.getRange，为空时用 iframe 原生选区兜底），
 * 文本非空则记录选区信息并显示浮动工具条
 *
 * @param cfiRange - epubjs 生成的选区 cfiRange 字符串
 * @param contents - epubjs Contents 对象，含 iframe 的 window/document
 * @returns 无返回值
 */
function handleSelected(cfiRange: string, contents: Contents) {
  if (!rendition) return;
  let text = '';
  // 优先用 rendition.getRange 取选中文本
  try {
    const range = rendition.getRange(cfiRange);
    // getRange 类型声明返回 Range（非空），但运行时可能返回 null/undefined，故用 ?. 兜底
    text = range?.toString() ?? '';
  } catch (err) {
    console.error('rendition.getRange 失败', err);
  }
  // 兜底：getRange 失败或返回空时，用 iframe 内原生选区
  if (!text && contents?.window) {
    try {
      text = contents.window.getSelection()?.toString() ?? '';
    } catch (err) {
      console.error('获取 iframe 选区文本失败', err);
    }
  }
  // 文本为空则不显示工具条
  if (!text) {
    toolbarVisible.value = false;
    return;
  }
  // 记录当前选区信息，供工具条操作使用
  currentSelection.value = { cfiRange, text };
  // 用最近一次 mouseup 坐标定位工具条
  toolbarX.value = lastMouseX;
  toolbarY.value = lastMouseY;
  toolbarVisible.value = true;
}

/**
 * 划线核心流程：保存到数据库 → 添加高亮 → 更新本地列表 → 通知父组件
 * 失败时弹出 ElMessage.error 提示但不阻断流程
 *
 * @param cfiRange - 选区 cfiRange 字符串，作为定位锚点
 * @param text - 选中的原文摘录
 * @param note - 笔记内容，默认空字符串（纯划线时为空）
 * @param color - 高亮颜色名称，默认 'yellow'
 * @param type - 划线类型，默认 'highlight'
 * @returns 成功返回 void；失败弹出错误提示
 */
async function addHighlight(cfiRange: string, text: string, note = '', color = 'yellow', type = 'highlight'): Promise<void> {
  if (!rendition) return;
  try {
    // 1. 调用主进程 IPC 新增标注记录，取返回的自增 id
    const res = await window.ipcRenderer.ebook.addAnnotation({
      filePath: props.filePath,
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
    // 2. 添加高亮到 rendition，根据 color 和 type 生成 SVG 样式
    const styles = getTypeStyles(type, color);
    // epub.js 仅支持 highlight / underline，波浪线降级为 underline 渲染
    const epubType = uiTypeToEpub(type);
    const data = { id, note, cfiRange, color, type };
    const cb = () => onHighlightClick(id, cfiRange);
    const mark =
      epubType === 'underline'
        ? rendition.annotations.underline(cfiRange, data, cb, 'epub-highlight', styles)
        : rendition.annotations.highlight(cfiRange, data, cb, 'epub-highlight', styles);
    // 下划线 / 波浪线的线条颜色需二次着色（epub.js 写死为 black）
    if (epubType === 'underline') {
      recolorUnderline(mark, cfiRange, color);
    }
    // 3. 更新本地标注列表
    annotations.value.push({ id, anchor: cfiRange, text, note, color, type });
    // 4. 通知父组件标注列表已更新
    emit('annotations-updated', annotations.value);
  } catch (err) {
    console.error('添加划线异常', err);
    ElMessage.error('添加划线失败');
  }
}

/**
 * 点击「划线」按钮处理：对当前选区执行纯划线流程（note 为空），关闭工具条
 *
 * @param payload - 工具条传递的参数，包含 color 和 type
 * @returns 无返回值
 */
async function onToolbarHighlight(payload?: { color?: string; type?: string }): Promise<void> {
  const sel = currentSelection.value;
  if (!sel) return;
  // 先清空选区状态并关闭工具条，避免 await 期间状态被重复使用
  currentSelection.value = null;
  toolbarVisible.value = false;
  await addHighlight(sel.cfiRange, sel.text, '', payload?.color || 'yellow', payload?.type || 'highlight');
}

/**
 * 点击「笔记」按钮处理：先划线保存（note 为空），再弹输入框录入笔记
 * 用户取消输入则保留为纯划线；保存则调 updateAnnotation 更新 note
 *
 * @param payload - 工具条传递的参数，包含 color 和 type
 * @returns 无返回值
 */
async function onToolbarNote(payload?: { color?: string; type?: string }): Promise<void> {
  const sel = currentSelection.value;
  if (!sel) return;
  currentSelection.value = null;
  toolbarVisible.value = false;
  // 先执行划线流程保存到数据库
  await addHighlight(sel.cfiRange, sel.text, '', payload?.color || 'yellow', payload?.type || 'highlight');
  // 取最新创建的标注项（addHighlight 成功后会 push 到 annotations 末尾）
  const created = annotations.value[annotations.value.length - 1];
  if (!created) return;
  try {
    // 弹出笔记输入框
    const { value } = await ElMessageBox.prompt('请输入笔记', '添加笔记', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputType: 'textarea',
    });
    // 调用 IPC 更新笔记内容
    const res = await window.ipcRenderer.ebook.updateAnnotation({
      id: created.id,
      note: value,
      color: payload?.color || 'yellow',
      type: payload?.type || 'highlight',
    });
    if (!res?.success) {
      ElMessage.error(`保存笔记失败：${res?.error || '未知错误'}`);
      return;
    }
    created.note = value;
    emit('annotations-updated', annotations.value);
  } catch {
    // 用户点击取消或关闭弹窗，保留为纯划线（note 为空），不处理
  }
}

/**
 * 点击已有高亮的回调：弹窗展示笔记并提供「删除」「编辑笔记」选项
 * 由 addHighlight / loadAnnotations 中的高亮闭包调用
 *
 * @param id - 标注记录主键 id
 * @param cfiRange - 标注定位锚点（cfiRange）
 * @returns 无返回值
 */
function onHighlightClick(id: number, cfiRange: string): void {
  const annotation = annotations.value.find((a) => a.id === id);
  const note = annotation?.note ?? '';
  // confirm：确认=删除，取消=编辑笔记
  ElMessageBox.confirm(
    `${note ? '笔记：' + note : '无笔记'}\n是否删除该划线？`,
    '划线',
    {
      confirmButtonText: '删除',
      cancelButtonText: '编辑笔记',
      type: 'info',
    }
  )
    .then(() => {
      // 用户点击「删除」
      removeHighlight(id, cfiRange);
    })
    .catch((action) => {
      // 仅「编辑笔记」按钮（action === 'cancel'）触发编辑；
      // 关闭弹窗（action === 'close'）不处理
      // 注：catch 变量类型只能为 any/unknown，故不做类型注解，用 === 比较收窄
      if (action === 'cancel') {
        editAnnotationNote(id);
      }
    });
}

/**
 * 删除划线：调用 IPC 删除数据库记录 → 移除 rendition 高亮 → 更新本地列表 → 通知父组件
 *
 * @param id - 标注记录主键 id
 * @param cfiRange - 标注定位锚点（cfiRange）
 * @returns 无返回值；失败弹出错误提示
 */
async function removeHighlight(id: number, cfiRange: string): Promise<void> {
  try {
    const res = await window.ipcRenderer.ebook.removeAnnotation(id);
    if (!res?.success) {
      ElMessage.error(`删除划线失败：${res?.error || '未知错误'}`);
      return;
    }
    // 移除 rendition 中的高亮：需按实际存储的 epub 类型移除（underline 类型不能按 highlight 找）
    if (rendition) {
      const ann = annotations.value.find((a) => a.id === id);
      const epubType = uiTypeToEpub(ann?.type || 'highlight');
      disposeUnderlineObserver(cfiRange);
      rendition.annotations.remove(cfiRange, epubType);
    }
    // 移除本地标注项
    const idx = annotations.value.findIndex((a) => a.id === id);
    if (idx !== -1) {
      annotations.value.splice(idx, 1);
    }
    emit('annotations-updated', annotations.value);
  } catch (err) {
    console.error('删除划线异常', err);
    ElMessage.error('删除划线失败');
  }
}

/**
 * 编辑笔记：弹出输入框（预填当前笔记）→ 调用 IPC 更新 → 同步本地 → 通知父组件
 *
 * @param id - 标注记录主键 id
 * @returns 无返回值；用户取消时不做任何操作
 */
async function editAnnotationNote(id: number): Promise<void> {
  const annotation = annotations.value.find((a) => a.id === id);
  if (!annotation) return;
  try {
    const { value } = await ElMessageBox.prompt('请输入笔记内容', '编辑笔记', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: annotation.note || '',
      inputType: 'textarea',
    });
    const res = await window.ipcRenderer.ebook.updateAnnotation({
      id,
      note: value,
      color: annotation.color || 'yellow',
      type: annotation.type || 'highlight',
    });
    if (!res?.success) {
      ElMessage.error(`保存笔记失败：${res?.error || '未知错误'}`);
      return;
    }
    annotation.note = value;
    emit('annotations-updated', annotations.value);
  } catch {
    // 用户取消，不处理
  }
}

/**
 * 加载并恢复已保存的划线高亮
 * 调用 getAnnotations IPC 获取数据库记录，逐个映射为 EpubAnnotation 并添加高亮
 * 单条记录恢复失败不影响其他记录
 *
 * @param filePath - 电子书文件绝对路径
 * @returns 无返回值；失败仅打印日志不弹窗（避免干扰阅读）
 */
async function loadAnnotations(filePath: string): Promise<void> {
  if (!rendition) return;
  try {
    const res = await window.ipcRenderer.ebook.getAnnotations(filePath);
    if (!res?.success || !Array.isArray(res.data)) {
      return;
    }
    // 重置本地标注列表
    annotations.value = [];
    for (const record of res.data) {
      const id = record.id;
      const cfiRange = record.anchor;
      const note = record.note ?? '';
      const color = record.color || 'yellow';
      const type = record.type || 'highlight';
      try {
        // 根据 color 和 type 生成 SVG 样式
        const styles = getTypeStyles(type, color);
        // epub.js 仅支持 highlight / underline，波浪线降级为 underline 渲染
        const epubType = uiTypeToEpub(type);
        const data = { id, note, cfiRange, color, type };
        const cb = () => onHighlightClick(id, cfiRange);
        const mark =
          epubType === 'underline'
            ? rendition.annotations.underline(cfiRange, data, cb, 'epub-highlight', styles)
            : rendition.annotations.highlight(cfiRange, data, cb, 'epub-highlight', styles);
        // 下划线 / 波浪线线条二次着色
        if (epubType === 'underline') {
          recolorUnderline(mark, cfiRange, color);
        }
        annotations.value.push({
          id,
          anchor: cfiRange,
          text: record.text,
          note,
          color,
          type,
        });
      } catch (err) {
        // 单条恢复失败（如 cfiRange 无效）不影响其他记录
        console.error('恢复单条划线失败', record, err);
      }
    }
    emit('annotations-updated', annotations.value);
  } catch (err) {
    console.error('加载划线列表失败', err);
  }
}

/**
 * 跳转到指定划线位置
 * 供父组件通过 ref 调用（如笔记抽屉点击某条笔记时跳转到对应位置）
 *
 * @param anchor - 定位锚点（cfiRange 字符串）
 * @returns 无返回值
 */
function jumpToAnnotation(anchor: string): void {
  if (!rendition || !anchor) return;
  rendition.display(anchor);
}

/**
 * 应用主题
 *
 * @param theme - 阅读主题：day 白天、night 夜间、eye 护眼
 * @returns 无返回值
 */
function applyTheme(theme: EbookTheme) {
  if (!rendition) return;
  rendition.themes.select(theme);
}

/**
 * 应用字体大小
 *
 * @param size - 字体大小，单位 px
 * @returns 无返回值
 */
function applyFontSize(size: number) {
  if (!rendition) return;
  rendition.themes.fontSize(`${size}px`);
}

/**
 * 应用正文（中/英文）字体
 * 将中文与英文字体合并为 font-family 列表后传给 epub.js；
 * 两个字体均为空时清除覆盖，回退到 epub 默认字体
 *
 * @returns 无返回值
 */
function applyFont() {
  if (!rendition) return;
  const cn = props.fontFamily || '';
  const en = props.fontFamilyEn || '';
  const list = [cn, en].filter(Boolean);
  if (list.length === 0) {
    // 无自定义字体：移除覆盖以使用 epub 默认字体
    rendition.themes.removeOverride('font-family');
    return;
  }
  list.push('sans-serif');
  rendition.themes.font(list.join(', '));
}

/** 重入保护标记：刷新标注过程中防止并发重入 */
let isRefreshing = false;
/** 刷新期间是否再次发生字体 / 字号变更，用于补一次刷新 */
let pendingRefresh = false;

/**
 * 字体大小 / 字体切换后重新载入标注
 * epub.js 仅对 <body> 设置 CSS 覆盖，正文重排后已注册的 SVG 标注（基于旧布局定位）不会自动重定位，
 * 导致划线与笔记移位；此处先移除全部旧标注，待浏览器完成重排后依据 cfiRange 重新定位添加。
 * 不会改动 annotations.value（数据数组），仅重绘 SVG，避免笔记抽屉闪烁。
 *
 * @returns 无返回值
 */
async function refreshAnnotations(): Promise<void> {
  if (!rendition) return;
  const list = annotations.value.slice();
  if (list.length === 0) return;
  // 防止切换期间的并发重入；若刷新过程中又发生了字体变更，标记 pending 以补一次刷新
  if (isRefreshing) {
    pendingRefresh = true;
    return;
  }
  isRefreshing = true;
  try {
    // 1. 移除全部旧 SVG 标注（同步），并断开其着色观察器
    for (const ann of list) {
      const epubType = uiTypeToEpub(ann.type);
      disposeUnderlineObserver(ann.anchor);
      try {
        rendition.annotations.remove(ann.anchor, epubType);
      } catch (err) {
        console.error('移除旧划线失败', ann.anchor, err);
      }
    }
    // 2. 等待浏览器完成重排（字体 / 字号改变后布局需在下一帧才稳定）
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      } else {
        setTimeout(resolve, 60);
      }
    });
    if (!rendition) return;
    // 3. 依据 cfiRange 重新定位并添加标注
    for (const ann of list) {
      // 刷新期间若用户已删除该标注，跳过以免复活已删项
      if (!annotations.value.some((a) => a.id === ann.id)) continue;
      try {
        const styles = getTypeStyles(ann.type, ann.color);
        const epubType = uiTypeToEpub(ann.type);
        const data = { id: ann.id, note: ann.note, cfiRange: ann.anchor, color: ann.color, type: ann.type };
        const cb = () => onHighlightClick(ann.id, ann.anchor);
        const mark =
          epubType === 'underline'
            ? rendition.annotations.underline(ann.anchor, data, cb, 'epub-highlight', styles)
            : rendition.annotations.highlight(ann.anchor, data, cb, 'epub-highlight', styles);
        if (epubType === 'underline') {
          recolorUnderline(mark, ann.anchor, ann.color);
        }
      } catch (err) {
        console.error('重新添加划线失败', ann, err);
      }
    }
  } finally {
    isRefreshing = false;
    if (pendingRefresh) {
      pendingRefresh = false;
      // 刷新期间又发生了字体变更，补一次以应用最新样式
      void refreshAnnotations();
    }
  }
}

/**
 * 翻到上一页
 *
 * @returns 无返回值
 */
function prevPage() {
  if (!rendition) return;
  rendition.prev?.();
}

/**
 * 翻到下一页
 *
 * @returns 无返回值
 */
function nextPage() {
  if (!rendition) return;
  rendition.next?.();
}

/**
 * 跳转到指定 cfi 或 href
 * 供父组件通过 ref 调用以实现目录跳转
 *
 * @param target - cfi 或 href 字符串
 * @returns 无返回值
 */
function displayTarget(target: string) {
  if (!rendition || !target) return;
  rendition.display(target);
}

/**
 * 键盘事件处理：左右键翻页
 *
 * @param e - 键盘事件对象
 * @returns 无返回值
 */
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') {
    prevPage();
  } else if (e.key === 'ArrowRight') {
    nextPage();
  }
}

/**
 * 清理 epubjs 资源
 * 销毁 rendition 与 book，移除事件监听，清理定时器
 *
 * @returns 无返回值
 */
function cleanup() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (rendition) {
    try {
      rendition.destroy();
    } catch (err) {
      console.error('销毁 rendition 失败', err);
    }
    rendition = null;
  }
  if (book) {
    try {
      book.destroy();
    } catch (err) {
      console.error('销毁 book 失败', err);
    }
    book = null;
  }
  locationsReady = false;
  // 清理标注相关状态（工具条关闭、选区清空、本地标注列表清空）
  annotations.value = [];
  toolbarVisible.value = false;
  currentSelection.value = null;
}

/**
 * 按 id 移除本地划线（不调 IPC，持久化由父组件负责）
 * 供父组件笔记抽屉删除后同步子组件高亮渲染，避免高亮残留
 *
 * @param id - 标注记录主键 id
 * @returns 无返回值；找不到对应标注时静默返回
 */
function removeAnnotationById(id: number): void {
  const ann = annotations.value.find((a) => a.id === id);
  if (!ann) return;
  // 移除 rendition 中的高亮标注：按实际存储的 epub 类型移除，并断开下划线观察器
  if (rendition) {
    try {
      const epubType = uiTypeToEpub(ann.type || 'highlight');
      disposeUnderlineObserver(ann.anchor);
      rendition.annotations.remove(ann.anchor, epubType);
    } catch (err) {
      console.error('移除 rendition 高亮失败', err);
    }
  }
  // 移除本地标注项
  annotations.value = annotations.value.filter((a) => a.id !== id);
  emit('annotations-updated', annotations.value);
}

// 暴露方法供父组件调用：
// - displayTarget：跳转到指定 cfi 或 href（目录跳转）
// - jumpToAnnotation：跳转到指定划线位置（笔记抽屉点击调用）
// - removeAnnotationById：按 id 移除本地划线（笔记抽屉删除后同步高亮）
defineExpose({ displayTarget, jumpToAnnotation, removeAnnotationById });

// 监听文件路径变化，重新渲染
watch(
  () => props.filePath,
  (newPath) => {
    cleanup();
    progressText.value = '0%';
    if (newPath) {
      renderEpub(newPath);
    }
  }
);

// 监听主题变化
watch(
  () => props.theme,
  (newTheme) => {
    applyTheme(newTheme);
  }
);

// 监听字体大小变化
watch(
  () => props.fontSize,
  (newSize) => {
    applyFontSize(newSize);
    // 字体大小改变会导致正文重排，已注册标注需重新定位，否则划线移位
    void refreshAnnotations();
  }
);

// 监听中/英文正文字体变化
watch(
  () => [props.fontFamily, props.fontFamilyEn],
  () => {
    applyFont();
    // 字体改变会导致正文重排，已注册标注需重新定位，否则划线移位
    void refreshAnnotations();
  }
);

onMounted(() => {
  if (props.filePath) {
    renderEpub(props.filePath);
  }
  // 注册键盘翻页监听
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  // 移除键盘监听并销毁 epubjs 资源
  window.removeEventListener('keydown', handleKeydown);
  cleanup();
});
</script>

<style scoped lang="scss">
.epub-reader {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  transition: background-color 0.3s;

  .epub-viewer {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .epub-footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 10px 24px;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-card);

    .progress-text {
      font-size: 13px;
      color: var(--text-secondary);
      min-width: 50px;
      text-align: center;
    }
  }

  /* 白天主题 */
  &.theme-day {
    background-color: #ffffff;
  }

  /* 夜间主题 */
  &.theme-night {
    background-color: #1a1a1a;

    .epub-footer {
      background-color: #2a2a2a;
      border-top-color: #3a3a3a;
    }
  }

  /* 护眼主题 */
  &.theme-eye {
    background-color: #c7edcc;
  }
}
</style>
