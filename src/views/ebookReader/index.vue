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
              :bg-type="settings.bgType"
              :bg-color="settings.bgColor"
              :bg-image="settings.bgImage"
              :text-color="settings.textColor"
              :bottom-bar-visible="settings.readerBottomBarVisible"
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

        <!-- 笔记与划线抽屉：分「笔记」与「划线」两个标签页，点击项跳转到对应位置 -->
        <el-drawer
          v-model="annotationDrawerVisible"
          title="笔记与划线"
          direction="ltr"
          size="340px"
          :append-to-body="false"
        >
          <div class="annotation-drawer">
            <!-- 标签页：区分「笔记」（带笔记内容）与「划线」（纯高亮），避免二者混杂 -->
            <div class="annotation-tabs">
              <button
                class="tab-btn"
                :class="{ active: annotationTab === 'note' }"
                type="button"
                @click="annotationTab = 'note'"
              >
                <LucideIcon name="NotebookPen" :size="14" />
                <span>笔记</span>
                <span class="tab-count">{{ noteItems.length }}</span>
              </button>
              <button
                class="tab-btn"
                :class="{ active: annotationTab === 'highlight' }"
                type="button"
                @click="annotationTab = 'highlight'"
              >
                <LucideIcon name="Pen" :size="14" />
                <span>划线</span>
                <span class="tab-count">{{ highlightItems.length }}</span>
              </button>
            </div>

            <!-- 笔记标签页：展示带笔记内容的标注，点击笔记图标可展开/收起笔记 -->
            <div v-show="annotationTab === 'note'" class="annotation-list">
              <div
                v-for="item in noteItems"
                :key="item.id"
                class="annotation-item note-item"
                @click="onAnnotationClick(item)"
              >
                <div class="annotation-main">
                  <!-- 原文摘录：最多 3 行截断 -->
                  <div class="annotation-text">{{ item.text }}</div>
                  <!-- 笔记图标按钮：点击展开/收起笔记内容 -->
                  <button
                    class="note-toggle"
                    type="button"
                    :title="expandedNoteId === item.id ? '收起笔记' : '查看笔记'"
                    @click.stop="toggleNote(item.id)"
                  >
                    <LucideIcon name="NotebookPen" :size="15" />
                  </button>
                </div>
                <!-- 展开的笔记内容 -->
                <div v-if="expandedNoteId === item.id" class="annotation-note">
                  {{ item.note }}
                </div>
                <!-- 操作区：笔记可编辑与删除，删除按钮阻止冒泡避免触发跳转 -->
                <div class="annotation-actions">
                  <el-button size="small" text @click.stop="onAnnotationEdit(item)">
                    <LucideIcon name="SquarePen" :size="13" />
                    编辑
                  </el-button>
                  <el-button size="small" text @click.stop="onAnnotationDelete(item)">
                    <LucideIcon name="Trash2" :size="13" />
                    删除
                  </el-button>
                </div>
              </div>
              <div v-if="noteItems.length === 0" class="annotation-empty">
                暂无笔记
              </div>
            </div>

            <!-- 划线标签页：展示纯高亮标注，仅可删除 -->
            <div v-show="annotationTab === 'highlight'" class="annotation-list">
              <div
                v-for="item in highlightItems"
                :key="item.id"
                class="annotation-item"
                @click="onAnnotationClick(item)"
              >
                <!-- 原文摘录：最多 3 行截断 -->
                <div class="annotation-text">{{ item.text }}</div>
                <!-- 操作区：删除按钮阻止冒泡，避免触发跳转 -->
                <div class="annotation-actions">
                  <el-button size="small" text @click.stop="onAnnotationDelete(item)">
                    <LucideIcon name="Trash2" :size="13" />
                    删除
                  </el-button>
                </div>
              </div>
              <div v-if="highlightItems.length === 0" class="annotation-empty">
                暂无划线
              </div>
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
          <!-- 主题：日间 / 夜间 / 护眼 预设，点击切换整体主题并重置自定义背景/文字为跟随主题 -->
          <div class="setting-row">
            <div class="setting-head">
              <span class="setting-label">主题</span>
            </div>
            <div class="theme-preset-list">
              <button
                v-for="t in THEME_PRESETS"
                :key="t.name"
                class="theme-preset-card"
                :class="{ active: themeModel === t.name }"
                :style="{ background: t.bg, color: t.text }"
                type="button"
                @click="selectThemePreset(t.name)"
              >
                <LucideIcon :name="t.icon" :size="16" />
                <span>{{ t.label }}</span>
              </button>
            </div>
          </div>

          <!-- 背景：跟随主题 / 纯色 / 图片 -->
          <div class="setting-row">
            <div class="setting-head">
              <span class="setting-label">背景</span>
            </div>
            <el-radio-group v-model="bgTypeModel" @change="onBgTypeChange">
              <el-radio-button value="preset">跟随主题</el-radio-button>
              <el-radio-button value="color">纯色</el-radio-button>
              <el-radio-button value="image">图片</el-radio-button>
            </el-radio-group>
          </div>

          <!-- 纯色背景：背景色选择 -->
          <div class="setting-row" v-if="bgTypeModel === 'color'">
            <div class="setting-head">
              <span class="setting-label">背景色</span>
              <span class="setting-value" v-if="bgColorModel">{{ bgColorModel }}</span>
            </div>
            <!-- 预设色块：点击快速切换 -->
            <div class="color-preset-list">
              <button
                v-for="preset in BG_COLOR_PRESETS"
                :key="preset.color"
                :title="preset.label"
                class="color-preset-dot"
                :class="{ active: bgColorModel === preset.color }"
                :style="{ backgroundColor: preset.color }"
                @click="bgColorModel = preset.color"
              ></button>
            </div>
            <el-color-picker v-model="bgColorModel" />
          </div>

          <!-- 图片背景：上传本地图片作为阅读区背景 -->
          <div class="setting-row" v-if="bgTypeModel === 'image'">
            <div class="setting-head">
              <span class="setting-label">背景图</span>
            </div>
            <div class="bg-image-control">
              <input
                ref="bgImageInput"
                type="file"
                accept="image/*"
                style="display: none"
                @change="onPickBgImage"
              />
              <el-button size="small" @click="bgImageInput?.click()">选择图片</el-button>
              <el-button size="small" type="danger" text v-if="bgImageModel" @click="bgImageModel = ''">
                清除
              </el-button>
              <div
                v-if="bgImageModel"
                class="bg-image-preview"
                :style="{ backgroundImage: `url(${bgImageModel})` }"
              ></div>
            </div>
            <div class="setting-tip">图片以平铺方式作为阅读区背景（存储为 data URL，过大图片会占用较多本地空间）</div>
          </div>

          <!-- 文字颜色：自定义前景色，空值回退到主题默认 -->
          <div class="setting-row" v-if="bgTypeModel !== 'preset'">
            <div class="setting-head">
              <span class="setting-label">文字颜色</span>
              <span class="setting-value" v-if="textColorModel">{{ textColorModel }}</span>
            </div>
            <!-- 预设色块：点击快速切换 -->
            <div class="color-preset-list">
              <button
                v-for="preset in TEXT_COLOR_PRESETS"
                :key="preset.color"
                :title="preset.label"
                class="color-preset-dot"
                :class="{ active: textColorModel === preset.color }"
                :style="{ backgroundColor: preset.color }"
                @click="textColorModel = preset.color"
              ></button>
            </div>
            <div class="text-color-control">
              <el-color-picker v-model="textColorModel" />
              <el-button size="small" text @click="textColorModel = ''">使用主题默认</el-button>
            </div>
          </div>

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

          <!-- 划线样式：颜色 + 类型，由右上角设置统一预设，选中文本后直接套用，便于沉浸式阅读 -->
          <div class="setting-row">
            <div class="setting-head">
              <span class="setting-label">划线颜色</span>
            </div>
            <div class="highlight-color-list">
              <button
                v-for="c in HIGHLIGHT_COLORS"
                :key="c.name"
                class="highlight-color-dot"
                :class="{ active: highlightColorModel === c.name }"
                :style="{ background: c.value }"
                :title="c.label"
                type="button"
                @click="highlightColorModel = c.name"
              ></button>
            </div>
            <div class="setting-tip">选中文本后点击「划线 / 笔记」即按此颜色与样式标注</div>
          </div>

          <div class="setting-row">
            <div class="setting-head">
              <span class="setting-label">划线样式</span>
            </div>
            <el-radio-group v-model="highlightTypeModel">
              <el-radio-button
                v-for="t in HIGHLIGHT_TYPES"
                :key="t.name"
                :value="t.name"
              >
                {{ t.label }}
              </el-radio-button>
            </el-radio-group>
          </div>

          <div class="setting-row">
            <div class="setting-head">
              <span class="setting-label">翻页效果</span>
            </div>
            <el-radio-group v-model="pageEffectModel" :disabled="currentFile.format !== 'epub'">
              <el-radio-button
                v-for="p in PAGE_EFFECT_OPTIONS"
                :key="p.name"
                :value="p.name"
              >
                {{ p.label }}
              </el-radio-button>
            </el-radio-group>
            <div class="setting-tip">滑动 / 覆盖 / 3D 仿真翻页，仅 EPUB 阅读器生效</div>
          </div>

          <!-- 显示：控制阅读页顶部工具栏和底部翻页栏的显隐 -->
          <div class="setting-row">
            <div class="setting-head">
              <span class="setting-label">顶部栏</span>
            </div>
            <el-switch v-model="readerTopbarVisibleModel" />
            <div class="setting-tip">显示/隐藏阅读页顶部工具栏（书架、打开、目录、字体、字号、设置等）</div>
          </div>
          <div class="setting-row">
            <div class="setting-head">
              <span class="setting-label">底部栏</span>
            </div>
            <el-switch v-model="readerBottomBarVisibleModel" />
            <div class="setting-tip">显示/隐藏阅读页底部翻页控制栏（上一页、进度、页码、下一页）</div>
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
import type { EbookTheme, EbookBgType, BookshelfItem } from '@/store/useEbookReader';
import useGlobalSetting from '@/store/useGlobalSetting';
import TxtReader from './components/TxtReader.vue';
import EpubReader from './components/EpubReader.vue';
import { HIGHLIGHT_COLORS, HIGHLIGHT_TYPES } from './highlightConfig';
import { THEME_PRESETS, READING_PRESET_BG } from './themePresets';

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
  /** 按 id 编辑笔记（弹出输入框），两种阅读组件均实现 */
  editAnnotationNote?: (id: number) => void;
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

/** 书架进度刷新节流间隔（毫秒），500ms 内最多触发一次 addToBookshelf */
const BOOKSHELF_THROTTLE_MS = 500;

// 电子书阅读器 store
const ebookStore = useEbookReader();
// 解构响应式状态：currentFile 当前文件、progress 阅读进度、settings 设置、bookshelf 书架列表
const { currentFile, progress, settings, bookshelf } = storeToRefs(ebookStore);
// 解构 actions：setCurrentFile 设置当前文件、setProgress 设置进度、setFontSize 设置字号、
// setTheme 设置主题、setBgType/setBgColor/setBgImage/setTextColor 设置阅读区背景与文字色、
// loadBookshelf 加载书架、addToBookshelf 写入书架、removeFromBookshelf 删除书架
const {
  setCurrentFile,
  setProgress,
  setFontSize,
  setTheme,
  setBgType,
  setBgColor,
  setBgImage,
  setTextColor,
  setFontFamily,
  setFontFamilyEN,
  setLineHeight,
  setColumnCount,
  setScrollMode,
  setMargin,
  setHighlightColor,
  setHighlightType,
  setPageEffect,
  setReaderTopbarVisible,
  setReaderBottomBarVisible,
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

/** 仅含笔记内容的标注列表（note 非空） */
const noteItems = computed(() =>
  annotations.value.filter((a) => (a.note || '').trim().length > 0)
);
/** 仅含纯高亮的标注列表（note 为空） */
const highlightItems = computed(() =>
  annotations.value.filter((a) => !(a.note || '').trim())
);

/** 笔记抽屉显示状态 */
const annotationDrawerVisible = ref(false);
/** 笔记抽屉当前标签页：note 笔记 / highlight 划线 */
const annotationTab = ref<'note' | 'highlight'>('note');
/** 当前展开笔记内容的标注 id（同一时间仅展开一条，null 表示全部收起） */
const expandedNoteId = ref<number | null>(null);

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

/** 划线默认颜色双向绑定（右上角设置预设，划线/笔记时直接套用） */
const highlightColorModel = computed({
  get: () => settings.value.highlightColor,
  set: (val: string) => setHighlightColor(val),
});

/** 划线默认类型双向绑定（高亮 / 下划线 / 波浪线） */
const highlightTypeModel = computed({
  get: () => settings.value.highlightType,
  set: (val: string) => setHighlightType(val),
});

/** 翻页效果双向绑定（仅 epub 阅读器生效：none / slide / cover / flip3d） */
const pageEffectModel = computed({
  get: () => settings.value.pageEffect,
  set: (val: 'none' | 'slide' | 'cover' | 'flip3d') => setPageEffect(val),
});

/** 顶部栏显隐双向绑定 */
const readerTopbarVisibleModel = computed({
  get: () => settings.value.readerTopbarVisible,
  set: (val: boolean) => setReaderTopbarVisible(val),
});

/** 底部栏显隐双向绑定 */
const readerBottomBarVisibleModel = computed({
  get: () => settings.value.readerBottomBarVisible,
  set: (val: boolean) => setReaderBottomBarVisible(val),
});

/** 翻页效果选项（仅 epub 生效） */
const PAGE_EFFECT_OPTIONS = [
  { name: 'none', label: '无' },
  { name: 'slide', label: '滑动' },
  { name: 'cover', label: '覆盖' },
  { name: 'flip3d', label: '3D 仿真' },
] as const;

/** 纯色背景预设色板：8 种常用阅读背景色 */
const BG_COLOR_PRESETS = [
  { label: '纯白', color: '#FFFFFF' },
  { label: '米白', color: '#F5F0E8' },
  { label: '浅灰', color: '#E8E8E8' },
  { label: '浅绿', color: '#C8E6C9' },
  { label: '浅蓝', color: '#BBDEFB' },
  { label: '浅紫', color: '#E1BEE7' },
  { label: '深灰', color: '#2D2D2D' },
  { label: '纯黑', color: '#1A1A1A' },
] as const;

/** 文字颜色预设色板：8 种常用阅读文字色 */
const TEXT_COLOR_PRESETS = [
  { label: '深灰', color: '#333333' },
  { label: '中灰', color: '#555555' },
  { label: '暖棕', color: '#4A3728' },
  { label: '藏蓝', color: '#1A237E' },
  { label: '墨绿', color: '#2E7D32' },
  { label: '橙棕', color: '#E65100' },
  { label: '深红', color: '#880E4F' },
  { label: '浅灰白', color: '#EEEEEE' },
] as const;

/** 当前主题对应的 class（作用于整个电子书阅读页，使工具栏/书架/抽屉等区域跟随切换） */
const themeClass = computed(() => `theme-${settings.value.theme}`);

/** 主题（预设）双向绑定：写入 store 并持久化 */
const themeModel = computed<EbookTheme>({
  get: () => settings.value.theme,
  set: (v) => setTheme(v),
});

/** 阅读区背景类型双向绑定 */
const bgTypeModel = computed<EbookBgType>({
  get: () => settings.value.bgType,
  set: (v) => setBgType(v),
});

/** 阅读区背景色双向绑定 */
const bgColorModel = computed({
  get: () => settings.value.bgColor,
  set: (v: string) => setBgColor(v),
});

/** 阅读区背景图（data URL）双向绑定 */
const bgImageModel = computed({
  get: () => settings.value.bgImage,
  set: (v: string) => setBgImage(v),
});

/** 阅读区文字颜色双向绑定 */
const textColorModel = computed({
  get: () => settings.value.textColor,
  set: (v: string) => setTextColor(v),
});

/** 背景图文件选择 input 引用 */
const bgImageInput = ref<HTMLInputElement | null>(null);

/**
 * 选择主题预设（日间 / 夜间 / 护眼）
 * 切换预设的同时将自定义背景类型/颜色/图片/文字色重置为「跟随主题」，
 * 保证点选预设即呈现该预设的默认阅读配色，避免与之前残留的自定义配置叠加。
 *
 * @param name - 主题标识
 * @returns 无返回值
 */
function selectThemePreset(name: EbookTheme) {
  themeModel.value = name;
  bgTypeModel.value = 'preset';
  bgColorModel.value = '';
  bgImageModel.value = '';
  textColorModel.value = '';
}

/**
 * 背景类型切换时的兜底初始化
 * 切到「纯色」且尚未选背景色时，用当前主题的预设背景色预填，避免空背景；
 * 其余类型无需处理。
 *
 * @param val - 新选中的背景类型
 * @returns 无返回值
 */
function onBgTypeChange(val: EbookBgType) {
  if (val === 'color' && !settings.value.bgColor) {
    setBgColor(READING_PRESET_BG[settings.value.theme]);
  }
}

/**
 * 选择本地图片作为阅读区背景图
 * 读取为 data URL 存入 settings.bgImage（背景类型需为 image 才生效）。
 *
 * @param e - input change 事件
 * @returns 无返回值
 */
function onPickBgImage(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    bgImageModel.value = reader.result as string;
  };
  reader.readAsDataURL(file);
  // 重置 input，保证再次选择同一文件也会触发 change
  input.value = '';
}

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
 * 切换某条笔记的展开/收起状态
 * 点击笔记图标按钮时调用，同一时间仅展开一条以节省空间
 *
 * @param id - 标注 id
 * @returns 无返回值
 */
function toggleNote(id: number): void {
  expandedNoteId.value = expandedNoteId.value === id ? null : id;
}

/**
 * 编辑某条标注的笔记
 * 调用子组件暴露的 editAnnotationNote 方法弹出输入框，编辑成功后由子组件 emit
 * annotations-updated 同步父组件列表（展开的笔记内容会随之刷新）
 *
 * @param item - 被编辑的笔记项
 * @returns 无返回值
 */
function onAnnotationEdit(item: AnnotationDisplayItem): void {
  readerRef.value?.editAnnotationNote?.(item.id);
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
    // 若删除的正是当前展开笔记的项，收起展开状态，避免空内容残留
    if (expandedNoteId.value === item.id) {
      expandedNoteId.value = null;
    }
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
    annotationTab.value = 'note';
    expandedNoteId.value = null;
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

    /* 划线颜色色板 */
    .highlight-color-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;

      .highlight-color-dot {
        width: 26px;
        height: 26px;
        padding: 0;
        border-radius: 50%;
        border: 2px solid transparent;
        cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
        box-shadow: 0 0 0 1px var(--border-subtle);

        &:hover {
          transform: scale(1.08);
        }

        &.active {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 4px var(--color-primary);
        }
      }
    }

    /* 主题预设卡片：日间 / 夜间 / 护眼，点击切换 */
    .theme-preset-list {
      display: flex;
      gap: 10px;

      .theme-preset-card {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 12px 8px;
        border-radius: 10px;
        border: 2px solid var(--border-subtle);
        cursor: pointer;
        font-size: 13px;
        transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;

        &:hover {
          transform: translateY(-1px);
        }

        &.active {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 4px var(--color-primary);
        }
      }
    }

    /* 背景图上传控件 */
    .bg-image-control {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;

      .bg-image-preview {
        width: 100%;
        height: 64px;
        margin-top: 4px;
        border-radius: 8px;
        border: 1px solid var(--border-subtle);
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      }
    }

    /* 文字颜色控件：取色器 + 恢复默认 */
    .text-color-control {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* 背景色 / 文字颜色预设色板 */
    .color-preset-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .color-preset-dot {
      width: 26px;
      height: 26px;
      padding: 0;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 0 0 1px var(--border-subtle);
      outline: none;

      &:hover {
        transform: scale(1.12);
      }

      &.active {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 4px var(--color-primary);
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

  /* 笔记与划线抽屉：标签页切换，区分「笔记」与「划线」 */
  .annotation-drawer {
    display: flex;
    flex-direction: column;
    height: 100%;

    .annotation-tabs {
      display: flex;
      gap: 8px;
      padding: 0 4px 12px;
      border-bottom: 1px solid var(--border-subtle);
      margin-bottom: 8px;

      .tab-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: 1px solid var(--border-subtle);
        border-radius: calc(var(--radius-card, 6px) - 2px);
        background: transparent;
        color: var(--text-secondary);
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s;

        .tab-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 9px;
          background: var(--bg-hover, rgba(0, 0, 0, 0.06));
          font-size: 11px;
          font-variant-numeric: tabular-nums;
        }

        &:hover {
          color: var(--text-primary);
          border-color: var(--color-primary);
        }

        &.active {
          color: #fff;
          background: var(--color-primary);
          border-color: var(--color-primary);

          .tab-count {
            background: rgba(255, 255, 255, 0.25);
            color: #fff;
          }
        }
      }
    }
  }

  /* 笔记与划线列表：参考 .toc-list 风格 */
  .annotation-list {
    flex: 1;
    overflow: auto;
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

      .annotation-main {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;

        .annotation-text {
          flex: 1;
          min-width: 0;
        }
      }

      /* 原文摘录：最多 3 行截断 */
      .annotation-text {
        font-size: 13px;
        line-height: 1.5;
        color: var(--text-primary);
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* 笔记图标按钮：点击展开/收起笔记 */
      .note-toggle {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--color-primary);
        cursor: pointer;
        transition: background-color 0.15s;

        &:hover {
          background: var(--bg-hover, rgba(0, 0, 0, 0.06));
        }
      }

      /* 展开的笔记内容：左侧竖线区分，主题色突出 */
      .annotation-note {
        margin-top: 6px;
        padding: 8px 10px;
        font-size: 12px;
        line-height: 1.6;
        color: var(--text-secondary);
        background: var(--bg-base);
        border-left: 2px solid var(--color-primary);
        border-radius: 4px;
        white-space: pre-wrap;
        word-break: break-word;
      }

      /* 操作区：按钮靠右 */
      .annotation-actions {
        display: flex;
        justify-content: flex-end;
        gap: 4px;
        margin-top: 6px;
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
