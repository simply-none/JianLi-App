<template>
  <div class="categorizable-notes" :class="['theme-' + currentTheme]">
    <div class="cn-container">
      <div class="cn-header">
        <div class="cn-title">
          <h2>可归类的笔记</h2>
          <p class="cn-subtitle">支持标签分类，轻松管理你的笔记</p>
        </div>
        <el-button type="primary" @click="createNewNote">
          <LucideIcon name="Plus" />
          新建笔记
        </el-button>
      </div>

      <div class="cn-toolbar">
        <div class="toolbar-left">
          <div class="search-box">
            <LucideIcon name="Search" class="search-icon" />
            <el-input
              v-model="searchKeyword"
              placeholder="搜索笔记内容..."
              clearable
              @input="handleSearch"
              @clear="handleSearch"
              class="search-input"
            />
          </div>
          <div class="tag-filter">
            <el-popover
              placement="bottom-start"
              :width="300"
              trigger="click"
              v-model:visible="tagFilterVisible"
            >
              <template #reference>
                <el-button plain>
                  <LucideIcon name="Tags" />
                  标签筛选
                  <span v-if="selectedFilterTags.length > 0" class="tag-count">
                    {{ selectedFilterTags.length }}
                  </span>
                </el-button>
              </template>
              <div class="tag-filter-panel">
                <div class="filter-header">
                  <span>选择标签过滤</span>
                  <el-button link type="primary" @click="clearTagFilter" v-if="selectedFilterTags.length > 0">
                    清空
                  </el-button>
                </div>
                
                <div v-if="activeTags.length > 0" class="tag-group">
                  <div class="group-title">正常标签</div>
                  <div class="tag-list">
                    <div
                      v-for="tag in activeTags"
                      :key="tag.key"
                      class="tag-item"
                      :class="{ active: selectedFilterTags.includes(tag.key) }"
                      @click="toggleFilterTag(tag.key)"
                    >
                      <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
                      <span class="tag-name">{{ tag.name }}</span>
                      <LucideIcon v-if="selectedFilterTags.includes(tag.key)" name="Check" class="check-icon" />
                    </div>
                  </div>
                </div>
                
                <div v-if="deletedTags.length > 0" class="tag-group">
                  <div class="group-title">废弃标签</div>
                  <div class="tag-list">
                    <div
                      v-for="tag in deletedTags"
                      :key="tag.key"
                      class="tag-item deleted"
                      :class="{ active: selectedFilterTags.includes(tag.key) }"
                      @click="toggleFilterTag(tag.key)"
                    >
                      <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
                      <span class="tag-name">{{ tag.name }}</span>
                      <span class="deleted-badge">已删除</span>
                      <LucideIcon v-if="selectedFilterTags.includes(tag.key)" name="Check" class="check-icon" />
                    </div>
                  </div>
                </div>
                
                <div v-if="allTags.length === 0" class="no-tags">
                  暂无标签，创建笔记时可添加标签
                </div>
              </div>
            </el-popover>
          </div>
        </div>
        <div class="toolbar-right">
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button value="list">
              <LucideIcon name="List" />
            </el-radio-button>
            <el-radio-button value="editor">
              <LucideIcon name="Pencil" />
            </el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <div class="cn-selected-tags" v-if="selectedFilterTags.length > 0">
        <span class="selected-label">已选标签:</span>
        <span
          v-for="tagKey in selectedFilterTags"
          :key="tagKey"
          class="selected-tag"
          :style="{ backgroundColor: getTagColor(tagKey) + '20', color: getTagColor(tagKey) }"
        >
          {{ getTagName(tagKey) }}
          <LucideIcon name="X" class="close-icon" @click="toggleFilterTag(tagKey)" />
        </span>
      </div>

      <div class="cn-content">
        <div v-show="viewMode === 'list'" class="list-view">
          <NoteList
            :notes="allNotes"
            :tags="allTags"
            :loading="loading"
            :has-more="hasMore"
            @load-more="loadMore"
            @view="handleViewNote"
            @edit="handleEditNote"
            @delete="handleDeleteNote"
          />
        </div>

        <div v-show="viewMode === 'editor'" class="editor-view">
          <div class="editor-tags-bar">
            <span class="tags-label">标签:</span>
            <TagSelector v-model="editorTags" placeholder="选择或创建标签..." class="editor-tags-select" />
            <el-button type="primary" @click="handleSaveBtn">
              <LucideIcon name="TagPlus" />
              保存
            </el-button>
          </div>
          <MdEditor
            ref="editorRef"
            v-model="editorMdText"
            :preview="false"
            :theme="editorTheme"
            :previewTheme="previewTheme"
            @on-save="handleEditorSave"
            class="md-editor-main"
          />
        </div>
      </div>
    </div>

    <NoteDetailDialog
      v-model="dialogVisible"
      :note="currentNote"
      :tags="allTags"
      @save="handleDialogSave"
      @close="handleDialogClose"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { getStore } from '@/utils/common';
import useTheme from '@/store/useTheme';
import NoteList from './NoteList.vue';
import TagSelector from './TagSelector.vue';
import NoteDetailDialog from './NoteDetailDialog.vue';

const themeStore = useTheme();
const { currentTheme } = storeToRefs(themeStore);

const searchKeyword = ref('');
const viewMode = ref('list');
const tagFilterVisible = ref(false);
const selectedFilterTags = ref([]);
const allTags = ref([]);
const allNotes = ref([]);
const dialogVisible = ref(false);
const currentNote = ref({});
const editorRef = ref(null);
const editorMdText = ref('');
const editorTags = ref([]);
const currentEditorNote = ref({});
const pageSize = ref(10);
const currentPage = ref(1);
const loading = ref(false);
const hasMore = ref(true);

const editorTheme = computed(() => {
  const darkThemes = ['dark', 'midnight', 'nord', 'one-dark', 'dracula', 'github-dark', 
    'tokyo-night', 'solarized', 'gruvbox', 'catppuccin-mocha', 'ayu-dark', 'ayu-mirage',
    'monokai', 'synthwave', 'material-dark', 'jellybeans', 'tomorrow-night', 'cobalt',
    'spacemacs', 'tender', 'brackets-dark'];
  return darkThemes.includes(currentTheme.value) ? 'dark' : 'light';
});

const previewTheme = ref('default');

const filteredNotes = computed(() => {
  let result = [...allNotes.value];

  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase();
    result = result.filter(note => {
      const content = (note.mdText || '') + (note.excerpt || '');
      return content.toLowerCase().includes(keyword);
    });
  }

  if (selectedFilterTags.value.length > 0) {
    result = result.filter(note => {
      let tagKeys = [];
      try {
        tagKeys = JSON.parse(note.tags || '[]');
      } catch {
        tagKeys = note.tags ? [note.tags] : [];
      }
      return selectedFilterTags.value.some(key => tagKeys.includes(key));
    });
  }

  result.sort((a, b) => {
    return new Date(b.updateTime || b.createTime) - new Date(a.updateTime || a.createTime);
  });

  return result;
});

const activeTags = computed(() => allTags.value.filter(t => !t.deleted));
const deletedTags = computed(() => allTags.value.filter(t => t.deleted));

async function fetchTags() {
  try {
    const tags = getStore('note_tags') || [];
    allTags.value = Array.isArray(tags) ? tags : [];
  } catch (error) {
    console.error('获取标签失败:', error);
    allTags.value = [];
  }
}

async function fetchNotes(isLoadMore = false) {
  if (loading.value) return;

  loading.value = true;
  const offset = (currentPage.value - 1) * pageSize.value;

  let sql = 'SELECT * FROM note_book';

  if (searchKeyword.value.trim()) {
    sql += ` WHERE mdText LIKE '%${searchKeyword.value}%' OR excerpt LIKE '%${searchKeyword.value}%'`;
  }

  if (selectedFilterTags.value.length > 0) {
    const tagCondition = selectedFilterTags.value.map(key => `tags LIKE '%${key}%'`).join(' OR ');
    if (searchKeyword.value.trim()) {
      sql += ` AND (${tagCondition})`;
    } else {
      sql += ` WHERE ${tagCondition}`;
    }
  }

  sql += ` ORDER BY updateTime DESC LIMIT ${pageSize.value} OFFSET ${offset}`;

  window.ipcRenderer.handlePromise('query-data', {
    tableName: 'note_book',
    conditions: {
      SqlStr: sql,
    }
  }).then(result => {
    console.log(performance.now(), '获取笔记耗时:')
    if (result.success) {
      const data = result.data || [];
      const cleanData = data.filter(item => 
        item && typeof item === 'object' && !item.$el && !item.$options && !item._componentTag
      );
      if (isLoadMore) {
        allNotes.value.push(...cleanData);
      } else {
        console.log('获取笔记成功:', cleanData);
        allNotes.value = cleanData;
      }
      hasMore.value = cleanData.length >= pageSize.value;
    }
  }).catch(err => {
    console.error('获取笔记失败:', err);
  }).finally(() => {
    loading.value = false;
  });
}

function handleSearch() {
  currentPage.value = 1;
  hasMore.value = true;
  if (searchKeyword.value.trim() && viewMode.value === 'editor') {
    viewMode.value = 'list';
  }
  fetchNotes(false);
}

function loadMore() {
  if (!hasMore.value || loading.value) return;
  currentPage.value++;
  fetchNotes(true);
}

function toggleFilterTag(tagKey) {
  const index = selectedFilterTags.value.indexOf(tagKey);
  if (index > -1) {
    selectedFilterTags.value.splice(index, 1);
  } else {
    selectedFilterTags.value.push(tagKey);
  }
  if (selectedFilterTags.value.length > 0 && viewMode.value === 'editor') {
    viewMode.value = 'list';
  }
  currentPage.value = 1;
  hasMore.value = true;
  fetchNotes(false);
}

function clearTagFilter() {
  selectedFilterTags.value = [];
  currentPage.value = 1;
  hasMore.value = true;
  fetchNotes(false);
}

function getTagName(tagKey) {
  const tag = allTags.value.find(t => t.key === tagKey);
  return tag ? tag.name : '';
}

function getTagColor(tagKey) {
  const tag = allTags.value.find(t => t.key === tagKey);
  return tag ? tag.color : '#6366f1';
}

function createNewNote() {
  viewMode.value = 'editor';
  editorMdText.value = '';
  editorTags.value = [];
  currentEditorNote.value = {};
}

function handleSaveBtn() {
  editorRef.value?.triggerSave();
}

function resetEditorState() {
  editorMdText.value = '';
  editorTags.value = [];
  currentEditorNote.value = {};
  viewMode.value = 'list';
}

function handleViewNote(note) {
  currentNote.value = { ...note };
  dialogVisible.value = true;
}

function handleEditNote(note) {
  currentNote.value = { ...note };
  dialogVisible.value = true;
}

function handleDeleteNote(note) {
  const index = allNotes.value.findIndex(n => n.key === note.key);
  if (index > -1) {
    allNotes.value.splice(index, 1);
  }
}

async function handleEditorSave(v, h) {
  const html = await (typeof h === 'function' ? h() : Promise.resolve(v));
  const noteData = {
    ...currentEditorNote.value,
    key: currentEditorNote.value.key || uuidv4(),
    excerpt: (v || '').substring(0, 30) + '...',
    mdText: v,
    html: html,
    tags: JSON.stringify(editorTags.value),
    createTime: currentEditorNote.value.createTime || moment().format('YYYY-MM-DD HH:mm:ss'),
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
      currentEditorNote.value = noteData;
      fetchTags().then(() => {
        currentPage.value = 1;
        hasMore.value = true;
        fetchNotes(false).then(() => {
          // 保存成功后清空编辑器数据并切换到列表视图
          resetEditorState();
          return true;
        })
      })
    } else {
      ElMessage.error('保存失败:' + result.error);
      return false;
    }
  }).catch(err => {
    ElMessage.error('保存失败:' + err);
    return false;
  })
}

async function handleDialogSave(noteData) {
  fetchTags().then(() => {
    currentPage.value = 1;
    hasMore.value = true;
    fetchNotes(false);
  })
}

function handleDialogClose() {
  currentNote.value = {};
}

console.log(performance.now(), '获取笔记耗时1:')
onMounted(async () => {
  Promise.all([fetchTags(), fetchNotes()]);
  console.log('onMounted 执行')
});
</script>

<style scoped lang="scss">
.categorizable-notes {
  width: 100%;
  height: 100%;
  // background: var(--bg-base);
  overflow: hidden;
}

.cn-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  // padding: 20px 24px;
  box-sizing: border-box;
  gap: 16px;
}

.cn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .cn-title {
    h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .cn-subtitle {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--text-muted);
    }
  }
}

.cn-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 12px 16px;
  gap: 12px;

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .toolbar-right {
    flex-shrink: 0;
  }
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 400px;

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    font-size: 16px;
    z-index: 1;
  }

  .search-input {
    :deep(.el-input__wrapper) {
      padding-left: 36px;
      background: var(--bg-base);
      box-shadow: 0 0 0 1px var(--border-subtle) inset;

      &:hover {
        box-shadow: 0 0 0 1px var(--color-primary) inset;
      }

      &.is-focus {
        box-shadow: 0 0 0 1px var(--color-primary) inset;
      }
    }
  }
}

.tag-filter {
  .tag-count {
    background: var(--color-primary);
    color: #fff;
    font-size: 11px;
    padding: 0 6px;
    border-radius: 10px;
    margin-left: 4px;
    line-height: 16px;
    min-width: 16px;
    text-align: center;
    display: inline-block;
  }
}

.tag-filter-panel {
  .filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .tag-list {
    max-height: 300px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tag-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-hover);
    }

    &.active {
      background: var(--color-primary-light);
    }

    .tag-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .tag-name {
      flex: 1;
      font-size: 13px;
      color: var(--text-primary);
    }

    .check-icon {
      color: var(--color-primary);
      font-size: 14px;
    }
  }

  .no-tags {
    padding: 20px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }

  .tag-group {
    margin-bottom: 12px;

    .group-title {
      font-size: 12px;
      color: var(--text-muted);
      padding: 4px 0;
      margin-bottom: 4px;
      font-weight: 500;
    }
  }

  .tag-item.deleted {
    opacity: 0.6;
    
    .tag-name {
      text-decoration: line-through;
    }
    
    .deleted-badge {
      font-size: 10px;
      color: var(--text-muted);
      padding: 1px 4px;
      border-radius: 4px;
      background: var(--bg-hover);
      flex-shrink: 0;
    }
  }
}

.cn-selected-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;

  .selected-label {
    font-size: 13px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .selected-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    padding: 3px 8px;
    border-radius: 12px;
    line-height: 1.4;

    .close-icon {
      cursor: pointer;
      font-size: 12px;
      opacity: 0.7;

      &:hover {
        opacity: 1;
      }
    }
  }
}

.cn-content {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.list-view {
  height: 100%;
  overflow: hidden;
}

.editor-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 16px;
  box-sizing: border-box;

  .editor-tags-bar {
    display: flex;
    align-items: center;
    gap: 12px;

    .tags-label {
      font-size: 13px;
      color: var(--text-secondary);
      flex-shrink: 0;
    }

    .editor-tags-select {
      max-width: 400px;
    }
  }

  .md-editor-main {
    flex: 1;
    min-height: 0;
  }
}
</style>
