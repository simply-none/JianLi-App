# 资源管理页面排版优化计划

## 一、需求分析

### 1.1 需求概述
优化 `src/views/resourceManage/index.vue` 资源管理页面的组件排版，使其与 `src/views/setting/index.vue` 页面的组件结构排版一致，同时保留资源管理自身的特色排版。

### 1.2 当前状态对比

#### setting/index.vue 结构特点
- 使用 `<layout-vue>` 作为外层容器，内容放在 `<template #main>` 中
- 页面使用 `.setting-page` 类包裹，内含多个 `.section` 区块
- 每个 `.section` 有统一的 `.section-title` 标题（带 LucideIcon 图标 + 底边框）
- 内容使用统一的卡片样式（`.status-card`, `.visual-card`, `.cache-card` 等）
- 卡片样式统一：`var(--bg-card)` 背景、`var(--border-subtle)` 边框、`var(--radius-card)` 圆角

#### resourceManage/index.vue 当前结构
- 使用 `<el-form>` 直接包裹，没有 layout 组件
- 使用 `el-form-item` 组织内容，层级不够清晰
- 标题使用 `.setting-title`，样式与 setting 页面不一致
- 文件列表使用 `.file-list` grid 布局（这是特色设计，需保留）
- 卡片 `.file-card` 有特色设计，但基础样式不统一

## 二、排版设计方案

### 2.1 页面整体布局结构

```
┌─────────────────────────────────────────────────────────────┐
│ layout-vue (外层容器)                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ #main (主内容区域)                                        │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ .resource-page (页面容器)                             │ │ │
│ │ │                                                       │ │ │
│ │ │ ┌─────────────────────────────────────────────────┐ │ │ │
│ │ │ │ .section (上传文件区块)                          │ │ │ │
│ │ │ │ ┌─────────────────────────────────────────────┐ │ │ │ │
│ │ │ │ │ .section-title                              │ │ │ │ │
│ │ │ │ │ [图标] 上传文件                              │ │ │ │ │
│ │ │ │ └─────────────────────────────────────────────┘ │ │ │ │
│ │ │ │ ┌─────────────────────────────────────────────┐ │ │ │ │
│ │ │ │ │ .upload-card (上传区域卡片)                  │ │ │ │ │
│ │ │ │ │ [拖拽上传区域 + 操作按钮]                     │ │ │ │ │
│ │ │ │ └─────────────────────────────────────────────┘ │ │ │ │
│ │ │ └─────────────────────────────────────────────────┘ │ │ │
│ │ │                                                       │ │ │
│ │ │ ┌─────────────────────────────────────────────────┐ │ │ │
│ │ │ │ .section (文件列表区块)                          │ │ │ │
│ │ │ │ ┌─────────────────────────────────────────────┐ │ │ │ │
│ │ │ │ │ .section-title                              │ │ │ │ │
│ │ │ │ │ [图标] 文件列表                              │ │ │ │ │
│ │ │ │ └─────────────────────────────────────────────┘ │ │ │ │
│ │ │ │ ┌─────────────────────────────────────────────┐ │ │ │ │
│ │ │ │ │ .file-list-card (文件列表卡片)               │ │ │ │ │
│ │ │ │ │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │ │ │ │ │
│ │ │ │ │ │file- │ │file- │ │file- │ │file- │ ...      │ │ │ │ │
│ │ │ │ │ │card  │ │card  │ │card  │ │card  │          │ │ │ │ │
│ │ │ │ │ └──────┘ └──────┘ └──────┘ └──────┘          │ │ │ │ │
│ │ │ │ │ (grid 布局, 自适应列数)                       │ │ │ │ │
│ │ │ │ └─────────────────────────────────────────────┘ │ │ │ │
│ │ │ └─────────────────────────────────────────────────┘ │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Section 区块设计

每个 section 区块采用统一的设计规范：

| 属性 | 值 | 说明 |
|-----|-----|------|
| 区块间距 | `margin-bottom: 28px` | section 之间的垂直间距 |
| 标题字号 | `font-size: 16px` | section-title 字号 |
| 标题字重 | `font-weight: 600` | section-title 字重 |
| 标题颜色 | `var(--text-primary)` | 标题文字颜色 |
| 标题图标间距 | `gap: 10px` | 图标与文字间距 |
| 标题下边距 | `margin-bottom: 16px` | 标题与内容间距 |
| 标题下边框 | `border-bottom: 2px solid var(--color-primary)` | 主色下边框 |
| 标题内边距 | `padding-bottom: 10px` | 标题下方内边距 |

### 2.3 上传区域卡片设计 (.upload-card)

| 属性 | 值 | 说明 |
|-----|-----|------|
| 背景 | `var(--bg-card)` | 卡片背景色 |
| 边框 | `1px solid var(--border-subtle)` | 边框样式 |
| 圆角 | `var(--radius-card)` | 卡片圆角 |
| 内边距 | `padding: 20px` | 卡片内边距 |
| 悬停效果 | `border-color: var(--color-primary)` + `box-shadow: var(--shadow-card)` | hover 边框变色 + 阴影 |

上传组件内部样式（由 UploadVue 组件提供）：
- 拖拽区域：Element Plus upload 拖拽样式
- 提示文字：`支持上传图片、文本、视频、音频及其他文件格式`
- 操作按钮：保存按钮、清空按钮

### 2.4 文件列表卡片设计 (.file-list-card)

| 属性 | 值 | 说明 |
|-----|-----|------|
| 背景 | `var(--bg-card)` | 卡片背景色 |
| 边框 | `1px solid var(--border-subtle)` | 边框样式 |
| 圆角 | `var(--radius-card)` | 卡片圆角 |
| 内边距 | `padding: 20px` | 卡片内边距 |

文件列表 grid 布局 (.file-list)：
| 属性 | 值 | 说明 |
|-----|-----|------|
| 布局 | `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))` | 自适应列数 |
| 卡片间距 | `gap: 16px` | 文件卡片间距 |
| 宽度 | `width: 100%` | 全宽 |

### 2.5 文件卡片设计 (.file-card)

**保留资源管理特色设计**：

| 属性 | 值 | 说明 |
|-----|-----|------|
| 背景 | `var(--bg-base)` | 卡片背景色（比外层卡片浅） |
| 边框 | `1px solid var(--border-subtle)` | 边框样式 |
| 圆角 | `var(--radius-card)` | 卡片圆角 |
| 悬停效果 | `transform: translateY(-2px)` + `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1)` | 上浮 + 阴影 |
| 布局 | `flex-direction: column` | 垂直排列 |

**预览区域 (.file-preview)**：
| 属性 | 值 | 说明 |
|-----|-----|------|
| 高度 | `height: 120px` | 预览区域高度 |
| 背景 | `var(--bg-base)` | 预览区域背景 |
| 图片适应 | `object-fit: cover` | 图片覆盖方式 |

**文件信息区域 (.file-info)**：
| 属性 | 值 | 说明 |
|-----|-----|------|
| 内边距 | `padding: 12px` | 信息区域内边距 |
| 布局 | `flex-direction: column` + `gap: 6px` | 垂直排列 |

**文件名 (.file-name)**：
| 属性 | 值 | 说明 |
|-----|-----|------|
| 字号 | `font-size: 0.86rem` (~13.76px) | 文件名字号 |
| 字重 | `font-weight: 500` | 字重 |
| 颜色 | `var(--text-primary)` | 文字颜色 |
| 溢出处理 | `white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis` | 单行显示 |

**文件类型标签 (.file-type)**：
| 属性 | 值 | 说明 |
|-----|-----|------|
| 内边距 | `padding: 2px 8px` | 标签内边距 |
| 圆角 | `border-radius: 4px` | 标签圆角 |
| 字重 | `font-weight: 500` | 字重 |

各类型标签颜色：
| 类型 | 背景色 | 文字色 |
|-----|--------|--------|
| 图片 (image) | `rgba(99, 102, 241, 0.1)` | `var(--color-primary)` |
| 视频 (video) | `rgba(239, 68, 68, 0.1)` | `#ef4444` |
| 音频 (audio) | `rgba(139, 92, 246, 0.1)` | `#8b5cf6` |
| 文本 (text) | `rgba(34, 197, 94, 0.1)` | `#22c55e` |
| PDF | `rgba(239, 68, 68, 0.1)` | `#ef4444` |
| 字体 (font) | `rgba(245, 158, 11, 0.1)` | `#f59e0b` |
| 压缩包 (archive) | `rgba(6, 182, 212, 0.1)` | `#06b6d4` |
| 文档 (document) | `rgba(59, 130, 246, 0.1)` | `#3b82f6` |
| 其他 (other) | `rgba(156, 163, 175, 0.1)` | `var(--text-muted)` |

**操作按钮区域 (.file-actions)**：
| 属性 | 值 | 说明 |
|-----|-----|------|
| 内边距 | `padding: 0 12px 12px` | 底部内边距 |
| 布局 | `display: flex` + `gap: 8px` | 横向排列 |
| 按钮 | `flex: 1` | 每个按钮等宽 |

### 2.6 预览对话框设计 (el-dialog)

| 属性 | 值 | 说明 |
|-----|-----|------|
| 宽度 | `width="80%"` | 对话框宽度 |
| 位置 | `top="5vh"` | 顶部偏移 |
| 内容区域 | `.preview-content` | 预览内容容器 |
| 内容内边距 | `padding: 20px` | 内容内边距 |
| 最大高度 | `max-height: 70vh` | 内容最大高度 |

预览内容样式：
| 类型 | 样式 |
|-----|------|
| 图片 | `fit="contain"` + `max-height: 70vh` |
| 视频 | `max-width: 100%` + `max-height: 70vh` + `controls` |
| 音频 | `width: 100%` + `controls` |
| 文本 | `.text-preview` 样式（背景、内边距、圆角） |
| PDF | iframe + `width: 100%` + `height: 70vh` |
| 其他 | `.other-preview` 样式（居中、图标、提示） |

## 三、修改文件

| 文件路径 | 修改类型 | 说明 |
|---------|---------|------|
| `src/views/resourceManage/index.vue` | 修改 | 重构模板结构和样式 |

## 四、实施步骤

### 步骤1：重构模板结构
**修改内容**：
- 将 `<el-form>` 改为 `<layout-vue>` + `<template #main>`
- 使用 `.resource-page` + `.section` 结构
- 添加 `.section-title` 标题（带 LucideIcon 图标）
- 导入 LayoutVue 和 LucideIcon 组件

### 步骤2：更新样式
**修改内容**：
- 移除旧的 `.setting-title` 和 `.fileRela-form` 样式
- 添加 `.resource-page`、`.section`、`.section-title` 样式
- 添加 `.upload-card` 和 `.file-list-card` 卡片样式
- 更新 `.file-card` 基础样式变量
- 保留 `.file-list` grid 布局和文件类型标签样式

## 五、完整代码变更

### 模板结构变更
```vue
<template>
  <layout-vue>
    <template #main>
      <div class="resource-page">
        <!-- Section 1: 上传文件 -->
        <div class="section">
          <h2 class="section-title">
            <LucideIcon name="UploadCloud" />
            上传文件
          </h2>
          <div class="upload-card">
            <UploadVue :limit="10" :multiply="true" @updateData="handleChange" />
          </div>
        </div>

        <!-- Section 2: 文件列表 -->
        <div class="section">
          <h2 class="section-title">
            <LucideIcon name="FolderOpen" />
            文件列表
          </h2>
          <div class="file-list-card">
            <div class="file-list" v-if="imageResourceCc.length > 0">
              <div v-for="(file, index) in imageResourceCc" :key="index" class="file-card" @click="previewFile(file)">
                <div class="file-preview">
                  <el-image v-if="getFileType(file.origin) === 'image'" :src="fileProtocol + file.val" fit="cover" lazy />
                  <FileIcon v-else :type="getFileType(file.origin)" :size="64" />
                </div>
                <div class="file-info">
                  <div class="file-name">{{ file.origin }}</div>
                  <div class="file-meta">
                    <span class="file-type" :class="getFileType(file.origin)">{{ getFileTypeLabel(file.origin) }}</span>
                  </div>
                </div>
                <div class="file-actions">
                  <el-button size="small" type="primary" @click.stop="openFileLocation(file)">打开位置</el-button>
                  <el-button size="small" type="danger" @click.stop="deleteFile(file, index as number)">删除</el-button>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <el-empty description="暂无上传文件" />
            </div>
          </div>
        </div>

        <!-- 预览对话框 -->
        <el-dialog v-model="previewVisible" :title="previewTitle" width="80%" top="5vh">
          <!-- 预览内容保持不变 -->
        </el-dialog>
      </div>
    </template>
  </layout-vue>
</template>
```

### Script 变更
```typescript
import LayoutVue from '@/components/layout.vue';
import LucideIcon from '@/components/LucideIcon.vue';
// 其他导入保持不变
```

### 样式变更
```scss
:deep(.main) {
  padding: 0 !important;
}

.resource-page {
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;

  .section {
    margin-bottom: 28px;

    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--color-primary);

      .el-icon {
        color: var(--color-primary);
      }
    }
  }

  .upload-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-card);
    }
  }

  .file-list-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px;
  }

  .file-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
    width: 100%;
  }

  .file-card {
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex;
    flex-direction: column;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
  }

  // 其他样式保持不变...
}
```

## 六、验证方案

1. **TypeScript 类型检查**：执行 `npx tsc --noEmit`
2. **视觉效果验证**：确认页面结构与 setting 页面一致，特色样式保留

## 七、依赖关系

- **新增导入**：`LayoutVue` 组件、`LucideIcon` 组件
- **现有依赖**：Element Plus、Vue 3