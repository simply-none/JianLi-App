<template>
  <layout-vue>
    <template #main>
      <div class="ebook-reader-page" :class="themeClass">
        <!-- 顶部工具栏 -->
        <header class="reader-toolbar">
          <div class="toolbar-left">
            <!-- 书架按钮：仅在阅读视图显示，点击切回书架视图 -->
            <el-button
              v-if="view === 'reader'"
              size="default"
              @click="view = 'bookshelf'"
            >
              <LucideIcon name="LibraryBig" :size="16" />
              书架
            </el-button>
            <!-- 打开文件按钮 -->
            <el-button type="primary" @click="openFile">
              <LucideIcon name="FolderOpen" :size="16" />
              打开文件
            </el-button>
            <!-- 当前文件名与格式徽标（仅阅读视图且已打开文件时显示） -->
            <div class="file-info" v-if="view === 'reader' && currentFile.format">
              <el-tag
                size="small"
                :type="currentFile.format === 'epub' ? 'warning' : 'success'"
              >
                {{ currentFile.format.toUpperCase() }}
              </el-tag>
              <span class="file-name" :title="currentFile.name">
                {{ currentFile.name }}
              </span>
            </div>
          </div>

          <!-- 右侧阅读控制区：仅在阅读视图显示 -->
          <div class="toolbar-right" v-if="view === 'reader'">
            <!-- 目录按钮（仅 epub 时有效） -->
            <el-button
              v-if="currentFile.format === 'epub'"
              size="small"
              @click="tocVisible = true"
            >
              <LucideIcon name="List" :size="16" />
              目录
            </el-button>
            <!-- 笔记按钮：打开笔记与划线抽屉，附带数量徽标 -->
            <el-badge
              :value="annotations.length"
              :hidden="annotations.length === 0"
              :max="99"
              type="primary"
            >
              <el-button size="small" @click="annotationDrawerVisible = true">
                <LucideIcon name="NotebookPen" :size="16" />
                笔记
              </el-button>
            </el-badge>
            <!-- 主题切换按钮（循环切换：日间 → 夜间 → 护眼） -->
            <el-button size="small" @click="cycleTheme" :title="`当前：${themeLabel}，点击切换`">
              <LucideIcon :name="themeIcon" :size="16" />
              {{ themeLabel }}
            </el-button>
            <!-- 字体设置：中文 / 英文（选项参考设置页「字体设置」） -->
            <div class="font-control">
              <span class="control-label">字体</span>
              <el-select-v2
                v-model="fontFamilyModel"
                :options="fontOptions"
                filterable
                clearable
                placeholder="中文"
                popper-class="font-select-popper"
                :item-height="72"
                style="width: 150px"
              >
                <template #default="{ item }">
                  <span class="font-box" :style="{ fontFamily: item.value }">
                    <span class="font-name">{{ item.label }}</span>
                    <span class="font-preview">预览：中文English 123</span>
                  </span>
                </template>
              </el-select-v2>
              <el-select-v2
                v-model="fontFamilyENModel"
                :options="fontOptions"
                filterable
                clearable
                placeholder="英文"
                popper-class="font-select-popper"
                :item-height="72"
                style="width: 150px"
              >
                <template #default="{ item }">
                  <span class="font-box" :style="{ fontFamily: item.value }">
                    <span class="font-name">{{ item.label }}</span>
                    <span class="font-preview">Preview: 中文English 123</span>
                  </span>
                </template>
              </el-select-v2>
            </div>

            <!-- 字体大小调整 -->
            <div class="font-size-control">
              <span class="control-label">字号</span>
              <el-input-number
                v-model="fontSizeModel"
                :min="12"
                :max="32"
                :step="1"
                size="small"
                controls-position="right"
              />
            </div>

            <!-- 更多阅读设置按钮：点击打开右侧弹窗（分栏/翻页模式/行距/页边距等） -->
            <el-button
              size="small"
              @click="settingsDrawerVisible = true"
              :title="'更多阅读设置'"
            >
              <LucideIcon name="Settings" :size="16" />
              设置
            </el-button>
          </div>
        </header>

        <!-- 内容区：根据 view 状态切换「书架视图」与「阅读视图」 -->
        <div class="reader-content">
          <!-- 书架视图 -->
          <div v-if="view === 'bookshelf'" class="bookshelf-view">
            <!-- 书架顶部标题与数量 -->
            <div class="bookshelf-header">
              <h2 class="bookshelf-title">
                <LucideIcon name="LibraryBig" :size="18" />
                我的书架
              </h2>
              <span class="book-count">共 {{ bookshelf.length }} 本书</span>
            </div>

            <!-- 空书架提示 -->
            <div v-if="bookshelf.length === 0" class="bookshelf-empty">
              <el-empty description="书架空空如也，打开一本电子书吧">
                <el-button type="primary" @click="openFile">
                  <LucideIcon name="FolderOpen" :size="16" />
                  打开文件
                </el-button>
              </el-empty>
            </div>

            <!-- 卡片网格：flex wrap 响应式布局，每行 3-4 张卡片 -->
            <div v-else class="bookshelf-grid">
              <div
                v-for="item in bookshelf"
                :key="item.path"
                class="book-card"
                :title="`打开《${item.name}》`"
                @click="openBookFromBookshelf(item)"
              >
                <!-- 卡片头部：格式徽标 + 删除按钮 -->
                <div class="book-card-header">
                  <el-tag
                    size="small"
                    :type="item.format === 'epub' ? 'warning' : 'success'"
                  >
                    {{ item.format.toUpperCase() }}
                  </el-tag>
                  <!-- 删除按钮：阻止冒泡，避免触发卡片点击 -->
                  <el-button
                    class="delete-btn"
                    size="small"
                    circle
                    title="从书架移除"
                    @click.stop="handleDeleteBook(item)"
                  >
                    <LucideIcon name="Trash2" :size="14" />
                  </el-button>
                </div>

                <!-- 书名（截断显示，title 显示完整名） -->
                <div class="book-name" :title="item.name">
                  {{ item.name }}
                </div>

                <!-- 进度条与百分比 -->
                <div class="book-progress">
                  <el-progress
                    :percentage="item.percent"
                    :stroke-width="6"
                    :show-text="false"
                    :status="item.percent >= 100 ? 'success' : undefined"
                  />
                  <span class="progress-text">{{ item.percent }}%</span>
                </div>

                <!-- 上次阅读时间 -->
                <div class="book-meta">
                  <LucideIcon name="Clock" :size="12" />
                  <span>{{ formatBookTime(item.lastReadAt) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 阅读视图：根据格式支持状态与是否打开文件动态切换显示 -->
          <template v-else>
            <!-- 优先级 1：unsupportedTip 非空时，显示不支持格式提示 -->
            <div v-if="unsupportedTip" class="empty-state">
              <el-empty :description="unsupportedTip" />
            </div>
            <!-- 优先级 2：当前文件格式支持时，显示动态阅读组件 -->
            <component
              v-else-if="readerComponent"
              :is="readerComponent"
              :key="currentFile.path"
              ref="readerRef"
              :file-path="currentFile.path"
              :font-size="settings.fontSize"
              :font-family="settings.fontFamily"
              :font-family-en="settings.fontFamilyEN"
              :theme="settings.theme"
              :line-height="settings.lineHeight"
              :column-count="settings.columnCount"
              :scroll-mode="settings.scrollMode"
              :margin="settings.margin"
              @progress-update="onProgressUpdate"
              @toc-loaded="onTocLoaded"
              @annotations-updated="onAnnotationsUpdated"
            />
            <!-- 优先级 3：未打开文件时引导用户 -->
            <div v-else class="empty-state">
              <el-empty description="暂未打开任何电子书">
                <el-button type="primary" @click="openFile">
                  <LucideIcon name="FolderOpen" :size="16" />
                  打开文件
                </el-button>
              </el-empty>
            </div>
          </template>
        </div>

        <!-- 目录抽屉（仅 epub 有效） -->
        <el-drawer
          v-model="tocVisible"
          title="目录"
          direction="ltr"
          size="300px"
          :append-to-body="false"
        >
          <div class="toc-list">
            <div
              v-for="(item, index) in flattenedToc"
              :key="item.href + index"
              class="toc-item"
              :style="{ paddingLeft: 12 + item.depth * 16 + 'px' }"
              @click="onTocItemClick(item)"
            >
              {{ item.label }}
            </div>
            <div v-if="flattenedToc.length === 0" class="toc-empty">
              暂无目录
            </div>
          </div>
        </el-drawer>

        <!-- 笔记与划线抽屉：点击某项跳转到对应位置，可删除 -->
        <el-drawer
          v-model="annotationDrawerVisible"
          title="笔记与划线"
          direction="ltr"
          size="320px"
          :append-to-body="false"
        >
          <div class="annotation-list">
            <div
              v-for="item in annotations"
              :key="item.id"
              class="annotation-item"
              @click="onAnnotationClick(item)"
            >
              <!-- 原文摘录：最多 3 行截断 -->
              <div class="annotation-text">{{ item.text }}</div>
              <!-- 笔记内容：仅有笔记时显示 -->
              <div class="annotation-note" v-if="item.note">{{ item.note }}</div>
              <!-- 操作区：删除按钮阻止冒泡，避免触发跳转 -->
              <div class="annotation-actions">
                <el-button size="small" text @click.stop="onAnnotationDelete(item)">
                  <LucideIcon name="Trash2" :size="13" />
                  删除
                </el-button>
              </div>
            </div>
          <!-- 空状态提示 -->
          <div v-if="annotations.length === 0" class="annotation-empty">
            暂无笔记与划线
          </div>
        </div>
      </el-drawer>

      <!-- 更多阅读设置抽屉（右侧弹出）：分栏、翻页模式、行距、页边距等主流电子书功能 -->
      <el-drawer
        v-model="settingsDrawerVisible"
        title="阅读设置"
        direction="rtl"
        size="320px"
        :append-to-body="false"
      >
        <div class="reader-settings">
          <!-- 翻页模式：仅 epub 支持（txt 天然为滚动模式） -->
          <div class="setting-row" v-if="currentFile.format === 'epub'">
            <div class="setting-head">
              <span class="setting-label">翻页模式</span>
            </div>
            <el-radio-group v-model="scrollModeModel">
              <el-radio-button :value="false">翻页</el-radio-button>
              <el-radio-button :value="true">滚动</el-radio-button>
            </el-radio-group>
            <div class="setting-tip">滚动模式下「分栏」不生效</div>
          </div>

          <!-- 分栏：单栏 / 双栏 -->
          <div class="setting-row">
            <div class="setting-head">
              <span class="setting-label">分栏</span>
            </div>
            <el-radio-group v-model="columnCountModel">
              <el-radio-button :value="1">单栏</el-radio-button>
              <el-radio-button :value="2" :disabled="currentFile.format === 'epub' && scrollModeModel">双栏</el-radio-button>
            </el-radio-group>
          </div>

          <!-- 行距：紧凑 ~ 宽松 -->
          <div class="setting-row column">
            <div class="setting-head">
              <span class="setting-label">行距</span>
              <span class="setting-value">{{ lineHeightModel.toFixed(1) }}</span>
            </div>
            <el-slider
              v-model="lineHeightModel"
              :min="1.2"
              :max="2.4"
              :step="0.1"
              :show-tooltip="false"
            />
          </div>

          <!-- 页边距 -->
          <div class="setting-row column">
            <div class="setting-head">
              <span class="setting-label">页边距</span>
              <span class="setting-value">{{ marginModel }}px</span>
            </div>
            <el-slider
              v-model="marginModel"
              :min="0"
              :max="80"
              :step="4"
              :show-tooltip="false"
            />
          </div>
        </div>
      </el-drawer>
      </div>
    </template>
  </layout-vue>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox } from 'element-plus';
import moment from 'moment';
import LayoutVue from '@/components/layout.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import useEbookReader from '@/store/useEbookReader';
import type { EbookTheme, BookshelfItem } from '@/store/useEbookReader';
import useGlobalSetting from '@/store/useGlobalSetting';
import TxtReader from './components/TxtReader.vue';
import EpubReader from './components/EpubReader.vue';

/** 目录项数据结构（与 epubjs NavItem 兼容） */
interface TocItem {
  /** 目录项 id */
  id: string;
  /** 目录项链接（href 或 cfi） */
  href: string;
  /** 目录项显示文本 */
  label: string;
  /** 子目录项 */
  subitems?: TocItem[];
}

/** 扁平化后的目录项（含层级深度，用于缩进显示） */
interface FlatTocItem extends TocItem {
  /** 层级深度，0 为顶层 */
  depth: number;
}

/** 阅读器子组件实例类型（displayTarget 仅 EpubReader 暴露） */
interface ReaderComponentInstance {
  /** 跳转到指定目标（cfi 或 href），仅 EpubReader 实现 */
  displayTarget?: (target: string) => void;
  /** 跳转到划线位置，两种阅读组件均实现 */
  jumpToAnnotation?: (anchor: string) => void;
  /** 按 id 移除本地划线（笔记抽屉删除后同步子组件高亮），两种阅读组件均实现 */
  removeAnnotationById?: (id: number) => void;
}

/** 笔记抽屉展示用的统一标注项（兼容 epub 与 txt 两种子组件 payload） */
interface AnnotationDisplayItem {
  /** 标注 id（数据库主键） */
  id: number;
  /** 定位锚点（epub 为 cfiRange；txt 为 "start-end"），用于跳转 */
  anchor: string;
  /** 原文摘录 */
  text: string;
  /** 笔记内容，可为空 */
  note: string;
}

/** 主题循环顺序：日间 → 夜间 → 护眼 */
const THEME_ORDER: EbookTheme[] = ['day', 'night', 'eye'];

/** 主题对应的图标名称（需与 LucideIcon 组件中已导入的图标匹配） */
const THEME_ICON_MAP: Record<EbookTheme, string> = {
  day: 'Sun',
  night: 'Moon',
  eye: 'Eye',
};

/** 主题对应的中文标签 */
const THEME_LABEL_MAP: Record<EbookTheme, string> = {
  day: '日间',
  night: '夜间',
  eye: '护眼',
};

/** 书架进度刷新节流间隔（毫秒），500ms 内最多触发一次 addToBookshelf */
const BOOKSHELF_THROTTLE_MS = 500;

// 电子书阅读器 store
const ebookStore = useEbookReader();
// 解构响应式状态：currentFile 当前文件、progress 阅读进度、settings 设置、bookshelf 书架列表
const { currentFile, progress, settings, bookshelf } = storeToRefs(ebookStore);
// 解构 actions：setCurrentFile 设置当前文件、setProgress 设置进度、setFontSize 设置字号、
// setTheme 设置主题、loadBookshelf 加载书架、addToBookshelf 写入书架、removeFromBookshelf 删除书架
const {
  setCurrentFile,
  setProgress,
  setFontSize,
  setTheme,
  setFontFamily,
  setFontFamilyEN,
  setLineHeight,
  setColumnCount,
  setScrollMode,
  setMargin,
  loadBookshelf,
  addToBookshelf,
  removeFromBookshelf,
} = ebookStore;

/**
 * 当前视图状态
 * - 'bookshelf'：书架视图（默认），展示书架卡片网格
 * - 'reader'：阅读视图，展示阅读内容区
 */
const view = ref<'bookshelf' | 'reader'>('bookshelf');

/** 目录抽屉显示状态 */
const tocVisible = ref(false);
/** 目录项列表（由 EpubReader 通过 toc-loaded 事件回传） */
const tocItems = ref<TocItem[]>([]);
/** 子组件实例引用 */
const readerRef = ref<ReaderComponentInstance | null>(null);
/**
 * 不支持格式的提示文本
 * - 空字符串：不显示提示（正常打开文件或未打开文件状态）
 * - 非空字符串：在阅读内容区以 el-empty 形式展示该提示文本
 */
const unsupportedTip = ref('');

/**
 * 当前文件的笔记与划线列表（统一展示格式）
 * 由子组件通过 annotations-updated 事件回填，用于笔记抽屉展示
 */
const annotations = ref<AnnotationDisplayItem[]>([]);

/** 笔记抽屉显示状态 */
const annotationDrawerVisible = ref(false);

/** 更多阅读设置抽屉显示状态 */
const settingsDrawerVisible = ref(false);

/**
 * 上次刷新书架进度的时间戳（毫秒）
 * 用于 onProgressUpdate 中节流 addToBookshelf，避免每次翻页都触发数据库写入
 */
let lastBookshelfUpdateAt = 0;

/** 字体大小双向绑定（get/set 关联 store） */
const fontSizeModel = computed({
  get: () => settings.value.fontSize,
  set: (val: number | undefined) => {
    if (typeof val === 'number') {
      setFontSize(val);
    }
  },
});

/** 字体选项来源（与设置页「字体设置」保持一致）：内置字体列表 + 系统已安装字体 */
const { globalFontOpsC } = storeToRefs(useGlobalSetting());
/** 系统字体列表（由主进程 get-fonts 返回，结构 { label, value }） */
const sysFonts = ref<{ label: string; value: string }[]>([]);
/** 合并后的字体下拉选项 */
const fontOptions = computed(() => [...(globalFontOpsC.value || []), ...sysFonts.value]);

/** 中文正文字体双向绑定 */
const fontFamilyModel = computed({
  get: () => settings.value.fontFamily,
  set: (val: string | undefined) => setFontFamily(val ?? ''),
});

/** 英文正文字体双向绑定 */
const fontFamilyENModel = computed({
  get: () => settings.value.fontFamilyEN,
  set: (val: string | undefined) => setFontFamilyEN(val ?? ''),
});

/** 正文行距双向绑定 */
const lineHeightModel = computed({
  get: () => settings.value.lineHeight,
  set: (val: number | undefined) => {
    if (typeof val === 'number') setLineHeight(val);
  },
});

/** 分栏数双向绑定（1 单栏 / 2 双栏） */
const columnCountModel = computed({
  get: () => settings.value.columnCount,
  set: (val: number | undefined) => {
    if (typeof val === 'number') setColumnCount(val);
  },
});

/** 翻页模式双向绑定（false 翻页 / true 滚动） */
const scrollModeModel = computed({
  get: () => settings.value.scrollMode,
  set: (val: boolean | undefined) => {
    if (typeof val === 'boolean') setScrollMode(val);
  },
});

/** 页边距双向绑定 */
const marginModel = computed({
  get: () => settings.value.margin,
  set: (val: number | undefined) => {
    if (typeof val === 'number') setMargin(val);
  },
});

/** 当前主题图标名称 */
const themeIcon = computed(() => THEME_ICON_MAP[settings.value.theme]);

/** 当前主题中文标签 */
const themeLabel = computed(() => THEME_LABEL_MAP[settings.value.theme]);

/** 当前主题对应的 class（作用于整个电子书阅读页，使工具栏/书架/抽屉等区域跟随切换） */
const themeClass = computed(() => `theme-${settings.value.theme}`);

/** 根据文件格式动态计算渲染组件 */
const readerComponent = computed(() => {
  if (currentFile.value.format === 'txt') return TxtReader;
  if (currentFile.value.format === 'epub') return EpubReader;
  return null;
});

/** 扁平化目录树（含层级深度，用于缩进渲染） */
const flattenedToc = computed<FlatTocItem[]>(() => {
  const flatten = (items: TocItem[], depth = 0): FlatTocItem[] => {
    const result: FlatTocItem[] = [];
    for (const item of items) {
      result.push({ ...item, depth });
      if (item.subitems && item.subitems.length > 0) {
        result.push(...flatten(item.subitems, depth + 1));
      }
    }
    return result;
  };
  return flatten(tocItems.value);
});

/**
 * 从文件路径中提取文件名（兼容 Windows 反斜杠与 Unix 正斜杠）
 *
 * @param filePath - 文件绝对路径
 * @returns 文件名（含扩展名）；无法提取时返回原路径
 */
function getFileName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || filePath;
}

/**
 * 根据文件名扩展名判断电子书格式
 *
 * @param fileName - 文件名（含扩展名）
 * @returns 格式字符串：'txt'、'epub'；不支持时返回空字符串
 */
function getFormat(fileName: string): 'txt' | 'epub' | '' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'txt') return 'txt';
  if (ext === 'epub') return 'epub';
  return '';
}

/**
 * 加载电子书文件并切换到阅读视图
 * 统一处理：清空不支持格式提示 → 写入 store → 清除目录状态 → 写入书架记录 → 切换视图
 *
 * @param filePath - 文件绝对路径
 * @param name - 文件名（含扩展名）
 * @param format - 文件格式：'txt' 或 'epub'
 * @returns 无返回值
 */
function loadFile(filePath: string, name: string, format: 'txt' | 'epub') {
  // 清空不支持格式提示，避免上一次的提示残留
  unsupportedTip.value = '';
  // 写入 store 的当前文件（同步持久化到本地存储）
  setCurrentFile({ path: filePath, name, format });
  // 清除旧目录状态，避免上本书目录残留
  tocItems.value = [];
  tocVisible.value = false;
  // 清除上一本书的笔记列表，避免抽屉中残留旧数据
  annotations.value = [];
  annotationDrawerVisible.value = false;
  // 写入书架记录并刷新书架列表；percent 优先沿用该书已有的书架进度，
  // 避免用全局 progress 覆盖掉每本书各自保存的真实阅读进度
  const existingItem = bookshelf.value.find((b) => b.path === filePath);
  addToBookshelf({
    path: filePath,
    name,
    format,
    percent: existingItem ? existingItem.percent : progress.value.percent || 0,
    lastReadAt: new Date().toISOString(),
    addedAt: new Date().toISOString(),
  });
  // 切换到阅读视图
  view.value = 'reader';
}

/**
 * 通过 jlocal 协议 HEAD 请求检查文件是否存在
 * 利用项目已注册的 jlocal:// 协议；文件不存在时主进程返回 404
 *
 * @param filePath - 文件绝对路径
 * @returns 文件存在返回 true；不存在或请求异常返回 false
 */
async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    const res = await fetch('jlocal:///' + filePath, { method: 'HEAD' });
    return res.ok;
  } catch (err) {
    // 网络或协议异常时按不存在处理
    console.error('检查文件存在性失败', err);
    return false;
  }
}

/**
 * 点击书架卡片打开对应电子书
 * 流程：先通过 jlocal 协议检查文件存在性 → 不存在则提示并询问是否移除 → 存在则调用 loadFile
 *
 * @param item - 书架条目信息，包含 path、name、format 等
 * @returns 无返回值
 */
async function openBookFromBookshelf(item: BookshelfItem) {
  const exists = await checkFileExists(item.path);
  if (!exists) {
    // 文件不存在（可能已被移动或删除），提示并询问是否从书架移除
    try {
      await ElMessageBox.confirm(
        '文件不存在，可能已被移动或删除。是否从书架移除该书？',
        '提示',
        {
          confirmButtonText: '移除',
          cancelButtonText: '取消',
          type: 'warning',
        }
      );
      await removeFromBookshelf(item.path);
      ElMessage.success('已从书架移除');
    } catch {
      // 用户点击取消，不做任何操作
    }
    return;
  }
  // 文件存在，加载并切换到阅读视图
  loadFile(item.path, item.name, item.format as 'txt' | 'epub');
}

/**
 * 删除书架书籍前的确认弹窗
 * 点击删除按钮触发；用户确认后调用 removeFromBookshelf
 *
 * @param item - 书架条目信息
 * @returns 无返回值；用户取消时不做任何操作
 */
async function handleDeleteBook(item: BookshelfItem) {
  try {
    await ElMessageBox.confirm('确认从书架移除该书？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await removeFromBookshelf(item.path);
    ElMessage.success('已从书架移除');
  } catch {
    // 用户点击取消，不做操作
  }
}

/**
 * 格式化书架条目的时间字段为可读字符串
 *
 * @param time - ISO 字符串时间，如 '2026-08-01T12:34:56.000Z'
 * @returns 'YYYY-MM-DD HH:mm' 格式字符串；输入为空或无效时返回 '--'
 */
function formatBookTime(time: string): string {
  if (!time) return '--';
  const m = moment(time);
  // moment 解析无效时 isValid 为 false
  if (!m.isValid()) return '--';
  return m.format('YYYY-MM-DD HH:mm');
}

/**
 * 打开文件选择对话框并加载选中的电子书
 * 调用项目既有的 get-file-list IPC（sendSync），不支持格式时弹出提示
 * 不支持格式时同步清空 currentFile 并在内容区以 el-empty 形式展示提示文本
 *
 * @returns 无返回值
 */
function openFile() {
  // 每次点击「打开文件」时重置不支持格式提示，避免上一次的提示残留
  unsupportedTip.value = '';
  // 调用主进程文件选择对话框：openFile 表示选择文件，type: ['file'] 表示所有文件
  const result = window.ipcRenderer.sendSync('get-file-list', {
    openFile: true,
    type: ['file'],
  });
  // 用户取消选择或未选中文件
  if (!result || !Array.isArray(result) || result.length === 0) return;

  const filePath = result[0];
  const fileName = getFileName(filePath);
  const format = getFormat(fileName);

  // 不支持的格式（含 .mobi 等）提示用户
  if (!format) {
    // 保留 ElMessage 作为即时反馈
    ElMessage.warning('暂不支持该格式（当前支持 txt、epub）');
    // 在阅读内容区以 el-empty 形式展示提示文本
    unsupportedTip.value = '暂不支持该格式（当前支持 txt、epub）';
    // 清空 currentFile，避免显示阅读器组件
    setCurrentFile({ path: '', name: '', format: '' });
    // 同步清除目录状态
    tocItems.value = [];
    tocVisible.value = false;
    // 同步清除笔记列表与抽屉状态
    annotations.value = [];
    annotationDrawerVisible.value = false;
    // 切换到阅读视图以展示提示
    view.value = 'reader';
    return;
  }

  // 调用统一的 loadFile 方法：写入 store、加入书架、切换到阅读视图
  loadFile(filePath, fileName, format);
}

/**
 * 循环切换阅读主题：日间 → 夜间 → 护眼 → 日间
 *
 * @returns 无返回值
 */
function cycleTheme() {
  const currentIdx = THEME_ORDER.indexOf(settings.value.theme);
  const nextIdx = (currentIdx + 1) % THEME_ORDER.length;
  setTheme(THEME_ORDER[nextIdx]);
}

/**
 * 子组件进度更新事件处理
 * 同步到 store 并通过 IPC 持久化到数据库
 * 同时按 500ms 节流刷新书架进度（addToBookshelf）
 *
 * @param payload - 进度数据，包含 cfi 定位与百分比
 * @returns 无返回值
 */
async function onProgressUpdate(payload: { cfi: string; percent: number }) {
  // 更新 store 中的进度（同步持久化到本地存储）
  setProgress(payload);
  // 通过 IPC 持久化到数据库，并节流刷新书架进度
  if (currentFile.value.path) {
    try {
      await window.ipcRenderer.ebook.saveProgress({
        filePath: currentFile.value.path,
        format: currentFile.value.format,
        cfi: payload.cfi,
        percent: payload.percent,
      });
      // 节流刷新书架进度：避免每次翻页都触发数据库写入与列表刷新
      const now = Date.now();
      if (now - lastBookshelfUpdateAt >= BOOKSHELF_THROTTLE_MS) {
        lastBookshelfUpdateAt = now;
        await addToBookshelf({
          path: currentFile.value.path,
          name: currentFile.value.name,
          format: currentFile.value.format,
          percent: payload.percent,
          lastReadAt: new Date().toISOString(),
          addedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      // 持久化失败不影响阅读，仅打印日志
      console.error('保存阅读进度失败', err);
    }
  }
}

/**
 * EpubReader 目录加载完成事件处理
 *
 * @param items - 目录项数组
 * @returns 无返回值
 */
function onTocLoaded(items: TocItem[]) {
  tocItems.value = items || [];
}

/**
 * 目录项点击事件处理
 * 调用 EpubReader 暴露的 displayTarget 方法跳转
 *
 * @param item - 被点击的目录项
 * @returns 无返回值
 */
function onTocItemClick(item: FlatTocItem) {
  if (currentFile.value.format === 'epub' && readerRef.value?.displayTarget) {
    readerRef.value.displayTarget(item.href);
  }
  tocVisible.value = false;
}

/**
 * 子组件标注列表变更事件处理
 * 接收 EpubAnnotation[] 或 TxtAnnotation[]，统一映射为 AnnotationDisplayItem[]
 * - epub 项有 anchor 字段（cfiRange），直接使用
 * - txt 项无 anchor 但有 start/end，组合为 "start-end" 作为锚点
 *
 * @param items - 子组件 emit 的标注 payload，可能是 EpubAnnotation[] 或 TxtAnnotation[]
 * @returns 无返回值；payload 非数组时清空当前列表
 */
function onAnnotationsUpdated(items: any[]) {
  if (!Array.isArray(items)) {
    annotations.value = [];
    return;
  }
  annotations.value = items.map((item) => ({
    id: item.id,
    anchor: item.anchor ?? `${item.start}-${item.end}`,
    text: item.text ?? '',
    note: item.note ?? '',
  }));
}

/**
 * 笔记抽屉项点击事件处理
 * 调用子组件暴露的 jumpToAnnotation 方法跳转到划线位置，并关闭抽屉
 *
 * @param item - 被点击的笔记项
 * @returns 无返回值
 */
function onAnnotationClick(item: AnnotationDisplayItem) {
  readerRef.value?.jumpToAnnotation?.(item.anchor);
  annotationDrawerVisible.value = false;
}

/**
 * 笔记抽屉项删除事件处理
 * 弹出确认框，确认后调用 IPC 删除数据库记录，成功后同步移除子组件本地高亮与父组件展示列表
 *
 * @param item - 待删除的笔记项
 * @returns 无返回值；用户取消时不做任何操作
 */
async function onAnnotationDelete(item: AnnotationDisplayItem) {
  try {
    await ElMessageBox.confirm('确认删除该划线？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    const res = await window.ipcRenderer.ebook.removeAnnotation(item.id);
    if (!res?.success) {
      ElMessage.error(`删除失败：${res?.error || '未知错误'}`);
      return;
    }
    // 同步子组件本地高亮渲染，避免删除后高亮残留
    readerRef.value?.removeAnnotationById?.(item.id);
    // 更新父组件展示列表（子组件 removeAnnotationById 会 emit annotations-updated，
    // 但为保险起见此处也直接同步父组件列表）
    annotations.value = annotations.value.filter((a) => a.id !== item.id);
    ElMessage.success('已删除划线');
  } catch (err) {
    // 用户点击取消时 ElMessageBox.reject 抛出 'cancel'，此处统一忽略
    // 真正的异常（如 IPC 调用失败）已在上方 try 中通过 ElMessage.error 提示
    if (err !== 'cancel' && err !== 'close') {
      console.error('删除划线异常', err);
    }
  }
}

// 组件挂载时加载书架列表（从数据库读取）并拉取系统字体供字体选择使用
onMounted(() => {
  loadBookshelf();
  window.ipcRenderer
    .handlePromise('get-fonts', {})
    .then((result) => {
      sysFonts.value = result || [];
    })
    .catch((err) => {
      console.error('获取系统字体失败', err);
    });
});

// 监听文件路径变化，切换文件时清除目录状态与笔记列表
watch(
  () => currentFile.value.path,
  () => {
    tocItems.value = [];
    tocVisible.value = false;
    annotations.value = [];
    annotationDrawerVisible.value = false;
  }
);
</script>

<style scoped lang="scss">
:deep(.main) {
  padding: 0 !important;
  overflow: hidden !important;
}

.ebook-reader-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  box-sizing: border-box;

  .reader-toolbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-subtle);
    box-shadow: var(--shadow-top);

    .toolbar-left,
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;

      .file-name {
        font-size: 13px;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 280px;
      }
    }

    .font-size-control {
      display: flex;
      align-items: center;
      gap: 6px;

      .control-label {
        font-size: 13px;
        color: var(--text-secondary);
        white-space: nowrap;
      }
    }

    .font-control {
      display: flex;
      align-items: center;
      gap: 6px;

      .control-label {
        font-size: 13px;
        color: var(--text-secondary);
        white-space: nowrap;
      }
    }
  }

  /* ========== 电子书主题：让工具栏 / 书架 / 抽屉等所有区域跟随 day/night/eye 切换 ==========
     之前 cycleTheme 只切换了阅读区（TxtReader/EpubReader 内部），外层区域仍使用全局主题变量，
     导致「阅读区变深/变绿、工具栏仍是亮色」的主题错乱。这里把同名 class 作用到整页并覆盖变量。 */
  &.theme-day {
    --bg-base: #f5f6fa;
    --bg-card: #ffffff;
    --border-subtle: rgba(0, 0, 0, 0.06);
    --shadow-top: 0 1px 4px rgba(0, 0, 0, 0.03);
    --text-primary: #1a1a1a;
    --text-secondary: #4b5563;
    --text-muted: #9ca3af;
    --color-primary: #6366f1;
    --bg-hover: rgba(0, 0, 0, 0.04);
    --radius-card: 12px;

    --el-bg-color: #ffffff;
    --el-bg-color-overlay: #ffffff;
    --el-bg-color-page: #f5f6fa;
    --el-text-color-primary: #1a1a1a;
    --el-text-color-regular: #4b5563;
    --el-text-color-secondary: #9ca3af;
    --el-border-color: #dcdfe6;
    --el-border-color-light: #e4e7ed;
    --el-border-color-lighter: #ebeef5;
    --el-fill-color: #f0f2f5;
    --el-fill-color-light: #f5f7fa;
    --el-fill-color-lighter: #fafafa;
    --el-fill-color-blank: #ffffff;
    --el-color-primary: #6366f1;
  }

  &.theme-night {
    --bg-base: #1a1a1a;
    --bg-card: #2a2a2a;
    --border-subtle: #3a3a3a;
    --shadow-top: 0 1px 4px rgba(0, 0, 0, 0.3);
    --text-primary: #cccccc;
    --text-secondary: #aaaaaa;
    --text-muted: #888888;
    --color-primary: #6366f1;
    --bg-hover: rgba(255, 255, 255, 0.06);
    --radius-card: 12px;

    --el-bg-color: #2a2a2a;
    --el-bg-color-overlay: #2a2a2a;
    --el-bg-color-page: #1a1a1a;
    --el-text-color-primary: #cccccc;
    --el-text-color-regular: #aaaaaa;
    --el-text-color-secondary: #888888;
    --el-border-color: #3a3a3a;
    --el-border-color-light: #3a3a3a;
    --el-border-color-lighter: #3a3a3a;
    --el-fill-color: #2a2a2a;
    --el-fill-color-light: #2a2a2a;
    --el-fill-color-lighter: #242424;
    --el-fill-color-blank: #2a2a2a;
    --el-color-primary: #6366f1;
    --el-mask-color: rgba(0, 0, 0, 0.5);
  }

  &.theme-eye {
    --bg-base: #c7edcc;
    --bg-card: #e3f5e6;
    --border-subtle: rgba(44, 62, 80, 0.12);
    --shadow-top: 0 1px 4px rgba(44, 62, 80, 0.08);
    --text-primary: #2c3e50;
    --text-secondary: #4a5d6e;
    --text-muted: #7a8a96;
    --color-primary: #2f8f5b;
    --bg-hover: rgba(44, 62, 80, 0.06);
    --radius-card: 12px;

    --el-bg-color: #e3f5e6;
    --el-bg-color-overlay: #e3f5e6;
    --el-bg-color-page: #c7edcc;
    --el-text-color-primary: #2c3e50;
    --el-text-color-regular: #4a5d6e;
    --el-text-color-secondary: #7a8a96;
    --el-border-color: rgba(44, 62, 80, 0.2);
    --el-border-color-light: rgba(44, 62, 80, 0.15);
    --el-border-color-lighter: rgba(44, 62, 80, 0.1);
    --el-fill-color: #d4efd8;
    --el-fill-color-light: #dcf3df;
    --el-fill-color-lighter: #e8f7ea;
    --el-fill-color-blank: #e3f5e6;
    --el-color-primary: #2f8f5b;
  }

  .reader-content {
    flex: 1;
    overflow: hidden;
    min-height: 0;

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
    }

    /* 书架视图：垂直布局，内容区可滚动 */
    .bookshelf-view {
      height: 100%;
      overflow: auto;
      padding: 20px 24px 32px;
      box-sizing: border-box;
      background: var(--bg-base);
    }

    /* 书架顶部标题与数量 */
    .bookshelf-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--color-primary);

      .bookshelf-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);

        :deep(.lucide-icon-box) {
          color: var(--color-primary);
        }
      }

      .book-count {
        font-size: 13px;
        color: var(--text-secondary);
      }
    }

    /* 空书架提示 */
    .bookshelf-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 60px 0;
    }

    /* 卡片网格：响应式 flex wrap，每行 3-4 张 */
    .bookshelf-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
      width: 100%;
    }

    /* 单张书架卡片 */
    .book-card {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-card);
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;

      &:hover {
        transform: translateY(-2px);
        border-color: var(--color-primary);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }

      /* 卡片头部：格式徽标 + 删除按钮 */
      .book-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;

        .delete-btn {
          width: 26px;
          height: 26px;
          min-height: 26px;
          padding: 0;
          color: var(--text-muted);
          border: none;
          background: transparent;

          &:hover {
            color: #ef4444;
            background: rgba(239, 68, 68, 0.08);
          }
        }
      }

      /* 书名：单行截断 */
      .book-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        line-height: 1.4;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* 进度条与百分比 */
      .book-progress {
        display: flex;
        align-items: center;
        gap: 8px;

        :deep(.el-progress) {
          flex: 1;
        }

        .progress-text {
          font-size: 12px;
          color: var(--text-secondary);
          min-width: 36px;
          text-align: right;
        }
      }

      /* 上次阅读时间 */
      .book-meta {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--text-muted);

        :deep(.lucide-icon-box) {
          color: var(--text-muted);
        }
      }
    }
  }

  /* 更多阅读设置抽屉内容 */
  .reader-settings {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 4px 2px;

    .setting-row {
      display: flex;
      flex-direction: column;
      gap: 10px;

      &.column {
        gap: 6px;
      }

      .setting-head {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .setting-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
        }

        .setting-value {
          font-size: 13px;
          color: var(--color-primary);
          font-variant-numeric: tabular-nums;
        }
      }

      .setting-tip {
        font-size: 12px;
        color: var(--text-muted);
        line-height: 1.4;
      }
    }
  }

  .toc-list {
    padding: 8px 0;

    .toc-item {
      padding: 8px 12px;
      font-size: 13px;
      color: var(--text-primary);
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: background-color 0.2s;

      &:hover {
        background: var(--bg-base);
        color: var(--color-primary);
      }
    }

    .toc-empty {
      padding: 24px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }
  }

  /* 笔记与划线列表：参考 .toc-list 风格 */
  .annotation-list {
    padding: 8px 0;

    /* 单条笔记项：hover 高亮、点击跳转 */
    .annotation-item {
      padding: 10px 12px;
      border-radius: var(--radius-card, 6px);
      cursor: pointer;
      transition: background-color 0.2s;

      &:hover {
        background: var(--bg-hover, var(--bg-base));
      }

      /* 原文摘录：最多 3 行截断 */
      .annotation-text {
        font-size: 13px;
        line-height: 1.5;
        color: var(--text-primary);
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* 笔记内容：左侧竖线区分，主题色突出 */
      .annotation-note {
        margin-top: 4px;
        padding-left: 8px;
        font-size: 12px;
        line-height: 1.5;
        color: var(--color-primary);
        border-left: 2px solid var(--color-primary);
        word-break: break-word;
      }

      /* 操作区：删除按钮靠右 */
      .annotation-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 4px;
      }
    }

    /* 空状态提示：居中、弱化色 */
    .annotation-empty {
      padding: 24px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }
  }
}
</style>

<!-- 字体下拉面板样式（与设置页字体选择保持一致），非 scoped 以便作用于 body 下的 popper -->
<style lang="scss">
.font-select-popper {
  background: var(--bg-card) !important;
  border: 1px solid var(--border-subtle) !important;

  .el-select-dropdown__item {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: fit-content;
    color: var(--text-primary) !important;

    &:hover {
      background: var(--bg-hover) !important;
    }

    .font-box {
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 72px;
    }

    .font-name {
      font-size: 14px;
      font-weight: 500;
    }

    .font-preview {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }
  }
}
</style>
