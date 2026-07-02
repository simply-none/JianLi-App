# 主题样式抽离重构方案

## 项目调研结论

### 当前 style.scss 文件结构

| 行范围 | 内容 |
|--------|------|
| 1-136 | `:root` 基础主题（light）变量定义 |
| 138-3013 | 24个深色主题定义（dark, midnight, nord, ..., glass） |
| 3015+ | 全局样式（html/body、滚动条、通用工具类、Element Plus 组件覆写） |

### 主题列表

共25个主题（含基础 light 主题）：
- light（:root 基础变量）
- dark, midnight, nord, one-dark, dracula, github-dark, tokyo-night, solarized, gruvbox
- catppuccin, catppuccin-mocha, ayu-dark, ayu-mirage, monokai, synthwave, material-dark
- jellybeans, tomorrow-night, atom-one-light, cobalt, spacemacs, tender, brackets-dark, glass

---

## 重构方案

### 目录结构设计

```
src/
├── styles/
│   └── themes/
│       ├── light.scss          # 基础主题变量
│       ├── dark.scss           # Dark 主题
│       ├── midnight.scss       # Midnight 主题
│       ├── nord.scss           # Nord 主题
│       ├── one-dark.scss       # One Dark 主题
│       ├── dracula.scss        # Dracula 主题
│       ├── github-dark.scss    # GitHub Dark 主题
│       ├── tokyo-night.scss    # Tokyo Night 主题
│       ├── solarized.scss      # Solarized 主题
│       ├── gruvbox.scss        # Gruvbox 主题
│       ├── catppuccin.scss     # Catppuccin 主题
│       ├── catppuccin-mocha.scss # Catppuccin Mocha 主题
│       ├── ayu-dark.scss       # Ayu Dark 主题
│       ├── ayu-mirage.scss     # Ayu Mirage 主题
│       ├── monokai.scss        # Monokai 主题
│       ├── synthwave.scss      # Synthwave 主题
│       ├── material-dark.scss  # Material Dark 主题
│       ├── jellybeans.scss     # Jellybeans 主题
│       ├── tomorrow-night.scss # Tomorrow Night 主题
│       ├── atom-one-light.scss # Atom One Light 主题
│       ├── cobalt.scss         # Cobalt 主题
│       ├── spacemacs.scss      # Spacemacs 主题
│       ├── tender.scss         # Tender 主题
│       ├── brackets-dark.scss  # Brackets Dark 主题
│       └── glass.scss          # Glass Morphism 主题
├── style.scss                  # 修改为引入主题文件 + 全局样式
```

### 修改步骤

#### 步骤 1：创建目录结构

创建 `src/styles/themes/` 目录。

#### 步骤 2：抽离基础主题（light）

将 `:root` 中的变量定义抽取到 `styles/themes/light.scss`。

#### 步骤 3：抽离各深色主题

将每个 `[data-theme="xxx"]` 选择器块抽取到对应的 `styles/themes/xxx.scss` 文件中。

#### 步骤 4：修改 style.scss

替换主题定义部分为 `@import` 语句，保留全局样式部分。

---

## 文件修改清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/style.scss` | 修改 | 移除主题定义，添加 @import 引入 |
| `src/styles/themes/light.scss` | 新建 | 基础主题变量 |
| `src/styles/themes/dark.scss` | 新建 | Dark 主题 |
| `src/styles/themes/midnight.scss` | 新建 | Midnight 主题 |
| `src/styles/themes/nord.scss` | 新建 | Nord 主题 |
| `src/styles/themes/one-dark.scss` | 新建 | One Dark 主题 |
| `src/styles/themes/dracula.scss` | 新建 | Dracula 主题 |
| `src/styles/themes/github-dark.scss` | 新建 | GitHub Dark 主题 |
| `src/styles/themes/tokyo-night.scss` | 新建 | Tokyo Night 主题 |
| `src/styles/themes/solarized.scss` | 新建 | Solarized 主题 |
| `src/styles/themes/gruvbox.scss` | 新建 | Gruvbox 主题 |
| `src/styles/themes/catppuccin.scss` | 新建 | Catppuccin 主题 |
| `src/styles/themes/catppuccin-mocha.scss` | 新建 | Catppuccin Mocha 主题 |
| `src/styles/themes/ayu-dark.scss` | 新建 | Ayu Dark 主题 |
| `src/styles/themes/ayu-mirage.scss` | 新建 | Ayu Mirage 主题 |
| `src/styles/themes/monokai.scss` | 新建 | Monokai 主题 |
| `src/styles/themes/synthwave.scss` | 新建 | Synthwave 主题 |
| `src/styles/themes/material-dark.scss` | 新建 | Material Dark 主题 |
| `src/styles/themes/jellybeans.scss` | 新建 | Jellybeans 主题 |
| `src/styles/themes/tomorrow-night.scss` | 新建 | Tomorrow Night 主题 |
| `src/styles/themes/atom-one-light.scss` | 新建 | Atom One Light 主题 |
| `src/styles/themes/cobalt.scss` | 新建 | Cobalt 主题 |
| `src/styles/themes/spacemacs.scss` | 新建 | Spacemacs 主题 |
| `src/styles/themes/tender.scss` | 新建 | Tender 主题 |
| `src/styles/themes/brackets-dark.scss` | 新建 | Brackets Dark 主题 |
| `src/styles/themes/glass.scss` | 新建 | Glass Morphism 主题 |

---

## 风险与注意事项

1. **路径问题**: `@import` 路径需要正确配置，确保 vite 能正确解析
2. **样式顺序**: 主题文件的引入顺序不影响样式优先级（使用 data-theme 属性选择器）
3. **构建验证**: 需要验证项目能正常构建，确保没有遗漏任何样式
4. **编码一致性**: 确保抽取的内容与原文件完全一致，不丢失任何变量

---

## 验证方案

遵循项目验证规则（[验证规则.md](file:///C:/cod/electron-vite-vue/.trae/rules/验证规则.md)）：

1. 创建所有主题文件后，修改 style.scss 引入
2. 运行 `npx tsc --noEmit` 进行 TypeScript 类型检查，确保没有导入路径错误
3. 运行 `npx vite --mode development` 启动开发服务器，验证样式能正常加载且无编译错误
4. 在开发环境中切换不同主题，验证主题切换功能正常工作