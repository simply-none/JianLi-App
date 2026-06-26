# 修改 open-new-window 调用逻辑

## 问题分析

用户手动修改了窗口名称以匹配 `window-mode:xx` 格式，但打开窗口时配置参数可能未正确从 SQLite 数据库加载：

1. **`useOpenWindow.ts`** 第22行：`send('open-new-window', 'pomodoro', {})` 传空对象
2. **`useWindowMode.ts`** 第25、51行：虽然传了配置对象，但数据初始化可能存在时序问题

## 修改方案

### 1. 创建通用函数获取窗口配置

在 `src/utils/common.ts` 中添加 `getWindowConfig` 函数：
- 根据窗口名自动构建键名 `window-mode:{windowName}`
- 从 SQLite 获取配置，如果不存在或不是对象则返回空对象

### 2. 修改所有 `open-new-window` 调用

**`src/hooks/useOpenWindow.ts`**：
- 使用 `getWindowConfig('pomodoro')` 获取配置

**`src/store/useWindowMode.ts`**：
- 使用 `getWindowConfig('pomodoro')` 和 `getWindowConfig('notebook')` 获取配置
- 确保 store 初始化逻辑正确加载数据库值

## 修改步骤

1. 在 `src/utils/common.ts` 添加 `getWindowConfig` 函数
2. 修改 `src/hooks/useOpenWindow.ts` 中的 `openMainWindow` 函数
3. 修改 `src/store/useWindowMode.ts` 中的 watch 回调函数
4. 验证 TypeScript 类型检查

## 风险与注意事项

- 确保 `getWindowConfig` 返回正确类型（对象或空对象）
- 向后兼容：如果数据库中没有配置，返回空对象，主进程会使用默认值
- 需要验证所有窗口打开场景都能正确读取配置
