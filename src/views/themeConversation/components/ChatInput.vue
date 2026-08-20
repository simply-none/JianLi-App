<template>
  <div class="chat-input">
    <!-- 已选引用 / 标签预览 -->
    <div class="attach-row" v-if="pendingRefIds.length || pendingCrossRefs.length || tagIds.length || annotateTime">
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
      <div class="attach-group" v-if="pendingCrossRefs.length">
        <span class="attach-label"><LucideIcon name="Layers" :size="12" />跨主题</span>
        <span
          v-for="r in pendingCrossRefs"
          :key="`${r.themeId}:${r.convId}`"
          class="attach-chip cross"
          @click="previewCrossRef(r)"
        >
          {{ crossRefSnippet(r) }}
          <LucideIcon name="X" :size="11" @click.stop="removeCrossRef(r)" />
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

    <!-- 输入主体：折叠=contenteditable 普通元素；展开=vue-quill 富文本 -->
    <div
      class="input-main"
      :class="{ expanded, manual: !!manualHeight }"
      :style="heightStyle"
      ref="inputMainRef"
    >
      <!-- 顶部拖拽手柄：上下拖动调整输入区高度（双击恢复自适应） -->
      <div
        class="resize-handle"
        title="拖动调整高度，双击恢复"
        @mousedown.prevent="startResize"
        @dblclick="resetHeight"
      >
        <!-- <LucideIcon name="GripHorizontal" :size="16" /> -->
      </div>

      <!-- 折叠态：用一个普通 div（contenteditable）模拟输入框效果 -->
      <div
        v-show="!expanded"
        ref="plainRef"
        class="ta plain"
        contenteditable="true"
        :data-placeholder="placeholder"
        @input="onPlainInput"
        @keydown.enter.exact.prevent="send"
        @paste="onPlainPaste"
      ></div>

      <!-- 展开态：vue-quill 富文本编辑器，高度更高 -->
      <QuillEditor
        v-if="expanded"
        ref="editorRef"
        v-model:content="content"
        content-type="html"
        :toolbar="toolbar"
        :placeholder="placeholder"
        theme="snow"
        class="ta rich"
        @ready="onEditorReady"
      />

      <!-- 右上角：拉伸 / 收起按钮 -->
      <button
        class="expand-btn"
        :class="{ active: expanded }"
        :title="expanded ? '收起为纯文本' : '展开富文本编辑'"
        @click="toggleExpand"
      >
        <LucideIcon :name="expanded ? 'Minimize2' : 'Maximize2'" :size="16" />
      </button>
    </div>

    <!-- 工具条 -->
    <div class="input-tools">
      <div class="tools-left">
        <button class="tool" @click="refDialog = true" title="引用历史对话">
          <LucideIcon name="Link" :size="15" />
          <span>引用</span>
        </button>
        <button class="tool" @click="openCrossRefPicker" title="引用其它主题的对话">
          <LucideIcon name="Unlink" :size="15" />
          <span>跨主题引用</span>
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
      <button class="send-btn" :disabled="isEmpty" @click="send">
        <LucideIcon name="SendIcon" :size="15" />
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
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import LucideIcon from '@/components/LucideIcon.vue';
import TagSelector from './TagSelector.vue';
import TagChip from './TagChip.vue';
import { useThemeConversation } from '../composables/useThemeConversation';
import { stripTags, toQuillContent, snippetOf } from '../composables/richText';

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
  // 跨主题引用草稿
  pendingCrossRefs,
  removePendingCrossRef,
  openCrossRefPicker,
  showCrossRefTargets,
  getConversationsByTheme,
  themes,
} = useThemeConversation();

/** 是否处于「富文本展开」态 */
const expanded = ref(false);
/** 输入框内容：纯文本（折叠态）或 HTML（展开态应用了格式时） */
const content = ref('');
const tagIds = ref<string[]>([]);
const annotateTime = ref('');
const pinned = ref('0');
const refDialog = ref(false);
const plainRef = ref<HTMLDivElement | null>(null);
const editorRef = ref<any>(null);
const inputMainRef = ref<HTMLElement | null>(null);

/** 拖拽设定的输入区高度（px）；null=自适应。持久化到 localStorage 以便下次恢复 */
const HEIGHT_KEY = 'tc_chat_input_height';
const HEIGHT_MIN = 90;
const HEIGHT_MAX = 760;
const manualHeight = ref<number | null>(loadSavedHeight());
const heightStyle = computed(() =>
  manualHeight.value ? { height: manualHeight.value + 'px' } : null,
);

/** 读取持久化的高度（越界或缺失返回 null=自适应） */
function loadSavedHeight(): number | null {
  try {
    const v = localStorage.getItem(HEIGHT_KEY);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= HEIGHT_MIN && n <= HEIGHT_MAX ? n : null;
  } catch {
    return null;
  }
}

const placeholder = '记录此刻的思考波动…（Enter 发送，Shift+Enter 换行）';

/** 富文本工具栏：飞书式精简配置 */
const toolbar = [
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  [{ header: [1, 2, 3, false] }],
];

/** 判空：去标签后是否为空白（兼容纯文本与 HTML 两种 content） */
const isEmpty = computed(() => !stripTags(content.value).trim());

function snippet(text: string): string {
  return snippetOf(text, 60);
}

/** 输入框中引用 chip 的短预览 */
function refSnippet(rid: string): string {
  const t = conversations.value.find((c) => c.id === Number(rid));
  if (!t) return `对话 #${rid}`;
  return snippetOf(t.content, 18);
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

/** 跨主题引用草稿 chip 的短预览（主题名 + 目标对话摘要，需异步查库） */
const crossSnippets = ref<Record<string, string>>({});
async function loadCrossSnippets() {
  const map: Record<string, string> = {};
  for (const r of pendingCrossRefs.value) {
    const key = `${r.themeId}:${r.convId}`;
    const theme = themes.value.find((t) => t.id === r.themeId);
    const target = await getConversationsByTheme(r.themeId);
    const conv = target.find((c: any) => c.id === r.convId);
    map[key] = `${theme?.title || `主题#${r.themeId}`} › ${conv ? snippetOf(conv.content, 14) : `#${r.convId}`}`;
  }
  crossSnippets.value = map;
}
watch(pendingCrossRefs, loadCrossSnippets, { immediate: true, deep: true });

function crossRefSnippet(r: { themeId: number; convId: number }): string {
  return crossSnippets.value[`${r.themeId}:${r.convId}`] || `主题#${r.themeId} › #${r.convId}`;
}

/** 点击输入框中的跨主题引用 chip：在右侧抽屉展示被引用的目标对话 */
function previewCrossRef(r: { themeId: number; convId: number }) {
  showCrossRefTargets(null, r);
}

function removeCrossRef(r: { themeId: number; convId: number }) {
  removePendingCrossRef(r);
}

/** 折叠态输入：实时把 div 的纯文本同步给 content，并自适应高度 */
function onPlainInput() {
  if (!plainRef.value) return;
  // contenteditable 删除到空时会残留 <br>，清空使其触发 :empty 占位符
  if (!plainRef.value.innerText.trim()) plainRef.value.innerHTML = '';
  content.value = plainRef.value.innerText;
  autoGrow();
}

/** 折叠态粘贴：只接受纯文本，避免富文本碎片混入 */
function onPlainPaste(e: ClipboardEvent) {
  e.preventDefault();
  const text = e.clipboardData?.getData('text/plain') || '';
  document.execCommand('insertText', false, text);
}

/** 折叠态自适应高度（上限 200px，超出滚动）。拖拽高度模式下由容器统一控制，跳过 */
function autoGrow() {
  if (manualHeight.value) return;
  const el = plainRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

/** 把 content（HTML）的纯文本回写到折叠态 div，供展示与继续编辑 */
function syncPlainFromContent() {
  if (plainRef.value) plainRef.value.innerText = stripTags(content.value);
  nextTick(autoGrow);
}

/** 拉伸 / 收起：切换输入模式 */
function toggleExpand() {
  expanded.value = !expanded.value;
  if (expanded.value) {
    // 进入富文本：把当前内容转成 quill 可识别的 HTML 再交给编辑器
    content.value = toQuillContent(content.value);
    nextTick(() => editorRef.value?.focus?.());
  } else {
    // 收起：content 已由 v-model 实时同步为 HTML，把纯文本回写回普通元素
    nextTick(syncPlainFromContent);
  }
}

/**
 * 顶部手柄拖拽：以输入区顶部为锚点，向上拖动增大、向下拖动减小。
 * 用 document 级监听，保证鼠标移出组件范围也能继续拖。
 */
function startResize(e: MouseEvent) {
  const el = inputMainRef.value;
  if (!el) return;
  const startY = e.clientY;
  const startH = el.getBoundingClientRect().height;
  const onMove = (ev: MouseEvent) => {
    const dy = startY - ev.clientY; // 向上拖动 => 高度增加
    manualHeight.value = Math.max(HEIGHT_MIN, Math.min(startH + dy, HEIGHT_MAX));
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    try {
      if (manualHeight.value) localStorage.setItem(HEIGHT_KEY, String(manualHeight.value));
    } catch {
      /* 忽略持久化失败 */
    }
  };
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'row-resize';
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/** 双击手柄恢复自适应高度 */
function resetHeight() {
  manualHeight.value = null;
  try {
    localStorage.removeItem(HEIGHT_KEY);
  } catch {
    /* 忽略 */
  }
}

function onEditorReady() {
  nextTick(() => editorRef.value?.focus?.());
}

async function send() {
  const text = stripTags(content.value).trim();
  if (!text) {
    ElMessage.warning('请输入对话内容');
    return;
  }
  try {
    await createConversation({
      content: content.value, // 有格式时存 HTML，纯文本时存纯文本
      references: pendingRefIds.value,
      crossRefs: pendingCrossRefs.value,
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
    nextTick(syncPlainFromContent);
  } catch (e: any) {
    ElMessage.error(e?.message || '发送失败');
  }
}

/** 供父组件「新建对话」按钮聚焦输入框 */
function focus() {
  nextTick(() => {
    if (expanded.value) editorRef.value?.focus?.();
    else plainRef.value?.focus();
  });
}

onMounted(() => nextTick(syncPlainFromContent));

defineExpose({ focus });
</script>

<style scoped lang="scss">
.chat-input {
  flex-shrink: 0;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-card);
  padding: 6px 0px 14px 16px;
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

    /* 跨主题引用 chip：青色系，与同主题引用（金色系）区分 */
    &.cross {
      background: rgba(6, 182, 212, 0.14);
      color: #0e7490;
    }

    :deep(.lucide-icon) { cursor: pointer; }
  }
}

.input-main {
  position: relative;
  display: flex;
  flex-direction: column;

  /* 拖拽设定高度后放宽最小高度限制，允许更紧凑 */
  &.manual { min-height: 0; }
  &.expanded { min-height: 520px; }

  /* 顶部拖拽手柄：上下拖动调整输入区高度 */
  .resize-handle {
    flex-shrink: 0;
    height: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: row-resize;
    color: var(--text-muted);
    border-radius: var(--radius-btn) var(--radius-btn) 0 0;
    transition: background 0.2s, color 0.2s;

    &:hover {
      background: var(--bg-hover);
      color: var(--color-primary);
    }
    &:active {
      background: var(--color-primary-light);
      color: var(--color-primary);
    }
  }

  .ta {
    width: 100%;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    background: var(--bg-base);
    color: var(--text-primary);
    font-size: 14px;
    line-height: 1.6;
    padding: 10px 44px 10px 12px; // 右侧留白给拉伸按钮
    box-sizing: border-box;
    outline: none;
    font-family: inherit;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  /* 折叠态：contenteditable 普通元素 */
  .ta.plain {
    flex: 1 1 auto;
    min-height: 64px;
    max-height: 200px;
    overflow-y: auto;
    resize: none;
    white-space: pre-wrap;
    word-break: break-word;

    &:empty:before {
      content: attr(data-placeholder);
      color: var(--text-muted);
      pointer-events: none;
    }

    &:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px var(--color-primary-light);
    }
  }

  /* 拖拽高度时取消文本域上限，由容器统一约束并内部滚动 */
  &.manual .ta.plain { max-height: none; }

  /* 展开态：vue-quill 富文本 —— 工具栏 + 编辑区填满容器 */
  :deep(.ql-toolbar.ql-snow) {
    flex-shrink: 0;
    border: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn) var(--radius-btn) 0 0;
    background: var(--bg-base);
    padding: 15px 8px;
  }
  :deep(.ta.rich) {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0;

    

    &.ql-container.ql-snow {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: auto;
      border: 1px solid var(--border-subtle);
      border-top: none;
      border-radius: 0 0 var(--radius-btn) var(--radius-btn);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: 14px;
      font-family: inherit;
    }

    .ql-editor {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      line-height: 1.65;
    }

    .ql-editor.ql-blank::before {
      color: var(--text-muted);
      font-style: normal;
    }
  }

  /* 右上角拉伸 / 收起按钮 */
  .expand-btn {
    position: absolute;
    top: 20px;
    right: 8px;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    background: var(--bg-card);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
    &.active {
      border-color: var(--color-primary);
      color: var(--color-primary);
      background: var(--color-primary-light);
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
