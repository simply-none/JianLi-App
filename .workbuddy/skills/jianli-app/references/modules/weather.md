# 天气 (weather)

## 职责
按城市查询实时天气/预报。**数据由主进程的多数据源适配器架构获取（2026-09-29 起）**：按用户配置的优先级依次尝试多个数据源，任一成功即返回，失败自动降级并记录轨迹。页面为动态天气背景风格（Apple Weather 式渐变 + 毛玻璃卡片），**展示字段按数据源能力清单（capabilities）分级渲染**。

## ✅ 数据源总览（2026-09-30 已补齐 8 源）
| # | id | 展示名 | 免费额度 | 需 Key | 定位方式 | 能力亮点 / 短板 |
|---|---|---|---|---|---|---|
| 1 | `qweather` | 和风天气 | 5 万次/月 | ✅ JWT/APIKEY | GeoAPI（中文+县级） | **字段最全**（26 项）；指数/AQI/预警/分钟级降水 |
| 2 | `openMeteo` | Open-Meteo | <1 万次/日 | ❌ 零配置 | 本地坐标表 | 实况/预报很全（19 项）；**无指数/AQI/预警/月相** |
| 3 | `seniverse` | 心知天气 | 500~1000 次/日 | ✅ 密钥 | 坐标（推荐）或城市名 | 实时+3 天预报+**6 项生活指数**+AQI；免费版实况只有温度/现象 |
| 4 | `amap` | 高德天气 | 5000 次/月 | ✅ Web Key | **adcode**（本地表反查） | 实时+4 天预报；**字段最少**（5 项，无体感/气压/能见度/指数/AQI） |
| 5 | `caiyun` | 彩云天气 | 500 次/日 | ✅ Token | 本地坐标表 | **分钟级降水最准**+实时/逐日/逐小时+指数+AQI |
| 6 | `openWeather` | OpenWeatherMap | 1000 次/日 | ✅ API Key | 本地坐标表 | 实时+逐日+逐小时+AQI；描述已中文；**无生活指数/预警** |
| 7 | `wttr` | wttr.in | 免费无限 | ❌ 零配置 | 本地坐标表 | 实时+3 天+逐小时+天文/月相；**描述需自映射中文**、服务稳定性一般 |
| 8 | `crawler` | 中国天气网（爬虫） | — | ❌ 零配置 | Bing 搜索抓取 | 生活指数（和风不可用时的兜底）；**慢且脆**，始终留最后 |

> **降级链默认顺序**：`qweather → openMeteo → seniverse → amap → caiyun → openWeather → wttr → crawler`
> —— 原则「字段最全优先，慢且脆的爬虫永远最后」。默认 **8 源全 `enabled: true`**：需 Key 的源未填凭据时会被 `resolveChain` 标「未配置凭据」自动跳过，用户填好即生效，无需再手动开开关。

## ✅ 架构：多数据源可插拔 + 字段分级展示（2026-09-29 已实施）
> 完整方案见 `C:\cod\jianli\天气接口免费方案调研_2026-09-29.md`（v2）。

**主进程目录（`electron/main/module/weather/`）**：
| 文件 | 职责 |
|---|---|
| `index.ts` | **IPC 注册 + 内存缓存**（入口）。缓存 key = `${providerId}:${city}#${adcode}`；另有 `CITY_LAST[city]` 做跨源回显；保存配置后清空两者 |
| `registry.ts` | **降级链调度**：`resolveChain` / `fetchWithFallback` / `withTimeout` / `probeProvider`；`_trace` 记录每个源的成功/跳过/失败与耗时；**统一解析 `__coords`**（见下） |
| `config.ts` | **配置读写 + 凭据加密**。存 SQLite `basic_info`，key = `weatherConfig`；`splitSecrets`/`mergeSecrets` 把 `secret:true` 字段抽进 `__secret` 信封；`DEFAULT_WEATHER_CONFIG` 定义 8 源默认顺序与开关 |
| `capability.ts` | `ALL_CAPABILITIES`(26) / `CAPABILITY_LABEL` / `CAPABILITY_GROUP` / `PROVIDER_CAPABILITIES`（**8 源能力矩阵**）/ `hasCapabilityDomain` / `capabilityLabel` |
| `normalize.ts` | `normalizeCondition` / `isValidWeatherData`（严格，爬虫用）/ `isUsableWeatherData`（宽松，adapter 用）/ `compassToCn` / `degreeToCn` / `windScaleToText` / `round` / `isoToHm` / `maskSecret` / `validateQWeatherHost` |
| `types.ts` | 全部共享类型（`WeatherData` / `WeatherProvider` / `ProviderConfigField` / `WeatherModuleConfig` / `WeatherConfigForUi` 等）；`ProviderRuntimeConfig` 含 `__coords` |
| `providers/qweather.ts` | 和风适配器（JWT Ed25519 + GeoAPI + 6 接口 `Promise.allSettled`） |
| `providers/openMeteo.ts` | Open-Meteo 适配器（零配置，WMO 码→中文映射） |
| `providers/seniverse.ts` | 心知适配器（密钥 + 实况/3 天/指数/AQI） |
| `providers/amap.ts` | 高德适配器（Web Key + adcode 双接口 base/all） |
| `providers/caiyun.ts` | 彩云适配器（Token + 实况/分钟级降水/逐日/逐小时） |
| `providers/openWeather.ts` | OpenWeatherMap 适配器（API Key + 实况/3h 预报/AQI） |
| `providers/wttr.ts` | wttr.in 适配器（零配置，需显式 UA，英文描述→中文映射） |
| `providers/crawler.ts` | 内置爬虫适配器（原实现迁移，另抽 warnings） |
| `data/cnCities.ts` | **全国省/市/区县三级坐标表**（3237 条，DataV.GeoAtlas 快照；含 `adcode`；`lookupCityCoords` / `resolveCityCandidates` / `toShortName` / `getAllAreas`），供 Open-Meteo 定位与渲染端消歧 |

**`electron/main/module/weatherProviders.ts`**（barrel）：`PROVIDERS` 数组（8 源）+ `getAllProviders()` / `getProvider(id)`。**新增数据源只需：① 写 `providers/xxx.ts`；② 在此 import 并加入数组；③ 在 `capability.ts` 的 `PROVIDER_CAPABILITIES` 登记能力矩阵；④ 在 `config.ts` 的 `DEFAULT_WEATHER_CONFIG` 加进 `providerOrder` 与 `providers`。渲染端 / IPC / 配置页零改动**（配置页表单由 `configSchema` 驱动，能力 tags 由能力矩阵驱动）。此文件独立存在是为打破 `weather/config.ts` ↔ `providers` 的循环依赖。

**⚠️ `__coords` 统一注入机制（2026-09-30 新增）**：`registry.fetchWithFallback` 用 `lookupCityCoords(city, cityRef)` **统一解析一次坐标**，塞进运行期配置的 `__coords` 字段，供需要经纬度的源（openMeteo / 彩云 / OpenWeather / wttr / 高德反查 adcode）直接复用 ⇒ **各 adapter 不再各自重复解析**。为 `null` 表示本地表未收录，相关源应抛「本地坐标表未收录「X」」并降级。

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

---

### 新增 5 源接入要点（2026-09-30 补齐，均据官方文档 + 实测）

#### 心知天气 `seniverse`（`providers/seniverse.ts`）
- 接口：`/weather/now.json`（实况）、`/weather/daily.json?start=0&days=3`（逐日）、`/life/suggestion.json`（生活指数）、`/air/now.json`（空气质量）；基址 `https://api.seniverse.com/v3`
- ⚠️ **失败响应无 HTTP 错误码**（可返回 200/403），body 为 `{status:'The API key is invalid.', status_code:'AP010003'}` ⇒ **必须先判 `status_code` 且无 `results`**，再判 `res.ok`（否则错误信息只剩「HTTP 403」）
- ⚠️ **免费版实况仅返回「现象文字 / 代码 / 气温」3 项** ⇒ 湿度/体感/风向/风级/气压/能见度/云量/露点**全部取不到**；逐日仅 3 天；指数仅 6 项且**只有 `brief` 无 `details`**（tip 回退 brief）。故 `capabilities` 必须**按实际有值二次裁剪**（写死了会出「有格子无数据」的空壳）
- ⚠️ **坐标格式为 `纬度:经度`（`lat:lon`）**，与常见 `lon,lat` 相反
- ⚠️ 中国城市**不支持 `clouds`（云量）与 `dew_point`（露点）**
- 定位双模式（`configSchema.locationMode`）：默认 `coords` 走本地坐标表（精确、支持 adcode 消歧）；`name` 传中文/拼音让心知自解析（县级较弱）
- 错误码：`AP010003` = 密钥无效

#### 高德天气 `amap`（`providers/amap.ts`）
- 单接口双模式：`https://restapi.amap.com/v3/weather/weatherInfo?key=&city=&extensions=base|all`（**实况与预报要分别请求两次**）
- ⚠️ **`city` 官方要求 adcode，不是城市名** ⇒ 有 `cityRef.adcode` 直接用；否则**用 `__coords` 反查本地表**（惰性构建 `coordKey→adcode` 的 Map，O(1)）
- ⚠️ **字段最少（能力矩阵仅 5 项）**：实况只有 `temperature / weather / winddirection / windpower / humidity`；**无体感 / 气压 / 能见度 / 紫外线 / 指数 / AQI**；预报最多 **4 天**（当天+3）
- 响应 **`status: '1'` 才是成功**，`'0'` 为失败（`info` 给错误描述，如 `INVALID_USER_KEY` / `infocode:10001`）
- 风向/风力是**文字**（如 `东北` / `≤3`），风力需正则取数字

#### 彩云天气 `caiyun`（`providers/caiyun.ts`）
- ⚠️ **Token 内嵌在 URL 路径**：`https://api.caiyunapp.com/v2.6/{token}/{经度},{纬度}/{realtime|minutely|daily|hourly}.json`
- ⚠️ **路径中经度在前、纬度在后（`lng,lat`）**，而响应里的 `location` 字段是 `[lat,lng]`——两处顺序相反，极易写错
- ⚠️ **单位陷阱**：`humidity` / `cloudrate` 为 **0–1 小数**需 ×100；**`pressure` 单位为 Pa（约 100000）需 ÷100 转 hPa**；`visibility` 为 km；`wind.speed` 为 km/h
- ⚠️ **`skycon` 是英文枚举**（`CLEAR_DAY` / `PARTLY_CLOUDY_NIGHT` / `LIGHT_RAIN`…）需本地映射中文；可用 `_NIGHT` 后缀判昼夜
- **分钟级降水**（`minutely.json`）是特色：`result.minutely.{description, precipitation_2h}`（逐 5 分钟、2 小时共 24 点）
- 失败：`{status:'failed', error:'token is invalid'}`（HTTP 400/403）⇒ 同样**先读 body 再判 HTTP**
- 生活指数只有 `ultraviolet` / `comfort`（免费版）

#### OpenWeatherMap `openWeather`（`providers/openWeather.ts`）
- 接口：`/data/2.5/weather`（实况）、`/data/2.5/forecast`（**5 天 / 3 小时**采样，非逐日）、`/data/2.5/air_pollution`（AQI）；基址 `https://api.openweathermap.org`
- ⚠️ **内置按城市名 geocoding（`q=`）已废弃且不支持中文** ⇒ 统一用本地坐标表的 `lat`/`lon`
- 参数：`units=metric`（摄氏度）、`lang=zh_cn`（**描述已中文**）
- ⚠️ **免费版无逐日接口** ⇒ 逐日预报由 **3 小时采样按天聚合**（`tsToDate` 分组取 max/min）
- ⚠️ **免费版实况不返回 `dew_point`**（需 One Call 3.0）⇒ 能力矩阵不声明
- ⚠️ **免费版无天气预警**（Alert API 需付费）⇒ 不声明 `alert.warning`
- `sunrise` / `sunset` 是 **UTC 秒级时间戳**，须用响应 `timezone`（秒偏移）换算本地时刻
- AQI 是 **1~5 整数档**，需映射中文等级；错误：HTTP 401（Key 无效）/ 429（超限），body 含 `message`

#### wttr.in `wttr`（`providers/wttr.ts`）
- 零配置；JSON 模式 = URL 追加 `?format=j1`；基址 `https://wttr.in`
- ⚠️ **必须显式发送 `User-Agent`**：服务端**按 UA 判断输出格式**，不带 UA（或默认 curl UA）会返回**纯文本**而非 JSON，`JSON.parse` 直接失败。本 adapter 发送 `JianliApp-Weather/1.0`，并额外 try/catch 兜底把纯文本错误页转成可读报错
- ⚠️ **位置解析精度差**（中文名走 OpenCage，实测「南康」→ `Nankanghsien` 尚可但常有偏差）⇒ 统一用**坐标模式** `/{纬度},{经度}?format=j1`（**lat,lon 顺序**）
- ⚠️ **`lang=zh` 实测不生效**（仍返回英文）⇒ 自建 `DESC_CN` 英文→中文映射（精确匹配 + 关键词兜底两级）
- ⚠️ **`astronomy.sunrise/sunset` 是 12 小时制文本**（`"6:09 AM"` / `"5:59 PM"`），**不是 ISO** ⇒ 必须 AM/PM → 24h 换算（`to24h()`），否则界面显示原文
- 数据来自 World Weather Online；结构：`current_condition[0]` / `nearest_area[0]` / `weather[]`（逐日，含 `astronomy[0]`、`hourly[]` 3 小时粒度）
- 免费服务稳定性一般 ⇒ 置于降级链靠后位置

> **通用教训（本次 5 源实测）**：
> 1. **`Promise.allSettled` 会吞掉主请求的具体错误** ⇒ 必需项（实况）失败时必须**把 `settled[0].reason.message` 抛出来**，否则用户只看到「XX 实时天气获取失败」，无法区分是 Key 错、超时还是网络问题。**五源已全部改为透传真实原因**。
> 2. **部分 API 错误走 HTTP 200**（心知 / 彩云 / 高德）⇒ **必须先解析 body 判业务错误码，再判 `res.ok`**，顺序反了错误信息就只剩 HTTP 状态码。
> 3. **每个源的「免费版缩水」必须反映到 capabilities 而非硬编码**：免费版字段缺失是常态（心知实况只 3 项、高德只 5 项），静态能力矩阵声明「理论上限」，运行时按「本次真有值」裁剪。

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
- `src/views/weather/constants.ts`：图标映射、背景渐变主题映射（**`CONDITION_THEME_MAP` 已四档化：`day`/`night`/`dayDark`/`nightDark`**）、热门城市、缓存配置（含 `getCacheTTL/setCacheTTL`）
- `src/views/weather/index.vue`：页面容器；**同时是 `--glass-*` 玻璃层语义变量的唯一定义处**（亮档默认值 + `:global([data-mode='dark'])` 覆盖）
- `src/utils/themeMode.ts`（**2026-09-30 新建**）：明暗档判定（`ThemeMode` / `luminance` / `themeMode` / `useThemeMode`），按 `THEME_COLORS[theme].cardBg` 亮度自动分档，**不手工维护主题名单**
- `src/views/weather/cityData.ts`：**搜索建议（委托主进程全量快照，异步）**；`CityEntry` 含 `ref: CityRef`；`CITY_LEVEL_LABEL`
- `src/views/weather/cityResolver.ts`：**城市消歧**（候选查询缓存 / 记住选择 / CityRef 构造）
- `src/views/weather/db.ts`：天气表 `weather_data`（city 主键 / data JSON / updated_at / is_starred）读写；**data 存 `WeatherData` 全量 JSON ⇒ 新增的 `capabilities`/`_trace` 自动持久化，无需迁移**；`CityRef` 以 `_cityRef` 键内嵌在 data JSON 里（`saveWeatherToDb(city, data, cityRef?)`，`WeatherRow.cityRef` 读出时**自动摘除**）
- `src/views/weather/composables/`：`useWeather`（数据+缓存，支持 `providerId`，记降级链日志）、`useCityHistory`、`useWeatherTheme`、`useDebugLog`、**`useForecastView`（预报区块 列表/图表 形态，含 localStorage 持久化）**
- `src/views/weather/components/`：`WeatherSearch` `WeatherHero` `WeatherDetails` `DailyForecast` `LifeIndices` `WeatherSkeleton` `DebugPanel` + **`HourlyForecast` `AirQuality` `WeatherAlert` `MinutelyRain` `AstroCard` `SourceBadge` `WeatherProviderSettings` `ProviderForm`** + **`HourlyForecastChart` `DailyForecastChart`（ECharts 图表形态）**
- 主进程：`electron/main/module/weather/`（见上）、`weatherProviders.ts`（registry barrel）、`weather.ts`（转发层）、`crawler.ts`（通用爬虫工具）、`location.ts`、`dialog.ts`（`save-debug-data`）
- 无独立 store；城市历史走 localStorage，天气缓存走主进程内存 `WEATHER_CACHE` / `CITY_LAST`

## ✅ 预报区块「列表 / 图表」双形态（2026-09-30 实施）

**需求**：逐小时预报、未来预报两个区块，右侧加【列表 / 图表】切换按钮；列表 = 原实现，图表 = ECharts。

**形态记忆**：`composables/useForecastView.ts`（模块级单例 `ref`），存 `localStorage['weather-forecast-view']` = `{hourly:'list'|'chart', daily:'list'|'chart'}`。
- **两个区块各自独立记忆**（`useForecastView('hourly')` / `useForecastView('daily')`）
- 读取时**逐字段校验**（非 `'chart'` 一律回落 `'list'`），脏数据不会导致渲染异常
- 写入包 try/catch（隐私模式 / 配额超限静默失败）
- **默认 `list`** ⇒ 与改造前行为一致，零迁移

**⚠️⚠️ 关键陷阱：`useForecastView(key)` 必须返回「可写 computed」，绝不能返回 `ref(state.value[key])`**（2026-09-30 修）
初版写成 `return ref(state.value[key]) as Ref<ForecastViewMode>`，症状是**切换后重进页面又变回列表**（localStorage 从未被写入）。根因两层：
1. **游离 ref**：`ref(x)` 只是「取值拷贝」，新建的 ref 与模块级 `state` **毫无关联**。组件里 `view = 'chart'` 改的是这个临时 ref，`state` 纹丝不动 ⇒ 持久化 `watch(state)` **永不触发**，localStorage 零写入。
2. **值拷贝语义**：即使不落盘，组件重挂载（路由切走再回来）后 `ref` 重新初始化，也立即丢回默认值。

正确写法（返回**绑定单例的可写 computed**，组件侧 `view === 'chart'` / `view = opt.value` 用法零改动）：
```ts
export function useForecastView(key: keyof ForecastViewState): ComputedRef<ForecastViewMode> {
  return computed<ForecastViewMode>({
    get: () => state.value[key],
    set: (v) => {
      if (state.value[key] === v) return          // 同值短路
      const next = { ...state.value, [key]: v }   // 整体替换，确保 watch 命中
      state.value = next
      persist(next)                                // ⚠️ 同步落盘，不等 watch 异步 flush
    },
  })
}
```
**⚠️ 落盘必须同步**：模块级 `watch` 默认 `flush: 'pre'`（异步）。若只依赖 watch，用户「切到图表后立刻刷新/关页」时可能来不及执行 ⇒ 状态丢失。因此在 `set` 里**显式同步调 `persist()`**，`watch` 仅作兜底（覆盖 `useForecastViewState().value = ...` 这类直接改动）。

**⚠️ 通用教训**：凡是「模块级单例状态 + 按 key 取子字段」的 composable，**返回值必须绑定到单例**（可写 `computed` / `toRef`），写成 `ref(单例.value[key])` 会静默失效——不报错、类型也过，只是持久化和跨组件共享全部失灵。


**图表设计**：

| 区块 | series | 说明 |
|---|---|---|
| `HourlyForecastChart.vue` | 温度折线（平滑 + 面积渐变，`yAxisIndex:0`）+ 降水概率柱（`yAxisIndex:1`，0–100%） | 双 Y 轴；首点 x 轴标签为「现在」；温度轴 `min/max` 取 `[min-pad, max+pad]`（`pad = max(跨度×0.25, 2)`）防止折线贴顶贴底 |
| `DailyForecastChart.vue` | 高/低温双折线 + **温差区间带**（`custom` series 画圆角矩形） | 区间带等价于列表态的「温度范围条」，区间带宽度 `min(网格宽/天数/2.6, 22)` 并设下限 4px 高度保证可见 |

- **图例**：两图都有（`legend`，右上角 `top:0, right:0`），降水概率缺失时 hourly 图例只显示「温度」
- **x 轴标签抽稀**：`labelInterval(count) = count<=8 ? 0 : ceil(count/8)-1`（只对 `xAxis.axisLabel.interval` 有效）
- **series 数值标签抽稀**：⚠️ **`series.label` 没有 `interval` 选项**（只有 `xAxis.axisLabel` 有），抽稀必须走 `formatter` 回调返回空串：`formatter: (p) => p.dataIndex % step === 0 ? \`${p.value}°\` : ''`
- **tooltip**：`trigger:'axis'` + `confine:true`，深色半透明底（`rgba(20,26,40,0.88)`）配白字，避免在渐变背景上不可读；hourly 显示「温度 + 降水概率」，daily 显示「描述 + 最高/最低 + 风」

**⚠️ 主题适配的关键取舍：图表不读 CSS 变量**
天气页是**动态渐变背景 + 毛玻璃卡片**（`.glass-card`），页面上根本没有明暗主题变量体系。若照搬 `HabitHeatmap.vue` 那套 `readVar('--text-muted')` 取色，在渐变底上会**发灰发糊**。因此两个图表组件的配色走**另一条路**（2026-09-30 主题适配改造后的最终方案，见下方「主题适配」小节）：复用 `utils/chartTheme.ts` 的 `THEME_COLORS`（主题色）+ 按明暗档压亮度的语义色。

> **历史变更**：改造前这里是**硬编码白色系色值**（`文字 rgba(255,255,255,.92)/.65/.45`、`网格 rgba(255,255,255,.12)`、`温度 #ffd57c`、`降水 #9fd6ff`、`低温 #7cc4f5`）——那套只在「页面恒为深色渐变」时才成立；用户反馈「主题变化时色彩不跟随」，故改为跟随主题。**别再退回硬编码白色系。**

**切换按钮**：`.view-switch` 分段控件（两个 24×22 图标按钮，`List` / `ChartLine`），`active` 态 `rgba(255,255,255,.28)` 高亮。
- ⚠️ **hourly 区块的 `.source-tag` 原占 `margin-left:auto`**，加按钮后靠「source-tag 保持 auto + 按钮 `margin-left:8px`」；daily 区块无 source-tag，按钮用 `margin-left:auto` 推到右端。

**新增 Lucide 图标**：`ChartLine`（`List` 原本已注册）⇒ **必须在 `LucideIcon.vue` 的 `import` 与 `nameMap` 两处同时加**（本次已加在文件末尾的「天气列表/图表切换用图标」分组）。

**⚠️ ECharts 类型坑（本次踩到，`vue-tsc` 才报，纯 `tsc` 查不出 `.vue` 内部）**：
1. **`series.label` 无 `interval`** ⇒ 报 `Object literal may only specify known properties`，改用 `formatter` 返回空串抽稀。
2. **`series.label.position` 会被推断成 `string`**（bar 的 `position` 是联合字面量类型）⇒ 加 `as const`。
3. **`CustomSeriesRenderItemParams.coordSys` 只声明了 `{type:string}`** ⇒ 取 **`api.getWidth()`** 而非 `params.coordSys.width`。
4. **`label.formatter` 参数必须用 `echarts.DefaultLabelFormatterCallbackParams`**，自定义 `{dataIndex:number; value:number}` 会因 `value` 联合类型不兼容而报 TS2322。
5. **⚠️ `lineStyle` 没有 `shadowOpacity`**（2026-09-30 踩到）：想给折线加柔光只能把透明度**烘进 `shadowColor`**，写 `shadowColor: hexAlpha(color, 0.35)`。误写 `shadowOpacity` 会报 `Object literal may only specify known properties, and 'shadowOpacity' does not exist in type 'LineStyleOption<ZRColor>'`。

**实测验证**（Node + 真 echarts SSR，`echarts.init(null,null,{renderer:'svg',ssr:true})`）：5 个场景全部渲染成功——hourly 24 条（有/无降水）、daily 7 条 / 1 条（无区间带）/ 15 条（标签抽稀），SVG 体积与元素数合理；tooltip 与 label formatter 实调输出正确；区间带坐标换算逐日验证（宽度 22、高度=温差）。校验 `vue-tsc --noEmit -p tsconfig.json` → **exit 0**。
> **方法论**：`.vue` 内的 TS 错误 `tsc -p tsconfig.json` **查不出来**（它不解析 SFC），必须用 **`vue-tsc`**；ECharts option 的运行时正确性可用 **SSR 渲染器在 Node 里真跑一遍**（不需要 jsdom / canvas），比只看类型可靠。
> **⚠️ 在 Node 里加载项目 TS 模块的坑（2026-09-30 实测）**：
> - `ts.transpileModule` 单文件编译**不做类型擦除判断**，`import type` 可能留下空 `require`；但 **`chartTheme.ts` 实测产出 0 条 require**（别照抄「必须 stub」的结论，先打印编译产物里的 require 行确认）。
> - **真正会有 require 的是 `themeMode.ts`**：`require("vue")` / `require("pinia")` / `require("@/store/useTheme")` / `require("./chartTheme")`。`@/` 别名 Node 不认，必须在自定义 `require` 里映射到 `src/`，且**按 `.ts` 递归走同一个 loader**（Node 原生不认识 `.ts`）。`.vue` 文件不能这样加载。
> - **不要 stub 掉 `@/store/useTheme`**：`useThemeMode()` 内部真的会调它，stub 成 `{}` 会在调用时才炸。
> - **`const module = {...}` / `const require = ...` 在 CJS 文件里会与 Node 包装器注入的 `module` / `require` 冲突**（`SyntaxError: Identifier 'module' has already been declared`）。虽然严格说这是语法错误、不该退化成模块解析错误，但**本机实测就是报成了 `Cannot find module '@/store/useTheme'`**，白排查半天 ⇒ 变量名一律改 `fakeModule` / `localRequire`。
> - 排查这类「报错指向 A、真因在 B」的问题：**先打印编译产物的 require 行 + 包一层 `process.on('uncaughtException')` 打完整 stack**，比读代码快得多。


## ✅ 主题适配：背景 + 文字 + 图表三件套（2026-09-30 实施）

**需求**：天气页此前色彩是固定的（写死的白色系 + 固定渐变），不随 26 个主题变化。要求改造后跟随主题。用户明确三条决策：
1. **范围**：背景 + 文字 + 图表三件套一次做完
2. **色彩策略**：**保留天气条件色相、只按明暗压亮度**（不是把背景换成主题色）
3. **明暗判定**：**按 `cardBg` 亮度自动判定**（不手工维护主题名单）

### 1. 明暗档判定：`src/utils/themeMode.ts`（新建）

项目原本**没有**「当前主题是否暗色」的统一标记（`data-theme` 只存主题 ID 如 `dark`/`nord`/`glass`）。该模块**不手工维护主题名单**（易与 `themeOptions` 脱节），而是读 `THEME_COLORS[theme].cardBg` 按 **ITU-R BT.601** 相对亮度（`(0.299r + 0.587g + 0.114b) / 255`）自动分档，阈值 `0.5`。

```ts
export type ThemeMode = 'light' | 'dark'
export function luminance(color: string): number   // 解析失败返回 1（保守按亮色）
export function themeMode(theme: string): ThemeMode  // 未登记主题回落 light
export function useThemeMode(): { mode: ComputedRef<ThemeMode>; isDark: ComputedRef<boolean> }
```
- `cardBg` 正是「卡片底色」的权威声明，**新增主题只要在 `THEME_COLORS` 登记即自动生效**（也因此：加主题必须补 `THEME_COLORS`，否则回落 light 档）
- `glass` 之类的半透明色（`rgba(30,30,50,.6)`）解析出的是**固有色**，深紫底仍正确判为暗色
- **实测**：25 个主题判定全对，仅 **`light` / `catppuccin` / `atom-one-light`** 为亮档（其余 22 个暗档）

### 2. 全局属性 `data-mode`（`src/App.vue`）

`watch(currentTheme)` 里除 `data-theme` 外**新增**写入 `data-mode`（`'light' | 'dark'`）：
```ts
document.documentElement.setAttribute('data-theme', theme)
document.documentElement.setAttribute('data-mode', themeMode(theme))   // 新增
```
> 这是**本次新建的全局约定**（项目原无统一明暗标记）。其他模块要做明暗适配可直接复用 `[data-mode='dark']`。

### 3. 背景：`CONDITION_THEME_MAP` 四档化（`src/views/weather/constants.ts`）

由 `{ day, night }` 改为 **`{ day, night, dayDark, nightDark }`**（10 个 condition 全部补齐）。
- `day` / `night` = **亮档**（保留原值）
- `dayDark` / `nightDark` = **暗档**：**保留天气色相、整体压暗**（如 `sunny.day` 的 `#1d6fc4→#8fc9ef` 压成 `#0d2a45→#1a4a70`）
- `useWeatherTheme.ts` 按 `isDark.value` 选档：暗档取 `nightDark`/`dayDark`，亮档取 `night`/`day`

### 4. 玻璃层语义变量 `--glass-*`（`src/views/weather/index.vue` 内定义，是全页唯一定义处）

**⚠️ 核心架构洞察**：天气页是「动态渐变背景 + 毛玻璃卡片」，**不能直接套 `--bg-card` / `--text-primary` 那套不透明实色 token**——会盖掉渐变、失去毛玻璃质感、并让页面发灰发糊。正确做法是走**玻璃层语义变量**：亮档用**白色叠加提亮**，暗档**翻转成黑色叠加压暗**。

```scss
.weather-page {
  --glass-bg: rgba(255,255,255,.12);          --glass-bg-strong: rgba(255,255,255,.2);
  --glass-bg-weak: rgba(255,255,255,.08);     --glass-hover: rgba(255,255,255,.25);
  --glass-border: rgba(255,255,255,.18);      --glass-border-strong: rgba(255,255,255,.28);
  --glass-divider: rgba(255,255,255,.16);
  --glass-text-primary: rgba(255,255,255,.92);
  --glass-text-secondary: rgba(255,255,255,.65);
  --glass-text-muted: rgba(255,255,255,.45);
  --glass-mark: rgba(255,255,255,.85);        // 图形标记（刻度指针等非文字元素）
  --glass-shadow: 0 8px 32px rgba(0,0,0,.12);
}
:global([data-mode='dark']) .weather-page {
  --glass-bg: rgba(0,0,0,.22);                // ← 翻转成黑叠加
  --glass-bg-strong: rgba(0,0,0,.34);         --glass-bg-weak: rgba(0,0,0,.14);
  --glass-hover: rgba(0,0,0,.42);
  --glass-border: rgba(255,255,255,.1);       --glass-border-strong: rgba(255,255,255,.18);
  --glass-divider: rgba(255,255,255,.12);
  --glass-text-primary: rgba(255,255,255,.96);
  --glass-text-secondary: rgba(255,255,255,.74);
  --glass-text-muted: rgba(255,255,255,.52);
  --glass-mark: rgba(255,255,255,.8);
  --glass-shadow: 0 8px 32px rgba(0,0,0,.4);
}
```
配合 `:deep(.glass-card)` 统一消费这组变量（`background: var(--glass-bg)` + `backdrop-filter: blur(20px)` + `border: 1px solid var(--glass-border)`）。

**13 个组件共 125 处**按属性语义批量替换（**非机械替换**，看的是「这个值是文字还是底色还是描边」）：
| 原语义 | 替换为 |
|---|---|
| `color` alpha ≥.85 / ≥.6 / 其余 | `--glass-text-primary` / `--glass-text-secondary` / `--glass-text-muted` |
| `background` ≥.24 / ≥.16 / ≥.1 / 其余 | `--glass-hover` / `--glass-bg-strong` / `--glass-bg` / `--glass-bg-weak` |
| `border` ≥.24 / ≥.14 / 其余 | `--glass-border-strong` / `--glass-border` / `--glass-divider` |
| `#fff`（仅 color/border 属性） | `--glass-text-primary` |

涉及文件：`WeatherSearch`(24) `DailyForecast`(16) `index.vue`(16) `HourlyForecast`(13) `WeatherHero`(11) `AirQuality`(7) `AstroCard`(7) `LifeIndices`(7) `DebugPanel`(6) `SourceBadge`(6) `WeatherDetails`(4) `MinutelyRain`(3) `WeatherAlert`(3) `WeatherSkeleton`(2)。

**⚠️ 批处理替换的三个坑（本次都踩到，教训见「特有坑」）**：
1. **变量定义区与使用区同处一个文件时，绝不能对该文件无脑跑替换脚本** —— `index.vue` 的 `--glass-bg` 等定义被自己的替换规则改成了 `var(--glass-divider)` / `var(--glass-border)` 造成**自引用循环**，功能完全错乱，只能手工还原两处定义块（亮档 11 行 + 暗档 11 行）。
2. **图形标记色不能用文字色** —— `AirQuality.vue` 的 AQI 刻度指针三角 `border-bottom` 被脚本按「border 属性」误改为 `--glass-text-primary`；为此**新增 `--glass-mark`** 语义（图形标记 ≠ 文字）。
3. **本身已跟主题的面板不要动** —— `DebugPanel.vue` 本就用全局主题变量（`var(--bg-hover, rgba(255,255,255,.05))` 这种带 fallback 的写法已跟随主题），脚本把它的 **fallback 值**也改了，需手工还原 3 处硬编码 fallback。

### 5. 图表：接入 `chartTheme` + 明暗语义色

两个图表组件（`HourlyForecastChart.vue` / `DailyForecastChart.vue`）把原来的**大写硬编码常量**全部改为 **`computed`**：

```ts
const { currentTheme } = storeToRefs(useThemeStore())
const { isDark } = useThemeMode()
const themeColors = computed(() => THEME_COLORS[currentTheme.value] || THEME_COLORS.light)
// 主题色（随 26 主题切换）
const colorText = computed(() => themeColors.value.labelColor)
const colorTextSoft = computed(() => themeColors.value.axisLabel)
const colorGrid = computed(() => themeColors.value.gridLine)
const colorTooltipBg / Border / Text = computed(() => themeColors.value.tooltipBg / tooltipBorder / tooltipText)
// 语义色：保留天气色相，只按明暗调明度
const colorTemp   = computed(() => isDark.value ? '#ffd57c' : '#c9971f')   // 亮档压深以在浅底可读
const colorPrecip = computed(() => isDark.value ? '#9fd6ff' : '#3d8fc4')
const colorHigh / colorLow（daily，同色相规则）
const colorInk     = computed(() => isDark.value ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.45)')  // 折线点描边
const colorInkSoft = computed(() => isDark.value ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.3)')
```
- **`hexAlpha(color, alpha)`** helper：`#rgb`/`#rrggbb` → `rgba()`，用于把语义色按透明度派生（渐变 / 区间带 / 阴影）。**已是 `rgba()` 的输入原样返回**（不叠加透明度）。
- **主题切换必须主动重绘**：`watch([currentTheme, isDark], () => nextTick(render))`（配色在 `buildOption()` 里一次性取值，不重绘不会更新）
- 图表容器背景保持 `transparent`，仍由底层渐变透出

**实测验证**（Node + 真 echarts SSR）：**34 项断言全通过** —— 25 主题明暗判定、`hexAlpha` 4 项单元、light/nord/catppuccin/dracula 四主题 × 两种图的 SSR 渲染 + 语义色出现校验（亮档断言 `#c9971f`/`#2f7fb8`、暗档断言 `#ffd57c`/`#7cc4f5`）、亮暗 SVG 必须不同、单点/单日边界。`vue-tsc --noEmit -p tsconfig.json` → **exit 0**。

> **改完无需重启 Electron**：本次改动**全在渲染端 `src/**`**，热重载即可生效。但 `App.vue` 的 `data-mode` 是首次写入，**建议刷新一次页面**确保属性已设置。


## ✅ 首选数据源 preferredProvider（2026-09-30 实施）

**需求**：数据源配置原本只有「优先级」，再加一个「首选数据源」字段——有值时优先用该源，该源无值/请求失败则按优先级降级。

**配置字段**：`WeatherModuleConfig.preferredProvider?: ProviderId | null`（`null` / `undefined` 均表示「自动，纯按 providerOrder」）。
- `WeatherConfigForUi.preferredProvider: ProviderId | null` 回传渲染端
- `weather:save-config` payload 加 `preferredProvider?: ProviderId | null`，语义 **`undefined` = 保持原值**、**`null` = 显式「自动」**、字符串 = 指定源

**⚠️ 落库归一化 `normalizePreferred(raw)`（`config.ts`）**：`mergeSecrets` 读库时必须校验，**非字符串 / 空串 / 不在已注册 Provider 列表里的值一律回 `null`**（否则脏值会让 UI 下拉显示空白且语义不明）。`splitSecrets` 落库时 `cfg.preferredProvider ?? null` 抹平 `undefined`。

**降级链重排 `resolveChain`（`registry.ts`）—— 只对「可用节点」重排，不可用节点原地不动**：
```ts
const preferred = cfg.preferredProvider;
if (preferred) {
  const order = chain.filter((e) => e.usable);
  const idx = order.findIndex((e) => e.id === preferred);
  if (idx > 0) {                      // idx === 0 ⇒ 本就是首个可用源，跳过
    const [hit] = order.splice(idx, 1);
    order.unshift(hit);
    let cursor = 0;
    chain = chain.map((e) => (e.usable ? order[cursor++] : e));  // 可用位回填，不可用位不动
  }
}
```
**为什么只在可用节点间重排**：`fetchWithFallback` 是「先一次性记录**全部**不可用节点（按链序）→ 再循环可用节点」。若连不可用节点一起 `splice/unshift`，`_trace` 里 skipped 节点的展示顺序就会偏离用户列表所见（实际请求顺序其实不变，但轨迹看起来「跳序」）。分开处理可让 **trace 顺序 ≡ 用户配置的可见顺序**。

**语义边界（三条，UI 提示文案即据此）**：
1. 首选源**可用**（启用 + 凭据齐全）⇒ 提到可用段最前，优先请求
2. 首选源**不可用**（未启用 / 未配置凭据 / 未注册）⇒ **忽略首选**，完全按 providerOrder（它在原位被标 `未启用` / `未配置凭据`）
3. 首选源**请求失败**（报错 / 超时 / 数据不完整）⇒ 记 trace 后继续按 providerOrder 降级其余源（`fetchWithFallback` 循环天然支持，**零改动**）

**UI（`WeatherProviderSettings.vue`）**：`el-select` 放在「数据源优先级」列表**上方**（`.preferred-block` + `.list-divider-block` 分割线），选项 = `自动（按优先级降级）`（`:value="null"`）+ 8 个源。`preferredHint` computed 会在「所选源已停用 / 凭据未填齐」时给出预警文案（提示首选会被忽略）。

**实测验证**：从真实源文件截取 `resolveChain` / `normalizePreferred` 源码，`ts.transpileModule` 编译后沙箱执行 ⇒ **25 项断言全通过**。覆盖：A 未指定 / B 首选可用源 / C 首选被停用 / D 首选缺凭据 / D2 首选补齐凭据 / **E 首选已是首个可用源 ⇒ 整链幂等不变**（含不可用节点位置）/ **E2 首选前方有不可用节点 ⇒ 只提可用节点、不可用节点原地不动** / F 首选原本在末尾 / G 其余源相对序不变 / H `normalizePreferred` 10 种脏值 / I 幂等性 / J 全不可用不抛错。双端类型校验 `tsc -p tsconfig.node.json` + `vue-tsc -p tsconfig.json` → **均 exit 0**。
> **方法论**：主进程模块依赖链深（`electron-store` 需 Electron app 上下文，硬引会报 `Please specify the projectName option`），"把整个模块图跑起来"代价高。**从真实源文件截取待测函数源码 + `ts.transpileModule` + `new Function` 沙箱**是轻量替代——测的仍是真实代码，不是复刻版。


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
- 页面背景按 `condition` + 昼夜（18:00-6:00 为夜间）切换渐变（`useWeatherTheme.backgroundStyle`），并**按主题明暗档取对应档位**（`day`/`night` = 亮档，`dayDark`/`nightDark` = 暗档）
- 调试面板 `DebugPanel.vue`（右下角扳手悬浮展开）**3 个 tab**：请求日志 / 天气原始数据 / **数据源轨迹**（轨迹 + 本次能力清单 tags）

## 数据源配置界面（抽屉）
- 入口：天气页搜索栏右侧「数据源」按钮（`WeatherSearch.vue` emit `openSettings`）→ `index.vue` 挂 `WeatherProviderSettings`（`el-drawer`，620px，rtl）
- `WeatherProviderSettings.vue`：**顶部「首选数据源」下拉**（`.preferred-block`，选项 `自动（按优先级降级）` + 8 源，`preferredHint` 对「已停用 / 凭据未填齐」的首选源给预警）→ 下方源列表（**可上移/下移调整优先级** + 启停开关 + 免配置/已配置/待配置 tag）+ 全局缓存时长与超时；右侧选中源的动态表单 + 「测试连接」按钮（调 `weather:probe-provider`，**用草稿值**）
- `ProviderForm.vue`：按 `configSchema` 动态渲染（text/password/textarea/select/number），支持 `when` 条件显示（如和风 `authMode === 'jwt'` 才显 kid/projectId/developerId/privateKey）；敏感字段**留空 = 保持原值**，占位提示显示「已保存：`abc****xyz`」；底部按 `CAPABILITY_GROUP` 罗列该源支持的能力 tags
- 保存成功后 `index.vue` 的 `handleSettingsSaved` 会**强制刷新当前城市**，让新链路立即生效

## 特有坑 / 注意
- **改主进程必须重启 Electron**（`weather/` 全部文件、`weatherProviders.ts`、`weather.ts` 都算主进程）
- **`types.ts` 双份需同步**：主进程 `electron/main/module/weather/types.ts` 与渲染端 `src/views/weather/types.ts` 结构一一对应，改一侧必须同步另一侧
- **`../types` vs `./types`**：`src/views/weather/` 目录内的**文件**（`capability.ts`/`api.ts`）必须用 `./types`，写成 `../types` 会解析到不存在的 `src/views/types`（TS2307）；而**子目录**里的组件才用 `../types`
- **⚠️ 传 IPC 的 payload 必须先剥 Proxy**（2026-09-29 修）：Electron IPC 用结构化克隆算法，**Proxy 不可克隆**。Vue `reactive()` / `ref()` 包装的值都是 Proxy，直接 `invoke` 会抛 **`An object could not be cloned.`**（表象是「保存失败」）。已修位置：① `WeatherProviderSettings.vue` 的 `handleSave` 传 `providerOrder: [...draft.order]`（原先直接传 `draft.order`，是 reactive Proxy 数组 —— 本次报错的根因）；② `api.ts` 新增 `toPlain()` **统一在 invoke 前剥离**：`toRaw()` 递归下钻（`toRaw` 只剥最外层，深层仍是 Proxy）+ 丢弃函数/Symbol。**凡是把 reactive 数据发给主进程，一律经 `toPlain()` 或先展开成普通数组/对象。**
- **`Partial<Record<ProviderId, X>>` 直索引会报 TS7053**（隐式 any）⇒ 加一层类型安全读写函数，别用 `as any`
- **新增 Lucide 图标必须同时改 `LucideIcon.vue` 的 import 与 nameMap 两处**（漏一处静默 fallback 成 CloudAlert）。天气模块**已注册**的扩展图标：`Leaf` `Activity` `CloudSunRain` `Tornado` `Waves` `UmbrellaIcon` `ChartLine`（`List` 早已注册）。⚠️ **`Cyclone` 在 `@lucide/vue` 中不存在**（会报 TS2305），阵风用 `Wind`、气旋类语义用 `Tornado`
- **⚠️ 校验 `.vue` 必须用 `vue-tsc`，`tsc` 会假绿**：`tsc -p tsconfig.json` **不解析 SFC**，`.vue` 内 `<script setup>` 的类型错误它**完全不报**（本次 4 个 ECharts 类型错误全是 `vue-tsc` 抓到的）。命令：`node ./node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.json`
- **⚠️ ECharts option 的运行时正确性可用 SSR 渲染器在 Node 里实跑**：`echarts.init(null, null, { renderer: 'svg', ssr: true, width: 800, height: 200 })` **不需要 jsdom / canvas**，`setOption` + `renderToSVGString()` 即可验证 option 合法性与元素数量，比只看类型可靠得多
- **⚠️ ECharts 图表不要读 `--text-*` 那套不透明实色 CSS 变量**（本页特有）：天气页是动态渐变背景 + 毛玻璃卡片，**没有明暗主题变量体系**，`readVar('--text-muted')` 一类取色在渐变底上会发灰发糊。图表的正确做法是**复用 `utils/chartTheme.ts` 的主题色 + 按明暗档压亮度的语义色**（见「预报区块 列表/图表 双形态」与「主题适配」小节）；DOM 部分则走页面内定义的 **`--glass-*` 玻璃层语义变量**。
- **⚠️ 天气页配色不能套不透明实色 token**（2026-09-30）：`--bg-card` / `--text-primary` 会盖掉动态渐变、失去毛玻璃质感。必须用 `--glass-*` 一组变量，**亮档白叠加提亮、暗档翻转成黑叠加压暗**（在 `index.vue` 用 `[data-mode='dark']` 覆盖）。详见「主题适配」小节第 4 点。
- **⚠️ 批处理替换脚本在「定义区与使用区同文件」时极度危险**（2026-09-30 实惨）：`index.vue` 的 `--glass-*` 定义被自己的替换规则改成 `var(--glass-divider)` 造成自引用循环；`AirQuality` 的图形标记被误改成文字色；`DebugPanel` 本已跟主题的 fallback 被改花。**跑批量替换前先排除变量定义块，跑完必须逐文件 review，别只看 diff 行数。**
- **降级链不降级「配置错误」**：和风 host 非法 / 私钥格式错等会在 `probe` 阶段就拦下并给出中文提示；运行时失败会写入 `_trace` 的 `error`
- **⚠️ 首选数据源只重排「可用节点」，不可用节点必须原地不动**（2026-09-30）：`fetchWithFallback` 先一次性记录**全部**不可用节点再循环可用节点，若重排时把不可用节点也 `splice/unshift`，`_trace` 的 skipped 顺序就会与用户列表所见不一致。详见上方「首选数据源 preferredProvider」小节。
- **⚠️ `preferredProvider` 读库必须过 `normalizePreferred`**：非字符串 / 空串 / 不在已注册列表的值一律回 `null`；`save-config` 的 payload 语义是 **`undefined` = 保持原值**、**`null` = 显式「自动」**，两者不可混用（`undefined` 会被当成「不改」而不落库）。
- **⚠️ 新增主题必须同步 `THEME_COLORS`**（2026-09-30）：`themeMode()` 按 `THEME_COLORS[theme].cardBg` 亮度判明暗，未登记的主题会**静默回落 light 档**（暗色主题被当亮色 ⇒ 文字在深底上看不见）。加主题时 `useTheme.ts` 的 `themeOptions` 与 `chartTheme.ts` 的 `THEME_COLORS` **两处都要加**。
- **⚠️ 单例 composable 按 key 取值必须用可写 `computed`，禁用 `ref(单例.value[key])`**（2026-09-30）：后者是游离值拷贝，静默断掉持久化与跨组件共享（类型检查也查不出）。且持久化要**同步落盘**，不能只靠 `watch` 的异步 flush。详见「预报区块 列表/图表 双形态」小节。
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

