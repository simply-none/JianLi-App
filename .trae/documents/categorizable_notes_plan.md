# 可归类的笔记页面功能增强计划

## 一、需求概述

在可归类的笔记页面中新增以下功能：
1. 搜索栏新增「重置」和「查询」按钮
2. 主界面新增「保存」按钮，通过调用 MdEditor 组件的 `triggerSave` 方法触发
3. 保存成功之后（包括快捷键触发的保存），清空笔记数据，切换到列表视图

## 二、当前状态分析

### 现有实现
- **搜索栏**：仅有搜索输入框，没有重置和查询按钮
- **编辑器区域**：使用 `MdEditor` 组件，`ref="editorRef"`，支持 `@on-save` 事件
- **保存逻辑**：`handleEditorSave` 函数处理保存，但保存后没有清空数据
- **视图切换**：通过 `viewMode` 控制列表/编辑器视图切换

### 关键代码位置
- [index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)
  - 搜索栏：第 17-27 行
  - 编辑器区域：第 107-120 行
  - 保存逻辑：第 289-325 行
  - 数据重置：`createNewNote` 函数（第 265-270 行）

## 三、修改计划

### 修改 1：搜索栏新增按钮

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：第 15-27 行（`.cn-toolbar` 区域）

**修改内容**：
1. 在搜索框后面添加「查询」按钮
2. 添加「重置」按钮，点击时清空搜索关键词和已选标签

```vue
<div class="search-box">
  <el-icon class="search-icon"><Search /></el-icon>
  <el-input
    v-model="searchKeyword"
    placeholder="搜索笔记内容..."
    clearable
    @keyup.enter="handleSearch"
    @clear="handleSearch"
    class="search-input"
  />
</div>
<el-button @click="handleSearch" :disabled="!searchKeyword.trim()">
  查询
</el-button>
<el-button @click="handleReset" v-if="searchKeyword || selectedFilterTags.length > 0">
  重置
</el-button>
```

### 修改 2：新增 handleReset 函数

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：第 250 行附近（在 `clearTagFilter` 函数后添加）

**修改内容**：
```javascript
function handleReset() {
  searchKeyword.value = '';
  selectedFilterTags.value = [];
}
```

### 修改 3：主界面新增保存按钮

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：第 107-111 行（`.editor-tags-bar` 区域）

**修改内容**：
1. 在标签栏添加保存按钮
2. 引入 `Refresh` 图标

```vue
<div class="editor-tags-bar">
  <span class="tags-label">标签:</span>
  <TagSelector v-model="editorTags" placeholder="选择或创建标签..." class="editor-tags-select" />
  <el-button type="primary" @click="handleSaveBtn">
    <el-icon><Refresh /></el-icon>
    保存
  </el-button>
</div>
```

### 修改 4：新增 handleSaveBtn 函数

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改内容**：
```javascript
function handleSaveBtn() {
  editorRef.value?.triggerSave();
}
```

### 修改 5：修改 handleEditorSave 函数（关键修改）

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：第 289-325 行

**修改内容**：在保存成功后添加数据重置和视图切换逻辑

```javascript
async function handleEditorSave(v, h) {
  try {
    // ... 现有保存逻辑 ...

    if (result.success) {
      ElMessage.success('保存成功');
      // 保存成功后：清空编辑器数据并切换到列表视图
      resetEditorState();
      return true;
    }
    // ... 其他逻辑 ...
  }
}

// 新增：重置编辑器状态
function resetEditorState() {
  editorMdText.value = '';
  editorTags.value = [];
  currentEditorNote.value = {};
  viewMode.value = 'list';
}
```

### 修改 6：引入 Refresh 图标

**文件**：[index.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/index.vue)

**修改位置**：第 140 行

**修改内容**：
```javascript
import { Plus, Search, CollectionTag, List, EditPen, Check, Close, Refresh } from '@element-plus/icons-vue';
```

## 四、样式调整

可能需要调整 `.editor-tags-bar` 的样式，确保保存按钮位置合适：

```scss
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
    flex: 1;
    max-width: 400px;
  }
}
```

## 五、验证步骤

1. **搜索功能测试**：
   - 输入关键词，点击「查询」按钮，列表应正确过滤
   - 点击「重置」按钮，搜索关键词和已选标签应清空

2. **保存功能测试**：
   - 编写笔记后，点击「保存」按钮，笔记应正确保存
   - 按 Ctrl+S 快捷键，笔记应正确保存
   - 保存成功后，编辑器应自动清空并切换到列表视图

3. **新建笔记测试**：
   - 点击「新建笔记」按钮，编辑器应正确初始化

## 六、文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src/views/categorizableNotes/index.vue` | 修改 | 新增按钮、函数和逻辑 |
