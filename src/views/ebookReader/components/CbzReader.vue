<template>
  <div
    class="cbz-reader"
    :class="themeClass"
    :style="{ background: readerBg, color: readerText }"
    v-loading="loading"
    element-loading-text="正在解压漫画包..."
  >
    <!-- 漫画页显示区：单页布局（contain 适配），左右边缘点击/滚轮/键盘翻页 -->
    <div
      ref="viewportRef"
      class="cbz-viewport"
      @wheel="onWheelPageTurn"
      @mouseup="onMouseUp"
    >
      <div
        v-show="edgeClickEnabled !== false"
        class="edge-turn-zone edge-turn-zone--left"
        :style="{ width: (edgeClickPercent ?? 10) + '%' }"
        @click="onEdgePrev"
        title="上一页"
      ></div>
      <div
        v-show="edgeClickEnabled !== false"
        class="edge-turn-zone edge-turn-zone--right"
        :style="{ width: (edgeClickPercent ?? 10) + '%' }"
        @click="onEdgeNext"
        title="下一页"
      ></div>

      <!-- 当前页图片（Blob URL，预取相邻页） -->
      <img
        v-if="currentSrc"
        :key="currentPage"
        :src="currentSrc"
        class="cbz-page-img"
        draggable="false"
        alt=""
      />
      <div v-else-if="!loading" class="cbz-empty">
        <el-empty description="压缩包内未找到图片" />
      </div>

      <!-- 页码角标 -->
      <span v-if="totalPages > 0" class="cbz-page-badge">{{ currentPage }} / {{ totalPages }}</span>
    </div>

    <!-- 底部控制栏 -->
    <div class="cbz-footer" v-show="bottomBarVisible !== false">
      <el-button size="small" :disabled="currentPage <= 1 || loading" @click="prevPage">
        <LucideIcon name="ArrowLeft" :size="14" />
        上一页
      </el-button>
      <span class="page-info">{{ totalPages > 0 ? currentPage : 0 }} / {{ totalPages }}</span>
      <el-button size="small" :disabled="currentPage >= totalPages || loading" @click="nextPage">
        下一页
        <LucideIcon name="ArrowRight" :size="14" />
      </el-button>
      <div class="progress-slider" v-if="totalPages > 0">
        <el-slider
          :model-value="currentPage"
          :min="1"
          :max="totalPages"
          :step="1"
          :show-tooltip="false"
          @change="onSliderChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import JSZip from 'jszip';
import LucideIcon from '@/components/LucideIcon.vue';
import useEbookReader from '@/store/useEbookReader';
import { resolveReadingBg, resolveReadingText } from '../themePresets';
import { compressDataUrlImage } from '../utils/imageUtils';
import { useReaderShortcuts } from '../composables/useReaderShortcuts';

/** 禁用默认 attribute 透传：未声明 props 不应落到根 div 干扰布局 */
defineOptions({ inheritAttrs: false });

/** 组件 Props 定义（与其它阅读器保持同名的公共子集） */
const props = defineProps<{
  /** 文件绝对路径（.cbz） */
  filePath: string;
  /** 当前文件内容身份（多副本共用进度） */
  contentHash?: string;
  /** 阅读主题：day 白天、night 夜间、eye 护眼 */
  theme: 'day' | 'night' | 'eye';
  /** 阅读区背景类型 */
  bgType?: 'preset' | 'color' | 'image';
  bgColor?: string;
  bgImage?: string;
  textColor?: string;
  /** 是否显示底部翻页控制栏 */
  bottomBarVisible?: boolean;
  /** 是否启用阅读区左右边缘点击翻页 */
  edgeClickEnabled?: boolean;
  edgeClickPercent?: number;
  /** 是否启用鼠标滚轮翻页 */
  wheelPageEnabled?: boolean;
  wheelPageSensitivity?: number;
}>();

const emit = defineEmits<{
  /** 阅读进度更新（cfi = 当前页码字符串，与 PDF 同口径） */
  (e: 'progress-update', payload: { cfi: string; percent: number; filePath?: string }): void;
  /** 书籍基本信息：CBZ 无内嵌元数据，仅回传首图生成的封面（title 留空由父组件回退文件名） */
  (e: 'book-meta', payload: { filePath?: string; title: string; author: string; cover: string }): void;
}>();

const ebookStore = useEbookReader();
const viewportRef = ref<HTMLElement | null>(null);
const loading = ref(false);

const themeClass = computed(() => `theme-${props.theme}`);
const readerBg = computed(() =>
  resolveReadingBg(props.bgType ?? 'preset', props.bgColor ?? '', props.bgImage ?? '', props.theme)
);
const readerText = computed(() => resolveReadingText(props.textColor ?? '', props.theme));

/** 页面 Blob URL 列表（与 zip 内图片顺序一致；下标 0 = 第 1 页） */
const pageUrls = ref<string[]>([]);
const currentPage = ref(1);
const totalPages = computed(() => pageUrls.value.length);
const currentSrc = computed(() => pageUrls.value[currentPage.value - 1] || '');

/** 文本自然排序（第2页 排在 第10页 之前） */
const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

/** 相邻页预取的 Image 对象（仅用于预热缓存） */
const preloaded = new Set<string>();

/** 提取指定下标页的 Blob URL（带缓存） */
async function ensurePageUrl(idx: number): Promise<string | null> {
  if (idx < 0 || idx >= pageUrls.value.length) return null;
  const url = pageUrls.value[idx];
  if (url) return url;
  const zip = zipRef;
  if (!zip) return null;
  const file = zip.file(pageNames[idx]);
  if (!file) return null;
  const blob = await file.async('blob');
  const url2 = URL.createObjectURL(blob);
  pageUrls.value[idx] = url2;
  return url2;
}

let zipRef: JSZip | null = null;
let pageNames: string[] = [];

/** 加载 CBZ：解包 → 收集图片条目（自然排序）→ 恢复进度 → 生成封面 */
async function loadCbz(filePath: string): Promise<void> {
  if (!filePath) return;
  loading.value = true;
  try {
    const res = await window.ipcRenderer.ebook.readFileBytes(filePath);
    if (!res?.base64) throw new Error(res?.error || '读取文件失败');
    const buf = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
    const zip = await JSZip.loadAsync(buf);
    zipRef = zip;
    pageNames = Object.keys(zip.files)
      .filter(
        (n) =>
          !zip.files[n].dir &&
          !n.includes('__MACOSX') &&
          /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(n)
      )
      .sort(collator.compare);
    pageUrls.value = new Array(pageNames.length).fill(null);
    if (pageNames.length === 0) return;

    // 恢复进度（DB 优先，本地按书映射兜底），cfi = 页码字符串
    let page = 1;
    try {
      const prog = await window.ipcRenderer.ebook.getProgress(filePath, props.contentHash || '');
      if (prog?.success && prog.data?.cfi) {
        const p = parseInt(prog.data.cfi, 10);
        if (!isNaN(p) && p > 0) page = p;
      }
      if (page <= 1) {
        const local = ebookStore.getBookProgress(filePath);
        if (local?.cfi) {
          const p = parseInt(local.cfi, 10);
          if (!isNaN(p) && p > 0) page = p;
        }
      }
    } catch {
      /* 进度恢复失败从第 1 页开始 */
    }
    currentPage.value = Math.min(Math.max(1, page), pageNames.length);

    // 打开第一页 + 预取相邻页
    await ensurePageUrl(currentPage.value - 1);
    void ensurePageUrl(currentPage.value); // 下一页
    void ensurePageUrl(currentPage.value - 2 >= 0 ? currentPage.value - 2 : 0); // 上一页

    // 首图生成封面（压缩入库，与 EPUB/PDF 同方案）
    void buildCover();
  } catch (err: any) {
    ElMessage.error(`打开 CBZ 失败：${err?.message || String(err)}`);
  } finally {
    loading.value = false;
  }
}

/** 首图 → dataURL → 压缩 → book-meta（即发即弃） */
async function buildCover(): Promise<void> {
  try {
    const url = await ensurePageUrl(0);
    if (!url) return;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('首图解码失败'));
      image.src = url;
    });
    // 先画到 canvas 转 dataURL，再统一压缩到 240px
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 480 / img.width);
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const c2d = canvas.getContext('2d');
    if (!c2d) return;
    c2d.drawImage(img, 0, 0, canvas.width, canvas.height);
    const raw = canvas.toDataURL('image/jpeg', 0.8);
    const cover = await compressDataUrlImage(raw, 240, 0.7);
    emit('book-meta', { filePath: props.filePath, title: '', author: '', cover });
  } catch (err) {
    console.warn('生成 CBZ 封面失败', err);
  }
}

/** 翻页后：进度落库 + 预取相邻页 */
function afterPageTurn(): void {
  const total = totalPages.value;
  if (total > 0) {
    const percent = Math.min(100, Math.round((currentPage.value / total) * 100));
    emit('progress-update', { cfi: String(currentPage.value), percent, filePath: props.filePath });
  }
  // 预取当前页左右相邻页
  void ensurePageUrl(currentPage.value - 1).then((u) => u && preload(u));
  void ensurePageUrl(currentPage.value).then((u) => u && preload(u));
  void ensurePageUrl(currentPage.value - 3 >= 0 ? currentPage.value - 3 : 0).then((u) => u && preload(u));
}

/** 预热图片解码缓存 */
function preload(url: string): void {
  if (preloaded.has(url)) return;
  preloaded.add(url);
  const img = new Image();
  img.src = url;
}

function prevPage(): void {
  if (currentPage.value <= 1) return;
  currentPage.value -= 1;
  afterPageTurn();
}
function nextPage(): void {
  if (currentPage.value >= totalPages.value) return;
  currentPage.value += 1;
  afterPageTurn();
}
function onEdgePrev(): void {
  if (loading.value) return;
  prevPage();
}
function onEdgeNext(): void {
  if (loading.value) return;
  nextPage();
}
function onSliderChange(v: number | number[]): void {
  const p = Array.isArray(v) ? v[0] : v;
  if (p < 1 || p > totalPages.value) return;
  currentPage.value = p;
  afterPageTurn();
}

/** 滚轮翻页：累加阈值翻页（与其他阅读器同参数） */
let wheelAccum = 0;
let wheelIdleTimer: ReturnType<typeof setTimeout> | null = null;
function onWheelPageTurn(e: WheelEvent): void {
  if (props.wheelPageEnabled === false) return;
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
  const raw = e.deltaY !== 0 ? e.deltaY : e.deltaX;
  const sensitivity = props.wheelPageSensitivity ?? 5;
  wheelAccum += raw * unit * (sensitivity / 5);
  const THRESHOLD = 100;
  if (Math.abs(wheelAccum) >= THRESHOLD) {
    const dir = wheelAccum > 0 ? 1 : -1;
    wheelAccum = 0;
    if (dir > 0) nextPage();
    else prevPage();
  }
  e.preventDefault();
  if (wheelIdleTimer) clearTimeout(wheelIdleTimer);
  wheelIdleTimer = setTimeout(() => {
    wheelAccum = 0;
  }, 200);
}

/** 选区工具条未启用：mouseup 仅用于关闭外部浮层，无需处理 */
function onMouseUp(_e: MouseEvent): void {}

// 键盘快捷键（←/→/PgUp/PgDn/Space/Home/End；输入框守卫由 composable 内置）
useReaderShortcuts(
  {
    prev: prevPage,
    next: nextPage,
    jumpStart: () => {
      currentPage.value = 1;
      afterPageTurn();
    },
    jumpEnd: () => {
      currentPage.value = totalPages.value;
      afterPageTurn();
    },
  },
  { spaceAsNext: () => true }
);

// 切书：销毁旧的 Blob URL 与 zip 引用
watch(
  () => props.filePath,
  (newPath) => {
    disposePages();
    if (newPath) loadCbz(newPath);
  }
);

function disposePages(): void {
  pageUrls.value.forEach((u) => u && URL.revokeObjectURL(u));
  pageUrls.value = [];
  pageNames = [];
  zipRef = null;
  currentPage.value = 1;
  preloaded.clear();
}

onMounted(() => {
  if (props.filePath) loadCbz(props.filePath);
});
onUnmounted(() => {
  disposePages();
  if (wheelIdleTimer) clearTimeout(wheelIdleTimer);
});
</script>

<style scoped lang="scss">
.cbz-reader {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  transition: background-color 0.3s, color 0.3s;

  .cbz-viewport {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;

    .cbz-page-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.28);
      user-select: none;
      border-radius: 2px;
    }

    .cbz-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
    }

    .cbz-page-badge {
      position: absolute;
      right: 14px;
      top: 10px;
      padding: 2px 10px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.45);
      color: #fff;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      pointer-events: none;
      z-index: 5;
    }
  }

  /* 左右边缘点击翻页区：与 EPUB/PDF 同构 */
  .edge-turn-zone {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 10;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.18s ease;

    &:hover {
      background-color: var(--edge-hover-bg, rgba(0, 0, 0, 0.06));
    }
  }
  .edge-turn-zone--left {
    left: 0;
  }
  .edge-turn-zone--right {
    right: 0;
  }

  .cbz-footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 8px 16px;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-card);

    .page-info {
      font-size: 13px;
      color: var(--text-secondary);
      min-width: 70px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .progress-slider {
      width: 220px;
      margin-left: 12px;

      --el-slider-height: 4px;
      --el-slider-button-size: 14px;
    }
  }

  &.theme-day {
    --edge-hover-bg: rgba(0, 0, 0, 0.06);
  }
  &.theme-night {
    --edge-hover-bg: rgba(255, 255, 255, 0.10);

    .cbz-footer {
      background-color: #2a2a2a;
      border-top-color: #3a3a3a;
    }
  }
  &.theme-eye {
    --edge-hover-bg: rgba(0, 0, 0, 0.05);
  }
}
</style>
