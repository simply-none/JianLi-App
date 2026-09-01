<template>
  <div class="json-hash-converter">
    <!-- 子工具切换（通用 TopTabs 替代 el-tabs） -->
    <TopTabs
      :tabs="subTabs"
      :model-value="subTab"
      @update:modelValue="(k: string | number) => (subTab = k as 'json' | 'hash' | 'encode')"
    />

    <!-- JSON 格式化 -->
    <div v-show="subTab === 'json'" class="panel json-panel">
      <ToolHint text="粘贴 JSON 后点击「格式化 / 压缩 / 校验」；解析失败时右上角标签会显示具体错误原因" />
      <div class="toolbar">
        <el-radio-group v-model="indentSize" size="small">
          <el-radio-button :value="2">2 空格</el-radio-button>
          <el-radio-button :value="4">4 空格</el-radio-button>
          <el-radio-button :value="'tab'">Tab</el-radio-button>
        </el-radio-group>
        <div class="btn-group">
          <el-button size="small" :icon="Wand2" @click="formatJson">格式化</el-button>
          <el-button size="small" :icon="Minimize2" @click="minifyJson">压缩</el-button>
          <el-button size="small" :icon="Lock" @click="escapeJson">转义</el-button>
          <el-button size="small" :icon="Unlock" @click="unescapeJson">反转义</el-button>
          <el-button size="small" :icon="CircleCheck" @click="validateJson">校验</el-button>
          <el-button size="small" :icon="ArrowLeftRight" @click="swapJson">交换</el-button>
          <el-button size="small" :icon="Clipboard" @click="copyJson(resultText)" :disabled="!resultText">复制结果</el-button>
        </div>
        <el-tag v-if="validateMsg" :type="validateOk ? 'success' : 'danger'" effect="light">
          {{ validateMsg }}
        </el-tag>
      </div>
      <div class="editor-split">
        <div class="editor-item">
          <div class="editor-label">输入</div>
          <el-input
            v-model="inputText"
            type="textarea"
            :rows="12"
            placeholder="输入 JSON 字符串..."
            class="json-editor"
          />
        </div>
        <div class="editor-item">
          <div class="editor-label">输出</div>
          <el-input
            v-model="resultText"
            type="textarea"
            :rows="12"
            readonly
            class="json-editor result"
          />
        </div>
      </div>
    </div>

    <!-- Hash 计算 -->
    <div v-show="subTab === 'hash'" class="panel hash-panel">
      <ToolHint text="输入任意文本，勾选算法后点「计算」；开启 HMAC-SHA256 需同时填写密钥" />
      <div class="hash-input">
        <el-input
          v-model="hashInput"
          type="textarea"
          :rows="8"
          placeholder="输入待计算哈希的文本..."
        />
        <div class="hash-options">
          <el-checkbox-group v-model="hashAlgos">
            <el-checkbox label="md5">MD5</el-checkbox>
            <el-checkbox label="sha1">SHA-1</el-checkbox>
            <el-checkbox label="sha256">SHA-256</el-checkbox>
            <el-checkbox label="sha384">SHA-384</el-checkbox>
            <el-checkbox label="sha512">SHA-512</el-checkbox>
          </el-checkbox-group>
          <div class="hmac-row">
            <el-switch v-model="useHmac" active-text="HMAC-SHA256" />
            <el-input v-if="useHmac" v-model="hmacKey" size="small" placeholder="密钥" style="width:200px;" />
          </div>
          <el-button type="primary" :icon="Play" :loading="hashLoading" @click="runHash">计算</el-button>
        </div>
      </div>
      <div class="hash-results">
        <div v-for="item in hashResults" :key="item.algo" class="hash-row">
          <span class="hash-algo">{{ item.algo.toUpperCase() }}</span>
          <el-input v-model="item.value" readonly size="small" />
          <el-button size="small" :icon="Clipboard" circle @click="copyOne(item.value)" :disabled="!item.value" />
        </div>
      </div>
    </div>

    <!-- 编码转换 -->
    <div v-show="subTab === 'encode'" class="panel">
      <ToolHint text="「全部编码」把输入转为 Base64/URL/Unicode 等；「全部解码」尝试逆向还原，也可用行尾按钮把某条结果回填为输入" />
      <div class="encode-input-row">
        <el-input
          v-model="encodeInput"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 8 }"
          placeholder="输入待编码/解码的文本..."
        />
        <div class="btn-group">
          <el-button size="small" :icon="ArrowRight" @click="runEnCode">全部编码</el-button>
          <el-button size="small" :icon="ArrowLeft" @click="runDeCode">全部解码</el-button>
          <el-button size="small" @click="clearEncode">清空</el-button>
        </div>
      </div>
      <div class="encode-results">
        <div v-for="row in encodeRows" :key="row.key" class="encode-row">
          <div class="encode-label">{{ row.label }}</div>
          <el-input v-model="row.value" size="small" placeholder="等待输入..." />
          <el-button size="small" :icon="Clipboard" circle @click="copyOne(row.value)" :disabled="!row.value" />
          <el-button size="small" :icon="ArrowLeftRight" circle @click="row.value && (encodeInput = row.value)" :disabled="!row.value" title="用此结果回填输入" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * JSON/Hash/编码 工具箱 - 三个子工具用通用 TopTabs 切换
 * 统一卡片化视觉：面板使用主题变量 --bg-card / --border-subtle / --radius-btn / --shadow-card
 */
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import TopTabs, { type TopTabItem } from '@/components/TopTabs.vue';
import ToolHint from '@/components/ToolHint.vue';
import {
  Wand2, Minimize2, Lock, Unlock, CircleCheck, ArrowLeftRight,
  Clipboard, Play, ArrowRight, ArrowLeft,
} from '@lucide/vue';
import { computeHash } from '../../shared/hash';
import type { HashAlgorithm } from '../../shared/types';
import { writeClipboard } from '../../shared/clipboard';

// ==================== 子工具 Tab ====================
const subTab = ref<'json' | 'hash' | 'encode'>('json');
/** 子工具 Tab 数据源（纯文字，不强配色，回退主题主色） */
const subTabs: TopTabItem[] = [
  { key: 'json', label: 'JSON 格式化' },
  { key: 'hash', label: 'Hash 计算' },
  { key: 'encode', label: '编码转换' },
];

// ==================== JSON 格式化 ====================
const inputText = ref('');
const resultText = ref('');
const indentSize = ref<number | 'tab'>(2);
const validateMsg = ref('');
const validateOk = ref(true);

function getIndent(): string | number {
  return indentSize.value === 'tab' ? '\t' : indentSize.value;
}

function formatJson() {
  try {
    resultText.value = JSON.stringify(JSON.parse(inputText.value), null, getIndent());
    validateMsg.value = '✅ 格式化成功';
    validateOk.value = true;
  } catch (e: any) {
    validateMsg.value = '❌ JSON 解析失败: ' + e.message;
    validateOk.value = false;
  }
}

function minifyJson() {
  try {
    resultText.value = JSON.stringify(JSON.parse(inputText.value));
    validateMsg.value = '✅ 压缩成功';
    validateOk.value = true;
  } catch (e: any) {
    validateMsg.value = '❌ JSON 解析失败: ' + e.message;
    validateOk.value = false;
  }
}

function escapeJson() {
  resultText.value = inputText.value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  validateMsg.value = '';
}

function unescapeJson() {
  try {
    // 简单反转义，用 JSON.parse 带引号包裹来完整处理所有 \X
    resultText.value = JSON.parse('"' + inputText.value + '"');
    validateMsg.value = '✅ 反转义成功';
    validateOk.value = true;
  } catch (e: any) {
    // 手动回退
    resultText.value = inputText.value
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
    validateMsg.value = '⚠️ 部分反转义 (手动)';
    validateOk.value = true;
  }
}

function validateJson() {
  if (!inputText.value.trim()) {
    validateMsg.value = '⚠️ 输入为空';
    validateOk.value = false;
    return;
  }
  try {
    JSON.parse(inputText.value);
    validateMsg.value = '✅ JSON 合法';
    validateOk.value = true;
  } catch (e: any) {
    // 估算行号
    const match = e.message.match(/position\s+(\d+)/i);
    let lineHint = '';
    if (match) {
      const pos = parseInt(match[1], 10);
      lineHint = `（约第 ${inputText.value.slice(0, pos).split('\n').length} 行）`;
    }
    validateMsg.value = '❌ 不合法: ' + e.message + lineHint;
    validateOk.value = false;
  }
}

function swapJson() {
  [inputText.value, resultText.value] = [resultText.value, inputText.value];
}

async function copyJson(text: string) {
  await writeClipboard(text);
  ElMessage.success('已复制到剪贴板');
}

// ==================== Hash 计算 ====================
const hashInput = ref('');
const hashAlgos = ref<HashAlgorithm[]>(['md5', 'sha256']);
const useHmac = ref(false);
const hmacKey = ref('');
const hashLoading = ref(false);

const hashResults = reactive<{ algo: HashAlgorithm; value: string; error?: string }[]>([]);

async function runHash() {
  hashResults.splice(0);
  hashLoading.value = true;
  const algos = [...hashAlgos.value];
  if (useHmac.value) algos.push('hmac-sha256');
  for (const algo of algos) {
    hashResults.push({ algo, value: '' });
  }
  for (let i = 0; i < hashResults.length; i++) {
    const r = hashResults[i];
    try {
      r.value = await computeHash(hashInput.value, r.algo, hmacKey.value);
    } catch (e: any) {
      r.error = e.message;
      r.value = '错误: ' + e.message;
    }
  }
  hashLoading.value = false;
}

async function copyOne(text: string) {
  if (!text) return;
  await writeClipboard(text);
  ElMessage.success('已复制');
}

// ==================== 编码转换 ====================
const encodeInput = ref('');

interface EncodeRow { key: string; label: string; value: string }
const encodeRows: EncodeRow[] = reactive([
  { key: 'base64', label: 'Base64', value: '' },
  { key: 'url', label: 'URL', value: '' },
  { key: 'unicode', label: 'Unicode 转义', value: '' },
  { key: 'html', label: 'HTML 实体', value: '' },
  { key: 'hex', label: 'Hex', value: '' },
]);

function utf8B64Encode(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}
function utf8B64Decode(s: string): string {
  try {
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch { return '解码失败'; }
}
function unicodeEscape(s: string): string {
  return Array.from(s).map(c => {
    const code = c.charCodeAt(0);
    return code > 127 ? '\\u' + code.toString(16).padStart(4, '0') : c;
  }).join('');
}
function unicodeUnescape(s: string): string {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
function htmlEncode(s: string): string {
  return s.replace(/[&<>"']/g, c => HTML_ENTITIES[c] || c);
}
function htmlDecode(s: string): string {
  return s.replace(/&(#?[\w]+);/g, (_m, e) => {
    if (e.startsWith('#')) return String.fromCharCode(parseInt(e.slice(1), 10));
    const inv: Record<string, string> = Object.fromEntries(Object.entries(HTML_ENTITIES).map(([k, v]) => [v, k]));
    return inv[e] || _m;
  });
}
function strToHex(s: string): string {
  const bytes = new TextEncoder().encode(s);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToStr(s: string): string {
  try {
    const normalized = s.replace(/\s+/g, '');
    const bytes = new Uint8Array(normalized.match(/.{1,2}/g)!.map(h => parseInt(h, 16)));
    return new TextDecoder().decode(bytes);
  } catch { return '解码失败'; }
}

function runEnCode() {
  const t = encodeInput.value;
  if (!t) return;
  encodeRows[0].value = utf8B64Encode(t);
  encodeRows[1].value = encodeURIComponent(t);
  encodeRows[2].value = unicodeEscape(t);
  encodeRows[3].value = htmlEncode(t);
  encodeRows[4].value = strToHex(t);
}

function runDeCode() {
  const t = encodeInput.value.trim();
  if (!t) return;
  // 智能识别：纯 base64 / url 编码 / hex 长度双数
  // 依次尝试解码
  const results: string[] = [];
  try { results.push('Base64: ' + utf8B64Decode(t)); } catch {}
  try { results.push('URL: ' + decodeURIComponent(t)); } catch {}
  try {
    if (/^[0-9a-fA-F]+$/.test(t) && t.length % 2 === 0) {
      results.push('Hex: ' + hexToStr(t));
    }
  } catch {}
  try {
    if (/\\u[0-9a-fA-F]{4}/.test(t)) results.push('Unicode: ' + unicodeUnescape(t));
  } catch {}
  if (results.length) {
    encodeRows[0].value = utf8B64Decode(t);
    encodeRows[1].value = decodeURIComponent(t);
    encodeRows[3].value = htmlDecode(t);
    ElMessage.info('尝试解码: ' + results.join(' | '));
  } else {
    ElMessage.warning('无法识别编码类型');
  }
}

function clearEncode() {
  encodeInput.value = '';
  encodeRows.forEach(r => r.value = '');
}
</script>

<style lang="scss" scoped>
/* 根撑满内容区（toolbox-content 的剩余高度），内嵌 TopTabs + 面板纵向排列 */
.json-hash-converter {
  display: flex; flex-direction: column; gap: 14px;
  height: 100%; min-height: 0;
}

/* 内嵌 TopTabs 与下方面板的间距（覆盖通用组件的默认 margin-bottom） */
.json-hash-converter :deep(.top-tabs) { margin-bottom: 0; }

/* 统一工具卡片：flex:1 撑满剩余高度，避免内容挤在顶部 */
.panel {
  display: flex; flex-direction: column; gap: 14px;
  flex: 1; min-height: 0;
  padding: 16px;
  background: var(--bg-card, var(--el-bg-color));
  border: 1px solid var(--border-subtle, var(--el-border-color-lighter));
  border-radius: var(--radius-btn, 10px);
  box-shadow: var(--shadow-card, none);
}

/* 工具栏：浅底圆角条 */
.toolbar {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 10px 14px;
  background: var(--bg-base, var(--el-fill-color-light));
  border-radius: 8px;
}
.btn-group { display: flex; gap: 6px; flex-wrap: wrap; }

/* JSON 编辑器对：弹性占满剩余高度 */
.editor-split {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  flex: 1; min-height: 0;
}
.editor-item { display: flex; flex-direction: column; gap: 6px; flex: 1; min-height: 0; }
.editor-label { font-size: 12px; color: var(--text-secondary, var(--el-text-color-secondary)); font-weight: 500; flex-shrink: 0; }
.json-editor { flex: 1; min-height: 0; }
.json-editor :deep(.el-textarea) { height: 100%; }
.json-editor :deep(.el-textarea__inner) {
  height: 100% !important;
  font-family: Consolas, 'Courier New', monospace; font-size: 13px; line-height: 1.5;
  resize: none;
}
.json-editor.result :deep(.el-textarea__inner) { background: var(--bg-base, var(--el-fill-color-lighter)); }

/* Hash 子页：输入区撑满 */
.hash-panel { min-height: 0; }
.hash-input { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; }
.hash-input :deep(.el-textarea) { flex: 1; min-height: 0; }
.hash-input :deep(.el-textarea__inner) {
  height: 100% !important; resize: none;
  font-family: Consolas, 'Courier New', monospace; font-size: 13px;
}
.hash-options {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 10px 14px;
  background: var(--bg-base, var(--el-fill-color-light));
  border-radius: 8px;
}
.hmac-row { display: flex; align-items: center; gap: 8px; }

.hash-results { display: flex; flex-direction: column; gap: 8px; }
.hash-row { display: grid; grid-template-columns: 100px 1fr auto; gap: 8px; align-items: center; }
.hash-algo { font-family: Consolas, monospace; font-weight: 600; color: var(--color-primary, var(--el-color-primary)); }

.encode-input-row { display: flex; flex-direction: column; gap: 10px; }
.encode-results { display: flex; flex-direction: column; gap: 8px; }
.encode-row {
  display: grid; grid-template-columns: 100px 1fr auto auto; gap: 8px; align-items: center;
  padding: 6px 10px;
  background: var(--bg-base, var(--el-fill-color-light));
  border-radius: 6px;
}
.encode-label { font-weight: 500; font-size: 13px; }

@media (max-width: 900px) {
  .editor-split { grid-template-columns: 1fr; }
}
</style>