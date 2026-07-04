<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑笔记' : '查看笔记'"
    width="80%"
    :close-on-click-modal="false"
    class="note-detail-dialog"
    destroy-on-close
  >
    <template #header>
      <div class="dialog-header">
        <span class="dialog-title">{{ isEdit ? '编辑笔记' : '查看笔记' }}</span>
        <div class="dialog-tags">
          <TagSelector v-model="selectedTags" placeholder="选择标签" v-if="isEdit" />
          <div v-else class="view-tags">
            <span
              v-for="tag in viewTags"
              :key="tag.key"
              class="view-tag"
              :style="{ backgroundColor: tag.color + '20', color: tag.color }"
            >
              {{ tag.name }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <div class="dialog-content">
      <MdEditor
        ref="editorRef"
        v-model="mdText"
        :theme="editorTheme"
        :previewTheme="previewTheme"
        :preview="false"
        :read-only="!isEdit"
        :toolbars="isEdit ? toolbars : []"
        @on-save="handleSave"
        class="md-editor-wrapper"
      />
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">{{ isEdit ? '取消' : '关闭' }}</el-button>
        <el-button v-if="!isEdit" type="primary" @click="switchToEdit">编辑</el-button>
        <el-button v-else type="primary" @click="handleSaveBtn">保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { ElMessage, ElDialog } from 'element-plus';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { storeToRefs } from 'pinia';
import useTheme from '@/store/useTheme';
import TagSelector from './TagSelector.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  note: {
    type: Object,
    default: () => ({})
  },
  tags: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:modelValue', 'save', 'close']);

const themeStore = useTheme();
const { currentTheme } = storeToRefs(themeStore);

const dialogVisible = computed({
  get() {
    return props.modelValue;
  },
  set(val) {
    emit('update:modelValue', val);
  }
});

const mdText = ref('');
const selectedTags = ref([]);
const isEdit = ref(false);
const currentNote = ref({});

const editorTheme = computed(() => {
  const darkThemes = ['dark', 'midnight', 'nord', 'one-dark', 'dracula', 'github-dark', 
    'tokyo-night', 'solarized', 'gruvbox', 'catppuccin-mocha', 'ayu-dark', 'ayu-mirage',
    'monokai', 'synthwave', 'material-dark', 'jellybeans', 'tomorrow-night', 'cobalt',
    'spacemacs', 'tender', 'brackets-dark'];
  return darkThemes.includes(currentTheme.value) ? 'dark' : 'light';
});

const previewTheme = ref('default');

const editorRef = ref();

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
  'task',
  '-',
  'codeRow',
  'code',
  'link',
  'image',
  'table',
  'mermaid',
  'katex',
  '-',
  'revoke',
  'next',
  'save',
  '=',
  'pageFullscreen',
  'fullscreen',
  'preview',
  'previewOnly',
  'htmlPreview',
  'catalog',
];

const viewTags = computed(() => {
  if (!currentNote.value.tags) return [];
  let tagKeys = [];
  try {
    tagKeys = JSON.parse(currentNote.value.tags);
  } catch {
    tagKeys = currentNote.value.tags ? [currentNote.value.tags] : [];
  }
  return props.tags.filter(t => tagKeys.includes(t.key));
});

watch(() => props.note, (newNote) => {
  if (newNote && newNote.key) {
    currentNote.value = { ...newNote };
    mdText.value = newNote.mdText || '';
    isEdit.value = false;
    let tagKeys = [];
    try {
      tagKeys = JSON.parse(newNote.tags || '[]');
    } catch {
      tagKeys = newNote.tags ? [newNote.tags] : [];
    }
    selectedTags.value = tagKeys;
  } else {
    currentNote.value = {};
    mdText.value = '';
    selectedTags.value = [];
    isEdit.value = true;
  }
}, { immediate: true, deep: true });

watch(() => props.modelValue, (val) => {
  if (val && !props.note?.key) {
    isEdit.value = true;
  }
});

function switchToEdit() {
  isEdit.value = true;
}

function handleClose() {
  dialogVisible.value = false;
  emit('close');
}

async function handleSaveBtn() {
  await handleSave(mdText.value, Promise.resolve(''));
}

async function handleSave(v, h) {
  try {
    const html = await (typeof h === 'function' ? h() : Promise.resolve(v));
    const noteData = {
      ...currentNote.value,
      key: currentNote.value.key || uuidv4(),
      excerpt: (v || '').substring(0, 30) + '...',
      mdText: v,
      html: html,
      tags: JSON.stringify(selectedTags.value),
      createTime: currentNote.value.createTime || moment().format('YYYY-MM-DD HH:mm:ss'),
      updateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
    };

    window.ipcRenderer.handlePromise('set-data', {
      tableName: 'note_book',
      data: noteData,
      config: {
        primaryKey: 'key'
      }
    }).then(result => {
      if (result.success) {
        ElMessage.success('保存成功');
        currentNote.value = noteData;
        isEdit.value = false;
        emit('save', noteData);
        dialogVisible.value = false;
        return true;
      } else {
        ElMessage.error('保存失败:' + result.error);
        return false;
      }
    }).catch(err => {
      ElMessage.error('保存失败:' + err);
      return false;
    })
  } catch (error) {
    ElMessage.error('保存失败:' + error);
    return false;
  }
}
</script>

<style scoped lang="scss">
.note-detail-dialog {
  :deep(.el-dialog) {
    background: var(--bg-card);
    border-radius: var(--radius-card);
  }

  :deep(.el-dialog__header) {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle);
    margin-right: 0;
  }

  :deep(.el-dialog__body) {
    padding: 0;
  }

  :deep(.el-dialog__footer) {
    padding: 12px 20px;
    border-top: 1px solid var(--border-subtle);
  }
}

.dialog-header {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .dialog-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .dialog-tags {
    width: 100%;
    max-width: 400px;
  }
}

.view-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  .view-tag {
    font-size: 12px;
    padding: 2px 10px;
    border-radius: 10px;
    line-height: 1.5;
  }
}

.dialog-content {
  box-sizing: border-box;
  min-height: 400px;
  max-height: 70vh;
  overflow: auto;
}

.md-editor-wrapper {
  height: 100%;
  min-height: 400px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
