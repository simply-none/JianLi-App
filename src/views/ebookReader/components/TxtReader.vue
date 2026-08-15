<template>
  <div
    ref="txtContainer"
    class="txt-reader"
    :class="themeClass"
    :style="{ background: readerBg, color: readerText }"
    v-loading="loading"
    element-loading-text="正在加载文件..."
  >
    <!-- 阅读区视口：paginated 模式 overflow hidden + translateX 翻页；scroll 模式 overflow auto 原生滚动 -->
    <div
      ref="viewportRef"
      class="txt-viewport"
      :class="{ 'is-scroll': mode === 'scroll' }"
      :style="{ padding: margin + 'px' }"
      @wheel="onWheelPageTurn"
      @scroll="onScroll"
      @mouseup="onMouseUp"
    >
      <!-- 正文连续流：整章作为单元素，CSS 多列分页或单列滚动；分段 span 渲染以支持划线高亮 -->
      <div ref="flowRef" class="txt-flow" :style="flowStyle">
        <span
          v-for="(seg, i) in pageSegments"
          :key="i"
          :data-start="seg.globalStart"
          :class="seg.isHighlight ? getTypeClass(seg.type) : ''"
          :style="getSegmentStyle(seg)"
          @click="seg.isHighlight && onHighlightClick(seg.annotationId, seg.note)"
          >{{ seg.text }}</span
        >
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

    <!-- 底部翻页与进度控制区：仅 paginated 模式显示 -->
    <div class="txt-footer" v-show="mode !== 'scroll' && props.bottomBarVisible !== false">
      <div class="page-nav">
        <el-button size="small" :disabled="currentPage <= 0 || loading" @click="prevPage">
          <LucideIcon name="ArrowLeft" :size="14" />
          上一页
        </el-button>
        <span class="page-info">
          {{ totalPages > 0 ? currentPage + 1 : 0 }} / {{ totalPages }}
        </span>
        <el-button size="small" :disabled="currentPage >= totalPages - 1 || loading" @click="nextPage">
          下一页
          <LucideIcon name="ArrowRight" :size="14" />
        </el-button>
      </div>
      <!-- 进度条：拖动跳转到对应屏 -->
      <div class="progress-slider" v-if="totalPages > 0">
        <el-slider
          v-model="sliderValue"
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
import { ref } from 'vue';
import { storeToRefs } from 'pinia';

/** 禁用默认 attribute 透传：父组件传入的未声明 props 不应落到阅读区根 div，
 * 避免 PDF / EPUB 专用参数作为 HTML attributes 干扰 TXT 的多列布局。 */
defineOptions({ inheritAttrs: false });
import LucideIcon from '@/components/LucideIcon.vue';
import AnnotationToolbar from './AnnotationToolbar.vue';
// 阅读设置 store：划线颜色/类型由右上角「阅读设置」预设
import useEbookReader from '@/store/useEbookReader';
// 渲染 / 标注逻辑 composable（共享 ctx）
import type { TxtAnnotation } from '../composables/txtContext';
import { createTxtCtx } from '../composables/txtContext';
import { useTxtRender } from '../composables/useTxtRender';
import { useTxtHighlight } from '../composables/useTxtHighlight';

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
  /** 正文行距倍率（作用于 .txt-flow line-height） */
  lineHeight?: number;
  /** 分栏数：1 单栏、2 双栏（paginated 模式下每屏显示的列数） */
  columnCount?: number;
  /** 翻页模式：false=翻页（paginated）、true=滚动（scroll） */
  scrollMode?: boolean;
  /** 页边距，单位 px（作用于 .txt-viewport 内边距） */
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
  /** 划线/笔记变化事件（新增、删除、编辑后均会触发） */
  (e: 'annotations-updated', payload: TxtAnnotation[]): void;
  /** 书籍基本信息事件（TXT 无元数据，此处仅声明以配合父组件统一绑定，不发射） */
  (e: 'book-meta', payload: { title: string; author: string; cover: string }): void;
}>();

/** TXT 阅读器根容器 */
const txtContainer = ref<HTMLElement | null>(null);
/** 阅读区视口（裁切容器：paginated 时 overflow hidden，scroll 时 overflow auto） */
const viewportRef = ref<HTMLElement | null>(null);
/** 正文连续流容器（CSS 多列分页 / 单列滚动，翻页用 translateX 位移） */
const flowRef = ref<HTMLElement | null>(null);
/** 阅读设置 store：划线颜色/类型由右上角「阅读设置」预设，此处直接读取 */
const ebookStore = useEbookReader();
const { settings } = storeToRefs(ebookStore);

// 构建共享 ctx，并由两个 composable 分别接管渲染与标注逻辑
const ctx = createTxtCtx(props, emit, settings, txtContainer, viewportRef, flowRef);
// 先初始化 highlight（注册 loadAnnotations 回调），再初始化 render（mounted 时调用 loadContent 触发该回调）
const highlight = useTxtHighlight(ctx);
const render = useTxtRender(ctx);

// 模板所需绑定（reactive ref 解构后仍保持响应性）
const {
  themeClass,
  readerBg,
  readerText,
  loading,
  onWheelPageTurn,
  onScroll,
  mode,
  flowStyle,
  fontFamilyValue,
  lineHeight,
  columnCount,
  margin,
  pageSegments,
  getTypeClass,
  getSegmentStyle,
  onEdgePrev,
  onEdgeNext,
  currentPage,
  totalPages,
  prevPage,
  nextPage,
  sliderValue,
  onSliderChange,
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
  onHighlightClick,
  onMouseUp,
} = highlight;

// 暴露跳转到划线、移除本地划线、编辑笔记方法供父组件通过 ref 调用
defineExpose({
  jumpToAnnotation: render.jumpToAnnotation,
  removeAnnotationById: highlight.removeAnnotationById,
  editAnnotationNote: highlight.editAnnotationNote,
});
</script>

<style scoped lang="scss">
.txt-reader {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  transition: background-color 0.3s, color 0.3s;

  /* 阅读区视口：包裹正文流与左右边缘点击区，作为定位与裁切上下文 */
  .txt-viewport {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    box-sizing: border-box;

    /* 滚动模式：原生纵向滚动，允许内容溢出滚动 */
    &.is-scroll {
      overflow: auto;
      scrollbar-width: thin;
    }

    .txt-flow {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.8;
      /* 不在此处写死 font-family：否则会覆盖从 .txt-reader 继承的用户字体设置，
         使「正文字体」设置对 TXT 完全失效。默认字体由 fontFamilyValue 兜底提供。 */
      min-height: 100%;

      /* 高亮段样式：黄底圆角，三种主题下均可见 */
      .txt-highlight {
        background-color: rgba(255, 235, 59, 0.4);
        cursor: pointer;
        border-radius: 2px;
      }
    }
  }

  .txt-footer {
    flex-shrink: 0;
    padding: 8px 16px;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-card);

    .page-nav {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-bottom: 6px;

      .page-info {
        font-size: 13px;
        color: var(--text-secondary);
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
    background-color: #ffffff;
    color: #333333;
    --edge-hover-bg: rgba(0, 0, 0, 0.06);
    --edge-arrow-color: rgba(0, 0, 0, 0.28);

    .txt-flow {
      color: inherit;
    }
  }

  /* 夜间主题：深色背景浅色字 */
  &.theme-night {
    background-color: #1a1a1a;
    color: #cccccc;
    --edge-hover-bg: rgba(255, 255, 255, 0.10);
    --edge-arrow-color: rgba(255, 255, 255, 0.38);

    .txt-flow {
      color: inherit;
    }

    .txt-footer {
      background-color: #2a2a2a;
      border-top-color: #3a3a3a;
    }

    /* 夜间主题下高亮加深不透明度，确保黄底可识别 */
    .txt-flow .txt-highlight {
      background-color: rgba(255, 235, 59, 0.55);
    }
  }

  /* 拖拽选区进行中：临时禁用左右边缘翻页区的 pointer-events，
     避免其 user-select:none 在选区拖到边缘时拦截选区延伸（跨页选区需要选区能延伸到边缘之外） */
  &.is-selecting {
    .edge-turn-zone {
      pointer-events: none;
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

  /* 护眼主题：护眼绿底深色字 */
  &.theme-eye {
    background-color: #c7edcc;
    color: #2c3e50;
    --edge-hover-bg: rgba(0, 0, 0, 0.05);
    --edge-arrow-color: rgba(0, 0, 0, 0.24);

    .txt-flow {
      color: inherit;
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
