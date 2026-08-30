<template>
  <div class="unified-view">
    <!-- ========== 上方：两个输入框 ========== -->
    <div class="input-area">
      <div class="input-col">
        <div class="col-header">A · 原文</div>
        <textarea
          ref="leftTa"
          v-model="leftTextLocal"
          class="uni-textarea"
          :autosize="{ minRows: 4, maxRows: 15 }"
          @input="onInputLeft"
        ></textarea>
      </div>
      <div class="input-col">
        <div class="col-header">B · 对比</div>
        <textarea
          ref="rightTa"
          v-model="rightTextLocal"
          class="uni-textarea"
          :autosize="{ minRows: 4, maxRows: 15 }"
          @input="onInputRight"
        ></textarea>
      </div>
    </div>

    <!-- ========== 差异导航 ========== -->
    <div v-if="hunks.length > 0" class="nav-bar">
      <el-button-group size="small">
        <el-button :icon="ChevronUp" @click="prevHunk" :disabled="hunks.length === 0">上一处 ↑</el-button>
        <el-button :icon="ChevronDown" @click="nextHunk" :disabled="hunks.length === 0">下一处 ↓</el-button>
      </el-button-group>
      <span class="nav-hint">共 {{ hunks.length }} 处差异</span>
      <span class="current-hunk" v-if="currentHunkIndex >= 0">#{{ currentHunkIndex + 1 }} / {{ hunks.length }}</span>
    </div>

    <!-- ========== 合并视图结果区 ========== -->
    <div class="result-area" ref="resultRef">
      <div class="result-scroll">
        <div v-if="hunks.length === 0" class="empty-tip">
          <template v-if="!leftTextLocal && !rightTextLocal">输入左右两侧文本后自动计算 diff</template>
          <template v-else>两边完全一致 ✅</template>
        </div>

        <!-- 每个 hunk 一块 -->
        <div
          v-for="(h, hIdx) in hunks"
          :key="hIdx"
          class="uni-hunk"
          :ref="el => setHunkRef(el, hIdx)"
          :class="{ active: hIdx === currentHunkIndex }"
        >
          <!-- hunk header -->
          <div class="hunk-header">
            <span class="hunk-tag" :class="hunkHeaderClass(h)">{{ hunkHeaderIcon(h) }}</span>
            <span class="hunk-meta">@@ -{{ h.oldStart }},{{ h.oldLines }} +{{ h.newStart }},{{ h.newLines }} @@</span>
            <span class="hunk-type">
              {{ h.isModified ? '修改' : h.isAdded ? '新增' : '删除' }}
            </span>
            <!-- 块级应用按钮 -->
            <div class="hunk-apply-group">
              <el-tooltip content="← 把此块从 B 应用到 A（用 B 覆盖 A）" placement="top">
                <el-button size="small" text @click="emitApply(h, 'right-to-left')">← B→A</el-button>
              </el-tooltip>
              <el-tooltip content="把此块从 A 应用到 B（用 A 覆盖 B） →" placement="top">
                <el-button size="small" text @click="emitApply(h, 'left-to-right')">A→B →</el-button>
              </el-tooltip>
            </div>
          </div>

          <!-- hunk 里的每一行，按行号在各自侧渲染 -->
          <div class="hunk-body">
            <template v-for="(line, lIdx) in flattenHunk(h)" :key="lIdx">
              <div
                v-if="line"
                class="uni-row"
                :class="lineRowClass(line)"
              >
                <span class="line-gutter">
                  <span class="ln-a">{{ line.aLine }}</span>
                  <span class="ln-b">{{ line.bLine }}</span>
                </span>
                <span class="line-prefix">{{ line.prefix }}</span>
                <span class="line-content" v-html="line.inlineHtml"></span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 右侧小地图 -->
      <div class="uni-map">
        <div class="map-title">差异地图</div>
        <div class="minimap" @click="onMapClick">
          <div class="map-bg"></div>
          <div
            v-for="(h, i) in hunks"
            :key="'um-' + i"
            class="map-hunk"
            :class="mapHunkClass(h)"
            :style="mapHunkStyle(h)"
          ></div>
          <div v-if="currentHunkIndex >= 0" class="map-cursor" :style="mapCursorStyle"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 合并视图 —— git diff 风格的统一渲染 + 字符级 inline 高亮 + 块级应用
 *
 * 每行展示：
 *  ┌─ 左侧行号 │ 右侧行号 │ 前缀 (+/-/ ) │ 内容(带字符级高亮)
 */
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import * as DiffLib from 'diff';
import { ChevronUp, ChevronDown } from '@lucide/vue';
import type { DiffItem, DiffHunk } from './patcher';
import type { DiffAlgorithm } from './utils';
import { escapeHtml, countLines } from './utils';

const props = defineProps<{
  leftText: string;
  rightText: string;
  items: DiffItem[];
  hunks: DiffHunk[];
  algo: DiffAlgorithm;
}>();

const emit = defineEmits<{
  (e: 'apply-hunk', hunk: DiffHunk, direction: 'right-to-left' | 'left-to-right'): void;
}>();

// ============== refs ==============
const leftTa = ref<HTMLTextAreaElement | null>(null);
const rightTa = ref<HTMLTextAreaElement | null>(null);
const resultRef = ref<HTMLElement | null>(null);
const hunkRefs = ref<HTMLElement[]>([]);
function setHunkRef(el: any, idx: number) {
  if (el) hunkRefs.value[idx] = el;
}

// ============== 本地 textarea 绑定 ==============
const leftTextLocal = ref(props.leftText);
const rightTextLocal = ref(props.rightText);
watch(() => props.leftText, v => leftTextLocal.value = v);
watch(() => props.rightText, v => rightTextLocal.value = v);
function onInputLeft() { /* parent 监听 items 变化自行刷新 */ }
function onInputRight() { /* 同上 */ }

// ============== Hunk → 行展开 + 字符级 inline 高亮 ==============
interface FlattenedLine {
  /** ' ' | '+' | '-' */
  prefix: string;
  /** 左侧行号（未变行和删除行有，新增行为空） */
  aLine: number | null;
  /** 右侧行号（未变行和新增行有，删除行为空） */
  bLine: number | null;
  /** 原始内容 */
  raw: string;
  /** 带字符级高亮的 HTML（已 escape） */
  inlineHtml: string;
  /** 块类型 */
  type: 'added' | 'removed' | 'unchanged' | 'modified';
}

/**
 * 把 hunk 展开为逐行数据，同时做字符级 inline 高亮
 */
function flattenHunk(h: DiffHunk): FlattenedLine[] {
  const out: FlattenedLine[] = [];
  let aCursor = h.oldStart;
  let bCursor = h.newStart;

  // 先配对连续的 removed + added → 做字符级 diff
  const items: Array<DiffItem & { _pair?: DiffItem }> = [...h.items];
  let i = 0;
  while (i < items.length) {
    const cur = items[i];
    if (cur.removed && cur.count === undefined) cur.count = countLines(cur.value);
    if (cur.added && cur.count === undefined) cur.count = countLines(cur.value);

    // 连续 removed → 收集
    const removedBatch: DiffItem[] = [];
    const addedBatch: DiffItem[] = [];

    if (cur.removed) {
      removedBatch.push(cur);
      i++;
      while (i < items.length && items[i].removed) { removedBatch.push(items[i]); i++; }
      // 看接下来是不是连续 added
      if (i < items.length && items[i].added) {
        while (i < items.length && items[i].added) { addedBatch.push(items[i]); i++; }
      }
    } else if (cur.added) {
      addedBatch.push(cur);
      i++;
      while (i < items.length && items[i].added) { addedBatch.push(items[i]); i++; }
    } else {
      // unchanged
      i++;
    }

    // 处理：removed 纯删除 / added 纯新增 / removed+added 配对 = modified
    if (removedBatch.length > 0 && addedBatch.length > 0) {
      // modified —— 配对做字符级 inline 高亮
      const removedText = removedBatch.map(x => x.value).join('');
      const addedText = addedBatch.map(x => x.value).join('');
      const inlineDiff = DiffLib.diffChars(removedText, addedText);

      // 渲染 removed 侧：标记"被删掉"的字符（changed 部分 <mark class="del">）
      const removedHtml = buildInlineHtml(inlineDiff.filter(d => !d.added), 'removed-side');
      const addedHtml = buildInlineHtml(inlineDiff.filter(d => !d.removed), 'added-side');

      // 去掉换行符后按换行 split → 逐行输出
      const removedLines = removedText.replace(/\n$/, '').split('\n');
      const addedLines = addedText.replace(/\n$/, '').split('\n');
      const removedHtmlLines = splitInlineHtml(removedHtml, removedLines.length);
      const addedHtmlLines = splitInlineHtml(addedHtml, addedLines.length);

      for (let k = 0; k < removedHtmlLines.length; k++) {
        out.push({
          prefix: '-',
          aLine: aCursor++,
          bLine: null,
          raw: removedLines[k],
          inlineHtml: removedHtmlLines[k],
          type: 'removed'
        });
      }
      for (let k = 0; k < addedHtmlLines.length; k++) {
        out.push({
          prefix: '+',
          aLine: null,
          bLine: bCursor++,
          raw: addedLines[k],
          inlineHtml: addedHtmlLines[k],
          type: 'added'
        });
      }
    } else if (removedBatch.length > 0) {
      // 纯删除
      for (const item of removedBatch) {
        const lines = item.value.replace(/\n$/, '').split('\n');
        for (const line of lines) {
          out.push({
            prefix: '-',
            aLine: aCursor++,
            bLine: null,
            raw: line,
            inlineHtml: escapeHtml(line),
            type: 'removed'
          });
        }
      }
    } else if (addedBatch.length > 0) {
      // 纯新增
      for (const item of addedBatch) {
        const lines = item.value.replace(/\n$/, '').split('\n');
        for (const line of lines) {
          out.push({
            prefix: '+',
            aLine: null,
            bLine: bCursor++,
            raw: line,
            inlineHtml: escapeHtml(line),
            type: 'added'
          });
        }
      }
    }
  }
  return out;
}

/**
 * 把 inline diff 结果拼成一段 HTML（不含换行，换行用 \n 留着）
 */
function buildInlineHtml(changes: Array<{ value: string; added?: boolean; removed?: boolean }>, side: 'removed-side' | 'added-side'): string {
  let html = '';
  for (const c of changes) {
    const esc = escapeHtml(c.value);
    if ((side === 'removed-side' && c.removed) || (side === 'added-side' && c.added)) {
      // 被改动的字符 → 加 <mark> 高亮
      const cls = side === 'removed-side' ? 'hl-del' : 'hl-add';
      html += `<span class="${cls}">${esc}</span>`;
    } else {
      html += esc;
    }
  }
  return html;
}

/**
 * 按换行把 inline HTML 拆成逐行（保持 <span class=hl-xxx> 的闭合）
 */
function splitInlineHtml(html: string, lineCount: number): string[] {
  if (lineCount <= 1) return [html];
  const parts = html.split('\n');
  while (parts.length < lineCount) parts.push('');
  return parts.slice(0, lineCount);
}

function hunkHeaderClass(h: DiffHunk): string {
  if (h.isModified) return 'hh-modified';
  if (h.isAdded) return 'hh-added';
  return 'hh-removed';
}
function hunkHeaderIcon(h: DiffHunk): string {
  if (h.isModified) return '~';
  if (h.isAdded) return '+';
  return '-';
}
function lineRowClass(line: FlattenedLine): Record<string, boolean> {
  return {
    'row-added': line.type === 'added',
    'row-removed': line.type === 'removed',
    'row-modified': line.type === 'modified',
    'row-unchanged': line.type === 'unchanged'
  };
}

// ============== 差异导航 ==============
const currentHunkIndex = ref(-1);
function nextHunk() {
  if (props.hunks.length === 0) return;
  const i = currentHunkIndex.value < 0 ? 0 : Math.min(currentHunkIndex.value + 1, props.hunks.length - 1);
  currentHunkIndex.value = i;
  scrollToHunk(i);
}
function prevHunk() {
  if (props.hunks.length === 0) return;
  const i = currentHunkIndex.value <= 0 ? props.hunks.length - 1 : currentHunkIndex.value - 1;
  currentHunkIndex.value = i;
  scrollToHunk(i);
}
function scrollToHunk(i: number) {
  const el = hunkRefs.value[i];
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function onMapClick(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement | null;
  if (!target || !props.hunks.length) return;
  const rect = target.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const ratio = y / rect.height;
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < props.hunks.length; i++) {
    const h = props.hunks[i];
    const center = h.oldStart + h.oldLines / 2;
    const target = ratio * (props.hunks.reduce((s, x) => s + x.oldLines, 0) + 1);
    const dist = Math.abs(center - target);
    if (dist < bestDist) { bestDist = dist; best = i; }
  }
  currentHunkIndex.value = best;
  scrollToHunk(best);
}

function mapHunkStyle(h: DiffHunk) {
  const total = Math.max(1, props.hunks.reduce((s, x) => s + Math.max(x.oldLines, 1), 0));
  let offset = 0;
  for (const x of props.hunks) {
    if (x === h) break;
    offset += Math.max(x.oldLines, 1);
  }
  const topRatio = offset / total;
  const heightRatio = Math.max(h.oldLines, 1) / total;
  return {
    top: `calc(${topRatio * 100}%)`,
    height: `calc(${heightRatio * 100}%)`
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

function emitApply(h: DiffHunk, dir: 'right-to-left' | 'left-to-right') {
  emit('apply-hunk', h, dir);
}

onMounted(() => {
  nextTick(() => { /* 初始化 */ });
});
</script>

<style lang="scss" scoped>
.unified-view {
  display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0;
}

/* ===== 输入区 ===== */
.input-area {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  flex-shrink: 0;
}
.input-col {
  border: 1px solid var(--el-border-color-lighter); border-radius: 6px;
  overflow: hidden; display: flex; flex-direction: column;
}
.col-header {
  padding: 4px 10px; background: var(--el-fill-color-light);
  font-size: 12px; font-weight: 500; border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}
.uni-textarea {
  width: 100%; padding: 8px 10px;
  border: none; outline: none; resize: vertical;
  font-family: Consolas, 'Courier New', monospace; font-size: 13px; line-height: 1.5;
  background: var(--el-bg-color); color: var(--el-text-color-primary);
  min-height: 80px;
}

/* ===== 导航栏 ===== */
.nav-bar {
  display: flex; gap: 10px; align-items: center;
  padding: 6px 12px; background: var(--el-fill-color-lighter); border-radius: 6px;
  font-size: 12px; flex-shrink: 0;
}
.nav-hint { margin-left: auto; color: var(--el-text-color-secondary); }
.current-hunk { font-family: Consolas, monospace; color: var(--el-color-primary); font-weight: 600; }

/* ===== 结果区（左右：diff 主体 + 小地图） ===== */
.result-area {
  display: grid; grid-template-columns: 1fr 18px; gap: 8px;
  flex: 1; min-height: 0;
}
.result-scroll {
  border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
  overflow: auto; min-height: 0;
  font-family: Consolas, 'Courier New', monospace; font-size: 13px; line-height: 1.6;
  background: #1e1e1e; color: #d4d4d4;
}
.empty-tip { padding: 40px; text-align: center; color: #888; font-style: italic; }

/* ===== hunk 块 ===== */
.uni-hunk { border-bottom: 2px solid rgba(255,255,255,0.08); }
.uni-hunk.active .hunk-header { background: rgba(64,158,255,0.2); }

.hunk-header {
  display: flex; gap: 8px; align-items: center;
  padding: 6px 12px;
  background: rgba(255,255,255,0.04);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 12px;
  position: sticky; top: 0; z-index: 2;
}
.hunk-tag {
  width: 20px; height: 20px; border-radius: 3px;
  display: flex; align-items: center; justify-content: center;
  font-weight: bold; font-size: 14px;
}
.hunk-tag.hh-modified { background: #eab308; color: #1e1e1e; }
.hunk-tag.hh-added { background: #22c55e; color: #1e1e1e; }
.hunk-tag.hh-removed { background: #ef4444; color: #fff; }
.hunk-meta { color: #9cdcfe; }
.hunk-type { color: #ce9178; }
.hunk-apply-group { margin-left: auto; display: flex; gap: 4px; }

.hunk-body { padding: 2px 0; }

/* ===== 每一行 ===== */
.uni-row {
  display: flex; gap: 0;
  padding: 0 4px;
  height: 22px;
  align-items: stretch;
}
.uni-row.row-added { background: rgba(34,197,94,0.15); color: #b7eb8f; }
.uni-row.row-removed { background: rgba(239,68,68,0.15); color: #ff7875; }
.uni-row.row-unchanged { color: #9ca3af; }

.line-gutter {
  display: flex; width: 72px; flex-shrink: 0;
  border-right: 1px solid rgba(255,255,255,0.05);
  padding: 0 4px;
  font-size: 11px; color: #6b7280;
  align-items: center; justify-content: space-between;
  background: rgba(255,255,255,0.02);
}
.ln-a { width: 32px; text-align: right; }
.ln-b { width: 32px; text-align: left; }

.line-prefix {
  width: 18px; flex-shrink: 0; text-align: center;
  font-weight: bold;
}
.row-added .line-prefix { color: #22c55e; }
.row-removed .line-prefix { color: #ef4444; }

.line-content {
  flex: 1; padding: 0 6px; white-space: pre;
  /* 不要 overflow-x:hidden —— 让长行撑宽整行，
     外层 .result-scroll (overflow:auto) 会自动出横滚条 */
  overflow: visible;
}

/* ===== 字符级 inline 高亮 ===== */
.hl-add { background: rgba(34,197,94,0.4); color: #fff; border-radius: 1px; }
.hl-del { background: rgba(239,68,68,0.5); color: #fff; border-radius: 1px; text-decoration: line-through; }

/* ===== 小地图 ===== */
.uni-map {
  display: flex; flex-direction: column;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  padding: 2px 0;
  overflow: hidden;
}
.map-title {
  font-size: 10px; color: var(--el-text-color-secondary);
  text-align: center; padding: 4px 0 2px; letter-spacing: 1px;
  writing-mode: vertical-rl; text-orientation: mixed;
}
.minimap {
  position: relative;
  flex: 1; margin: 2px;
  background: var(--el-fill-color); border-radius: 2px;
  cursor: pointer; min-height: 200px;
}
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
  .input-area { grid-template-columns: 1fr; }
}
</style>
