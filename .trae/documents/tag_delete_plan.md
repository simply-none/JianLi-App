# 标签删除功能计划

## 一、需求概述

在可归类的笔记页面中新增标签删除功能：
1. 提供标签删除功能（软删除）
2. 删除的标签后续笔记修改/新增时不能选择
3. 已选择该标签的笔记数据保留（只是不能继续使用该标签）

## 二、当前状态分析

### 现有实现
- **标签存储**：`getStore('note_tags')` / `setStore('note_tags', tags)` 存储标签数组
- **标签结构**：`{ key, name, color, createTime, updateTime }`
- **创建标签**：TagSelector 组件中支持创建新标签
- **选择标签**：通过 el-select 组件选择

### 关键代码位置
- [TagSelector.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/TagSelector.vue)
  - 标签列表：第 15-25 行
  - 获取/保存标签：第 116-138 行
  - 创建标签：第 140-168 行

## 三、修改计划

### 修改 1：TagSelector.vue - 标签选项添加删除按钮

**文件**：[TagSelector.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/TagSelector.vue)

**修改位置**：第 15-25 行

**修改内容**：给每个标签选项添加删除按钮

```vue
<el-option
  v-for="tag in filteredTagList"
  :key="tag.key"
  :label="tag.name"
  :value="tag.key"
>
  <div class="tag-option">
    <span class="tag-dot" :style="{ backgroundColor: tag.color || '#6366f1' }"></span>
    <span class="tag-name">{{ tag.name }}</span>
    <el-icon class="delete-icon" @click.stop="handleDeleteTag(tag)">
      <Delete />
    </el-icon>
  </div>
</el-option>
```

### 修改 2：TagSelector.vue - 引入 Delete 图标

**文件**：[TagSelector.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/TagSelector.vue)

**修改位置**：import 语句区域

**修改内容**：
```javascript
import { Delete } from '@element-plus/icons-vue';
```

### 修改 3：TagSelector.vue - 修改 filteredTagList 过滤已删除标签

**文件**：[TagSelector.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/TagSelector.vue)

**修改位置**：第 88-92 行

**修改内容**：过滤掉已删除的标签

```javascript
const filteredTagList = computed(() => {
  let tags = tagList.value.filter(t => !t.deleted);
  if (!filterText.value.trim()) return tags;
  const keyword = filterText.value.toLowerCase();
  return tags.filter(t => t.name.toLowerCase().includes(keyword));
});
```

### 修改 4：TagSelector.vue - 添加 handleDeleteTag 函数

**文件**：[TagSelector.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/TagSelector.vue)

**修改位置**：在 `handleCreateTagFromFooter` 函数后添加

**修改内容**：

```javascript
async function handleDeleteTag(tag) {
  try {
    await ElMessageBox.confirm(
      `确定要删除标签 "${tag.name}" 吗？删除后笔记中已选该标签的数据将保留，但不能继续使用该标签。`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const tagIndex = tagList.value.findIndex(t => t.key === tag.key);
    if (tagIndex > -1) {
      tagList.value[tagIndex].deleted = true;
      tagList.value[tagIndex].updateTime = moment().format('YYYY-MM-DD HH:mm:ss');

      if (await saveTags(tagList.value)) {
        ElMessage.success('标签已删除');
        emit('tags-updated', tagList.value);
      }
    }
  } catch {
    // 用户取消
  }
}
```

### 修改 5：TagSelector.vue - 引入 ElMessageBox

**文件**：[TagSelector.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/TagSelector.vue)

**修改位置**：import 语句区域

**修改内容**：
```javascript
import { ElMessage, ElMessageBox } from 'element-plus';
```

### 修改 6：TagSelector.vue - 添加删除图标样式

**文件**：[TagSelector.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/TagSelector.vue)

**修改位置**：样式区域，.tag-option 内

**修改内容**：
```scss
.tag-option {
  display: flex;
  align-items: center;
  gap: 8px;

  .tag-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tag-name {
    flex: 1;
  }

  .delete-icon {
    opacity: 0;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    transition: opacity 0.2s;

    &:hover {
      color: #ef4444;
    }
  }

  &:hover .delete-icon {
    opacity: 1;
  }
}
```

### 修改 7：TagSelector.vue - 暴露 deleteTag 方法

**文件**：[TagSelector.vue](file:///c:/cod/electron-vite-vue/src/views/categorizableNotes/TagSelector.vue)

**修改位置**：defineExpose 部分

**修改内容**：
```javascript
defineExpose({
  fetchTags,
  tagList,
  deleteTag: handleDeleteTag
});
```

## 四、验证步骤

1. **删除功能测试**：
   - 打开标签选择器
   - 鼠标悬停在标签上，显示删除图标
   - 点击删除图标，弹出确认框
   - 确认删除后，标签从列表中消失

2. **不可重复使用测试**：
   - 删除标签后，关闭并重新打开选择器
   - 已删除的标签不应出现在列表中

3. **笔记数据保留测试**：
   - 删除标签前，已选择该标签的笔记
   - 删除标签后，笔记列表中该笔记仍显示该标签

4. **新建/编辑笔记测试**：
   - 在新建笔记或编辑笔记时，已删除的标签不可选择

## 五、文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src/views/categorizableNotes/TagSelector.vue` | 修改 | 添加删除按钮、过滤逻辑、确认删除功能 |
