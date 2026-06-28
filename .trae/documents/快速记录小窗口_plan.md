# 快速记录小窗口 - 实施计划

## 1. 需求分析

### 1.1 核心需求

创建一个名为"快速记录"的小窗口组件，主要功能基于现有的 [mdEditor.vue](file:///C:/cod/electron-vite-vue/src/smallComponents/mdEditor.vue)，目的是让用户能够随时随地快速记录笔记。

### 1.2 功能来源

* Markdown 编辑功能：来自 `mdEditor.vue`（使用 md-editor-v3 组件库）

* 小窗口框架：参考 [pomodoroMiniWindow/index.vue](file:///C:/cod/electron-vite-vue/src/views/pomodorominiwindow/index.vue) 的小窗口实现模式

* 数据存储：使用现有的 `note_book` 数据库表

### 1.3 与现有 miniNotebook 的区别

* miniNotebook 使用 UmoEditor（富文本编辑器）

* 快速记录使用 md-editor-v3（Markdown 编辑器）

* 快速记录更轻量，专注于快速笔记记录

## 2. 现有架构分析

### 2.1 小窗口系统组成

| 层级    | 文件                                                                                      | 职责               |
| ----- | --------------------------------------------------------------------------------------- | ---------------- |
| Store | [useWindowMode.ts](file:///C:/cod/electron-vite-vue/src/store/useWindowMode.ts)         | 管理小窗口状态、配置、开关控制  |
| 设置页面  | [windowMode/index.vue](file:///C:/cod/electron-vite-vue/src/views/windowMode/index.vue) | 用户配置界面           |
| 路由    | [router/index.ts](file:///C:/cod/electron-vite-vue/src/router/index.ts)                 | 小窗口页面路由注册        |
| 主进程   | [newWindow.ts](file:///C:/cod/electron-vite-vue/electron/main/module/newWindow.ts)      | Electron 窗口创建与管理 |
| 小窗口页面 | `src/views/xxx/index.vue`                                                               | 具体小窗口内容          |

### 2.2 现有小窗口

* **番茄钟 (pomodoro)**：功能完整，10套皮肤，6种布局

* **笔记本 (notebook/miniNotebook)**：UmoEditor 富文本编辑器

### 2.3 mdEditor 核心功能

* Markdown 编辑（md-editor-v3）

* 主题切换（light/dark）

* 代码预览主题切换

* 从 note\_book 表加载历史笔记

* 保存到 note\_book 表（含摘要、mdText、html）

* 可拖拽容器

## 3. 实施方案

### 3.1 新增文件

#### 3.1.1 快速记录小窗口主页面

**路径**：`src/views/quickNote/index.vue`

**功能设计**：

* 顶部拖拽区域（支持鼠标穿透切换，与番茄钟小窗口一致）

* 边缘鼠标穿透控制（左右边缘小区域）

* 使用动态组件加载 4 种布局

* 集成 md-editor-v3 核心逻辑

* 笔记数据管理（保存、加载、新建）

* 皮肤主题应用（10 套）

* 布局切换（4 种）

* 从 store 配置初始化

**技术要点**：

* 窗口名称：`quickNote`

* 路由路径：`/quickNote`

* 配置存储 key：`window-mode:quickNote`

* 监听 `sync-data-to-other-window` 事件同步配置

#### 3.1.2 布局组件目录

**路径**：`src/views/quickNote/layouts/`

包含 4 个布局组件：

* `LayoutMinimal.vue` — 极简卡片式

* `LayoutGlass.vue` — 毛玻璃沉浸风

* `LayoutSidebar.vue` — 双栏侧边栏

* `LayoutClassic.vue` — 经典编辑器

每个布局组件内部封装 MdEditor 实例，统一 Props/Emit 接口。

### 3.2 修改文件

#### 3.2.1 Store - useWindowMode.ts

**修改内容**：

* 新增 `showQuickNoteWindow` ref（布尔值，控制窗口显示）

* 新增 `showQuickNoteWindowC` computed

* 新增 `setShowQuickNoteWindow` 方法

* 新增 `quickNoteWindowConfig` ref（窗口配置对象）

  * position: 'bottom-right'

  * width: 600

  * height: 400

  * gap: 30

  * x: 0

  * y: 0

  * theme: 'light'（编辑器主题）

* 新增 watch 监听 showQuickNoteWindow，触发 open/close-new-window

* 在 init() 函数中：

  * boolVars 数组添加 showQuickNoteWindow

  * objectVars 数组添加 quickNoteWindowConfig

* return 中导出新增的变量和方法

#### 3.2.2 路由 - router/index.ts

**修改内容**：

* 在 RouteNames 中新增 `QUICK_NOTE: "quickNote"`

* 在 routers 数组中新增路由：

  ```
  {
    path: "/quickNote",
    name: RouteNames.QUICK_NOTE,
    component: () => import("@/views/quickNote/index.vue"),
  }
  ```

#### 3.2.3 设置页面 - windowMode/index.vue

**修改内容**：

* 新增第三个 `.section` 区块，标题为"快速记录小窗口"

* 包含：

  * 开关状态切换（开启/关闭/应用）

  * 位置选择（9宫格 + 自定义）

  * 窗口尺寸选择（预设尺寸 + 自定义）

  * 边缘间隙选择

* 复用现有的 positionOptions、gapOptions、模态框组件

* 新增 quickNoteSizeOptions（适合编辑器的尺寸：400×300, 600×400, 800×500）

* 新增相关的处理函数（或复用现有逻辑，扩展 modalTarget 类型）

### 3.3 不需要修改的文件

* **electron/main/module/newWindow\.ts**：通用窗口创建逻辑，窗口名通过参数传递，无需修改

* **src/utils/common.ts**：getWindowConfig 等工具函数是通用的，无需修改

* **src/smallComponents/mdEditor.vue**：作为功能参考，不直接修改

## 4. 设计排版方案

提供以下 4 种主流排版设计方案供选择，默认采用方案一（极简卡片式）。

***

### 方案一：极简卡片式（推荐默认）

**设计风格**：简洁、干净、专注内容

**布局结构**：

```
┌─────────────────────────────────────┐
│  📝 快速记录        ⚙️  📂  💾     │  ← 顶部工具栏（可拖拽）
├─────────────────────────────────────┤
│                                     │
│                                     │
│      Markdown 编辑区域              │  ← 编辑区（flex: 1）
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  字数: 128  |  已自动保存           │  ← 底部状态栏
└─────────────────────────────────────┘
```

**设计要点**：

* 整体圆角卡片，毛玻璃背景（backdrop-filter: blur）

* 顶部工具栏：左侧标题 + 右侧操作按钮（主题切换、历史笔记、保存）

* 编辑区域占满剩余空间，无边框干扰

* 底部状态栏显示字数统计和保存状态

* 1px 细边框，柔和阴影

* 支持 light/dark 双主题

**适用场景**：快速记录灵感、待办事项、简短笔记

***

### 方案二：毛玻璃沉浸风

**设计风格**：现代、通透、视觉层次丰富

**布局结构**：

```
┌─────────────────────────────────────┐
│  ◉ ◉ ◉    快速笔记           ⋯     │  ← 顶部标题栏（仿mac风格）
├─────────────────────────────────────┤
│  # 工具栏                           │
│  B I U 🔗 📷  列表  代码块 ...     │  ← Markdown 工具栏
├─────────────────────────────────────┤
│                                     │
│      编辑区域                       │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  ✨ 已保存  2分钟前                 │  ← 保存提示
└─────────────────────────────────────┘
```

**设计要点**：

* 深度毛玻璃效果（backdrop-filter: blur(20px)）

* 仿 macOS 窗口设计：左上角红黄绿三个圆点（装饰用）

* 完整的 Markdown 编辑工具栏

* 渐变边框 + 柔和内阴影

* 保存状态动画提示

* 与番茄钟小窗口的 10 套皮肤系统兼容

**适用场景**：追求视觉体验，较长时间编辑

***

### 方案三：双栏侧边栏布局

**设计风格**：高效、功能完整、类 Notion

**布局结构**：

```
┌──────────┬──────────────────────────┐
│ 📝 笔记   │  ✏️ 正在编辑...         │
│          │                          │
│ 笔记1    │                          │
│ 笔记2    │   编辑区域               │
│ 笔记3    │                          │
│ ...      │                          │
│          │                          │
│ [+ 新建]  │                          │
└──────────┴──────────────────────────┘
```

**设计要点**：

* 左侧 30%：笔记列表（可滚动）

  * 顶部搜索框

  * 笔记列表项（标题摘要 + 时间）

  * 底部新建按钮

* 右侧 70%：编辑区域

* 可拖拽分割线调整左右比例

* 支持点击笔记快速切换

**适用场景**：需要管理多条笔记，频繁切换查看

> 注意：此方案窗口建议最小尺寸 600×400 以上

***

### 方案四：经典编辑器布局

**设计风格**：专业、功能齐全、类 VS Code

**布局结构**：

```
┌─────────────────────────────────────┐
│  文件  编辑  视图  帮助             │  ← 菜单栏
├─────────────────────────────────────┤
│  📄 文件名.md      [预览] [编辑]    │  ← 标签栏 + 模式切换
├─────────────────────────────────────┤
│                                     │
│      编辑区域 / 预览区域            │
│      （可左右分栏）                 │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  Ln 12, Col 8  |  Markdown  | UTF-8 │  ← 底部状态栏
└─────────────────────────────────────┘
```

**设计要点**：

* 顶部菜单栏 + 标签栏

* 编辑/预览双模式切换，支持左右分栏

* 底部状态栏显示行列号、编码格式

* 深色主题为主，代码编辑器风格

* 快捷键支持（Ctrl+S 保存等）

**适用场景**：重度 Markdown 用户，长文编辑

***

### 方案对比表

| 特性    | 方案一 极简卡片 | 方案二 毛玻璃 | 方案三 双栏侧边 | 方案四 经典编辑器 |
| ----- | -------- | ------- | -------- | --------- |
| 视觉简洁度 | ⭐⭐⭐⭐⭐    | ⭐⭐⭐⭐    | ⭐⭐⭐      | ⭐⭐        |
| 功能完整度 | ⭐⭐⭐      | ⭐⭐⭐⭐    | ⭐⭐⭐⭐⭐    | ⭐⭐⭐⭐⭐     |
| 小窗口适配 | ⭐⭐⭐⭐⭐    | ⭐⭐⭐⭐    | ⭐⭐⭐      | ⭐⭐⭐       |
| 启动速度  | ⭐⭐⭐⭐⭐    | ⭐⭐⭐⭐    | ⭐⭐⭐      | ⭐⭐        |
| 学习成本  | ⭐⭐⭐⭐⭐    | ⭐⭐⭐⭐    | ⭐⭐⭐      | ⭐⭐        |

***

### 布局切换机制

**四种布局全部实现**，参考番茄钟小窗口的多布局架构：

* 使用动态组件 `<component :is="currentLayoutComponent" />` 切换

* 布局名称：`minimal`（极简卡片）、`glass`（毛玻璃）、`sidebar`（双栏侧边）、`classic`（经典编辑器）

* 默认布局：`minimal`（方案一）

* layout 字段存入配置：`window-mode:quickNote` → `layout`

* 设置页面可选择布局样式

**皮肤主题**：复用番茄钟小窗口的 10 套皮肤变量系统（`--skin-bg`、`--skin-border`、`--skin-text-primary` 等），保持视觉统一。

***

## 5. 实施步骤

### 步骤 1：创建布局组件

* 创建 `src/views/quickNote/layouts/` 目录

* 创建 4 个布局组件：

  * `LayoutMinimal.vue` — 方案一：极简卡片式

  * `LayoutGlass.vue` — 方案二：毛玻璃沉浸风

  * `LayoutSidebar.vue` — 方案三：双栏侧边栏

  * `LayoutClassic.vue` — 方案四：经典编辑器

* 每个布局组件接收相同 props：`theme`、`text`、`noteList`、`wordCount`、`saveStatus`

* 每个布局组件 emit 相同事件：`@save`、`@load-note`、`@new-note`、`@cycle-theme`

### 步骤 2：创建快速记录小窗口主页面

* 创建 `src/views/quickNote/index.vue`

* 实现顶部拖拽栏和鼠标穿透逻辑（边缘穿透，内容区不穿透）

* 使用动态组件切换 4 种布局

* 集成 md-editor-v3 编辑器核心逻辑

* 实现保存和加载笔记功能（复用 mdEditor 中的数据库操作逻辑）

* 实现皮肤主题切换（复用 10 套皮肤变量）

* 从 store 配置加载 layout 和 skin

### 步骤 3：注册路由

* 修改 `src/router/index.ts`

* 添加 QUICK\_NOTE 路由名称和路由配置

### 步骤 4：扩展 Store

* 修改 `src/store/useWindowMode.ts`

* 添加 `showQuickNoteWindow` 状态及控制方法

* 添加 `quickNoteWindowConfig` 配置对象：

  * position / width / height / gap / x / y

  * skin: 'white'（皮肤主题）

  * layout: 'minimal'（布局样式）

* 添加配置持久化逻辑（init 函数的 boolVars 和 objectVars）

* 添加窗口开关监听（watch showQuickNoteWindow）

* 添加配置同步监听（watch quickNoteWindowConfig → sync-data-to-other-window）

### 步骤 5：添加设置界面

* 修改 `src/views/windowMode/index.vue`

* 新增"快速记录小窗口"section 区块

* 开关状态切换（开启/关闭/应用）

* 位置选择（9宫格 + 自定义）

* 窗口尺寸选择（预设 + 自定义）

* 边缘间隙选择

* 皮肤主题选择（10 套，复用番茄钟皮肤选项）

* 排版样式选择（4 种布局）

* 扩展 modalTarget 类型支持 'quickNote'

### 步骤 6：验证与测试

* TypeScript 类型检查

* 功能验证：窗口打开/关闭、位置调整、尺寸调整

* 布局切换验证：4 种布局正常切换

* 皮肤切换验证：10 套皮肤正常应用

* 笔记功能验证：保存/加载/新建笔记

## 6. 配置默认值

### 6.1 窗口配置

```typescript
quickNoteWindowConfig = {
  position: 'bottom-right',
  width: 600,
  height: 400,
  gap: 30,
  x: 0,
  y: 0,
  skin: 'white',
  layout: 'minimal',
}
```

### 6.2 预设选项

**尺寸选项**：

* 小：400×300

* 中：600×400（默认）

* 大：800×500

**皮肤主题**：10 套（与番茄钟小窗口一致）

* 默认：'white'

* 可选：white, coral, mint, sky, lavender, sakura, amber, dark, gray, aurora

**布局选项**：4 种

* 默认：'minimal'（极简卡片式）

* 可选：minimal（极简卡片）、glass（毛玻璃）、sidebar（双栏侧边）、classic（经典编辑器）

### 6.3 布局组件 Props & Events 约定

所有布局组件统一的 Props：

| Prop        | 类型     | 说明                       |
| ----------- | ------ | ------------------------ |
| modelValue  | string | 编辑器内容（v-model）           |
| skin        | string | 当前皮肤主题                   |
| layout      | string | 当前布局标识                   |
| noteList    | array  | 笔记列表（用于侧边栏布局）            |
| currentNote | object | 当前编辑的笔记                  |
| wordCount   | number | 当前字数                     |
| saveStatus  | string | 保存状态（saving/saved/error） |

所有布局组件统一的 Events：

| Event             | 参数     | 说明      |
| ----------------- | ------ | ------- |
| update:modelValue | string | 内容变更    |
| save              | -      | 触发保存    |
| load-note         | note   | 加载指定笔记  |
| new-note          | -      | 新建笔记    |
| cycle-skin        | -      | 切换下一个皮肤 |
| cycle-layout      | -      | 切换下一个布局 |

## 7. 风险与注意事项

### 7.1 鼠标穿透与编辑器交互

* 编辑器需要正常接收鼠标事件，不能穿透

* 只有窗口边缘区域设置为穿透区域

* 参考 miniNotebook 的实现方式：左右边缘小区域控制穿透

### 7.2 窗口拖拽

* 使用 `-webkit-app-region: drag` 实现顶部拖拽

* 编辑器工具栏区域需要设置 `-webkit-app-region: no-drag` 以保证按钮可点击

### 7.3 数据同步

* 笔记数据存储在 note\_book 表，与主应用共享

* 保存后数据在主窗口的笔记本页面也能看到

### 7.4 窗口大小适应性

* 编辑器需要自适应窗口大小

* 使用 flex 布局，编辑器区域 flex: 1 占满剩余空间

### 7.5 皮肤主题兼容性

* 复用番茄钟的 10 套皮肤变量

* 需要确保 md-editor-v3 的主题与皮肤系统协调

* 深色皮肤下编辑器自动切换为 dark 主题

