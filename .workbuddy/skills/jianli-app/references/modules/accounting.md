# 记账 (accounting)

## 职责
日常收支记账：分类配置（含关键字种子）、记账记录增删改、统计。完整页与 `accountingMini` 小窗共用同一 Pinia store，数据天然一致，靠广播同步另一窗口。

## 关键文件
- 主页面：`src/views/accounting/index.vue` + `components/`
- 小窗：`src/views/accountingMini/index.vue`
- store：`src/store/useAccounting.ts`（完整页与 accountingMini 共用；表名/种子来自 `@/constants/accounting`：`ACCOUNTING_TABLE`/`ACCOUNTING_CATEGORIES_TABLE`/`ACCOUNTING_KEYWORDS_TABLE`/`DEFAULT_CATEGORIES`）
- 关联主进程：**无独立 accounting module**；走 `new-sql:*` IPC + `send('sync-data-to-other-window')` 广播

## 路由
- `RouteNames.ACCOUNTING` → `/accounting`
- `RouteNames.ACCOUNTING_MINI` → `/accountingMini`

## 用到的 IPC 通道
- `new-sql:execute`（**仅 DDL**：建 `accounting_categories`/`accounting_keywords` 表，`useAccounting.ts:57/68/321/322`）
- `new-sql:count` / `new-sql:insert` / `new-sql:upsert` / `new-sql:delete`（业务 CRUD，合规）
- `send('sync-data-to-other-window', { accountingDataChanged:true })`（增删改后广播，另一窗口 `on` 监听刷新，`useAccounting.ts:89`）
- 小窗：`open-new-window`(`accountingMini`)/`close-new-window`、`get-store`/`set-store`

## 复用 / 集成点
- **小窗四件套**：`windowSections.ts:221`（key=`accounting`，storeKey=`accountingMiniWindowConfig`），`useWindowModeSetting.ts` 三映射，`useWindowMode` store（`accountingMiniWindowConfig`/`setShowAccountingMiniWindow`），router `/accountingMini`；常驻需 `mouseEvents:true`。
- **主/小窗同 store**：数据一致；靠 `sync-data-to-other-window` 让另一窗口重拉 categories/records。
- 命令面板：未进 REGISTRY。

## 特有坑 / 注意
- 建表用 `new-sql:execute` 属合法 DDL；**业务 CRUD 一律走 count/insert/upsert/delete**，不要为业务 SQL 裸 execute。
- 分类表主键为 `name`（TEXT PRIMARY KEY）；关键字表 `id` 自增、`category_id` 关联分类 name。首次启动分类表为空时由 `seedIfEmpty()` 写入 `DEFAULT_CATEGORIES` 种子。
- 小窗与主窗口同时打开时，任一侧变更都要触发 `sync-data-to-other-window`，否则两侧缓存短暂不一致。
