<template>
  <div class="regex-tester">
    <ToolHint text="填写正则本体（无需 / 斜杠包裹）与待匹配文本，点「测试」查看高亮与捕获组；语法错误会即时红条提示" />
    <!-- 正则输入行 -->
    <div class="regex-input-row">
      <div class="pattern-wrap">
        <span class="pattern-slash">/</span>
        <el-input v-model="pattern" class="pattern-input" placeholder="正则表达式..." @input="triggerTest" />
        <span class="pattern-slash">/</span>
        <el-input v-model="flags" class="flags-input" placeholder="flags" @input="triggerTest" />
      </div>
      <div class="flags-checks">
        <el-checkbox-group v-model="flagsArr">
          <el-checkbox :value="'g'" label="g">g 全局</el-checkbox>
          <el-checkbox :value="'i'" label="i">i 忽略大小写</el-checkbox>
          <el-checkbox :value="'m'" label="m">m 多行</el-checkbox>
          <el-checkbox :value="'s'" label="s">s dotAll</el-checkbox>
          <el-checkbox :value="'u'" label="u">u Unicode</el-checkbox>
        </el-checkbox-group>
      </div>
      <div class="actions">
        <el-button type="primary" :icon="Play" :disabled="!pattern" @click="runTest">测试</el-button>
        <el-button :icon="Trash2" @click="resetAll">清空</el-button>
      </div>
    </div>

    <!-- 常用模板 -->
    <div class="template-row">
      <span class="label">常用模板：</span>
      <el-select v-model="templateId" placeholder="选择模板" style="width:200px;" @change="applyTemplate">
        <el-option v-for="t in templates" :key="t.id" :label="t.label" :value="t.id" />
      </el-select>
    </div>

    <!-- 正则错误提示 -->
    <el-alert v-if="regexError" :title="'正则语法错误: ' + regexError" type="error" :closable="false" show-icon />

    <!-- 测试字符串 -->
    <div class="test-string-wrap">
      <div class="section-header">
        <span>测试字符串</span>
        <span class="char-count">字符数: {{ testString.length }}</span>
      </div>
      <el-input
        v-model="testString"
        type="textarea"
        :rows="6"
        placeholder="输入待匹配的文本..."
        class="test-textarea"
        @input="triggerTest"
      />
    </div>

    <!-- 匹配高亮 -->
    <div class="highlight-wrap">
      <div class="section-header">
        <span>匹配高亮</span>
        <span class="match-count" v-if="matches.length">找到 {{ matches.length }} 个匹配</span>
      </div>
      <div class="highlight-body" v-html="highlightedHtml" />
    </div>

    <!-- 捕获组详情表 -->
    <div class="groups-wrap">
      <div class="section-header">
        <span>捕获组详情</span>
      </div>
      <el-table :data="matches" size="small" stripe max-height="260">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column label="全文 (Group 0)" min-width="200">
          <template #default="{ row }">
            <code class="group-code">{{ row.full }}</code>
          </template>
        </el-table-column>
        <el-table-column label="分组详情" min-width="260">
          <template #default="{ row }">
            <div class="group-nested">
              <div v-for="(g, i) in row.groups.filter((x: string | undefined) => x !== undefined)" :key="i" class="group-item">
                <span class="g-name">{{ row.namedGroups[getGroupName(row, i)] ?? `$${i + 1}` }}</span>
                <code>{{ g }}</code>
              </div>
              <div v-if="Object.keys(row.namedGroups).length" class="group-named">
                <div v-for="(v, k) in row.namedGroups" :key="k" class="group-item named">
                  <span class="g-name">.{{ k }}</span><code>{{ v }}</code>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="index" label="Index" width="80" />
        <el-table-column prop="length" label="长度" width="70" />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 正则表达式测试器 - Tab2
 */
import { ref, computed, watch } from 'vue';
import { Play, Trash2 } from '@lucide/vue';
import ToolHint from '../../components/ToolHint.vue';
import type { RegexMatch } from '../../shared/types';
import { debounce } from '@/utils';

// ==================== 正则状态 ====================
const pattern = ref('');
const flags = ref('g');
const flagsArr = computed({
  get: () => flags.value.split('').filter(Boolean),
  set: (arr: string[]) => { flags.value = arr.join(''); }
});
const testString = ref('');
const matches = ref<RegexMatch[]>([]);
const regexError = ref('');
const templateId = ref('');

// ==================== 常用模板 ====================
interface RegexTemplate {
  id: string; label: string; pattern: string; flags: string; sample: string;
}
const templates: RegexTemplate[] = [
  { id: 'email', label: '邮箱', pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.-]+', flags: 'g', sample: 'user@example.com, admin@sub.domain.org' },
  { id: 'phone', label: '大陆手机号', pattern: '1[3-9]\\d{9}', flags: 'g', sample: '我的手机号 13812345678，备用 15900001111' },
  { id: 'url', label: 'URL', pattern: 'https?://[\\w\\-._~:/?#\\[\\]@!$&\'()*+,;=%]+', flags: 'gi', sample: '访问 https://example.com/path?q=1 看看' },
  { id: 'ipv4', label: 'IPv4', pattern: '(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d?\\d)', flags: 'g', sample: '服务器: 192.168.1.1 和 8.8.8.8' },
  { id: 'date', label: '日期 YYYY-MM-DD', pattern: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])', flags: 'g', sample: '今天 2024-01-15 明天 2024-01-16' },
  { id: 'time', label: '时间 HH:MM:SS', pattern: '(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d', flags: 'g', sample: '时间 14:30:00 和 09:05:59' },
  { id: 'cnid', label: '身份证号', pattern: '[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]', flags: 'g', sample: '身份证 110101199003071234' },
  { id: 'chinese', label: '中文字符', pattern: '[\\u4e00-\\u9fa5]+', flags: 'g', sample: 'Hello 世界 你好 World' },
  { id: 'hexcolor', label: 'Hex 颜色', pattern: '#(?:[0-9a-fA-F]{3}){1,2}', flags: 'g', sample: '颜色 #fff #333333 #abc123' },
  { id: 'uuid', label: 'UUID', pattern: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', flags: 'gi', sample: 'uuid: 550e8400-e29b-41d4-a716-446655440000' },
];

function applyTemplate(id: string) {
  const t = templates.find(x => x.id === id);
  if (!t) return;
  pattern.value = t.pattern;
  flags.value = t.flags;
  testString.value = t.sample;
  runTest();
}

// ==================== 正则测试核心 ====================
function runTest() {
  matches.value = [];
  regexError.value = '';
  if (!pattern.value) return;
  if (!testString.value) return;

  let regex: RegExp;
  try {
    regex = new RegExp(pattern.value, flags.value || 'g');
  } catch (e: any) {
    regexError.value = e.message;
    return;
  }

  // 迭代 exec
  const found: RegexMatch[] = [];
  // 强制 g 以迭代
  const hasG = regex.global;
  const safe = hasG ? regex : new RegExp(regex.source, regex.flags + 'g');
  let m: RegExpExecArray | null;
  let safety = 0;
  const start = Date.now();
  while ((m = safe.exec(testString.value)) !== null) {
    if (Date.now() - start > 2000) {
      regexError.value = '执行超时（可能灾难性回溯），已中止';
      break;
    }
    found.push({
      full: m[0],
      groups: m.slice(1).map(g => g === undefined ? undefined : g),
      namedGroups: { ...((m.groups as Record<string, string>) || {}) },
      index: m.index,
      length: m[0].length,
    });
    if (!hasG) break;
    safety++;
    if (safety > 100000) break;
  }
  matches.value = found;
}

// 防抖触发
const triggerTest = debounce(() => {
  if (pattern.value && testString.value) runTest();
}, 300);
watch([pattern, flags], () => triggerTest());

function getGroupName(row: RegexMatch, idx: number): string {
  // 命名捕获组的顺序不是固定 index，直接用 $idx+1 展示
  return `$${idx + 1}`;
}

function resetAll() {
  pattern.value = ''; flags.value = 'g'; testString.value = '';
  matches.value = []; regexError.value = ''; templateId.value = '';
}

// ==================== 匹配高亮 HTML（XSS 防护） ====================
const highlightedHtml = computed(() => {
  const src = testString.value;
  if (!src) return '';
  if (regexError.value || !matches.value.length) {
    return escapeHtml(src).replace(/\n/g, '<br>');
  }
  // 按 index 排序，从后往前拼防止位置偏移
  const sorted = [...matches.value].sort((a, b) => b.index - a.index);
  let result = escapeHtml(src);
  let colorIdx = 0;
  for (const m of sorted) {
    const colorClass = `match-${colorIdx++ % 8}`;
    const esc = escapeHtml(m.full);
    result = result.slice(0, m.index) +
      `<mark class="match ${colorClass}">${esc}</mark>` +
      result.slice(m.index + m.length);
  }
  return result.replace(/\n/g, '<br>');
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c] || c);
}
</script>

<style lang="scss" scoped>
/* 根撑满内容区，各区块纵向排列，测试字符串区弹性占满 */
.regex-tester {
  display: flex; flex-direction: column; gap: 14px;
  height: 100%; min-height: 0;
}

/* 正则输入行：统一主操作卡片 */
.regex-input-row {
  display: flex; flex-direction: column; gap: 10px;
  padding: 14px 16px;
  background: var(--bg-card, var(--el-bg-color));
  border: 1px solid var(--border-subtle, var(--el-border-color-lighter));
  border-radius: var(--radius-btn, 10px);
  box-shadow: var(--shadow-card, none);
}
.pattern-wrap {
  display: grid; grid-template-columns: 20px 1fr 20px 120px; gap: 6px; align-items: center;
}
.pattern-slash { font-family: Consolas, monospace; font-weight: 700; color: var(--color-primary, var(--el-color-primary)); font-size: 18px; }
.pattern-input :deep(.el-input__inner) { font-family: Consolas, monospace; font-size: 14px; }
.flags-input :deep(.el-input__inner) { font-family: Consolas, monospace; font-weight: 600; }
.flags-checks { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.actions { display: flex; gap: 8px; justify-content: flex-end; }

.template-row { display: flex; align-items: center; gap: 10px; }
.label { color: var(--text-secondary, var(--el-text-color-secondary)); font-size: 13px; }

/* 信息区块：浅底内卡 */
.test-string-wrap, .highlight-wrap, .groups-wrap {
  padding: 12px 14px;
  background: var(--bg-base, var(--el-fill-color-light));
  border: 1px solid var(--border-subtle, var(--el-border-color-lighter));
  border-radius: 8px;
}
.section-header {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; color: var(--text-secondary, var(--el-text-color-secondary));
  margin-bottom: 8px; font-weight: 500;
}
.char-count, .match-count { font-family: Consolas, monospace; }

/* 测试字符串：弹性占满剩余高度 */
.test-string-wrap {
  flex: 1; min-height: 160px;
  display: flex; flex-direction: column;
}
.test-textarea { flex: 1; min-height: 0; }
.test-textarea :deep(.el-textarea) { height: 100%; }
.test-textarea :deep(.el-textarea__inner) {
  height: 100% !important; resize: none;
  font-family: Consolas, monospace; font-size: 13px; line-height: 1.6;
}

.highlight-body {
  white-space: pre-wrap; word-break: break-word;
  font-family: Consolas, monospace; font-size: 13px; line-height: 1.6;
  background: var(--bg-card, var(--el-bg-color));
  padding: 10px; border-radius: 6px;
  max-height: 300px; overflow: auto;
}

:deep(.match) { border-radius: 3px; padding: 0 2px; }
:deep(.match-0) { background: #ffe58f; }
:deep(.match-1) { background: #b7eb8f; }
:deep(.match-2) { background: #91d5ff; }
:deep(.match-3) { background: #ffadd2; }
:deep(.match-4) { background: #ffd591; }
:deep(.match-5) { background: #d3adf7; }
:deep(.match-6) { background: #87e8de; }
:deep(.match-7) { background: #ffa39e; }

.group-code {
  background: var(--bg-base, var(--el-fill-color-lighter));
  padding: 1px 5px; border-radius: 3px;
  font-family: Consolas, monospace; font-size: 12px;
}
.group-nested { display: flex; flex-direction: column; gap: 4px; }
.group-item { display: flex; gap: 6px; align-items: center; font-size: 12px; }
.g-name { color: var(--color-primary, var(--el-color-primary)); min-width: 48px; }
</style>
