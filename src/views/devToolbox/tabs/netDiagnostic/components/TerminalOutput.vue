<template>
  <div class="terminal-output">
    <div class="terminal-toolbar">
      <span class="terminal-title">终端输出</span>
      <span class="dot red" /><span class="dot yellow" /><span class="dot green" />
      <div class="spacer" />
      <el-button size="small" :icon="Clipboard" :disabled="!raw" @click="onCopy">复制</el-button>
    </div>
    <div class="terminal-body" ref="bodyRef">{{ raw || '等待执行...' }}</div>
  </div>
</template>

<script setup lang="ts">
/**
 * 终端风格输出组件：黑底等宽 + 三色圆点 + 自动滚动到底
 */
import { watch, ref, nextTick } from 'vue';
import { Clipboard } from '@lucide/vue';
import { writeClipboard } from '../../../shared/clipboard';

const props = defineProps<{ raw: string }>();
const emit = defineEmits<{ (e: 'copy'): void }>();
const bodyRef = ref<HTMLDivElement | null>(null);

watch(() => props.raw, async () => {
  await nextTick();
  if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight;
});

async function onCopy() {
  await writeClipboard(props.raw);
  emit('copy');
}
</script>

<style lang="scss" scoped>
.terminal-output {
  border-radius: 8px; overflow: hidden; border: 1px solid #2d2d2d;
}
.terminal-toolbar {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; background: #2d2d2d; color: #ccc;
  font-size: 12px;
}
.terminal-title { font-weight: 500; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.dot.red { background: #ff5f57; }
.dot.yellow { background: #febc2e; }
.dot.green { background: #28c840; }
.spacer { flex: 1; }
.terminal-body {
  background: #1e1e1e; color: #d4d4d4;
  padding: 12px; font-family: Consolas, 'Courier New', monospace; font-size: 13px;
  line-height: 1.55; min-height: 120px; max-height: 360px; overflow: auto;
  white-space: pre-wrap; word-break: break-all;
}
</style>
