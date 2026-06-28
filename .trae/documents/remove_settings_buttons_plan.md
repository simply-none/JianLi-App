# 删除模式组件中重复的设置按钮计划

## 一、需求分析

用户反馈：`c:\cod\electron-vite-vue\src\views\home\index.vue` 已经为所有模式添加了设置按钮（右上角固定位置，hover时显示），不需要在每个模式组件中重复添加。

### 当前问题
1. 之前擅自为多个模式组件添加了设置按钮，导致重复
2. 需要删除这些重复的设置按钮

## 二、修改方案

需要删除以下文件中的设置按钮相关代码：

| 文件路径 | 需要删除的内容 |
|---------|-------------|
| `src/views/home/githubTheme.vue` | 设置按钮模板、goToSettings函数、settings-btn样式 |
| `src/views/home/terminalTheme.vue` | 设置按钮模板、goToSettings函数、settings-btn样式 |
| `src/views/home/minimalClock.vue` | 设置按钮模板、goToSettings函数、settings-btn样式 |
| `src/views/home/motivationalQuote.vue` | 设置按钮模板、goToSettings函数、settings-btn样式 |
| `src/views/home/macOSDesktop.vue` | 设置按钮模板、goToSettings函数、settings-btn样式 |
| `src/views/home/windowsDesktop.vue` | 设置按钮模板、goToSettings函数、settings-btn样式 |
| `src/views/home/imitationWindowsUpdate.vue` | 设置按钮模板、goToSettings函数、settings-btn样式 |

### 删除内容说明

每个文件需要删除：
1. 模板中的设置按钮 `<button class="settings-btn">...</button>`
2. 脚本中的 `useRouter` 导入和 `goToSettings` 函数
3. 样式中的 `.settings-btn` 和父元素 hover 显示设置按钮的样式
4. 如果父元素的 `position: relative` 仅用于设置按钮，可以考虑移除

## 三、验证方案

1. 使用 `npx tsc --noEmit` 进行TypeScript类型检查
2. 确认所有模式组件不再包含设置按钮代码
3. 确认 `home/index.vue` 中的设置按钮仍然正常工作

## 四、实施步骤

1. 删除 githubTheme.vue 中的设置按钮
2. 删除 terminalTheme.vue 中的设置按钮
3. 删除 minimalClock.vue 中的设置按钮
4. 删除 motivationalQuote.vue 中的设置按钮
5. 删除 macOSDesktop.vue 中的设置按钮
6. 删除 windowsDesktop.vue 中的设置按钮
7. 删除 imitationWindowsUpdate.vue 中的设置按钮
8. 运行TypeScript检查