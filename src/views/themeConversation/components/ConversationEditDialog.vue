<template>
  <app-dialog
    v-model="visible"
    title="编辑对话"
    width="640px"
    append-to-body
    @open="onOpen"
  >
    <div class="edit-form" v-if="form">
      <label class="f-label">对话内容</label>
      <div v-if="isRichEdit">
        <QuillEditor
          v-model:content="form.content"
          content-type="html"
          :toolbar="toolbar"
          placeholder="记录你的思考…"
          theme="snow"
          class="edit-rich"
        />
      </div>
      <el-input
        v-else
        v-model="form.content"
        type="textarea"
        autosize
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
          <span class="cand-text">{{ snippetOf(c.content) }}</span>
          <span class="cand-time">{{ c.create_time }}</span>
        </div>
        <div class="cand-empty" v-if="!candidates.length">当前主题暂无其它对话可引用</div>
      </div>

      <label class="f-label">跨主题引用（引用其它主题的对话）</label>
      <div class="cross-ref-wrap">
        <button class="add-cross" type="button" @click="crossPicker = true">
          <LucideIcon name="Plus" :size="14" />
          <span>添加跨主题引用</span>
        </button>

        <div class="cross-chips" v-if="crossRefViews.length">
          <span
            v-for="v in crossRefViews"
            :key="`${v.themeId}:${v.convId}`"
            class="cross-chip"
            :title="`${v.themeTitle} › ${v.snippet}`"
          >
            <LucideIcon name="Layers" :size="12" class="cross-chip-ico" />
            <span class="cross-chip-text">
              <span class="chip-theme">{{ v.themeTitle }}</span>
              <span class="chip-sep">›</span>
              <span class="chip-snippet">{{ v.snippet }}</span>
            </span>
            <button
              class="cross-chip-x"
              type="button"
              title="移除"
              @click="removeCrossRef(v)"
            >
              <LucideIcon name="X" :size="12" />
            </button>
          </span>
        </div>

        <div class="cross-empty" v-else>
          <LucideIcon name="Layers" :size="15" />
          <span>暂无跨主题引用，点击上方按钮添加</span>
        </div>
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
  </app-dialog>

  <!-- 跨主题引用选择抽屉：排除被编辑对话自身所属主题，并预选已有跨主题引用 -->
  <CrossThemeRefDialog
    v-model="crossPicker"
    :exclude-theme-id="convThemeId"
    :initial-refs="form.crossRefs"
    @confirm="onCrossConfirm"
  />
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import LucideIcon from '@/components/LucideIcon.vue';
import TagSelector from './TagSelector.vue';
import CrossThemeRefDialog from './CrossThemeRefDialog.vue';
import { useThemeConversation } from '../composables/useThemeConversation';
import { dbExecute } from '../db';
import { TABLE } from '../types';
import { stripTags, snippetOf } from '../composables/richText';

const props = defineProps<{ modelValue: boolean; conv: any }>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'saved'): void;
}>();

const {
  updateConversation,
  deleteConversation,
  loadCrossReferenced,
  loadThemes,
  parseArr,
  getConversationsByTheme,
  themes,
} = useThemeConversation();

/** 富文本工具栏（与输入框保持一致） */
const toolbar = [
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  [{ header: [1, 2, 3, false] }],
];

const visible = ref(false);
const candidates = ref<any[]>([]);
/** 编辑弹窗是否使用富文本编辑器：由该对话 is_rich 决定 */
const isRichEdit = ref(false);
const form = reactive<{
  content: string;
  tags: string[];
  references: string[];
  crossRefs: Array<{ themeId: number; convId: number }>;
  annotateTime: string;
  pinned: string;
}>({ content: '', tags: [], references: [], crossRefs: [], annotateTime: '', pinned: '0' });

/** 被编辑对话自身所属主题 id（用于跨主题引用抽屉排除自身主题） */
const convThemeId = computed(() => Number(props.conv?.theme_id));

/** 跨主题引用选择抽屉开关 */
const crossPicker = ref(false);
/** 跨主题引用对话摘要缓存：key = `${themeId}:${convId}` */
const crossSnippetMap = ref<Record<string, string>>({});

/** 跨主题引用展示列表（主题名 › 对话摘要），由 form.crossRefs 派生 */
const crossRefViews = computed(() =>
  (form.crossRefs || []).map((r) => {
    const theme = themes.value.find((t) => t.id === r.themeId);
    return {
      themeId: r.themeId,
      convId: r.convId,
      themeTitle: theme ? theme.title || '未命名主题' : `主题 ${r.themeId}`,
      snippet: crossSnippetMap.value[`${r.themeId}:${r.convId}`] || '(加载中…)',
    };
  }),
);

/** 解析 cross_refs 字段（兼容数组 / JSON 字符串） */
function parseCrossRefs(value: any): Array<{ themeId: number; convId: number }> {
  if (!value) return [];
  if (Array.isArray(value)) return value as Array<{ themeId: number; convId: number }>;
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 按已选跨主题引用，批量加载目标对话摘要（供 chip 展示） */
async function loadCrossSnippets() {
  const refs = form.crossRefs || [];
  if (!refs.length) {
    crossSnippetMap.value = {};
    return;
  }
  // 编辑弹窗可能在小窗中打开，兜底确保主题列表已加载
  if (!themes.value.length) await loadThemes();
  const themeIds = Array.from(new Set(refs.map((r) => r.themeId)));
  await Promise.all(
    themeIds.map(async (tid) => {
      const list = await getConversationsByTheme(tid);
      list.forEach((c: any) => {
        const cid = Number(c.id);
        if (refs.some((r) => r.themeId === tid && r.convId === cid)) {
          crossSnippetMap.value[`${tid}:${cid}`] = snippetOf(c.content, 40);
        }
      });
    }),
  );
  crossSnippetMap.value = { ...crossSnippetMap.value };
}

/** 抽屉确认：写入选中的跨主题引用并刷新摘要 */
function onCrossConfirm(refs: Array<{ themeId: number; convId: number }>) {
  form.crossRefs = refs.map((r) => ({ ...r }));
  void loadCrossSnippets();
}

/** 移除某条跨主题引用 chip */
function removeCrossRef(v: { themeId: number; convId: number }) {
  form.crossRefs = (form.crossRefs || []).filter(
    (r) => !(r.themeId === v.themeId && r.convId === v.convId),
  );
}

watch(
  () => props.modelValue,
  (v) => { visible.value = v; }
);
watch(visible, (v) => emit('update:modelValue', v));

/** 打开时回填表单，并加载同主题的候选引用对话 */
async function onOpen() {
  const c = props.conv;
  if (!c) return;
  // is_rich='1' 用富文本编辑器（content 已是 HTML）；否则用纯文本 textarea
  isRichEdit.value = c.is_rich === '1';
  form.content = c.content || '';
  form.tags = parseArr(c.tags);
  form.references = parseArr(c.ref_ids);
  form.crossRefs = parseCrossRefs(c.cross_refs);
  form.annotateTime = c.annotate_time || '';
  form.pinned = c.pinned === '1' ? '1' : '0';

  // 加载跨主题引用对话摘要（供 chip 展示「主题名 › 对话摘要」）
  void loadCrossSnippets();

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
  return snippetOf(text, 40);
}

function toggleRef(c: any) {
  const id = String(c.id);
  const i = form.references.indexOf(id);
  if (i >= 0) form.references.splice(i, 1);
  else form.references.push(id);
}

async function onSave() {
  if (!stripTags(form.content).trim()) {
    ElMessage.warning('对话内容不能为空');
    return;
  }
  await updateConversation(props.conv.id, {
    content: form.content,
    tags: form.tags,
    ref_ids: form.references,
    crossRefs: form.crossRefs,
    annotate_time: form.annotateTime,
    pinned: form.pinned,
  });
  // 同步全局「被跨引用」索引，保证主列表徽标实时更新
  await loadCrossReferenced();
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

  :deep(.ql-toolbar.ql-snow) {
      border: 1px solid var(--border-subtle);
      border-bottom: 1px solid var(--border-subtle);
      border-radius: 8px 8px 0 0;
      background: var(--bg-base);
      padding: 6px 8px;
    }

  :deep(.edit-rich) {
    &.ql-container.ql-snow {
      border: 1px solid var(--border-subtle);
      border-radius: 0 0 var(--radius-btn) var(--radius-btn);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: 14px;
      font-family: inherit;
    }

    .ql-editor {
      min-height: 320px;
      max-height: 460px;
      overflow-y: auto;
      line-height: 1.65;
    }

    .ql-editor.ql-blank::before {
      color: var(--text-muted);
      font-style: normal;
    }
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

  /* ===================== 跨主题引用 ===================== */
  .cross-ref-wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .add-cross {
      display: inline-flex;
      align-items: center;
      align-self: flex-start;
      gap: 6px;
      padding: 7px 13px;
      border: 1px dashed rgba(6, 182, 212, 0.7);
      border-radius: 9px;
      background: rgba(6, 182, 212, 0.10);
      color: #0e7490;
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s, transform 0.1s;

      :deep(.lucide-icon) { color: #0e7490; }

      &:hover {
        background: #0e7490;
        border-color: #0e7490;
        color: #fff;
        :deep(.lucide-icon) { color: #fff; }
      }
      &:active { transform: scale(0.98); }
    }

    .cross-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .cross-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      padding: 5px 8px 5px 9px;
      border: 1px solid rgba(6, 182, 212, 0.35);
      border-radius: 999px;
      background: rgba(6, 182, 212, 0.10);
      color: var(--text-primary);
      transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;

      &:hover {
        background: rgba(6, 182, 212, 0.16);
        border-color: rgba(6, 182, 212, 0.6);
        box-shadow: 0 1px 6px rgba(6, 182, 212, 0.18);
      }

      .cross-chip-ico { color: #0e7490; flex-shrink: 0; }

      .cross-chip-text {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-width: 0;
        font-size: 12.5px;
        line-height: 1.4;
        overflow: hidden;

        .chip-theme {
          font-weight: 600;
          color: #0e7490;
          white-space: nowrap;
        }
        .chip-sep { color: var(--text-muted); }
        .chip-snippet {
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .cross-chip-x {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        padding: 0;
        margin-left: 2px;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.15s, color 0.15s;

        &:hover {
          background: rgba(6, 182, 212, 0.22);
          color: #0e7490;
        }
      }
    }

    .cross-empty {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border: 1px dashed var(--border-subtle);
      border-radius: 10px;
      font-size: 12.5px;
      color: var(--text-muted);
      background: var(--bg-base);

      :deep(.lucide-icon) { color: var(--text-muted); flex-shrink: 0; }
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
