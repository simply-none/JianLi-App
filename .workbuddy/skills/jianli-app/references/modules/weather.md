# 天气 (weather)

## 职责
按城市查询实时天气/预报，并支持获取当前定位城市。数据由主进程 `weather.ts` 代理外部天气接口，定位由 `location.ts` 提供，每日壁纸由 `bing.ts` 提供。

## 关键文件
- `src/views/weather/index.vue`（调用点：行 259 `save-debug-data`、行 356 `get-current-position`、行 378 `get-weather`）
- 主进程：`electron/main/module/weather.ts`（`get-weather` 行 386、`get-weather-broadcast` 行 399）、`location.ts`（`get-current-position` 行 67）、`bing.ts`（`get-bing-image` 行 49）
- 无独立 store，城市/配置走组件内 ref 或 `useGlobalSetting`。

## 路由
- `RouteNames.WEATHER` → path `/weather`

## 用到的 IPC 通道
- `get-weather`（渲染→主，`invoke`，`{city, forceRefresh?}`）→ 返回天气数据
- `get-current-position`（渲染→主，`invoke`）→ 返回定位城市
- `get-bing-image`（渲染→主，`invoke`，常被主页 `home/minimalClock.vue` 复用）→ 每日壁纸
- `save-debug-data`（渲染→主，`invoke`，`{data, fileName}`）→ 调试落盘（`dialog.ts`）

## 复用 / 集成点
- `get-bing-image` 被主页时钟组件复用；`get-current-position` 可被任意需要定位的模块调用。
- 命令面板 REGISTRY 可跳转。

## 特有坑 / 注意
- `get-weather` 有本地缓存，`forceRefresh:true` 才强制拉远程；调试时若看不到新数据先确认是否命中缓存。
- 天气/定位接口为外部网络请求，失败时主进程返回错误对象而非抛异常，渲染端需判 `success/error` 字段。
- 天气广播 `get-weather-broadcast`（行 399）为独立通道，当前视图未直接使用，扩展「语音播报」时用。
