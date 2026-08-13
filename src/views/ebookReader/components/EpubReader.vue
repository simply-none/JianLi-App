<template>
  <div class="epub-reader" :class="themeClass" v-loading="loading" element-loading-text="正在加载电子书...">
    <!-- epub 渲染容器：epubjs 会将内容渲染到此元素；监听 mouseup 记录鼠标坐标，用于浮动工具条定位 -->
    <div class="epub-viewport">
      <div ref="readerRef" class="epub-viewer" @mouseup="onReaderMouseup"></div>
      <!-- 阅读区左右边缘 10% 点击区：点击上一页 / 下一页，便于沉浸式翻页 -->
      <div class="edge-turn-zone edge-turn-zone--left" @click="onEdgePrev" title="上一页"></div>
      <div class="edge-turn-zone edge-turn-zone--right" @click="onEdgeNext" title="下一页"></div>
    </div>

    <!-- 选中文本后弹出的浮动工具条：提供「划线」「笔记」两个操作 -->
    <AnnotationToolbar
      :visible="toolbarVisible"
      :x="toolbarX"
      :y="toolbarY"
      @highlight="onToolbarHighlight"
      @note="onToolbarNote"
      @close="toolbarVisible = false"
    />

    <!-- 笔记编辑弹窗：编辑笔记时可在底部直接删除对应划线 -->
    <el-dialog
      v-model="noteDialogVisible"
      title="编辑笔记"
      width="400px"
      :close-on-click-modal="false"
      append-to-body
      class="annotation-note-dialog"
      @closed="onNoteDialogClosed"
    >
      <el-input
        v-model="noteInput"
        type="textarea"
        :rows="4"
        placeholder="请输入笔记内容"
        resize="none"
      />
      <template #footer>
        <div class="annotation-note-dialog-footer">
          <el-button type="danger" plain size="small" @click="deleteCurrentAnnotation">
            删除划线
          </el-button>
          <div class="dialog-footer-right">
            <el-button size="small" @click="noteDialogVisible = false">取消</el-button>
            <el-button type="primary" size="small" @click="saveNote">保存</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 底部翻页控制区 -->
    <div class="epub-footer" v-show="props.bottomBarVisible !== false">
      <el-button size="small" :disabled="loading" @click="prevPage">
        <LucideIcon name="ArrowLeft" :size="14" />
        上一页
      </el-button>
      <span class="progress-text">{{ progressText }}</span>
      <span class="page-text">{{ pageText }}</span>
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
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
// 浮动工具条组件：选中文本后弹出，提供「划线」「笔记」两个操作
import AnnotationToolbar from './AnnotationToolbar.vue';
// 划线颜色/类型统一配置（颜色映射、默认值等）
import { HIGHLIGHT_COLOR_MAP } from '../highlightConfig';
import { resolveReadingBg, resolveReadingText } from '../themePresets';
// epubjs 默认导出 ePub 工厂函数，命名导出 Book/Rendition/NavItem/Contents 类型
import ePub, { Book, Rendition, NavItem, Contents } from 'epubjs';
// 阅读设置 store：划线颜色/类型由右上角「阅读设置」预设
import useEbookReader from '@/store/useEbookReader';
// 全局设置 store：sidebarVisible / topbarVisible 变化时阅读区域尺寸改变，需重载
import useGlobalSetting from '@/store/useGlobalSetting';

/** 阅读主题类型：day 白天、night 夜间、eye 护眼 */
type EbookTheme = 'day' | 'night' | 'eye';
/** 阅读区背景类型：preset 跟随主题 / color 纯色 / image 背景图 */
type EbookBgType = 'preset' | 'color' | 'image';

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
  /** 阅读区背景类型：preset 跟随主题 / color 纯色 / image 背景图 */
  bgType?: EbookBgType;
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
  /** 页边距，单位 px（作用于 epub body margin） */
  margin?: number;
  /** 是否显示底部翻页控制栏 */
  bottomBarVisible?: boolean;
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
/** 当前页码信息：当前章节内的页码 / 本章总页数（epub.js 分页，随字体/字号变化） */
const pageInfo = ref<{ current: number; total: number }>({ current: 1, total: 1 });
/** 页码展示文本，如 "3 / 12" */
const pageText = computed(() => `${pageInfo.value.current} / ${pageInfo.value.total}`);
/** 记录最后一次 relocated 得到的 CFI，供 locations 生成完成后补算精确进度 */
const currentCfi = ref('');
/**
 * 翻页动画方向：用户点击上一页/下一页时设置；
 * relocated 回调消费后清空（初始加载、目录跳转、笔记跳转均不触发动画）。
 * 取值 'forward' | 'back' | null
 */
const turnDirection = ref<'forward' | 'back' | null>(null);
/** 笔记编辑弹窗显示状态 */
const noteDialogVisible = ref(false);
/** 当前正在编辑的标注记录 id */
const currentEditAnnotationId = ref<number | null>(null);
/** 笔记编辑弹窗中的输入内容 */
const noteInput = ref('');

/** epubjs Book 实例 */
let book: Book | null = null;
/** epubjs Rendition 实例 */
let rendition: Rendition | null = null;
/** 进度持久化防抖定时器句柄 */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** locations 是否已生成（用于判断百分比是否可用） */
let locationsReady = false;

/** 阅读设置 store：划线颜色/类型由右上角「阅读设置」预设，此处直接读取 */
const ebookStore = useEbookReader();
const { settings } = storeToRefs(ebookStore);

/** 全局设置 store：侧边栏/顶部栏显隐改变阅读区尺寸，触发重载 */
const globalSettingStore = useGlobalSetting();
const { sidebarVisible, topbarVisible } = storeToRefs(globalSettingStore);

/**
 * 根据颜色名称获取 CSS 颜色值（颜色映射来自统一配置）
 *
 * @param colorName - 颜色名称
 * @returns CSS 颜色值
 */
function getColorValue(colorName: string): string {
  return HIGHLIGHT_COLOR_MAP[colorName] || HIGHLIGHT_COLOR_MAP.yellow;
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

/** 所有 epub 阅读主题名（与 EbookTheme 一致），用于兜底清理 body 上的残留主题 class */
const EPUB_THEME_NAMES: EbookTheme[] = ['day', 'night', 'eye'];

/**
 * epub 正文（iframe）内「与背景/文字色无关」的兜底规则，注册到 epubjs 的 `default` 主题。
 *
 * 背景色 / 文字色不放在这里——它们现在是**随设置动态变化**的（纯色 / 背景图 / 自定义文字色），
 * 通过 `applyReadingStyle()` 用 `themes.override()` 注入（见下）。这里仅保留：
 *   - body 过渡动画（切换主题时不生硬）；
 *   - 夜间主题下链接单独着色（文字色由 override 控制，a 标签需额外保证对比度）。
 *
 * 关键设计（沿用此前修复「反复切换后正文配色不一致」的经验）：
 * 合并进 `default` 主题一次性注入。epubjs 的 content 钩子 `inject()` 只注入 `_current`
 * 与 `default` 两个主题，挂在 `default` 上可保证**每个新渲染的章节 iframe** 都自带这些规则。
 *
 * 背景/文字色的动态注入之所以用 `themes.override(name, value, true)` 而非 `default` 重写：
 * `override()` 在 epubjs 内部按 `name` 复用同一个 `<style>` 节点（innerHTML 整体替换，
 * 不追加），因此反复修改背景/文字色**不会堆积重复规则**；同时 epubjs 的 `overrides`
 * content 钩子会在每个新章节渲染时自动重新套用当前所有 override，无需手动重注入。
 */
const EPUB_THEME_RULES: Record<string, Record<string, string>> = {
  // body 过渡：背景/文字色切换时平滑过渡，避免生硬闪烁
  body: { transition: 'background-color 0.3s ease, color 0.3s ease' },
  // 夜间主题下链接用浅蓝，保证深色背景上的对比度（文字色由 override 控制，此处仅对 a 标签单独着色）
  'body.night a': { color: '#88aaff !important' },
};

/**
 * 注册 epubjs 主题样式（class 限定的兜底规则，见 EPUB_THEME_RULES 注释）
 *
 * 注意：这里注册的是 `default` 主题（而非三个独立主题）。
 * 「独立注册三个主题 + select() 切换」的官方用法存在样式表插入顺序缺陷
 * （详见 EPUB_THEME_RULES 注释），且每次 `select()` 都会通过 `insertRule`
 * 往对应节点**追加**规则，反复切换会无限堆积重复规则。
 * 合并到 `default` 后：规则每个 iframe 只注入一次，主题切换退化为纯 class 切换。
 *
 * 阅读区的背景色 / 背景图 / 文字色是随设置动态变化的，不在这里注册，
 * 改由 `applyReadingStyle()` 通过 `themes.override()` 注入。
 *
 * @param rend - epubjs Rendition 实例
 * @returns 无返回值
 */
function registerThemes(rend: Rendition) {
  rend.themes.default(EPUB_THEME_RULES);
}

/**
 * 按当前设置把「背景色 / 背景图 / 文字色」注入 epub 正文（iframe body）
 *
 * 通过 `themes.override('background'|'color', value, true)` 实现：
 * - epubjs 内部按 `name` 复用同一个 `<style>` 节点（innerHTML 整体替换），反复修改**不会堆积**规则；
 * - 第三个参数 `true` 让规则带 `!important`，稳稳压过电子书自带样式与 `body.<主题>` 兜底规则；
 * - epubjs 的 `overrides` content 钩子会在每个新章节渲染时自动重新套用当前 override，
 *   因此切章节无需手动重注入。
 *
 * 背景取值优先级：image 且已选图 → 背景图；color 且已选色 → 纯色；否则回退主题预设。
 * 文字色：自定义非空则用自定义，否则回退主题预设。
 *
 * @returns 无返回值
 */
function applyReadingStyle() {
  if (!rendition) return;
  const bg = resolveReadingBg(
    props.bgType ?? 'preset',
    props.bgColor ?? '',
    props.bgImage ?? '',
    props.theme
  );
  const text = resolveReadingText(props.textColor ?? '', props.theme);
  rendition.themes.override('background', bg, true);
  rendition.themes.override('color', text, true);
}

/**
 * 兜底同步 iframe body 上的主题 class：只保留当前主题，移除其余主题 class
 *
 * epubjs 的 `themes.select()` 只会移除「紧邻的上一个」主题 class；
 * 若切换与分节渲染时序错位（例如切主题的同时新章节正在渲染），
 * body 上可能同时残留两个主题 class，导致两条 `body.<主题>` 规则同时命中。
 * 此处显式做一次归一化，保证任意时刻 body 上有且仅有当前主题 class。
 *
 * @param theme - 当前阅读主题
 * @returns 无返回值
 */
function syncThemeClass(theme: EbookTheme) {
  const frames = readerRef.value?.querySelectorAll('iframe');
  frames?.forEach((frame) => {
    const body = frame.contentDocument?.body;
    if (!body) return;
    EPUB_THEME_NAMES.forEach((name) => {
      body.classList.toggle(name, name === theme);
    });
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
    // 渲染到容器：初始即应用翻页模式与分栏设置（flow/spread 在创建时设置最稳）
    rendition = book.renderTo(readerRef.value, {
      width: '100%',
      height: '100%',
      allowScriptedContent: true,
      flow: props.scrollMode ? 'scrolled' : 'paginated',
      spread: spreadValue(props.columnCount ?? 1),
    });

    // 注册并应用主题
    registerThemes(rendition);
    applyTheme(props.theme);
    applyFontSize(props.fontSize);
    applyFont();
    applyLineHeight();
    applyMargin();

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
    // 监听章节渲染完成：新章节会创建新的 iframe，此处再归一化一次主题 class，
    // 兜底 content 钩子与主题切换的时序竞态，保证新章节配色与当前所选主题一致
    rendition.on('rendered', () => syncThemeClass(props.theme));

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
 * 触发翻页过渡动画
 * 在 relocated 中、epubjs 已完成内容切换后调用。通过给阅读容器临时添加一次性
 * CSS 动画类实现「滑动 / 覆盖 / 3D 仿真」翻页效果。
 * - 仅当用户主动 prev/next（turnDirection 已设置）且 pageEffect !== 'none' 时生效；
 * - 滚动模式（scrolled）下分页不存在，跳过动画；
 * - 初始加载 / 目录跳转 / 笔记跳转不设置 turnDirection，故不触发动画。
 *
 * @returns 无返回值
 */
function playPageTurn(): void {
  const effect = settings.value.pageEffect;
  const dir = turnDirection.value;
  // 消费方向标记（无论是否触发动画都清空，避免下次 relocated 误用）
  turnDirection.value = null;
  if (effect === 'none' || !dir || props.scrollMode || !readerRef.value) return;

  const el = readerRef.value;
  // 所有可能的动画类，先统一移除并强制重排，确保动画可重复触发
  const allClasses = [
    'page-turn-slide-forward',
    'page-turn-slide-back',
    'page-turn-cover-forward',
    'page-turn-cover-back',
    'page-turn-flip3d-forward',
    'page-turn-flip3d-back',
  ];
  allClasses.forEach((c) => el.classList.remove(c));
  // 强制 reflow，使后续添加的类能重新触发动画
  void el.offsetWidth;
  const cls = `page-turn-${effect}-${dir}`;
  el.classList.add(cls);
  const onEnd = () => {
    el.classList.remove(cls);
    el.removeEventListener('animationend', onEnd);
  };
  el.addEventListener('animationend', onEnd);
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
  // 翻页/重排版后刷新页码信息（页码随字体/字号变化）
  updatePageInfo();
  // 触发翻页过渡动画（仅用户主动 prev/next 且开启了翻页效果时）
  playPageTurn();
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
    // 注意：book.spine.length 是数值属性（非函数），需直接取值（epubjs 类型定义缺失，用 any 断言）
    const total = typeof (book.spine as any).length === 'number' ? (book.spine as any).length : 0;
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
  // locations 就绪后页码信息也已可用，刷新一次
  updatePageInfo();
}

/**
 * 从 rendition.currentLocation() 解析出的 located 对象更新页码信息
 * epub.js 在分页模式（paginated）下，located.start.displayed 提供
 * 当前章节内的 { page, total }，会随字体/字号变化而重新分页
 *
 * @param loc - rendition.currentLocation() 解析后的 located 对象
 * @returns 无返回值
 */
function applyPageInfo(loc: any) {
  const start = loc?.start;
  if (!start || !start.displayed) return;
  const current = typeof start.displayed.page === 'number' ? start.displayed.page : 1;
  const total = typeof start.displayed.total === 'number' ? start.displayed.total : 1;
  if (total > 0) {
    pageInfo.value = { current, total };
  }
}

/**
 * 更新当前页码信息
 * rendition.currentLocation() 可能同步返回 located 对象，也可能返回 Promise，
 * 此处统一兼容两种情形
 *
 * @returns 无返回值
 */
function updatePageInfo() {
  if (!rendition) return;
  const loc = rendition.currentLocation();
  if (loc && typeof (loc as any).then === 'function') {
    (loc as any).then((result: any) => applyPageInfo(result)).catch(() => {});
  } else {
    applyPageInfo(loc);
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
    const cb = () => onHighlightClick(id, cfiRange, note);
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
 * 颜色与样式取自阅读设置 store（右上角「阅读设置」预设），无需在工具条上选择
 *
 * @returns 无返回值
 */
async function onToolbarHighlight(): Promise<void> {
  const sel = currentSelection.value;
  if (!sel) return;
  // 先清空选区状态并关闭工具条，避免 await 期间状态被重复使用
  const color = settings.value.highlightColor;
  const type = settings.value.highlightType;
  currentSelection.value = null;
  toolbarVisible.value = false;
  await addHighlight(sel.cfiRange, sel.text, '', color, type);
}

/**
 * 点击「笔记」按钮处理：先划线保存（note 为空），再弹输入框录入笔记
 * 用户取消输入则保留为纯划线；保存则调 updateAnnotation 更新 note
 * 颜色与样式取自阅读设置 store（右上角「阅读设置」预设）
 *
 * @returns 无返回值
 */
async function onToolbarNote(): Promise<void> {
  const sel = currentSelection.value;
  if (!sel) return;
  const color = settings.value.highlightColor;
  const type = settings.value.highlightType;
  currentSelection.value = null;
  toolbarVisible.value = false;
  // 先执行划线流程保存到数据库
  await addHighlight(sel.cfiRange, sel.text, '', color, type);
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
      color,
      type,
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
 * 点击已有高亮的回调
 * - 带笔记：直接打开笔记编辑弹窗（可在弹窗内删除划线）
 * - 纯划线：直接删除划线，无需连续弹窗
 * 由 addHighlight / loadAnnotations 中的高亮闭包调用
 *
 * @param id - 标注记录主键 id
 * @param cfiRange - 标注定位锚点（cfiRange）
 * @returns 无返回值
 */
function onHighlightClick(id: number, cfiRange: string, noteFromCb?: string): void {
  const annotation = annotations.value.find((a) => a.id === id);
  if (!annotation) return;
  // 优先用本地标注的 note，其次用点击回调携带的 note（创建高亮时即传入，
  // 防止本地 note 因刷新/重排等意外丢失时被误判为纯划线而直接删除）
  const hasNote = !!(annotation.note || noteFromCb);

  if (hasNote) {
    // 带笔记：直接进入笔记编辑弹窗
    editAnnotationNote(id);
  } else {
    // 纯划线：直接删除
    void removeHighlight(id, cfiRange);
  }
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
    // 阅读区划线删除前二次确认，避免误删（纯划线直接删除、笔记弹窗内删除均走此路径）
    await ElMessageBox.confirm('确认删除该划线？', '提示', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    // 用户取消删除，直接返回，不执行后续删除逻辑
    return;
  }
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
 * 打开笔记编辑弹窗
 * 供阅读区内点击带笔记的高亮、以及父组件笔记抽屉「编辑」按钮共用
 *
 * @param id - 标注记录主键 id
 * @returns 无返回值
 */
function editAnnotationNote(id: number): void {
  const annotation = annotations.value.find((a) => a.id === id);
  if (!annotation) return;
  currentEditAnnotationId.value = id;
  noteInput.value = annotation.note || '';
  noteDialogVisible.value = true;
}

/**
 * 保存当前弹窗中的笔记内容
 * 调用 IPC 更新数据库 → 同步本地 → 通知父组件 → 关闭弹窗
 *
 * @returns 无返回值
 */
async function saveNote(): Promise<void> {
  const id = currentEditAnnotationId.value;
  if (id === null) return;
  const annotation = annotations.value.find((a) => a.id === id);
  if (!annotation) return;

  try {
    const res = await window.ipcRenderer.ebook.updateAnnotation({
      id,
      note: noteInput.value,
      color: annotation.color || 'yellow',
      type: annotation.type || 'highlight',
    });
    if (!res?.success) {
      ElMessage.error(`保存笔记失败：${res?.error || '未知错误'}`);
      return;
    }
    annotation.note = noteInput.value;
    emit('annotations-updated', annotations.value);
    ElMessage.success('笔记已保存');
    noteDialogVisible.value = false;
  } catch (err) {
    console.error('保存笔记异常', err);
    ElMessage.error('保存笔记失败');
  }
}

/**
 * 删除当前正在编辑的标注（笔记弹窗底部「删除划线」按钮）
 * 移除数据库记录与 rendition 高亮 → 同步本地 → 通知父组件 → 关闭弹窗
 *
 * @returns 无返回值
 */
async function deleteCurrentAnnotation(): Promise<void> {
  const id = currentEditAnnotationId.value;
  if (id === null) return;
  const annotation = annotations.value.find((a) => a.id === id);
  if (!annotation) return;
  await removeHighlight(id, annotation.anchor);
  noteDialogVisible.value = false;
}

/**
 * 笔记编辑弹窗关闭后的清理工作
 *
 * @returns 无返回值
 */
function onNoteDialogClosed(): void {
  currentEditAnnotationId.value = null;
  noteInput.value = '';
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
        const cb = () => onHighlightClick(id, cfiRange, note);
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
  // 主题规则已随 default 主题注入（见 registerThemes），此处 select 的作用有两点：
  // 1. 把 epubjs 内部 _current 更新为当前主题，使后续新章节 iframe 在 content 钩子
  //    inject() 里自动获得 `contents.addClass(_current)`，避免翻章时闪一下无主题样式；
  // 2. 顺带在已渲染的 body 上完成 class 切换。
  // 由于 day/night/eye 并未作为独立主题注册，select 内部的 add() 会直接 return，
  // 因此不会重复注入 CSS，也不存在规则堆积。
  rendition.themes.select(theme);
  // 兜底归一化 body 主题 class，避免残留多个主题 class 造成两条规则同时命中
  syncThemeClass(theme);
  // 注入随设置动态变化的背景色 / 背景图 / 文字色（见 applyReadingStyle）
  applyReadingStyle();
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
    // 无自定义字体：移除覆盖以使用 epub 默认字体（epubjs 类型定义缺失，用 any 断言）
    (rendition.themes as any).removeOverride('font-family');
    return;
  }
  list.push('sans-serif');
  rendition.themes.font(list.join(', '));
}

/**
 * 将分栏数映射为 epub.js 的 spread 取值
 * - 1（单栏）→ 'none'：始终单页呈现
 * - ≥2（双栏）→ 'always'：在足够宽度下并排显示两页
 * 注：滚动模式（scrolled flow）下 spread 不生效，epub.js 强制单栏
 *
 * @param count - 分栏数
 * @returns epub.js spread 取值
 */
function spreadValue(count: number): 'none' | 'always' {
  return count >= 2 ? 'always' : 'none';
}

/**
 * 应用正文行距（line-height）
 * 通过 rendition.themes.override 注入 body 样式；行距变化会改变正文布局高度，
 * 调用方需随后 refreshAnnotations 以重新定位 SVG 标注
 *
 * @returns 无返回值
 */
function applyLineHeight() {
  if (!rendition) return;
  rendition.themes.override('line-height', `${props.lineHeight ?? 1.8}`);
}

/**
 * 应用页边距（margin）
 * 通过 rendition.themes.override 注入 body 样式；页边距变化会改变正文内容盒宽度与行数，
 * 调用方需随后 refreshAnnotations 以重新定位 SVG 标注
 *
 * @returns 无返回值
 */
function applyMargin() {
  if (!rendition) return;
  rendition.themes.override('margin', `${props.margin ?? 24}px`);
}

/**
 * 应用翻页模式与分栏（flow / spread）
 * 切换 flow（scrolled/paginated）或 spread（none/always）会触发 epub.js 整体重排版，
 * epub.js 会自行恢复当前阅读位置并重新注入 SVG 标注，因此此处无需手动 refreshAnnotations。
 *
 * @returns 无返回值
 */
function applyLayout() {
  if (!rendition) return;
  rendition.flow(props.scrollMode ? 'scrolled' : 'paginated');
  rendition.spread(spreadValue(props.columnCount ?? 1));
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
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
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
        const cb = () => onHighlightClick(ann.id, ann.anchor, ann.note);
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
    // 重排完成，刷新页码（字体/字号变化会改变分页，导致总页数变化）
    updatePageInfo();
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
  // 标记翻页方向，供 relocated 触发翻页动画（后/上一页）
  turnDirection.value = 'back';
  rendition.prev?.();
}

/**
 * 翻到下一页
 *
 * @returns 无返回值
 */
function nextPage() {
  if (!rendition) return;
  // 标记翻页方向，供 relocated 触发翻页动画（前/下一页）
  turnDirection.value = 'forward';
  rendition.next?.();
}

/**
 * 阅读区左侧边缘（10%）点击：上一页
 * 加载中或已无上一页时由底层 prevPage 内部处理
 *
 * @returns 无返回值
 */
function onEdgePrev() {
  if (loading.value) return;
  prevPage();
}

/**
 * 阅读区右侧边缘（10%）点击：下一页
 * 加载中或已无下一页时由底层 nextPage 内部处理
 *
 * @returns 无返回值
 */
function onEdgeNext() {
  if (loading.value) return;
  nextPage();
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

/** 重载防抖定时器 */
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
/** ResizeObserver 实例 */
let resizeObserver: ResizeObserver | null = null;
/** 是否已完成首次渲染（跳过初始挂载时的尺寸检测） */
let initialRenderDone = false;

/**
 * 阅读区尺寸/布局变化时重新加载电子书。
 * 侧边栏/顶部栏显隐、窗口缩放等场景会改变阅读区容器尺寸，
 * 触发 epubjs 重渲染以保持排版正确、避免数据错乱。
 *
 * 采用防抖（300ms）避免频繁重建；保存当前 CFI 并在重建后恢复阅读位置。
 */
function scheduleReload() {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    if (!props.filePath || !readerRef.value) return;
    const currentCfi = rendition?.location?.start?.cfi || '';
    // 销毁旧的 epubjs 实例（仅 book/rendition，标注/工具条状态由 renderEpub 内重新加载）
    if (rendition) {
      try { rendition.destroy(); } catch (e) { console.error(e); }
    }
    if (book) {
      try { book.destroy(); } catch (e) { console.error(e); }
    }
    rendition = null;
    book = null;
    locationsReady = false;
    // 重新渲染（内部完成主题、字号、翻页模式、标记等全部注册与恢复）
    await renderEpub(props.filePath);
    // 恢复到重载前的阅读位置（renderEpub 会重新给 rendition 赋值，但 TS 无法追踪，需断言）
    if (currentCfi && rendition) {
      try {
        (rendition as Rendition).display(currentCfi);
      } catch {
        (rendition as Rendition).display();
      }
    }
  }, 300);
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
// - editAnnotationNote：按 id 弹出输入框编辑笔记（笔记抽屉「编辑」调用）
defineExpose({ displayTarget, jumpToAnnotation, removeAnnotationById, editAnnotationNote });

// 监听文件路径变化，重新渲染
watch(
  () => props.filePath,
  (newPath) => {
    cleanup();
    progressText.value = '0%';
    pageInfo.value = { current: 1, total: 1 };
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

// 监听阅读区背景 / 文字色变化：重新注入动态背景色、背景图与文字色
// （override 按 name 复用同一节点，反复修改不堆积规则；新章节由 epubjs overrides 钩子自动重套用）
watch(
  () => [props.bgType, props.bgColor, props.bgImage, props.textColor],
  () => {
    applyReadingStyle();
  }
);

// 监听字体大小变化
watch(
  () => props.fontSize,
  (newSize) => {
    applyFontSize(newSize);
    // 字体大小改变会导致正文重排，已注册标注需重新定位，否则划线移位
    void refreshAnnotations();
    // 重排后分页变化，下一帧刷新页码（epub.js 重新分页后 relocated 也会再次校正）
    requestAnimationFrame(() => updatePageInfo());
  }
);

// 监听中/英文正文字体变化
watch(
  () => [props.fontFamily, props.fontFamilyEn],
  () => {
    applyFont();
    // 字体改变会导致正文重排，已注册标注需重新定位，否则划线移位
    void refreshAnnotations();
    // 重排后分页变化，下一帧刷新页码
    requestAnimationFrame(() => updatePageInfo());
  }
);

// 监听行距变化：改变布局高度，需重新定位已有标注
watch(
  () => props.lineHeight,
  (val) => {
    applyLineHeight();
    void refreshAnnotations();
    requestAnimationFrame(() => updatePageInfo());
  }
);

// 监听页边距变化：改变内容盒宽度与行数，需重新定位已有标注
watch(
  () => props.margin,
  (val) => {
    applyMargin();
    void refreshAnnotations();
    requestAnimationFrame(() => updatePageInfo());
  }
);

// 监听分栏变化：切换 spread，触发整体重排版（epub.js 自动恢复位置与标注）
watch(
  () => props.columnCount,
  () => {
    applyLayout();
  }
);

// 监听翻页模式变化：切换 flow，触发整体重排版（epub.js 自动恢复位置与标注）
watch(
  () => props.scrollMode,
  () => {
    applyLayout();
    // 滚动/翻页切换后分页信息可能不可用（滚动无页码），刷新一次页码状态
    requestAnimationFrame(() => updatePageInfo());
  }
);

onMounted(() => {
  if (props.filePath) {
    renderEpub(props.filePath).then(() => { initialRenderDone = true; });
  }
  // 注册键盘翻页监听
  window.addEventListener('keydown', handleKeydown);
  // ResizeObserver：监听阅读区容器尺寸变化（窗口缩放、侧边栏/顶部栏显隐等触发重载）
  resizeObserver = new ResizeObserver(() => {
    if (!initialRenderDone) return; // 跳过首次挂载时的尺寸检测
    scheduleReload();
  });
  if (readerRef.value) resizeObserver.observe(readerRef.value);
});

// 监听侧边栏和顶部栏的显隐：它们变化时阅读区容器尺寸改变，需重载排版
watch([sidebarVisible, topbarVisible], () => {
  if (!initialRenderDone) return;
  scheduleReload();
});

onUnmounted(() => {
  // 断开 ResizeObserver
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  // 清除重载防抖定时器
  if (reloadTimer) {
    clearTimeout(reloadTimer);
    reloadTimer = null;
  }
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
  /* 裁剪翻页动画（覆盖/3D 平移可能暂时超出容器），不裁剪 fixed 定位的浮动工具条 */
  overflow: hidden;
  box-sizing: border-box;
  transition: background-color 0.3s;

  /* 阅读区视口：包裹渲染容器与左右边缘点击区，作为定位上下文 */
  .epub-viewport {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .epub-viewer {
    width: 100%;
    height: 100%;
    overflow: hidden;
    /* 翻页动画基类：开启 GPU 合成，避免动画时重排抖动 */
    will-change: transform, opacity;
  }

  /* 阅读区左右边缘 10% 点击翻页区：透明覆盖层，点击上一页 / 下一页 */
  .edge-turn-zone {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 10%;
    z-index: 10;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;

    /* 悬停时显示淡淡的提示渐变，增强可发现性 */
    &::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 28px;
      height: 48px;
      transform: translateY(-50%);
      border-radius: 6px;
      opacity: 0;
      transition: opacity 0.18s ease;
      background: var(--bg-hover, rgba(0, 0, 0, 0.06));
      pointer-events: none;
    }

    &:hover::after {
      opacity: 1;
    }
  }

  .edge-turn-zone--left {
    left: 0;

    &::after {
      left: 8px;
    }
  }

  .edge-turn-zone--right {
    right: 0;

    &::after {
      right: 8px;
    }
  }

  /* ===== 翻页过渡动画（仅 epub 阅读器：滑动 / 覆盖 / 3D 仿真） ===== */
  /* 滑动：新页面从一侧滑入 */
  .page-turn-slide-forward {
    animation: page-slide-forward 0.32s cubic-bezier(0.22, 0.61, 0.36, 1);
  }
  .page-turn-slide-back {
    animation: page-slide-back 0.32s cubic-bezier(0.22, 0.61, 0.36, 1);
  }
  /* 覆盖：新页面从一侧覆盖进来（带左/右侧阴影模拟页缘） */
  .page-turn-cover-forward {
    animation: page-cover-forward 0.36s cubic-bezier(0.22, 0.61, 0.36, 1);
    box-shadow: -18px 0 28px -10px rgba(0, 0, 0, 0.28);
  }
  .page-turn-cover-back {
    animation: page-cover-back 0.36s cubic-bezier(0.22, 0.61, 0.36, 1);
    box-shadow: 18px 0 28px -10px rgba(0, 0, 0, 0.28);
  }
  /* 3D 仿真：绕 Y 轴翻入（仿纸质书翻页） */
  .page-turn-flip3d-forward {
    animation: page-flip3d-forward 0.42s cubic-bezier(0.22, 0.61, 0.36, 1);
    transform-origin: left center;
  }
  .page-turn-flip3d-back {
    animation: page-flip3d-back 0.42s cubic-bezier(0.22, 0.61, 0.36, 1);
    transform-origin: right center;
  }

  @keyframes page-slide-forward {
    from { transform: translateX(56px); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }
  @keyframes page-slide-back {
    from { transform: translateX(-56px); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }
  @keyframes page-cover-forward {
    from { transform: translateX(100%); }
    to   { transform: translateX(0); }
  }
  @keyframes page-cover-back {
    from { transform: translateX(-100%); }
    to   { transform: translateX(0); }
  }
  @keyframes page-flip3d-forward {
    from { transform: perspective(1500px) rotateY(-38deg) translateX(40px); opacity: 0.35; }
    to   { transform: perspective(1500px) rotateY(0) translateX(0); opacity: 1; }
  }
  @keyframes page-flip3d-back {
    from { transform: perspective(1500px) rotateY(38deg) translateX(-40px); opacity: 0.35; }
    to   { transform: perspective(1500px) rotateY(0) translateX(0); opacity: 1; }
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

    .page-text {
      font-size: 13px;
      color: var(--text-secondary);
      min-width: 56px;
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

/* 笔记编辑弹窗底部按钮布局：删除划线靠左，保存/取消靠右 */
:deep(.annotation-note-dialog) {
  .annotation-note-dialog-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;

    .dialog-footer-right {
      display: flex;
      gap: 8px;
    }
  }
}
</style>
