# 主题切换无效问题修复方案

## 问题分析

`useTheme.ts` 中新增了14个主题，但 `style.scss` 中只定义了10个主题的 CSS 变量。主题切换机制是通过 `data-theme` 属性应用对应的 CSS 变量，缺少 CSS 定义的主题切换后无法生效。

**已有的10个主题（style.scss中已定义）：**
- light, dark, midnight, nord, one-dark, dracula, github-dark, tokyo-night, solarized, gruvbox

**新增的14个主题（缺少CSS定义）：**
- catppuccin, catppuccin-mocha, ayu-dark, ayu-mirage, monokai, synthwave, material-dark, jellybeans, tomorrow-night, atom-one-light, cobalt, spacemacs, tender, brackets-dark

## 修改方案

### 修改文件

1. **src/style.scss** - 添加14个新增主题的完整CSS变量定义

### 修改内容

为每个新增主题添加完整的 CSS 变量定义，包括：
- 主题色（--color-primary 系列）
- 背景色（--bg-base, --bg-card, --bg-sidebar）
- 文字色（--text-primary, --text-secondary, --text-muted）
- 交互色（--bg-hover, --bg-active-btn 系列）
- 边框/分隔线（--border-subtle, --border-group）
- 圆角和阴影
- 滚动条样式
- 状态行背景
- Element Plus 变量覆写

## 风险评估

- **低风险**：CSS 变量定义是纯样式修改，不影响业务逻辑
- **回滚方案**：如果新主题显示异常，可快速删除对应 CSS 块恢复

## 实施步骤

1. 在 style.scss 文件末尾（Gruvbox 主题之后）添加14个新增主题的 CSS 定义
2. 每个主题遵循统一的变量结构，确保与已有主题格式一致
