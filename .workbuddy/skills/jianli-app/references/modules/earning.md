# 收益看板 earning（新浪财经数据源）

## 职责
基于**新浪财经**免费接口（无需 API Key）的股票/基金收益看板：录入持仓（股票成本价+股数 / 基金申购净值+份额），拉取实时行情与基金净值/估值，计算持仓盈亏、当日盈亏、组合总览、收益曲线与区间收益。与 `stock`（TickFlow 付费）模块完全解耦，数据源、数据层、页面均独立。

## 关键文件
- 渲染端：`src/views/earning/index.vue` + `components/`（PortfolioSummary / HoldingList / HoldingEditDialog / PortfolioManageDialog / ReturnCurveChart / PeriodReturnCard）+ `api.ts`（封装 sina:*）+ `types.ts` + `store.ts`（模块级单例：持仓/组合 CRUD + 收益计算 + 历史序列 + 市场时段判断）。
- 主进程：`electron/main/module/sinaFinance.ts`（`initSinaFinance` 注册 `sina:*` 通道）。
- 数据表（均为 newSql，无需手写 DDL）：
  - `earning_holdings`：主键 `key = ${type}:${code}`，含 `portfolio_id`（旧数据无此列时由 newSql 首次写入自动 `ADD COLUMN`）。
  - `earning_portfolios`：主键 `id`（固定 `default` 默认组合 + `p_${Date.now()}` 用户组合），含 `name`/`sort`。

## 路由
- `RouteNames.EARNING` → `/earning`

## 数据源（新浪财经，主进程内请求）
| 类型 | 接口 | 处理 |
|---|---|---|
| 股票/ETF 实时 | `https://hq.sinajs.cn/list=sh600519,sz000001` | **GBK**，须 `Referer: https://finance.sina.com.cn`；`iconv-lite` 解码 |
| 股票历史K线 | `money.finance.sina.com.cn/.../CN_MarketData.getKLineData?symbol=&scale=240&ma=no&datalen=` | UTF-8 JSON |
| 基金历史净值 | `stock.finance.sina.com.cn/fundInfo/api/openapi.php/CaihuiFundInfoService.getNav?symbol=&datefrom=&dateto=&page=` | UTF-8 JSON，每页20自动翻页 |
| 基金盘中估值 | `app.xincai.com/.../XinCaiFundService.getFundYuCeNav?symbol=` | 新浪系；失败可回落天天基金（可开关默认关） |

## 用到的 IPC 通道
- `sina:getStockQuotes(codes[])` / `sina:getStockKline(symbol,scale,datalen)` / `sina:getFundNav(code,from,to)` / `sina:getFundEstimate(code,fallback)` / `sina:getBatchQuote(items[],estimateFallback)`。
- 持仓持久化走 newSql：`new-sql:query` / `new-sql:upsert` / `new-sql:delete`（由 `src/utils/common.ts` 的 `getSqlData/setSqlData/deleteSqlData` 封装）。

## 收益计算口径（红涨绿跌）
- 股票市值=现价×股数；基金市值=最新净值(或估值)×份额。
- 累计盈亏=市值−成本(成本价×数量)；当日盈亏=(现价−昨收)×股数（基金用 估值−昨净）。
- 区间收益：股票取起止 `close` 比；基金用 `ljjz` 累计净值比（含分红）；组合用各标的序列日期交集对齐后求组合净值曲线。
- 收益曲线：取所有持仓历史序列的**日期交集**对齐，逐日算组合市值，相对首日出值归一为收益率 %。

## 接入点
- `src/layout/index.vue` 效率工具组 `names` 已含 `earning`（菜单入口）。
- `src/views/routeSetting/index.vue` 已含 `earning`（设置里可隐藏/显示）。
- `src/router/index.ts` 已加 `RouteNames.EARNING` 与 `/earning` 路由。

## 组合（portfolio）功能
- **维度**：页面分「股票收益」（持仓明细列表）与「组合收益」（收益曲线 + 区间收益）两个 Tab，顶部组合切换器可在「全部 / 各组合」间过滤所有派生数据。
- **组合实体**：`earning_portfolios` 表；`store.portfolios` 内存镜像；`ALL_PORTFOLIOS='all'` 表示聚合全部。默认组合 `id='default'` 不可重命名/删除。
- **CRUD**（均走 `store` 方法，经 `savePortfolio`/`renamePortfolio`/`removePortfolio`）：
  - 新增：弹窗输入名称 → `savePortfolio(name)`，id=`p_${Date.now()}`。
  - 重命名：默认组合保护，其余可改。
  - 删除：`removePortfolio(id)` 先将其下持仓 upsert 回默认组合（newSql 自动补 `portfolio_id` 列，无需裸 DDL），再删组合记录；若当前正选该组合则切回「全部」。
- **录入归属**：`HoldingEditDialog` 新增「所属组合」下拉；未指定时，当前选具体组合归该组合，选「全部」归默认组合（`store.saveHolding` 内决定）。
- **派生数据按组合过滤**：`filteredHoldings`/`rows`/`summary` 均按 `currentPortfolioId` 过滤；`portfolioCurve(periodDays, pid?)` 与 `periodReturns(periodDays, pid?)` 接受可选 `pid`；`ReturnCurveChart`/`PeriodReturnCard` 已 `watch(currentPortfolioId)` 自动重载。
- **组合管理弹窗**：`PortfolioManageDialog.vue`，列出组合并提供「切换 / 重命名 / 删除」，删除前 `ElMessageBox` 二次确认，其下持仓退回默认组合。

## 刷新与缓存策略（避免频繁调用接口）
- **主进程动态 TTL**：交易时段实时类（行情/估值）缓存 5s、缓变类（K线/净值）缓存 1h；**非交易时段（收盘后~开盘前、周末、节假日）改为缓存到下一交易开盘**（封顶 6h/12h），保证收盘后只回源一次。
- **`sina:getBatchQuote` 内部各子请求均套进程缓存**（早期版本该通道每次真回源，是频繁调用接口的根因）。
- **渲染端 `refreshQuotes(force)`**：非交易时段且已有快照时直接跳过请求；交易时段每 60s 轻量轮询（非交易时段轮询被内部 skip，不回源）。
- **手动刷新**按钮与**估值兜底开关**切换均走 `force=true` 强制拉取；页面顶部显示「交易中/已收盘」状态点 + 数据更新时间。
- **友好提示（避免被限流）**：常驻 `api-tip` 提示条说明免费接口已做缓存限频；刷新按钮在非交易时段显示「手动刷新仍会回源，请谨慎点击」的 `title`；持仓空态也提示「新浪免费接口，勿高频刷新」。

## 已知坑 / 注意
- 改 `electron/main/module/sinaFinance.ts` **必须重启 Electron** 才生效。
- 新浪实时接口返回 GBK，`iconv-lite` 解码；缺 Referer 会被拒。
- 基金无实时价，只有净值/估值；估值来源优先级：新浪 XinCai →（开关开启时）天天基金兜底。
- 图表用 `echarts.init`，遵循 KlineChartCard 的「隐藏(0宽)不初始化 + ResizeObserver 重 init + 卸载 dispose」模式；红涨绿跌用 `.up`/`.down` 映射到 `--color-error`/`--color-success` token。
- 多 Tab 用全局 `TopTabs`，面板 `v-if` 切换（禁用 `<transition mode="out-in">`）。
