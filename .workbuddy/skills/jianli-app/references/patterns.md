# 通用复用模式（patterns）

## 全局组件
- **AppDialog**（`src/components/AppDialog.vue`）：统一 `el-dialog` 自带全屏 + 关闭；传 `#header` 不注入按钮。批量替换警惕自递归误改内部真实 `el-dialog`。各模块编辑弹窗继承它。
- **VirtualList**（`src/components/VirtualList.vue`）：长列表优先。`item-height>0` 定高快路径否则 `ResizeObserver`；下标读 `el.dataset.index`；`items.push`=加载更多，换引用=新查询回顶。已接 `ClipboardList`(50/页)。
- **TopTabs**（`src/components/TopTabs.vue`）：通用顶部 Tab 切换组件，`tabs: TopTabItem[]`（`{ key, label, icon?, color? }`）+ `v-model`。**单行不换行**，溢出时鼠标滚轮转横向滚动；**滚动条默认隐藏，仅「内容横向溢出（`is-overflow` 类）且 mouse hover」时显示**（`ResizeObserver` 监听宽度变化算溢出，避免无内容悬停出灰条）。`color` 字段指定该 Tab 的图标色与激活态强调色，缺省回退主题主色（`--tab-accent` / `--tab-icon` CSS 变量 + `color-mix` 浅底，主色与自定义色都兼容）。多 Tab 页（homeMode / windowMode）用它替代自写 tab 栏，避免重复样式与滚轮逻辑；`emit` 为 `string | number`，消费方在 `@update:modelValue` 处 `as` 回严格联合类型；滚轮横滚位移经 `WHEEL_FACTOR=4` 放大并按 `deltaMode` 归一（行模式≈16px/行、页模式≈整屏宽），避免部分鼠标/触控板一次滚动距离过小。

## 注册表模式（仿命令面板）
- **命令面板**：`src/views/commandPalette/composables/useCommandSources.ts` 的 `REGISTRY: CommandSource[]`（routeSource / actionSource / noteSource / todoSource / habitSource）。新模块实现 `CommandSource` 接口（`types.ts`）并 push 进 `REGISTRY`；作用域前缀在 `paletteConfig.ts` 的 `SCOPE_PREFIX_MAP`（如 `!`→habit、`@`→note、`#`→todo、`/`→route+action）。同时可能要改 `types.ts` 的 `CommandType`、`paletteConfig` 的 `SCOPE_LABEL`/`TYPE_META`、`useCommandPalette` 的 `SCOPE_PATTERN` 正则。
- **链式动作**：`src/views/habit/chainActions/` —— `registry.ts`（注册表）+ `index.ts` 的 `ACTIONS=[...]`。新增串接只加一个 `actions/*.ts` 并 push 进 `ACTIONS`，核心零改动；`dispatchChainActions`/`rollbackChainActions` 顺序执行，单动作失败只记录、不阻断打卡。

## 提醒引擎复用（syncReminders）
- `src/store/useHabit.ts` 的 `syncReminders()` 把每个时刻同步成 `newReminder` 里 `mode='time'+repeat` 定点提醒（id 形如 `habit:<key>#<序号>`），调度 / 免打扰 / 重启恢复全复用既有引擎；单向同步（习惯→提醒），提醒页手动改会被覆盖。

## 通知封装
- `src/utils/notify.ts` 的 `sysNotify` / `appNotify` 支持可选 `onClick`（习惯打卡点通知再唤小窗即复用）。

## 主题 token
- **完整约定见 `references/theme.md`**（token 清单、严禁硬编码、禁用未全覆盖的 `--el-*`、派生色用 `color-mix`）。
- 要点：自定义 UI 的背景/文字/边框/主色一律走**自定义主题 token**（如 `--bg-card`/`--bg-hover`/`--text-primary`/`--text-secondary`/`--text-muted`/`--border-subtle`/`--color-primary`/`--color-warning`/`--color-error`），**禁止**硬编码 hex/rgb，也**禁止**直接用 Element Plus 的 `--el-*` 变量（尤其 `light-N`/`extra-light` 系列在部分主题未定义，会回退浅色 `:root` 导致不跟随主题）；派生色阶用 `color-mix(in srgb, var(--color-primary) N%, transparent)`。

## 渲染端陷阱
- 函数 ref（`:ref="fn"`）每次 patch 调用，回调写响应式会无限递归；同元素 `return` / `nextTick` / 复用引用。
- 快捷键挂 `document` 非输入框；唤出即重置用 `visibilitychange(document.hidden)` 非 `window.focus`。
- `el-table-v2` 表头过滤：`headerCellRenderer`+fixed 浮层+computed；`LucideIcon` 须 `nameMap` 注册。

## 何时读本文档
新增功能想「接入既有体系」（命令面板 / 链式动作 / 小窗 / 提醒）或遇到上述通用坑时。
