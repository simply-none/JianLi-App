<template>
  <div class="split-view">
    <!-- ========== 顶部差异导航栏 ========== -->
    <div v-if="hunks.length > 0" class="nav-bar">
      <el-button-group size="small">
        <el-button :icon="ChevronUp" @click="prevHunk" :disabled="hunks.length === 0">上一处 ↑</el-button>
        <el-button :icon="ChevronDown" @click="nextHunk" :disabled="hunks.length === 0">下一处 ↓</el-button>
      </el-button-group>
      <span class="nav-hint">
        共 {{ hunks.length }} 处差异 — 点击小地图快速跳转
      </span>
      <span class="current-hunk" v-if="currentHunkIndex >= 0">
        #{{ currentHunkIndex + 1 }} / {{ hunks.length }}
      </span>
    </div>

    <!-- ========== 主体区域（两列 + 右侧小地图） ========== -->
    <div class="split-body">
      <!-- 左侧 A -->
      <div class="split-col" :class="{ 'drag-over': dragOverLeft }">
        <div class="col-header">
          <span>A · 原文 ({{ statsLeft }} 行)</span>
          <span class="char-count">{{ leftText.length }} 字符</span>
        </div>
        <div
          class="textarea-wrapper"
          @dragover.prevent="dragOverLeft = true"
          @dragleave="dragOverLeft = false"
          @drop.prevent="onDropFile($event, 'left')"
        >
          <!-- 底层层：行号 —— absolute 定位，transform 跟随 textarea 的 scroll 平移 -->
          <div ref="leftLineNumbers" class="line-numbers">
            <div v-for="n in lineCountLeft" :key="n" class="ln" :class="hunkLineClass(n, 'left')">{{ n }}</div>
          </div>
          <!-- 高亮层 —— 同样用 transform 跟随 textarea 的 scroll 平移 -->
          <div ref="leftHighlight" class="diff-highlight">
            <div
              v-for="h in hunks"
              :key="'hl-' + h.oldStart"
              class="hunk-band"
              :class="hunkBandClass(h)"
              :style="{
                top: hunkBandTopLeft(h) + 'px',
                height: hunkBandHeight(h, 'left') + 'px'
              }"
            >
              <div class="hunk-apply-btns left">
                <el-tooltip content="把 B 的此块应用到 A" placement="right">
                  <button class="apply-btn right-to-left" @click="emitApply(h, 'right-to-left')" title="B → A">←</button>
                </el-tooltip>
              </div>
            </div>
          </div>
          <!-- 真正的 textarea —— 它自己滚（横+竖），scroll 事件在这里 -->
          <textarea
            ref="leftTa"
            class="real-textarea"
            v-model="leftTextLocal"
            spellcheck="false"
            @scroll="onScroll('left')"
            @input="onInputLeft"
          ></textarea>
        </div>
      </div>

      <!-- 中间竖线 + 小地图列 -->
      <div class="map-col">
        <div class="map-title">差异地图</div>
        <div class="minimap" ref="mapRef" @click="onMapClick">
          <div class="map-bg"></div>
          <div
            v-for="(h, i) in hunks"
            :key="'map-' + i"
            class="map-hunk"
            :class="mapHunkClass(h)"
            :style="mapHunkStyle(h)"
            :title="`#${i + 1}  A:${h.oldStart}×${h.oldLines}  B:${h.newStart}×${h.newLines}`"
          ></div>
          <div
            v-if="currentHunkIndex >= 0"
            class="map-cursor"
            :style="mapCursorStyle"
          ></div>
        </div>
      </div>

      <!-- 右侧 B -->
      <div class="split-col" :class="{ 'drag-over': dragOverRight }">
        <div class="col-header">
          <span>B · 对比 ({{ statsRight }} 行)</span>
          <span class="char-count">{{ rightText.length }} 字符</span>
        </div>
        <div
          class="textarea-wrapper"
          @dragover.prevent="dragOverRight = true"
          @dragleave="dragOverRight = false"
          @drop.prevent="onDropFile($event, 'right')"
        >
          <div ref="rightLineNumbers" class="line-numbers">
            <div v-for="n in lineCountRight" :key="n" class="ln" :class="hunkLineClass(n, 'right')">{{ n }}</div>
          </div>
          <div ref="rightHighlight" class="diff-highlight">
            <div
              v-for="h in hunks"
              :key="'hr-' + h.newStart"
              class="hunk-band"
              :class="hunkBandClass(h)"
              :style="{
                top: hunkBandTopRight(h) + 'px',
                height: hunkBandHeight(h, 'right') + 'px'
              }"
            >
              <div class="hunk-apply-btns right">
                <el-tooltip content="把 A 的此块应用到 B" placement="left">
                  <button class="apply-btn left-to-right" @click="emitApply(h, 'left-to-right')" title="A → B">→</button>
                </el-tooltip>
              </div>
            </div>
          </div>
          <textarea
            ref="rightTa"
            class="real-textarea"
            v-model="rightTextLocal"
            spellcheck="false"
            @scroll="onScroll('right')"
            @input="onInputRight"
          ></textarea>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 并排视图 —— 两侧 textarea 各自滚，scroll 事件互相同步；
 * 行号层 / 高亮层用 transform 跟随对应 textarea 的 scrollTop/scrollLeft 平移
 * 这样既能横滚长行，又能保持三层叠同步
 */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { ChevronUp, ChevronDown } from '@lucide/vue';
import type { DiffItem, DiffHunk } from './patcher';
import type { DiffAlgorithm } from './utils';
import { countLines } from './utils';

const props = defineProps<{
  leftText: string;
  rightText: string;
  items: DiffItem[];
  hunks: DiffHunk[];
  algo: DiffAlgorithm;
}>();

const emit = defineEmits<{
  (e: 'update:leftText', val: string): void;
  (e: 'update:rightText', val: string): void;
  (e: 'apply-hunk', hunk: DiffHunk, direction: 'right-to-left' | 'left-to-right'): void;
  (e: 'pick-file', side: 'left' | 'right'): void;
}>();

// ============== refs ==============
const leftTa = ref<HTMLTextAreaElement | null>(null);
const rightTa = ref<HTMLTextAreaElement | null>(null);
/** 左侧行号层 —— scrollTop/scrollLeft 跟随 leftTa */
const leftLineNumbers = ref<HTMLElement | null>(null);
const leftHighlight = ref<HTMLElement | null>(null);
const rightLineNumbers = ref<HTMLElement | null>(null);
const rightHighlight = ref<HTMLElement | null>(null);
const mapRef = ref<HTMLElement | null>(null);

// ============== 本地 textarea 绑定 ==============
const leftTextLocal = ref(props.leftText);
const rightTextLocal = ref(props.rightText);
watch(() => props.leftText, v => leftTextLocal.value = v);
watch(() => props.rightText, v => rightTextLocal.value = v);
function onInputLeft() { emit('update:leftText', leftTextLocal.value); }
function onInputRight() { emit('update:rightText', rightTextLocal.value); }

// ============== 拖拽导入状态 ==============
const dragOverLeft = ref(false);
const dragOverRight = ref(false);

function onDropFile(e: DragEvent, side: 'left' | 'right') {
  dragOverLeft.value = false;
  dragOverRight.value = false;
  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;
  const file = files[0];
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result as string;
    if (side === 'left') { leftTextLocal.value = text; emit('update:leftText', text); }
    else { rightTextLocal.value = text; emit('update:rightText', text); }
  };
  reader.readAsText(file);
}

// ============== 行高常量 ==============
const LINE_HEIGHT = 20; // 和 CSS line-height: 20px 保持一致

// ============== 行数 ==============
const lineCountLeft = computed(() => Math.max(1, countLines(leftTextLocal.value)));
const lineCountRight = computed(() => Math.max(1, countLines(rightTextLocal.value)));
const statsLeft = computed(() => countLines(leftTextLocal.value));
const statsRight = computed(() => countLines(rightTextLocal.value));

// ============== 行号染色 ==============
function hunkLineClass(lineNo: number, side: 'left' | 'right'): string {
  for (const h of props.hunks) {
    const start = side === 'left' ? h.oldStart : h.newStart;
    const count = side === 'left' ? h.oldLines : h.newLines;
    if (lineNo >= start && lineNo < start + count) {
      let cursor = 0;
      for (const item of h.items) {
        const lines = countLines(item.value);
        if (lineNo - start < cursor + lines) {
          if (side === 'left' && item.removed) return 'ln-removed';
          if (side === 'right' && item.added) return 'ln-added';
          if (side === 'left' && item.added) return 'ln-gap';
          if (side === 'right' && item.removed) return 'ln-gap';
        }
        cursor += lines;
      }
      return 'ln-modified';
    }
  }
  return '';
}

// ============== hunk band 定位 ==============
function hunkBandTopLeft(h: DiffHunk): number { return (h.oldStart - 1) * LINE_HEIGHT; }
function hunkBandTopRight(h: DiffHunk): number { return (h.newStart - 1) * LINE_HEIGHT; }
function hunkBandHeight(h: DiffHunk, side: 'left' | 'right'): number {
  const lines = side === 'left' ? h.oldLines : h.newLines;
  return Math.max(lines * LINE_HEIGHT, LINE_HEIGHT);
}
function hunkBandClass(h: DiffHunk): string {
  if (h.isModified) return 'band-modified';
  if (h.isAdded) return 'band-added';
  return 'band-removed';
}

// ============== 同步滚动 ==============
/** 防止反馈循环的 flag */
let isSyncing = false;
let rafTimer: ReturnType<typeof requestAnimationFrame> | null = null;

/**
 * textarea 滚动事件 —— 同步对侧 textarea + 同侧行号/高亮层
 * 三层叠同步：textarea 滚到 scrollTop/scrollLeft，行号和高亮层用 transform 平移相同距离
 */
function onScroll(side: 'left' | 'right') {
  const src = side === 'left' ? leftTa.value : rightTa.value;
  if (!src) return;

  // 行号层 + 高亮层跟随 src 的滚动位置平移
  const ln = side === 'left' ? leftLineNumbers.value : rightLineNumbers.value;
  const hl = side === 'left' ? leftHighlight.value : rightHighlight.value;
  if (ln) ln.style.transform = `translate(${-src.scrollLeft}px, ${-src.scrollTop}px)`;
  if (hl) hl.style.transform = `translate(${-src.scrollLeft}px, ${-src.scrollTop}px)`;

  if (isSyncing) return;
  if (rafTimer) cancelAnimationFrame(rafTimer);
  rafTimer = requestAnimationFrame(() => {
    isSyncing = true;
    const dst = side === 'left' ? rightTa.value : leftTa.value;
    if (dst) {
      dst.scrollTop = src.scrollTop;
      dst.scrollLeft = src.scrollLeft;
      // 对侧的行号/高亮层也同步
      const otherLn = side === 'left' ? rightLineNumbers.value : leftLineNumbers.value;
      const otherHl = side === 'left' ? rightHighlight.value : leftHighlight.value;
      if (otherLn) otherLn.style.transform = `translate(${-src.scrollLeft}px, ${-src.scrollTop}px)`;
      if (otherHl) otherHl.style.transform = `translate(${-src.scrollLeft}px, ${-src.scrollTop}px)`;
    }
    requestAnimationFrame(() => { isSyncing = false; });
  });
}

/** 手动把对侧也滚到某个位置（scrollToHunk 等场景） */
function setBothScroll(scrollTop: number, scrollLeft = 0) {
  const a = leftTa.value, b = rightTa.value;
  if (!a || !b) return;
  isSyncing = true;
  a.scrollTop = b.scrollTop = scrollTop;
  a.scrollLeft = b.scrollLeft = scrollLeft;
  // 同步行号/高亮层
  const tx = -scrollLeft + 'px', ty = -scrollTop + 'px';
  const t = `translate(${tx}, ${ty})`;
  for (const el of [leftLineNumbers.value, rightLineNumbers.value, leftHighlight.value, rightHighlight.value]) {
    if (el) el.style.transform = t;
  }
  requestAnimationFrame(() => { isSyncing = false; });
}

// ============== 差异导航 + 小地图 ==============
const currentHunkIndex = ref(-1);

function nextHunk() {
  if (props.hunks.length === 0) return;
  currentHunkIndex.value = currentHunkIndex.value < 0 ? 0 : Math.min(currentHunkIndex.value + 1, props.hunks.length - 1);
  scrollToHunk(currentHunkIndex.value);
}
function prevHunk() {
  if (props.hunks.length === 0) return;
  currentHunkIndex.value = currentHunkIndex.value <= 0 ? props.hunks.length - 1 : currentHunkIndex.value - 1;
  scrollToHunk(currentHunkIndex.value);
}
function scrollToHunk(idx: number) {
  const h = props.hunks[idx];
  if (!h) return;
  const target = Math.max(0, (h.oldStart - 3) * LINE_HEIGHT);
  setBothScroll(target);
}

function onMapClick(e: MouseEvent) {
  if (!mapRef.value || props.hunks.length === 0) return;
  const rect = mapRef.value.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const ratio = y / rect.height;
  const totalLines = Math.max(1, lineCountLeft.value);
  const targetLine = Math.floor(ratio * totalLines);
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < props.hunks.length; i++) {
    const h = props.hunks[i];
    const center = h.oldStart + h.oldLines / 2;
    const dist = Math.abs(center - targetLine);
    if (dist < bestDist) { bestDist = dist; best = i; }
  }
  currentHunkIndex.value = best;
  scrollToHunk(best);
}

function mapHunkStyle(h: DiffHunk) {
  const totalLines = Math.max(1, lineCountLeft.value);
  const topRatio = (h.oldStart - 1) / totalLines;
  const heightRatio = Math.max(h.oldLines, 1) / totalLines;
  return {
    top: `calc(${topRatio * 100}% + 1px)`,
    height: `calc(${heightRatio * 100}% - 1px)`
  };
}
function mapHunkClass(h: DiffHunk): string {
  if (h.isModified) return 'mh-modified';
  if (h.isAdded) return 'mh-added';
  return 'mh-removed';
}
const mapCursorStyle = computed(() => {
  if (currentHunkIndex.value < 0 || !props.hunks[currentHunkIndex.value]) return {};
  return mapHunkStyle(props.hunks[currentHunkIndex.value]);
});

// ============== 单块应用 ==============
function emitApply(h: DiffHunk, dir: 'right-to-left' | 'left-to-right') {
  emit('apply-hunk', h, dir);
}

defineExpose({ currentHunkIndex });

onMounted(() => {
  nextTick(() => setBothScroll(0));
});
onBeforeUnmount(() => {
  if (rafTimer) cancelAnimationFrame(rafTimer);
});
</script>

<style lang="scss" scoped>
.split-view { display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; }

/* ===== 导航栏 ===== */
.nav-bar {
  display: flex; gap: 10px; align-items: center;
  padding: 6px 12px; background: var(--el-fill-color-lighter); border-radius: 6px;
  font-size: 12px; flex-shrink: 0;
}
.nav-hint { margin-left: auto; color: var(--el-text-color-secondary); }
.current-hunk { font-family: Consolas, monospace; color: var(--el-color-primary); font-weight: 600; }

/* ===== 主体 ===== */
.split-body {
  display: grid; grid-template-columns: 1fr 18px 1fr; gap: 8px;
  flex: 1; min-height: 0;
}

.split-col {
  display: flex; flex-direction: column;
  border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
  overflow: hidden; background: var(--el-bg-color); min-height: 0;
}
.split-col.drag-over {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px rgba(64,158,255,0.25);
}

.col-header {
  display: flex; justify-content: space-between; padding: 6px 12px;
  background: var(--el-fill-color-light); font-size: 12px; font-weight: 500;
  border-bottom: 1px solid var(--el-border-color-lighter); flex-shrink: 0;
}
.char-count { font-family: Consolas, monospace; color: var(--el-text-color-secondary); }

/* ===== textarea 容器 ===== */
.textarea-wrapper {
  position: relative;
  flex: 1; min-height: 0;
  /* wrapper 不滚 —— textarea 自己滚 */
  overflow: hidden;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 20px;
}

/* 三层叠的共同特征：absolute 填满 wrapper 区域，通过 transform 跟随 textarea 平移 */
.line-numbers, .diff-highlight, .real-textarea {
  position: absolute;
  top: 0; left: 0;
}

.line-numbers {
  z-index: 0;
  /* 宽度 = 3.5em 的行号列 + wrapper 的 overflow:hidden 裁切 */
  width: 3.5em;
  padding: 8px 4px 0 6px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  text-align: right;
  /* 关键：不滚，由 transform 平移 */
  overflow: visible;
  will-change: transform;
  border-right: 1px solid var(--el-border-color-lighter);
  box-sizing: border-box;
}
.line-numbers .ln { height: 20px; font-size: 12px; }
.line-numbers .ln.ln-added { color: #22c55e; background: rgba(34,197,94,0.1); }
.line-numbers .ln.ln-removed { color: #ef4444; background: rgba(239,68,68,0.1); }
.line-numbers .ln.ln-modified { color: #eab308; background: rgba(234,179,8,0.1); }
.line-numbers .ln.ln-gap { color: transparent; background: rgba(156,163,175,0.15); }

.diff-highlight {
  z-index: 1;
  /* left = 3.5em，留给行号；padding = 8px + 10px（和 textarea 的 padding 对齐） */
  left: 3.5em;
  right: 0;
  padding: 8px 10px 0 0;
  overflow: visible;
  will-change: transform;
  pointer-events: none; /* 默认穿透，按钮 z-index 更高能点 */
}
.diff-highlight .hunk-band {
  position: absolute; left: 0; right: 0;
  border-top: 1px solid transparent; border-bottom: 1px solid transparent;
  pointer-events: auto;
}
.diff-highlight .hunk-band.band-added { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.3); }
.diff-highlight .hunk-band.band-removed { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.3); }
.diff-highlight .hunk-band.band-modified { background: rgba(234,179,8,0.12); border-color: rgba(234,179,8,0.3); }

.hunk-apply-btns { position: absolute; top: 2px; right: 4px; display: flex; gap: 2px; z-index: 10; }
.apply-btn {
  width: 20px; height: 16px; padding: 0;
  border: 1px solid var(--el-border-color); border-radius: 3px;
  background: var(--el-bg-color); font-size: 10px; line-height: 1; cursor: pointer;
  color: var(--el-text-color-primary); opacity: 0.5; transition: opacity 0.15s;
}
.hunk-band:hover .apply-btn { opacity: 1; }
.apply-btn:hover { background: var(--el-color-primary); border-color: var(--el-color-primary); color: #fff; }

.real-textarea {
  z-index: 2;
  left: 0; top: 0;
  /* 让 textarea 占满 wrapper */
  width: 100%;
  height: 100%;
  padding: 8px 10px 8px calc(3.5em + 8px);
  border: none; outline: none;
  font-family: inherit; font-size: inherit; line-height: inherit;
  color: var(--el-text-color-primary);
  background: transparent;
  resize: none;
  /* white-space: pre = 不换行，长行出横向滚动条 */
  white-space: pre;
  tab-size: 2;
  box-sizing: border-box;
  overflow: auto;
  scrollbar-width: thin;
  /* textarea 是唯一滚的元素，不用 transform */
}

/* ===== 小地图列 ===== */
.map-col {
  display: flex; flex-direction: column;
  border-radius: 4px; overflow: hidden;
  background: var(--el-fill-color-light); padding: 2px 0;
}
.map-title {
  font-size: 10px; color: var(--el-text-color-secondary);
  text-align: center; padding: 4px 0 2px; letter-spacing: 1px;
  writing-mode: vertical-rl; text-orientation: mixed; flex-shrink: 0;
}
.minimap {
  position: relative; flex: 1; margin: 2px;
  background: var(--el-fill-color); border-radius: 2px;
  overflow: hidden; cursor: pointer; min-height: 200px;
}
.map-bg { position: absolute; inset: 0; background: var(--el-fill-color); }
.map-hunk { position: absolute; left: 0; right: 0; margin: 1px 0; border-radius: 1px; }
.map-hunk.mh-added { background: rgba(34,197,94,0.7); }
.map-hunk.mh-removed { background: rgba(239,68,68,0.7); }
.map-hunk.mh-modified { background: rgba(234,179,8,0.7); }
.map-cursor {
  position: absolute; left: 0; right: 0;
  border: 1px solid var(--el-color-primary);
  background: rgba(64, 158, 255, 0.3);
  border-radius: 1px; pointer-events: none;
  transition: all 0.15s ease-out;
}

@media (max-width: 900px) {
  .split-body { grid-template-columns: 1fr 10px 1fr; }
}
</style>
