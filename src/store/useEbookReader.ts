import { ref } from 'vue';
import { defineStore } from 'pinia';
import { getStore, setStore } from '@/utils/common';

/** 电子书文件格式类型：txt 文本、epub 电子书，空字符串表示未打开任何文件 */
export type EbookFormat = 'txt' | 'epub' | '';

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
  /** 文件格式：txt、epub，空字符串表示未打开任何文件 */
  format: EbookFormat;
}

/** 阅读进度信息 */
export interface EbookProgress {
  /** epub.js 的 CFI 定位信息，用于 epub 精确定位章节与位置 */
  cfi: string;
  /** 阅读百分比进度，范围 0-100 */
  percent: number;
}

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
  /** 划线默认颜色标识（如 'yellow'、'green'、'blue' 等），由右上角「阅读设置」预设 */
  highlightColor: string;
  /** 划线默认类型：'highlight'（高亮）、'underline'（下划线）、'wavy'（波浪线），由右上角「阅读设置」预设 */
  highlightType: string;
  /** 翻页效果：'none'（瞬时）、'slide'（滑动）、'cover'（覆盖）、'flip3d'（3D 仿真），仅 epub 生效 */
  pageEffect: 'none' | 'slide' | 'cover' | 'flip3d';
  /** 是否显示阅读页顶部工具栏 */
  readerTopbarVisible: boolean;
  /** 是否显示阅读页底部翻页栏 */
  readerBottomBarVisible: boolean;
}

/** 书架条目信息（前端使用 camelCase，对应数据库 ebook_bookshelf 表的一行） */
export interface BookshelfItem {
  /** 文件绝对路径（主键） */
  path: string;
  /** 文件名（含扩展名） */
  name: string;
  /** 文件格式：'txt' 或 'epub' */
  format: string;
  /** 阅读百分比 0-100 */
  percent: number;
  /** 上次阅读时间（ISO 字符串） */
  lastReadAt: string;
  /** 首次添加时间（ISO 字符串） */
  addedAt: string;
}

/** 持久化存储键名：阅读设置 */
const SETTINGS_KEY = 'ebookReaderSettings';
/** 持久化存储键名：当前打开的文件 */
const CURRENT_FILE_KEY = 'ebookReaderCurrentFile';
/** 持久化存储键名：阅读进度 */
const PROGRESS_KEY = 'ebookReaderProgress';

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
  highlightColor: 'yellow',
  highlightType: 'highlight',
  pageEffect: 'none',
  readerTopbarVisible: true,
  readerBottomBarVisible: true,
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

  // 阅读设置，从本地存储恢复，否则使用默认值
  const storedSettings = getStore(SETTINGS_KEY) as EbookSettings | undefined;
  const settings = ref<EbookSettings>(
    storedSettings && typeof storedSettings.fontSize === 'number' && storedSettings.theme
      ? { ...DEFAULT_SETTINGS, ...storedSettings }
      : { ...DEFAULT_SETTINGS }
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
   * 设置阅读字体大小，并同步持久化到本地存储
   * @param size 字体大小，单位 px
   * @returns 无返回值
   */
  function setFontSize(size: number) {
    settings.value.fontSize = size;
    setStore(SETTINGS_KEY, settings.value);
  }

  /**
   * 设置阅读主题，并同步持久化到本地存储
   * @param theme 阅读主题：day 白天、night 夜间、eye 护眼
   * @returns 无返回值
   */
  function setTheme(theme: EbookTheme) {
    settings.value.theme = theme;
    setStore(SETTINGS_KEY, settings.value);
  }

  /**
   * 设置阅读区背景类型（preset 跟随主题 / color 纯色 / image 背景图）并持久化
   * @param value 背景类型
   * @returns 无返回值
   */
  function setBgType(value: EbookBgType) {
    settings.value.bgType = value;
    setStore(SETTINGS_KEY, settings.value);
  }

  /**
   * 设置阅读区背景色（bgType 为 'color' 时生效）并持久化
   * @param value CSS 颜色字符串（空字符串表示使用主题预设背景）
   * @returns 无返回值
   */
  function setBgColor(value: string) {
    settings.value.bgColor = value;
    setStore(SETTINGS_KEY, settings.value);
  }

  /**
   * 设置阅读区背景图（bgType 为 'image' 时生效，存储为 data URL）并持久化
   * @param value 背景图 data URL（空字符串表示使用主题预设背景）
   * @returns 无返回值
   */
  function setBgImage(value: string) {
    settings.value.bgImage = value;
    setStore(SETTINGS_KEY, settings.value);
  }

  /**
   * 设置阅读区文字颜色并持久化
   * @param value CSS 颜色字符串（空字符串表示使用主题预设文字色）
   * @returns 无返回值
   */
  function setTextColor(value: string) {
    settings.value.textColor = value;
    setStore(SETTINGS_KEY, settings.value);
  }

  /**
   * 设置中文正文字体，并同步持久化到本地存储
   * @param value CSS font-family 值（空字符串表示使用默认字体）
   * @returns 无返回值
   */
  function setFontFamily(value: string) {
    settings.value.fontFamily = value;
    setStore(SETTINGS_KEY, settings.value);
  }

  /**
   * 设置英文正文字体，并同步持久化到本地存储
   * @param value CSS font-family 值（空字符串表示使用默认字体）
   * @returns 无返回值
   */
  function setFontFamilyEN(value: string) {
    settings.value.fontFamilyEN = value;
    setStore(SETTINGS_KEY, settings.value);
  }

  /**
   * 设置正文行距倍率，并同步持久化到本地存储
   * @param value 行距倍率（如 1.8）
   * @returns 无返回值
   */
  function setLineHeight(value: number) {
    settings.value.lineHeight = value;
    setStore(SETTINGS_KEY, settings.value);
  }

  /**
   * 设置分栏数（1 单栏 / 2 双栏），并同步持久化到本地存储
   * @param value 分栏数
   * @returns 无返回值
   */
  function setColumnCount(value: number) {
    settings.value.columnCount = value;
    setStore(SETTINGS_KEY, settings.value);
  }

  /**
   * 设置翻页模式，并同步持久化到本地存储
   * @param value true=滚动，false=翻页
   * @returns 无返回值
   */
  function setScrollMode(value: boolean) {
    settings.value.scrollMode = value;
    setStore(SETTINGS_KEY, settings.value);
  }

  /**
   * 设置页边距（px），并同步持久化到本地存储
   * @param value 页边距数值
   * @returns 无返回值
   */
  function setMargin(value: number) {
    settings.value.margin = value;
    setStore(SETTINGS_KEY, settings.value);
  }

  /**
   * 设置划线默认颜色，并同步持久化到本地存储
   * 选中文本后点击「划线/笔记」即按此颜色标注
   * @param value 颜色标识（如 'yellow'、'green'）
   * @returns 无返回值
   */
  function setHighlightColor(value: string) {
    settings.value.highlightColor = value;
    setStore(SETTINGS_KEY, settings.value);
  }

  /**
   * 设置划线默认类型，并同步持久化到本地存储
   * 选中文本后点击「划线/笔记」即按此样式标注
   * @param value 划线类型（'highlight' | 'underline' | 'wavy'）
   * @returns 无返回值
   */
  function setHighlightType(value: string) {
    settings.value.highlightType = value;
    setStore(SETTINGS_KEY, settings.value);
  }

  /**
   * 设置翻页效果并持久化到本地存储，仅 epub 阅读器生效
   * @param value 翻页效果（'none' | 'slide' | 'cover' | 'flip3d'）
   * @returns 无返回值
   */
  function setPageEffect(value: 'none' | 'slide' | 'cover' | 'flip3d') {
    settings.value.pageEffect = value;
    setStore(SETTINGS_KEY, settings.value);
  }

  /** 设置阅读页顶部工具栏显隐 */
  function setReaderTopbarVisible(value: boolean) {
    settings.value.readerTopbarVisible = value;
    setStore(SETTINGS_KEY, settings.value);
  }

  /** 设置阅读页底部翻页栏显隐 */
  function setReaderBottomBarVisible(value: boolean) {
    settings.value.readerBottomBarVisible = value;
    setStore(SETTINGS_KEY, settings.value);
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
    // 设置划线默认颜色
    setHighlightColor,
    // 设置划线默认类型
    setHighlightType,
    // 设置翻页效果（仅 epub 生效）
    setPageEffect,
    // 设置阅读页顶部工具栏显隐
    setReaderTopbarVisible,
    // 设置阅读页底部翻页栏显隐
    setReaderBottomBarVisible,
    // 加载书架列表
    loadBookshelf,
    // 添加或更新书架记录
    addToBookshelf,
    // 删除书架记录
    removeFromBookshelf,
  };
});
