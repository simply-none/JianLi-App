# 窗口模式页面样式优化计划

## 需求
优化 `c:\cod\electron-vite-vue\src\views\windowMode\index.vue` 页面样式：
1. 位置选择在深色背景下看不清边界 - 需要增强对比度
2. 标题（番茄钟小窗口、笔记本小窗口）渐变在深色背景下太夸张鲜艳 - 需要调整使其更契合主题
3. 排查已有的主题变量颜色，确保与主题主色相配

## 当前状态分析

### 已完成工作
已在 `style.scss` 中为 14 个主题添加了 `--card-border` 和 `--header-solid` 变量。

### 需要修复的不协调配色
| 主题 | 主色 | 当前 header-solid | 问题 | 建议修正 |
|------|------|------------------|------|----------|
| nord | #88c0d0 (青色) | #5e81ac (蓝色) | 颜色不匹配 | #4d7c8a |
| one-dark | #e06c75 (红色) | #3e5a7c (蓝色) | 颜色不匹配 | #8a4a50 |
| gruvbox | #fb4934 (红色) | #b16217 (橙色) | 颜色不匹配 | #8a2a1f |

### 待添加变量的主题
- synthwave: 主色 #ff6ec7 (粉色) → header-solid #8a3a6a
- material-dark: 主色 #6200ee (紫色) → header-solid #4a0099
- jellybeans: 主色 #d0d0ff (紫色) → header-solid #6666aa
- tomorrow-night: 主色 #42a5f5 (蓝色) → header-solid #2d6aa0
- cobalt: 主色 #ff6600 (橙色) → header-solid #aa5500
- spacemacs: 主色 #859900 (绿色) → header-solid #6a7d00
- tender: 主色 #f4bf75 (橙色) → header-solid #b5965c
- brackets-dark: 主色 #00a8ff (蓝色) → header-solid #0066aa

## 实施步骤

### Step 1: 修复已添加变量的不协调配色

修改以下主题的 `--header-solid`：
- nord: `--header-solid: #4d7c8a;`
- one-dark: `--header-solid: #8a4a50;`
- gruvbox: `--header-solid: #8a2a1f;`

### Step 2: 在 `style.scss` 中为剩余主题添加新变量

为以下深色主题添加 `--card-border` 和 `--header-solid`：
- synthwave: `--card-border: rgba(255, 255, 255, 0.15); --header-solid: #8a3a6a;`
- material-dark: `--card-border: rgba(255, 255, 255, 0.12); --header-solid: #4a0099;`
- jellybeans: `--card-border: rgba(255, 255, 255, 0.12); --header-solid: #6666aa;`
- tomorrow-night: `--card-border: rgba(255, 255, 255, 0.12); --header-solid: #2d6aa0;`
- cobalt: `--card-border: rgba(255, 255, 255, 0.12); --header-solid: #aa5500;`
- spacemacs: `--card-border: rgba(255, 255, 255, 0.12); --header-solid: #6a7d00;`
- tender: `--card-border: rgba(255, 255, 255, 0.12); --header-solid: #b5965c;`
- brackets-dark: `--card-border: rgba(255, 255, 255, 0.12); --header-solid: #0066aa;`

### Step 3: 修改 `windowMode/index.vue` 样式

1. `.position-card` / `.size-card` / `.gap-card` / `.custom-btn`:
   - 将 `border: 2px solid var(--border-color)` 改为 `border: 2px solid var(--card-border)`

2. `.card-header`:
   - 将 `background: linear-gradient(...)` 改为 `background: var(--header-solid)`

3. `.toggle-btn.active`:
   - 将 `color: var(--header-gradient-from)` 改为 `color: var(--header-solid)`

## 验证步骤
1. 运行 `npx tsc --noEmit` 确保 TypeScript 类型检查通过
2. 切换不同主题，验证位置选择边界清晰可见，标题颜色与主题协调
