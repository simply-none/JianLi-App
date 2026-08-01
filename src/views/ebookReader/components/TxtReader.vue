<template>
  <div class="txt-reader" :class="themeClass" v-loading="loading" element-loading-text="正在加载文件...">
    <!-- 阅读内容区：按页展示 txt 文本，分段 span 渲染以支持划线高亮 -->
    <div class="txt-content" :style="{ fontSize: fontSize + 'px' }" @mouseup="onMouseUp">
      <div class="txt-page">
        <span
          v-for="(seg, i) in pageSegments"
          :key="i"
          :data-start="seg.globalStart"
          :class="seg.isHighlight ? getTypeClass(seg.type) : ''"
          :style="getSegmentStyle(seg)"
          @click="seg.isHighlight && onHighlightClick(seg.annotationId)"
        >{{ seg.text }}</span>
      </div>
    </div>

    <!-- 底部翻页与进度控制区 -->
    <div class="txt-footer">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import AnnotationToolbar from './AnnotationToolbar.vue';

/** 阅读主题类型：day 白天、night 夜间、eye 护眼 */
type EbookTheme = 'day' | 'night' | 'eye';

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
}

/** 组件 Props 定义 */
const props = defineProps<{
  /** 文件绝对路径 */
  filePath: string;
  /** 字体大小，单位 px */
  fontSize: number;
  /** 阅读主题：day 白天、night 夜间、eye 护眼 */
  theme: EbookTheme;
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

/** 高亮颜色映射：颜色名称到 CSS 颜色值的映射 */
const COLOR_MAP: Record<string, string> = {
  yellow: 'rgba(255,235,59,0.4)',
  green: 'rgba(129,199,132,0.4)',
  blue: 'rgba(100,181,246,0.4)',
  pink: 'rgba(244,143,177,0.4)',
  orange: 'rgba(255,183,77,0.4)',
  purple: 'rgba(186,160,227,0.4)',
};

/**
 * 根据颜色名称获取 CSS 颜色值
 *
 * @param colorName - 颜色名称
 * @returns CSS 颜色值
 */
function getColorValue(colorName: string): string {
  return COLOR_MAP[colorName] || COLOR_MAP.yellow;
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
      segments.push({ text, isHighlight: false, annotationId: null, globalStart: cursor, color: '', type: '' });
    }
    // 高亮段（携带 color 和 type 信息）
    const highlightText = content.substring(segStart - pageStart, a.end - pageStart);
    segments.push({ text: highlightText, isHighlight: true, annotationId: a.id, globalStart: segStart, color: a.color, type: a.type });
    cursor = a.end;
  }
  // 末尾普通文本段
  if (cursor < pageEnd) {
    const text = content.substring(cursor - pageStart);
    segments.push({ text, isHighlight: false, annotationId: null, globalStart: cursor, color: '', type: '' });
  }
  return segments;
});

/** 主题 class 计算属性 */
const themeClass = computed(() => `theme-${props.theme}`);

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
 *
 * @param payload - 工具条传递的参数，包含 color 和 type
 * @returns 无返回值
 */
async function onToolbarHighlight(payload?: { color?: string; type?: string }): Promise<void> {
  if (!currentSelection.value) return;
  const { start, end, text } = currentSelection.value;
  await addHighlight(start, end, text, '', payload?.color || 'yellow', payload?.type || 'highlight');
  toolbarVisible.value = false;
  window.getSelection()?.removeAllRanges();
  currentSelection.value = null;
}

/**
 * 工具条「笔记」按钮事件处理
 * 先保存纯划线得到 id，再弹窗输入笔记内容并更新；取消输入则保留纯划线
 *
 * @param payload - 工具条传递的参数，包含 color 和 type
 * @returns 无返回值
 */
async function onToolbarNote(payload?: { color?: string; type?: string }): Promise<void> {
  if (!currentSelection.value) return;
  const { start, end, text } = currentSelection.value;
  const color = payload?.color || 'yellow';
  const type = payload?.type || 'highlight';
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
 * 点击已有高亮段处理
 * 弹出确认框：确认「删除」则移除划线；取消（点击「编辑笔记」）则弹窗编辑笔记
 *
 * @param annotationId - 被点击的划线记录 id；为 null 时不处理
 * @returns 无返回值
 */
async function onHighlightClick(annotationId: number | null) {
  if (annotationId === null) return;
  // 用户正在选文本时（存在非折叠选区）不触发点击高亮逻辑，避免与选区操作冲突
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) return;

  const ann = annotations.value.find((a) => a.id === annotationId);
  if (!ann) return;

  try {
    await ElMessageBox.confirm(
      `${ann.note ? '笔记：' + ann.note : '无笔记'}\n是否删除该划线？`,
      '划线',
      { confirmButtonText: '删除', cancelButtonText: '编辑笔记' }
    );
    // 用户点击「删除」
    try {
      const res = await window.ipcRenderer.ebook.removeAnnotation(ann.id);
      if (res?.success) {
        annotations.value = annotations.value.filter((a) => a.id !== ann.id);
        emit('annotations-updated', annotations.value);
        ElMessage.success('已删除划线');
      } else {
        ElMessage.error('删除划线失败');
      }
    } catch (err: any) {
      ElMessage.error(`删除划线失败：${err?.message || String(err)}`);
    }
  } catch {
    // 用户点击「编辑笔记」
    try {
      const { value } = await ElMessageBox.prompt('请输入新笔记', '编辑笔记', {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputValue: ann.note || '',
      });
      const note = (value || '').trim();
      const res = await window.ipcRenderer.ebook.updateAnnotation({ id: ann.id, note });
      if (res?.success) {
        ann.note = note;
        emit('annotations-updated', annotations.value);
        ElMessage.success('笔记已更新');
      } else {
        ElMessage.error('笔记更新失败');
      }
    } catch {
      // 用户取消编辑，不做操作
    }
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

// 暴露跳转到划线方法供父组件通过 ref 调用
defineExpose({ jumpToAnnotation, removeAnnotationById });

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

onMounted(() => {
  if (props.filePath) {
    loadContent(props.filePath);
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

  .txt-content {
    flex: 1;
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
      color: #333333;
    }
  }

  /* 夜间主题：深色背景浅色字 */
  &.theme-night {
    background-color: #1a1a1a;
    color: #cccccc;

    .txt-content .txt-page {
      color: #cccccc;
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

  /* 护眼主题：护眼绿底深色字 */
  &.theme-eye {
    background-color: #c7edcc;
    color: #2c3e50;

    .txt-content .txt-page {
      color: #2c3e50;
    }
  }
}
</style>
