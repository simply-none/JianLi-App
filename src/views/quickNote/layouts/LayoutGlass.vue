<template>
  <div class="layout-glass" :data-skin="skin">
    <div class="title-bar">
      <div class="traffic-lights">
        <span class="dot dot-red"></span>
        <span class="dot dot-yellow"></span>
        <span class="dot dot-green"></span>
      </div>
      <div class="window-title">快速笔记</div>
      <div class="title-actions">
        <el-button size="small" text @click="$emit('cycle-skin')" class="action-btn">
          <LucideIcon name="Palette" :size="14" title="切换皮肤" />
        </el-button>
        <el-button size="small" text @click="$emit('cycle-layout')" class="action-btn">
          <LucideIcon name="LayoutDashboard" :size="14" title="切换布局" />
        </el-button>
        <el-button size="small" text @click="$emit('disabled-mouse-click-through')" class="action-btn" :class="{ 'drag-disabled': !dragEnabled }">
          <LucideIcon :name="dragEnabled ? 'TrendingUp' : 'TrendingUp'" :size="14" :title="dragEnabled ? '穿透' : '穿透'" />
        </el-button>
        <el-button size="small" text @click="$emit('save')" class="action-btn">
          <LucideIcon name="SaveCheck" :size="14" title="保存笔记" />
        </el-button>
        <el-button size="small" text @click="$emit('close-window')" class="action-btn close-btn">
          <LucideIcon name="X" :size="14" title="关闭窗口" />
        </el-button>
      </div>
    </div>

    <div class="toolbar">
      <div class="toolbar-left">
        <el-button size="small" text @click="execCmd('bold')" class="tool-btn" title="加粗">
          <strong>B</strong>
        </el-button>
        <el-button size="small" text @click="execCmd('italic')" class="tool-btn" title="斜体">
          <em>I</em>
        </el-button>
        <el-button size="small" text @click="execCmd('underline')" class="tool-btn" title="下划线">
          <u>U</u>
        </el-button>
        <span class="tool-divider"></span>
        <el-button size="small" text @click="execCmd('title')" class="tool-btn" title="标题">
          <LucideIcon name="Heading" :size="14" />
        </el-button>
        <el-button size="small" text @click="execCmd('quote')" class="tool-btn" title="引用">
          <LucideIcon name="Quote" :size="14" />
        </el-button>
        <el-button size="small" text @click="execCmd('unorderedList')" class="tool-btn" title="无序列表">
          <LucideIcon name="List" :size="14" />
        </el-button>
        <el-button size="small" text @click="execCmd('orderedList')" class="tool-btn" title="有序列表">
          <LucideIcon name="ListOrdered" :size="14" />
        </el-button>
        <span class="tool-divider"></span>
        <el-button size="small" text @click="execCmd('code')" class="tool-btn" title="行内代码">
          <LucideIcon name="Code" :size="14" />
        </el-button>
        <el-button size="small" text @click="execCmd('codeBlock')" class="tool-btn" title="代码块">
          <LucideIcon name="FileCode" :size="14" />
        </el-button>
        <el-button size="small" text @click="execCmd('link')" class="tool-btn" title="链接">
          <LucideIcon name="Link" :size="14" />
        </el-button>
        <el-button size="small" text @click="execCmd('table')" class="tool-btn" title="表格">
          <LucideIcon name="Table" :size="14" />
        </el-button>
      </div>
      <div class="toolbar-right">
        <el-button size="small" text @click="showNoteList = !showNoteList" class="tool-btn" title="笔记列表">
          <LucideIcon name="FolderOpen" :size="14" />
        </el-button>
        <el-button size="small" text @click="$emit('new-note')" class="tool-btn" title="新建笔记">
          <LucideIcon name="FilePlus" :size="14" />
        </el-button>
        <el-button size="small" text @click="$emit('save')" class="tool-btn save-btn" title="保存">
          <LucideIcon name="Save" :size="14" />
        </el-button>
      </div>
    </div>

    <div class="editor-area">
      <RichTextEditor
        ref="editorRef"
        v-model="localText"
        :theme="editorTheme"
        :editable="true"
        :toolbar="false"
        @on-change="handleChange"
        @on-save="handleSave"
      />
    </div>

    <div class="save-toast" :class="{ show: showToast }">
      <span class="toast-icon">✨</span>
      <span>{{ toastText }}</span>
    </div>

    <el-drawer
      v-model="showNoteList"
      title="笔记列表"
      direction="ltr"
      size="55%"
      :append-to-body="false"
      class="glass-drawer"
    >
      <div class="search-box">
        <el-input v-model="searchKeyword" placeholder="搜索笔记..." size="small" clearable>
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
          @click="$emit('load-note', note); showNoteList = false"
        >
          <div class="note-excerpt">{{ note.excerpt }}</div>
          <div class="note-meta">
            <span class="note-time">{{ note.updateTime || note.createTime }}</span>
          </div>
        </div>
        <div v-if="filteredNotes.length === 0" class="empty-tip">
          <LucideIcon name="FileX" :size="32" />
          <span>暂无笔记</span>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, PropType } from 'vue';
import RichTextEditor from '@/components/RichTextEditor.vue';
import { notePlainText } from '@/utils/noteContent';
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
    default: 'glass'
  },
  noteList: {
    type: Array as PropType<ObjectType[]>,
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
  'change-note',
  'close-window'
]);

const editorRef = ref<any>(null);
const showNoteList = ref(false);
const searchKeyword = ref('');
const showToast = ref(false);
const toastText = ref('已保存');
const editorTheme = ref<'light' | 'dark'>(props.skin === 'dark' ? 'dark' : 'light');

const localText = computed({
  get: () => props.modelValue,
  set: (val: string) => emit('update:modelValue', val)
});

const filteredNotes = computed(() => {
  if (!searchKeyword.value) return props.noteList;
  const keyword = searchKeyword.value.toLowerCase();
  return props.noteList.filter((note: any) =>
    note.excerpt?.toLowerCase().includes(keyword) ||
    notePlainText(note).toLowerCase().includes(keyword)
  );
});

/** 自定义工具栏命令：映射到 Quill 富文本格式（不再插入 Markdown 源码） */
function execCmd(cmd: string) {
  const quill = editorRef.value?.getQuill?.();
  if (!quill) return;

  const fmt = quill.getFormat();
  const commandMap: Record<string, () => void> = {
    bold: () => quill.format('bold', !fmt.bold),
    italic: () => quill.format('italic', !fmt.italic),
    underline: () => quill.format('underline', !fmt.underline),
    title: () => quill.format('header', fmt.header === 1 ? false : 1),
    quote: () => quill.format('blockquote', !fmt.blockquote),
    unorderedList: () => quill.format('list', fmt.list === 'bullet' ? false : 'bullet'),
    orderedList: () => quill.format('list', fmt.list === 'ordered' ? false : 'ordered'),
    code: () => quill.format('code', !fmt.code),
    codeBlock: () => quill.format('code-block', !fmt['code-block']),
    link: () => {
      const url = prompt('请输入链接地址', 'https://');
      if (url) quill.format('link', url);
    },
    table: () => {
      const html =
        '<table><tbody><tr><td>列1</td><td>列2</td><td>列3</td></tr>' +
        '<tr><td>内容</td><td>内容</td><td>内容</td></tr></tbody></table><p><br></p>';
      const index = quill.getLength();
      quill.clipboard.dangerouslyPasteHTML(index, html);
      quill.setSelection(index + html.length, 0);
    },
  };

  try {
    commandMap[cmd]?.();
  } catch (e) {
    console.log('cmd error:', e);
  }
}

function handleChange(val: string) {
  emit('update:modelValue', val);
  emit('change-note', val);
}

function handleSave(val: string, htmlPromise: Promise<string>) {
  emit('save');
  showSaveToast('已保存');
}

function showSaveToast(text: string) {
  toastText.value = text;
  showToast.value = true;
  setTimeout(() => {
    showToast.value = false;
  }, 2000);
}

watch(() => props.skin, (newSkin) => {
  editorTheme.value = newSkin === 'dark' ? 'dark' : 'light';
});

watch(() => props.saveStatus, (status) => {
  if (status === 'saved') {
    showSaveToast('已保存');
  } else if (status === 'saving') {
    showSaveToast('保存中...');
  } else if (status === 'error') {
    showSaveToast('保存失败');
  }
});
</script>

<style lang="scss" scoped>
.layout-glass {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--skin-bg);
  border-radius: 12px;
  border: 1px solid var(--skin-border);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.title-bar {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  -webkit-app-region: drag;
  border-bottom: 1px solid var(--skin-border);
  position: relative;

  .traffic-lights {
    display: flex;
    gap: 6px;
    margin-right: 12px;

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;

      &.dot-red {
        background: #ff5f57;
      }
      &.dot-yellow {
        background: #febc2e;
      }
      &.dot-green {
        background: #28c840;
      }
    }
  }

  .window-title {
    flex: 1;
    text-align: center;
    font-size: 13px;
    font-weight: 500;
    color: var(--skin-text-primary);
  }

  .title-actions {
    display: flex;
    gap: 4px;
    -webkit-app-region: no-drag;

    .action-btn {
      padding: 4px 6px;
      color: var(--skin-text-secondary);

      &:hover {
        color: var(--skin-text-primary);
        background: var(--skin-btn-bg);
      }
    }
  }
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--skin-border);
  background: rgba(255, 255, 255, 0.02);
  -webkit-app-region: no-drag;

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .tool-btn {
    padding: 4px 8px;
    border-radius: 4px;
    color: var(--skin-text-secondary);
    font-size: 12px;

    &:hover {
      background: var(--skin-btn-bg);
      color: var(--skin-text-primary);
    }

    &.save-btn {
      color: var(--skin-circle-ring);
    }
  }

  .tool-divider {
    width: 1px;
    height: 14px;
    background: var(--skin-border);
    margin: 0 4px;
  }
}

.editor-area {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.save-toast {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  padding: 8px 16px;
  background: var(--skin-bg);
  border: 1px solid var(--skin-border);
  border-radius: 20px;
  font-size: 12px;
  color: var(--skin-text-primary);
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  gap: 6px;

  &.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  .toast-icon {
    font-size: 14px;
  }
}

.search-box {
  margin-bottom: 12px;
}

.note-list {
  max-height: calc(100% - 50px);
  overflow-y: auto;

  .note-item {
    padding: 10px 12px;
    border-radius: 8px;
    margin-bottom: 6px;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;

    &:hover {
      background: var(--skin-btn-bg);
    }

    &.active {
      background: var(--skin-btn-bg);
      border-color: var(--skin-border);
    }

    .note-excerpt {
      font-size: 13px;
      color: var(--skin-text-primary);
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
    }

    .note-meta {
      display: flex;
      align-items: center;

      .note-time {
        font-size: 11px;
        color: var(--skin-text-secondary);
        opacity: 0.7;
      }
    }
  }

  .empty-tip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 60px 20px;
    color: var(--skin-text-secondary);
    opacity: 0.5;
    font-size: 13px;
  }
}

:deep(.ql-editor) {
  height: 100%;
}
</style>
