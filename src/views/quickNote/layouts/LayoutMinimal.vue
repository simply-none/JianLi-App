<template>
  <div class="layout-minimal">
    <div class="drag-bar" :class="['drag-' + editorTheme]">
      <div class="drag-left">
        <span class="title-icon">📝</span>
        <span class="title-text">快速记录</span>
      </div>
      <div class="drag-right">
        <el-button size="small" text @click="toggleTheme" class="icon-btn">
          <LucideIcon :name="editorTheme === 'light' ? 'Moon' : 'SunMoon'" :size="16" :title="editorTheme === 'light' ? '切换深色主题' : '切换浅色主题'" />
        </el-button>
        <el-button size="small" text @click="showNoteList = !showNoteList" class="icon-btn">
          <LucideIcon name="FolderOpen" :size="16" title="历史笔记" />
        </el-button>
        <el-button size="small" text @click="$emit('new-note')" class="icon-btn">
          <LucideIcon name="FilePlus" :size="16" title="新建笔记" />
        </el-button>
        <el-button size="small" text @click="$emit('toggle-drag')" class="icon-btn" :class="{ 'drag-disabled': !dragEnabled }">
          <LucideIcon :name="dragEnabled ? 'Hand' : 'Move'" :size="16" :title="dragEnabled ? '禁用拖拽' : '启用拖拽'" />
        </el-button>
        <el-button size="small" text @click="$emit('save')" class="icon-btn save-btn">
          <LucideIcon name="FileCheck" :size="16" title="保存笔记" />
        </el-button>
        <el-button size="small" text @click="$emit('close-window')" class="icon-btn close-btn">
          <LucideIcon name="X" :size="16" title="关闭窗口" />
        </el-button>
      </div>
    </div>

    <div class="editor-wrapper">
      <MdEditor
        v-model="localText"
        :theme="editorTheme"
        :previewTheme="previewTheme"
        :preview="false"
        :toolbars="toolbars"
        @on-change="handleChange"
        @on-save="handleSave"
      />
    </div>

    <div class="status-bar">
      <span class="status-item">字数: {{ wordCount }}</span>
      <span class="status-divider">|</span>
      <span class="status-item">{{ saveStatusText }}</span>
    </div>

    <el-drawer
      v-model="showNoteList"
      title="历史笔记"
      direction="rtl"
      size="60%"
      :append-to-body="false"
    >
      <div class="note-list">
        <div
          v-for="note in noteList"
          :key="note.key"
          class="note-item"
          @click="$emit('load-note', note); showNoteList = false"
        >
          <div class="note-excerpt">{{ note.excerpt }}</div>
          <div class="note-time">{{ note.updateTime || note.createTime }}</div>
        </div>
        <div v-if="noteList.length === 0" class="empty-tip">暂无笔记</div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import LucideIcon from '@/components/LucideIcon.vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  skin: {
    type: String,
    default: 'white'
  },
  layout: {
    type: String,
    default: 'minimal'
  },
  noteList: {
    type: Array,
    default: () => []
  },
  currentNote: {
    type: Object,
    default: () => ({})
  },
  wordCount: {
    type: Number,
    default: 0
  },
  saveStatus: {
    type: String,
    default: 'saved'
  },
  dragEnabled: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits([
  'update:modelValue',
  'save',
  'load-note',
  'new-note',
  'cycle-skin',
  'cycle-layout',
  'toggle-drag',
  'close-window'
]);

const showNoteList = ref(false);
const editorTheme = ref(props.skin === 'dark' ? 'dark' : 'light');
const previewTheme = ref('default');

const toolbars = [
  'bold',
  'underline',
  'italic',
  '-',
  'title',
  'strikeThrough',
  'sub',
  'sup',
  'quote',
  'unorderedList',
  'orderedList',
  '-',
  'code',
  'codeBlock',
  'link',
  'image',
  'table',
  '-',
  'revoke',
  'next'
];

const localText = computed({
  get: () => props.modelValue,
  set: (val: string) => emit('update:modelValue', val)
});

const saveStatusText = computed(() => {
  switch (props.saveStatus) {
    case 'saving':
      return '保存中...';
    case 'saved':
      return '已保存';
    case 'error':
      return '保存失败';
    default:
      return '';
  }
});

function toggleTheme() {
  editorTheme.value = editorTheme.value === 'light' ? 'dark' : 'light';
}

function handleChange(val: string) {
  emit('update:modelValue', val);
}

function handleSave(val: string, htmlPromise: Promise<string>) {
  emit('save');
}

watch(() => props.skin, (newSkin) => {
  editorTheme.value = newSkin === 'dark' ? 'dark' : 'light';
});
</script>

<style lang="scss" scoped>
.layout-minimal {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--skin-bg);
  border-radius: 0.8em;
  border: 1px solid var(--skin-border);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.drag-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  -webkit-app-region: drag;
  border-bottom: 1px solid var(--skin-border);

  .drag-left {
    display: flex;
    align-items: center;
    gap: 8px;

    .title-icon {
      font-size: 14px;
    }

    .title-text {
      font-size: 13px;
      font-weight: 600;
      color: var(--skin-text-primary);
    }
  }

  .drag-right {
    display: flex;
    align-items: center;
    gap: 4px;
    -webkit-app-region: no-drag;

    .icon-btn {
      padding: 4px 8px;
      color: var(--skin-text-secondary);

      &:hover {
        color: var(--skin-text-primary);
        background: var(--skin-btn-bg);
      }

      &.save-btn {
        color: var(--skin-circle-ring);
      }
    }
  }
}

.editor-wrapper {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 12px;
  font-size: 11px;
  color: var(--skin-text-secondary);
  border-top: 1px solid var(--skin-border);
  -webkit-app-region: drag;

  .status-item {
    display: flex;
    align-items: center;
  }

  .status-divider {
    opacity: 0.4;
  }
}

.note-list {
  max-height: 100%;
  overflow-y: auto;

  .note-item {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-light);
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-hover);
    }

    .note-excerpt {
      font-size: 13px;
      color: var(--text-primary);
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .note-time {
      font-size: 11px;
      color: var(--text-muted);
    }
  }

  .empty-tip {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
    font-size: 13px;
  }
}

:deep(.md-editor) {
  height: 100%;
}

:deep(.md-editor-dark) {
  --md-color: var(--skin-text-primary);
  --md-bk-color: transparent;
}

:deep(.md-editor-light) {
  --md-color: var(--skin-text-primary);
  --md-bk-color: transparent;
}
</style>
