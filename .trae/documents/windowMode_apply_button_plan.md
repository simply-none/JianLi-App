# 窗口模式页面增加应用按钮计划

## 需求分析

在 `windowMode/index.vue` 页面中，为每个窗口配置卡片增加"应用"按钮：
- 如果窗口处于**关闭状态**：点击应用按钮 → 直接开启窗口
- 如果窗口处于**开启状态**：点击应用按钮 → 先关闭窗口，等待300ms后再次开启（重新应用最新配置）

## 当前代码分析

### 现有按钮逻辑
- `changeShowPomodoroMiniWindowFn(true)` - 开启番茄钟小窗口
- `changeShowPomodoroMiniWindowFn(false)` - 关闭番茄钟小窗口
- `changeShowMiniNotebookWindowFn(true)` - 开启笔记本小窗口
- `changeShowMiniNotebookWindowFn(false)` - 关闭笔记本小窗口

### 状态管理
- `showPomodoroMiniWindowCc` - 番茄钟窗口显示状态（本地响应式）
- `showMiniNotebookWindowCc` - 笔记本窗口显示状态（本地响应式）

## 修改计划

### 文件列表
1. `src/views/windowMode/index.vue` - 主要修改文件

### 修改步骤

#### 1. 修改模板（template）
- 在两个卡片的 `.toggle-group` 区域，在"开启"/"关闭"按钮后添加"应用"按钮

#### 2. 修改脚本（script）
- 添加 `applyPomodoroWindow` 函数：
  - 如果 `showPomodoroMiniWindowCc.value` 为 `false` → 直接调用 `changeShowPomodoroMiniWindowFn(true)`
  - 如果 `showPomodoroMiniWindowCc.value` 为 `true` → 先调用 `changeShowPomodoroMiniWindowFn(false)`，300ms后调用 `changeShowPomodoroMiniWindowFn(true)`

- 添加 `applyNotebookWindow` 函数：
  - 如果 `showMiniNotebookWindowCc.value` 为 `false` → 直接调用 `changeShowMiniNotebookWindowFn(true)`
  - 如果 `showMiniNotebookWindowCc.value` 为 `true` → 先调用 `changeShowMiniNotebookWindowFn(false)`，300ms后调用 `changeShowMiniNotebookWindowFn(true)`

#### 3. 修改样式（style）
- 为"应用"按钮添加样式，使其在 toggle-group 中合理显示

## 风险与注意事项

1. **状态同步问题**：确保应用按钮点击后，UI 状态能正确反映实际窗口状态
2. **定时器清理**：考虑添加防抖机制，避免快速点击导致多次触发
3. **视觉反馈**：添加按钮点击状态和禁用状态，提升用户体验

## 验证方案

1. 在关闭状态下点击应用按钮 → 窗口应正常开启
2. 在开启状态下点击应用按钮 → 窗口应先关闭，300ms后重新开启
3. 连续快速点击应用按钮 → 应只执行最后一次操作（防抖）