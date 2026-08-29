# 小窗设置页 (windowMode)

## 职责
所有常驻小窗的统一设置页：开关、位置/尺寸/间隙/皮肤/排版配置，数据驱动（配置清单驱动页面，新增小窗只改配置清单）。

## 关键文件
- 页面：`src/views/windowMode/index.vue`（薄壳，遍历 `WINDOW_SECTIONS`；顶部 Tab 用通用 `TopTabs` 组件）
- 顶部 Tab 组件：`src/components/TopTabs.vue`（通用，单行不换行 + 滚轮横滚 + 滚动条仅 hover 显示）
- 区块组件：`src/views/windowMode/components/WindowModeSection.vue`、`WindowModeCustomDialog.vue`
- 配置清单（数据驱动核心）：`src/views/windowMode/config/windowSections.ts`（`WINDOW_SECTIONS:174`、`WindowKey` 类型 `:6-16`）
- 逻辑层：`src/views/windowMode/composables/useWindowModeSetting.ts`（`storeConfigMap:19`、`patch():79`、`applyWindow():114`）
- 状态源：`src/store/useWindowMode.ts`（各小窗 config/visible + 三映射）

## 路由
- `RouteNames.WINDOW_MODE` → `/windowMode`

## 用到的 IPC 通道
- `set-store`（`window-mode:{storeKey}`，由 `useWindowModeSetting.patch():86` 经 `common.setStore` 落 `basic_info`）
- `open-new-window` / `close-new-window` / `hide-new-window`（由 `useWindowMode` 各 watch 触发）
- `sync-data-to-other-window`（配置变更广播给已开小窗）
- `get-store` / `set-store`（store 初始化读取 `window-mode:xxx`）

## 复用 / 集成点
- **小窗四件套核心**：本页就是四件套之一。新增小窗须同时改：① `windowSections.ts` 的 `WINDOW_SECTIONS` 加一条；② `useWindowModeSetting.ts` 的 `storeConfigMap/showSetterMap/storeVisibleMap` 三映射（`:19-56`）；③ `useWindowMode.ts` 的 config + setter + watch；④ `router/index.ts` 加路由；⑤ 常驻小窗 config 必须带 `mouseEvents:true`。
- **旧键迁移**：`useWindowMode.ts:369` 的 `migrateOldConfig` 把 `pomodoroMiniWindowConfig` 等旧键迁到 `window-mode:` 命名空间，仅当新键不存在才迁移，避免覆盖。
- **顶部 Tab 用通用 `TopTabs`**：`sectionTabs` 由 `WINDOW_SECTIONS.map(s => ({ key: s.key, label: s.title, icon: s.icon }))` 生成（不指定 `color`，回退主题主色）；消费处 `@update:modelValue="(k) => activeTab = k as WindowKey"`。内容面板（当前 `WindowModeSection`）直接 `:key` 渲染，不要包 `<transition mode="out-in">`（会卡白）。

## 特有坑 / 注意
- **storeKey 必须与落库键一致**：`windowSections.ts:3` 注释强调 `storeKey` 须和 `useWindowMode`/主进程使用的 `window-mode:{storeKey}` 一致，否则设置页写 A、小窗读 B。
- **`mouseEvents:true` 别漏**：常驻捕获态小窗（habit/commandPalette 等）config 必须显式带，否则 `createOtherWindow` 在 `!ops.mouseEvents` 时 `setIgnoreMouseEvents(true)` 进入穿透态，点不动拖不动（`useWindowMode.ts:167-170`）。
- **patch 三动作**：`patch()` 同时写本地副本 + store + 落库，顺序与原实现一致，不要只改一处否则设置页与小窗不同步。
- **applyWindow 先关后开**：已开窗口用 300ms 延迟重启让新配置生效，不要直接改 config 期望热更新。
