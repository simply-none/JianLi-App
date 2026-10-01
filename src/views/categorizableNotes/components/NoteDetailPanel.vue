<template>
  <section class="note-detail-panel">
    <!-- 空态：未选中笔记（新建入口） -->
    <div v-if="mode === 'empty'" class="panel-empty">
      <LucideIcon name="FileText" class="empty-icon" />
      <p class="empty-title">未选择笔记</p>
      <p class="empty-hint">从中间列表选择一篇笔记查看，或新建一篇</p>
      <el-button type="primary" plain size="small" @click="$emit('create')">
        <LucideIcon name="Plus" />
        新建笔记
      </el-button>
    </div>

    <!-- 查看态：标题 + 元信息 + 内联操作 + 只读正文 -->
    <template v-else-if="mode === 'view' && note">
      <header class="panel-head">
        <div class="head-main">
          <h2 class="view-title">{{ noteTitle(note) }}</h2>
          <div class="view-meta">
            <span class="meta-time" :title="`创建于 ${note.createTime || '--'}`">
              <LucideIcon name="History" />
              {{ formatTime(note.updateTime || note.createTime) }}
            </span>
            <span
              v-for="tag in viewTags"
              :key="tag.key"
              class="meta-tag"
              :style="{ backgroundColor: tagBg(tag.color), color: tag.color }"
              :title="`筛选「${tag.name}」`"
              @click="$emit('tag-click', tag.key)"
            >
              {{ tag.name }}
            </span>
            <span v-if="viewTags.length === 0" class="meta-none">无标签</span>
          </div>
        </div>
        <div class="head-actions">
          <el-button type="primary" @click="$emit('edit')">
            <LucideIcon name="Pencil" />
            编辑
          </el-button>
          <el-button plain class="danger-btn" @click="$emit('delete', note)">
            <LucideIcon name="Trash2" />
            删除
          </el-button>
        </div>
      </header>
      <div class="panel-body">
        <RichTextEditor
          :model-value="note.content || note.mdText || ''"
          :editable="false"
          :toolbar="false"
          :theme="editorTheme"
          class="panel-editor"
        />
      </div>
    </template>

    <!-- 编辑态：标签选择 + 富文本编辑 + 保存 / 取消（Ctrl+S 保存，Esc 取消） -->
    <template v-else-if="mode === 'edit'">
      <header class="panel-head">
        <div class="edit-bar">
          <span class="edit-label">
            <LucideIcon name="Tags" />
            标签
          </span>
          <TagSelector
            v-model="draftTagKeys"
            placeholder="选择或创建标签…"
            class="edit-tags"
            @tags-updated="$emit('tags-updated', $event)"
          />
        </div>
        <div class="head-actions">
          <el-button :disabled="saving" @click="handleCancel">取消</el-button>
          <el-button type="primary" :loading="saving" @click="doSave">
            <LucideIcon name="Save" />
            保存
          </el-button>
        </div>
      </header>
      <div class="panel-body">
        <RichTextEditor
          ref="editorRef"
          v-model="draftContent"
          :editable="true"
          :theme="editorTheme"
          placeholder="开始记录…"
          class="panel-editor"
        />
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
/**
 * 右栏详情 / 编辑面板（原子组件，替代旧版弹窗 NoteDetailDialog）
 * - 查看态：标题 + 时间 + 标签（可点击筛选）+ 只读正文，操作内联（编辑 / 删除）
 * - 编辑态：标签选择 + 富文本编辑 + 保存 / 取消；Ctrl+S 保存，Esc 取消
 * - 编辑草稿（draftContent / draftTagKeys）在组件内维护；切换前父级经 isDirty 守卫
 * - 保存动作通过 save 事件交父级落库（父级负责刷新列表与切回查看态）
 */
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import moment from 'moment'
import RichTextEditor from '@/components/RichTextEditor.vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { ElMessageBox } from 'element-plus'
import { noteTitle } from '@/utils/noteContent'
import TagSelector from './TagSelector.vue'
import {
  parseNoteTags,
  useEditorTheme,
  type NoteRow,
  type NoteTag,
  type DetailMode,
} from '../composables/useNotes'

const props = defineProps<{
  /** 当前笔记（新建时为 null，仅查看态要求非空） */
  note: NoteRow | null
  mode: DetailMode
  tags: NoteTag[]
  /** 父级落库中（保存按钮 loading） */
  saving?: boolean
}>()

const emit = defineEmits<{
  /** 进入编辑（查看态点编辑） */
  edit: []
  /** 保存：交父级 upsert */
  save: [payload: { content: string; html: string; tagKeys: string[] }]
  /** 取消编辑（父级决定回到查看还是空态） */
  cancel: []
  /** 删除当前笔记 */
  delete: [note: NoteRow]
  /** 新建（空态按钮） */
  create: []
  /** 从查看态点击标签筛选 */
  'tag-click': [tagKey: string]
  /** TagSelector 内部增删标签后同步父级 */
  'tags-updated': [tags: NoteTag[]]
}>()

const { editorTheme } = useEditorTheme()

const editorRef = ref()
/** 编辑草稿：正文 HTML + 标签 key（进入编辑态时从 note 初始化） */
const draftContent = ref('')
const draftTagKeys = ref<string[]>([])

/** 查看态标签（note.tags 解析 → 标签对象） */
const viewTags = computed<NoteTag[]>(() => {
  if (!props.note?.tags) return []
  const keys = parseNoteTags(props.note.tags)
  return props.tags.filter((t) => keys.includes(t.key))
})

/** 是否有未保存修改（正文或标签与原笔记不一致） */
function isDirty(): boolean {
  const original = props.note?.content || props.note?.mdText || ''
  if (draftContent.value !== original) return true
  const originKeys = parseNoteTags(props.note?.tags)
  if (draftTagKeys.value.length !== originKeys.length) return true
  return draftTagKeys.value.some((k) => !originKeys.includes(k))
}

/** 进入编辑 / 新建：初始化草稿 */
watch(
  () => props.mode,
  (mode) => {
    if (mode === 'edit') {
      draftContent.value = props.note?.content || props.note?.mdText || ''
      draftTagKeys.value = parseNoteTags(props.note?.tags)
    }
  },
  { immediate: true }
)

/** 保存（按钮 / Ctrl+S 共用）：取编辑器最新 HTML 交父级落库 */
function doSave() {
  const html = editorRef.value?.getHTML() ?? draftContent.value
  emit('save', { content: draftContent.value, html, tagKeys: [...draftTagKeys.value] })
}

/** 取消：有未保存修改时先确认 */
async function handleCancel() {
  if (isDirty()) {
    try {
      await ElMessageBox.confirm('当前修改尚未保存，确定放弃吗？', '放弃修改', {
        confirmButtonText: '放弃修改',
        cancelButtonText: '继续编辑',
        type: 'warning',
      })
    } catch {
      return
    }
  }
  emit('cancel')
}

/** Ctrl+S 保存 / Esc 取消（仅编辑态生效） */
function onKeydown(e: KeyboardEvent) {
  if (props.mode !== 'edit') return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    doSave()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    handleCancel()
  }
}
window.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

/** 标签底色：标签自身色 15% tint（数据驱动色） */
function tagBg(color: string): string {
  return `color-mix(in srgb, ${color} 15%, transparent)`
}

function formatTime(time?: string): string {
  if (!time) return '--'
  return moment(time).format('YYYY-MM-DD HH:mm')
}

defineExpose({
  /** 父级在切换 / 新建前调用，判断是否有未保存修改 */
  isDirty,
})
</script>

<style scoped lang="scss">
.note-detail-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-base);
  box-sizing: border-box;
  min-width: 0;
}

/* 空态 */
.panel-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;

  .empty-icon {
    font-size: 48px;
    color: var(--text-muted);
    opacity: 0.4;
    margin-bottom: 4px;
  }

  .empty-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .empty-hint {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--text-muted);
  }
}

/* 顶栏 */
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 12px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  min-height: 64px;
  box-sizing: border-box;

  .head-main {
    flex: 1;
    min-width: 0;

    .view-title {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .view-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;

      .meta-time {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--text-muted);
      }

      .meta-tag {
        font-size: 11px;
        padding: 1px 8px;
        border-radius: 9px;
        line-height: 1.5;
        cursor: pointer;

        &:hover {
          filter: brightness(1.1);
        }
      }

      .meta-none {
        font-size: 12px;
        color: var(--text-muted);
        opacity: 0.7;
      }
    }
  }

  .head-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;

    .danger-btn:hover {
      color: var(--color-error);
      border-color: color-mix(in srgb, var(--color-error) 45%, transparent);
    }
  }

  /* 编辑态顶栏：标签选择 + 操作 */
  .edit-bar {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;

    .edit-label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: var(--text-secondary);
      flex-shrink: 0;
    }

    .edit-tags {
      max-width: 420px;
    }
  }
}

/* 正文编辑器 */
.panel-body {
  flex: 1;
  min-height: 0;
  padding: 14px 18px 16px;
  display: flex;
  box-sizing: border-box;

  .panel-editor {
    flex: 1;
    min-height: 0;
  }
}
</style>
