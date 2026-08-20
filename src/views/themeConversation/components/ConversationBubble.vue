<template>
  <div
    class="conv-bubble"
    :class="{
      'has-refs': isReferencing,
      'is-referenced': isReferenced,
      'is-cross-referenced': isCrossReferenced,
      'pinned': conv.pinned === '1',
      'selectable': multiselect,
      'selected': multiselect && isSelected,
    }"
    @click="onBubbleClick"
    @contextmenu.prevent="$emit('contextmenu', { conv, x: $event.clientX, y: $event.clientY })"
  >

    <!-- 顶部标识：被引用 / 有引用 / 置顶 / 跨主题引用 / 被跨主题引用 -->
    <div
      class="bubble-flags"
      v-if="isReferencing || isReferenced || conv.pinned === '1' || crossRefs.length || isCrossReferenced"
    >
      <button
        v-if="isReferenced"
        class="flag flag-referenced"
        title="本条对话被其它对话引用，点击查看来源"
        @click="$emit('open-referenced-by', conv)"
      >
        <LucideIcon name="Quote" :size="12" />
        被引用
      </button>
      <button
        v-if="isReferencing"
        class="flag flag-refs"
        title="本条对话引用了历史对话，点击查看"
        @click="$emit('open-references', conv)"
      >
        <LucideIcon name="Link" :size="12" />
        引用了 {{ refIds.length }} 条
      </button>
      <button
        v-if="crossRefs.length"
        class="flag flag-cross"
        title="本条对话包含跨主题引用，点击查看"
        @click="$emit('open-cross-ref', { conv, ref: null })"
      >
        <LucideIcon name="Layers" :size="12" />
        跨主题 {{ crossRefs.length }} 条
      </button>
      <button
        v-if="isCrossReferenced"
        class="flag flag-cross-referenced"
        title="本条对话被其它主题的对话跨主题引用，点击查看来源"
        @click="$emit('open-cross-referenced-by', conv)"
      >
        <LucideIcon name="CornerUpLeft" :size="12" />
        被跨引用 {{ crossReferencedCount }}
      </button>
      <span v-if="conv.pinned === '1'" class="flag flag-pin">
        <LucideIcon name="Bookmark" :size="12" />
        置顶
      </span>
    </div>

    <!-- 引用来源预览（点击展开历史对话弹窗） -->
    <div class="ref-preview" v-if="isReferencing">
      <button
        v-for="rid in refIds"
        :key="rid"
        class="ref-chip"
        @click.stop="$emit('open-references', conv)"
      >
        <LucideIcon name="CornerDownRight" :size="12" />
        <span class="ref-snippet">{{ refSnippet(rid) }}</span>
      </button>
    </div>

    <!-- 跨主题引用预览：点击在右侧抽屉展示被引用的目标对话，抽屉内可再定位 -->
    <div class="ref-preview cross" v-if="crossRefs.length">
      <button
        v-for="r in crossRefs"
        :key="`${r.themeId}:${r.convId}`"
        class="ref-chip cross-chip"
        :title="`点击在右侧查看「${crossDetails[keyOf(r)]?.themeTitle || ''}」中的对话`"
        @click.stop="$emit('open-cross-ref', { conv, ref: r })"
      >
        <LucideIcon name="ExternalLink" :size="12" />
        <span class="ref-snippet">{{ crossDetails[keyOf(r)]?.snippet || `对话 #${r.convId}` }}</span>
        <span class="chip-theme">{{ crossDetails[keyOf(r)]?.themeTitle }}</span>
      </button>
    </div>

    <!-- 对话内容：含标签按富文本渲染，否则转义后显示 -->
    <div
      class="bubble-content"
      :class="{ 'is-rich': conv.is_rich === '1' }"
      v-html="renderedContent"
    ></div>

    <!-- 标签：不同标签样式不同（颜色区分） -->
    <div class="bubble-tags" v-if="tagArr.length">
      <TagChip v-for="tid in tagArr" :key="tid" :id="tid" />
    </div>

    <!-- 元信息：创建时间 / 标注时间 -->
    <div class="bubble-meta">
      <span class="meta-time">
        <LucideIcon name="Clock" :size="12" />
        {{ conv.create_time }}
      </span>
      <span class="meta-annotate" v-if="conv.annotate_time">
        <LucideIcon name="PenLine" :size="12" />
        标注 {{ conv.annotate_time }}
      </span>
      <span class="meta-theme" v-if="showThemeTitle">{{ themeTitle }}</span>

      <span class="bubble-actions">
        <!-- 引用按钮：始终可见，位于每条对话右下角，直接将此对话引入草稿引用 -->
        <button
          class="act ref"
          :class="{ active: refInDraft }"
          title="引用此对话"
          @click="$emit('quote', conv)"
        >
          <LucideIcon name="Link" :size="13" />
        </button>
        <button class="act" title="编辑" @click="$emit('edit', conv)">
          <LucideIcon name="Pencil" :size="13" />
        </button>
        <button class="act danger" title="删除" @click="$emit('delete', conv)">
          <LucideIcon name="Trash2" :size="13" />
        </button>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import TagChip from './TagChip.vue';
import { useThemeConversation } from '../composables/useThemeConversation';
import { escapeHtml, snippetOf } from '../composables/richText';

const props = defineProps<{
  conv: any;
  /** 是否显示所属主题标题（搜索跨主题时） */
  showThemeTitle?: boolean;
  themeTitle?: string;
}>();

defineEmits<{
  (e: 'edit', conv: any): void;
  (e: 'delete', conv: any): void;
  (e: 'open-references', conv: any): void;
  (e: 'open-referenced-by', conv: any): void;
  (e: 'open-cross-referenced-by', conv: any): void;
  (e: 'quote', conv: any): void;
  (e: 'open-cross-ref', payload: { conv: any; ref: { themeId: number; convId: number } | null }): void;
  (e: 'contextmenu', payload: { conv: any; x: number; y: number }): void;
}>();

const {
  parseArr,
  referencedIds,
  conversations,
  pendingRefIds,
  multiselect,
  selectedIds,
  toggleSelect,
  themes,
  getConversationById,
  crossReferencedBy,
} = useThemeConversation();

const tagArr = computed(() => parseArr(props.conv.tags));
const refIds = computed(() => parseArr(props.conv.ref_ids));

/** 跨主题引用：解析为 [{ themeId, convId }] */
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
/** 跨主题引用的详情 key */
function keyOf(r: { themeId: number; convId: number }): string {
  return `${r.themeId}:${r.convId}`;
}
const crossRefs = computed(() => parseCrossRefs(props.conv.cross_refs));

/** 跨主题引用详情（主题标题 + 目标对话摘要），异步加载 */
const crossDetails = ref<Record<string, { themeTitle: string; snippet: string }>>({});
async function loadCrossDetails() {
  const map: Record<string, { themeTitle: string; snippet: string }> = {};
  for (const r of crossRefs.value) {
    const key = `${r.themeId}:${r.convId}`;
    const theme = themes.value.find((t) => t.id === r.themeId);
    const target = await getConversationById(r.convId);
    map[key] = {
      themeTitle: theme?.title || `主题 #${r.themeId}`,
      snippet: target ? snippetOf(target.content, 24) : `对话 #${r.convId}`,
    };
  }
  crossDetails.value = map;
}
watch(crossRefs, loadCrossDetails, { immediate: true });

/** 渲染内容：is_rich='1' 走 v-html（HTML 渲染），否则先转义（等价于原 `{{ }}` 行为） */
const renderedContent = computed(() => {
  const c = props.conv.content || '';
  return props.conv.is_rich === '1' ? c : escapeHtml(c);
});

/** 是否「引用了别人」 */
const isReferencing = computed(() => refIds.value.length > 0);
/** 是否「被别人引用」（同主题） */
const isReferenced = computed(() => referencedIds.value.has(String(props.conv.id)));
/** 是否「被其它主题的对话跨主题引用」 */
const isCrossReferenced = computed(
  () => (crossReferencedBy.value[Number(props.conv.id)] || []).length > 0,
);
/** 跨主题被引用数量 */
const crossReferencedCount = computed(
  () => crossReferencedBy.value[Number(props.conv.id)]?.length || 0,
);
/** 多选模式下是否被选 */
const isSelected = computed(() => selectedIds.value.includes(String(props.conv.id)));
/** 该对话是否已被加入草稿引用（高亮引用按钮） */
const refInDraft = computed(() => pendingRefIds.value.includes(String(props.conv.id)));

/**
 * 多选模式下：点击对话项正文区域即可切换选中态（扩大命中范围，不必只点勾选框）。
 * 但显式交互控件（编辑/删除/引用、引用 chip、被引用/引用了 标记）点击时不触发选中，
 * 避免与各自功能冲突。
 */
function onBubbleClick(e: MouseEvent) {
  if (!multiselect.value) return;
  const target = e.target as HTMLElement;
  if (target.closest('.bubble-actions, .ref-preview, .bubble-flags')) return;
  toggleSelect(props.conv.id);
}

/** 引用目标的简短预览（从当前已加载对话中查找） */
function refSnippet(rid: string): string {
  const target = conversations.value.find((c) => c.id === Number(rid));
  if (target) {
    return snippetOf(target.content, 24);
  }
  return `对话 #${rid}`;
}
</script>

<style scoped lang="scss">
.conv-bubble {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 12px 14px;
  margin: 0 0 0 auto;
  max-width: 960px;
  width: 80%;
  box-sizing: border-box;
  transition: box-shadow 0.2s, border-color 0.2s;

  &:hover {
    box-shadow: var(--shadow-card);
    .bubble-actions { opacity: 1; }
  }

  /* 有引用：左侧金色强调条，区别于普通对话 */
  &.has-refs {
    border-left: 3px solid #f59e0b;
    background: linear-gradient(90deg, rgba(245, 158, 11, 0.06), var(--bg-card) 40%);
  }

  /* 被引用：淡紫底，提示它作为「历史素材」被复用 */
  &.is-referenced {
    background: linear-gradient(180deg, rgba(139, 92, 246, 0.07), var(--bg-card) 50%);
  }

  /* 被跨主题引用：淡蓝底，与同主题「被引用」的淡紫区分 */
  &.is-cross-referenced {
    background: linear-gradient(180deg, rgba(59, 130, 246, 0.07), var(--bg-card) 50%);
  }

  &.pinned {
    border-color: var(--color-primary);
  }

  /* 多选模式：选中时高亮边框（勾选框已移至气泡外侧最左，见 ConversationList） */
  &.selectable {
    cursor: pointer;
  }
  &.selected {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-light);
  }
}

.bubble-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;

  .flag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 999px;
    border: 1px solid transparent;
    cursor: default;

    &.flag-refs {
      color: #b45309;
      background: rgba(245, 158, 11, 0.14);
      border-color: rgba(245, 158, 11, 0.4);
      cursor: pointer;
    }

    &.flag-referenced {
      color: #6d28d9;
      background: rgba(139, 92, 246, 0.14);
      border-color: rgba(139, 92, 246, 0.4);
      cursor: pointer;
    }

    &.flag-pin {
      color: var(--color-primary);
      background: var(--color-primary-light);
    }

    &.flag-cross {
      color: #0e7490;
      background: rgba(6, 182, 212, 0.14);
      border-color: rgba(6, 182, 212, 0.4);
      cursor: pointer;
    }

    /* 被跨主题引用：蓝色系，与「跨主题(引用别人)」的青色区分 */
    &.flag-cross-referenced {
      color: #1d4ed8;
      background: rgba(59, 130, 246, 0.14);
      border-color: rgba(59, 130, 246, 0.4);
      cursor: pointer;
    }
  }
}

.ref-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;

  .ref-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 320px;
    padding: 3px 10px;
    border-radius: 8px;
    border: 1px dashed rgba(245, 158, 11, 0.5);
    background: rgba(245, 158, 11, 0.08);
    color: #b45309;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover { background: rgba(245, 158, 11, 0.16); }

    .ref-snippet {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

/* 跨主题引用 chip：青色系，区别于同主题引用（金色系） */
.ref-preview.cross {
  .cross-chip {
    border-color: rgba(6, 182, 212, 0.5);
    background: rgba(6, 182, 212, 0.1);
    color: #0e7490;

    &:hover { background: rgba(6, 182, 212, 0.18); }

    .chip-theme {
      font-size: 11px;
      padding: 0 6px;
      border-radius: 999px;
      background: rgba(6, 182, 212, 0.18);
      color: #0e7490;
      flex-shrink: 0;
    }
  }
}

.bubble-content {
  font-size: 14px;
  line-height: 1.65;
  color: var(--text-primary);
  /* 纯文本：保留换行；富文本切换为 normal，由块级元素自身 margin 控制间距 */
  white-space: pre-wrap;
  word-break: break-word;

  &.is-rich { white-space: normal; }

  /* —— 富文本内部元素默认样式 ——
     v-html 注入的内容不带 scoped 属性，需用 :deep 穿透方能命中 */

  :deep(p) {
    margin: 0 0 8px;
    &:last-child { margin-bottom: 0; }
  }

  :deep(strong),
  :deep(b) { font-weight: 600; }

  :deep(em) { font-style: italic; }

  :deep(u) {
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  :deep(s),
  :deep(del) { text-decoration: line-through; }

  :deep(a) {
    color: var(--color-primary);
    text-decoration: none;
    border-bottom: 1px solid var(--color-primary-light);
    cursor: pointer;
    transition: opacity 0.2s;
    &:hover { opacity: 0.8; }
  }

  :deep(h1),
  :deep(h2),
  :deep(h3) {
    margin: 4px 0 8px;
    font-weight: 600;
    line-height: 1.35;
    color: var(--text-primary);
  }
  :deep(h1) { font-size: 1.4em; }
  :deep(h2) { font-size: 1.25em; }
  :deep(h3) { font-size: 1.1em; }

  :deep(ul),
  :deep(ol) {
    margin: 0 0 8px;
    padding-left: 22px;
  }
  :deep(li) {
    margin: 2px 0;
    &::marker { color: var(--text-muted); }
  }

  :deep(blockquote) {
    margin: 0 0 8px;
    padding: 4px 12px;
    border-left: 3px solid var(--color-primary);
    border-radius: 0 8px 8px 0;
    background: var(--color-primary-light);
    color: var(--text-secondary);
    p { margin: 0; }
  }

  :deep(pre.ql-syntax),
  :deep(pre),
  :deep(code) {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 12.5px;
  }
  :deep(pre.ql-syntax),
  :deep(pre) {
    margin: 0 0 8px;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--bg-code, rgba(0, 0, 0, 0.04));
    overflow-x: auto;
    white-space: pre;
  }
  :deep(code) {
    padding: 1px 5px;
    border-radius: 5px;
    background: var(--bg-code, rgba(0, 0, 0, 0.04));
  }
  :deep(pre code) { padding: 0; background: transparent; }

  :deep(img) {
    max-width: 100%;
    border-radius: 8px;
    margin: 4px 0;
  }

  :deep(hr) {
    border: none;
    border-top: 1px solid var(--border-subtle);
    margin: 10px 0;
  }

  /* Quill 对齐 / 缩进工具类 */
  :deep(.ql-align-center) { text-align: center; }
  :deep(.ql-align-right) { text-align: right; }
  :deep(.ql-align-justify) { text-align: justify; }
  :deep(.ql-indent-1) { padding-left: 2em; }
  :deep(.ql-indent-2) { padding-left: 4em; }
  :deep(.ql-indent-3) { padding-left: 6em; }
}

.bubble-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.bubble-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-muted);

  .meta-time, .meta-annotate, .meta-theme {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .meta-annotate { color: var(--color-primary); }

  .meta-theme {
    padding: 0 8px;
    border-radius: 8px;
    background: var(--bg-active-btn);
    color: var(--text-secondary);
  }

  .bubble-actions {
    margin-left: auto;
    display: inline-flex;
    gap: 4px;
    opacity: 1;

    .act {
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      padding: 3px;
      border-radius: 4px;

      &:hover { background: var(--bg-hover); color: var(--text-primary); }
      &.danger:hover { color: var(--color-danger, #ef4444); }

      /* 引用按钮：始终可见，已加入草稿引用时高亮 */
      &.ref {
        color: #b45309;
        &.active { background: rgba(245, 158, 11, 0.18); }
        &:hover { background: rgba(245, 158, 11, 0.18); color: #b45309; }
      }
    }
  }
}
</style>
