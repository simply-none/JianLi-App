<template>
  <div
    ref="txtContainer"
    class="txt-reader"
    :class="themeClass"
    :style="{ background: readerBg, color: readerText }"
    v-loading="loading"
    element-loading-text="正在加载文件..."
  >
    <!-- 阅读内容区：按页展示 txt 文本，分段 span 渲染以支持划线高亮 -->
    <div class="txt-viewport">
      <div
        class="txt-content"
        :style="{ fontSize: fontSize + 'px', fontFamily: fontFamilyValue, padding: margin + 'px' }"
        @mouseup="onMouseUp"
      >
        <div class="txt-page" :style="{ lineHeight: lineHeight, columnCount: columnCount }">
          <span
            v-for="(seg, i) in pageSegments"
            :key="i"
            :data-start="seg.globalStart"
            :class="seg.isHighlight ? getTypeClass(seg.type) : ''"
            :style="getSegmentStyle(seg)"
            @click="seg.isHighlight && onHighlightClick(seg.annotationId, seg.note)"
          >{{ seg.text }}</span>
        </div>
      </div>
      <!-- 阅读区左右边缘 10% 点击区：点击上一页 / 下一页，便于沉浸式翻页 -->
      <div class="edge-turn-zone edge-turn-zone--left" @click="onEdgePrev" title="上一页"></div>
      <div class="edge-turn-zone edge-turn-zone--right" @click="onEdgeNext" title="下一页"></div>
    </div>

    <!-- 底部翻页与进度控制区 -->
    <div class="txt-footer" v-show="props.bottomBarVisible !== false">
      <div class="page-nav">
        <el-button
          size="small"
          :disabled="currentPage <= 0 || loading"
          @click="prevPage"
        >
          <LucideIcon name="ArrowLeft" :size="14" />
          上一页
        </el-button>
        <span class="page-info">
          {{ totalPages > 0 ? currentPage + 1 : 0 }} / {{ totalPages }}
        </span>
        <el-button
          size="small"
          :disabled="currentPage >= totalPages - 1 || loading"
          @click="nextPage"
        >
          下一页
          <LucideIcon name="ArrowRight" :size="14" />
        </el-button>
      </div>
      <!-- 进度条：拖动跳转到对应页 -->
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import AnnotationToolbar from './AnnotationToolbar.vue';
// 划线颜色/类型统一配置（颜色映射、默认值等）
import { HIGHLIGHT_COLOR_MAP } from '../highlightConfig';
import { resolveReadingBg, resolveReadingText } from '../themePresets';
// 阅读设置 store：划线颜色/类型由右上角「阅读设置」预设
import useEbookReader from '@/store/useEbookReader';
// 全局设置 store：sidebarVisible / topbarVisible 变化时阅读区域尺寸改变，需重载
import useGlobalSetting from '@/store/useGlobalSetting';

/** 阅读主题类型：day 白天、night 夜间、eye 护眼 */
type EbookTheme = 'day' | 'night' | 'eye';
/** 阅读区背景类型：preset 跟随主题 / color 纯色 / image 背景图 */
type EbookBgType = 'preset' | 'color' | 'image';

/** 单页数据结构 */
interface TxtPage {
  /** 当前页文本内容 */
  content: string;
  /** 当前页起始字符在全文中的偏移量 */
  startOffset: number;
}

/** 划线高亮数据结构（本地维护，start/end 为全文字符偏移） */
interface TxtAnnotation {
  /** 划线记录自增主键 */
  id: number;
  /** 划线起始字符在全文中的偏移量 */
  start: number;
  /** 划线结束字符在全文中的偏移量（exclusive） */
  end: number;
  /** 选中的原文摘录 */
  text: string;
  /** 笔记内容，可为空字符串 */
  note: string;
  /** 高亮颜色标识，如 'yellow'、'green'、'blue' 等 */
  color: string;
  /** 划线类型：'highlight'（高亮）、'underline'（下划线）、'wavy'（波浪线） */
  type: string;
}

/** 当前页分段渲染结构：由 pageSegments computed 生成 */
interface Segment {
  /** 该段文本内容 */
  text: string;
  /** 是否为高亮段 */
  isHighlight: boolean;
  /** 高亮段对应的划线记录 id；普通段为 null */
  annotationId: number | null;
  /** 该段在全文中的起始字符偏移量（用于 data-start 属性） */
  globalStart: number;
  /** 高亮颜色标识，如 'yellow'；普通段为空字符串 */
  color: string;
  /** 划线类型：'highlight'、'underline'、'wavy'；普通段为空字符串 */
  type: string;
  /** 笔记内容，仅高亮段携带（点击时用于判断进编辑弹窗还是直接删除）；普通段为空字符串 */
  note: string;
}

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
  /** 正文行距倍率（作用于 .txt-page line-height） */
  lineHeight?: number;
  /** 分栏数：1 单栏、2 双栏（作用于 .txt-page column-count） */
  columnCount?: number;
  /** 页边距，单位 px（作用于 .txt-content padding） */
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
  /** 划线/笔记变化事件（新增、删除、编辑后均会触发） */
  (e: 'annotations-updated', payload: TxtAnnotation[]): void;
}>();

/** 每页目标字符数（按段落边界切分，实际会略有浮动） */
const PAGE_CHAR_SIZE = 1500;

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
 * 根据类型获取高亮样式类名
 *
 * @param type - 划线类型 ('highlight' | 'underline' | 'wavy')
 * @returns CSS 类名
 */
function getTypeClass(type: string): string {
  switch (type) {
    case 'underline':
      return 'txt-underline';
    case 'wavy':
      return 'txt-wavy';
    case 'highlight':
    default:
      return 'txt-highlight';
  }
}

/**
 * 获取高亮段的内联样式对象
 * 根据类型和颜色生成对应的 CSS 样式
 *
 * @param segment - 分段数据
 * @returns 样式对象
 */
function getSegmentStyle(segment: Segment): Record<string, string> {
  if (!segment.isHighlight) return {};
  const colorValue = getColorValue(segment.color);
  switch (segment.type) {
    case 'underline':
      return {
        'text-decoration': `underline ${colorValue}`,
        'text-decoration-thickness': '2px',
        'text-underline-offset': '3px',
      };
    case 'wavy':
      return {
        'text-decoration': `wavy ${colorValue}`,
        'text-decoration-thickness': '2px',
        'text-underline-offset': '3px',
      };
    case 'highlight':
    default:
      return {
        'background-color': colorValue,
      };
  }
}

/** 加载状态 */
const loading = ref(false);
/** 全文内容 */
const fullContent = ref('');
/** 分页后的页面列表 */
const pages = ref<TxtPage[]>([]);
/** 当前页码（0 起始） */
const currentPage = ref(0);
/** 滑块绑定值（1 起始，对应 currentPage + 1） */
const sliderValue = ref(1);

/** 本地维护的划线列表（与数据库同步） */
const annotations = ref<TxtAnnotation[]>([]);
/** 浮动工具条是否显示 */
const toolbarVisible = ref(false);
/** 浮动工具条定位 x 坐标（相对视口，px） */
const toolbarX = ref(0);
/** 浮动工具条定位 y 坐标（相对视口，px） */
const toolbarY = ref(0);
/** 临时存储当前选区信息（mouseup 后存入，工具条按钮点击时消费） */
const currentSelection = ref<{ start: number; end: number; text: string } | null>(null);

/** 笔记编辑弹窗显示状态 */
const noteDialogVisible = ref(false);
/** 当前正在编辑的标注记录 id */
const currentEditAnnotationId = ref<number | null>(null);
/** 笔记编辑弹窗中的输入内容 */
const noteInput = ref('');

/** TXT 阅读器根容器（供 ResizeObserver 监听尺寸变化） */
const txtContainer = ref<HTMLElement | null>(null);

/** 总页数 */
const totalPages = computed(() => pages.value.length);

/** 当前页文本内容 */
const currentPageContent = computed(() => {
  if (pages.value.length === 0) return '';
  return pages.value[currentPage.value]?.content ?? '';
});

/**
 * 当前页分段渲染计算属性
 * 根据当前页 startOffset 与落在本页的划线，把 currentPageContent 切成交替的普通段/高亮段
 * 依赖 pages、currentPage、annotations，任一变化自动重算
 *
 * @returns Segment 数组；无当前页时返回空数组
 */
const pageSegments = computed<Segment[]>(() => {
  const page = pages.value[currentPage.value];
  if (!page) return [];
  const content = page.content;
  // 当前页在全文中的字符区间 [pageStart, pageEnd)
  const pageStart = page.startOffset;
  const pageEnd = pageStart + content.length;

  // 找出所有与当前页区间相交的划线，并将 start/end 裁剪到本页区间内
  const intersected = annotations.value
    .filter((a) => a.start < pageEnd && a.end > pageStart)
    .map((a) => ({
      id: a.id,
      start: Math.max(a.start, pageStart),
      end: Math.min(a.end, pageEnd),
      color: a.color,
      type: a.type,
      note: a.note,
    }))
    .sort((x, y) => x.start - y.start);

  const segments: Segment[] = [];
  // 游标：当前已切分到的全局 offset
  let cursor = pageStart;

  for (const a of intersected) {
    // 防止重叠划线导致负长度切片：已被前一段覆盖完则跳过
    if (a.end <= cursor) continue;
    // 起点被前一段覆盖时，截到当前游标位置
    const segStart = Math.max(a.start, cursor);

    // 普通文本段（高亮段之前的未高亮文本）
    if (segStart > cursor) {
      const text = content.substring(cursor - pageStart, segStart - pageStart);
      segments.push({ text, isHighlight: false, annotationId: null, globalStart: cursor, color: '', type: '', note: '' });
    }
    // 高亮段（携带 color 和 type 信息）
    const highlightText = content.substring(segStart - pageStart, a.end - pageStart);
    segments.push({ text: highlightText, isHighlight: true, annotationId: a.id, globalStart: segStart, color: a.color, type: a.type, note: a.note });
    cursor = a.end;
  }
  // 末尾普通文本段
  if (cursor < pageEnd) {
    const text = content.substring(cursor - pageStart);
    segments.push({ text, isHighlight: false, annotationId: null, globalStart: cursor, color: '', type: '', note: '' });
  }
  return segments;
});

/** 主题 class 计算属性 */
const themeClass = computed(() => `theme-${props.theme}`);

/**
 * 阅读区实际背景 CSS 值：image 优先用背景图，color 用背景色，其余回退主题预设背景
 * （背景类型/颜色/图片均来自设置，见 themePresets.resolveReadingBg）
 */
const readerBg = computed(() =>
  resolveReadingBg(props.bgType ?? 'preset', props.bgColor ?? '', props.bgImage ?? '', props.theme)
);

/**
 * 阅读区实际文字颜色：自定义非空则用自定义，否则回退主题预设文字色
 */
const readerText = computed(() => resolveReadingText(props.textColor ?? '', props.theme));

/**
 * 合并中文/英文正文字体为 CSS font-family 值
 * 任一字体为空时回退到组件默认字体，保证未设置时仍有良好排版
 */
const fontFamilyValue = computed(() => {
  const cn = props.fontFamily || "'Microsoft YaHei', 'PingFang SC'";
  const en = props.fontFamilyEn || 'sans-serif';
  return `${cn}, ${en}`;
});

/** 正文本地行距倍率（缺省 1.8，与默认设置一致） */
const lineHeight = computed(() => props.lineHeight ?? 1.8);
/** 分栏数（缺省 1 单栏） */
const columnCount = computed(() => props.columnCount ?? 1);
/** 页边距 px（缺省 24，与默认设置一致） */
const margin = computed(() => props.margin ?? 24);

/**
 * 按段落边界对文本进行分页
 * 避免在段落中间断开，保证阅读体验
 *
 * @param text - 全文文本内容
 * @param targetSize - 每页目标字符数，默认 1500
 * @returns 分页后的 TxtPage 数组；空文本返回空数组
 */
function paginate(text: string, targetSize: number = PAGE_CHAR_SIZE): TxtPage[] {
  if (!text) return [];
  // 按换行符切分段落，保留空段落以维持原文格式
  const paragraphs = text.split(/\r?\n/);
  const result: TxtPage[] = [];
  let currentText = '';
  let pageStartOffset = 0;
  let cursorOffset = 0;

  for (const para of paragraphs) {
    // 当前段落长度 + 换行符
    const paraLen = para.length + 1;

    // 若当前页非空且加入该段落后超出目标大小，则结束当前页并开启新页
    if (currentText.length > 0 && currentText.length + paraLen > targetSize) {
      result.push({ content: currentText, startOffset: pageStartOffset });
      pageStartOffset = cursorOffset;
      currentText = para;
    } else {
      // 追加段落，保留换行
      currentText += (currentText.length > 0 ? '\n' : '') + para;
    }
    cursorOffset += paraLen;
  }
  // 处理最后一页
  if (currentText.length > 0) {
    result.push({ content: currentText, startOffset: pageStartOffset });
  }
  return result;
}

/**
 * 加载 txt 文件内容并分页
 * 调用主进程 IPC 读取文件，失败时弹出错误提示；同时恢复阅读进度与划线
 *
 * @param filePath - 文件绝对路径
 * @returns 成功返回 void；失败弹出 ElMessage 错误提示
 */
async function loadContent(filePath: string) {
  if (!filePath) return;
  loading.value = true;
  try {
    const res = await window.ipcRenderer.ebook.readTxt(filePath);
    // 主进程失败时返回 { error }
    if (res?.error) {
      ElMessage.error(res.error);
      return;
    }
    fullContent.value = res?.content ?? '';
    pages.value = paginate(fullContent.value);

    // 恢复上次阅读进度
    await restoreProgress(filePath);
    // 恢复该文件的所有划线
    await loadAnnotations(filePath);
  } catch (err: any) {
    ElMessage.error(`加载文件失败：${err?.message || String(err)}`);
  } finally {
    loading.value = false;
  }
}

/**
 * 恢复上次阅读进度
 * 从数据库读取进度记录，若有记录则跳转到对应页
 *
 * @param filePath - 文件绝对路径
 * @returns 成功返回 void；失败静默处理（进度恢复失败不影响阅读）
 */
async function restoreProgress(filePath: string) {
  try {
    const res = await window.ipcRenderer.ebook.getProgress(filePath);
    if (res?.success && res.data?.cfi) {
      // txt 文件用字符 offset 作为 cfi 字段
      const offset = parseInt(res.data.cfi, 10);
      if (!isNaN(offset) && offset > 0) {
        jumpToOffset(offset);
      }
    }
  } catch (err) {
    // 进度恢复失败不阻断阅读
    console.error('恢复阅读进度失败', err);
  }
}

/**
 * 根据字符偏移量跳转到对应页
 *
 * @param offset - 字符偏移量
 * @returns 无返回值；找不到对应页时停留在第一页
 */
function jumpToOffset(offset: number) {
  const idx = pages.value.findIndex((p, i) => {
    const next = pages.value[i + 1];
    return p.startOffset <= offset && (!next || next.startOffset > offset);
  });
  if (idx >= 0) {
    currentPage.value = idx;
    sliderValue.value = idx + 1;
  }
}

/**
 * 跳转到指定划线锚点所在页（供父组件通过 ref 调用）
 * 解析 anchor 的 start 偏移后复用 jumpToOffset
 *
 * @param anchor - 划线锚点字符串，格式 "start-end"
 * @returns 无返回值
 */
function jumpToAnnotation(anchor: string) {
  // anchor 格式 "start-end"，取起始偏移跳页
  const parts = anchor.split('-');
  const start = parseInt(parts[0], 10);
  if (!isNaN(start)) {
    jumpToOffset(start);
  }
}

/**
 * 加载指定文件的划线列表
 * 调用主进程 IPC 获取记录，解析 anchor 后填入本地 annotations，pageSegments 自动响应式渲染
 *
 * @param filePath - 文件绝对路径
 * @returns 成功返回 void；失败静默处理（划线加载失败不影响阅读）
 */
async function loadAnnotations(filePath: string) {
  try {
    const res = await window.ipcRenderer.ebook.getAnnotations(filePath);
    if (res?.success && Array.isArray(res.data)) {
      annotations.value = res.data.map((r: AnnotationRecord): TxtAnnotation => {
        // anchor 格式 "start-end"，解析出全文字符偏移
        const parts = (r.anchor || '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parseInt(parts[1], 10) || 0;
        return {
          id: r.id,
          start,
          end,
          text: r.text || '',
          note: r.note || '',
          color: r.color || 'yellow',
          type: r.type || 'highlight',
        };
      });
      emit('annotations-updated', annotations.value);
    }
  } catch (err) {
    // 划线加载失败不阻断阅读
    console.error('加载划线失败', err);
  }
}

/**
 * 新增划线高亮
 * 调用主进程 IPC 持久化，成功后 push 到本地 annotations 触发响应式重渲染
 *
 * @param start - 划线起始全局字符偏移
 * @param end - 划线结束全局字符偏移（exclusive）
 * @param text - 选中的原文摘录
 * @param note - 笔记内容，默认空字符串
 * @param color - 高亮颜色标识，默认 'yellow'
 * @param type - 划线类型，默认 'highlight'
 * @returns 成功返回新记录 id；失败返回 null
 */
async function addHighlight(
  start: number,
  end: number,
  text: string,
  note: string = '',
  color: string = 'yellow',
  type: string = 'highlight'
): Promise<number | null> {
  try {
    const anchor = `${start}-${end}`;
    const res = await window.ipcRenderer.ebook.addAnnotation({
      filePath: props.filePath,
      format: 'txt',
      anchor,
      text,
      note,
      color,
      type,
    });
    if (!res?.success || typeof res.id !== 'number') {
      ElMessage.error('添加划线失败');
      return null;
    }
    annotations.value.push({
      id: res.id,
      start,
      end,
      text,
      note,
      color,
      type,
    });
    emit('annotations-updated', annotations.value);
    return res.id;
  } catch (err: any) {
    ElMessage.error(`添加划线失败：${err?.message || String(err)}`);
    return null;
  }
}

/**
 * 根据 Range 的 container 与 offset 计算全局字符偏移
 * container 通常是文本节点，向上找最近的带 data-start 属性的 span，返回 data-start + offset
 *
 * @param container - Range 的 startContainer/endContainer 节点
 * @param offset - Range 的 startOffset/endOffset
 * @returns 全局字符偏移量；找不到 data-start 祖先时返回 -1
 */
function getGlobalOffset(container: Node, offset: number): number {
  // 文本节点：取父元素的 closest('[data-start]')
  if (container.nodeType === Node.TEXT_NODE) {
    const span = container.parentElement?.closest('[data-start]') as Element | null;
    if (!span) return -1;
    const ds = Number(span.getAttribute('data-start'));
    return isNaN(ds) ? -1 : ds + offset;
  }
  // 元素节点：offset 为子节点索引，尝试取该子节点的 data-start 祖先
  if (container.nodeType === Node.ELEMENT_NODE) {
    const child = container.childNodes[offset];
    if (child) {
      const childEl =
        child.nodeType === Node.TEXT_NODE ? child.parentElement : (child as Element);
      const span = childEl?.closest('[data-start]') as Element | null;
      if (span) {
        const ds = Number(span.getAttribute('data-start'));
        return isNaN(ds) ? -1 : ds;
      }
    }
    // offset 指向末尾时，取 container 自身或祖先的 data-start 并加上其文本长度
    const selfSpan = (container as Element).closest('[data-start]') as Element | null;
    if (selfSpan) {
      const ds = Number(selfSpan.getAttribute('data-start'));
      const textLen = selfSpan.textContent?.length || 0;
      return isNaN(ds) ? -1 : ds + textLen;
    }
  }
  return -1;
}

/**
 * 鼠标抬起事件处理：计算选区全局偏移并定位浮动工具条
 * 无选区时隐藏工具条；选区有效时存入 currentSelection 并显示工具条
 *
 * @param _e - 鼠标事件对象（未使用，保留以便后续扩展）
 * @returns 无返回值
 */
function onMouseUp(_e: MouseEvent) {
  const selection = window.getSelection();
  // 无选区或选区折叠时隐藏工具条
  if (!selection || selection.isCollapsed) {
    toolbarVisible.value = false;
    return;
  }
  const text = selection.toString();
  if (!text) {
    toolbarVisible.value = false;
    return;
  }
  const range = selection.getRangeAt(0);
  const start = getGlobalOffset(range.startContainer, range.startOffset);
  const end = getGlobalOffset(range.endContainer, range.endOffset);
  // 偏移无效或起止倒置时隐藏工具条
  if (start < 0 || end < 0 || start >= end) {
    toolbarVisible.value = false;
    return;
  }
  // 先存入选区，避免点击工具条按钮时浏览器选区丢失
  currentSelection.value = { start, end, text };
  // 用选区矩形定位工具条：水平居中、底部贴合
  const rect = range.getBoundingClientRect();
  toolbarX.value = rect.left + rect.width / 2;
  toolbarY.value = rect.bottom;
  toolbarVisible.value = true;
}

/**
 * 工具条「划线」按钮事件处理
 * 对 currentSelection 执行纯划线（无笔记），完成后关闭工具条并清除浏览器选区
 * 颜色与样式取自阅读设置 store（右上角「阅读设置」预设），无需在工具条上选择
 *
 * @returns 无返回值
 */
async function onToolbarHighlight(): Promise<void> {
  if (!currentSelection.value) return;
  const { start, end, text } = currentSelection.value;
  await addHighlight(start, end, text, '', settings.value.highlightColor, settings.value.highlightType);
  toolbarVisible.value = false;
  window.getSelection()?.removeAllRanges();
  currentSelection.value = null;
}

/**
 * 工具条「笔记」按钮事件处理
 * 先保存纯划线得到 id，再弹窗输入笔记内容并更新；取消输入则保留纯划线
 * 颜色与样式取自阅读设置 store（右上角「阅读设置」预设）
 *
 * @returns 无返回值
 */
async function onToolbarNote(): Promise<void> {
  if (!currentSelection.value) return;
  const { start, end, text } = currentSelection.value;
  const color = settings.value.highlightColor;
  const type = settings.value.highlightType;
  const id = await addHighlight(start, end, text, '', color, type);
  if (id !== null) {
    try {
      const { value } = await ElMessageBox.prompt('请输入笔记', '添加笔记', {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputType: 'textarea',
      });
      const note = (value || '').trim();
      if (note) {
        const upd = await window.ipcRenderer.ebook.updateAnnotation({ id, note, color, type });
        if (upd?.success) {
          const ann = annotations.value.find((a) => a.id === id);
          if (ann) ann.note = note;
          emit('annotations-updated', annotations.value);
        }
      }
    } catch {
      // 用户取消输入，保留纯划线
    }
  }
  toolbarVisible.value = false;
  window.getSelection()?.removeAllRanges();
  currentSelection.value = null;
}

/**
 * 打开笔记编辑弹窗
 * 供阅读区内点击带笔记的高亮、以及父组件笔记抽屉「编辑」按钮共用
 *
 * @param annotationId - 被编辑的标注记录 id
 * @returns 无返回值
 */
function editAnnotationNote(annotationId: number): void {
  const ann = annotations.value.find((a) => a.id === annotationId);
  if (!ann) return;
  currentEditAnnotationId.value = annotationId;
  noteInput.value = ann.note || '';
  noteDialogVisible.value = true;
}

/**
 * 保存当前弹窗中的笔记内容
 * 调用 IPC 更新数据库 → 同步本地 → 通知父组件
 *
 * @returns 无返回值
 */
async function saveNote(): Promise<void> {
  const id = currentEditAnnotationId.value;
  if (id === null) return;
  const ann = annotations.value.find((a) => a.id === id);
  if (!ann) return;

  const note = noteInput.value.trim();
  try {
    const res = await window.ipcRenderer.ebook.updateAnnotation({ id: ann.id, note });
    if (res?.success) {
      ann.note = note;
      emit('annotations-updated', annotations.value);
      ElMessage.success('笔记已保存');
      noteDialogVisible.value = false;
    } else {
      ElMessage.error('笔记保存失败');
    }
  } catch (err: any) {
    ElMessage.error(`笔记保存失败：${err?.message || String(err)}`);
  }
}

/**
 * 删除当前正在编辑的标注（笔记弹窗底部「删除划线」按钮）
 * 调用 IPC 删除数据库记录 → 同步本地 → 通知父组件 → 关闭弹窗
 *
 * @returns 无返回值
 */
async function deleteCurrentAnnotation(): Promise<void> {
  const id = currentEditAnnotationId.value;
  if (id === null) return;
  await deleteAnnotationById(id);
  noteDialogVisible.value = false;
}

/**
 * 按 id 删除本地划线：调用 IPC 删除数据库记录并同步本地列表
 *
 * @param annotationId - 要删除的标注记录 id
 * @returns 无返回值
 */
async function deleteAnnotationById(annotationId: number): Promise<void> {
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
    const res = await window.ipcRenderer.ebook.removeAnnotation(annotationId);
    if (res?.success) {
      annotations.value = annotations.value.filter((a) => a.id !== annotationId);
      emit('annotations-updated', annotations.value);
      ElMessage.success('已删除划线');
    } else {
      ElMessage.error('删除划线失败');
    }
  } catch (err: any) {
    ElMessage.error(`删除划线失败：${err?.message || String(err)}`);
  }
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
 * 点击已有高亮段处理
 * - 带笔记：直接打开笔记编辑弹窗（可在弹窗内删除划线）
 * - 纯划线：直接删除划线，无需连续弹窗
 *
 * @param annotationId - 被点击的划线记录 id；为 null 时不处理
 * @returns 无返回值
 */
async function onHighlightClick(annotationId: number | null, noteFromSeg?: string) {
  if (annotationId === null) return;
  // 用户正在选文本时（存在非折叠选区）不触发点击高亮逻辑，避免与选区操作冲突
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) return;

  const ann = annotations.value.find((a) => a.id === annotationId);
  if (!ann) return;
  // 优先用本地标注的 note，其次用点击段携带的 note（防止本地 note 意外丢失时被误判为纯划线直接删除）
  const hasNote = !!(ann.note || noteFromSeg);

  if (hasNote) {
    // 有笔记：直接进入笔记编辑弹窗
    editAnnotationNote(ann.id);
  } else {
    // 纯划线：直接删除
    await deleteAnnotationById(ann.id);
  }
}

/**
 * 翻到上一页
 * 已在第一页时不响应
 *
 * @returns 无返回值
 */
function prevPage() {
  if (currentPage.value <= 0) return;
  currentPage.value--;
  sliderValue.value = currentPage.value + 1;
  emitProgress();
}

/**
 * 翻到下一页
 * 已在最后一页时不响应
 *
 * @returns 无返回值
 */
function nextPage() {
  if (currentPage.value >= totalPages.value - 1) return;
  currentPage.value++;
  sliderValue.value = currentPage.value + 1;
  emitProgress();
}

/**
 * 阅读区左侧边缘（10%）点击：上一页
 * 加载中或已在第一页时由底层 prevPage 内部处理
 *
 * @returns 无返回值
 */
function onEdgePrev() {
  if (loading.value) return;
  prevPage();
}

/**
 * 阅读区右侧边缘（10%）点击：下一页
 * 加载中或已在最后一页时由底层 nextPage 内部处理
 *
 * @returns 无返回值
 */
function onEdgeNext() {
  if (loading.value) return;
  nextPage();
}

/**
 * 滑块值变化时跳转到对应页
 *
 * @param val - 滑块当前值（1 起始）
 * @returns 无返回值
 */
function onSliderChange(val: number | number[]) {
  const page = Array.isArray(val) ? val[0] : val;
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page - 1;
  emitProgress();
}

/**
 * 计算并向上 emit 当前阅读进度
 * 进度持久化由父组件统一处理
 *
 * @returns 无返回值
 */
function emitProgress() {
  if (totalPages.value === 0) return;
  const page = pages.value[currentPage.value];
  if (!page) return;
  // 字符 offset 作为 cfi 字段
  const offset = page.startOffset;
  const percent = Math.min(
    100,
    Math.round((offset / Math.max(fullContent.value.length, 1)) * 100)
  );
  emit('progress-update', { cfi: String(offset), percent });
}

/**
 * 按 id 移除本地划线（不调 IPC，持久化由父组件负责）
 * 供父组件笔记抽屉删除后同步子组件高亮渲染；pageSegments 为 computed，annotations 变化自动重算
 *
 * @param id - 标注记录主键 id
 * @returns 无返回值
 */
function removeAnnotationById(id: number): void {
  annotations.value = annotations.value.filter((a) => a.id !== id);
  // pageSegments 是 computed，annotations 变化会自动重算高亮渲染
  emit('annotations-updated', annotations.value);
}

// 暴露跳转到划线、移除本地划线、编辑笔记方法供父组件通过 ref 调用
defineExpose({ jumpToAnnotation, removeAnnotationById, editAnnotationNote });

// 监听文件路径变化，重新加载内容并清理划线相关状态
watch(
  () => props.filePath,
  (newPath) => {
    // 清空划线与选区状态，避免上本书数据残留
    annotations.value = [];
    toolbarVisible.value = false;
    currentSelection.value = null;
    if (newPath) {
      currentPage.value = 0;
      sliderValue.value = 1;
      loadContent(newPath);
    } else {
      fullContent.value = '';
      pages.value = [];
      currentPage.value = 0;
      sliderValue.value = 1;
    }
  }
);

/** 重载防抖定时器 */
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
/** ResizeObserver 实例 */
let resizeObserver: ResizeObserver | null = null;
/** 是否已完成首次渲染（跳过初始挂载时的尺寸检测） */
let initialRenderDone = false;

/**
 * 阅读区尺寸/布局变化时重新分页。
 * 侧边栏/顶部栏显隐、窗口缩放等场景会改变阅读区容器尺寸，
 * 触发重新分页以保持排版正确、避免数据错乱。
 */
function scheduleReload() {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    if (!props.filePath || !txtContainer.value) return;
    const savedPage = currentPage.value;
    await loadContent(props.filePath);
    // 恢复到重载前的页码（不超出新分页总页数）
    const maxPage = Math.max(0, totalPages.value - 1);
    currentPage.value = Math.min(savedPage, maxPage);
    sliderValue.value = currentPage.value + 1;
  }, 300);
}

// 监听侧边栏和顶部栏的显隐：它们变化时阅读区容器尺寸改变，需重载排版
watch([sidebarVisible, topbarVisible], () => {
  if (!initialRenderDone) return;
  scheduleReload();
});

onMounted(() => {
  if (props.filePath) {
    loadContent(props.filePath).then(() => { initialRenderDone = true; });
  }
  // ResizeObserver：监听阅读区容器尺寸变化（窗口缩放、侧边栏/顶部栏显隐等触发重载）
  resizeObserver = new ResizeObserver(() => {
    if (!initialRenderDone) return;
    scheduleReload();
  });
  if (txtContainer.value) resizeObserver.observe(txtContainer.value);
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

  /* 阅读区视口：包裹内容区与左右边缘点击区，作为定位上下文 */
  .txt-viewport {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .txt-content {
    width: 100%;
    height: 100%;
    overflow: auto;
    padding: 24px 32px;
    box-sizing: border-box;

    .txt-page {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.8;
      font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
      min-height: 100%;
    }

    /* 高亮段样式：黄底圆角，三种主题下均可见 */
    .txt-highlight {
      background-color: rgba(255, 235, 59, 0.4);
      cursor: pointer;
      border-radius: 2px;
      /* 夜间主题下适当加深不透明度以增强可识别性 */
    }
  }

  .txt-footer {
    flex-shrink: 0;
    padding: 10px 24px;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-card);

    .page-nav {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-bottom: 8px;

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

    .txt-content .txt-page {
      color: inherit;
    }
  }

  /* 夜间主题：深色背景浅色字 */
  &.theme-night {
    background-color: #1a1a1a;
    color: #cccccc;

    .txt-content .txt-page {
      color: inherit;
    }

    .txt-footer {
      background-color: #2a2a2a;
      border-top-color: #3a3a3a;
    }

    /* 夜间主题下高亮加深不透明度，确保黄底可识别 */
    .txt-content .txt-highlight {
      background-color: rgba(255, 235, 59, 0.55);
    }
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

  /* 护眼主题：护眼绿底深色字 */
  &.theme-eye {
    background-color: #c7edcc;
    color: #2c3e50;

    .txt-content .txt-page {
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
