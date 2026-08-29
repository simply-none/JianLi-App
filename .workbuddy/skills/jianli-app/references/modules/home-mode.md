# 主页模式 (homeMode)

## 职责
配置「主页模式」下各状态模式（日常/锁定/屏保/强制锁屏/空闲）的选项与展示，属于全局设置的一部分，数据落在 `useGlobalSetting` 的 `homeMode` 结构中。

## 关键文件
- 页面：`src/views/homeMode/index.vue`（Tab 切换 + 选项卡片，逻辑全在此文件）
- 原子组件：`src/views/homeMode/components/ModeOptionCard.vue`
- 状态源：`src/store/useGlobalSetting.ts`（`homeMode` / `homeModeOps` / `setHomeMode()`，`index.vue:63`）

## 路由
- `RouteNames.HOME_MODE` → `/homeMode`

## 用到的 IPC 通道
- `get-store` / `set-store`（经 `useGlobalSetting` 读写 `homeMode` 键；`setHomeMode` 内部 `setStore`）
- `sync-data-to-other-window`（主进程就绪后下发/广播，见 `useGlobalSetting.ts:512`）

## 复用 / 集成点
- **全局设置集成**：`homeMode` 是 `useGlobalSetting` 的一个字段，与番茄钟状态机、锁屏等共享同一套状态机（`StatusMode` 类型）。
- **主题变量联动**：`index.vue:95` 的 `gradientPalette` 引用 `src/styles/themes` 的 CSS 变量（logo/header/icon 渐变），随当前主题切换自动契合，不要硬编码颜色。
- **小窗四件套无关**：本页只管配置，不创建窗口；番茄/习惯等小窗的展示受 `homeMode` 影响但配置在此。

## 特有坑 / 注意
- **深拷贝绕响应式**：`index.vue:66-67` 用 `JSON.parse(JSON.stringify(homeModeC.value))` 建本地副本再改，避免直接改 store 引发连锁更新；回写时务必 `setHomeMode(homeModeCc.value)` 整树提交。
- **`mode` 嵌套结构易错**：`changeHomeMode():111` 要维护 `homeModeCc[key].mode[value]` 嵌套对象，并 `delete ...mode.undefined` 清理脏键，漏删会写脏数据。
- **Tab key 与 StatusMode 对齐**：`modeTabs:81` 的 `key` 必须等于 `homeMode` 的 `StatusMode` 取值，否则 `homeModeCc[activeTab]` 取不到。
