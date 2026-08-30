# 记账 (accounting)

## 职责
日常收支记账：分类配置（含关键字种子）、记账记录增删改、统计、月度预算（含超支提醒）、周期性账单自动记账、收支趋势报表导出。完整页与 `accountingMini` 小窗共用同一 Pinia store，数据天然一致，靠广播同步另一窗口。

## 关键文件
- 主页面：`src/views/accounting/index.vue`（薄壳）+ `components/AccountingPage.vue`（4 Tab 主布局）
- 组件目录（**按功能域分组，全部在模块自有页面下，不在 `src/components/` 公共区**）：
  - `components/record/`：RecordForm / RecordList / RecordSummaryList / RecordEditDialog / AmountInput / CategorySelector
  - `components/stat/`：StatisticsPanel（汇总+饼图+柱状图）、TrendChart（近 12 个月收支趋势 + CSV 报表导出）
  - `components/budget/`：BudgetPanel（月度总预算 + 分类预算进度、超支预警）
  - `components/recurring/`：RecurringPanel（周期账单列表）、RecurringEditDialog（新增/编辑）
  - `components/settings/`：SettingsDrawer（分类与关键字管理）
- 视图工具：`src/views/accounting/utils/rangeUtils.ts`（日/月/年范围换算，页面与统计面板共用）
- store：`src/store/useAccounting.ts`（主 store，聚合子模块；子模块成员拍平 return 保证 Pinia ref 解包）
  - `src/store/accounting/base.ts`：accountingIpc / nowStr / todayStr 共享工具
  - `src/store/accounting/budget.ts`：预算子模块（建表、CRUD、monthStatus 超支状态）
  - `src/store/accounting/recurring.ts`：周期账单子模块（CRUD + 自动记账引擎 + 5 分钟调度）
  - `src/store/accounting/recurringDate.ts`：周期日期纯函数（nextOccurrenceFrom / advanceOccurrence / cycleDayLabel）
- 常量：`@/constants/accounting`（表名 `accounting_records`/`accounting_categories`/`accounting_keywords`/`accounting_budgets`/`accounting_recurring`、类型、`DEFAULT_CATEGORIES`、`BUDGET_TOTAL_CATEGORY`、`RECURRING_CYCLE_LABELS`）
- 关联主进程：**无独立 accounting module**；走 `new-sql:*` IPC + `send('sync-data-to-other-window')` 广播；报表导出复用 `net-request:save-file`

## 路由
- `RouteNames.ACCOUNTING` → `/accounting`
- `RouteNames.ACCOUNTING_MINI` → `/accountingMini`

## 用到的 IPC 通道
- `new-sql:execute`（**仅 DDL**：建 categories/keywords/budgets/recurring 四表 + `uq_acc_rec_recurring` 唯一索引 + resetCategories 的 DELETE）
- `new-sql:query` / `count` / `insert` / `upsert` / `update` / `delete`（业务 CRUD，合规；**注意 count 参数是 `condition`，query 是 `conditions`**）
- `net-request:save-file`（TrendChart 报表导出：弹保存对话框写 CSV 文本，带 BOM）
- `send('sync-data-to-other-window', { accountingDataChanged:true })`（增删改后广播，另一窗口 `on` 监听刷新 categories/records/budgets/recurring）
- 小窗：`open-new-window`(`accountingMini`)/`close-new-window`、`get-store`/`set-store`

## 预算管理
- 表 `accounting_budgets`：`key TEXT PRIMARY KEY`（`YYYY-MM::分类名`）、month、category、amount；`category='_total_'` 表示月度总预算
- 超支提醒：store 的 addRecord/updateRecord/deleteRecord 与周期账单引擎生成记录后调 `checkOverspend(months)`，超支项通过 `sysNotify` 系统通知；会话内每 `month::category` 只提醒一次
- 预算状态口径：`monthStatus(month)` 返回总预算（首位）+ 各分类（按占比降序），`over`=支出≥预算，`near`=占比≥80%

## 周期性账单
- 表 `accounting_recurring`：id 自增，cycle=weekly/monthly/yearly，day 按 cycle 解释（weekly 1~7=周一~周日、monthly 1~31 月末收敛、yearly MM-DD 平年顺延 3-1）
- 引擎：store init 立即跑一轮 + 每 5 分钟；把 `next_date <= 今天` 的启用账单逐期生成 accounting_records（带 `recurring_id`，note 缺省用 name）并推进 next_date/last_date，单轮上限 366 期
- 防重：insert 前按 (recurring_id, record_date) count 查重 + `accounting_records(recurring_id, record_date)` 唯一索引兜底（索引在记录表未建时创建失败会静默跳过，下轮再试）→ 主窗/小窗并发安全
- 重新启用过期账单时 next_date 重置为「从今天起算」的下一期，避免历史洪水补账；编辑弹窗允许把 next_date 填成过去日期主动补账

## 收支趋势报表导出
- TrendChart：近 12 个月 收入/支出柱状 + 结余折线（ECharts + chartTheme 主题色 + ResizeObserver，与 StatisticsPanel 同模式）
- 导出 CSV：月度汇总（月份/收入/支出/结余）+ 分类明细（月份/类型/分类/金额）两区块，`\uFEFF` BOM 开头，经 `net-request:save-file` 保存

## 复用 / 集成点
- **小窗四件套**：`windowSections.ts:221`（key=`accounting`，storeKey=`accountingMiniWindowConfig`），`useWindowModeSetting.ts` 三映射，`useWindowMode` store，router `/accountingMini`；常驻需 `mouseEvents:true`
- **主/小窗同 store**：数据一致；靠 `sync-data-to-other-window` 让另一窗口重拉 categories/records/budgets/recurring
- 命令面板：未进 REGISTRY

## 特有坑 / 注意
- 建表用 `new-sql:execute` 属合法 DDL；**业务 CRUD 一律走 count/insert/upsert/update/delete**，不要为业务 SQL 裸 execute。
- `new-sql:count` 条件参数名是 `condition`（单数），`new-sql:query` 是 `conditions`（复数），混用会静默失效。
- 分类表主键为 `name`（TEXT PRIMARY KEY）；关键字表 `id` 自增；预算表主键 `key`；周期账单表 `id` 自增。首次启动分类表为空时由 `seedIfEmpty()` 写入种子。
- 记账组件必须放模块自有目录 `src/views/accounting/components/` 下按功能域分子目录，不放公共 `src/components/`（用户约定）。
- 小窗与主窗口同时打开时，任一侧变更都要触发 `sync-data-to-other-window`，否则两侧缓存短暂不一致。
