# readme

## 安装

环境：

- node: v20.13.1

安装：cnpm install @vueup/vue-quill@latest --save --registry=https://registry.npmjs.org/

安装：

- npm i -g cnpm
- cnpm i xxx

## 版本管理

`standard-version`用法：设置了`"release": "standard-version"`之后，可以根据需要执行相应的代码：

- 发布主版本：`npm run release -- --release-as major`
- 发布次版本：`npm run release -- --release-as minor`
- 发布补丁版本：`npm run release -- --release-as patch`
- 发布预发布版本：`npm run release -- --prerelease alpha`
- 发布beta版本：`npm run release -- --prerelease beta`
- 发布rc版本：`npm run release -- --prerelease rc`
- 发布自定义版本：`npm run release -- --release-as 1.1.0`

## 打包

```shell
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm run build
```

## 鸣谢

- [electron-vite-vue]

## 重点对话记录

- 2026-08-29：通用习惯打卡的定位与落地顺序。定位 = 建在已 id 泛化提醒引擎之上的「复合提醒 + 记录 + 链式动作」系统，而非孤立功能；落地顺序（最小闭环优先）：① 数据模型+引擎复用 → ② 打卡小窗+通知 → ③ 链式动作注册表+1~2 个串接 → ④ 统计面板 → ⑤ 配置化。完整方案见 `docs/habit-checkin-design.md`。

## 项目改动记录

- 2026-08-29：新增「习惯打卡」模块（阶段①：数据模型 + 引擎复用）
  - 数据层 `src/views/habit/api/habitApi.ts`：自有表 `habit_def` / `habit_checkin`。
    读走 `new-sql:query`（支持 conditions.SqlStr、不按 SQL 推导列）、写走 `new-sql:upsert`、删走 `new-sql:delete`；
    **禁用裸 `new-sql:execute`** —— 它的 `extractColumnNames` 对 `SELECT *` / `DELETE` 猜不出列名时会兜底成
    `['name','value','created_at']` 并对已存在表 ALTER ADD COLUMN，污染业务表结构。
  - Store `src/store/useHabit.ts`：`syncReminders()` 是「引擎复用」的核心——把每个提醒时刻同步为提醒系统里的
    `mode='time' + repeat` 定点提醒（id 形如 `habit:<key>#<序号>`），调度 / 免打扰 / 重启恢复全部复用既有 newReminder 引擎。
    习惯停用会同步置提醒 `enabled=0`；删除习惯或删减时刻会清理对应旧提醒。
  - UI `src/views/habit/`：`index.vue`（薄壳）+ `components/HabitCard.vue` + `components/HabitEditDialog.vue`（走 AppDialog）。
  - 工具 `src/views/habit/utils/streak.ts`：连击统计（含「今天还没打但昨天打了不算断」的一天宽限）。
  - 路由：新增 `/habit`（`RouteNames.HABIT`），已挂进 `layoutRouters`。
  - 校验：`vue-tsc --noEmit` EXIT=0。
  - 已知边界：同步是单向的（习惯 → 提醒）。在「提醒」页手动改动/删除这些习惯提醒，下次打开习惯页会被同步覆盖回来。

- 2026-08-29：习惯打卡阶段②（打卡小窗 + 通知）
  - 新增小窗 `habitMiniWindow`：`src/views/habitMiniWindow/`（`index.vue` 薄壳 + `components/HabitCheckinPanel.vue`），
    路由 `/habitMiniWindow`，`useWindowMode` 增加 `showHabitWindow` / `habitWindowConfig` / `openHabitWindow()`。
  - **通知链路天然复用**：定时提醒到点在主进程发 `tips-trigger`，`App.vue` 已接住并弹系统+站内通知；
    本次识别出 `habit:` 前缀后，到点唤起打卡小窗，点通知也能再唤出。
  - `src/utils/notify.ts` 的 `sysNotify` / `appNotify` 各增加**可选**的 `onClick` 参数（放在最后，既有调用零影响）。
  - 小窗关闭走 `hide-new-window`（复用，不 destroy），与 quickNote 一致。
  - **关键坑**：`createOtherWindow` 在 `!ops.mouseEvents` 时会 `setIgnoreMouseEvents(true)` 进入鼠标穿透态
    （点不动也拖不动）。`habitWindowConfig` 必须显式带 `mouseEvents: true`。
    （既有 `clipboardWindowConfig` 就没带该字段，靠快捷键路径绕过，别照抄。）
  - `store.load()` 新增 `{ sync: false }` 选项：小窗只做只读展示与打卡，不重复跑提醒同步。
  - 习惯页新增「打开打卡小窗」按钮，便于不等提醒就测试。
  - 校验：`vue-tsc --noEmit` EXIT=0。纯渲染端改动，刷新页面即生效。

- 2026-08-29：习惯打卡阶段③（链式动作注册表 + 待办/笔记串接）
  - 新增 `src/views/habit/chainActions/`：`types.ts`（`HabitChainAction` 接口）+ `registry.ts`（注册表）+ `index.ts`（注册 + 派发/回滚）
    + `actions/{todoAction,noteAction}.ts`。**仿命令面板 REGISTRY 模式**：新增串接只加一个 action 文件并放进 `ACTIONS` 数组，核心零改动。
  - 已实现两个串接：
    - `todo` 完成关联待办 —— `todo_list` 先 `SELECT *` 取整行，再 upsert 覆盖 `status='completed'/completed=1/completedTime`，
      写完发 `update-todo-reminders` 让主进程重排截止提醒（与待办模块自身保存写法一致）。
    - `note` 自动写笔记日志 —— 写 `note_book`，key = `habit-log-<habitKey>-<date>`（同一天重复打卡=更新同一条，撤销即删除该条，不留垃圾笔记）。
  - `habit_def` 新增 `chainActions` 列（JSON）；编辑弹窗「打卡后串接」按注册表自动渲染可勾选项与说明。
  - **健壮性设计**：`checkIn`/`undoCheckIn` 改为返回 `ChainActionResult[] | null`（null=打卡失败）；
    单个串接动作失败只记录原因、降级提示，**绝不阻断其它动作、更不阻断打卡本身**。
  - 校验：`vue-tsc --noEmit` EXIT=0。纯渲染端改动，刷新页面即生效。

- 2026-08-29：习惯打卡阶段④（统计面板 + 日历热力图）
  - 新增 `src/views/habit/utils/stats.ts`（纯函数）：`buildHeatmap`（12 周网格，列优先，最后一列含今天）、
    `computeOverview`（累计打卡 / 打卡天数 / 最长连击 / 近 30 天活跃占比）、`countByDateOf`、`weekdayIndex`（0=周一）。
  - 新增组件 `components/HabitHeatmap.vue`（网格 + 图例，未来日期用虚线格避免误读）+ `components/HabitStats.vue`（4 张指标卡 + 热力图）。
    统计面板**通过 props 接收数据**（不直接读 store），保持原子性与可测性。
  - `index.vue` 用 `HabitStats` 替换原先手写的 3 格概览，顶部标题改为显示「共 N 个习惯，今日已打卡 M 个」。
  - **已做算法冒烟验证**：针对一周七天各作为结束日的情况校验网格对齐（格子数 84、起始日为周一、末格为该周周日、
    结束日落在其所在列且不计为未来、未来格子全部晚于结束日）—— 7 种对齐全部 ALL PASS（临时脚本跑完已删）。
  - 校验：`vue-tsc --noEmit` EXIT=0。纯渲染端改动，刷新页面即生效。

- 2026-08-29：习惯打卡阶段⑤（配置化：小窗设置页条目 + 全局热键 + 命令面板 `!` 作用域）
  - **小窗设置页**：`src/views/windowMode/config/windowSections.ts` 增加 `habit` 区块（`storeKey='habitMiniWindow'`、图标 `AlarmClockCheck`、尺寸预设 `HABIT_SIZE_OPTIONS`）；
    `useWindowModeSetting.ts` 的三个映射图（`storeConfigMap` / `showSetterMap` / `storeVisibleMap`）各补 `habit` 一项，均指向 `useWindowMode` 已有的 `habitWindowConfig` / `setShowHabitWindow` / `showHabitWindowC`。纯数据驱动，页面零改动。
  - **全局热键**：`electron/main/module/registerShortcut.ts` 增加 `toggleHabitWindow()` + `getHabitWindow()` + `DEFAULT_HABIT_CONFIG`，并在 `globalShortcutFn` 分发 `open_habit_window` 类型；
    `src/views/registerShortcut/index.vue` 的常用功能列表新增 `open_habit_window` 项，用户可在「快捷键注册」页自定义热键唤起打卡小窗（与番茄钟/待办/命令面板同一套机制）。`createOtherWindow` 创建时强制 `mouseEvents:true`，规避穿透坑。
  - **命令面板 `!` 作用域**：新增 `src/views/commandPalette/sources/habitSource.ts`，回车即**直接打卡**（写 `habit_checkin` 后再派发链式动作，与主流程一致，且刻意不碰命令面板所在渲染进程的 store 以避免跨窗重复同步提醒）；
    注册进 `useCommandSources` 的 `REGISTRY`。`types.ts` 的 `CommandType` 增加 `habit`；`paletteConfig.ts` 的 `SCOPE_PREFIX_MAP` / `SCOPE_LABEL` / `TYPE_META` 补 `!`→习惯；`useCommandPalette.ts` 的 `SCOPE_PATTERN` 正则补 `!`；输入框占位提示也同步说明。
  - 校验：`vue-tsc --noEmit` EXIT=0。主进程改动需重启 Electron 生效（registerShortcut.ts）；渲染端改动刷新即生效。

## 待处理事项

[x] 系统信息采集查看
[x] 自定义的sprider页面/接口获取
[x] 获取系统已经安装的应用列表及其可执行文件路径（通过注册表？）
[x] 多次切换强制切换当前状态会导致小窗口和主窗口的时间（倒计时）不一致

## 开发回顾

### 2025-11-07

vite打包报错：`Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`

解决方式：扩大内存，在默认情况下，Node.js 进程的内存限制是比较低的，通常为 1.5GB 到 2GB，这可能会导致在处理大型数据或执行内存密集型任务时出现内存不足的问题。可使用increase-memory-limit ，它是一个用于增加 Node.js 进程内存限制的工具。

用法如下：

```bash
cnpm i increase-memory-limit

buildMy: increase-memory-limit -m 4GB && npm run build
```

### 2025-11-04

引入worker线程，采集系统信息。这个意义在于，不会阻塞主线程，导致页面卡顿。

注意事项在于：主线程引入worker时，需要确保开发环境和打包环境下的workerjs文件路径可访问，例如`export const systemInfoWorkerPath = path.join(appRoot, VITE_DEV_SERVER_URL ? "./public/worker/systemInfo.cjs" : "./dist/worker/systemInfo.cjs");`。

### 2025-04-24

小组件订阅，是采用拖拽生成（左侧是小组件列表，右侧是空页面），还是采用弹窗选中组件的形式？

### 2025-04-23

小组件思维下，所有的模式，所有的组件，都是可以自由搭配属性的，所以，模式下的小组件，都应该是小组件本身属性的备份。其数据结构类似：

```javascript
// 模式结构：
const homeMode = {
  // 工作模式
  work: {
    // 工作模式属性
    label: 'xxx',
    value: 1,
    // 该模式共有css样式
    css: {
      // 该模式的背景颜色
      backgroundColor: 'xxx',
    },
    // 该模式下组件集合
    components: {
      // 组件名称
      bigDateTime: {
        // 组件属性
        // ...
        // 组件样式
        css: {
          // 组件字体
          font: 'xxx',
        }
      }
    }
  }
}
```

### 2025-03-10

小组件思维下，所有的模式都是引入小组件的，而非将组件固定在某种特定的模式中。

故而：

- 小组件应当单独维护一个状态库，包括不限于：
  - 组件名称、唯一标识
  - 组件特有的样式，包括字体、背景、颜色、定位
- 模式引入小组件，模式应当含有，模式全局化的样式
- 维护一个css样式的列表，其中可以包括：样式名称（字体），对应的css样式（font），以及样式的默认值，然后在模式中选择这些存在的样式，不存在的样式则不能够进行选择

### 2025-03-07

小组件思维，某种模式下，可以自有选配各种不同组件到桌面上。

小组件：

- 时钟（时钟、倒计时、番茄钟）
- 待办事项
- 便签
- 天气
- 日历
- 事件提醒（周期性事件、一次性事件），比如纪念日，喝水提醒
- 随时记录（记录自己的想法、记录自己的生活）

### 2025-03-06

electron框架中，控制台打印中文乱码，解决方法：在项目根目录输出命令`chcp 65001`

### 2025-03-02

消息通信，若是同步（sendSync）的，很可能会卡顿，所以需要异步通信（send）

### 2025-02-22

开启vue调试，安装vue/devtools，在html文件中加入devtools启动的脚本，启动命令npm run debug后才能npm run dev

### 2025-01-16

package.json中开发依赖应当放在devDependencies中，否则会报错

定时任务还是专用的库好，而非定时器
