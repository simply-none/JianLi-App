<template>
  <div
    ref="pdfContainer"
    class="pdf-reader"
    :class="themeClass"
    :style="{ background: readerBg, color: readerText }"
    v-loading="loading"
    element-loading-text="正在加载文件..."
  >
    <!-- 阅读区滚动容器：整本文档连续纵向排列，固定为连续滚动模式；滚轮由浏览器原生纵向滚动，可逐页完整浏览 -->
    <div
      ref="scrollRef"
      class="pdf-scroll is-scroll"
      @scroll="onScroll"
      @wheel="onWheel"
      @mouseup="onMouseUp"
    >
      <!-- 每页：.pdf-page（含 <canvas> + 文本层 + 划线层），整本在容器内纵向连续排列 -->
      <div
        v-for="n in pageList"
        :key="n"
        class="pdf-page"
        :data-page="n"
        :ref="(el: any) => setPageRef(n, el)"
        :style="pageStyle(n)"
      >
        <canvas class="pdf-canvas" :ref="(el: any) => setCanvasRef(n, el)"></canvas>
        <div class="pdf-text-layer" :ref="(el: any) => setTextRef(n, el)"></div>
        <div class="pdf-hl-layer" :ref="(el: any) => setHlRef(n, el)" @click="onHlClick"></div>
      </div>

      <!-- 阅读区左右边缘点击区：仅 paginated 模式；点击上一页 / 下一页，便于沉浸式翻页 -->
      <div
        v-show="mode !== 'scroll' && props.edgeClickEnabled !== false"
        class="edge-turn-zone edge-turn-zone--left"
        :style="{ width: (props.edgeClickPercent ?? 10) + '%' }"
        @click="onEdgePrev"
        title="上一页"
      ></div>
      <div
        v-show="mode !== 'scroll' && props.edgeClickEnabled !== false"
        class="edge-turn-zone edge-turn-zone--right"
        :style="{ width: (props.edgeClickPercent ?? 10) + '%' }"
        @click="onEdgeNext"
        title="下一页"
      ></div>
    </div>

    <!-- 底部进度控制区：连续滚动模式下作为「跳页」条（上一页/下一页平滑滚动、滑块跳到指定页） -->
    <div class="pdf-footer" v-show="props.bottomBarVisible !== false">
      <div class="page-nav">
        <el-button size="small" :disabled="currentPage <= 1 || loading" @click="prevPage">
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
          <LucideIcon :name="currentBookmarked ? 'BookmarkXIcon' : 'BookmarkPlus'" :size="14" />
          书签
        </el-button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <el-button size="small" :disabled="currentPage >= totalPages || loading" @click="nextPage">
          下一页
          <LucideIcon name="ArrowRight" :size="14" />
        </el-button>
      </div>
      <!-- 进度条：拖动跳转到对应页 -->
      <div class="progress-slider" v-if="totalPages > 0">
        <el-slider
          v-model="currentPage"
          :min="1"
          :max="totalPages"
          :step="1"
          :show-tooltip="false"
          @change="onSliderChange"
        />
      </div>
    </div>

    <!-- 选中文本后的浮动工具条：划线/笔记 -->
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
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import LucideIcon from '@/components/LucideIcon.vue';
import AnnotationToolbar from './AnnotationToolbar.vue';
// 阅读设置 store：划线颜色/类型由右上角「阅读设置」预设
import useEbookReader from '@/store/useEbookReader';
// 渲染 / 标注逻辑 composable（共享 ctx）
import type { PdfAnnotation } from '../composables/pdfContext';
import type { EpubSearchResult } from '../types';
import { createPdfCtx } from '../composables/pdfContext';
import { usePdfRender } from '../composables/usePdfRender';
import { usePdfHighlight } from '../composables/usePdfHighlight';
import { usePdfOutline } from '../composables/usePdfOutline';
import { usePdfBookmarks } from '../composables/usePdfBookmarks';
import { usePdfSearch } from '../composables/usePdfSearch';

/** PDF 阅读器根容器 */
const pdfContainer = ref<HTMLElement | null>(null);
/** 阅读区滚动容器 */
const scrollRef = ref<HTMLElement | null>(null);
/** 阅读设置 store：划线颜色/类型由右上角「阅读设置」预设，此处直接读取 */
const ebookStore = useEbookReader();
const { settings } = storeToRefs(ebookStore);

/** 组件 Props 定义 */
const props = defineProps<{
  /** 文件绝对路径 */
  filePath: string;
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
  /** 是否显示底部翻页控制栏 */
  bottomBarVisible?: boolean;
  /** 翻页模式：false=翻页（paginated）、true=滚动（scroll） */
  scrollMode?: boolean;
  /** 是否启用阅读区左右边缘点击翻页 */
  edgeClickEnabled?: boolean;
  /** 边缘点击翻页感应区宽度百分比，默认 10 */
  edgeClickPercent?: number;
  /** 是否启用鼠标滚轮翻页 */
  wheelPageEnabled?: boolean;
  /** 鼠标滚轮翻页灵敏度 1-10，默认 5 */
  wheelPageSensitivity?: number;
  /** 以下为父组件统一透传但 PDF 阅读器暂未使用的属性（声明以避免作为 DOM 属性泄漏） */
  fontSize?: number;
  fontFamily?: string;
  fontFamilyEn?: string;
  lineHeight?: number;
  columnCount?: number;
  margin?: number;
  letterSpacing?: number;
  paragraphSpacing?: number;
  firstLineIndent?: number;
  underlineGap?: number;
  /** 划线线宽（px），默认 2 */
  hlLineThickness?: number;
  /** 高亮背景块上下外扩间距（px），默认 2 */
  hlRowPaddingY?: number;
  /** PDF 适应方式：'width' 适应宽度 / 'height' 适应高度 */
  pdfFitMode?: 'width' | 'height';
}>();

/** 组件 Emits 定义 */
const emit = defineEmits<{
  /** 阅读进度更新事件 */
  (
    e: 'progress-update',
    payload: { cfi: string; percent: number; filePath?: string }
  ): void;
  /** 划线/笔记变化事件（新增、删除、编辑后均会触发） */
  (e: 'annotations-updated', payload: PdfAnnotation[]): void;
  /** 目录/outline 加载完成事件 */
  (e: 'toc-loaded', payload: any[]): void;
  /** 目录地标加载完成事件（PDF 无地标，回传空数组） */
  (e: 'landmarks-loaded', payload: any[]): void;
  /** 当前阅读位置页码变更（"page:N"），用于目录高亮 */
  (e: 'current-href', payload: string): void;
  /** 书签列表变更事件 */
  (e: 'bookmarks-updated', payload: BookmarkRecord[]): void;
  /** 全文搜索结果变更事件 */
  (e: 'search-results', payload: EpubSearchResult[]): void;
  /** 搜索进行中状态变更事件 */
  (e: 'searching', payload: boolean): void;
}>();

// 构建共享 ctx，并由若干 composable 分别接管渲染 / 标注 / 目录 / 书签 / 搜索逻辑
const ctx = createPdfCtx(props, emit, settings, pdfContainer, scrollRef);
// 先初始化 highlight（注册 loadAnnotations / onHighlightClick 回调），再初始化 render（mounted 时加载文档并触发该回调）
const highlight = usePdfHighlight(ctx);
const render = usePdfRender(ctx);
// 目录/outline、书签、全文搜索（复用外壳 TocDrawer / BookmarksDrawer / SearchPanel）
const outline = usePdfOutline(ctx);
const bookmarks = usePdfBookmarks(ctx);
const search = usePdfSearch(ctx);
// 注册目录/书签加载回调：由 render.loadDocument 在文档就绪后依次调用
ctx.loadOutline = outline.loadOutline;
ctx.loadBookmarks = bookmarks.loadBookmarks;

// 模板所需绑定（reactive ref 解构后仍保持响应性）
const {
  themeClass,
  readerBg,
  readerText,
  loading,
  onScroll,
  onWheel,
  onHlClick,
  mode,
  pageList,
  scalePercent,
  currentPage,
  totalPages,
  prevPage,
  nextPage,
  onEdgePrev,
  onEdgeNext,
  onSliderChange,
  zoomIn,
  zoomOut,
  zoomReset,
} = render;
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
  onMouseUp,
} = highlight;
const { currentBookmarked, toggleBookmark } = bookmarks;

// 当前页变化 → 回传 current-href（"page:N"），供外壳 TocDrawer 高亮当前所在目录项
watch(currentPage, (p) => {
  emit('current-href', `page:${p}`);
});

/** 单页尺寸样式（未算好前给 0，避免布局抖动） */
function pageStyle(n: number): Record<string, string> {
  const s = ctx.pageSizes[n];
  return {
    width: s ? `${s.w}px` : '0px',
    height: s ? `${s.h}px` : '0px',
  };
}

/** 把页面/画布/文本层/划线层元素写入对应的 ref Map（Vue ref 回调；卸载时 el 为 null 需清理） */
function setPageRef(n: number, el: any): void {
  if (el) ctx.pageRefs.set(n, el as HTMLElement);
  else ctx.pageRefs.delete(n);
}
function setCanvasRef(n: number, el: any): void {
  if (el) ctx.canvasRefs.set(n, el as HTMLCanvasElement);
  else ctx.canvasRefs.delete(n);
}
function setTextRef(n: number, el: any): void {
  if (el) ctx.textRefs.set(n, el as HTMLElement);
  else ctx.textRefs.delete(n);
}
function setHlRef(n: number, el: any): void {
  if (el) ctx.hlRefs.set(n, el as HTMLElement);
  else ctx.hlRefs.delete(n);
}

// 暴露跳转到划线、移除本地划线、编辑笔记，以及目录/书签/搜索方法，供父组件通过 ref 调用
defineExpose({
  jumpToAnnotation: render.jumpToAnnotation,
  removeAnnotationById: highlight.removeAnnotationById,
  editAnnotationNote: highlight.editAnnotationNote,
  goToTocPage: (p: number) => render.goToPage(p, true),
  zoomIn: render.zoomIn,
  zoomOut: render.zoomOut,
  zoomReset: render.zoomReset,
  scalePercent: render.scalePercent,
  jumpToBookmark: bookmarks.jumpToBookmark,
  removeBookmark: bookmarks.removeBookmark,
  runSearch: search.runSearch,
  jumpToSearchResult: search.jumpToSearchResult,
});
</script>

<style scoped lang="scss">
.pdf-reader {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  transition: background-color 0.3s, color 0.3s;

  /* 阅读区滚动容器：包裹所有页面与左右边缘点击区，作为定位与裁切上下文 */
  .pdf-scroll {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 0;
    gap: 16px;

    /* 滚动模式：原生纵向滚动，允许内容溢出滚动 */
    &.is-scroll {
      overflow: auto;
      scrollbar-width: thin;
    }

    /* 单页容器：相对定位，承载 canvas / 文本层 / 划线层三层叠加 */
    .pdf-page {
      position: relative;
      flex-shrink: 0;
      background: #ffffff;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
      overflow: hidden;

      .pdf-canvas {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 1;
        user-select: none;
      }

      /* 文本层：pdf.js 在此生成透明文字（<span> 直接子元素 + <br>），用于选区；
         覆盖在 canvas 之上、划线层之下。
         关键坑：① span 由 pdf.js 运行时动态创建，没有 SFC 的 scoped 属性，子元素规则必须
         用 :deep() 才能命中；② 必须提供 pdf.js v6 文本层官方的字号还原规则
         （--min-font-size / --text-scale-factor / --font-height / --scale-x），否则 span 字号
         塌陷、与 canvas 严重错位，导致无法正确选中文字、划线矩形也随之错乱。
         这些变量由 pdf.js 在渲染时写入（--font-height 等），并由 usePdfRender 注入
         --total-scale-factor / --scale-round-x/y。 */
      .pdf-text-layer {
        position: absolute;
        inset: 0;
        z-index: 2;
        color: transparent;
        line-height: 1;
        text-align: initial;
        letter-spacing: normal;
        word-spacing: normal;
        -webkit-text-size-adjust: none;
        -moz-text-size-adjust: none;
        text-size-adjust: none;
        forced-color-adjust: none;
        transform-origin: 0 0;
        overflow: clip;
        opacity: 1;
        caret-color: CanvasText;
        cursor: text;

        /* pdf.js 文本层字体缩放变量（与官方 pdf_viewer.css 一致） */
        --min-font-size: 1;
        --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
        --min-font-size-inv: calc(1 / var(--min-font-size));

        /* 透明文字层被选中时显示选区高亮 */
        ::selection {
          background: rgba(0, 0, 255, 0.25);
          color: transparent;
        }
        ::-moz-selection {
          background: rgba(0, 0, 255, 0.25);
          color: transparent;
        }

        /* 运行时动态生成的文字 span / 换行（无 scoped 属性，需用 :deep 穿透） */
        :deep(span),
        :deep(br) {
          color: transparent;
          position: absolute;
          white-space: pre;
          cursor: text;
          transform-origin: 0% 0%;
          -webkit-user-select: text;
          -moz-user-select: text;
          user-select: text;
        }

        /* 直接子节点（文字 span）：用 pdf.js 注入的 --font-height / --scale-x 等变量
           还原字号与横向缩放，使其与 canvas 像素对齐 */
        :deep(:not(.markedContent)),
        :deep(.markedContent span:not(.markedContent)) {
          --font-height: 0;
          font-size: calc(var(--text-scale-factor) * var(--font-height));
          --scale-x: 1;
          --rotate: 0deg;
          transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
        }
      }

      /* 划线层：覆盖在最上层；整体透明穿透，仅 .pdf-hl 块接收点击。
         注意：.pdf-hl 及其子元素均由 JS 运行时动态创建，无 scoped 属性，
         因此所有子规则都必须用 :deep() 穿透。另外，.pdf-page 有 overflow:hidden，
         线型装饰必须画在 div 自身尺寸范围内，否则会被截断（典型：双下划线第二条线）。 */
      .pdf-hl-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 3;
        pointer-events: none;

        /* 划线块基础：动态创建，用 :deep 命中 */
        :deep(.pdf-hl) {
          position: absolute;
          pointer-events: auto;
          cursor: pointer;
          border-radius: 2px;
          /* 划线颜色由 JS 通过 --hl-color 传入（含透明度的 rgba），供各类型 class 复用 */
          --hl-color: transparent;
          /* 以下间距/线宽参数均可由 props 注入、在阅读设置中实时调整，
             解决「固定参数导致划线贴向下一行」的问题 */
          /* 下划线/双下划线 相对文字行底部上抬的间隙：正值把线往上提，避免贴近下一行 */
          --hl-line-offset-y: 2px;
          /* 划线线宽（下划线/删除线/双下划线） */
          --hl-line-thickness: 2px;
          /* 高亮背景块上下外扩间距：正值让高亮离开上下行，不被相邻行挤占 */
          --hl-row-pad-y: 2px;
        }

        /* 高亮：仅用半透明背景（由 JS 经 --hl-color 以 0.28 透明度注入），
           底层 canvas 黑字透过半透明背景清晰可见。
           不修改文本层 span 颜色——文本层透明字与 canvas 黑字重叠会造成「重影」，
           故高亮只用背景层着色（与 pdf.js 官方 viewer 一致）。 */
        :deep(.pdf-hl--highlight) {
          /* 高亮背景用 ::before 外扩 --hl-row-pad-y，避免紧贴上下行；
             线/文字仍由底层的 canvas 文本层保证清晰可辨 */
          &::before {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            top: calc(-1 * var(--hl-row-pad-y));
            bottom: calc(-1 * var(--hl-row-pad-y));
            background: var(--hl-color);
            border-radius: inherit;
            pointer-events: none;
          }
        }

        /* 下划线：底部单线；用 ::after 画在 div 下边缘、上抬 --hl-line-offset-y（避免贴近下一行） */
        :deep(.pdf-hl--underline) {
          background: transparent;

          /* 单下划线：画在 div 下边缘、上抬 --hl-line-offset-y，避免贴近下一行 */
          &::after {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            bottom: var(--hl-line-offset-y);
            height: var(--hl-line-thickness);
            background: var(--hl-color);
            pointer-events: none;
          }
        }

        /* 删除线：穿过文字中部的横线 */
        :deep(.pdf-hl--mark) {
          background: transparent;

          /* 删除线：穿过文字中部（top:50%），线宽取 --hl-line-thickness */
          &::after {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            top: 50%;
            transform: translateY(-50%);
            height: var(--hl-line-thickness);
            background: var(--hl-color);
            pointer-events: none;
          }
        }

        /* 双下划线：底部两条线（::after 第一条 + ::before 第二条）。
           两条线都用定位画在 div box 内（相对文字行底部上抬 --hl-line-offset-y / 再下移 4px），
           不依赖 padding-bottom 外扩，避免被 .pdf-page 的 overflow:hidden 截断，也不会侵入下一行。 */
        :deep(.pdf-hl--markStrong) {
          background: transparent;

          /* 第一条线：贴近文字基线（与单下划线位置一致，上抬 --hl-line-offset-y） */
          &::after {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            bottom: var(--hl-line-offset-y);
            height: var(--hl-line-thickness);
            background: var(--hl-color);
            pointer-events: none;
          }

          /* 第二条线：比第一条再下移 4px，始终落在文字 box 内、不溢出到下一行 */
          &::before {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            bottom: calc(var(--hl-line-offset-y) + 4px);
            height: var(--hl-line-thickness);
            background: var(--hl-color);
            pointer-events: none;
          }
        }

        /* 笔记标记：动态创建的 span 子元素，同样要用 :deep 命中 */
        :deep(.pdf-hl-note) {
          position: absolute;
          top: -6px;
          right: 2px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--hl-color);
          border: 1px solid #fff;
          box-shadow: 0 0 2px rgba(0, 0, 0, 0.45);
          pointer-events: none;
        }

        /* 笔记抽屉点击跳转后，闪烁对应划线以辅助定位（box-shadow 不依赖背景，划线/高亮均可见） */
        :deep(.pdf-hl.is-flash) {
          z-index: 3;
          animation: pdf-hl-flash 1.4s ease;
        }
      }
    }

    @keyframes pdf-hl-flash {
      0% {
        box-shadow: 0 0 0 0 rgba(255, 145, 0, 0);
      }
      18% {
        box-shadow: 0 0 0 3px rgba(255, 145, 0, 0.95);
      }
      55% {
        box-shadow: 0 0 0 3px rgba(255, 145, 0, 0.45);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(255, 145, 0, 0);
      }
    }

    /* 阅读区左右边缘点击翻页区：透明覆盖层；hover 时整区高亮，颜色跟随主题 */
    .edge-turn-zone {
      position: absolute;
      top: 0;
      bottom: 0;
      z-index: 10;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      transition: background-color 0.18s ease;

      &:hover {
        background-color: var(--edge-hover-bg, rgba(0, 0, 0, 0.06));
      }

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
  }

  /* 缩放控制：常驻右上角 */
  

  .pdf-footer {
    flex-shrink: 0;
    padding: 8px 16px;
    border-top: 1px solid var(--border-subtle, #e5e5e5);
    background: var(--bg-card, #fff);

    .page-nav {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-bottom: 6px;

      .page-info {
        font-size: 13px;
        color: var(--text-secondary, #666);
        min-width: 80px;
        text-align: center;
      }
    }

    .progress-slider {
      max-width: 400px;
      margin: 0 auto;
    }
  }

  /* 白天主题：白底黑字 */
  &.theme-day {
    --edge-hover-bg: rgba(0, 0, 0, 0.06);
    --edge-arrow-color: rgba(0, 0, 0, 0.28);

    

    .pdf-footer {
      --bg-card: #ffffff;
      --border-subtle: #e5e5e5;
    }
  }

  /* 夜间主题：深色背景浅色字 */
  &.theme-night {
    --edge-hover-bg: rgba(255, 255, 255, 0.10);
    --edge-arrow-color: rgba(255, 255, 255, 0.38);

    

    .pdf-footer {
      background-color: #2a2a2a;
      border-top-color: #3a3a3a;
    }
  }

  /* 护眼主题：护眼绿底深色字 */
  &.theme-eye {
    --edge-hover-bg: rgba(0, 0, 0, 0.05);
    --edge-arrow-color: rgba(0, 0, 0, 0.24);

    

    .pdf-footer {
      background-color: #c7edcc;
      border-top-color: #a9d9af;
    }
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
