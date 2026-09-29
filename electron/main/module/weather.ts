/**
 * 天气模块 - 兼容转发层（shim）
 * ------------------------------------------------------------------
 * 本文件在 2026-09-29 的「多数据源可插拔」改造中从原爬虫实现改为转发层。
 *
 * 改造前：本文件承载 Puppeteer 爬虫链路（485 行），单数据源硬编码。
 * 改造后：实现按职责拆分到 ./weather/ 目录，本文件仅保留对外导出，
 *         保证 `electron/main/index.ts` 的 `initWeather()` 调用点零改动。
 *
 * 目录结构：
 *   weather/index.ts           IPC 注册 + 内存缓存（入口）
 *   weather/registry.ts        降级链调度 + 超时保护 + probe
 *   weather/config.ts          配置读写 + 凭据加密（basic_info / weatherConfig）
 *   weather/capability.ts      能力清单与分组
 *   weather/normalize.ts       数值/文本归一化工具
 *   weather/types.ts           共享类型
 *   weather/providers/         各数据源适配器（qweather / openMeteo / crawler）
 *   weather/data/cnCities.ts   城市名 → 经纬度离线表（零 Key 源使用）
 *
 * 数据源优先级（默认）：和风天气 → Open-Meteo → 内置爬虫兜底
 */

export { initWeather, clearWeatherCache } from './weather/index.ts';

export type {
  WeatherData,
  WeatherCondition,
  ForecastDay,
  WeatherIndex,
  HourlyForecast,
  AirQuality,
  WeatherWarning,
  AstroInfo,
  MinutelyRain,
  WeatherCapability,
  ProviderId,
  ProviderTrace,
  ProviderSummary,
  ProviderConfigField,
  SecretStatus,
  WeatherConfigForUi,
  WeatherModuleConfig,
  WeatherProvider,
} from './weather/types.ts';

export {
  ALL_CAPABILITIES,
  CAPABILITY_LABEL,
  CAPABILITY_GROUP,
  PROVIDER_CAPABILITIES,
  hasCapabilityDomain,
  capabilityLabel,
} from './weather/capability.ts';
