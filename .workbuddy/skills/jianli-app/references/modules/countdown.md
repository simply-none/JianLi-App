# 倒计时模块（countdown）

独立功能模块，不耦合番茄钟 / 提醒引擎：倒计时是「到某刻提醒 + 可暂停」，番茄钟是「工作/休息状态机」，
强行复用会 hack 字段。故独立主进程模块 `countdown.ts` + 独立表 `countdown`，只复用四件现成能力：
通知（`notify`/`App.vue`）、小窗四件套、持久化（`newSql`）、命令面板 `REGISTRY`。

## 数据模型（`countdown` 表，key TEXT 主键）

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | TEXT PK | 唯一 id（UNIQUE INDEX） |
| `name` | TEXT | 倒计时名称 |
| `mode` | TEXT | `datetime`(指定时刻) / `duration`(指定时长) |
| `end_time` | INTEGER | 目标结束时间戳(ms)——计时基准 |
| `duration` | INTEGER | 原始时长(ms)，用于「重置」 |
| `paused_remaining` | INTEGER | 暂停时冻结的剩余(ms)，恢复时作为 start 的 duration |
| `status` | TEXT | `running` / `paused` / `finished` |
| `notify` | INTEGER | 0/1 是否弹完成通知 |
| `sound` | TEXT | 提示音（预留字段，播放逻辑未接） |
| `color` | TEXT | 卡片 / 进度环颜色 |
| `created_at` / `finished_at` | INTEGER | 时间戳 |

建表：`ensureTableExists('countdown', undefined, 'key', { primaryKeyType: 'TEXT' })`（幂等 + 唯一索引）。

## 计时基准

存**结束时间戳** `end_time`，渲染端 `setInterval` 实时算 `end_time - Date.now()`；暂停只冻结 `paused_remaining`、
恢复重算 `end_time`，天然抗 Electron 窗口节流漂移。跨午夜 / 系统休眠唤醒无需特殊处理（基于时间戳）。

## 主进程（`electron/main/module/countdown.ts`）

- 持有 `Map<key, Timeout>`；`initCountdown()` 注册 IPC 并 re-arm 所有 `status='running'` 行（崩溃恢复）。
- 到点 `getWin()?.webContents.send('countdown-finished', { key, name })`。
- IPC：`countdown:list` / `save` / `delete` / `start` / `pause` / `reset`（均 `ipcMain.handle`）。
- 读写走 `newSql` 三件套（`query`/`upsert`/`del`），**严禁 `new-sql:execute`**。
- 改本文件必须重启 Electron。

## 前端结构（`src/views/countdown`）

```
types.ts                  CountdownRow / CountdownInput / CountdownStatus / CountdownMode
api/countdownApi.ts       IPC 薄封装（window.ipcRenderer.handlePromise）
composables/useCountdownTimer.ts  模块级单例 now，每 250ms 刷新；formatRemaining(ms)
store/useCountdown.ts     Pinia：rows / activeKey / active / load / save / remove / start / pause / reset
index.vue                 主页面：列表 + 大计时器 + 新建弹窗 + 监听 countdown-finished 刷新
components/CountdownList.vue  列表（VirtualList）
components/CountdownCard.vue  单卡：剩余 + 进度环
components/CountdownDialog.vue 新建/编辑（AppDialog 继承）
components/CountdownTimer.vue 大数字 + 进度环 + 控制
components/CountdownRing.vue  SVG 进度环（复用）
src/store/useCountdown.ts  同上端 Pinia
```

## 小窗四件套（`countdownMiniWindow`）

- `src/views/countdownMiniWindow/index.vue`：常驻浮动显示最临近结束的计时器；复用 `useCountdown` + `CountdownRing`。
- `useWindowMode.ts`：`showCountdownWindow` / `openCountdownWindow` / `countdownWindowConfig`（`mouseEvents: true`）。
- `windowSections.ts`：`key: 'countdown'`，`storeKey: 'countdownMiniWindow'`，`icon: 'Timer'`。
- `useWindowModeSetting.ts`：storeConfigMap / showSetterMap / storeVisibleMap 加 `countdown`。
- 路由 `COUNTDOWN_MINI` → `/countdownMiniWindow`（path 与 arg 一致）。

## 侧边栏 & 可见开关

- `src/utils/index.ts` 的 `iconMap` 加 `countdown: 'Timer'`。
- `src/layout/index.vue` 与 `src/views/routeSetting/index.vue` 的「效率工具」`names` 数组加 `'countdown'`。
- 路由 `COUNTDOWN` → `/countdown`，`meta.title: '倒计时'`。

## 快捷键 & 命令面板

- `electron/main/module/registerShortcut.ts`：`DEFAULT_COUNTDOWN_CONFIG` + `toggleCountdownWindow()` + `getCountdownWindow()` + 分发 `open_countdown_window`。
- `src/views/registerShortcut/index.vue`：常用功能列表加 `open_countdown_window`（名称「倒计时小窗口」）。
- 命令面板：`countdownSource.ts`（`>` 作用域），`useCommandSources.ts` 的 `REGISTRY` 加 `countdownSource`，
  `paletteConfig.ts` 的 `TYPE_META` / `SCOPE_PREFIX_MAP`(`'>': ['countdown']`) / `SCOPE_LABEL`(`'>': '倒计时'`)，
  `types.ts` 的 `CommandType` 加 `'countdown'`。

## 完成通知

- `src/App.vue` 在 `if (!isSecondWindow)` 块内监听 `countdown-finished`，弹 `sysNotify` + `appNotify`，
  点击打开倒计时主页（`RouteNames.COUNTDOWN`）。仅主窗口弹，避免小窗重复。
- 主窗口 `index.vue` 与小窗均监听 `countdown-finished` 刷新本地 `rows`。

## 红线（必须遵守）

1. 渲染端**禁 `import electron/*`**，全走 IPC。
2. 改 `electron/**` 必须重启；改 `src/**` 热重载。
3. 读写只用 `newSql` 三件套（query/upsert/del），**禁用 `new-sql:execute`**。
4. 主键 `key TEXT` + `CREATE UNIQUE INDEX`（防 upsert 退化为重复 INSERT）。
5. 小窗 `mouseEvents: true` 必带；路由 path 必须与 `arg` 一致。
6. 通知仅主窗口弹（`isSecondWindow` 守卫），小窗监听只刷新本地 rows 不弹通知。
7. 提示音 `sound` 字段已落库但未接入播放（Phase 3 预留）。
