<template>
  <div class="chat-input">
    <!-- 已选引用 / 标签预览 -->
    <div class="attach-row" v-if="pendingRefIds.length || tagIds.length || annotateTime">
      <div class="attach-group" v-if="pendingRefIds.length">
        <span class="attach-label"><LucideIcon name="Link" :size="12" />引用</span>
        <span
          v-for="rid in pendingRefIds"
          :key="rid"
          class="attach-chip ref"
          @click="previewRef(rid)"
        >
          {{ refSnippet(rid) }}
          <LucideIcon name="X" :size="11" @click.stop="removeRef(rid)" />
        </span>
      </div>
      <div class="attach-group" v-if="tagIds.length">
        <span class="attach-label"><LucideIcon name="Tags" :size="12" />标签</span>
        <TagChip
          v-for="tid in tagIds"
          :key="tid"
          :id="tid"
          closable
          @close="removeTag(tid)"
        />
      </div>
      <div class="attach-group" v-if="annotateTime">
        <span class="attach-label"><LucideIcon name="PenLine" :size="12" />标注</span>
        <span class="attach-chip plain">{{ annotateTime }}</span>
      </div>
    </div>

    <!-- 输入主体 -->
    <div class="input-main">
      <textarea
        ref="taRef"
        v-model="content"
        class="ta"
        placeholder="记录此刻的思考波动…（Enter 发送，Shift+Enter 换行）"
        @keydown.enter.exact.prevent="send"
      ></textarea>
    </div>

    <!-- 工具条 -->
    <div class="input-tools">
      <div class="tools-left">
        <button class="tool" @click="refDialog = true" title="引用历史对话">
          <LucideIcon name="Link" :size="15" />
          <span>引用</span>
        </button>
        <TagSelector v-model="tagIds" :scope="'conversation'" />
        <el-date-picker
          v-model="annotateTime"
          type="datetime"
          placeholder="标注时间"
          format="MM-DD HH:mm"
          value-format="YYYY-MM-DD HH:mm:ss"
          :clearable="true"
          size="small"
          class="annotate-picker"
        />
        <el-switch
          v-model="pinned"
          active-value="1"
          inactive-value="0"
          active-text="置顶"
          size="small"
        />
      </div>
      <button class="send-btn" :disabled="!content.trim()" @click="send">
        <LucideIcon name="Send" :size="15" />
        发送
      </button>
    </div>

    <!-- 引用选择器 -->
    <el-dialog v-model="refDialog" title="引用历史对话" width="480px" append-to-body>
      <div class="ref-list">
        <div
          v-for="c in conversations"
          :key="c.id"
          class="ref-opt"
          :class="{ active: pendingRefIds.includes(String(c.id)) }"
          @click="toggleRef(c)"
        >
          <LucideIcon :name="pendingRefIds.includes(String(c.id)) ? 'CheckSquare' : 'Square'" :size="16" />
          <div class="ref-opt-body">
            <div class="ref-opt-text">{{ snippet(c.content) }}</div>
            <div class="ref-opt-time">{{ c.create_time }}</div>
          </div>
        </div>
        <div class="ref-empty" v-if="!conversations.length">当前主题暂无其它对话</div>
      </div>
      <template #footer>
        <el-button @click="refDialog = false">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import TagSelector from './TagSelector.vue';
import TagChip from './TagChip.vue';
import { useThemeConversation } from '../composables/useThemeConversation';

const {
  conversations,
  createConversation,
  parseArr,
  showReferenceTargets,
  showConversationDetail,
  // 草稿引用（与气泡引用按钮 / 右键 / 多选共享同一份状态）
  pendingRefIds,
  removePendingRef,
  clearPendingRefs,
} = useThemeConversation();

const content = ref('');
const tagIds = ref<string[]>([]);
const annotateTime = ref('');
const pinned = ref('0');
const refDialog = ref(false);
const taRef = ref<HTMLTextAreaElement | null>(null);

function snippet(text: string): string {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length > 60 ? t.slice(0, 60) + '…' : t || '(空对话)';
}

/** 输入框中引用 chip 的短预览 */
function refSnippet(rid: string): string {
  const t = conversations.value.find((c) => c.id === Number(rid));
  if (!t) return `对话 #${rid}`;
  const text = (t.content || '').replace(/\s+/g, ' ').trim();
  return text.length > 18 ? text.slice(0, 18) + '…' : text || '(空)';
}

function toggleRef(c: any) {
  const id = String(c.id);
  const i = pendingRefIds.value.indexOf(id);
  if (i >= 0) pendingRefIds.value.splice(i, 1);
  else pendingRefIds.value.push(id);
}

function removeRef(id: string) {
  removePendingRef(id);
}
function removeTag(id: string) {
  tagIds.value = tagIds.value.filter((x) => x !== id);
}

/** 点击输入框中的引用 chip，预览该历史对话详情 */
function previewRef(rid: string) {
  const target = conversations.value.find((c) => c.id === Number(rid));
  if (target) showConversationDetail(target);
}

async function send() {
  const text = content.value.trim();
  if (!text) {
    ElMessage.warning('请输入对话内容');
    return;
  }
  try {
    await createConversation({
      content: text,
      references: pendingRefIds.value,
      tags: tagIds.value,
      annotateTime: annotateTime.value,
      pinned: pinned.value,
    });
    // 清空输入与临时选择
    content.value = '';
    clearPendingRefs();
    tagIds.value = [];
    annotateTime.value = '';
    pinned.value = '0';
    refDialog.value = false;
  } catch (e: any) {
    ElMessage.error(e?.message || '发送失败');
  }
}

/** 供父组件「新建对话」按钮聚焦输入框 */
function focus() {
  nextTick(() => taRef.value?.focus());
}

defineExpose({ focus });
</script>

<style scoped lang="scss">
.chat-input {
  flex-shrink: 0;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-card);
  padding: 12px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.attach-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  .attach-group {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .attach-label {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .attach-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    padding: 1px 8px;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.14);
    color: #b45309;
    cursor: pointer;

    &.plain { background: var(--bg-active-btn); color: var(--text-secondary); cursor: default; }

    :deep(.lucide-icon) { cursor: pointer; }
  }
}

.input-main {
  .ta {
    width: 100%;
    min-height: 64px;
    max-height: 180px;
    resize: vertical;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    background: var(--bg-base);
    color: var(--text-primary);
    font-size: 14px;
    line-height: 1.6;
    padding: 10px 12px;
    box-sizing: border-box;
    outline: none;
    font-family: inherit;
    transition: border-color 0.2s, box-shadow 0.2s;

    &:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px var(--color-primary-light);
    }
  }
}

.input-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  .tools-left {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tool {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    background: var(--bg-base);
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
  }

  .annotate-picker {
    width: 150px;
  }

  .send-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 18px;
    border: none;
    border-radius: var(--radius-btn);
    background: var(--color-primary);
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: filter 0.2s, opacity 0.2s;

    &:hover { filter: brightness(1.05); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
}

.ref-list {
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;

  .ref-opt {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px;
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;

    &:hover { background: var(--bg-hover); }
    &.active { border-color: var(--color-primary); background: var(--color-primary-light); }

    :deep(.lucide-icon) { color: var(--color-primary); margin-top: 2px; flex-shrink: 0; }

    .ref-opt-body { flex: 1; min-width: 0; }
    .ref-opt-text {
      font-size: 13px;
      color: var(--text-primary);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .ref-opt-time { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
  }

  .ref-empty {
    padding: 20px;
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
  }
}
</style>
