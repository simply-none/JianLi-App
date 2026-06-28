# 快速记录小窗口功能增强计划

## 一、需求分析

用户提出三个需求：
1. 为快速记录小窗口右上角添加关闭窗口图标按钮
2. 为右上角各图标添加中文提示（title 字段），需要给 LucideIcon 组件添加可选 title 属性
3. 为快速记录小窗口添加全局快捷键打开功能

## 二、Repo 研究结论

### 现有代码结构

1. **快速记录小窗口**：`src/views/quickNote/`
   - `index.vue` - 主页面，管理4种布局切换
   - `layouts/` - 4个布局组件：LayoutMinimal, LayoutGlass, LayoutSidebar, LayoutClassic

2. **LucideIcon 组件**：`src/components/LucideIcon.vue`
   - 已有 props：name, size, color, strokeWidth, defaultClass, padding, type
   - 包装在 `.lucide-icon-box` div 中渲染图标

3. **全局快捷键系统**：
   - 主进程：`electron/main/module/registerShortcut.ts` - 注册全局快捷键
   - 前端设置页：`src/views/registerShortcut/index.vue` - 快捷键配置界面
   - 数据库表：`register_shortcut` - 存储快捷键配置
   - 快捷键类型：`open_match_page`（打开匹配页面）、`show_app`（显示/隐藏应用）

4. **窗口管理**：
   - `electron/main/module/newWindow.ts` - 子窗口创建与管理
   - `src/store/useWindowMode.ts` - 窗口状态管理（Pinia）

### 关键发现

1. 现有快捷键系统只支持 `open_match_page` 和 `show_app` 两种类型，不支持直接打开子窗口
2. 需要新增一种快捷键类型 `open_quick_note` 来打开快速记录小窗口
3. LucideIcon 组件目前没有 title 属性，需要新增

## 三、文件和模块修改清单

### 1. `src/components/LucideIcon.vue`
- 新增可选 `title` prop
- 在 `.lucide-icon-box` 上绑定 `title` 属性

### 2. 快速记录布局组件（4个）
- `src/views/quickNote/layouts/LayoutMinimal.vue`
- `src/views/quickNote/layouts/LayoutGlass.vue`
- `src/views/quickNote/layouts/LayoutSidebar.vue`
- `src/views/quickNote/layouts/LayoutClassic.vue`

每个组件修改：
- 右上角添加关闭图标按钮（X）
- 给所有图标按钮添加 title 属性
- 新增 emit：`close-window`

### 3. `src/views/quickNote/index.vue`
- 监听子组件的 `close-window` 事件
- 调用 `window.close()` 或发送 IPC 消息关闭窗口

### 4. `electron/main/module/registerShortcut.ts`
- 新增快捷键类型 `open_quick_note` 的处理逻辑
- 触发时打开/切换快速记录小窗口

### 5. `src/views/registerShortcut/index.vue`
- 在 `originShortcuts` 数组中添加快速记录快捷键配置
- 在 `iconMap`、`iconClassMap`、`descriptionMap` 中添加对应项

### 6. `electron/main/module/newWindow.ts`（如有需要）
- 确保快速记录窗口可以通过 IPC 消息被打开/关闭/切换显示

## 四、修改步骤

### 步骤 1：LucideIcon 组件添加 title 属性
- 在 `defineProps` 中添加可选的 `title?: string`
- 在模板的 `.lucide-icon-box` div 上绑定 `:title="title || undefined"`

### 步骤 2：4个布局组件添加关闭按钮和 title
**LayoutMinimal.vue**：
- 右上角添加关闭按钮（X 图标），发出 `close-window` 事件
- 给所有图标按钮添加 title：主题切换、历史笔记、新建笔记、拖拽切换、保存、关闭

**LayoutGlass.vue**：
- 右上角添加关闭按钮
- 给所有图标按钮添加 title

**LayoutSidebar.vue**：
- 右上角添加关闭按钮
- 给所有图标按钮添加 title

**LayoutClassic.vue**：
- 右上角添加关闭按钮
- 给所有图标按钮添加 title

### 步骤 3：主页面处理关闭事件
- 在 index.vue 的动态组件上监听 `@close-window`
- 处理函数中调用 `window.close()` 或发送 IPC 关闭消息

### 步骤 4：主进程添加快速记录快捷键类型
- 在 `registerShortcut.ts` 的 `globalShortcutFn` 中添加 `open_quick_note` 类型
- 触发时检查快速记录窗口是否存在，存在则显示/隐藏，不存在则创建

### 步骤 5：快捷键设置页添加快速记录选项
- 在 `originShortcuts` 中添加 `quickNoteShortcut`
- 在三个 map 对象中添加对应配置
- 图标使用 NotebookPen 或 FileText，描述为"快速打开/关闭快速记录小窗口"

## 五、潜在依赖和注意事项

1. **图标可用性**：使用 X 图标作为关闭按钮，确认已在 LucideIcon 中导入（已确认存在）
2. **窗口关闭方式**：快速记录是独立子窗口，需要确认是使用 `window.close()` 还是通过 IPC 通知主进程关闭（建议使用 IPC 以保持状态同步）
3. **快捷键类型扩展**：需要与现有的 `open_match_page` 区分开，因为快速记录是独立窗口而非页面路由
4. **窗口切换逻辑**：快捷键应该是"打开/关闭"切换，而非仅打开（类似 show_app 的逻辑）
5. **窗口状态同步**：关闭窗口时需要同步更新 Pinia store 中的 `showQuickNoteWindow` 状态

## 六、风险处理

| 风险 | 应对方案 |
|------|---------|
| 关闭窗口后 Pinia 状态不同步 | 通过 IPC 通知主进程关闭窗口，主进程同时更新 store |
| 快捷键与现有快捷键冲突 | 复用现有快捷键注册的冲突检测机制 |
| LucideIcon title 影响现有使用 | title 为可选属性，默认不传则不显示 |
| 快速记录窗口可能尚未初始化 | 快捷键触发时检查窗口状态，未创建则先创建 |
