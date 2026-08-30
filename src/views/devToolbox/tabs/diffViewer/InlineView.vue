<template>
  <div class="inline-view">
    <!-- ========== 输入区 ========== -->
    <div class="input-area">
      <div class="input-col">
        <div class="col-header">A · 原文</div>
        <textarea v-model="leftTextLocal" class="uni-textarea" :autosize="{ minRows: 4, maxRows: 15 }"></textarea>
      </div>
      <div class="input-col">
        <div class="col-header">B · 对比</div>
        <textarea v-model="rightTextLocal" class="uni-textarea" :autosize="{ minRows: 4, maxRows: 15 }"></textarea>
      </div>
    </div>

    <!-- ========== 结果区（左：diff 主体 + 右：小地图） ========== -->
    <div class="result-area">
      <div class="result-scroll" ref="resultRef">
        <div class="search-bar">
          <el-input
            v-model="searchQuery"
            size="small"
            placeholder="🔍 搜索差异内容..."
            clearable
            :prefix-icon="Search"
            @input="onSearchInput"
          />
          <span v-if="searchMatches.length > 0" class="search-hint">
            命中 {{ currentMatchIdx + 1 }} / {{ searchMatches.length }}
          </span>
          <el-button-group v-if="searchMatches.length > 0" size="small">
            <el-button :icon="ChevronUp" @click="prevMatch" />
            <el-button :icon="ChevronDown" @click="nextMatch" />
          </el-button-group>
        </div>

        <div class="empty-tip" v-if="hunks.length === 0 && !(leftTextLocal || rightTextLocal)">
          输入两侧文本后自动计算 diff
        </div>
        <div class="empty-tip" v-else-if="hunks.length === 0">两边完全一致 ✅</div>

        <!-- 内联视图内容：每个 hunk 渲染一组 inline 行 -->
        <template v-else>
          <div
            v-for="(h, hIdx) in hunks"
            :key="hIdx"
            class="inline-hunk"
            :class="{ active: hIdx === currentHunkIndex }"
            :ref="el => setHunkRef(el, hIdx)"
          >
            <!-- hunk 头部 -->
            <div class="ih-header">
              <span class="ih-tag" :class="hunkHeaderClass(h)">{{ hunkHeaderIcon(h) }}</span>
              <span class="ih-meta">@@ -{{ h.oldStart }},{{ h.oldLines }} +{{ h.newStart }},{{ h.newLines }} @@</span>
              <span class="ih-type">{{ h.isModified ? '修改' : h.isAdded ? '新增' : '删除' }}</span>
              <!-- 全局同步按钮 -->
              <div class="ih-apply-group">
                <el-button size="small" text @click="emitApply(h, 'right-to-left')">← B→A</el-button>
                <el-button size="small" text @click="emitApply(h, 'left-to-right')">A→B →</el-button>
              </div>
            </div>

            <!-- hunk 内容：合并成 inline 行 -->
            <div class="ih-body">
              <div
                v-for="(line, lIdx) in flattenToInline(h)"
                :key="lIdx"
                class="inline-row"
                :class="inlineRowClass(line)"
                :data-matchable="line.matchable"
                v-html="line.html"
              />
            </div>
          </div>
        </template>
      </div>

      <!-- 小地图 -->
      <div class="uni-map" v-if="hunks.length > 0">
        <div class="map-title">差异</div>
        <div class="minimap" @click="onMapClick">
          <div
            v-for="(h, i) in hunks"
            :key="'im-' + i"
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
 * 内联视图 —— 修改行合并成一行，同一行里同时显示 del + ins（VSCode inline 风格）
 * + 差异搜索 + 高亮 + 匹配导航
 */
import { ref, computed, watch, nextTick } from 'vue';
import * as DiffLib from 'diff';
import { ElMessage } from 'element-plus';
import { ChevronUp, ChevronDown, Search } from '@lucide/vue';
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
const resultRef = ref<HTMLElement | null>(null);
const hunkRefs = ref<HTMLElement[]>([]);
function setHunkRef(el: any, idx: number) { if (el) hunkRefs.value[idx] = el; }

// ============== 本地输入绑定 ==============
const leftTextLocal = ref(props.leftText);
const rightTextLocal = ref(props.rightText);
watch(() => props.leftText, v => leftTextLocal.value = v);
watch(() => props.rightText, v => rightTextLocal.value = v);

// ============== 搜索 ==============
const searchQuery = ref('');
const currentMatchIdx = ref(0);
/** 所有匹配的 inline-row 元素（用 data-matchable 标记后 querySelectorAll） */
const searchMatches = ref<HTMLElement[]>([]);

function onSearchInput() {
  currentMatchIdx.value = 0;
  nextTick(collectSearchMatches);
}
function collectSearchMatches() {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) { searchMatches.value = []; return; }
  if (!resultRef.value) return;
  const rows = resultRef.value.querySelectorAll('.inline-row');
  const matched: HTMLElement[] = [];
  rows.forEach(row => {
    const text = (row.textContent ?? '').toLowerCase();
    if (text.includes(q)) matched.push(row as HTMLElement);
  });
  searchMatches.value = matched;
}
function nextMatch() {
  if (searchMatches.value.length === 0) return;
  currentMatchIdx.value = (currentMatchIdx.value + 1) % searchMatches.value.length;
  searchMatches.value[currentMatchIdx.value]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function prevMatch() {
  if (searchMatches.value.length === 0) return;
  currentMatchIdx.value = (currentMatchIdx.value - 1 + searchMatches.value.length) % searchMatches.value.length;
  searchMatches.value[currentMatchIdx.value]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ============== 把 hunk flatten 成 inline 行 ==============
interface InlineRow {
  html: string;
  /** 'added' | 'removed' | 'modified' | 'unchanged' */
  type: string;
  /** 是否可以被搜索匹配 */
  matchable?: boolean;
}

function flattenToInline(h: DiffHunk): InlineRow[] {
  const out: InlineRow[] = [];

  // 先配对 removed + added
  const pairs: Array<{ removed?: DiffItem; added?: DiffItem }> = [];
  let i = 0;
  while (i < h.items.length) {
    const cur = h.items[i];
    if (cur.removed) {
      let removedBatch: DiffItem[] = [];
      while (i < h.items.length && h.items[i].removed) { removedBatch.push(h.items[i]); i++; }
      const addedBatch: DiffItem[] = [];
      while (i < h.items.length && h.items[i].added) { addedBatch.push(h.items[i]); i++; }
      // 把 removed 的每一行和 added 的每一行配对（行数不一致时多出来的部分单独成块）
      const removedLines = removedBatch.map(x => x.value).join('').replace(/\n$/, '').split('\n');
      const addedLines = addedBatch.map(x => x.value).join('').replace(/\n$/, '').split('\n');
      const max = Math.max(removedLines.length, addedLines.length);
      for (let k = 0; k < max; k++) {
        const r = removedLines[k] ?? null;
        const a = addedLines[k] ?? null;
        if (r !== null && a !== null) {
          // 修改：字符级 diff
          const inlineDiff = DiffLib.diffChars(r, a);
          const html = buildInlineRowHtml(inlineDiff);
          out.push({ html, type: 'modified', matchable: true });
        } else if (r !== null) {
          // 纯删除行
          out.push({ html: `<span class="ir-del-line">${escapeHtml(r)}</span>`, type: 'removed', matchable: true });
        } else {
          // 纯新增行
          out.push({ html: `<span class="ir-add-line">${escapeHtml(a!)}</span>`, type: 'added', matchable: true });
        }
      }
    } else if (cur.added) {
      let addedBatch: DiffItem[] = [];
      while (i < h.items.length && h.items[i].added) { addedBatch.push(h.items[i]); i++; }
      const lines = addedBatch.map(x => x.value).join('').replace(/\n$/, '').split('\n');
      for (const line of lines) {
        out.push({ html: `<span class="ir-add-line">${escapeHtml(line)}</span>`, type: 'added', matchable: true });
      }
    } else {
      // unchanged —— 但 hunk 里通常没有 unchanged（被 buildHunks 排除了）
      out.push({ html: escapeHtml(cur.value), type: 'unchanged', matchable: true });
      i++;
    }
  }
  return out;
}

/**
 * 构造一行 inline HTML：<del>旧字符</del> 正常字符 <ins>新字符</ins>
 */
function buildInlineRowHtml(changes: Array<{ value: string; added?: boolean; removed?: boolean }>): string {
  let html = '<span class="ir-prefix"> ';
  for (const c of changes) {
    const esc = escapeHtml(c.value);
    if (c.removed) html += `<del class="ir-del">${esc}</del>`;
    else if (c.added) html += `<ins class="ir-ins">${esc}</ins>`;
    else html += esc;
  }
  html += '</span>';
  return html;
}

function inlineRowClass(line: InlineRow): Record<string, boolean> {
  return {
    'il-modified': line.type === 'modified',
    'il-added': line.type === 'added',
    'il-removed': line.type === 'removed'
  };
}
function hunkHeaderClass(h: DiffHunk): string {
  if (h.isModified) return 'ih-modified';
  if (h.isAdded) return 'ih-added';
  return 'ih-removed';
}
function hunkHeaderIcon(h: DiffHunk): string {
  if (h.isModified) return '~';
  if (h.isAdded) return '+';
  return '-';
}

// ============== 差异导航 ==============
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
function scrollToHunk(i: number) { hunkRefs.value[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

// ============== 小地图 ==============
function onMapClick(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const ratio = y / rect.height;
  let best = 0, bestDist = Infinity;
  const total = Math.max(1, props.hunks.reduce((s, x) => s + Math.max(x.oldLines, 1), 0));
  for (let i = 0; i < props.hunks.length; i++) {
    const h = props.hunks[i];
    let offset = 0;
    for (const x of props.hunks) { if (x === h) break; offset += Math.max(x.oldLines, 1); }
    const dist = Math.abs(offset / total - ratio);
    if (dist < bestDist) { bestDist = dist; best = i; }
  }
  currentHunkIndex.value = best;
  scrollToHunk(best);
}
function mapHunkStyle(h: DiffHunk) {
  const total = Math.max(1, props.hunks.reduce((s, x) => s + Math.max(x.oldLines, 1), 0));
  let offset = 0;
  for (const x of props.hunks) { if (x === h) break; offset += Math.max(x.oldLines, 1); }
  return {
    top: `calc(${offset / total * 100}%)`,
    height: `calc(${Math.max(h.oldLines, 1) / total * 100}%)`
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

function emitApply(h: DiffHunk, dir: 'right-to-left' | 'left-to-right') { emit('apply-hunk', h, dir); }
</script>

<style lang="scss" scoped>
.inline-view { display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; }

.input-area { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; flex-shrink: 0; }
.input-col { border: 1px solid var(--el-border-color-lighter); border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; }
.col-header { padding: 4px 10px; background: var(--el-fill-color-light); font-size: 12px; font-weight: 500; border-bottom: 1px solid var(--el-border-color-lighter); flex-shrink: 0; }
.uni-textarea { width: 100%; padding: 8px 10px; border: none; outline: none; resize: vertical; font-family: Consolas, monospace; font-size: 13px; background: var(--el-bg-color); min-height: 80px; }

.result-area { display: grid; grid-template-columns: 1fr 18px; gap: 8px; flex: 1; min-height: 0; }
.result-scroll { border: 1px solid var(--el-border-color-lighter); border-radius: 8px; overflow: auto; min-height: 0; font-family: Consolas, monospace; font-size: 13px; line-height: 1.55; background: #1e1e1e; color: #d4d4d4; }

.search-bar { position: sticky; top: 0; z-index: 5; display: flex; gap: 8px; align-items: center; padding: 6px 10px; background: rgba(30,30,30,0.95); border-bottom: 1px solid rgba(255,255,255,0.08); }
.search-bar :deep(.el-input) { max-width: 260px; }
.search-hint { font-size: 11px; color: #9cdcfe; font-family: Consolas, monospace; }
.empty-tip { padding: 40px; text-align: center; color: #888; font-style: italic; }

.inline-hunk { border-bottom: 2px solid rgba(255,255,255,0.08); }
.inline-hunk.active .ih-header { background: rgba(64,158,255,0.2); }
.ih-header { display: flex; gap: 8px; align-items: center; padding: 6px 12px; background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; position: sticky; top: 0; z-index: 2; }
.ih-tag { width: 20px; height: 20px; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; }
.ih-tag.ih-modified { background: #eab308; color: #1e1e1e; }
.ih-tag.ih-added { background: #22c55e; color: #1e1e1e; }
.ih-tag.ih-removed { background: #ef4444; color: #fff; }
.ih-meta { color: #9cdcfe; }
.ih-type { color: #ce9178; }
.ih-apply-group { margin-left: auto; display: flex; gap: 4px; }

.ih-body { padding: 4px 0; }
.inline-row { padding: 2px 10px; min-height: 20px; }
.il-modified { background: rgba(234,179,8,0.08); }
.il-added { background: rgba(34,197,94,0.15); }
.il-removed { background: rgba(239,68,68,0.15); text-decoration: line-through; opacity: 0.8; }

/* inline 字符级样式 */
.ir-prefix { white-space: pre-wrap; display: inline-block; }
.ir-del { background: rgba(239,68,68,0.3); color: #ff7875; text-decoration: line-through; }
.ir-ins { background: rgba(34,197,94,0.3); color: #b7eb8f; }
.ir-del-line { color: #ff7875; background: rgba(239,68,68,0.12); }
.ir-add-line { color: #b7eb8f; background: rgba(34,197,94,0.12); }

/* ===== 小地图 ===== */
.uni-map { display: flex; flex-direction: column; border-radius: 4px; background: var(--el-fill-color-light); padding: 2px 0; overflow: hidden; }
.map-title { font-size: 10px; color: var(--el-text-color-secondary); text-align: center; padding: 4px 0 2px; letter-spacing: 1px; writing-mode: vertical-rl; text-orientation: mixed; }
.minimap { position: relative; flex: 1; margin: 2px; background: var(--el-fill-color); border-radius: 2px; cursor: pointer; min-height: 200px; }
.map-hunk { position: absolute; left: 0; right: 0; margin: 1px 0; border-radius: 1px; }
.map-hunk.mh-added { background: rgba(34,197,94,0.7); }
.map-hunk.mh-removed { background: rgba(239,68,68,0.7); }
.map-hunk.mh-modified { background: rgba(234,179,8,0.7); }
.map-cursor { position: absolute; left: 0; right: 0; border: 1px solid var(--el-color-primary); background: rgba(64,158,255,0.3); border-radius: 1px; pointer-events: none; transition: all 0.15s ease-out; }
</style>
