<template>
  <layout-vue>
    <template #main>
      <div class="ebook-reader-page" :class="themeClass">
        <!-- 顶部工具栏 -->
        <header class="reader-toolbar" v-show="settings.readerTopbarVisible">
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

          <!-- 右侧阅读控制区：仅在阅读视图显示；窄屏可横向滚动（含鼠标滚轮映射） -->
          <div
            class="toolbar-right"
            v-if="view === 'reader'"
            ref="toolbarRightRef"
            @wheel="onToolbarRightWheel"
          >
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
            <!-- 书签按钮（仅 epub 时有效）：打开书签抽屉，附带数量徽标 -->
            <el-badge
              v-if="currentFile.format === 'epub'"
              :value="bookmarks.length"
              :hidden="bookmarks.length === 0"
              :max="99"
              type="warning"
            >
              <el-button size="small" @click="bookmarkDrawerVisible = true">
                <LucideIcon name="Bookmark" :size="16" />
                书签
              </el-button>
            </el-badge>
            <!-- 全文搜索按钮（仅 epub 时有效）：打开搜索面板 -->
            <el-button
              v-if="currentFile.format === 'epub'"
              size="small"
              @click="searchPanelVisible = true"
            >
              <LucideIcon name="Search" :size="16" />
              搜索
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

        <!-- 当顶部栏隐藏时，显示浮动设置按钮以便重新打开设置抽屉 -->
        <transition name="fade">
          <el-button
            v-if="view === 'reader' && !settings.readerTopbarVisible"
            class="floating-settings-btn"
            size="small"
            circle
            @click="settingsDrawerVisible = true"
            title="设置"
          >
            <LucideIcon name="Settings" :size="16" />
          </el-button>
        </transition>

        <!-- 内容区：根据 view 状态切换「书架视图」与「阅读视图」 -->
        <div class="reader-content">
          <!-- 书架视图（已抽为独立组件 Bookshelf）：卡片网格 + 徽标 + 笔记/导出，打开/删除/加入/导出由父组件处理 -->
          <Bookshelf
            v-if="view === 'bookshelf'"
            :items="bookshelf"
            :annotation-count-map="annotationCountMap"
            @open="openBook"
            @remove="removeBook"
            @add-external="addExternal"
            @open-file="openFile"
            @open-annotations="openShelfAnnotations"
            @export="exportBook"
            @export-all="exportAll"
          />

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
              :bg-type="settings.bgType"
              :bg-color="settings.bgColor"
              :bg-image="settings.bgImage"
              :text-color="settings.textColor"
              :bottom-bar-visible="settings.readerBottomBarVisible"
              :edge-click-enabled="settings.edgeClickEnabled"
              :edge-click-percent="settings.edgeClickPercent"
              :wheel-page-enabled="settings.wheelPageEnabled"
              :wheel-page-sensitivity="settings.wheelPageSensitivity"
              :line-height="settings.lineHeight"
              :column-count="settings.columnCount"
              :scroll-mode="settings.scrollMode"
              :margin="settings.margin"
              :letter-spacing="settings.letterSpacing"
              :paragraph-spacing="settings.paragraphSpacing"
              :first-line-indent="settings.firstLineIndent"
              @progress-update="onProgressUpdate"
              @toc-loaded="onTocLoaded"
              @landmarks-loaded="onLandmarksLoaded"
              @current-href="onCurrentHref"
              @annotations-updated="onAnnotationsUpdated"
              @bookmarks-updated="onBookmarksUpdated"
              @search-results="onSearchResults"
              @searching="onSearching"
              @font-size-change="onFontSizeChange"
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

        <!-- 目录抽屉（仅 epub 有效），已抽为独立组件 TocDrawer -->
        <TocDrawer
          v-model="tocVisible"
          :items="tocItems"
          :landmarks="tocLandmarks"
          :current-href="currentFileHref"
          @select="onTocItemClick"
        />

        <!-- 笔记与划线抽屉（已抽为独立组件 AnnotationDrawer）：分「笔记」与「划线」，跳转/删除/导出/保存由父组件处理 -->
        <AnnotationDrawer
          v-model="annotationDrawerVisible"
          :items="annotations"
          :title="annotationDrawerTitle"
          @jump="onAnnotationClick"
          @delete="onAnnotationDelete"
          @export="exportCurrentAnnotations"
          @save-note="saveShelfNote"
        />

        <!-- 书签抽屉（已抽为独立组件 BookmarksDrawer）：跳转/删除由父组件处理 -->
        <BookmarksDrawer
          v-model="bookmarkDrawerVisible"
          :items="bookmarks"
          :current-cfi="currentFileCfi"
          @jump="onBookmarkClick"
          @delete="onBookmarkDelete"
        />

        <!-- 全文搜索面板（已抽为独立组件 SearchPanel）：检索/跳转由父组件处理 -->
        <SearchPanel
          v-model="searchPanelVisible"
          :results="searchResults"
          :searching="searching"
          :max-results="300"
          @search="onSearch"
          @jump="onSearchJump"
        />

      <!-- 更多阅读设置抽屉（主题/排版/标注/翻页交互/界面），已抽为独立组件 SettingsDrawer -->
      <SettingsDrawer v-model="settingsDrawerVisible" :current-file="currentFile" />
      </div>
    </template>
  </layout-vue>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox } from 'element-plus';
import LayoutVue from '@/components/layout.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import useEbookReader from '@/store/useEbookReader';
import type { EbookTheme, EbookBgType, BookshelfItem } from '@/store/useEbookReader';
import useGlobalSetting from '@/store/useGlobalSetting';
import TxtReader from './components/TxtReader.vue';
import EpubReader from './components/EpubReader.vue';
import SettingsDrawer from './components/SettingsDrawer.vue';
import TocDrawer from './components/TocDrawer.vue';
import AnnotationDrawer from './components/AnnotationDrawer.vue';
import BookmarksDrawer from './components/BookmarksDrawer.vue';
import SearchPanel from './components/SearchPanel.vue';
import Bookshelf from './components/Bookshelf.vue';
import { useBookshelf, handleExportResult } from './composables/useBookshelf';
import { getFileName, getFormat } from './utils/fileUtils';
import type { TocItem, FlatTocItem, ReaderComponentInstance, AnnotationDisplayItem, EpubSearchResult } from './types';

/** 书架进度刷新节流间隔（毫秒），500ms 内最多触发一次 addToBookshelf */
const BOOKSHELF_THROTTLE_MS = 500;

// 电子书阅读器 store
const ebookStore = useEbookReader();
// 解构响应式状态：currentFile 当前文件、progress 阅读进度、settings 设置
const { currentFile, progress, settings } = storeToRefs(ebookStore);
// 解构 actions：setCurrentFile 设置当前文件、setProgress 设置进度、setFontSize 设置字号、
// setTheme 设置主题、setBgType/setBgColor/setBgImage/setTextColor 设置阅读区背景与文字色、
// loadBookshelf 加载书架、addToBookshelf 写入书架
const {
  setCurrentFile,
  setProgress,
  setFontSize,
  setFontFamily,
  setFontFamilyEN,
  loadBookshelf,
  addToBookshelf,
} = ebookStore;

// 书架功能 composable：抽取书架列表、徽标数量与打开/移除/加入/导出等操作
const {
  bookshelf,
  annotationCountMap,
  refreshCounts,
  openBook,
  removeBook,
  addExternal,
  exportBook,
  exportAll,
} = useBookshelf({
  // 打开书时写入 store 并切换到阅读视图（复用统一的 loadFile 加载器）
  openBook: (item) => loadFile(item.path, item.name, item.format as 'txt' | 'epub'),
});

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
/** 目录地标列表（封面/正文/目录等，由 EpubReader 通过 landmarks-loaded 事件回传） */
const tocLandmarks = ref<any[]>([]);
/** 当前阅读位置的 href（由 EpubReader 通过 current-href 事件回传，用于目录高亮） */
const currentFileHref = ref('');
/** 子组件实例引用 */
const readerRef = ref<ReaderComponentInstance | null>(null);
/** 顶部栏右侧功能区容器引用：用于挂载鼠标滚轮→横向滚动 */
const toolbarRightRef = ref<HTMLElement | null>(null);
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

/** 当前文件的书签列表（由 EpubReader 通过 bookmarks-updated 事件回填，用于书签抽屉展示） */
const bookmarks = ref<BookmarkRecord[]>([]);

/** 书签抽屉显示状态 */
const bookmarkDrawerVisible = ref(false);

/** 当前阅读位置的 cfi（用于书签抽屉高亮当前书签，随进度更新回填） */
const currentFileCfi = ref('');

/** 全文搜索结果列表（由 EpubReader 通过 search-results 事件回填，用于搜索面板展示） */
const searchResults = ref<EpubSearchResult[]>([]);

/** 是否正在搜索（由 EpubReader 通过 searching 事件回填） */
const searching = ref(false);

/** 全文搜索面板显示状态 */
const searchPanelVisible = ref(false);

/** 笔记抽屉来源文件：null = 当前打开的书；string = 从书架打开的指定书路径 */
const annotationSourceFile = ref<string | null>(null);

/** 笔记抽屉标题：书架来源显示书名，否则显示默认标题 */
const annotationDrawerTitle = computed(() => {
  if (annotationSourceFile.value) {
    const book = bookshelf.value.find((b) => b.path === annotationSourceFile.value);
    return book ? `${book.name} · 笔记` : '笔记与划线';
  }
  return '笔记与划线';
});

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



/** 当前主题对应的 class（作用于整个电子书阅读页，使工具栏/书架/抽屉等区域跟随切换） */
const themeClass = computed(() => `theme-${settings.value.theme}`);

/** 主题（预设）双向绑定：写入 store 并持久化 */

/** 根据文件格式动态计算渲染组件 */
const readerComponent = computed(() => {
  if (currentFile.value.format === 'txt') return TxtReader;
  if (currentFile.value.format === 'epub') return EpubReader;
  return null;
});

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
 * 打开文件选择对话框并加载选中的电子书
 * 调用项目既有的 get-file-list IPC（sendSync），不支持格式时弹出提示
 * 不支持格式时同步清空 currentFile 并在内容区以 el-empty 形式展示提示文本
 *
 * @returns 无返回值
 */
/**
 * 顶部栏右侧功能区的鼠标滚轮处理：将纵向滚轮映射为横向滚动，
 * 便于小屏幕下用普通鼠标滚动查看被裁切的「目录/笔记/字体/字号/设置」。
 * 仅当容器确实存在横向溢出时生效；到达左/右边缘时让出默认行为，避免卡死页面滚动。
 *
 * @param e - 滚轮事件对象
 * @returns 无返回值
 */
function onToolbarRightWheel(e: WheelEvent) {
  const el = toolbarRightRef.value;
  if (!el) return;
  // 不存在横向溢出时不拦截，保持原生行为
  if (el.scrollWidth <= el.clientWidth) return;

  // 优先取纵向滚轮 deltaY；若已携带横向意图（如触控板）则取 deltaX
  const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
  if (delta === 0) return;

  const atStart = el.scrollLeft <= 0;
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
  // 已到边缘：不拦截，让页面/外层正常滚动
  if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;

  // 仅在确能横向滚动时阻止默认，避免无谓拦截纵向页面滚动
  e.preventDefault();
  el.scrollLeft += delta;
}

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
 * 子组件进度更新事件处理
 * 同步到 store 并通过 IPC 持久化到数据库
 * 同时按 500ms 节流刷新书架进度（addToBookshelf）
 *
 * @param payload - 进度数据，包含 cfi 定位与百分比
 * @returns 无返回值
 */
async function onProgressUpdate(payload: { cfi: string; percent: number }) {
  // 更新当前阅读位置 cfi（供书签抽屉高亮当前书签）
  currentFileCfi.value = payload.cfi;
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
 * EpubReader 目录地标加载完成事件处理
 *
 * @param items - 地标项数组（封面/正文/目录等）
 * @returns 无返回值
 */
function onLandmarksLoaded(items: any[]) {
  tocLandmarks.value = Array.isArray(items) ? items : [];
}

/**
 * EpubReader 当前阅读位置 href 变更事件处理（用于目录高亮）
 *
 * @param href - 当前章节 href
 * @returns 无返回值
 */
function onCurrentHref(href: string) {
  currentFileHref.value = href || '';
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
 * EpubReader 书签列表变更事件处理
 * 接收 BookmarkRecord[]，直接回填到父组件书签列表用于抽屉展示
 *
 * @param items - 子组件 emit 的书签 payload
 * @returns 无返回值；payload 非数组时清空当前列表
 */
function onBookmarksUpdated(items: BookmarkRecord[]) {
  bookmarks.value = Array.isArray(items) ? items : [];
}

/**
 * 书签抽屉项点击事件处理
 * 调用子组件暴露的 jumpToBookmark 方法跳转到书签位置，并关闭抽屉
 *
 * @param item - 被点击的书签项
 * @returns 无返回值
 */
function onBookmarkClick(item: BookmarkRecord) {
  readerRef.value?.jumpToBookmark?.(item.cfi);
  bookmarkDrawerVisible.value = false;
}

/**
 * 书签抽屉项删除事件处理
 * 弹出确认框，确认后调用子组件暴露的 removeBookmark 删除对应书签，并同步父组件列表
 *
 * @param item - 待删除的书签项
 * @returns 无返回值；用户取消时不做任何操作
 */
async function onBookmarkDelete(item: BookmarkRecord) {
  try {
    await ElMessageBox.confirm('确认删除该书签？', '提示', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  readerRef.value?.removeBookmark?.(item.id);
  bookmarks.value = bookmarks.value.filter((b) => b.id !== item.id);
  ElMessage.success('已删除书签');
}

/**
 * EpubReader 全文搜索结果变更事件处理
 * 接收 EpubSearchResult[]，直接回填到父组件搜索结果列表用于搜索面板展示
 *
 * @param items - 子组件 emit 的搜索命中 payload
 * @returns 无返回值
 */
function onSearchResults(items: EpubSearchResult[]) {
  searchResults.value = Array.isArray(items) ? items : [];
}

/**
 * EpubReader 搜索进行中状态变更事件处理
 *
 * @param val - 是否正在搜索
 * @returns 无返回值
 */
function onSearching(val: boolean) {
  searching.value = val;
}

/**
 * 搜索面板触发搜索
 * 转发关键词到子组件暴露的 runSearch 方法（子组件遍历 spine 检索并回传结果）
 *
 * @param term - 搜索关键词
 * @returns 无返回值
 */
function onSearch(term: string) {
  readerRef.value?.runSearch?.(term);
}

/**
 * 搜索面板点击命中项
 * 调用子组件暴露的 jumpToSearchResult 方法跳转并关闭搜索面板
 *
 * @param item - 被点击的搜索命中项
 * @returns 无返回值
 */
function onSearchJump(item: EpubSearchResult) {
  readerRef.value?.jumpToSearchResult?.(item.cfi);
  searchPanelVisible.value = false;
}

/**
 * 阅读区内 A-/A+ 字号快捷调整
 * 接收目标字号并写入 store 持久化（store 变化会同步 props.fontSize → 子组件自动重排）
 *
 * @param size - 目标字号 px
 * @returns 无返回值
 */
function onFontSizeChange(size: number) {
  setFontSize(size);
}

/**
 * 笔记抽屉项点击事件处理
 * 调用子组件暴露的 jumpToAnnotation 方法跳转到划线位置，并关闭抽屉
 *
 * @param item - 被点击的笔记项
 * @returns 无返回值
 */
function onAnnotationClick(item: AnnotationDisplayItem) {
  if (annotationSourceFile.value) {
    // 书架来源：书尚未打开，点击条目先打开该书（阅读位置由保存的进度恢复）
    const book = bookshelf.value.find((b) => b.path === annotationSourceFile.value);
    annotationDrawerVisible.value = false;
    annotationSourceFile.value = null;
    if (book) {
      openBook(book);
    }
    return;
  }
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
    // 刷新书架卡片上的笔记/划线数量徽标
    refreshCounts();
  } catch (err) {
    // 用户点击取消时 ElMessageBox.reject 抛出 'cancel'，此处统一忽略
    // 真正的异常（如 IPC 调用失败）已在上方 try 中通过 ElMessage.error 提示
    if (err !== 'cancel' && err !== 'close') {
      console.error('删除划线异常', err);
    }
  }
}

/**
 * 从书架打开某本书的笔记抽屉（不打开书本体）
 * 加载该书的笔记与划线到抽屉展示，并标记来源文件
 *
 * @param item - 书架条目
 * @returns 无返回值
 */
async function openShelfAnnotations(item: BookshelfItem): Promise<void> {
  annotationSourceFile.value = item.path;
  const res = await window.ipcRenderer.ebook.getAnnotations(item.path);
  if (res?.success) {
    annotations.value = (res.data || []).map((r) => ({
      id: r.id,
      anchor: r.anchor,
      text: r.text,
      note: r.note || '',
    }));
  } else {
    annotations.value = [];
  }
  annotationDrawerVisible.value = true;
}

/**
 * 导出当前笔记抽屉所查看的书（书架来源则导出该书，否则导出当前打开的书）
 *
 * @returns 无返回值
 */
async function exportCurrentAnnotations(): Promise<void> {
  if (annotationSourceFile.value) {
    const book = bookshelf.value.find((b) => b.path === annotationSourceFile.value);
    const title = `${book?.name?.replace(/\.[^.]+$/, '') || '电子书'}笔记与划线`;
    const res = await window.ipcRenderer.ebook.exportAnnotations({
      filePath: annotationSourceFile.value,
      title,
    });
    handleExportResult(res);
  } else if (currentFile.value.path) {
    const title = `${currentFile.value.name.replace(/\.[^.]+$/, '')}笔记与划线`;
    const res = await window.ipcRenderer.ebook.exportAnnotations({
      filePath: currentFile.value.path,
      title,
    });
    handleExportResult(res);
  }
}

/**
 * 保存笔记编辑（由 AnnotationDrawer 的 save-note 事件触发，调用 updateAnnotation IPC）
 *
 * @param payload - { id: 标注 id, text: 笔记内容 }
 * @returns 无返回值
 */
async function saveShelfNote(payload: { id: number; text: string }): Promise<void> {
  const { id, text } = payload;
  try {
    const res = await window.ipcRenderer.ebook.updateAnnotation({
      id,
      note: text,
    });
    if (!res?.success) {
      ElMessage.error(`保存失败：${res?.error || '未知错误'}`);
      return;
    }
    // 同步本地列表中的笔记内容
    const target = annotations.value.find((a) => a.id === id);
    if (target) {
      target.note = text;
    }
    ElMessage.success('笔记已保存');
    // 笔记/划线分类可能变化（划线加笔记后变成笔记），刷新书架徽标
    refreshCounts();
  } catch (err) {
    console.error('保存笔记失败', err);
  }
}

// 组件挂载时加载书架列表（从数据库读取）并拉取系统字体供字体选择使用
onMounted(() => {
  // 加载书架后刷新每本书的笔记/划线数量徽标
  loadBookshelf().then(() => refreshCounts());
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
    tocLandmarks.value = [];
    currentFileHref.value = '';
    annotations.value = [];
    annotationDrawerVisible.value = false;
    annotationSourceFile.value = null;
    bookmarks.value = [];
    bookmarkDrawerVisible.value = false;
    currentFileCfi.value = '';
    searchResults.value = [];
    searching.value = false;
    searchPanelVisible.value = false;
  }
);

// 笔记抽屉关闭时重置来源标记，避免下次打开阅读视图抽屉时误判为书架来源
watch(
  () => annotationDrawerVisible.value,
  (visible) => {
    if (!visible) {
      annotationSourceFile.value = null;
    }
  }
);

// 切换回书架视图时重新拉取每本书的笔记/划线数量徽标：
// 阅读过程中新增/删除的标注已写入数据库，回到书架需刷新计数（原返回书架逻辑在此处补回刷新）
watch(
  () => view.value,
  (val) => {
    if (val === 'bookshelf') {
      refreshCounts();
    }
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

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0; /* 核心按钮（书架/打开文件/文件名）保持完整，不随屏幕变窄被压缩 */
      min-width: 0;
    }

    /* 右侧阅读控制区：空间不足时横向滚动，保证所有功能（目录/笔记/字体/字号/设置）始终可触及 */
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: auto; /* 始终贴右 */
      flex-shrink: 1; /* 允许收缩以触发横向滚动 */
      min-width: 0;
      flex-wrap: nowrap;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: thin;
      scrollbar-color: var(--border-subtle, rgba(0, 0, 0, 0.2)) transparent;

      /* 子项不压缩，保持按钮/下拉框的可点尺寸，超出部分由容器横向滚动 */
      > * {
        flex-shrink: 0;
      }

      /* 细滚动条（webkit） */
      &::-webkit-scrollbar {
        height: 4px;
      }
      &::-webkit-scrollbar-thumb {
        background: var(--border-subtle, rgba(0, 0, 0, 0.2));
        border-radius: 2px;
      }
      &::-webkit-scrollbar-track {
        background: transparent;
      }
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
     主题（日间 / 夜间 / 护眼）由设置抽屉中的预设卡片切换，作用到整页并覆盖变量，保证外层区域
     与阅读区预设一致；阅读区的「背景（纯色/图片）/ 文字色」可在同一抽屉里进一步自定义（仅作用于正文）。 */
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

  }

  /* 顶部栏隐藏时右下角浮动设置按钮（淡入动画） */
  .floating-settings-btn {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    opacity: 0.85;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  }

  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s;
  }
  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
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
