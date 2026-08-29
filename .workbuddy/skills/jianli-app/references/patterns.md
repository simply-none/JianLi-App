# 通用复用模式（patterns）

## 全局组件
- **AppDialog**（`src/components/AppDialog.vue`）：统一 `el-dialog` 自带全屏 + 关闭；传 `#header` 不注入按钮。批量替换警惕自递归误改内部真实 `el-dialog`。各模块编辑弹窗继承它。
- **VirtualList**（`src/components/VirtualList.vue`）：长列表优先。`item-height>0` 定高快路径否则 `ResizeObserver`；下标读 `el.dataset.index`；`items.push`=加载更多，换引用=新查询回顶。已接 `ClipboardList`(50/页)。

## 注册表模式（仿命令面板）
- **命令面板**：`src/views/commandPalette/composables/useCommandSources.ts` 的 `REGISTRY: CommandSource[]`（routeSource / actionSource / noteSource / todoSource / habitSource）。新模块实现 `CommandSource` 接口（`types.ts`）并 push 进 `REGISTRY`；作用域前缀在 `paletteConfig.ts` 的 `SCOPE_PREFIX_MAP`（如 `!`→habit、`@`→note、`#`→todo、`/`→route+action）。同时可能要改 `types.ts` 的 `CommandType`、`paletteConfig` 的 `SCOPE_LABEL`/`TYPE_META`、`useCommandPalette` 的 `SCOPE_PATTERN` 正则。
- **链式动作**：`src/views/habit/chainActions/` —— `registry.ts`（注册表）+ `index.ts` 的 `ACTIONS=[...]`。新增串接只加一个 `actions/*.ts` 并 push 进 `ACTIONS`，核心零改动；`dispatchChainActions`/`rollbackChainActions` 顺序执行，单动作失败只记录、不阻断打卡。

## 提醒引擎复用（syncReminders）
- `src/store/useHabit.ts` 的 `syncReminders()` 把每个时刻同步成 `newReminder` 里 `mode='time'+repeat` 定点提醒（id 形如 `habit:<key>#<序号>`），调度 / 免打扰 / 重启恢复全复用既有引擎；单向同步（习惯→提醒），提醒页手动改会被覆盖。

## 通知封装
- `src/utils/notify.ts` 的 `sysNotify` / `appNotify` 支持可选 `onClick`（习惯打卡点通知再唤小窗即复用）。

## 主题 token
- 用 CSS 变量（`--bg-base/card`、`--text-primary|secondary|muted`、`--border-subtle`、`--color-primary` 等）而非硬编码色；25 套主题。改 UI 颜色一律走 token。

## 渲染端陷阱
- 函数 ref（`:ref="fn"`）每次 patch 调用，回调写响应式会无限递归；同元素 `return` / `nextTick` / 复用引用。
- 快捷键挂 `document` 非输入框；唤出即重置用 `visibilitychange(document.hidden)` 非 `window.focus`。
- `el-table-v2` 表头过滤：`headerCellRenderer`+fixed 浮层+computed；`LucideIcon` 须 `nameMap` 注册。

## 何时读本文档
新增功能想「接入既有体系」（命令面板 / 链式动作 / 小窗 / 提醒）或遇到上述通用坑时。
