# windowMode 页面排版风格调整计划

## 需求
参照 `setting/index.vue` 的排版风格重新调整 `windowMode/index.vue` 页面。

## 当前状态分析

### setting/index.vue 排版特点
1. 使用 `<layout-vue>` 作为父容器
2. 页面结构：`.setting-page` → `.section` → 各种 `.card`
3. Section 标题：`<h2 class="section-title">` + Element Plus 图标 + 文字，带底边框
4. 卡片样式：`background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-card); padding: 20px;`
5. 卡片有左侧彩色装饰条（通过 `::before` 伪元素）
6. 使用 el-button、el-icon 等 Element Plus 组件

### windowMode/index.vue 当前问题
1. 直接使用 `<div class="window-mode-container">`，缺少 layout-vue 包装
2. 使用 emoji 作为图标，风格不一致
3. 卡片有独立的 `.card-header` 渐变背景，与 setting 风格不同
4. 配置标签使用 emoji + 文字，与 setting 的 section-title 风格不同
5. 使用普通 button 而非 el-button

## 实施步骤

### Step 1: 修改模板结构
- 添加 `<layout-vue>` 父容器
- 添加 `<template #main>` 插槽
- 替换外层容器为 `.setting-page` 类名
- 使用 `.section` 结构组织番茄钟小窗口和笔记本小窗口配置
- 替换 emoji 图标为 Element Plus 图标
- 使用 `<h2 class="section-title">` 作为 section 标题
- 使用 el-button 替代普通 button

### Step 2: 修改样式
- 删除 `.card-header` 样式（不再需要独立头部）
- 修改 `.window-card` 样式，使其与 setting 的卡片样式一致
- 添加左侧彩色装饰条（通过 `::before` 伪元素）
- 修改 `.config-section` 样式，使其与 setting 的 section 风格一致
- 修改 `.config-label` 样式，使其与 setting 的 label 风格一致
- 修改各种卡片样式（position-card、size-card、gap-card、custom-btn），使其与 setting 的按钮风格一致
- 修改模态框样式，使其与 setting 的风格一致

### Step 3: 添加必要的 import
- 导入 Element Plus 图标（Monitor、Notebook、Position、Maximize、Move、X、Plus）
- 导入 LayoutVue 组件

## 文件修改
- `c:\cod\electron-vite-vue\src\views\windowMode\index.vue`

## 验证步骤
1. 运行 `npx tsc --noEmit` 确保 TypeScript 类型检查通过
2. 查看页面效果，确认排版风格与 setting 页面一致