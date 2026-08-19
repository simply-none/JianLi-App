<template>
  <el-dialog
    v-model="visible"
    title="编辑对话"
    width="560px"
    append-to-body
    @open="onOpen"
  >
    <div class="edit-form" v-if="form">
      <label class="f-label">对话内容</label>
      <el-input
        v-model="form.content"
        type="textarea"
        :rows="5"
        placeholder="记录你的思考…"
        resize="vertical"
      />

      <label class="f-label">对话标签（不同标签样式不同）</label>
      <TagSelector v-model="form.tags" :scope="'conversation'" />

      <label class="f-label">引用历史对话（可引用一个或多个）</label>
      <div class="ref-candidates">
        <div
          v-for="c in candidates"
          :key="c.id"
          class="cand"
          :class="{ active: form.references.includes(String(c.id)) }"
          @click="toggleRef(c)"
        >
          <LucideIcon :name="form.references.includes(String(c.id)) ? 'CheckSquare' : 'Square'" :size="15" />
          <span class="cand-text">{{ snippet(c.content) }}</span>
          <span class="cand-time">{{ c.create_time }}</span>
        </div>
        <div class="cand-empty" v-if="!candidates.length">当前主题暂无其它对话可引用</div>
      </div>

      <div class="row-2">
        <div class="row-item">
          <label class="f-label">标注时间</label>
          <el-date-picker
            v-model="form.annotateTime"
            type="datetime"
            placeholder="设置标注/批注时间"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </div>
        <div class="row-item">
          <label class="f-label">置顶</label>
          <el-switch v-model="form.pinned" active-value="1" inactive-value="0" />
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="danger" plain @click="onDelete">删除</el-button>
      <el-button type="primary" @click="onSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import TagSelector from './TagSelector.vue';
import { useThemeConversation } from '../composables/useThemeConversation';
import { dbExecute } from '../db';
import { TABLE } from '../types';

const props = defineProps<{ modelValue: boolean; conv: any }>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'saved'): void;
}>();

const { updateConversation, deleteConversation, parseArr, currentThemeId } = useThemeConversation();

const visible = ref(false);
const candidates = ref<any[]>([]);
const form = reactive<{
  content: string;
  tags: string[];
  references: string[];
  annotateTime: string;
  pinned: string;
}>({ content: '', tags: [], references: [], annotateTime: '', pinned: '0' });

watch(
  () => props.modelValue,
  (v) => { visible.value = v; }
);
watch(visible, (v) => emit('update:modelValue', v));

/** 打开时回填表单，并加载同主题的候选引用对话 */
async function onOpen() {
  const c = props.conv;
  if (!c) return;
  form.content = c.content || '';
  form.tags = parseArr(c.tags);
  form.references = parseArr(c.ref_ids);
  form.annotateTime = c.annotate_time || '';
  form.pinned = c.pinned === '1' ? '1' : '0';

  // 引用候选：同主题下、且非自身的对话
  try {
    const rows = await dbExecute(
      `SELECT * FROM ${TABLE.CONVERSATION} WHERE theme_id = ? AND id != ? ORDER BY create_time ASC`,
      [c.theme_id, c.id]
    );
    candidates.value = rows;
  } catch {
    candidates.value = [];
  }
}

function snippet(text: string): string {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length > 40 ? t.slice(0, 40) + '…' : t || '(空对话)';
}

function toggleRef(c: any) {
  const id = String(c.id);
  const i = form.references.indexOf(id);
  if (i >= 0) form.references.splice(i, 1);
  else form.references.push(id);
}

async function onSave() {
  if (!form.content.trim()) {
    ElMessage.warning('对话内容不能为空');
    return;
  }
  await updateConversation(props.conv.id, {
    content: form.content,
    tags: form.tags,
    ref_ids: form.references,
    annotate_time: form.annotateTime,
    pinned: form.pinned,
  });
  ElMessage.success('已保存');
  visible.value = false;
  emit('saved');
}

async function onDelete() {
  try {
    await ElMessageBox.confirm('确定删除这条对话？', '删除确认', { type: 'warning' });
  } catch {
    return;
  }
  await deleteConversation(props.conv.id);
  ElMessage.success('已删除');
  visible.value = false;
  emit('saved');
}
</script>

<style scoped lang="scss">
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .f-label {
    font-size: 13px;
    color: var(--text-secondary);
    font-weight: 500;
    margin-top: 4px;
  }

  .ref-candidates {
    max-height: 160px;
    overflow-y: auto;
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .cand {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;

      &:hover { background: var(--bg-hover); }
      &.active { background: var(--color-primary-light); }

      :deep(.lucide-icon) { color: var(--color-primary); flex-shrink: 0; }

      .cand-text {
        flex: 1;
        font-size: 13px;
        color: var(--text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .cand-time {
        font-size: 11px;
        color: var(--text-muted);
        flex-shrink: 0;
      }
    }

    .cand-empty {
      padding: 12px;
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
    }
  }

  .row-2 {
    display: flex;
    gap: 16px;

    .row-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  }
}
</style>
