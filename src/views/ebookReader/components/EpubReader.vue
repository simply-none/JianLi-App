<template>
  <div class="epub-reader" :class="themeClass" v-loading="loading" element-loading-text="正在加载电子书...">
    <!-- epub 渲染容器：epubjs 会将内容渲染到此元素；监听 mouseup 记录鼠标坐标，用于浮动工具条定位 -->
    <!-- 页边距：以视口容器 padding 实现（epubjs 在分页布局中会给 iframe body 写死 margin:0 !important，
         无法通过 themes.override('margin') 生效），容器收缩后由 ResizeObserver 触发重新分页渲染 -->
    <div
      class="epub-viewport"
      :style="{ padding: (props.margin ?? 24) + 'px' }"
      @wheel="onWheelPageTurn"
    >
      <div ref="readerRef" class="epub-viewer" @mouseup="onReaderMouseup"></div>
      <!-- 阅读区左右边缘点击区：点击上一页 / 下一页，便于沉浸式翻页（开关与百分比在设置中调整） -->
      <div
        v-show="props.edgeClickEnabled !== false"
        class="edge-turn-zone edge-turn-zone--left"
        :style="{ width: (props.edgeClickPercent ?? 10) + '%' }"
        @click="onEdgePrev"
        title="上一页"
      ></div>
      <div
        v-show="props.edgeClickEnabled !== false"
        class="edge-turn-zone edge-turn-zone--right"
        :style="{ width: (props.edgeClickPercent ?? 10) + '%' }"
        @click="onEdgeNext"
        title="下一页"
      ></div>
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
      <el-button
        size="small"
        :disabled="loading"
        :type="currentBookmarked ? 'warning' : ''"
        @click="toggleBookmark"
        :title="currentBookmarked ? '取消书签' : '添加书签'"
      >
        <LucideIcon :name="currentBookmarked ? 'BookmarkCheck' : 'Bookmark'" :size="14" />
        书签
      </el-button>
      <span class="progress-text">{{ progressText }}</span>
      <span v-if="hasPageList" class="print-page-text">{{ printPage }}</span>
      <span v-else class="page-text">{{ pageText }}</span>
      <div class="font-quick">
        <el-button size="small" :disabled="loading || (ctx.settings.value.fontSize <= 12)" @click="onAdjustFont(-1)" title="减小字号">
          <LucideIcon name="Minus" :size="14" />
        </el-button>
        <el-button size="small" :disabled="loading || (ctx.settings.value.fontSize >= 32)" @click="onAdjustFont(1)" title="增大字号">
          <LucideIcon name="Plus" :size="14" />
        </el-button>
      </div>
      <el-button size="small" :disabled="loading" @click="nextPage">
        下一页
        <LucideIcon name="ArrowRight" :size="14" />
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import LucideIcon from '@/components/LucideIcon.vue';
// 浮动工具条组件：选中文本后弹出，提供「划线」「笔记」两个操作
import AnnotationToolbar from './AnnotationToolbar.vue';
// 划线颜色/类型统一配置（颜色映射、默认值等）
import useEbookReader from '@/store/useEbookReader';
// 阅读设置 store：划线颜色/类型由右上角「阅读设置」预设
import type { EpubAnnotation, EpubSearchResult } from '../types';
// 渲染 / 标注逻辑 composable（共享 ctx）
import { createEpubCtx } from '../composables/epubContext';
import { useEpubRender } from '../composables/useEpubRender';
import { useEpubHighlight } from '../composables/useEpubHighlight';
import { useEpubBookmarks } from '../composables/useEpubBookmarks';
import { useEpubSearch } from '../composables/useEpubSearch';
import { useEpubPageNumbers } from '../composables/useEpubPageNumbers';

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
  (e: 'toc-loaded', payload: any[]): void;
  /** 标注列表变更事件：新增/编辑/删除划线或笔记后触发，payload 为最新标注列表 */
  (e: 'annotations-updated', payload: EpubAnnotation[]): void;
  /** 书签列表变更事件：新增/删除书签后触发，payload 为最新书签列表 */
  (e: 'bookmarks-updated', payload: BookmarkRecord[]): void;
  /** 全文搜索结果变更事件：搜索完成后触发，payload 为命中结果列表 */
  (e: 'search-results', payload: EpubSearchResult[]): void;
  /** 搜索进行中状态变更事件：开始/结束时触发，payload 为是否正在搜索 */
  (e: 'searching', payload: boolean): void;
  /** 目录地标（landmarks）加载完成事件，payload 为地标项数组（封面/正文/目录等） */
  (e: 'landmarks-loaded', payload: any[]): void;
  /** 当前阅读位置 href 变更事件，payload 为当前章节 href（用于目录高亮） */
  (e: 'current-href', payload: string): void;
  /** 字号快捷调整事件（A-/A+ 按钮触发），payload 为目标字号 px */
  (e: 'font-size-change', payload: number): void;
}>();

/** epub 渲染容器引用 */
const readerRef = ref<HTMLElement | null>(null);
/** 阅读设置 store：划线颜色/类型由右上角「阅读设置」预设，此处直接读取 */
const ebookStore = useEbookReader();
const { settings } = storeToRefs(ebookStore);

// 构建共享 ctx，并由两个 composable 分别接管渲染与标注逻辑
const ctx = createEpubCtx(props, emit, settings, readerRef);
// 注意：先初始化 highlight（注册 onSelected / loadAnnotations / refreshAnnotations 回调），
// 再初始化 render（注册 updatePageInfo 并在 mounted 时调用 renderEpub，其内部会触发上述回调）
const highlight = useEpubHighlight(ctx);
const bookmarks = useEpubBookmarks(ctx);
const search = useEpubSearch(ctx);
const pageNumbers = useEpubPageNumbers(ctx);
const render = useEpubRender(ctx);

// 模板所需绑定（reactive ref 解构后仍保持响应性）
const { themeClass, pageText, loading, progressText, onWheelPageTurn, onReaderMouseup, onEdgePrev, onEdgeNext, prevPage, nextPage } =
  render;
const {
  toolbarVisible,
  toolbarX,
  toolbarY,
  onToolbarHighlight,
  onToolbarNote,
  noteDialogVisible,
  onNoteDialogClosed,
  noteInput,
  deleteCurrentAnnotation,
  saveNote,
} = highlight;
const { currentBookmarked, toggleBookmark } = bookmarks;
const { printPage, hasPageList } = pageNumbers;

/** 字号快捷调整（A-/A+）：计算新的受限字号并通知父组件持久化 */
function onAdjustFont(delta: number): void {
  const cur = ctx.settings.value.fontSize ?? 16;
  const next = Math.max(12, Math.min(32, cur + delta));
  if (next !== cur) {
    ctx.emit('font-size-change', next);
  }
}

// 暴露方法供父组件调用：
// - displayTarget：跳转到指定 cfi 或 href（目录跳转）
// - jumpToAnnotation：跳转到指定划线位置（笔记抽屉点击调用）
// - removeAnnotationById：按 id 移除本地划线（笔记抽屉删除后同步高亮）
// - editAnnotationNote：按 id 弹出输入框编辑笔记（笔记抽屉「编辑」调用）
defineExpose({
  displayTarget: render.displayTarget,
  jumpToAnnotation: highlight.jumpToAnnotation,
  removeAnnotationById: highlight.removeAnnotationById,
  editAnnotationNote: highlight.editAnnotationNote,
  jumpToBookmark: bookmarks.jumpToBookmark,
  removeBookmark: bookmarks.removeBookmark,
  runSearch: search.runSearch,
  jumpToSearchResult: search.jumpToSearchResult,
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

  /* 阅读区左右边缘点击翻页区：透明覆盖层；hover 时整区高亮，颜色跟随主题 */
  .edge-turn-zone {
    position: absolute;
    top: 0;
    bottom: 0;
    /* 宽度由组件内联样式按 edgeClickPercent 注入，此处不写死 */
    z-index: 10;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    transition: background-color 0.18s ease;

    /* hover 时整区高亮（颜色取自当前主题选择器定义的 --edge-hover-bg） */
    &:hover {
      background-color: var(--edge-hover-bg, rgba(0, 0, 0, 0.06));
    }

    /* 居中箭头提示：hover 时浮现，颜色跟随主题（--edge-arrow-color） */
    &::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 11px;
      height: 11px;
      border-top: 2px solid var(--edge-arrow-color, rgba(0, 0, 0, 0.3));
      border-right: 2px solid var(--edge-arrow-color, rgba(0, 0, 0, 0.3));
      transform: translateY(-50%) rotate(45deg);
      opacity: 0;
      transition: opacity 0.18s ease;
      pointer-events: none;
    }

    &:hover::after {
      opacity: 1;
    }
  }

  .edge-turn-zone--left {
    left: 0;

    &::after {
      left: calc(50% - 4px);
      transform: translateY(-50%) rotate(-135deg);
    }
  }

  .edge-turn-zone--right {
    right: 0;

    &::after {
      right: calc(50% - 4px);
      transform: translateY(-50%) rotate(45deg);
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

    .print-page-text {
      font-size: 13px;
      color: var(--text-secondary);
      min-width: 96px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .font-quick {
      display: inline-flex;
      gap: 4px;
    }
  }

  /* 白天主题 */
  &.theme-day {
    background-color: #ffffff;
    --edge-hover-bg: rgba(0, 0, 0, 0.06);
    --edge-arrow-color: rgba(0, 0, 0, 0.28);
  }

  /* 夜间主题 */
  &.theme-night {
    background-color: #1a1a1a;
    --edge-hover-bg: rgba(255, 255, 255, 0.10);
    --edge-arrow-color: rgba(255, 255, 255, 0.38);

    .epub-footer {
      background-color: #2a2a2a;
      border-top-color: #3a3a3a;
    }
  }

  /* 护眼主题 */
  &.theme-eye {
    background-color: #c7edcc;
    --edge-hover-bg: rgba(0, 0, 0, 0.05);
    --edge-arrow-color: rgba(0, 0, 0, 0.24);
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

<!--
  全局（非 scoped）样式：epub.js 的标注 <svg> 由 JS 动态注入到 .epub-reader 容器内，
  不会带有 Vue 的 scoped 属性，因此必须用非 scoped 规则才能命中。
  用途：修正下划线「边框」异常——epub.js 的 Underline.render() 对每个文本框画一个
  <rect fill="none">（仅定位）并继承 <g> 的 stroke，导致显示成一圈边框；真正的下划线是 <line>。
  这里强制 <rect> 不描边，并把 <line> 的颜色取自 <g> inline style 的 CSS 变量（由 useEpubHighlight 写入）。
-->
<style lang="scss">
.epub-reader {
  /* 下划线的 <rect> 仅用于定位，不应显示边框 */
  g.epub-highlight > rect {
    stroke: none !important;
  }

  /* 下划线条颜色取自 <g> inline style 的 CSS 变量；该变量在翻页/缩放重建 SVG 后仍由 CSS 命中，
     相比旧版 MutationObserver 二次着色的 hack 更稳健 */
  g.epub-highlight > line {
    stroke: var(--hl-stroke, #000) !important;
    stroke-opacity: var(--hl-stroke-opacity, 1) !important;
    stroke-width: 2 !important;
    stroke-linecap: square;
  }
}
</style>
