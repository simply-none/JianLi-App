<template>
  <div class="layout-classic" :class="{ 'theme-dark': editorTheme === 'dark' }">
    <div class="menu-bar">
      <div class="menu-items">
        <span class="menu-item">文件</span>
        <span class="menu-item">编辑</span>
        <span class="menu-item">视图</span>
        <span class="menu-item">帮助</span>
      </div>
      <div class="menu-actions">
        <el-button size="small" text @click="$emit('cycle-skin')" class="menu-btn">
          <LucideIcon name="Palette" :size="13" title="切换皮肤" />
        </el-button>
        <el-button size="small" text @click="$emit('cycle-layout')" class="menu-btn">
          <LucideIcon name="LayoutDashboard" :size="13" title="切换布局" />
        </el-button>
        <el-button size="small" text @click="$emit('disabled-mouse-click-through')" class="menu-btn" :class="{ 'drag-disabled': !dragEnabled }">
          <LucideIcon :name="dragEnabled ? 'TrendingUp' : 'TrendingUp'" :size="13" :title="dragEnabled ? '穿透' : '穿透'" />
        </el-button>
        <el-button size="small" text @click="$emit('save')" class="menu-btn">
          <LucideIcon name="SaveCheck" :size="13" title="保存笔记" />
        </el-button>
        <el-button size="small" text @click="$emit('close-window')" class="menu-btn close-btn">
          <LucideIcon name="X" :size="13" title="关闭窗口" />
        </el-button>
      </div>
    </div>

    <div class="tab-bar">
      <div class="tab-item active">
        <LucideIcon name="FileText" :size="13" />
        <span class="tab-name">{{ fileName }}</span>
        <span class="tab-dirty" v-if="saveStatus === 'saving'">●</span>
      </div>
      <div class="tab-actions">
        <el-button-group size="small">
          <el-button :type="viewMode === 'edit' ? 'primary' : 'default'" plain @click="viewMode = 'edit'">
            编辑
          </el-button>
          <el-button :type="viewMode === 'split' ? 'primary' : 'default'" plain @click="viewMode = 'split'">
            分栏
          </el-button>
          <el-button :type="viewMode === 'preview' ? 'primary' : 'default'" plain @click="viewMode = 'preview'">
            预览
          </el-button>
        </el-button-group>
      </div>
    </div>

    <div class="editor-container">
      <div 
        class="editor-pane"
        v-show="viewMode === 'edit' || viewMode === 'split'"
        :style="{ width: viewMode === 'split' ? '50%' : '100%' }"
      >
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
      
      <div 
        class="preview-pane"
        v-show="viewMode === 'preview' || viewMode === 'split'"
        :style="{ width: viewMode === 'split' ? '50%' : '100%' }"
      >
        <MdEditor
          :modelValue="localText"
          :theme="editorTheme"
          :previewTheme="previewTheme"
          :preview="true"
          :toolbars="[] as ToolbarNames[]"
          :editable="false"
        />
      </div>
    </div>

    <div class="status-bar">
      <div class="status-left">
        <span class="status-item">
          <LucideIcon name="Gauge" :size="12" />
          <span>Markdown</span>
        </span>
        <span class="status-item">
          <span>UTF-8</span>
        </span>
      </div>
      <div class="status-right">
        <span class="status-item">Ln {{ cursorLine }}, Col {{ cursorCol }}</span>
        <span class="status-sep">|</span>
        <span class="status-item">{{ wordCount }} 字</span>
        <span class="status-sep">|</span>
        <span class="status-item save-status" :class="saveStatus">
          <span v-if="saveStatus === 'saving'">保存中...</span>
          <span v-else-if="saveStatus === 'saved'">已保存</span>
          <span v-else-if="saveStatus === 'error'">保存失败</span>
          <span v-else>就绪</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { MdEditor, Themes, ToolbarNames } from 'md-editor-v3';
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
    default: 'classic'
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
  'disabled-mouse-click-through',
  'close-window'
]);

const viewMode = ref<'edit' | 'split' | 'preview'>('edit');
const editorTheme = ref<Themes>(props.skin === 'dark' ? 'dark' : 'light');
const previewTheme = ref('default');
const cursorLine = ref(1);
const cursorCol = ref(1);

const toolbars: ToolbarNames[] = [
  'bold', 'underline', 'italic', 'strikeThrough', 'sub', 'sup',
  '-', 'title', 'quote', 'unorderedList', 'orderedList', 'task',
  '-', 'codeRow', 'code', 'link', 'image', 'table', 'mermaid', 'katex',
  '-', 'revoke', 'next', 'save',
  '=', 'pageFullscreen', 'fullscreen', 'preview', 'htmlPreview',
  '-', 'catalog', 'github'
];

const fileName = computed(() => {
  if (props.currentNote?.excerpt) {
    const excerpt = props.currentNote.excerpt.replace(/\.\.\.$/, '');
    return excerpt.length > 20 ? excerpt.substring(0, 20) + '...' : excerpt;
  }
  return 'untitled.md';
});

const localText = computed({
  get: () => props.modelValue,
  set: (val: string) => emit('update:modelValue', val)
});

function handleChange(val: string) {
  emit('update:modelValue', val);
  const lines = val.split('\n');
  cursorLine.value = lines.length;
  cursorCol.value = lines[lines.length - 1]?.length || 0;
}

function handleSave(val: string, htmlPromise: Promise<string>) {
  emit('save');
}

watch(() => props.skin, (newSkin) => {
  editorTheme.value = newSkin === 'dark' ? 'dark' : 'light';
});

watch(() => props.modelValue, (val) => {
  const lines = val.split('\n');
  cursorLine.value = lines.length;
  cursorCol.value = lines[lines.length - 1]?.length || 0;
}, { immediate: true });
</script>

<style lang="scss" scoped>
.layout-classic {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fafafa;
  border-radius: 6px;
  overflow: hidden;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;

  &.theme-dark {
    background: #1e1e1e;

    .menu-bar {
      background: #323233;
      color: #cccccc;
      border-bottom: 1px solid #252526;

      .menu-item:hover {
        background: #094771;
      }
    }

    .tab-bar {
      background: #252526;
      border-bottom: 1px solid #1e1e1e;

      .tab-item {
        color: #969696;
        background: #2d2d2d;
        border-color: #252526;

        &.active {
          color: #ffffff;
          background: #1e1e1e;
          border-top: 1px solid #007acc;
        }
      }
    }

    .status-bar {
      background: #007acc;
      color: #ffffff;
    }
  }
}

.menu-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  height: 28px;
  background: #f3f3f3;
  border-bottom: 1px solid #e5e5e5;
  font-size: 12px;
  -webkit-app-region: drag;

  .menu-items {
    display: flex;
    gap: 2px;

    .menu-item {
      padding: 4px 10px;
      cursor: pointer;
      border-radius: 3px;
      color: #333;
      -webkit-app-region: no-drag;

      &:hover {
        background: #e5e5e5;
      }
    }
  }

  .menu-actions {
    display: flex;
    gap: 2px;
    -webkit-app-region: no-drag;

    .menu-btn {
      padding: 2px 6px;
      color: #666;

      &:hover {
        background: #e5e5e5;
      }
    }
  }
}

.tab-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  height: 32px;
  background: #ececec;
  border-bottom: 1px solid #ddd;
  -webkit-app-region: drag;

  .tab-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    height: 100%;
    font-size: 12px;
    color: #666;
    background: #e0e0e0;
    border: 1px solid #ccc;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    margin-right: 2px;
    -webkit-app-region: no-drag;

    &.active {
      color: #333;
      background: #fafafa;
      border-top: 1px solid #0078d4;
      font-weight: 500;
    }

    .tab-name {
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tab-dirty {
      color: #0078d4;
      font-size: 10px;
    }
  }

  .tab-actions {
    -webkit-app-region: no-drag;
  }
}

.editor-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;

  .editor-pane,
  .preview-pane {
    height: 100%;
    overflow: hidden;
  }

  .preview-pane {
    border-left: 1px solid #e5e5e5;
  }
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  height: 22px;
  background: #007acc;
  color: #fff;
  font-size: 11px;
  -webkit-app-region: drag;

  .status-left,
  .status-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .status-sep {
    opacity: 0.4;
  }

  .save-status {
    &.saving {
      color: #ffd700;
    }
    &.saved {
      color: #90ee90;
    }
    &.error {
      color: #ff6b6b;
    }
  }
}

:deep(.md-editor) {
  height: 100%;
}

:deep(.md-editor-dark) {
  --md-color: #d4d4d4;
  --md-bk-color: #1e1e1e;
}

:deep(.md-editor-light) {
  --md-color: #333;
  --md-bk-color: #fafafa;
}
</style>
