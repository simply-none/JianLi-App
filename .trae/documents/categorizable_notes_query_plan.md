# 可归类的笔记查询优化计划

## 一、需求概述

1. 删除查询栏中的「查询」和「重置」按钮
2. 标签筛选面板分类展示：上半部分正常标签，下半部分废弃标签（已删除）
3. 笔记查询改为分页滚动加载，参考 clipboard/index.vue 的实现方式

## 二、当前状态分析

### 现有实现
- **搜索栏**：有查询输入框 + 查询按钮 + 重置按钮
- **标签筛选**：所有标签混在一起展示，没有分类
- **笔记查询**：一次性获取 100 条记录，不分页
- **分页参考**：clipboard/index.vue 使用 `v-infinite-scroll` 实现滚动分页

### 关键代码位置
- [index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)
  - 搜索栏：第 15-33 行
  - 标签筛选面板：第 50-73 行
  - 笔记查询：`fetchNotes` 函数（第 226-242 行）
  - 笔记列表：第 103-110 行

## 三、修改计划

### 修改 1：删除查询和重置按钮

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：第 15-33 行（`.toolbar-left` 区域）

**修改内容**：删除查询和重置按钮，恢复搜索输入框的 `@input` 事件

```vue
<div class="toolbar-left">
  <div class="search-box">
    <el-icon class="search-icon"><Search /></el-icon>
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
    <!-- 标签筛选代码保持不变 -->
  </div>
</div>
```

### 修改 2：删除 handleReset 函数

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：第 266-269 行

**修改内容**：删除 `handleReset` 函数

### 修改 3：标签筛选面板分类展示

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：第 50-73 行（`.tag-filter-panel` 区域）

**修改内容**：将标签列表分为正常标签和废弃标签两部分

```vue
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
        <el-icon v-if="selectedFilterTags.includes(tag.key)" class="check-icon"><Check /></el-icon>
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
        <el-icon v-if="selectedFilterTags.includes(tag.key)" class="check-icon"><Check /></el-icon>
      </div>
    </div>
  </div>
  
  <div v-if="allTags.length === 0" class="no-tags">
    暂无标签，创建笔记时可添加标签
  </div>
</div>
```

### 修改 4：添加 activeTags 和 deletedTags 计算属性

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：在 `filteredNotes` 计算属性后添加

**修改内容**：
```javascript
const activeTags = computed(() => allTags.value.filter(t => !t.deleted));
const deletedTags = computed(() => allTags.value.filter(t => t.deleted));
```

### 修改 5：添加分页查询相关状态

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：在 `currentEditorNote` 后添加

**修改内容**：
```javascript
const pageSize = ref(20);
const currentPage = ref(1);
const loading = ref(false);
const hasMore = ref(true);
```

### 修改 6：修改 fetchNotes 函数支持分页

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：第 226-242 行

**修改内容**：
```javascript
async function fetchNotes(isLoadMore = false) {
  if (loading.value) return;
  
  loading.value = true;
  try {
    const offset = (currentPage.value - 1) * pageSize.value;
    
    let whereStr = '';
    if (searchKeyword.value.trim()) {
      whereStr += `mdText LIKE '%${searchKeyword.value}%' OR excerpt LIKE '%${searchKeyword.value}%'`;
    }
    
    if (selectedFilterTags.value.length > 0) {
      const tagCondition = selectedFilterTags.value.map(key => `tags LIKE '%${key}%'`).join(' OR ');
      whereStr = whereStr ? `(${whereStr}) AND (${tagCondition})` : tagCondition;
    }
    
    const result = await window.ipcRenderer.handlePromise('query-data', {
      tableName: 'note_book',
      conditions: {
        whereStr: whereStr ? `${whereStr} ORDER BY updateTime DESC LIMIT ${pageSize.value} OFFSET ${offset}` : `ORDER BY updateTime DESC LIMIT ${pageSize.value} OFFSET ${offset}`,
      }
    });
    
    if (result.success) {
      const data = result.data || [];
      if (isLoadMore) {
        allNotes.value.push(...data);
      } else {
        allNotes.value = data;
      }
      hasMore.value = data.length >= pageSize.value;
    }
  } catch (error) {
    console.error('获取笔记失败:', error);
  } finally {
    loading.value = false;
  }
}
```

### 修改 7：修改 handleSearch 函数重置分页

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：第 244-248 行

**修改内容**：
```javascript
function handleSearch() {
  currentPage.value = 1;
  hasMore.value = true;
  if (searchKeyword.value.trim() && viewMode.value === 'editor') {
    viewMode.value = 'list';
  }
  fetchNotes(false);
}
```

### 修改 8：添加 loadMore 函数

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：在 `handleSearch` 函数后添加

**修改内容**：
```javascript
function loadMore() {
  if (!hasMore.value || loading.value) return;
  currentPage.value++;
  fetchNotes(true);
}
```

### 修改 9：修改 toggleFilterTag 和 clearTagFilter 重置分页

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：第 250-264 行

**修改内容**：
```javascript
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
```

### 修改 10：修改 NoteList 组件支持滚动加载

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：第 103-110 行

**修改内容**：
```vue
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
```

### 修改 11：修改 NoteList.vue 支持滚动加载

**文件**：[NoteList.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/NoteList.vue)

**修改内容**：添加 `v-infinite-scroll` 指令和相关 props

```vue
<div class="note-list" v-infinite-scroll="handleLoadMore" :infinite-scroll-distance="100">
  <!-- 现有内容 -->
  <div v-if="loading" class="loading-state">
    <el-loading text="加载中..." />
  </div>
</div>
```

```javascript
const props = defineProps({
  notes: { type: Array, default: () => [] },
  tags: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: true }
});

const emit = defineEmits(['view', 'edit', 'delete', 'load-more']);

function handleLoadMore() {
  if (!props.loading && props.hasMore) {
    emit('load-more');
  }
}
```

### 修改 12：修改 handleDialogSave 和 resetEditorState 重置分页

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：第 356-363 行和第 292-297 行

**修改内容**：
```javascript
async function handleDialogSave(noteData) {
  await fetchTags();
  currentPage.value = 1;
  hasMore.value = true;
  await fetchNotes(false);
}

function resetEditorState() {
  editorMdText.value = '';
  editorTags.value = [];
  currentEditorNote.value = {};
  viewMode.value = 'list';
  currentPage.value = 1;
  hasMore.value = true;
  fetchNotes(false);
}
```

### 修改 13：添加标签分组样式

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：样式区域

**修改内容**：
```scss
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
```

## 四、验证步骤

1. **搜索功能测试**：
   - 删除查询和重置按钮后，搜索框输入应实时过滤
   - 搜索结果应分页加载

2. **标签筛选测试**：
   - 标签筛选面板应分为正常标签和废弃标签两部分
   - 废弃标签应显示删除标记和划线效果
   - 选择废弃标签也能过滤笔记

3. **分页加载测试**：
   - 滚动到底部应自动加载更多数据
   - 数据加载时应显示 loading 状态
   - 没有更多数据时应停止加载

4. **保存后刷新测试**：
   - 保存笔记后应重置分页并刷新列表

## 五、文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src/views/categorizableNotes/index.vue` | 修改 | 删除按钮、标签分类、分页查询 |
| `src/views/categorizableNotes/NoteList.vue` | 修改 | 添加滚动加载支持 |
