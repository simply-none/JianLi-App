<template>
  <div class="diff-viewer">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="tool-row">
        <span class="lbl">模式:</span>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button :value="'split'">并排</el-radio-button>
          <el-radio-button :value="'unified'">合并</el-radio-button>
        </el-radio-group>
        <span class="lbl">算法:</span>
        <el-radio-group v-model="algoMode" size="small">
          <el-radio-button :value="'line'">行级</el-radio-button>
          <el-radio-button :value="'char'">字符级</el-radio-button>
          <el-radio-button :value="'word'">词级</el-radio-button>
        </el-radio-group>
      </div>
      <div class="tool-row">
        <el-checkbox v-model="ignoreWhitespace" label="忽略空白" />
        <el-checkbox v-model="ignoreCase" label="忽略大小写" />
      </div>
      <div class="tool-row btn-row">
        <el-button size="small" :icon="ArrowLeftRight" @click="swap">交换</el-button>
        <el-button size="small" :icon="Eraser" @click="clearAll">清空</el-button>
        <el-button size="small" :icon="Download" @click="exportDiff" :disabled="!diffText">导出 .diff</el-button>
        <el-button size="small" :icon="Upload" @click="pickFile('left')">📁 左</el-button>
        <el-button size="small" :icon="Upload" @click="pickFile('right')">📁 右</el-button>
      </div>
      <div class="stats-row">
        <el-tag type="success" size="small" effect="dark">+ {{ stats.added }}</el-tag>
        <el-tag type="danger" size="small" effect="dark">- {{ stats.removed }}</el-tag>
        <el-tag type="warning" size="small" effect="dark">~ {{ stats.modified }}</el-tag>
        <el-tag v-if="leftText === rightText && leftText.length > 0" type="success" effect="light" size="small">两边完全一致 ✅</el-tag>
      </div>
    </div>

    <!-- 并排视图 -->
    <div v-if="viewMode === 'split'" class="split-view">
      <div class="split-col">
        <div class="col-header"><span>原文 (A)</span><span class="char-count">{{ leftText.length }} 字符</span></div>
        <el-input v-model="leftText" type="textarea" :autosize="{ minRows: 18, maxRows: 40 }" class="diff-input" @input="onInput" />
      </div>
      <div class="split-col">
        <div class="col-header"><span>对比 (B)</span><span class="char-count">{{ rightText.length }} 字符</span></div>
        <el-input v-model="rightText" type="textarea" :autosize="{ minRows: 18, maxRows: 40 }" class="diff-input" @input="onInput" />
      </div>
    </div>

    <!-- 合并视图 -->
    <div v-else class="unified-view">
      <div class="split-row">
        <div class="split-col">
          <div class="col-header"><span>原文 (A)</span></div>
          <el-input v-model="leftText" type="textarea" :autosize="{ minRows: 6, maxRows: 20 }" class="diff-input" @input="onInput" />
        </div>
        <div class="split-col">
          <div class="col-header"><span>对比 (B)</span></div>
          <el-input v-model="rightText" type="textarea" :autosize="{ minRows: 6, maxRows: 20 }" class="diff-input" @input="onInput" />
        </div>
      </div>
      <div class="unified-result">
        <pre class="diff-output" v-html="unifiedHtml"></pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Diff 文本对比 - Tab3
 * 依赖: diff 包 (用户已安装)
 */
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { ArrowLeftRight, Eraser, Download, Upload } from '@lucide/vue';
import * as DiffLib from 'diff';

const leftText = ref('');
const rightText = ref('');
const viewMode = ref<'split' | 'unified'>('split');
const algoMode = ref<'line' | 'char' | 'word'>('line');
const ignoreWhitespace = ref(false);
const ignoreCase = ref(false);

// 去噪预处理
function normalize(s: string): string {
  let r = s;
  if (ignoreWhitespace.value) r = r.replace(/[ \t]+/g, '');
  if (ignoreCase.value) r = r.toLowerCase();
  return r;
}

// 核心 diff 计算
const diffResult = computed(() => {
  if (!leftText.value && !rightText.value) return [];
  const a = normalize(leftText.value);
  const b = normalize(rightText.value);
  if (algoMode.value === 'line') return DiffLib.diffLines(a, b);
  if (algoMode.value === 'char') return DiffLib.diffChars(a, b);
  return DiffLib.diffWords(a, b);
});

// 统计
const stats = computed(() => {
  let added = 0, removed = 0, modified = 0, unchanged = 0;
  // 简化统计：line 级才做 modified 判定（连续 -/+ 合并为修改）
  const items: any[] = diffResult.value;
  let prevType: string | null = null;
  for (const item of items) {
    if (item.added) {
      if (prevType === 'removed') { modified++; prevType = 'mod'; continue; }
      added++; prevType = 'added';
    } else if (item.removed) {
      if (prevType === 'added') { modified++; prevType = 'mod'; continue; }
      removed++; prevType = 'removed';
    } else {
      unchanged++; prevType = 'unchanged';
    }
  }
  return { added, removed, modified, unchanged };
});

// 合并视图 HTML 输出
const unifiedHtml = computed(() => {
  const html = diffResult.value.map((item: any) => {
    const esc = escapeHtml(item.value);
    if (item.added) return `<div class="diff-line added">+ ${esc}</div>`;
    if (item.removed) return `<div class="diff-line removed">- ${esc}</div>`;
    return `<div class="diff-line unchanged">  ${esc}</div>`;
  }).join('');
  return html || '<span class="empty-tip">输入左右两边文本后自动计算 diff...</span>';
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c] || c);
}

function onInput() { /* computed 自动重算 */ }
function swap() { [leftText.value, rightText.value] = [rightText.value, leftText.value]; }
function clearAll() { leftText.value = ''; rightText.value = ''; }

// 标准 diff 格式导出
const diffText = computed(() => {
  if (!leftText.value && !rightText.value) return '';
  const hunk: string[] = ['--- A', '+++ B', '@@ -1,0 +1,0 @@'];
  for (const item of diffResult.value) {
    if (item.added) hunk.push('+' + item.value);
    else if (item.removed) hunk.push('-' + item.value);
    else hunk.push(' ' + item.value);
  }
  return hunk.join('\n');
});

function exportDiff() {
  const blob = new Blob([diffText.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diff-${Date.now()}.diff`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success('已下载 .diff 文件');
}

async function pickFile(side: 'left' | 'right') {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.md,.json,.js,.ts,.vue,.html,.css,.log,.csv,.py';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (side === 'left') leftText.value = reader.result as string;
      else rightText.value = reader.result as string;
    };
    reader.readAsText(file);
  };
  input.click();
}
</script>

<style lang="scss" scoped>
.diff-viewer { display: flex; flex-direction: column; gap: 10px; height: 100%; }

.toolbar {
  display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
  padding: 10px 14px; background: var(--el-fill-color-light); border-radius: 8px;
}
.tool-row { display: flex; gap: 8px; align-items: center; }
.lbl { font-size: 13px; color: var(--el-text-color-secondary); }
.btn-row { margin-left: auto; }
.stats-row { display: flex; gap: 8px; }

.split-view, .split-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.split-col { display: flex; flex-direction: column; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; overflow: hidden; }
.col-header {
  display: flex; justify-content: space-between; padding: 6px 12px;
  background: var(--el-fill-color-light); font-size: 12px; font-weight: 500;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.char-count { font-family: Consolas, monospace; color: var(--el-text-color-secondary); }

.diff-input :deep(textarea) {
  font-family: Consolas, 'Courier New', monospace; font-size: 13px;
  line-height: 1.55; border: none; background: transparent;
}

.unified-result {
  border: 1px solid var(--el-border-color-lighter); border-radius: 8px; overflow: auto;
  max-height: 400px;
}
.diff-output {
  font-family: Consolas, monospace; font-size: 13px; margin: 0;
  background: #1e1e1e; color: #d4d4d4; padding: 10px; line-height: 1.6;
  white-space: pre-wrap; word-break: break-all;
}
.diff-line.added { color: #b7eb8f; background: rgba(34,197,94,0.15); }
.diff-line.removed { color: #ff7875; background: rgba(239,68,68,0.15); }
.diff-line.unchanged { color: #9ca3af; }
.empty-tip { color: #6b7280; font-style: italic; }

@media (max-width: 900px) {
  .split-view, .split-row { grid-template-columns: 1fr; }
}
</style>
