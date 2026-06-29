<template>
  <div class="layout-sidebar">
    <div class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title">
          <LucideIcon name="NotebookPen" :size="16" />
          <span>笔记</span>
        </div>
        <el-button size="small" text @click="$emit('new-note')" class="new-btn" title="新建笔记">
          <LucideIcon name="Plus" :size="16" />
        </el-button>
      </div>

      <div class="search-box">
        <el-input v-model="searchKeyword" placeholder="搜索..." size="small" clearable>
          <template #prefix>
            <LucideIcon name="Search" :size="14" />
          </template>
        </el-input>
      </div>

      <div class="note-list">
        <div
          v-for="note in filteredNotes"
          :key="note.key"
          class="note-item"
          :class="{ active: currentNote?.key === note.key }"
          @click="$emit('load-note', note)"
        >
          <div class="note-excerpt">{{ note.excerpt }}</div>
          <div class="note-time">
            <LucideIcon name="Clock" :size="11" />
            <span>{{ formatTime(note.updateTime || note.createTime) }}</span>
          </div>
        </div>
        <div v-if="filteredNotes.length === 0" class="empty-tip">
          <LucideIcon name="FileX" :size="28" />
          <span>暂无笔记</span>
        </div>
      </div>
    </div>

    <div class="resize-handle" @mousedown="startResize"></div>

    <div class="editor-pane">
      <div class="editor-header">
        <div class="editor-title">
          <span v-if="currentNote?.key">{{ currentNote.excerpt || '未命名笔记' }}</span>
          <span v-else class="untitled">新建笔记</span>
        </div>
        <div class="editor-actions">
          <el-button size="small" text @click="$emit('cycle-skin')" class="action-btn">
            <LucideIcon name="Palette" :size="14" title="切换皮肤" />
          </el-button>
          <el-button size="small" text @click="$emit('cycle-layout')" class="action-btn">
            <LucideIcon name="LayoutDashboard" :size="14" title="切换布局" />
          </el-button>
          <el-button size="small" text @click="$emit('disabled-mouse-click-through')" class="action-btn" :class="{ 'drag-disabled': !dragEnabled }">
            <LucideIcon :name="dragEnabled ? 'TrendingUp' : 'TrendingUp'" :size="14" :title="dragEnabled ? '穿透' : '穿透'" />
          </el-button>
          <el-button size="small" text @click="$emit('save')" class="action-btn save-btn">
            <LucideIcon name="SaveCheck" :size="14" title="保存笔记" />
            <span>保存</span>
          </el-button>
          <el-button size="small" text @click="$emit('close-window')" class="action-btn close-btn">
            <LucideIcon name="X" :size="14" title="关闭窗口" />
          </el-button>
        </div>
      </div>

      <div class="editor-body">
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

      <div class="editor-footer">
        <span class="footer-item">
          <LucideIcon name="Type" :size="12" />
          <span>{{ wordCount }} 字</span>
        </span>
        <span class="footer-item status">
          <span class="status-dot" :class="saveStatus"></span>
          <span>{{ saveStatusText }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, PropType } from 'vue';
import { MdEditor, Themes, ToolbarNames } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import LucideIcon from '@/components/LucideIcon.vue';
import moment from 'moment';

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
    default: 'sidebar'
  },
  noteList: {
    type: Array as PropType<any[]>,
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
  'disabled-mouse-click-through',
  'close-window'
]);

const searchKeyword = ref('');
const sidebarWidth = ref(200);
const isResizing = ref(false);
const editorTheme = ref<Themes>(props.skin === 'dark' ? 'dark' : 'light');
const previewTheme = ref('default');

const toolbars: ToolbarNames[] = [
  'bold', 'underline', 'italic', 'strikeThrough',
  '-', 'title', 'sub', 'sup', 'quote',
  '-', 'unorderedList', 'orderedList',
  '-', 'code', 'codeRow', 'link', 'image', 'table',
  '-', 'revoke', 'next'
];

const localText = computed({
  get: () => props.modelValue,
  set: (val: string) => emit('update:modelValue', val)
});

const filteredNotes = computed(() => {
  if (!searchKeyword.value) return props.noteList;
  const keyword = searchKeyword.value.toLowerCase();
  return props.noteList.filter((note: any) =>
    note.excerpt?.toLowerCase().includes(keyword) ||
    note.mdText?.toLowerCase().includes(keyword)
  );
});

const saveStatusText = computed(() => {
  switch (props.saveStatus) {
    case 'saving': return '保存中';
    case 'saved': return '已保存';
    case 'error': return '保存失败';
    default: return '';
  }
});

function formatTime(time: string) {
  if (!time) return '--';
  const now = moment();
  const noteTime = moment(time);
  const diffDays = now.diff(noteTime, 'days');
  
  if (diffDays === 0) {
    return noteTime.format('HH:mm');
  } else if (diffDays === 1) {
    return '昨天';
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return noteTime.format('MM-DD');
  }
}

function startResize(e: MouseEvent) {
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = sidebarWidth.value;
  
  const handleMove = (e: MouseEvent) => {
    if (!isResizing.value) return;
    const delta = e.clientX - startX;
    const newWidth = Math.max(120, Math.min(400, startWidth + delta));
    sidebarWidth.value = newWidth;
  };
  
  const handleUp = () => {
    isResizing.value = false;
    document.removeEventListener('mousemove', handleMove);
    document.removeEventListener('mouseup', handleUp);
  };
  
  document.addEventListener('mousemove', handleMove);
  document.addEventListener('mouseup', handleUp);
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
.layout-sidebar {
  width: 100%;
  height: 100%;
  display: flex;
  background: var(--skin-bg);
  border-radius: 0.8em;
  border: 1px solid var(--skin-border);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.sidebar {
  width: v-bind('sidebarWidth + "px"');
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--skin-border);
  background: rgba(0, 0, 0, 0.02);
  -webkit-app-region: drag;

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--skin-border);

    .sidebar-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--skin-text-primary);
    }

    .new-btn {
      padding: 4px 6px;
      color: var(--skin-circle-ring);
      -webkit-app-region: no-drag;

      &:hover {
        background: var(--skin-btn-bg);
      }
    }
  }

  .search-box {
    padding: 8px 10px;
    -webkit-app-region: no-drag;
  }

  .note-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 6px;
    -webkit-app-region: no-drag;

    .note-item {
      padding: 8px 10px;
      border-radius: 6px;
      margin-bottom: 4px;
      cursor: pointer;
      transition: all 0.15s;

      &:hover {
        background: var(--skin-btn-bg);
      }

      &.active {
        background: var(--skin-btn-hover);
        border: 1px solid var(--skin-border);
      }

      .note-excerpt {
        font-size: 12px;
        color: var(--skin-text-primary);
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 500;
      }

      .note-time {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        color: var(--skin-text-secondary);
        opacity: 0.7;
      }
    }

    .empty-tip {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 40px 10px;
      color: var(--skin-text-secondary);
      opacity: 0.5;
      font-size: 12px;
    }
  }
}

.resize-handle {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.2s;
  flex-shrink: 0;

  &:hover {
    background: var(--skin-border);
  }
}

.editor-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--skin-border);
    -webkit-app-region: drag;

    .editor-title {
      font-size: 12px;
      color: var(--skin-text-primary);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      margin-right: 10px;

      &.untitled {
        color: var(--skin-text-secondary);
        opacity: 0.6;
        font-style: italic;
      }
    }

    .editor-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      -webkit-app-region: no-drag;

      .action-btn {
        padding: 4px 8px;
        color: var(--skin-text-secondary);
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 4px;

        &:hover {
          background: var(--skin-btn-bg);
          color: var(--skin-text-primary);
        }

        &.save-btn {
          color: var(--skin-circle-ring);
        }
      }
    }
  }

  .editor-body {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .editor-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 12px;
    font-size: 10px;
    color: var(--skin-text-secondary);
    border-top: 1px solid var(--skin-border);
    -webkit-app-region: drag;

    .footer-item {
      display: flex;
      align-items: center;
      gap: 4px;

      &.status {
        gap: 6px;

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #999;

          &.saving {
            background: #f59e0b;
            animation: pulse 1.5s infinite;
          }
          &.saved {
            background: #10b981;
          }
          &.error {
            background: #ef4444;
          }
        }
      }
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
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
