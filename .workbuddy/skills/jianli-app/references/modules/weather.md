# 天气 (weather)

## 职责
按城市查询实时天气/预报，并支持获取当前定位城市。数据由主进程 `weather.ts` 无头爬取外部天气接口，定位由 `location.ts` 提供。页面为动态天气背景风格（Apple Weather 式渐变 + 毛玻璃卡片）。

## 关键文件（渲染端已组件化拆分）
- `src/views/weather/index.vue`：页面容器，编排状态与布局（约 230 行）
- `src/views/weather/types.ts`：WeatherData / ForecastDay / WeatherCondition 等类型
- `src/views/weather/constants.ts`：图标映射、背景渐变主题映射、热门城市、缓存配置（含 `getCacheTTL/setCacheTTL` 动态缓存时效）
- `src/views/weather/cityData.ts`：城市映射数据（省会/直辖市 31、全国地级市全量、江西/广东县级全量；`searchCityEntries` 关键字搜索；查询词统一「城市名+天气」，县级自动去「区/县/市」后缀取短名如「南康」「于都」）
- `src/views/weather/db.ts`：天气表 `weather_data`（city 主键 / data JSON / updated_at）读写，复用 `new-sql:execute` 通道；查询成功后 upsert 入库
- `src/views/weather/composables/`：`useWeather`（数据+缓存+定位）、`useCityHistory`（历史）、`useWeatherTheme`（主题/图标）、`useDebugLog`（调试日志）
- `src/views/weather/components/`：`WeatherSearch` `WeatherHero` `WeatherDetails` `DailyForecast` `WeatherSkeleton` `DebugPanel`
- 主进程：`electron/main/module/weather.ts`（基于 `crawler.ts` 新爬虫，`get-weather`、`get-weather-broadcast`）、`crawler.ts`（【新爬虫】通用工具）、`location.ts`、`dialog.ts`（`save-debug-data`）
- 无独立 store；城市历史与前端缓存走 localStorage，天气缓存走主进程内存

## 路由
- `RouteNames.WEATHER` → path `/weather`

## 用到的 IPC 通道
- `get-weather`（渲染→主，`invoke`，`{city, forceRefresh?}`）→ 返回天气数据（含 `condition` 归一化天气现象字段）
- `get-current-position`（渲染→主，`invoke`）→ 返回定位城市
- `save-debug-data`（渲染→主，`invoke`，`{data, fileName}`）→ 调试数据按需落盘
- `get-weather-broadcast`（独立通道，当前视图未直接使用）

## 数据模型（2026-08-29 起）
- `WeatherData` 新增：`indices: WeatherIndex[]`（生活指数：穿衣/洗车/紫外线/运动/感冒/过敏，含 level/tip）、`source?: string`（数据来源站名）
- `ForecastDay` 新增可选字段：`windDirection`（如「东风转东南风」）、`windPower`（如「<3级」）
- 解析器 `extractWeatherFromPage` 双层策略：**优先适配中国天气网结构**（`#hidden_title` 今日概况「08月29日08时 周六 小雨 34/27°C」、`ul.t > li` 7天预报、`li > span/em/p` 生活指数、`.crumbs a:last-child` 城市），未命中回退通用选择器扫描；当日风向/风力回填主字段 windDirection/windSpeed
- 渲染端新增 `LifeIndices.vue` 组件（指数卡片网格，`LIFE_INDEX_ICON_MAP` 名称→图标映射，未命中回退 Sparkles）；DailyForecast 行尾新增风向/风力列
- 页面展示顺序：Hero → 详情网格 → 生活指数 → 未来预报
- **爬虫链路已整体重写**：改用【新爬虫】工具 `crawler.ts`（见 `modules/crawler.md`），旧内嵌 steps/locatorStep 已删除。新链路：必应搜索「{城市}天气」→ 点第一条结果 → 自动跟随新标签页/本页跳转 → 等网络空闲 → 真实性校验（跳转/HTML 长度/readyState）→ 页面内抽取 → 有效性判定
- IPC 契约不变：`get-weather` / `get-weather-broadcast` 返回结构一致，渲染端无需改动
- 主进程新增 `normalizeCondition`：把中文/英文天气描述归一化为 `sunny/cloudy/rain/snow/thunder/fog/haze/wind/overcast/cloudy`，预报条目 `icon` 字段同样填充
- `isValidWeatherData`（温度/描述/湿度/预报至少命中两项）判定抽取结果；无效或爬取失败返回 null 不写缓存
- 每次爬取的**原始网页 HTML** 由 crawler.ts 保存到项目 `cache-data/` 文件夹
- 定位已移除：渲染端不再调用 `get-current-position`，由用户手动输入城市；进入页面默认加载**最后一次查询的城市**（数据库历史列表首位），无历史时展示空态。`LocationResult` 类型与定位调试 tab 已删除（主进程 location.ts 保留未动）
- 爬取耗时优化：等待链从「两次 networkIdle 长等待（可拖到 20s+）」改为「goto domcontentloaded → locator 等元素 → readyState 轮询至 complete → 2.5s 上限 settle」，常规耗时 4~6 秒
- 渲染端：数据读取顺序 = 数据库 weather_data（updated_at 未过时效）→ 主进程爬虫（主进程另有 2 小时内存缓存）；「使用缓存」开关移除，改为 Hero 卡上的「强制刷新」按钮（forceRefresh:true）；搜索栏右侧「Timer」下拉按钮可切换缓存时效（5分钟/30分钟/1小时/6小时/24小时）
- 搜索建议来自 `cityData.ts` 城市映射（显示 城市名 + 省份·层级）；查询词统一为「城市名+天气」，县级城市取去后缀短名（南康区→南康、于都县→于都，过短如「城区」保留原名）
- **SEO 规避**：crawler.ts 支持 `pickHref` 选项（起始页上下文挑链接直接 goto）；weather.ts 的 `pickWeatherSiteHref` 遍历必应结果返回第一个 weather.com.cn 链接（含必应 `u=a1<base64>` 跳转链接解码），未命中回退原点击第一条逻辑
- **数据库为唯一本地存储（不使用 localStorage 存天气数据）**：表 `weather_data`（id 主键 + city 唯一索引 / data JSON / updated_at / is_starred），走 `new-sql:execute` 通道；查询成功「先查后插/更」写入（保留星标）；缓存有效性 = 库中 `updated_at` 未过时效；历史 = 按 updated_at 倒序取最近 10 条（`HISTORY_LIMIT`）；星标 = `is_starred=1`，Hero 卡 Star 按钮切换（未查询过的城市无法星标）；删除单条历史连数据一起删，「清空历史」保留星标城市；仅缓存时效配置（`weather_cache_ttl`）仍存 localStorage
- 页面背景按 `condition` + 昼夜（18:00-6:00 为夜间）切换渐变（`useWeatherTheme.backgroundStyle`）
- 调试面板剥离为 `DebugPanel.vue`，右下角扳手悬浮按钮展开

## 特有坑 / 注意
- **newSql.execute 三个坑（db.ts 已规避，其他模块直接用 SQL 时务必注意）**：
  1. `isSelect` 只认 `SELECT` 开头 —— `PRAGMA table_info(...)` 会被当写语句执行（db.run），**永远拿不到 rows**；结构探测用 `SELECT * FROM pragma_table_info('表名')`（table-valued function）
  2. SELECT 结果在 `data.rows` 里，非 SELECT 只有 lastID/changes —— 封装层必须解包
  3. execute 对 INSERT/UPDATE 会按默认 schema（id 主键 + TEXT 列）**自动建表** —— 若目标表尚未由业务代码建出，会被劫持成错误结构；weather_data 按项目惯例用「id 主键 + city 唯一索引」而非 city 主键（SQLite 无法 ALTER 加主键，见 SKILL.md）
- 库文件路径见 `references/data-layer.md`（本机 `C:\Users\风起\Downloads\测试\db.sqlite`）；沙箱内核对库内容可先复制主文件到项目目录再只读打开
- `get-weather` 有主进程缓存（2h）+ 前端缓存（30min），调试看不到新数据先 `forceRefresh:true`
- 天气/定位接口失败时主进程返回错误对象而非抛异常，渲染端需判 `error` 字段
- 新增 Lucide 图标需先验证存在并注册进 `src/components/LucideIcon.vue` 的 nameMap（本次已注册 CloudRain/Wind/Droplets 等一批天气图标）
