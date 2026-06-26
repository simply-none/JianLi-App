# 修改窗口模式配置存储方案

## 问题分析

当前窗口模式配置使用以下键名存储：
- `pomodoroMiniWindowConfig` - 番茄钟小窗口配置
- `miniNotebookWindowConfig` - 笔记本小窗口配置

用户希望统一使用 `window-mode:xxx` 格式的键名，方便后续管理和维护。

## 现有存储机制

项目已经使用 SQLite 的 `basic_info` 表存储配置数据：
1. `src/utils/common.ts` 中的 `setStore/getStore` 函数通过 IPC 通信
2. `electron/main/module/store.ts` 中的 `set-store/get-store` 事件处理
3. 使用 `upsertData` 将数据以 `{ key, value: JSON.stringify(value) }` 格式存储

## 修改内容

### 1. `src/store/useWindowMode.ts`
- 修改初始化和默认配置中的键名：
  - `pomodoroMiniWindowConfig` → `window-mode:pomodoro`
  - `miniNotebookWindowConfig` → `window-mode:notebook`

### 2. `src/views/windowMode/index.vue`
- 修改所有调用 `setStore` 的地方，使用新的键名

### 3. 兼容性处理
- 首次加载时检查旧键名数据，如果存在则迁移到新键名

## 修改步骤

1. 修改 `useWindowMode.ts` 中的 `objectVars` 配置项，将字段名改为新格式
2. 修改 `windowMode/index.vue` 中的 `setStore` 调用，使用新键名
3. 添加数据迁移逻辑：如果旧键名有数据，迁移到新键名并删除旧键名

## 风险与注意事项

- 需要确保数据迁移逻辑正确执行，避免配置丢失
- 向后兼容：新配置生效后，旧键名的数据不再使用
- 需要验证 TypeScript 类型检查通过
