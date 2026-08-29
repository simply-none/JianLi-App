# 股票查询分析 TickFlow (stock)

## 职责
对接 TickFlow API 的实时行情、市场深度、K 线、日内、标的基础数据查询与自选股管理；带多级缓存与可配置 TTL。完整页与 `stockMini` 共用，API Key 加密持久化。

## 关键文件
- 主页面：`src/views/stock/index.vue` + `components/` + `api.ts`（封装 stock:*）、`klineUtils.ts`、`types.ts`、`watchlistStore.ts`（Pinia 自选股）
- 小窗：`src/views/stockMini/index.vue`
- 关联主进程：`electron/main/module/stock.ts`（`initStock` 注册通道）、`stockCache.ts`（缓存表/元信息）、`stockTtlStore.ts`（TTL 覆盖持久化）；API Key 经 RSA 加密存 `basic_info`（`tickflow_api_key`），主进程解密后内存缓存

## 路由
- `RouteNames.STOCK` → `/stock`
- `RouteNames.STOCK_MINI` → `/stockMini`

## 用到的 IPC 通道（`api.ts` 封装）
- 行情（带缓存）：`stock:getQuotes` / `getQuotesBatch` / `getDepth` / `getKlines` / `getKlinesBatch` / `getIntraday` / `getIntradayBatch`
- 基础数据：`stock:getInstruments` / `getInstrumentsBatch` / `getExchanges` / `getExchangeInstruments` / `getUniverses` / `getUniverseDetail`
- 本地库：`stock:getExchangesDb` / `getInstrumentsDb` / `searchInstruments`
- 密钥：`stock:setApiKey` / `getApiKey`
- 其它：`stock:clearStockCache` / `getRecentSymbols` / `getWatchlist` / `addToWatchlist` / `removeFromWatchlist` / `getCacheTtl` / `setCacheTtl`
- 小窗：`open-new-window`(`stockMini`)/`close-new-window`、`get-store`/`set-store`

## 复用 / 集成点
- **小窗四件套**：`windowSections.ts:230`（key=`stock`，storeKey=`stockMiniWindowConfig`），`useWindowModeSetting.ts` 三映射，`useWindowMode` store（`stockMiniWindowConfig`/`setShowStockMiniWindow`），router `/stockMini`；常驻需 `mouseEvents:true`。
- **watchlistStore.ts**（Pinia）管理自选股，主/小窗共用。
- 命令面板：未进 REGISTRY。

## 特有坑 / 注意
- **缓存 TTL 常量**（`stockCache.ts:27`）：`realtime=5s`（行情/深度）、`intraday=30s`（当日分钟K线）、`kline=1h`（历史K线）、`daily=24h`（标的元数据）、`weekly=7d`（交易所/标的池）。可在面板经 `stock:setCacheTtl` 调，并持久化到 `basic_info` 的 `stock_cache_ttl`（`stockTtlStore.ts`）。参数变化才真正请求。
- **网络请求全在主进程**（Node 全局 fetch，绕 CORS、保护 Key）；API Key 不在渲染端明文出现。
- 缓存表 `stock_cache` 按「接口+参数」确定性键存储原始响应并带过期；`getRecentSymbols`/`watchlist` 等是另一张表，不会过期。
