import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { getStore, setStore } from '@/utils/common';
import type { HighlightTypeName } from '@/views/ebookReader/highlightConfig';

/** 电子书文件格式类型：txt 文本、epub 电子书、pdf 文档，空字符串表示未打开任何文件 */
export type EbookFormat = 'txt' | 'epub' | 'pdf' | '';

/** 电子书阅读主题类型：day 白天、night 夜间、eye 护眼（控制外层工具栏/抽屉主题） */
export type EbookTheme = 'day' | 'night' | 'eye';

/** 阅读区背景类型：preset 跟随主题预设 / color 纯色 / image 背景图 */
export type EbookBgType = 'preset' | 'color' | 'image';

/** 当前打开的电子书文件信息 */
export interface EbookFile {
  /** 文件绝对路径 */
  path: string;
  /** 文件名（含扩展名） */
  name: string;
  /** 文件格式：txt、epub、pdf，空字符串表示未打开任何文件 */
  format: EbookFormat;
  /** 书籍标题（从 EPUB/PDF 元数据解析；空串表示回退文件名），用于阅读页头部与书架展示 */
  title?: string;
  /** 作者（从 EPUB/PDF 元数据解析；空串表示未知） */
  author?: string;
  /** 封面图 data URL（JPEG/PNG base64；空串表示无封面，回退占位） */
  cover?: string;
}

/** 阅读进度信息 */
export interface EbookProgress {
  /** epub.js 的 CFI 定位信息，用于 epub 精确定位章节与位置 */
  cfi: string;
  /** 阅读百分比进度，范围 0-100 */
  percent: number;
}

/** 单个标注类型的样式预设（按类型分别存储，切换类型即套用，无需每次重设） */
export interface AnnotationTypeStyle {
  /** 颜色（预设名或自定义 CSS 颜色） */
  color: string;
  /** 下划线 / 双下划线与文字的间隙（px，0 表示贴基线；高亮、删除线恒为 0） */
  underlineGap: number;
  /** 划线线宽（px，0 表示用背景填充；仅下划线 / 删除线 / 双下划线有效） */
  lineThickness: number;
  /** 高亮背景块上下外扩间距（px，仅高亮有效） */
  rowPaddingY: number;
}

/** 四种标注类型各自一份样式预设 */
export type AnnotationStyles = Record<HighlightTypeName, AnnotationTypeStyle>;

/** 阅读设置信息 */
export interface EbookSettings {
  /** 字体大小，单位 px */
  fontSize: number;
  /** 中文正文字体（CSS font-family 值，可为空字符串表示使用默认字体） */
  fontFamily: string;
  /** 英文正文字体（CSS font-family 值，可为空字符串表示使用默认字体） */
  fontFamilyEN: string;
  /** 阅读主题：day 白天、night 夜间、eye 护眼（控制外层工具栏/抽屉主题） */
  theme: EbookTheme;
  /** 阅读区背景类型：preset 跟随主题预设 / color 纯色 / image 背景图 */
  bgType: EbookBgType;
  /** 阅读区背景色（bgType 为 'color' 时生效，空字符串表示使用主题预设背景） */
  bgColor: string;
  /** 阅读区背景图 data URL（bgType 为 'image' 时生效，空字符串表示使用主题预设背景） */
  bgImage: string;
  /** 阅读区文字颜色（空字符串表示使用主题预设文字色） */
  textColor: string;
  /** 行距倍率（作用于正文 line-height），如 1.8 表示 1.8 倍行距 */
  lineHeight: number;
  /** 分栏数：1 单栏、2 双栏（epub 由 spread 控制，txt 由 CSS column-count 控制） */
  columnCount: number;
  /** 翻页模式：false=翻页（paginated），true=滚动（scrolled），仅 epub 生效 */
  scrollMode: boolean;
  /** 页边距，单位 px（作用于正文外边距） */
  margin: number;
  /** 当前默认标注类型：'highlight'（高亮）、'underline'（下划线）、'mark'（删除线）、'markStrong'（双下划线），由右上角「阅读设置」预设；新建标注即按此类型 */
  highlightType: string;
  /** 按标注类型分别存储的样式预设（颜色 / 划线间隙 / 线宽 / 高亮行间距），切换类型即套用对应预设 */
  annotationStyles: AnnotationStyles;
  /** 翻页效果：'none'（瞬时）、'slide'（滑动）、'cover'（覆盖）、'flip3d'（3D 仿真），仅 epub 生效 */
  pageEffect: 'none' | 'slide' | 'cover' | 'flip3d';
  /** 是否显示阅读页顶部工具栏 */
  readerTopbarVisible: boolean;
  /** 是否显示阅读页底部翻页栏 */
  readerBottomBarVisible: boolean;
  /** 是否启用阅读区左右边缘点击翻页（点击边缘区域上一页/下一页，便于沉浸式翻页） */
  edgeClickEnabled: boolean;
  /** 边缘点击翻页的感应区宽度百分比（阅读区左右各占该百分比），范围 2-40，默认 10 */
  edgeClickPercent: number;
  /** 是否启用鼠标滚轮翻页（在阅读区滚动滚轮上一页/下一页） */
  wheelPageEnabled: boolean;
  /** 鼠标滚轮翻页灵敏度（1-10，越大越灵敏、滚动距离越小即翻页），默认 5 */
  wheelPageSensitivity: number;
  /** 字间距，单位 px（0 表示不额外加宽），仅 epub 生效 */
  letterSpacing: number;
  /** 段间距，单位 px（段落之间的额外间距，0 表示使用默认），仅 epub 生效 */
  paragraphSpacing: number;
  /** 首行缩进，单位 em（0 表示不缩进），仅 epub 生效 */
  firstLineIndent: number;
  /** PDF 适应方式：'width' 适应宽度（缩放使页宽撑满阅读区）/ 'height' 适应高度（缩放使单页高度≈视口高，一屏一页），pdf 阅读器生效 */
  pdfFitMode: 'width' | 'height';
}

/**
 * 由本地存储数据构建「按格式分别存储」的设置映射（txt / epub / pdf 各自一套）。
 * - 已是新格式（含 txt/epub/pdf 键）：逐格式与默认值合并，补全缺失字段。
 * - 旧格式（单一扁平对象）：作为三种格式的共同初始值，避免老用户既有设置丢失。
 * - 其它（无数据/非法）：三种格式均使用默认值。
 */
function buildSettingsMap(stored: any): Record<'txt' | 'epub' | 'pdf', EbookSettings> {
  const formats: ('txt' | 'epub' | 'pdf')[] = ['txt', 'epub', 'pdf'];
  const map = {} as Record<'txt' | 'epub' | 'pdf', EbookSettings>;
  const isMap =
    stored && typeof stored === 'object' &&
    (('txt' in stored) || ('epub' in stored) || ('pdf' in stored));
  const isFlat = stored && typeof stored === 'object' && typeof stored.fontSize === 'number';
  for (const f of formats) {
    const base = isMap && stored[f] ? stored[f] : isFlat ? stored : undefined;
    const merged: EbookSettings = { ...DEFAULT_SETTINGS, ...(base || {}) };
    // 旧数据（无按类型样式预设）迁移：把原全局划线颜色/间隙/线宽/行距回填到「对应类型」预设，其余用默认，
    // 保证老用户既有外观不丢；已有 annotationStyles 则确保是独立副本（不与默认值/其它格式共享引用）。
    if (base && !base.annotationStyles) {
      merged.annotationStyles = JSON.parse(JSON.stringify(DEFAULT_ANNOTATION_STYLES));
      const oldType = (base.highlightType as HighlightTypeName) || 'highlight';
      if (base.highlightColor) merged.annotationStyles[oldType].color = base.highlightColor;
      if (typeof base.underlineGap === 'number') {
        merged.annotationStyles.underline.underlineGap = base.underlineGap;
        merged.annotationStyles.markStrong.underlineGap = base.underlineGap;
      }
      if (typeof base.hlLineThickness === 'number') {
        merged.annotationStyles.underline.lineThickness = base.hlLineThickness;
        merged.annotationStyles.mark.lineThickness = base.hlLineThickness;
        merged.annotationStyles.markStrong.lineThickness = base.hlLineThickness;
      }
      if (typeof base.hlRowPaddingY === 'number') {
        merged.annotationStyles.highlight.rowPaddingY = base.hlRowPaddingY;
      }
    } else {
      merged.annotationStyles = merged.annotationStyles
        ? JSON.parse(JSON.stringify(merged.annotationStyles))
        : JSON.parse(JSON.stringify(DEFAULT_ANNOTATION_STYLES));
    }
    map[f] = merged;
  }
  return map;
}

/** 书架条目信息（前端使用 camelCase，对应数据库 ebook_bookshelf 表的一行） */
export interface BookshelfItem {
  /** 文件绝对路径（主键） */
  path: string;
  /** 文件名（含扩展名） */
  name: string;
  /** 文件格式：'txt'、'epub' 或 'pdf' */
  format: string;
  /** 阅读百分比 0-100 */
  percent: number;
  /** 上次阅读时间（ISO 字符串） */
  lastReadAt: string;
  /** 首次添加时间（ISO 字符串） */
  addedAt: string;
  /** 书籍标题（从 EPUB/PDF 元数据解析；空串表示回退文件名） */
  title?: string;
  /** 作者（从 EPUB/PDF 元数据解析；空串表示未知） */
  author?: string;
  /** 封面图 data URL（JPEG/PNG base64；空串表示无封面，回退占位） */
  cover?: string;
}

/** 持久化存储键名：阅读设置 */
const SETTINGS_KEY = 'ebookReaderSettings';
/** 持久化存储键名：当前打开的文件 */
const CURRENT_FILE_KEY = 'ebookReaderCurrentFile';
/** 持久化存储键名：阅读进度（全局，最近一本书） */
const PROGRESS_KEY = 'ebookReaderProgress';
/** 持久化存储键名：每本书的阅读进度映射（path -> {cfi, percent}），按书去重、同步落库，避免退出时 IPC 丢失 */
const PROGRESS_MAP_KEY = 'ebookReaderProgressMap';

/** 按标注类型的默认样式预设（四种类型各自一份；高亮默认黄、下划线默认蓝、删除线默认红、双下划线默认绿） */
const DEFAULT_ANNOTATION_STYLES: AnnotationStyles = {
  highlight: { color: 'yellow', underlineGap: 0, lineThickness: 0, rowPaddingY: 2 },
  underline: { color: 'blue', underlineGap: 2, lineThickness: 2, rowPaddingY: 0 },
  mark: { color: 'red', underlineGap: 0, lineThickness: 2, rowPaddingY: 0 },
  markStrong: { color: 'green', underlineGap: 2, lineThickness: 2, rowPaddingY: 0 },
};

/** 阅读设置默认值 */
const DEFAULT_SETTINGS: EbookSettings = {
  fontSize: 16,
  fontFamily: '',
  fontFamilyEN: '',
  theme: 'day',
  bgType: 'preset',
  bgColor: '',
  bgImage: '',
  textColor: '',
  lineHeight: 1.8,
  columnCount: 1,
  scrollMode: false,
  margin: 24,
  highlightType: 'highlight',
  annotationStyles: DEFAULT_ANNOTATION_STYLES,
  pageEffect: 'none',
  readerTopbarVisible: true,
  readerBottomBarVisible: true,
  edgeClickEnabled: true,
  edgeClickPercent: 10,
  wheelPageEnabled: false,
  wheelPageSensitivity: 5,
  letterSpacing: 0,
  paragraphSpacing: 0,
  firstLineIndent: 0,
  pdfFitMode: 'width',
};

export default defineStore('ebook-reader', () => {
  // 当前打开的文件，从本地存储恢复，默认未打开（format 为空字符串）
  const storedFile = getStore(CURRENT_FILE_KEY) as EbookFile | undefined;
  const currentFile = ref<EbookFile>(
    storedFile && typeof storedFile.path === 'string' ? storedFile : { path: '', name: '', format: '' }
  );

  // 当前阅读进度，从本地存储恢复，默认从 0 开始
  const storedProgress = getStore(PROGRESS_KEY) as EbookProgress | undefined;
  const progress = ref<EbookProgress>(
    storedProgress && typeof storedProgress.percent === 'number'
      ? storedProgress
      : { cfi: '', percent: 0 }
  );

  // 每本书的阅读进度映射（path -> {cfi, percent}），从本地存储恢复，用于退出/切书时按书精确恢复，
  // 且作为数据库进度的最终兜底（IPC 在进程退出时可能来不及落库，本地映射是同步写入的）。
  const storedProgressMap = getStore(PROGRESS_MAP_KEY) as Record<string, EbookProgress> | undefined;
  const progressMap = ref<Record<string, EbookProgress>>(
    storedProgressMap && typeof storedProgressMap === 'object' ? storedProgressMap : {}
  );

  // 阅读设置：按格式分别独立存储（txt / epub / pdf 各自一套），避免跨格式相互覆盖或重置。
  // 内存中以 settingsMap 保存每种格式的设置对象，settings 始终指向「当前格式」的那一份；
  // 切换当前书籍格式时整体替换 settings.value（引用切换），对阅读组件透明。
  const storedSettings = getStore(SETTINGS_KEY);
  const settingsMap = ref<Record<'txt' | 'epub' | 'pdf', EbookSettings>>(buildSettingsMap(storedSettings));

  /** 读取当前书籍格式（无打开书籍或格式为空时回退为 txt） */
  function activeFormat(): 'txt' | 'epub' | 'pdf' {
    const f = currentFile.value?.format;
    return f === 'txt' || f === 'epub' || f === 'pdf' ? f : 'txt';
  }

  /**
   * 将完整的「按格式设置映射」持久化到本地存储。
   * 各 setXxx 设置项改完 settings.value 后调用，保证三种格式各自独立落库。
   */
  function persistSettings() {
    setStore(SETTINGS_KEY, settingsMap.value);
  }

  // settings 始终指向当前格式的设置对象（与 settingsMap[activeFormat] 同一引用）
  const settings = ref<EbookSettings>(settingsMap.value[activeFormat()] ?? { ...DEFAULT_SETTINGS });

  // 打开书籍（currentFile.format 变化）时切换当前设置对象到对应格式，并落库（保存上一格式已改内容）
  watch(
    () => currentFile.value?.format,
    () => {
      const f = activeFormat();
      if (!settingsMap.value[f]) {
        settingsMap.value = { ...settingsMap.value, [f]: { ...DEFAULT_SETTINGS } };
      }
      // 仅当目标格式对象与当前不同才替换，避免无谓的引用变更与重渲染
      if (settings.value !== settingsMap.value[f]) {
        settings.value = settingsMap.value[f];
      }
      persistSettings();
    }
  );

  // 书架列表，默认空数组；不做本地持久化，每次组件挂载时从数据库加载
  const bookshelf = ref<BookshelfItem[]>([]);

  /**
   * 设置当前打开的电子书文件，并同步持久化到本地存储
   * @param file 电子书文件信息，包含路径、名称、格式
   * @returns 无返回值
   */
  function setCurrentFile(file: EbookFile) {
    currentFile.value = file;
    setStore(CURRENT_FILE_KEY, file);
  }

  /**
   * 设置当前阅读进度，并同步持久化到本地存储
   * @param val 阅读进度信息，包含 CFI 定位与百分比
   * @returns 无返回值
   */
  function setProgress(val: EbookProgress) {
    progress.value = val;
    setStore(PROGRESS_KEY, val);
  }

  /**
   * 按文件路径写入该书独立的阅读进度（同步持久化到本地映射）。
   * 与全局 progress 解耦，保证每本书各自记住位置；并在数据库 IPC 因进程退出来不及落库时作为兜底。
   * @param path 电子书文件绝对路径
   * @param val 阅读进度（cfi 定位 + 百分比）
   * @returns 无返回值
   */
  function setBookProgress(path: string, val: EbookProgress) {
    if (!path) return;
    progressMap.value = { ...progressMap.value, [path]: val };
    setStore(PROGRESS_MAP_KEY, progressMap.value);
  }

  /**
   * 读取某本书独立保存的阅读进度（本地映射兜底，不触发 IPC）
   * @param path 电子书文件绝对路径
   * @returns 该书进度；无记录返回 undefined
   */
  function getBookProgress(path: string): EbookProgress | undefined {
    if (!path) return undefined;
    return progressMap.value[path];
  }

  /**
   * 设置阅读字体大小，并同步持久化到本地存储
   * @param size 字体大小，单位 px
   * @returns 无返回值
   */
  function setFontSize(size: number) {
    settings.value.fontSize = size;
    persistSettings();
  }

  /**
   * 设置阅读主题，并同步持久化到本地存储
   * @param theme 阅读主题：day 白天、night 夜间、eye 护眼
   * @returns 无返回值
   */
  function setTheme(theme: EbookTheme) {
    settings.value.theme = theme;
    persistSettings();
  }

  /**
   * 设置阅读区背景类型（preset 跟随主题 / color 纯色 / image 背景图）并持久化
   * @param value 背景类型
   * @returns 无返回值
   */
  function setBgType(value: EbookBgType) {
    settings.value.bgType = value;
    persistSettings();
  }

  /**
   * 设置阅读区背景色（bgType 为 'color' 时生效）并持久化
   * @param value CSS 颜色字符串（空字符串表示使用主题预设背景）
   * @returns 无返回值
   */
  function setBgColor(value: string) {
    settings.value.bgColor = value;
    persistSettings();
  }

  /**
   * 设置阅读区背景图（bgType 为 'image' 时生效，存储为 data URL）并持久化
   * @param value 背景图 data URL（空字符串表示使用主题预设背景）
   * @returns 无返回值
   */
  function setBgImage(value: string) {
    settings.value.bgImage = value;
    persistSettings();
  }

  /**
   * 设置阅读区文字颜色并持久化
   * @param value CSS 颜色字符串（空字符串表示使用主题预设文字色）
   * @returns 无返回值
   */
  function setTextColor(value: string) {
    settings.value.textColor = value;
    persistSettings();
  }

  /**
   * 设置中文正文字体，并同步持久化到本地存储
   * @param value CSS font-family 值（空字符串表示使用默认字体）
   * @returns 无返回值
   */
  function setFontFamily(value: string) {
    settings.value.fontFamily = value;
    persistSettings();
  }

  /**
   * 设置英文正文字体，并同步持久化到本地存储
   * @param value CSS font-family 值（空字符串表示使用默认字体）
   * @returns 无返回值
   */
  function setFontFamilyEN(value: string) {
    settings.value.fontFamilyEN = value;
    persistSettings();
  }

  /**
   * 设置正文行距倍率，并同步持久化到本地存储
   * @param value 行距倍率（如 1.8）
   * @returns 无返回值
   */
  function setLineHeight(value: number) {
    settings.value.lineHeight = value;
    persistSettings();
  }

  /**
   * 设置分栏数（1 单栏 / 2 双栏），并同步持久化到本地存储
   * @param value 分栏数
   * @returns 无返回值
   */
  function setColumnCount(value: number) {
    settings.value.columnCount = value;
    persistSettings();
  }

  /**
   * 设置翻页模式，并同步持久化到本地存储
   * @param value true=滚动，false=翻页
   * @returns 无返回值
   */
  function setScrollMode(value: boolean) {
    settings.value.scrollMode = value;
    persistSettings();
  }

  /**
   * 设置页边距（px），并同步持久化到本地存储
   * @param value 页边距数值
   * @returns 无返回值
   */
  function setMargin(value: number) {
    settings.value.margin = value;
    persistSettings();
  }

  /**
   * 设置某标注类型的样式预设（颜色 / 间隙 / 线宽 / 行距），并同步持久化到本地存储，
   * 按格式分别存储（txt / epub / pdf 各自一份）。切换标注类型即套用对应预设，无需每次重设。
   * @param type 标注类型（'highlight' | 'underline' | 'mark' | 'markStrong'）
   * @param patch 要更新的样式字段（部分）
   * @returns 无返回值
   */
  function setAnnotationStyle(type: HighlightTypeName, patch: Partial<AnnotationTypeStyle>) {
    const styles = settings.value.annotationStyles;
    if (!styles[type]) styles[type] = { ...DEFAULT_ANNOTATION_STYLES[type] };
    styles[type] = { ...styles[type], ...patch };
    persistSettings();
  }

  /**
   * 设置划线默认类型，并同步持久化到本地存储
   * 选中文本后点击「划线/笔记」即按此样式标注
   * @param value 划线类型（'highlight' | 'underline' | 'mark' | 'markStrong'）
   * @returns 无返回值
   */
  function setHighlightType(value: string) {
    settings.value.highlightType = value;
    persistSettings();
  }

  /**
   * 设置字间距（px），并同步持久化到本地存储，仅 epub 生效
   * @param value 字间距数值（0 表示不额外加宽）
   * @returns 无返回值
   */
  function setLetterSpacing(value: number) {
    settings.value.letterSpacing = value;
    persistSettings();
  }

  /**
   * 设置段间距（px），并同步持久化到本地存储，仅 epub 生效
   * @param value 段间距数值（0 表示使用默认）
   * @returns 无返回值
   */
  function setParagraphSpacing(value: number) {
    settings.value.paragraphSpacing = value;
    persistSettings();
  }

  /**
   * 设置首行缩进（em），并同步持久化到本地存储，仅 epub 生效
   * @param value 首行缩进数值（0 表示不缩进）
   * @returns 无返回值
   */
  function setFirstLineIndent(value: number) {
    settings.value.firstLineIndent = value;
    persistSettings();
  }

  // 划线间隙 / 线宽 / 行距已并入「按标注类型样式预设」（setAnnotationStyle），不再作为全局设置项

  /**
   * 设置 PDF 适应方式并持久化到本地存储，pdf 阅读器生效
   * @param value 'width' 适应宽度 / 'height' 适应高度
   * @returns 无返回值
   */
  function setPdfFitMode(value: 'width' | 'height') {
    settings.value.pdfFitMode = value;
    persistSettings();
  }

  /**
   * 设置翻页效果并持久化到本地存储，仅 epub 阅读器生效
   * @param value 翻页效果（'none' | 'slide' | 'cover' | 'flip3d'）
   * @returns 无返回值
   */
  function setPageEffect(value: 'none' | 'slide' | 'cover' | 'flip3d') {
    settings.value.pageEffect = value;
    persistSettings();
  }

  /** 设置阅读页顶部工具栏显隐 */
  function setReaderTopbarVisible(value: boolean) {
    settings.value.readerTopbarVisible = value;
    persistSettings();
  }

  /** 设置阅读页底部翻页栏显隐 */
  function setReaderBottomBarVisible(value: boolean) {
    settings.value.readerBottomBarVisible = value;
    persistSettings();
  }

  /** 设置是否启用阅读区左右边缘点击翻页并持久化 */
  function setEdgeClickEnabled(value: boolean) {
    settings.value.edgeClickEnabled = value;
    persistSettings();
  }

  /** 设置边缘点击翻页感应区宽度百分比并持久化（范围 2-40） */
  function setEdgeClickPercent(value: number) {
    settings.value.edgeClickPercent = value;
    persistSettings();
  }

  /** 设置是否启用鼠标滚轮翻页并持久化 */
  function setWheelPageEnabled(value: boolean) {
    settings.value.wheelPageEnabled = value;
    persistSettings();
  }

  /** 设置鼠标滚轮翻页灵敏度并持久化（范围 1-10） */
  function setWheelPageSensitivity(value: number) {
    settings.value.wheelPageSensitivity = value;
    persistSettings();
  }

  /**
   * 从数据库加载书架列表，把数据库记录（snake_case）映射为 BookshelfItem（camelCase）
   * 失败时打印错误日志，bookshelf 保持原值（空数组）
   * @returns 无返回值
   */
  async function loadBookshelf() {
    try {
      const res = await window.ipcRenderer.ebook.getBookshelf();
      if (res && res.success && Array.isArray(res.data)) {
        bookshelf.value = res.data.map((row) => ({
          path: row.file_path,
          name: row.name,
          format: row.format,
          percent: row.percent,
          lastReadAt: row.last_read_at,
          addedAt: row.added_at,
          title: row.title,
          author: row.author,
          cover: row.cover,
        }));
      } else if (res && !res.success) {
        console.error('加载书架列表失败：', res.error);
      }
    } catch (err) {
      console.error('加载书架列表异常：', err);
    }
  }

  /**
   * 添加或更新书架记录，成功后重新加载书架列表以保证与数据库一致
   * @param item 书架条目信息（前端 camelCase），包含 path、name、format、percent
   * @returns 无返回值
   */
  async function addToBookshelf(item: BookshelfItem) {
    try {
      const res = await window.ipcRenderer.ebook.addToBookshelf({
        filePath: item.path,
        name: item.name,
        format: item.format,
        percent: item.percent,
      });
      if (res && res.success) {
        // 刷新书架列表，保证与数据库一致
        await loadBookshelf();
      } else if (res && !res.success) {
        console.error('添加书架记录失败：', res.error);
      }
    } catch (err) {
      console.error('添加书架记录异常：', err);
    }
  }

  /**
   * 按 filePath 删除书架记录，成功后从本地 bookshelf 中过滤掉该项（无需重新加载）
   * @param filePath 必填参数，电子书文件绝对路径
   * @returns 无返回值
   */
  async function removeFromBookshelf(filePath: string) {
    try {
      const res = await window.ipcRenderer.ebook.removeFromBookshelf(filePath);
      if (res && res.success) {
        // 本地移除，无需重新 loadBookshelf
        bookshelf.value = bookshelf.value.filter((item) => item.path !== filePath);
      } else if (res && !res.success) {
        console.error('删除书架记录失败：', res.error);
      }
    } catch (err) {
      console.error('删除书架记录异常：', err);
    }
  }

  return {
    // 当前打开的文件
    currentFile,
    // 当前阅读进度
    progress,
    // 阅读设置
    settings,
    // 书架列表
    bookshelf,
    // 设置当前文件
    setCurrentFile,
    // 设置阅读进度
    setProgress,
    // 按书设置/读取阅读进度（本地映射兜底）
    setBookProgress,
    getBookProgress,
    // 设置字体大小
    setFontSize,
    // 设置阅读主题
    setTheme,
    // 设置阅读区背景类型 / 背景色 / 背景图 / 文字颜色
    setBgType,
    setBgColor,
    setBgImage,
    setTextColor,
    // 设置中文正文字体
    setFontFamily,
    // 设置英文正文字体
    setFontFamilyEN,
    // 设置正文行距
    setLineHeight,
    // 设置分栏数
    setColumnCount,
    // 设置翻页模式
    setScrollMode,
    // 设置页边距
    setMargin,
    // 设置标注类型样式预设（按类型分别存储）
    setAnnotationStyle,
    // 设置默认标注类型
    setHighlightType,
    // 设置翻页效果（仅 epub 生效）
    setPageEffect,
    // 设置阅读页顶部工具栏显隐
    setReaderTopbarVisible,
    // 设置阅读页底部翻页栏显隐
    setReaderBottomBarVisible,
    // 设置是否启用阅读区左右边缘点击翻页
    setEdgeClickEnabled,
    // 设置边缘点击翻页感应区宽度百分比
    setEdgeClickPercent,
    // 设置是否启用鼠标滚轮翻页
    setWheelPageEnabled,
    // 设置鼠标滚轮翻页灵敏度
    setWheelPageSensitivity,
    // 设置字间距（仅 epub 生效）
    setLetterSpacing,
    // 设置段间距（仅 epub 生效）
    setParagraphSpacing,
    // 设置首行缩进（仅 epub 生效）
    setFirstLineIndent,
    // 设置 PDF 适应方式（pdf 阅读器生效）
    setPdfFitMode,
    // 加载书架列表
    loadBookshelf,
    // 添加或更新书架记录
    addToBookshelf,
    // 删除书架记录
    removeFromBookshelf,
  };
});
