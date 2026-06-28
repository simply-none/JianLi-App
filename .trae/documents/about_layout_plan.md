# About 页面排版优化计划

## 一、需求分析

### 1.1 需求概述
将 `src/views/about/index.vue` 页面的排版布局参照 `src/views/setting/index.vue` 重新优化，保持一致的视觉风格和布局结构。

### 1.2 当前状态对比

#### setting/index.vue 结构特点
- 使用 `<layout-vue>` 作为外层容器，内容放在 `<template #main>` 中
- 页面使用 `.setting-page` 类包裹，内含多个 `.section` 区块
- 每个 `.section` 有统一的 `.section-title` 标题（带 LucideIcon 图标 + 底边框）
- 内容使用统一的卡片样式（`.status-card`, `.visual-card`, `.cache-card` 等）
- 卡片样式统一：`var(--bg-card)` 背景、`var(--border-subtle)` 边框、`var(--radius-card)` 圆角

#### about/index.vue 当前结构
- 使用 `.about-container` 直接包裹，没有 layout 组件
- 使用 `.about-card` 卡片，每个卡片有 `.card-header`（带渐变背景图标）和 `.card-content`
- 标题样式与 setting 页面不一致
- AutoUpdate 组件直接放在容器顶部

## 二、优化方案

### 2.1 结构优化
1. **外层容器**：添加 `<layout-vue>` 包裹，内容放在 `<template #main>` 中
2. **页面结构**：使用 `.about-page` 类包裹，内含两个 `.section` 区块
   - Section 1: 关于信息（应用名称、版本、作者、描述）
   - Section 2: 鸣谢（依赖列表标签）
3. **标题样式**：使用 `.section-title` 标题（带 LucideIcon 图标 + 下边框）
4. **AutoUpdate 组件**：保留在页面顶部，包裹在独立的 section 中

### 2.2 组件样式统一
1. **信息卡片**：使用统一的 `.info-card` 样式
2. **鸣谢卡片**：使用统一的 `.thanks-card` 样式
3. **信息项**：保持原有布局，但使用统一的样式变量

### 2.3 保留 About 特色
- 应用信息展示（名称、版本、作者、描述）
- 鸣谢标签展示（依赖列表）
- AutoUpdate 组件

## 三、修改文件

| 文件路径 | 修改类型 | 说明 |
|---------|---------|------|
| `src/views/about/index.vue` | 修改 | 重构模板结构和样式 |

## 四、实施步骤

### 步骤1：重构模板结构
**修改内容**：
- 将 `.about-container` 改为 `<layout-vue>` + `<template #main>`
- 使用 `.about-page` + `.section` 结构
- 添加 `.section-title` 标题（带 LucideIcon 图标）
- 添加 LayoutVue 组件导入

### 步骤2：更新样式
**修改内容**：
- 移除旧的 `.about-container`, `.about-card`, `.card-header`, `.card-content` 样式
- 添加 `.about-page`, `.section`, `.section-title` 样式
- 添加 `.info-card`, `.thanks-card` 卡片样式
- 更新 `.info-item`, `.thanks-tags`, `.thanks-tag` 样式

## 五、代码变更预览

### 模板结构变更
```vue
<template>
  <layout-vue>
    <template #main>
      <div class="about-page">
        <!-- AutoUpdate 组件 -->
        <div class="section">
          <AutoUpdate />
        </div>

        <!-- Section 1: 关于信息 -->
        <div class="section">
          <h2 class="section-title">
            <LucideIcon name="BadgeInfo" />
            关于
          </h2>
          <div class="info-card">
            <div class="info-item">
              <span class="info-icon">📝</span>
              <span class="info-label">应用名称</span>
              <span class="info-value">{{ packageJson.name }}</span>
            </div>
            <div class="info-item">
              <span class="info-icon">📊</span>
              <span class="info-label">版本</span>
              <span class="info-value">{{ packageJson.version }}</span>
            </div>
            <div class="info-item">
              <span class="info-icon">👤</span>
              <span class="info-label">应用作者</span>
              <span class="info-value">{{ packageJson.author }}</span>
            </div>
            <div class="info-item">
              <span class="info-icon">📄</span>
              <span class="info-label">应用描述</span>
              <span class="info-value">{{ packageJson.description }}</span>
            </div>
          </div>
        </div>

        <!-- Section 2: 鸣谢 -->
        <div class="section">
          <h2 class="section-title">
            <LucideIcon name="Coins" />
            鸣谢
          </h2>
          <div class="thanks-card">
            <div class="thanks-intro">（排名不分先后）</div>
            <div class="thanks-tags">
              <span v-for="(value, key) in thanks" :key="key" class="thanks-tag">
                {{ value }}
              </span>
            </div>
          </div>
        </div>
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

.about-page {
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
    }
  }

  .info-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-light);

    &:last-child {
      border-bottom: none;
    }

    .info-icon {
      font-size: 16px;
      width: 24px;
      text-align: center;
    }

    .info-label {
      font-size: 14px;
      color: var(--text-secondary);
      min-width: 80px;
    }

    .info-value {
      font-size: 14px;
      color: var(--text-primary);
      flex: 1;
      font-weight: 500;
    }
  }

  .thanks-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px;
  }

  .thanks-intro {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .thanks-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .thanks-tag {
    padding: 4px 10px;
    background: var(--tag-bg-info);
    color: var(--color-primary);
    border-radius: 4px;
    font-size: 12px;
    border: 1px solid var(--border-subtle);
  }
}
```

## 六、验证方案

1. **TypeScript 类型检查**：执行 `npx tsc --noEmit`
2. **视觉效果验证**：确认页面结构与 setting 页面一致，特色内容保留

## 七、依赖关系

- **新增导入**：`LayoutVue` 组件
- **现有依赖**：Vue 3、TypeScript