# 剪切板页面样式优化计划

## 一、需求概述

参考主流网站样式，优化剪贴板历史页面的布局和样式，同时支持主题切换效果。

## 二、当前状态分析

### 现有问题
1. 使用废弃的 `v-infinite-scroll` 指令
2. 布局结构简单，使用 `el-form` + `el-timeline` 组合不够现代
3. 样式硬编码（如 `background: rgba(255, 255, 255, 0.9)`），不支持主题切换
4. 视觉层次不清晰，缺少适当的间距和阴影
5. 搜索栏和内容区布局不够灵活

### 项目主题系统
项目使用 CSS 变量实现主题切换，关键变量：
- `--bg-base` / `--bg-card` - 背景色
- `--text-primary` / `--text-secondary` / `--text-muted` - 文字色
- `--color-primary` / `--color-primary-light` - 主题色
- `--border-subtle` - 边框色
- `--radius-card` / `--radius-btn` - 圆角
- `--shadow-card` - 阴影

## 三、修改计划

### 修改 1：重构页面结构

**文件**：[clipboard/index.vue](file:///c:/cod/electron-vite-vue/src/views/clipboard/index.vue)

**修改内容**：使用现代化布局结构
- 顶部标题栏（标题 + 清空按钮）
- 工具栏（搜索框 + 查询按钮 + 重置按钮）
- 内容区（卡片列表，支持滚动加载）

```vue
<div class="clipboard-page">
  <div class="clipboard-header">
    <div class="clipboard-title">
      <h2>剪贴板历史</h2>
      <p>记录您的复制历史，随时查看和管理</p>
    </div>
    <el-button type="danger" @click="clearAll">
      <el-icon><Delete /></el-icon>
      清空全部
    </el-button>
  </div>
  
  <div class="clipboard-toolbar">
    <div class="search-box">
      <el-icon class="search-icon"><Search /></el-icon>
      <el-input v-model="searchKey" placeholder="搜索剪贴板内容..." clearable />
    </div>
    <div class="toolbar-actions">
      <el-button type="primary" @click="search">查询</el-button>
      <el-button @click="refresh">重置</el-button>
    </div>
  </div>
  
  <div class="clipboard-content">
    <el-scrollbar ref="scrollbarRef" class="content-scrollbar" @scroll="handleScroll">
      <div v-if="clipboardItems.length === 0" class="empty-state">
        <el-empty description="暂无剪贴板记录" />
      </div>
      <div v-else class="content-list">
        <div
          v-for="(item, index) in clipboardItems"
          :key="item.id || index"
          class="clipboard-card"
        >
          <div class="card-content">
            <el-input spellcheck="false" v-model="item.text" type="textarea" :autosize="{ minRows: 2, maxRows: 10 }" />
          </div>
          <div class="card-footer">
            <span class="card-time">{{ formatTime(item.create_time) }}</span>
            <div class="card-actions">
              <el-button type="primary" size="small" @click="copyToClipboard(item.text)">
                <el-icon><Copy /></el-icon>
                复制
              </el-button>
              <el-button type="danger" size="small" @click="deleteClipboardItem(item)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="loading" class="loading-state">
        <el-loading text="加载中..." />
      </div>
    </el-scrollbar>
  </div>
</div>
```

### 修改 2：替换 v-infinite-scroll 为 el-scrollbar

**文件**：[clipboard/index.vue](file:///c:/cod/electron-vite-vue/src/views/clipboard/index.vue)

**修改内容**：
```javascript
const scrollbarRef = ref(null);
const loading = ref(false);
const hasMore = ref(true);

function handleScroll() {
  const scrollbar = scrollbarRef.value;
  if (!scrollbar) return;
  
  const wrap = scrollbar.wrapRef;
  if (!wrap) return;
  
  const { scrollTop, scrollHeight, clientHeight } = wrap;
  const distance = 100;
  
  if (scrollTop + clientHeight + distance >= scrollHeight) {
    if (!loading.value && hasMore.value) {
      loadMore();
    }
  }
}

function loadMore() {
  loading.value = true;
  getClipboardHistory().then(res => {
    clipboardItems.value.push(...res);
    currentPage.value++;
    hasMore.value = res.length >= pageSize.value;
    loading.value = false;
  });
}
```

### 修改 3：添加时间格式化和清空功能

**文件**：[clipboard/index.vue](file:///c:/cod/electron-vite-vue/src/views/clipboard/index.vue)

**修改内容**：
```javascript
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Delete, Copy } from '@element-plus/icons-vue';
import moment from 'moment';

function formatTime(time) {
  if (!time) return '--';
  const now = moment();
  const itemTime = moment(time);
  const diffDays = now.diff(itemTime, 'days');
  
  if (diffDays === 0) {
    return itemTime.format('HH:mm:ss');
  } else if (diffDays === 1) {
    return '昨天 ' + itemTime.format('HH:mm');
  } else if (diffDays < 7) {
    return diffDays + '天前';
  } else {
    return itemTime.format('YYYY-MM-DD HH:mm');
  }
}

async function clearAll() {
  try {
    await ElMessageBox.confirm('确定要清空所有剪贴板记录吗？此操作不可恢复。', '确认清空', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning'
    });
    
    const result = await window.ipcRenderer.handlePromise('delete-data', {
      tableName: 'clipboard_history',
      condition: {}
    });
    
    if (result.success) {
      ElMessage.success('已清空剪贴板历史');
      clipboardItems.value = [];
      currentPage.value = 1;
      hasMore.value = true;
    }
  } catch {
    // 用户取消
  }
}
```

### 修改 4：添加主题适配样式

**文件**：[clipboard/index.vue](file:///c:/cod/electron-vite-vue/src/views/clipboard/index.vue)

**修改内容**：
```scss
.clipboard-page {
  width: 100%;
  height: 100%;
  background: var(--bg-base);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
  box-sizing: border-box;
}

.clipboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  .clipboard-title {
    h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
    }
    
    p {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--text-muted);
    }
  }
}

.clipboard-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 12px 16px;
  gap: 12px;
  
  .search-box {
    flex: 1;
    max-width: 400px;
    position: relative;
    
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 16px;
      z-index: 1;
    }
    
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
  
  .toolbar-actions {
    display: flex;
    gap: 8px;
    
    .el-button + .el-button {
      margin-left: 0 !important;
    }
  }
}

.clipboard-content {
  flex: 1;
  min-height: 0;
  
  .content-scrollbar {
    height: 100%;
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.content-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;
}

.clipboard-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 16px;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-card);
  }
  
  .card-content {
    :deep(.el-textarea__inner) {
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-btn);
      color: var(--text-primary);
      font-size: 14px;
      line-height: 1.6;
      
      &:hover {
        border-color: var(--color-primary);
      }
      
      &:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 1px var(--color-primary) inset;
      }
    }
  }
  
  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 12px;
    margin-top: 12px;
    border-top: 1px solid var(--border-subtle);
    
    .card-time {
      font-size: 12px;
      color: var(--text-muted);
    }
    
    .card-actions {
      display: flex;
      gap: 8px;
    }
  }
}

.loading-state {
  text-align: center;
  padding: 16px;
}
```

### 修改 5：更新 query-data 调用方式

**文件**：[clipboard/index.vue](file:///c:/cod/electron-vite-vue/src/views/clipboard/index.vue)

**修改内容**：将 `whereStr` 改为 `SqlStr`，避免 SQL 语法错误
```javascript
function getClipboardHistory() {
  const offset = (currentPage.value - 1) * pageSize.value;
  
  return window.ipcRenderer.handlePromise('query-data', {
    tableName: 'clipboard_history',
    conditions: {
      SqlStr: `SELECT * FROM clipboard_history WHERE text LIKE '%${searchKey.value}%' ORDER BY create_time DESC LIMIT ${pageSize.value} OFFSET ${offset}`,
    }
  }).then(result => {
    if (result.success) {
      return result.data || [];
    }
    return [];
  }).catch(err => {
    console.log('查询失败:', err);
    return [];
  });
}
```

## 四、验证步骤

1. **主题切换测试**：
   - 切换不同主题，页面颜色应正确变化
   - 卡片背景、文字颜色、边框颜色应随主题调整

2. **滚动加载测试**：
   - 滚动到底部应自动加载更多数据
   - 没有更多数据时应停止加载

3. **搜索功能测试**：
   - 输入关键词点击查询，结果应正确过滤
   - 点击重置按钮应清空搜索条件

4. **清空功能测试**：
   - 点击清空全部按钮应弹出确认框
   - 确认后应清空所有记录

5. **复制/删除测试**：
   - 复制按钮应正常工作
   - 删除按钮应正常工作

## 五、文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src/views/clipboard/index.vue` | 修改 | 重构布局、样式优化、主题适配、滚动加载 |
