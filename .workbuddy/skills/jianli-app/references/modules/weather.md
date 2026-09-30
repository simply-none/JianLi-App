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
| `data/cnCities.ts` | **全国省/市/区县三级坐标表**（3237 条，DataV.GeoAtlas 快照；含 `adcode`；`lookupCityCoords` / `resolveCityCandidates` / `toShortName` / `getAllAreas`），供 Open-Meteo 定位与渲染端消歧 |

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

> **⚠️ Open-Meteo 是网格插值模型，没有「城市」概念（2026-09-30 实测确认）**：
> - **全球任意合法坐标都能查**（WGS84），连南极内陆(−47.8°C)、北冰洋、马里亚纳海沟都返回数据 ⇒ **不存在「收录/未收录」**，它不依赖城市数据库；
> - **证明是插值而非查表**：南康县内 4 个点温度 33.1–34.1°C、风速 1.1–4.3 各不相同；响应含 `elevation` 做地形修正。⇒ **给什么坐标就查什么点，与「是不是城市」无关**；
> - **有 geocoding API（`geocoding-api.open-meteo.com/v1/search`，底层 GeoNames）但中文县级极不可靠**：实测赣州 18 个县级 —— **仅 3 个正确**(16.7%)、**7 个错配到别的省**（南康→陕西/江苏、定南→广西）、**8 个 0 结果**（于都/瑞金/信丰…）。官方规则：空串与单字符返回 0、≥3 字符须匹配索引名**开头**、admin1 限定符必须精确匹配；
> - **⇒ 不要用 geocoding 替代本地坐标表**：错配会返回几百公里外的同名地，**用户看不出来**，比无结果更危险。本地坐标表是确定正确的。

### 坐标表：DataV.GeoAtlas 全量快照（2026-09-30 定案）

**`data/cnCities.ts` 已从手写表改为外部数据快照**，覆盖全国省/市/区县三级：

| 项 | 值 |
|---|---|
| 数据来源 | 阿里 DataV.GeoAtlas `https://geo.datav.aliyun.com/areas_v3/bound/all.json` |
| 条数 | **3237**（34 省 + 363 地级市 + 2840 区县），坐标缺失 0、parent 悬空 0 |
| 文件体积 | ~150KB（TS 内联字符串，CRLF） |
| 格式 | `'adcode,name,lng,lat,level,parentIndex'`，按省级分组，level：1省/2市/3区县 |

**⚠️ 为什么必须自己快照，不能用 npm 包**（2026-09-30 逐个解包实测）：

| 包 | 体积 | 结论 |
|---|---|---|
| `china-division` | 186MB（含 82MB 村级） | ✗ 只有 `code+name+层级`，**零坐标** |
| `province-city-china` | 24.5MB | ✗ 同上 |
| `china-area-data` / `area-data` / `@vant/area-data` / `china-location` | 114–323KB | ✗ 同上 |
| `china-geojson` | 1.4MB | △ 只到**地级市**，坐标在 `properties.cp`（`[lng,lat]`） |
| `china-map-data` | 1.5MB | ✗ 坐标是 ECharts 二进制编码（`@@@…`），不可直接读 |

⇒ **npm 上的中国行政区划包全部只做名称层级树，一个带经纬度的都没有**。DataV 的 `all.json` 是唯一「扁平 + 带 lng/lat + 带 parent」的免费数据集。

**查询 API**（`lookupCityCoords(city)`，签名与旧版一致，引用方无需改）：
1. **全名精确命中**（tier 0）→ 2. **短名精确命中**（tier 1，「南康」→ 南康区、「江西」→ 江西省）→ 3. 无精确命中时**剔除省级线索后做包含匹配**（tier 2，处理「江西赣州南康区」）
2. 排序优先级：**tier 小者优先** → level 大者优先 → 祖先含知名城市（`FAMOUS_NAMES`：直辖市/省会/计划单列市）优先 → 下标小者（稳定）
3. 短于 2 字的查询**直接返回 null**（「南」会误配任意含「南」的城市）
4. 自治区有别名处理（`AUTONOMOUS_ALIAS`）：`新疆维吾尔自治区`→`新疆`、`广西壮族自治区`→`广西`、`宁夏回族自治区`→`宁夏`

**⚠️ 同名歧义是固有问题，不是 bug**：区县级有 **30 组重名**（朝阳区×2、新华区×3、城区×3、河北区×2…）。用全名查重名区县时结果由排序规则决定（知名城市优先），**要精确定位必须带上级上下文**（如「江西赣州南康区」）。全量自测：3237 条按 name 自查，**自洽 3197 / 歧义 40 / 未命中 0**，40 条偏差全部是真实同名。
> **⇒ 2026-09-30 已上「消歧 + 记住选择」，见下节**。

**更新数据的方法**：重新抓取 `all.json`，用同样的紧凑格式（按省级分组、组内父在前）替换 `CITY_TABLE` 内容即可，**不要手改数据行**（文件头已注明）。

**性能**：索引懒加载一次（`buildIndex()`），预计算 `PARENT_CHAIN` 祖先链 ⇒ 查询是 O(候选数 × 链长)，无 O(n²) 遍历。

### ✅ 城市消歧 + 记住选择（2026-09-30 实施）

**问题**：`朝阳区` 不带上下文永远解析到**北京**（tier 相同 → 知名城市优先），长春朝阳区**永远查不到**，且**用户看不出错**（返回的是真实天气，只是几百公里外）。

**方案：`CityRef` 结构化标识 + 渲染端消歧（方案 A）+ 记住选择**

```ts
// 主进程/渲染端 types.ts 各一份（需同步）
interface CityRef {
  name: string; adcode?: number; province?: string; city?: string;
  path?: string; lng?: number; lat?: number;
}
```

**数据流**：
```
用户输入 → resolveCityForQuery(keyword)  [渲染端 cityResolver.ts]
   ├─ ① 已记住该名称的选择 → 直接用（不再打扰）
   ├─ ② 候选唯一(≤1)      → 直接用（无歧义）
   ├─ ③ 候选 ≥2           → 弹 el-dialog 下拉，用户按「省 · 市 · 区县」路径选
   └─ ④ 无候选            → 回落主进程按名称分层匹配（老行为）
   选定 → rememberCityChoice(name, adcode) + emit searchRef(city, CityRef)
        → loadByCity(city, false, undefined, cityRef)
        → api.ts fetchWeather(city, forceRefresh, providerId, cityRef)   ← payload 带 cityRef
        → 主进程 get-weather → fetchWithFallback(...cityRef) → openMeteo.ts
        → lookupCityCoords(city, config.cityRef)  ← adcode 最精确、坐标次之
```

**关键设计点**：

| 点 | 做法 | 原因 |
|---|---|---|
| 重名检测位置 | **渲染端**（顺带统一数据源） | 主进程只管坐标，交互归 UI |
| 数据来源 | 走 `weather:resolve-city` IPC | `tsconfig.json` 的 include 只有 `src`，渲染端无法 import `electron/` 下的 3237 条数据 |
| `adcode` 是唯一钥匙 | 有 adcode 时**完全跳过名称猜测** | `lookupCityCoords` 内 `hint.adcode` 优先级最高 |
| **表结构不动** | `CityRef` 塞进 `data` JSON 的 `_cityRef` 字段 | `weather_data` 主键仍是 `city` 字符串，**老行零迁移**；`parseRow` 读出后从 data 里**摘出并 delete**，不污染天气字段 |
| 缓存 key 纳入 adcode | 主进程 `refKey = adcode ? \`${city}#${adcode}\` : city` | 否则同名城市互相串号（北京朝阳 ↔ 长春朝阳） |
| 记住选择 | `localStorage['weather-city-remember']` = `{城市名: adcode}` | 仅消歧偏好属 UI 层，不占数据库；**与天气数据存库的项目惯例不冲突** |
| 历史/星标标签 | `resolveCityRefByName(city)` → 取**排序首位**，**不弹下拉** | 标签点击应即时响应；该关键词已缓存，**不产生额外 IPC** |
| 自动加载 | `onMounted` 走 `handleTagSearch` 而非 `handleSearch` | 用户此刻并未发起选择，不该被打断 |

**实测验证**（2026-09-30，`ts.transpileModule` 直跑主进程 TS）：
```
朝阳 → 4 个候选：[110105]北京市·朝阳区 / [220104]吉林省·长春市·朝阳区 / [211321]朝阳县 / [211300]朝阳市
hint adcode=110105 朝阳区 → 116.486,39.921  (北京)
hint adcode=220104 朝阳区 → 125.318,43.865  (长春)   ← 无 hint 时此处恒为北京，即修复点
hint adcode=410402 新华区 → 113.299,33.738  (平顶山) ← 无 hint 时恒为石家庄
```

**渲染端文件职责**：

| 文件 | 职责 |
|---|---|
| `cityResolver.ts` | **消歧核心**：候选缓存 / `rememberCityChoice` / `getRememberedAdcode` / `resolveCityForQuery` / `resolveCityRefByName` / `candidateToRef` |
| `cityData.ts` | 建议列表（委托主进程全量快照）；`CityEntry` 含 `ref: CityRef`，选中即可直接查 |
| `WeatherSearch.vue` | `el-autocomplete` 的 `fetchSuggestions` **已改 async**（`await searchCityEntries`）；建议项展示 `省 · 市 · 区县` 路径；重名时 `el-dialog` 候选列表；新增 emit `searchTag` / `searchRef` / `cancelDisambiguation` |
| `index.vue` | `handleSearch`（统一入口，先判消歧）/ `handleSearchRef` / `handleTagSearch` / `runQuery`（唯一实际查询出口）；`isCurrentRemembered` 控制「已记住」角标 |

**⚠️ 单字查询拦截**：`fetchSuggestions` 对**长度 1** 的输入直接回调空数组（主进程也会对 <2 字返回空，双保险），避免「南」把下拉灌满。

**⚠️ `el-autocomplete` 的 `value` 不能当 `:key`**：重名候选 `value`（城市全名）相同 ⇒ 用 `adcode` 作 `key` 字段，`value` 仅用于回填输入框。

**⚠️ 模板里 `item` 来自插槽，类型是 `any`**：直接 `CITY_LEVEL_LABEL[item.level]` 会报 **TS7053**（隐式 any 索引），已收敛到 `levelLabelOf(level)` 函数内窄化。


## 关键文件（渲染端已组件化拆分）
- `src/views/weather/index.vue`：页面容器，编排状态与布局；**区块顺序**：Hero → Details → Alert → MinutelyRain → AirQuality → HourlyForecast → AstroCard → LifeIndices → DailyForecast → SourceBadge
- `src/views/weather/types.ts`：与主进程 `weather/types.ts` **一一对应**（改一侧必须同步另一侧）
- `src/views/weather/capability.ts`：`useWeatherCapability()` / `CAPABILITY_LABEL` / `CAPABILITY_GROUP` / `capabilityLabel` / `aqiColor` / `WARNING_SEVERITY_COLOR`
- `src/views/weather/api.ts`：6 个 IPC 封装（`fetchWeather` / `resolveCityCandidates` / `fetchWeatherConfig` / `saveWeatherConfig` / `probeWeatherProvider` / `fetchAvailableProviders`）
- `src/views/weather/constants.ts`：图标映射、背景渐变主题映射、热门城市、缓存配置（含 `getCacheTTL/setCacheTTL`）
- `src/views/weather/cityData.ts`：**搜索建议（委托主进程全量快照，异步）**；`CityEntry` 含 `ref: CityRef`；`CITY_LEVEL_LABEL`
- `src/views/weather/cityResolver.ts`：**城市消歧**（候选查询缓存 / 记住选择 / CityRef 构造）
- `src/views/weather/db.ts`：天气表 `weather_data`（city 主键 / data JSON / updated_at / is_starred）读写；**data 存 `WeatherData` 全量 JSON ⇒ 新增的 `capabilities`/`_trace` 自动持久化，无需迁移**；`CityRef` 以 `_cityRef` 键内嵌在 data JSON 里（`saveWeatherToDb(city, data, cityRef?)`，`WeatherRow.cityRef` 读出时**自动摘除**）
- `src/views/weather/composables/`：`useWeather`（数据+缓存，支持 `providerId`，记降级链日志）、`useCityHistory`、`useWeatherTheme`、`useDebugLog`
- `src/views/weather/components/`：`WeatherSearch` `WeatherHero` `WeatherDetails` `DailyForecast` `LifeIndices` `WeatherSkeleton` `DebugPanel` + **`HourlyForecast` `AirQuality` `WeatherAlert` `MinutelyRain` `AstroCard` `SourceBadge` `WeatherProviderSettings` `ProviderForm`**
- 主进程：`electron/main/module/weather/`（见上）、`weatherProviders.ts`（registry barrel）、`weather.ts`（转发层）、`crawler.ts`（通用爬虫工具）、`location.ts`、`dialog.ts`（`save-debug-data`）
- 无独立 store；城市历史走 localStorage，天气缓存走主进程内存 `WEATHER_CACHE` / `CITY_LAST`

## 路由
- `RouteNames.WEATHER` → path `/weather`

## 用到的 IPC 通道
- `get-weather`（渲染→主，`invoke`，`{city, forceRefresh?, providerId?, cityRef?}`）→ `WeatherData | null | {error}`。`providerId` 为**可选新增**，指定单一数据源**不降级**；`cityRef` 为**可选消歧提示**（有 `adcode` 则精确定位坐标，无则按名称分层匹配）
- `weather:resolve-city`（`invoke`，城市名 `string`）→ `CityCandidate[]`（重名下拉候选，含 `adcode`/`lng`/`lat`/`path`）。**空串返回全部省级**（省会 + 直辖市），供搜索框聚焦时的默认建议
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
- 定位已移除：渲染端不调用 `get-current-position`；进入页面默认加载**最后一次查询的城市**（数据库历史列表首位），无历史时展示空态。<br>**⚠️ 自动加载走 `handleTagSearch`（不弹消歧下拉）**，用户主动搜索才走 `handleSearch`（可能弹下拉）
- 渲染端：数据读取顺序 = 数据库 `weather_data`（updated_at 未过时效，**仅在不指定 providerId 时**）→ 主进程降级链（主进程另有按 `cacheDuration` 的内存缓存）；Hero 卡上的「强制刷新」按钮（`forceRefresh:true`）；搜索栏右侧「Timer」下拉切缓存时效（5分钟/30分钟/1小时/6小时/24小时）
- 搜索建议来自 `cityData.ts` → 主进程**全量快照**（省/地级市/区县 3237 条），建议项展示「城市名 + 层级标签 + 省 · 市 · 区县 路径」；**选中即带 `CityRef` 查询并记住选择**（不再走「城市名+天气」的字符串拼接老路，`searchName` 字段保留但只作展示兜底）
- **重名消歧**：候选 ≥2 时弹 `el-dialog` 候选列表（用户按路径选）；搜索栏下方回显当前定位路径 + 「已记住」角标
- **数据库为唯一本地存储**：表 `weather_data`（id 主键 + city 唯一索引 / data JSON / updated_at / is_starred），走 `new-sql:execute` 通道；查询成功「先查后插/更」（保留星标）；缓存有效性 = `updated_at` 未过时效；历史 = 按 updated_at 倒序取最近 10 条；星标 = `is_starred=1`（未查询过的城市无法星标）；删除单条历史连数据一起删，「清空历史」保留星标城市；仅缓存时效配置（`weather_cache_ttl`）与**城市消歧记忆（`weather-city-remember`）**仍存 localStorage
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
- **Open-Meteo 坐标系已全国覆盖**：`cnCities.ts` 收录全国 34 省 + 363 地级市 + 2840 区县（共 3237 条），查不到的只剩极冷门乡镇/村级名称 ⇒ 未命中时降级（这是刻意的诚实行为，不做坐标造假）。**更新数据见上方「坐标表」小节，不要手改数据行**。
- **⚠️ 重名城市必须带 `CityRef`**：`朝阳区`/`新华区`/`城区` 等 30 组重名，**不带 adcode 时结果由排序决定且用户无法察觉**（返回的是真实天气，只是几百公里外）。改动查询链路时**务必把 `cityRef` 一路透传**（`index.vue` → `useWeather.loadByCity` → `api.fetchWeather` → 主进程 `registry.fetchWithFallback` → `openMeteo`），断一环就退回「永远查到知名城市那个」的老行为。
- **⚠️ 主进程缓存 key 必须含 adcode**：`index.ts` 的 `refKey = cityRef?.adcode ? \`${city}#${cityRef.adcode}\` : city`，否则北京朝阳与长春朝阳**共用一条缓存**（先查哪个就一直返回哪个）。
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

