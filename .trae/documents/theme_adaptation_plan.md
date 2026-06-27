# 页面主题适配计划

## 需求分析

为 `windowMode/index.vue`、`registerShortcut/index.vue`、`about/index.vue` 及其内部组件添加主题切换支持。

**关键要求**：
1. 缺失的样式变量分类定义到各个主题中
2. 每个主题中新增的样式变量值都要与该主题的整体风格协调搭配
3. **已有的主题变量不修改、不删除，只新增**

## 研究结论

### 主题系统原理

项目使用 `data-theme` 属性在 `html` 根元素上切换主题，通过 CSS 变量控制各种颜色。主题切换逻辑在 `App.vue` 中实现。

### 现有全局 CSS 变量（不修改、不删除）

**背景色：** `--bg-base`、`--bg-card`、`--bg-sidebar`
**文字色：** `--text-primary`、`--text-secondary`、`--text-muted`
**主题色：** `--color-primary`、`--color-primary-light`、`--color-primary-hover`、`--color-primary-solid`
**交互色：** `--bg-hover`、`--bg-active-btn`、`--bg-active-btn-hover`
**边框/分隔线：** `--border-subtle`、`--border-group`
**圆角：** `--radius-card`、`--radius-btn`
**阴影：** `--shadow-card`、`--shadow-top`
**滚动条：** `--scrollbar-thumb`、`--scrollbar-thumb-hover`
**状态行背景：** `--status-work-bg`、`--status-rest-bg`、`--status-screen-bg`
**Logo 渐变：** `--logo-gradient-from`、`--logo-gradient-to`、`--logo-shadow`
**Element Plus 变量：** 一整套 `--el-*` 变量

> ⚠️ 以上所有已有变量保持不变，本计划只新增变量

## 需要新增的 CSS 变量（按类别）

### 类别 1：渐变头部
- `--header-gradient-from` - 渐变起始色
- `--header-gradient-to` - 渐变结束色
- **用途**：页面顶部标题栏、卡片头部

### 类别 2：功能状态色
- `--color-success` - 成功色
- `--color-warning` - 警告色
- `--color-error` - 错误色
- `--color-info` - 信息色
- **用途**：标签、状态指示

### 类别 3：标签背景色
- `--tag-bg-info` - 信息标签背景
- `--tag-bg-success` - 成功标签背景
- `--tag-bg-warning` - 警告标签背景
- `--tag-bg-danger` - 危险标签背景

### 类别 4：输入框样式
- `--input-bg` - 输入框背景
- `--input-border` - 输入框边框
- `--input-border-focus` - 输入框聚焦边框

### 类别 5：快捷键图标渐变色（8种）
- `--icon-blue-from` / `--icon-blue-to`
- `--icon-green-from` / `--icon-green-to`
- `--icon-purple-from` / `--icon-purple-to`
- `--icon-orange-from` / `--icon-orange-to`
- `--icon-yellow-from` / `--icon-yellow-to`
- `--icon-cyan-from` / `--icon-cyan-to`
- `--icon-red-from` / `--icon-red-to`
- `--icon-pink-from` / `--icon-pink-to`
- **用途**：快捷键注册页面的 8 个功能图标

### 类别 6：进度条背景
- `--progress-bg` - 进度条背景色

## 各主题新增变量配色方案

以下为各主题中**新增**变量的具体色值，均与各主题已有配色协调，不修改任何已有变量。

### 1. Light 浅色主题 (:root) — 新增变量
```
渐变头部: #6366f1 → #8b5cf6  (靛蓝→紫，与已有 --color-primary 一致)
状态色:   success=#10b981, warning=#f59e0b, error=#ef4444, info=#3b82f6
标签背景: info=#ecf5ff, success=#f0fdf4, warning=#fffbeb, danger=#fef2f2
输入框:   bg=#fff, border=#dcdfe6, focus=#6366f1
图标渐变: 蓝(#4facfe→#00f2fe), 绿(#43e97b→#38f9d7), 紫(#a8edea→#fed6e3),
          橙(#fa709a→#fee140), 黄(#f093fb→#f5576c), 青(#4facfe→#00f2fe),
          红(#ff9a9e→#fecfef), 粉(#ffecd2→#fcb69f)
进度条:   rgba(0,0,0,0.1)
```

### 2. Dark / Tokyo Night 深色主题 — 新增变量
```
渐变头部: #7aa2f7 → #bb9af7  (蓝→紫，与已有 --color-primary 协调)
状态色:   success=#9ece6a, warning=#e0af68, error=#f7768e, info=#7aa2f7
标签背景: info=rgba(122,162,247,0.15), success=rgba(158,206,106,0.15),
          warning=rgba(224,175,104,0.15), danger=rgba(247,118,142,0.15)
输入框:   bg=#1f2335, border=#3b4261, focus=#7aa2f7
图标渐变: 蓝(#7aa2f7→#2ac3de), 绿(#9ece6a→#73daca), 紫(#bb9af7→#c0caf5),
          橙(#ff9e64→#f7768e), 黄(#e0af68→#ff9e64), 青(#2ac3de→#7dcfff),
          红(#f7768e→#ff007c), 粉(#ff007c→#d700de)
进度条:   rgba(255,255,255,0.1)
```

### 3. Midnight 午夜主题 (GitHub Dimmed) — 新增变量
```
渐变头部: #539bf5 → #6cb6ff  (蓝色系，与已有 --color-primary 协调)
状态色:   success=#57ab5a, warning=#d29922, error=#f85149, info=#539bf5
标签背景: info=rgba(83,155,245,0.15), success=rgba(87,171,90,0.15),
          warning=rgba(210,153,34,0.15), danger=rgba(248,81,73,0.15)
输入框:   bg=#1a1f26, border=#444c56, focus=#539bf5
图标渐变: 蓝(#539bf5→#6cb6ff), 绿(#57ab5a→#6bc46d), 紫(#b083f0→#dcbdfb),
          橙(#e0823d→#f0883e), 黄(#d29922→#eac54f), 青(#39c5cf→#56d4dd),
          红(#f85149→#ff7b72), 粉(#db61a2→#f778ba)
进度条:   rgba(255,255,255,0.08)
```

### 4. Nord 北极主题 — 新增变量
```
渐变头部: #88c0d0 → #81a1c1  (青蓝→蓝，与已有 --color-primary 协调)
状态色:   success=#a3be8c, warning=#ebcb8b, error=#bf616a, info=#88c0d0
标签背景: info=rgba(136,192,208,0.15), success=rgba(163,190,140,0.15),
          warning=rgba(235,203,139,0.15), danger=rgba(191,97,106,0.15)
输入框:   bg=#2b303b, border=#4c566a, focus=#88c0d0
图标渐变: 蓝(#88c0d0→#81a1c1), 绿(#a3be8c→#8fbcbb), 紫(#b48ead→#d08770),
          橙(#d08770→#bf616a), 黄(#ebcb8b→#eceff4), 青(#8fbcbb→#88c0d0),
          红(#bf616a→#d08770), 粉(#d08770→#b48ead)
进度条:   rgba(255,255,255,0.08)
```

### 5. One Dark 主题 — 新增变量
```
渐变头部: #e06c75 → #c678dd  (红→紫，与已有 --color-primary 协调)
状态色:   success=#98c379, warning=#e5c07b, error=#e06c75, info=#61afef
标签背景: info=rgba(97,175,239,0.15), success=rgba(152,195,121,0.15),
          warning=rgba(229,192,123,0.15), danger=rgba(224,108,117,0.15)
输入框:   bg=#282c34, border=#4b5263, focus=#e06c75
图标渐变: 蓝(#61afef→#56b6c2), 绿(#98c379→#56b6c2), 紫(#c678dd→#e06c75),
          橙(#d19a66→#e5c07b), 黄(#e5c07b→#d19a66), 青(#56b6c2→#61afef),
          红(#e06c75→#be5046), 粉(#c678dd→#e06c75)
进度条:   rgba(255,255,255,0.08)
```

### 6. Dracula 主题 — 新增变量
```
渐变头部: #ff79c6 → #bd93f9  (粉→紫，与已有 --color-primary 协调)
状态色:   success=#50fa7b, warning=#f1fa8c, error=#ff5555, info=#8be9fd
标签背景: info=rgba(139,233,253,0.15), success=rgba(80,250,123,0.15),
          warning=rgba(241,250,140,0.15), danger=rgba(255,85,85,0.15)
输入框:   bg=#282a36, border=#6272a4, focus=#ff79c6
图标渐变: 蓝(#8be9fd→#6272a4), 绿(#50fa7b→#8be9fd), 紫(#bd93f9→#ff79c6),
          橙(#ffb86c→#ff79c6), 黄(#f1fa8c→#50fa7b), 青(#8be9fd→#50fa7b),
          红(#ff5555→#ff79c6), 粉(#ff79c6→#bd93f9)
进度条:   rgba(255,255,255,0.1)
```

### 7. GitHub Dark 主题 — 新增变量
```
渐变头部: #58a6ff → #79c0ff  (蓝色系，与已有 --color-primary 协调)
状态色:   success=#3fb950, warning=#d29922, error=#f85149, info=#58a6ff
标签背景: info=rgba(88,166,255,0.15), success=rgba(63,185,80,0.15),
          warning=rgba(210,153,34,0.15), danger=rgba(248,81,73,0.15)
输入框:   bg=#161b22, border=#30363d, focus=#58a6ff
图标渐变: 蓝(#58a6ff→#79c0ff), 绿(#3fb950→#56d364), 紫(#a371f7→#bc8cff),
          橙(#db6d28→#f0883e), 黄(#d29922→#e3b341), 青(#39c5cf→#56d4dd),
          红(#f85149→#ff7b72), 粉(#db61a2→#f778ba)
进度条:   rgba(255,255,255,0.08)
```

### 8. 其余 17 个主题 — 新增变量
Solarized、Gruvbox、Catppuccin (2个)、Ayu (2个)、Monokai、Synthwave、Material Dark、Jellybeans、Tomorrow Night、Atom One Light、Cobalt、Spacemacs、Tender、Brackets Dark 共 17 个主题。

每个主题都按相同变量类别新增配色，配色方案与各主题已有主色、背景色协调。

## 需要修改的文件

1. `src/style.scss` - 在所有主题中**新增** CSS 变量（不修改已有变量）
2. `src/views/windowMode/index.vue` - 窗口模式设置页面
3. `src/views/registerShortcut/index.vue` - 快捷键注册页面
4. `src/views/about/index.vue` - 关于页面
5. `src/views/about/autoUpdate.vue` - 自动更新组件

## 实施步骤

### 第一阶段：在 style.scss 中为所有主题新增变量

**步骤 1.1** 在 `:root` 中新增 6 类变量（浅色默认值）
**步骤 1.2** 为 24 个主题逐一新增相同变量，配色与各主题风格协调
**步骤 1.3** 新增变量按类别分组，添加注释便于维护
**步骤 1.4** 验证：已有变量无任何修改或删除

### 第二阶段：改造 windowMode/index.vue 样式

将页面中的硬编码颜色全部替换为 CSS 变量：
- 页面容器背景 → `var(--bg-base)`
- 卡片背景 → `var(--bg-card)`，阴影 → `var(--shadow-card)`
- 卡片头部渐变 → 使用新增渐变变量
- 标题文字 → `var(--text-primary)`
- 次级文字 → `var(--text-secondary)`
- 边框/分隔线 → `var(--border-subtle)`
- 按钮选中态 → `var(--color-primary)`
- 按钮默认背景 → `var(--bg-hover)`
- 输入框样式 → 使用新增变量
- 弹窗样式 → 使用新增变量

### 第三阶段：改造 registerShortcut/index.vue 样式

将页面中的硬编码颜色全部替换为 CSS 变量：
- 页面背景 → `var(--bg-base)`
- 页面头部渐变 → 使用新增渐变变量
- 卡片背景 → `var(--bg-card)`，阴影 → `var(--shadow-card)`
- 卡片标题 → `var(--text-primary)`
- 卡片描述 → `var(--text-secondary)`
- 分隔线 → `var(--border-subtle)`
- 图标颜色 → 使用新增的 8 种图标渐变变量
- 使用说明卡片 → `var(--bg-card)`
- 使用说明文字 → `var(--text-secondary)`
- tips 卡片左侧边框 → `var(--color-primary)`

### 第四阶段：改造 about/index.vue 样式

将页面中的硬编码颜色全部替换为 CSS 变量：
- 页面背景 → `var(--bg-base)`
- 卡片背景 → `var(--bg-card)`，阴影 → `var(--shadow-card)`
- 卡片头部渐变 → 使用新增渐变变量
- 标签文字 → `var(--text-secondary)`
- 值文字 → `var(--text-primary)`
- 分隔线 → `var(--border-subtle)`
- 鸣谢标签背景/文字 → 使用 `--color-primary-light` / `--color-primary`

### 第五阶段：改造 about/autoUpdate.vue 样式

将组件中的硬编码颜色全部替换为 CSS 变量：
- 卡片背景 → `var(--bg-card)`，阴影 → `var(--shadow-card)`
- 卡片头部渐变 → 使用新增渐变变量
- 标签文字 → `var(--text-secondary)`
- 分隔线 → `var(--border-subtle)`
- 版本名称 → `var(--text-primary)`
- 更新说明背景 → `var(--bg-hover)`
- 更新说明文字 → `var(--text-secondary)`
- 日期/辅助信息 → `var(--text-muted)`

## 实现原则

1. **只修改样式，不改变功能逻辑**
2. **已有变量零修改**：不修改、不删除任何已有 CSS 变量
3. **每个主题独立配色**，确保与主题整体风格一致
4. **新增变量按类别分组**，便于维护
5. **优先复用现有变量**，新增变量仅在必要时添加
6. **保持深色/浅色模式的可读性**，对比度符合要求

## 验证方案

1. **变量安全验证**：diff 检查 style.scss 中已有变量无修改、无删除
2. 浅色主题验证（light、catppuccin、atom-one-light）
3. 深色主题验证（dark、tokyo-night、midnight、nord、dracula）
4. 特色主题验证（synthwave、solarized、gruvbox 等 2-3 个）
5. 验证三个页面所有元素的显示效果
6. TypeScript 类型检查通过