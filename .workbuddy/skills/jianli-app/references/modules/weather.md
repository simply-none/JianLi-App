# 天气 (weather)

## 职责
按城市查询实时天气/预报。**数据由主进程的多数据源适配器架构获取（2026-09-29 起）**：按用户配置的优先级依次尝试「和风天气 → Open-Meteo → 内置爬虫兜底」，任一成功即返回，失败自动降级并记录轨迹。页面为动态天气背景风格（Apple Weather 式渐变 + 毛玻璃卡片），**展示字段按数据源能力清单（capabilities）分级渲染**。

## ✅ 架构：多数据源可插拔 + 字段分级展示（2026-09-29 已实施）
> 完整方案见 `C:\cod\jianli\天气接口免费方案调研_2026-09-29.md`（v2）。

**主进程目录（`electron/main/module/weather/`，10 个文件）**：
| 文件 | 职责 |
|---|---|
| `index.ts` | **IPC 注册 + 内存缓存**（入口）。缓存 key = `${providerId}:${city}`；另有 `CITY_LAST[city]` 做跨源回显；保存配置后清空两者 |
| `registry.ts` | **降级链调度**：`resolveChain` / `fetchWithFallback` / `withTimeout` / `probeProvider`；`_trace` 记录每个源的成功/跳过/失败与耗时 |
| `config.ts` | **配置读写 + 凭据加密**。存 SQLite `basic_info`，key = `weatherConfig`；`splitSecrets`/`mergeSecrets` 把 `secret:true` 字段抽进 `__secret` 信封 |
| `capability.ts` | `ALL_CAPABILITIES`(26) / `CAPABILITY_LABEL` / `CAPABILITY_GROUP` / `PROVIDER_CAPABILITIES` / `hasCapabilityDomain` / `capabilityLabel` |
| `normalize.ts` | `normalizeCondition` / `isValidWeatherData`（严格，爬虫用）/ `isUsableWeatherData`（宽松，adapter 用）/ `compassToCn` / `degreeToCn` / `windScaleToText` / `round` / `isoToHm` / `maskSecret` / `validateQWeatherHost` |
| `types.ts` | 全部共享类型（`WeatherData` / `WeatherProvider` / `ProviderConfigField` / `WeatherModuleConfig` / `WeatherConfigForUi` 等） |
| `providers/qweather.ts` | 和风适配器（JWT Ed25519 + GeoAPI + 6 接口 `Promise.allSettled`） |
| `providers/openMeteo.ts` | Open-Meteo 适配器（零配置，WMO 码→中文映射） |
| `providers/crawler.ts` | 内置爬虫适配器（原实现迁移，另抽 warnings） |
| `data/cnCities.ts` | 离线城市坐标表（31 省会 + ~290 地级市 + `COUNTY_TO_PREFECTURE` 县级短名映射），供 Open-Meteo 定位 |

**`electron/main/module/weatherProviders.ts`**（barrel）：`PROVIDERS` 数组 + `getAllProviders()` / `getProvider(id)`。**新增数据源只需在此 import 并加入数组**。此文件独立存在是为打破 `weather/config.ts` ↔ `providers` 的循环依赖。

**`electron/main/module/weather.ts` 已改为转发层**（~45 行）：只 `export { initWeather, clearWeatherCache }` + 类型/capability 转发 ⇒ `main/index.ts` 的 `['weather', initWeather]` 调用点零改动。

**核心机制**：
- `WeatherProvider` 接口：`{ id, label, zeroConfig, capabilities, configSchema, fetch(), probe?() }`
- `capabilities: WeatherCapability[]`（如 `current.pressure` / `forecast.hourly` / `indices.life` / `air.quality`）—— **分级展示的唯一依据**，运行时按「真拿到数据的接口」二次裁剪（用 `Promise.allSettled`，指数/AQI 失败不让整源失败）
- 渲染端 `useWeatherCapability().has(cap)` 条件渲染；**`has()` 在无 `capabilities` 时回退 true（全展示）** ⇒ v1 旧缓存的 `weather_data.data` 天然兼容，`db.ts` **无需迁移**
- 必填字段（`temperature`/`feelsLike`/`humidity`/`windDirection`/`windSpeed`/`visibility`/`updateTime`/`forecast`）**保持不变**，adapter 负责兜底 ⇒ `WeatherHero`/`DailyForecast`/`useWeatherTheme` 无需改必填性

**凭据存储**：复用 `vault/crypto.ts` + `vault/deviceKey.ts`，`encryptVault` 信封存 `basic_info`（key `weatherConfig`）—— 与 `stock.ts` 的 `stockVault` **完全同路径**（注意：`vault/crypto.ts` 注释写「密文绝不进 SQLite」，那是针对 twoFactor/passwordVault 的文件保险库；stock 已确立 basic_info 这条合法路径）。`weather:get-config` **绝不回传明文**，只回 `{configured, preview}`。

**和风要点（已核实）**：
- 免费 **5 万次/月**；⚠️ **公共域名 `api|devapi|geoapi.qweather.com` 2026 年起逐步停服** ⇒ 必须用控制台专属 API Host（形如 `h2a9cf3mhs.xy.qweatherapi.com`），**Host 是身份认证的一部分，必须可配置**（`validateQWeatherHost` 会拦截公共域名）
- ⚠️ **API KEY 自 2027-01-01 起限制每日请求量** ⇒ 默认走 **JWT (EdDSA/Ed25519)**：Header `{alg:'EdDSA',kid}`、Payload `{iss:开发者ID, sub:项目ID, iat:now-30, exp:iat+900}`（上限 24h），**必须 Base64URL**。Node 原生 `crypto.createPrivateKey({key,format:'pem'})` + `crypto.sign(null, data, key)` **零依赖**；失败回退 `jose`
- 接口：`/geo/v2/city/lookup`（**支持中文城市名与县级**，`range=cn`）、`/weather/v1/current|daily|hourly/{lat}/{lon}`、`/v7/indices/1d?type=0`、`/v7/air/now`、`/v7/warning/now`、`/v7/minutely/5m`
- ⚠️ **v1 单位陷阱**：`humidity` / `cloudCover` / `precipitation.probability` 都是 **0–1 小数**，必须 ×100（旧 v7 是百分数）；`visibility` 单位**米**
- 生活指数 16 类：1运动 2洗车 3穿衣 4钓鱼 5紫外线 6旅游 7花粉过敏 8舒适度 9感冒 10空气污染扩散 11空调 12太阳镜 13化妆 14晾晒 15交通 16防晒
- 现有 `constants.ts` 的 `LIFE_INDEX_ICON_MAP` 8 项**正好对应 type 3/2/5/1/9/7/6/10，图标无需新增**

**Open-Meteo（兜底）**：非商用 <10000 次/日、**零 Key**、CC BY 4.0。`weather_code` 是 WMO 数字码需自建中文映射（`WMO_CODE_CN`）；**无生活指数、无空气质量、无预警、无月相**；不支持中文城市搜索 ⇒ 依赖 `data/cnCities.ts` 离线坐标表。

> **坐标解析四级顺序（2026-09-29 修复县级城市）**：
> 1. **直接命中** `CAPITALS` / `PREFECTURES`
> 2. **去后缀再试**（`市|县|区|自治州|地区|盟…`）
> 2b. **去后缀后是县级短名** → 查 `COUNTY_TO_PREFECTURE` 映射到所属地级市
> 3. **本身即县级短名**（渲染端传「南康」「于都」）→ 同上映射
> 4. **包含匹配**（`name.includes(key)`，如「江西赣州南康区」含「赣州」）
>
> ⚠️ **为什么必须有 2b/3**：渲染端县级城市的查询词是**去后缀短名**（`cityData.ts` 的 `shortCityName`：南康区→**南康**），而坐标表只收省会+地级市 ⇒ 不加映射时「南康」查不到坐标、Open-Meteo 直接失败降级到爬虫。`COUNTY_TO_PREFECTURE` 现覆盖江西全省 98 个县级短名，键为去后缀短名；**新增省份时需同步补映射**。县级坐标取地级市近似值（市级精度，非区级质心，这是刻意的诚实行为）。

## 关键文件（渲染端已组件化拆分）
- `src/views/weather/index.vue`：页面容器，编排状态与布局；**区块顺序**：Hero → Details → Alert → MinutelyRain → AirQuality → HourlyForecast → AstroCard → LifeIndices → DailyForecast → SourceBadge
- `src/views/weather/types.ts`：与主进程 `weather/types.ts` **一一对应**（改一侧必须同步另一侧）
- `src/views/weather/capability.ts`：`useWeatherCapability()` / `CAPABILITY_LABEL` / `CAPABILITY_GROUP` / `capabilityLabel` / `aqiColor` / `WARNING_SEVERITY_COLOR`
- `src/views/weather/api.ts`：5 个 IPC 封装（`fetchWeather` / `fetchWeatherConfig` / `saveWeatherConfig` / `probeWeatherProvider` / `fetchAvailableProviders`）
- `src/views/weather/constants.ts`：图标映射、背景渐变主题映射、热门城市、缓存配置（含 `getCacheTTL/setCacheTTL`）
- `src/views/weather/cityData.ts`：城市映射数据（省会/直辖市 31、全国地级市全量、江西/广东县级全量；`searchCityEntries`）
- `src/views/weather/db.ts`：天气表 `weather_data`（city 主键 / data JSON / updated_at / is_starred）读写；**data 存 `WeatherData` 全量 JSON ⇒ 新增的 `capabilities`/`_trace` 自动持久化，无需迁移**
- `src/views/weather/composables/`：`useWeather`（数据+缓存，支持 `providerId`，记降级链日志）、`useCityHistory`、`useWeatherTheme`、`useDebugLog`
- `src/views/weather/components/`：`WeatherSearch` `WeatherHero` `WeatherDetails` `DailyForecast` `LifeIndices` `WeatherSkeleton` `DebugPanel` + **`HourlyForecast` `AirQuality` `WeatherAlert` `MinutelyRain` `AstroCard` `SourceBadge` `WeatherProviderSettings` `ProviderForm`**
- 主进程：`electron/main/module/weather/`（见上）、`weatherProviders.ts`（registry barrel）、`weather.ts`（转发层）、`crawler.ts`（通用爬虫工具）、`location.ts`、`dialog.ts`（`save-debug-data`）
- 无独立 store；城市历史走 localStorage，天气缓存走主进程内存 `WEATHER_CACHE` / `CITY_LAST`

## 路由
- `RouteNames.WEATHER` → path `/weather`

## 用到的 IPC 通道
- `get-weather`（渲染→主，`invoke`，`{city, forceRefresh?, providerId?}`）→ `WeatherData | null | {error}`。`providerId` 为**可选新增**，指定单一数据源**不降级**
- `weather:get-config`（`invoke`）→ `WeatherConfigForUi`（脱敏，含 `availableProviders` 快照，**绝不含明文凭据**）
- `weather:save-config`（`invoke`，`WeatherConfigSavePayload`）→ `{ok, message}`。**凭据字段传空串 = 保持原值**（脱敏回显不该逼用户重填），传 `null` = 清空
- `weather:probe-provider`（`invoke`，`{id, options, credentials, timeout}`）→ `{ok, message}`（可用未保存的草稿凭据）
- `weather:available-providers`（`invoke`）→ `ProviderSummary[]`
- `get-weather-broadcast`（独立通道，当前视图未直接使用）
- `get-current-position`（**已弃用**，渲染端不再调用）、`save-debug-data`（调试数据落盘）

## 数据模型
- `WeatherData` **基础字段（必填）**：`temperature` / `feelsLike` / `description` / `humidity` / `windDirection` / `windSpeed` / `visibility` / `updateTime` / `forecast` / `city` / `condition`
- `WeatherData` **扩展字段（全部可选）**：`source` / `indices` / `capabilities` / `pressure` / `dewPoint` / `cloudCover` / `windGust` / `windScale` / `precipitation` / `precipitationText` / `uvIndex` / `isDay` / `airQuality` / `weatherWarnings` / `hourly` / `minutely` / `astro` / `_trace`
- `ForecastDay`：`date` / `high` / `low` / `description` / `icon` + 可选 `windDirection` / `windPower`
- 其余：`HourlyForecast` / `MinutelyRain` / `AirQuality` / `WeatherWarning` / `AstroInfo` / `WeatherIndex` / `ProviderTrace` / `ProviderSummary` / `SecretStatus`
- `WeatherDetails.vue` **12 格声明式**：6 个基础（体感/湿度/风向/风力/能见度/更新时间）+ 6 个扩展（气压 Gauge / 露点 Thermometer / 云量 Cloudy / 阵风 Wind / 紫外线 Sun / 降水量 Umbrella），**按能力 + 值双重过滤**（值为空也剔除）
- 页面展示顺序：Hero → 详情网格 → **预警（置顶醒目）** → **分钟级降水** → **空气质量** → **逐小时预报** → **日出日落/月相** → 生活指数 → 未来预报 → **数据来源标识**
- 主进程 `normalizeCondition` 把中文/英文天气描述归一化为 `sunny/cloudy/rain/snow/thunder/fog/haze/wind/overcast/unknown`，预报条目 `icon` 字段同样填充
- `isValidWeatherData`（严格，爬虫出口：温度/描述/湿度/预报至少命中两项）；`isUsableWeatherData`（宽松，adapter 出口：温度或描述至少一个有效 —— 不同源字段丰俭不同）
- 定位已移除：渲染端不调用 `get-current-position`；进入页面默认加载**最后一次查询的城市**（数据库历史列表首位），无历史时展示空态
- 渲染端：数据读取顺序 = 数据库 `weather_data`（updated_at 未过时效，**仅在不指定 providerId 时**）→ 主进程降级链（主进程另有按 `cacheDuration` 的内存缓存）；Hero 卡上的「强制刷新」按钮（`forceRefresh:true`）；搜索栏右侧「Timer」下拉切缓存时效（5分钟/30分钟/1小时/6小时/24小时）
- 搜索建议来自 `cityData.ts`（显示 城市名 + 省份·层级）；查询词统一「城市名+天气」，县级取去后缀短名（南康区→南康、于都县→于都）
- **数据库为唯一本地存储**：表 `weather_data`（id 主键 + city 唯一索引 / data JSON / updated_at / is_starred），走 `new-sql:execute` 通道；查询成功「先查后插/更」（保留星标）；缓存有效性 = `updated_at` 未过时效；历史 = 按 updated_at 倒序取最近 10 条；星标 = `is_starred=1`（未查询过的城市无法星标）；删除单条历史连数据一起删，「清空历史」保留星标城市；仅缓存时效配置（`weather_cache_ttl`）仍存 localStorage
- 页面背景按 `condition` + 昼夜（18:00-6:00 为夜间）切换渐变（`useWeatherTheme.backgroundStyle`）
- 调试面板 `DebugPanel.vue`（右下角扳手悬浮展开）**3 个 tab**：请求日志 / 天气原始数据 / **数据源轨迹**（轨迹 + 本次能力清单 tags）

## 数据源配置界面（抽屉）
- 入口：天气页搜索栏右侧「数据源」按钮（`WeatherSearch.vue` emit `openSettings`）→ `index.vue` 挂 `WeatherProviderSettings`（`el-drawer`，620px，rtl）
- `WeatherProviderSettings.vue`：左侧源列表（**可上移/下移调整优先级** + 启停开关 + 免配置/已配置/待配置 tag）+ 全局缓存时长与超时；右侧选中源的动态表单 + 「测试连接」按钮（调 `weather:probe-provider`，**用草稿值**）
- `ProviderForm.vue`：按 `configSchema` 动态渲染（text/password/textarea/select/number），支持 `when` 条件显示（如和风 `authMode === 'jwt'` 才显 kid/projectId/developerId/privateKey）；敏感字段**留空 = 保持原值**，占位提示显示「已保存：`abc****xyz`」；底部按 `CAPABILITY_GROUP` 罗列该源支持的能力 tags
- 保存成功后 `index.vue` 的 `handleSettingsSaved` 会**强制刷新当前城市**，让新链路立即生效

## 特有坑 / 注意
- **改主进程必须重启 Electron**（`weather/` 全部文件、`weatherProviders.ts`、`weather.ts` 都算主进程）
- **`types.ts` 双份需同步**：主进程 `electron/main/module/weather/types.ts` 与渲染端 `src/views/weather/types.ts` 结构一一对应，改一侧必须同步另一侧
- **`../types` vs `./types`**：`src/views/weather/` 目录内的**文件**（`capability.ts`/`api.ts`）必须用 `./types`，写成 `../types` 会解析到不存在的 `src/views/types`（TS2307）；而**子目录**里的组件才用 `../types`
- **⚠️ 传 IPC 的 payload 必须先剥 Proxy**（2026-09-29 修）：Electron IPC 用结构化克隆算法，**Proxy 不可克隆**。Vue `reactive()` / `ref()` 包装的值都是 Proxy，直接 `invoke` 会抛 **`An object could not be cloned.`**（表象是「保存失败」）。已修位置：① `WeatherProviderSettings.vue` 的 `handleSave` 传 `providerOrder: [...draft.order]`（原先直接传 `draft.order`，是 reactive Proxy 数组 —— 本次报错的根因）；② `api.ts` 新增 `toPlain()` **统一在 invoke 前剥离**：`toRaw()` 递归下钻（`toRaw` 只剥最外层，深层仍是 Proxy）+ 丢弃函数/Symbol。**凡是把 reactive 数据发给主进程，一律经 `toPlain()` 或先展开成普通数组/对象。**
- **`Partial<Record<ProviderId, X>>` 直索引会报 TS7053**（隐式 any）⇒ 加一层类型安全读写函数，别用 `as any`
- **新增 Lucide 图标必须同时改 `LucideIcon.vue` 的 import 与 nameMap 两处**（漏一处静默 fallback 成 CloudAlert）。天气模块**已注册**的扩展图标：`Leaf` `Activity` `CloudSunRain` `Tornado` `Waves` `UmbrellaIcon`。⚠️ **`Cyclone` 在 `@lucide/vue` 中不存在**（会报 TS2305），阵风用 `Wind`、气旋类语义用 `Tornado`
- **降级链不降级「配置错误」**：和风 host 非法 / 私钥格式错等会在 `probe` 阶段就拦下并给出中文提示；运行时失败会写入 `_trace` 的 `error`
- **Open-Meteo 坐标系是硬约束**：`cnCities.ts` 收录 31 省会 + ~290 地级市 + 江西 98 个县级短名映射，覆盖不到的城市会直接失败降级（这是刻意的诚实行为，不做坐标造假）。**新增省份的县级支持，须在 `COUNTY_TO_PREFECTURE` 补「去后缀短名 → 所属地级市」条目**（与渲染端 `cityData.ts` 的 `counties` 对齐）
- **⚠️ 排查「为什么降级到爬虫」的标准动作**（2026-09-29 实战总结）：
  1. **先确认主进程已重启** —— 改了 `weather/` 任何文件都必须重启 Electron，否则跑的还是旧代码（**当天就有一次误判：数据显示 `humidity:0` 且无 `capabilities` 字段 = 旧爬虫代码写的，说明根本没生效**）；
  2. 查数据库 `weather_data` 表最新记录：**无 `capabilities` 字段 / `humidity=0`** ⇒ 旧爬虫产物；有 `capabilities` 且 `source` 正确 ⇒ 新架构生效；
  3. 看调试面板「数据源轨迹」tab 的 `_trace`，每个源的 `error` 会写明具体原因（`未配置凭据` / `未启用` / 具体异常）；
  4. 用 `providerId` 参数**指定单一数据源**请求（如 `fetchWeather(city, true, 'openMeteo')`），绕过降级链直接定位该源本身是否可用
- **newSql.execute 三个坑（db.ts 已规避，其他模块直接用 SQL 时务必注意）**：
  1. `isSelect` 只认 `SELECT` 开头 —— `PRAGMA table_info(...)` 会被当写语句执行（db.run），**永远拿不到 rows**；结构探测用 `SELECT * FROM pragma_table_info('表名')`（table-valued function）
  2. SELECT 结果在 `data.rows` 里，非 SELECT 只有 lastID/changes —— 封装层必须解包
  3. execute 对 INSERT/UPDATE 会按默认 schema（id 主键 + TEXT 列）**自动建表** —— 若目标表尚未由业务代码建出，会被劫持成错误结构；weather_data 按项目惯例用「id 主键 + city 唯一索引」而非 city 主键（SQLite 无法 ALTER 加主键，见 SKILL.md）
- 库文件路径见 `references/data-layer.md`（本机 `C:\Users\风起\Downloads\测试\db.sqlite`）；沙箱内核对库内容可先复制主文件到项目目录再只读打开
- `get-weather` 有主进程缓存（默认 2h，可在配置抽屉调）+ 前端缓存（30min），调试看不到新数据先 `forceRefresh:true`
- 天气接口失败时主进程返回 `null`（全链路失败）或 `{error}`（异常），渲染端 `api.ts` 统一抛 Error
- **原始网页 HTML**（仅爬虫源）由 `crawler.ts` 保存到项目 `cache-data/` 文件夹

