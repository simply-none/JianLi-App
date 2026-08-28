<template>
  <app-dialog
    :model-value="modelValue"
    title="记录情绪"
    width="460px"
    class="record-emotion-dialog"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    @close="onClose"
  >
    <div class="record-body">
      <div class="record-target">
        提醒：<span class="target-name">{{ reminderTitle }}</span>
        <span class="target-tip">将以该名称作为主题，记录到「主题对话」</span>
      </div>

      <div class="record-block">
        <div class="block-label">当前情绪</div>
        <div class="emotion-list">
          <button
            v-for="e in emotions"
            :key="e.label"
            type="button"
            class="emotion-chip"
            :class="{ active: selected?.label === e.label }"
            @click="selectEmotion(e)"
          >
            <span class="emotion-emoji">{{ e.emoji }}</span>
            <span class="emotion-label">{{ e.label }}</span>
          </button>
        </div>
      </div>

      <div class="record-block">
        <div class="block-label">情绪内容</div>
        <el-input
          v-model="content"
          type="textarea"
          :rows="3"
          maxlength="2000"
          show-word-limit
          placeholder="写下此刻的情绪与想法……"
          class="record-input"
        />
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSave">保存记录</el-button>
    </template>
  </app-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useThemeConversation } from '../composables/useThemeConversation';

/** 可选情绪预设（点击快捷写入，也可自由补充文字） */
const emotions = [
  { label: '开心', emoji: '😊' },
  { label: '平静', emoji: '😌' },
  { label: '放松', emoji: '🧘' },
  { label: '兴奋', emoji: '🤩' },
  { label: '疲惫', emoji: '😮‍💨' },
  { label: '焦虑', emoji: '😰' },
  { label: '愤怒', emoji: '😠' },
  { label: '悲伤', emoji: '😢' },
  { label: '中性', emoji: '😐' },
];

const props = defineProps<{
  modelValue: boolean;
  reminderTitle: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'saved'): void;
}>();

const { findOrCreateThemeByTitle, createConversation } = useThemeConversation();

const selected = ref<{ label: string; emoji: string } | null>(null);
const content = ref('');
const saving = ref(false);

// 每次打开时重置，避免上一次的选择残留
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      selected.value = null;
      content.value = '';
      saving.value = false;
    }
  },
);

function selectEmotion(e: { label: string; emoji: string }) {
  selected.value = selected.value?.label === e.label ? null : e;
}

/** 组装最终写入「主题对话」的内容：情绪标签 + 自由文本 */
function buildContent(): string {
  const parts: string[] = [];
  if (selected.value) parts.push(`${selected.value.emoji} ${selected.value.label}`);
  const text = content.value.trim();
  if (text) parts.push(text);
  return parts.join('：');
}

async function onSave() {
  if (!selected.value && !content.value.trim()) {
    ElMessage({ message: '请选择情绪或填写内容', type: 'warning' });
    return;
  }
  saving.value = true;
  try {
    // 同名主题复用：跨天/多次提醒的情绪会汇总到同一主题下
    await findOrCreateThemeByTitle(props.reminderTitle);
    await createConversation({ content: buildContent() });
    ElMessage({ message: '已记录到主题对话', type: 'success' });
    emit('saved');
    emit('update:modelValue', false);
  } catch (err: any) {
    ElMessage({ message: err?.message || '记录失败', type: 'error' });
  } finally {
    saving.value = false;
  }
}

function onClose() {
  selected.value = null;
  content.value = '';
}
</script>

<style scoped lang="scss">
.record-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.record-target {
  font-size: 13px;
  color: var(--text-secondary);

  .target-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .target-tip {
    margin-left: 6px;
    font-size: 12px;
    color: var(--text-muted);
  }
}

.record-block {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .block-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }
}

.emotion-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .emotion-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-radius: 16px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-card);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s ease;

    &:hover {
      border-color: var(--color-primary);
    }

    &.active {
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 14%, transparent);
      color: var(--color-primary);
    }

    .emotion-emoji {
      font-size: 15px;
      line-height: 1;
    }
  }
}

.record-input {
  width: 100%;
}
</style>
