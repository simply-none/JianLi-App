# 收益看板 earning（新浪财经数据源）

## 职责
基于**新浪财经**免费接口（无需 API Key）的股票/基金收益看板：录入持仓（股票成本价+股数 / 基金申购净值+份额），拉取实时行情与基金净值/估值，计算持仓盈亏、当日盈亏、组合总览、收益曲线与区间收益。与 `stock`（TickFlow 付费）模块完全解耦，数据源、数据层、页面均独立。

## 关键文件
- 渲染端：`src/views/earning/index.vue` + `components/`（PortfolioSummary / HoldingList / HoldingEditDialog / ReturnCurveChart / PeriodReturnCard）+ `api.ts`（封装 sina:*）+ `types.ts` + `store.ts`（Pinia 持仓 CRUD + 收益计算 + 历史序列）。
- 主进程：`electron/main/module/sinaFinance.ts`（`initSinaFinance` 注册 `sina:*` 通道）。
- 数据表：`earning_holdings`（newSql，主键 `key = ${type}:${code}`）。

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

## 已知坑 / 注意
- 改 `electron/main/module/sinaFinance.ts` **必须重启 Electron** 才生效。
- 新浪实时接口返回 GBK，`iconv-lite` 解码；缺 Referer 会被拒。
- 基金无实时价，只有净值/估值；估值来源优先级：新浪 XinCai →（开关开启时）天天基金兜底。
- 图表用 `echarts.init`，遵循 KlineChartCard 的「隐藏(0宽)不初始化 + ResizeObserver 重 init + 卸载 dispose」模式；红涨绿跌用 `.up`/`.down` 映射到 `--color-error`/`--color-success` token。
- 多 Tab 用全局 `TopTabs`，面板 `v-if` 切换（禁用 `<transition mode="out-in">`）。
