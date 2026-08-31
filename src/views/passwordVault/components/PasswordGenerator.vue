<template>
  <AppDialog v-model="visible" title="密码生成器" :show-fullscreen="false" @open="regenerate">
    <div class="pg">
      <div class="pg-row pg-modes">
        <button :class="['pg-mode', { active: mode === 'random' }]" @click="mode = 'random'">随机密码</button>
        <button :class="['pg-mode', { active: mode === 'phrase' }]" @click="(mode = 'phrase'), regenerate()">口令短语</button>
      </div>

      <!-- 随机密码选项 -->
      <template v-if="mode === 'random'">
        <div class="pg-row">
          <span class="pg-label">长度</span>
          <input v-model.number="length" class="pg-range" type="range" min="8" max="64" @input="regenerate" />
          <span class="pg-value">{{ length }}</span>
        </div>
        <div class="pg-checks">
          <label class="pg-check"><input type="checkbox" v-model="useLower" @change="regenerate" /> 小写 a-z</label>
          <label class="pg-check"><input type="checkbox" v-model="useUpper" @change="regenerate" /> 大写 A-Z</label>
          <label class="pg-check"><input type="checkbox" v-model="useDigit" @change="regenerate" /> 数字 0-9</label>
          <label class="pg-check"><input type="checkbox" v-model="useSymbol" @change="regenerate" /> 符号 !@#$</label>
          <label class="pg-check"><input type="checkbox" v-model="excludeSimilar" @change="regenerate" /> 排除易混淆字符</label>
        </div>
      </template>

      <!-- 口令短语选项 -->
      <template v-else>
        <div class="pg-row">
          <span class="pg-label">单词数</span>
          <input v-model.number="words" class="pg-range" type="range" min="3" max="8" @input="regenerate" />
          <span class="pg-value">{{ words }}</span>
        </div>
        <div class="pg-row">
          <span class="pg-label">分隔符</span>
          <input v-model="separator" class="pg-sep" maxlength="1" @input="regenerate" />
        </div>
        <div class="pg-row">
          <span class="pg-label">首字母大写</span>
          <input type="checkbox" v-model="capitalize" @change="regenerate" />
        </div>
      </template>

      <div class="pg-output">
        <code>{{ output }}</code>
        <button class="pg-copy" title="复制" @click="copyOut">
          <LucideIcon name="Copy" :size="16" />
        </button>
      </div>

      <div class="pg-actions">
        <button class="pg-btn" @click="regenerate"><LucideIcon name="RefreshCw" :size="16" /> 重新生成</button>
        <button class="pg-btn pg-btn--primary" @click="apply">应用</button>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * 密码生成器（对标 Bitwarden）
 * - 随机模式：可配长度/字符集/排除易混淆字符，使用 crypto.getRandomValues 安全随机；
 * - 口令短语模式：从内置词库拼装，可选分隔符与首字母大写。
 * 通过 emit('apply', value) 把结果回传给父组件（如填入新建表单）。
 */
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import AppDialog from '@/components/AppDialog.vue';
import LucideIcon from '@/components/LucideIcon.vue';

const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ (e: 'apply', value: string): void }>();

const mode = ref<'random' | 'phrase'>('random');
const length = ref(16);
const useLower = ref(true);
const useUpper = ref(true);
const useDigit = ref(true);
const useSymbol = ref(true);
const excludeSimilar = ref(true);

const words = ref(4);
const separator = ref('-');
const capitalize = ref(false);

const SIMILAR = 'il1IoO0`\'"|;:,.';
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGIT = '23456789';
const SYMBOL = '!@#$%^&*()-_=+[]{};:,.<>?';
const WORD_LIST = [
  'apple', 'river', 'tiger', 'ocean', 'cloud', 'stone', 'light', 'forest', 'shadow', 'river',
  'mountain', 'silent', 'brave', 'golden', 'winter', 'summer', 'dream', 'storm', 'ember', 'frost',
  'meadow', 'crystal', 'thunder', 'willow', 'falcon', 'amber', 'raven', 'canyon', 'pixel', 'nebula',
  'puzzle', 'velvet', 'harbor', 'lantern', 'comet', 'breeze', 'maple', 'cipher', 'quartz', 'lunar',
];

const output = ref('');

// 每次打开弹窗时重新生成一次，避免初始为空
watch(visible, (v) => {
  if (v) regenerate();
});

function randInt(max: number): number {
  const buf = new Uint32Array(1);
  // 拒绝采样避免模偏置
  const limit = Math.floor(0xffffffff / max) * max;
  let v = 0;
  do {
    crypto.getRandomValues(buf);
    v = buf[0];
  } while (v >= limit);
  return v % max;
}

function pick(str: string): string {
  return str.charAt(randInt(str.length));
}

function regenerate() {
  if (mode.value === 'random') {
    let pool = '';
    if (useLower.value) pool += LOWER;
    if (useUpper.value) pool += UPPER;
    if (useDigit.value) pool += DIGIT;
    if (useSymbol.value) pool += SYMBOL;
    if (excludeSimilar.value) pool = pool.split('').filter((c) => !SIMILAR.includes(c)).join('');
    if (!pool) {
      output.value = '请至少选择一种字符集';
      return;
    }
    let s = '';
    for (let i = 0; i < length.value; i++) s += pick(pool);
    output.value = s;
  } else {
    const parts: string[] = [];
    for (let i = 0; i < words.value; i++) {
      let w = WORD_LIST[randInt(WORD_LIST.length)];
      if (capitalize.value) w = w.charAt(0).toUpperCase() + w.slice(1);
      parts.push(w);
    }
    output.value = parts.join(separator.value || '-');
  }
}

function copyOut() {
  if (!output.value || output.value.startsWith('请')) return;
  navigator.clipboard?.writeText(output.value).then(
    () => ElMessage.success('已复制到剪贴板'),
    () => ElMessage.warning('复制失败'),
  );
}

function apply() {
  if (!output.value || output.value.startsWith('请')) return;
  emit('apply', output.value);
  visible.value = false;
}
</script>

<style scoped lang="scss">
.pg {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 2px;
}
.pg-modes {
  display: flex;
  gap: 8px;
}
.pg-mode {
  flex: 1;
  padding: 8px;
  font-size: 13px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  &.active {
    border-color: var(--color-primary);
    color: var(--color-primary);
    font-weight: 600;
  }
}
.pg-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-primary);
}
.pg-label {
  width: 72px;
  flex: none;
  color: var(--text-secondary);
}
.pg-range {
  flex: 1;
}
.pg-value {
  width: 28px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.pg-sep {
  width: 40px;
  padding: 6px 8px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-base);
  color: var(--text-primary);
  text-align: center;
}
.pg-checks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.pg-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}
.pg-output {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  code {
    flex: 1;
    font-size: 14px;
    color: var(--text-primary);
    word-break: break-all;
  }
}
.pg-copy {
  flex: none;
  display: inline-flex;
  padding: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
  &:hover {
    color: var(--color-primary);
    background: var(--bg-hover, rgba(0, 0, 0, 0.05));
  }
}
.pg-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.pg-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  &--primary {
    color: #fff;
    background: var(--color-primary);
    border-color: var(--color-primary);
    &:hover {
      color: #fff;
      filter: brightness(1.05);
    }
  }
}
</style>
