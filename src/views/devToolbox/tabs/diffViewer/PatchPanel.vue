<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="Patch 工具"
    direction="rtl"
    size="480px"
    destroy-on-close
  >
    <div class="patch-panel">
      <!-- ========== 步骤 1：粘贴 Patch ========== -->
      <div class="section">
        <div class="section-title">
          <span>① 粘贴 patch / .diff 文件</span>
          <el-tag v-if="parsedPatches.length > 0" size="small" type="success" effect="dark">
            {{ parsedPatches.length }} 个文件 / {{ totalHunks }} 个 hunk 已解析
          </el-tag>
        </div>
        <el-input
          v-model="patchText"
          type="textarea"
          :autosize="{ minRows: 6, maxRows: 14 }"
          placeholder="粘贴 unified diff 或 .patch 文件内容...\n\n例如：\n--- A.txt\n+++ B.txt\n@@ -1,3 +1,4 @@\n hello\n-world\n+world2"
          spellcheck="false"
          @input="onPatchInput"
        />
        <div class="section-actions">
          <el-button size="small" :icon="Eraser" @click="clearPatch">清空</el-button>
          <el-button size="small" :icon="Upload" @click="loadPatchFile">📂 读 .patch 文件</el-button>
        </div>
      </div>

      <!-- ========== 步骤 2：Patch 预览 ========== -->
      <div v-if="parsedPatches.length > 0" class="section">
        <div class="section-title">② 预览解析结果</div>
        <div class="patch-preview">
          <template v-for="(file, fIdx) in parsedPatches" :key="fIdx">
            <div class="patch-file">
              <div class="pf-header">
                <span class="pf-old">{{ file.oldFileName || '(原文件)' }}</span>
                <ArrowRight class="pf-arrow" />
                <span class="pf-new">{{ file.newFileName || '(新文件)' }}</span>
              </div>
              <div class="pf-hunks">
                <div v-for="(hunk, hIdx) in file.hunks" :key="hIdx" class="pf-hunk">
                  <div class="ph-header">
                    <code>@@ -{{ hunk.oldStart }},{{ hunk.oldLines }} +{{ hunk.newStart }},{{ hunk.newLines }} @@</code>
                  </div>
                  <pre class="ph-body">
<span v-for="(line, lIdx) in hunk.lines" :key="lIdx" :class="lineClass(line)">{{ line }}</span>
                  </pre>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- ========== 步骤 3：应用 / 反向 ========== -->
      <div v-if="parsedPatches.length > 0" class="section">
        <div class="section-title">③ 应用到一侧</div>
        <div class="apply-row">
          <el-button
            type="primary"
            :icon="ArrowRightLeft"
            @click="applyToSide('left')"
            :loading="applying"
          >
            ← 把 patch 应用到 A 侧
          </el-button>
          <el-button
            type="primary"
            :icon="ArrowRightLeft"
            @click="applyToSide('right')"
            :loading="applying"
          >
            → 把 patch 应用到 B 侧
          </el-button>
        </div>
        <div class="section-title" style="margin-top: 14px;">反向 patch（回滚）</div>
        <div class="apply-row">
          <el-button size="small" :icon="RotateCcw" @click="reversePatch" :disabled="!parsedPatches.length">
            生成反向 patch（B→A）
          </el-button>
          <el-button size="small" :icon="Download" @click="exportReversed" :disabled="!reversedPatch">
            下载反向 patch
          </el-button>
        </div>
      </div>

      <!-- ========== 错误提示 ========== -->
      <el-alert
        v-if="parseError"
        :title="parseError"
        type="error"
        :closable="false"
        show-icon
        style="margin-top: 10px"
      />
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
/**
 * Patch 工具面板 —— 粘贴 patch → 解析预览 → 应用到 A/B 侧 → 反向回滚
 * 通过 props.patch 把 diff-lib 的 parsePatch / applyPatch / reversePatch 集成进来
 */
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Eraser, Upload, Download, ArrowRightLeft, ArrowRight, RotateCcw } from '@lucide/vue';
import * as DiffLib from 'diff';

const props = defineProps<{
  visible: boolean;
  /** 应用 patch 时需要把结果回传给父组件 */
  onApplySide?: (side: 'left' | 'right', patchedText: string) => void;
  /** A 侧原文（apply 时需要 base） */
  leftText?: string;
  /** B 侧原文 */
  rightText?: string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  /** patch 应用结果回传给父 */
  (e: 'apply-result', side: 'left' | 'right', text: string): void;
}>();

// ============== 状态 ==============
const patchText = ref('');
const parseError = ref('');
const parsedPatches = ref<any[]>([]);
const applying = ref(false);
const reversedPatch = ref('');

const totalHunks = computed(() =>
  parsedPatches.value.reduce((s, p) => s + (p?.hunks?.length ?? 0), 0)
);

// ============== 解析 patch 文本 ==============
function onPatchInput() {
  reversedPatch.value = '';
  const t = patchText.value.trim();
  if (!t) { parsedPatches.value = []; parseError.value = ''; return; }
  try {
    // @ts-ignore - parsePatch 返回 StructuredPatch[]
    const result = DiffLib.parsePatch(t);
    if (!result || result.length === 0) {
      parseError.value = '无法解析 patch：没有有效的 hunk 结构';
      parsedPatches.value = [];
      return;
    }
    parsedPatches.value = result;
    parseError.value = '';
  } catch (e: any) {
    parseError.value = '解析失败: ' + (e?.message ?? '未知错误');
    parsedPatches.value = [];
  }
}

// ============== 行样式 ============
function lineClass(line: string): string {
  if (line.startsWith('+')) return 'pl-add';
  if (line.startsWith('-')) return 'pl-del';
  if (line.startsWith('\\')) return 'pl-ctx';
  return '';
}

// ============== 清空 ==============
function clearPatch() {
  patchText.value = '';
  parsedPatches.value = [];
  parseError.value = '';
  reversedPatch.value = '';
}

// ============== 读取 .patch 文件 ==============
function loadPatchFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.patch,.diff,.txt';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      patchText.value = reader.result as string;
      onPatchInput();
    };
    reader.readAsText(file);
  };
  input.click();
}

// ============== 应用 patch 到 A 或 B 侧 ==============
async function applyToSide(side: 'left' | 'right') {
  if (parsedPatches.value.length === 0) {
    ElMessage.warning('先解析 patch 再应用');
    return;
  }
  applying.value = true;
  await new Promise(r => setTimeout(r, 30)); // 给 loading 个 tick
  try {
    const base = (side === 'left' ? props.leftText : props.rightText) ?? '';
    const result = DiffLib.applyPatch(base, patchText.value);
    if (result === false) {
      // 应用失败：尝试降低 fuzzFactor 也没用
      // 提供友好提示：可能是上下文不匹配 / 目标文本不是 patch 的 base
      ElMessage.error('patch 应用失败 —— 可能目标文本不是 patch 所基于的原文件，或上下文差异太大');
      return;
    }
    emit('apply-result', side, result);
    ElMessage.success(`patch 已应用到 ${side === 'left' ? 'A' : 'B'} 侧（${result.length} 字符）`);
  } catch (e: any) {
    ElMessage.error('patch 应用异常: ' + (e?.message ?? e));
  } finally {
    applying.value = false;
  }
}

// ============== 反向 patch ==============
function reversePatch() {
  if (parsedPatches.value.length === 0) return;
  try {
    // @ts-ignore - reversePatch 类型声明是 StructuredPatch，数组也可以
    const reversed = parsedPatches.value.map(p => DiffLib.reversePatch(p));
    // @ts-ignore - formatPatch
    reversedPatch.value = reversed.map(p => DiffLib.formatPatch(p)).join('\n\n');
    ElMessage.success('反向 patch 生成完成 —— 会把 B 变回 A');
  } catch (e: any) {
    ElMessage.error('反向 patch 失败: ' + (e?.message ?? e));
  }
}

function exportReversed() {
  if (!reversedPatch.value) return;
  const blob = new Blob([reversedPatch.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reverse-${Date.now()}.patch`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<style lang="scss" scoped>
.patch-panel { display: flex; flex-direction: column; gap: 14px; padding-bottom: 40px; }

.section {
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 6px;
  background: var(--el-fill-color-lighter);
}
.section-title {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; font-weight: 600; color: var(--el-text-color-primary);
}
.section-actions { display: flex; gap: 6px; }
.apply-row { display: flex; flex-wrap: wrap; gap: 8px; }

/* ===== Patch 预览 ===== */
.patch-preview {
  max-height: 360px; overflow: auto;
  font-family: Consolas, monospace; font-size: 12px; line-height: 1.55;
  background: #1e1e1e; border-radius: 4px; padding: 4px;
}
.patch-file { margin-bottom: 12px; }
.pf-header {
  display: flex; gap: 6px; align-items: center;
  padding: 6px 10px; background: rgba(64,158,255,0.15); border-radius: 3px;
  font-size: 12px; margin-bottom: 6px;
}
.pf-old { color: #ff7875; }
.pf-new { color: #b7eb8f; }
.pf-arrow { color: #9ca3af; }

.pf-hunks { display: flex; flex-direction: column; gap: 6px; }
.pf-hunk { border: 1px solid rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }
.ph-header {
  padding: 3px 8px; background: rgba(255,255,255,0.05);
  font-size: 11px; color: #9cdcfe;
}
.ph-body {
  margin: 0; padding: 4px 8px; white-space: pre-wrap;
  color: #d4d4d4;
}
.ph-body .pl-add { color: #b7eb8f; background: rgba(34,197,94,0.15); }
.ph-body .pl-del { color: #ff7875; background: rgba(239,68,68,0.15); }
.ph-body .pl-ctx { color: #eab308; }
</style>
