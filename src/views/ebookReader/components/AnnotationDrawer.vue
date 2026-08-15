<template>
  <el-drawer
    v-model="visible"
    :title="title"
    direction="ltr"
    size="390px"
    :append-to-body="false"
  >
    <div class="annotation-drawer">
      <!-- 导出操作行：导出当前查看的书（或当前打开的书）的笔记与划线 -->
      <div class="annotation-export-bar">
        <el-button size="small" @click="onExport">
          <LucideIcon name="Download" :size="13" />
          导出笔记
        </el-button>
      </div>
      <!-- 抽屉内搜索：按划线原文 / 笔记内容关键词过滤当前标签页 -->
      <div class="annotation-search">
        <el-input
          v-model="keyword"
          size="small"
          clearable
          placeholder="搜索划线 / 笔记内容"
        >
          <template #prefix>
            <LucideIcon name="Search" :size="14" />
          </template>
        </el-input>
      </div>
      <!-- 标签页：区分「笔记」（带笔记内容）与「划线」（纯高亮），避免二者混杂 -->
      <div class="annotation-tabs">
        <button
          class="tab-btn"
          :class="{ active: annotationTab === 'note' }"
          type="button"
          @click="annotationTab = 'note'"
        >
          <LucideIcon name="NotebookPen" :size="14" />
          <span>笔记</span>
          <span class="tab-count">{{ noteItems.length }}</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: annotationTab === 'highlight' }"
          type="button"
          @click="annotationTab = 'highlight'"
        >
          <LucideIcon name="Pen" :size="14" />
          <span>划线</span>
          <span class="tab-count">{{ highlightItems.length }}</span>
        </button>
      </div>

      <!-- 笔记标签页：展示「引用内容 + 笔记」，二者直接并列展示 -->
      <div v-show="annotationTab === 'note'" class="annotation-list">
        <!-- 一键清空：仅在有笔记时可用 -->
        <div v-if="noteItems.length > 0" class="annotation-bulk-actions">
          <el-button size="small" type="danger" plain @click="onDeleteAll('note')">
            <LucideIcon name="Trash2" :size="13" />
            一键删除所有笔记
          </el-button>
        </div>
        <div
          v-for="item in filteredNoteItems"
          :key="item.id"
          class="annotation-item note-item"
          :title="timeTooltip(item)"
          @click="onSelect(item)"
        >
          <div class="annotation-text">{{ item.text }}</div>
          <div class="annotation-note">{{ item.note }}</div>
          <div class="annotation-meta">最后修改：{{ formatTime(item.updatedAt || item.createdAt) }}</div>
          <div class="annotation-actions">
            <el-button size="small" text @click.stop="onEdit(item)">
              <LucideIcon name="SquarePen" :size="13" />
              编辑
            </el-button>
            <el-button size="small" text @click.stop="onDelete(item)">
              <LucideIcon name="Trash2" :size="13" />
              删除
            </el-button>
          </div>
        </div>
        <div v-if="filteredNoteItems.length === 0" class="annotation-empty">
          {{ keyword ? '无匹配结果' : '暂无笔记' }}
        </div>
      </div>

      <!-- 划线标签页：展示纯高亮标注，仅可删除 -->
      <div v-show="annotationTab === 'highlight'" class="annotation-list">
        <!-- 一键清空：仅在有划线时可用 -->
        <div v-if="highlightItems.length > 0" class="annotation-bulk-actions">
          <el-button size="small" type="danger" plain @click="onDeleteAll('highlight')">
            <LucideIcon name="Trash2" :size="13" />
            一键删除所有划线
          </el-button>
        </div>
        <div
          v-for="item in filteredHighlightItems"
          :key="item.id"
          class="annotation-item"
          :title="timeTooltip(item)"
          @click="onSelect(item)"
        >
          <div class="annotation-text">{{ item.text }}</div>
          <div class="annotation-meta">最后修改：{{ formatTime(item.updatedAt || item.createdAt) }}</div>
          <div class="annotation-actions">
            <el-button size="small" text @click.stop="onDelete(item)">
              <LucideIcon name="Trash2" :size="13" />
              删除
            </el-button>
          </div>
        </div>
        <div v-if="filteredHighlightItems.length === 0" class="annotation-empty">
          {{ keyword ? '无匹配结果' : '暂无划线' }}
        </div>
      </div>
    </div>

    <!-- 书架来源的笔记编辑弹窗（书未打开时无法复用阅读组件，用独立弹窗编辑） -->
    <el-dialog
      v-model="shelfNoteEditVisible"
      title="编辑笔记"
      width="420px"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-input
        v-model="shelfNoteEditText"
        type="textarea"
        :rows="5"
        placeholder="请输入笔记内容"
        resize="none"
      />
      <template #footer>
        <el-button size="small" @click="shelfNoteEditVisible = false">取消</el-button>
        <el-button type="primary" size="small" @click="onSaveNote">保存</el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import type { AnnotationDisplayItem } from '../types';

const props = defineProps<{
  /** 抽屉可见性（v-model） */
  modelValue: boolean;
  /** 标注列表（笔记 + 划线统一结构） */
  items: AnnotationDisplayItem[];
  /** 抽屉标题（书架来源显示书名，否则默认） */
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'jump', item: AnnotationDisplayItem): void;
  (e: 'delete', item: AnnotationDisplayItem): void;
  (e: 'delete-all', scope: 'note' | 'highlight'): void;
  (e: 'export'): void;
  (e: 'save-note', payload: { id: number; text: string }): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

/** 当前标签页：note 笔记 / highlight 划线 */
const annotationTab = ref<'note' | 'highlight'>('note');

/** 仅含笔记内容的标注列表（note 非空） */
const noteItems = computed(() =>
  props.items.filter((a) => (a.note || '').trim().length > 0)
);
/** 仅含纯高亮的标注列表（note 为空） */
const highlightItems = computed(() =>
  props.items.filter((a) => !(a.note || '').trim())
);

/** 抽屉内搜索关键词（按划线原文 / 笔记内容过滤，忽略大小写） */
const keyword = ref('');

/** 关键词命中判定：划线原文或笔记内容包含关键词即命中 */
function matchKeyword(item: AnnotationDisplayItem): boolean {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return true;
  return (
    (item.text || '').toLowerCase().includes(kw) ||
    (item.note || '').toLowerCase().includes(kw)
  );
}

/** 将 ISO 时间格式化为 "YYYY-MM-DD HH:mm"，无效时返回空串 */
function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 悬浮提示文案：始终显示创建时间；若更新时间晚于创建时间（说明被修改过）则额外显示更新时间。
 * 用真实换行符拼接，浏览器原生 title 会按行展示。
 */
function timeTooltip(item: AnnotationDisplayItem): string {
  const created = formatTime(item.createdAt);
  const updated = item.updatedAt && item.updatedAt !== item.createdAt ? formatTime(item.updatedAt) : '';
  let tip = `创建时间：${created || '—'}`;
  if (updated) tip += `\n更新时间：${updated}`;
  return tip;
}

/** 笔记标签页：在 noteItems 基础上按关键词过滤 */
const filteredNoteItems = computed(() => noteItems.value.filter(matchKeyword));
/** 划线标签页：在 highlightItems 基础上按关键词过滤 */
const filteredHighlightItems = computed(() => highlightItems.value.filter(matchKeyword));

/** 书架来源时编辑笔记的弹窗状态 */
const shelfNoteEditVisible = ref(false);
const shelfNoteEditText = ref('');
const shelfNoteEditId = ref<number | null>(null);

/** 点击标注：通知父组件跳转到对应位置（父组件负责关闭抽屉） */
function onSelect(item: AnnotationDisplayItem) {
  emit('jump', item);
}

/** 点击编辑：打开笔记编辑弹窗（复用书架来源的编辑弹窗） */
function onEdit(item: AnnotationDisplayItem) {
  shelfNoteEditId.value = item.id;
  shelfNoteEditText.value = item.note || '';
  shelfNoteEditVisible.value = true;
}

/** 点击删除：通知父组件执行删除（IPC + 同步阅读组件高亮） */
function onDelete(item: AnnotationDisplayItem) {
  emit('delete', item);
}

/** 一键删除当前标签页全部（笔记或划线）：通知父组件按范围批量删除 */
function onDeleteAll(scope: 'note' | 'highlight') {
  emit('delete-all', scope);
}

/** 点击导出：通知父组件导出当前笔记与划线 */
function onExport() {
  emit('export');
}

/** 保存笔记：将编辑结果回传父组件（IPC + 同步阅读组件）并关闭弹窗 */
function onSaveNote() {
  if (shelfNoteEditId.value == null) return;
  emit('save-note', { id: shelfNoteEditId.value, text: shelfNoteEditText.value });
  shelfNoteEditVisible.value = false;
  shelfNoteEditId.value = null;
}
</script>

<style scoped lang="scss">
/* 笔记与划线抽屉：标签页切换，区分「笔记」与「划线」 */
.annotation-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;

  .annotation-export-bar {
    display: flex;
    justify-content: flex-end;
    padding: 0 4px 10px;
  }

  /* 抽屉内搜索框：位于导出栏与标签页之间，过滤当前标签页内容 */
  .annotation-search {
    padding: 0 4px 12px;
  }

  .annotation-tabs {
    display: flex;
    gap: 8px;
    padding: 0 4px 12px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 8px;

    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: calc(var(--radius-card, 6px) - 2px);
      background: transparent;
      color: var(--text-secondary);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;

      .tab-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 9px;
        background: var(--bg-hover, rgba(0, 0, 0, 0.06));
        font-size: 11px;
        font-variant-numeric: tabular-nums;
      }

      &:hover {
        color: var(--text-primary);
        border-color: var(--color-primary);
      }

      &.active {
        color: #fff;
        background: var(--color-primary);
        border-color: var(--color-primary);

        .tab-count {
          background: rgba(255, 255, 255, 0.25);
          color: #fff;
        }
      }
    }
  }
}

/* 笔记与划线列表：参考 .toc-list 风格 */
.annotation-list {
  flex: 1;
  overflow: auto;
  padding: 8px 0;

  /* 标签页顶部的「一键删除所有」操作行 */
  .annotation-bulk-actions {
    display: flex;
    justify-content: flex-end;
    padding: 0 8px 10px;
    margin-bottom: 4px;
    border-bottom: 1px dashed var(--border-subtle);
  }

  /* 单条笔记项：hover 高亮、点击跳转 */
  .annotation-item {
    padding: 10px 12px;
    border-radius: var(--radius-card, 6px);
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: var(--bg-hover, var(--bg-base));
    }

    /* 引用内容（原文摘录）：左侧灰色竖线标识，最多 3 行截断 */
    .annotation-text {
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-primary);
      padding-left: 8px;
      border-left: 2px solid var(--border-subtle);
      margin-bottom: 6px;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* 笔记内容：左侧竖线区分，主题色突出，直接展示不折叠 */
    .annotation-note {
      margin-top: 6px;
      padding: 8px 10px;
      font-size: 12px;
      line-height: 1.6;
      color: var(--text-secondary);
      background: var(--bg-base);
      border-left: 2px solid var(--color-primary);
      border-radius: 4px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* 操作区：按钮靠右 */
    .annotation-actions {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 6px;
    }

    /* 时间元信息：最后修改时间，弱化显示 */
    .annotation-meta {
      margin-top: 6px;
      font-size: 11px;
      line-height: 1.4;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }
  }

  /* 空状态提示：居中、弱化色 */
  .annotation-empty {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }
}
</style>
