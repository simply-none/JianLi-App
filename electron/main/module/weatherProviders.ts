/**
 * 天气模块 - Provider 注册表（barrel）
 * ------------------------------------------------------------------
 * 单一注册点：新增数据源只需在此 import 并加入 PROVIDERS 数组。
 * 供 config.ts 读取各 provider 的 configSchema / capabilities，
 * 供 registry.ts 做调度。
 *
 * 拆分为独立文件是为了避免 config.ts ↔ providers 之间的循环依赖：
 * config.ts 只依赖本 barrel，providers 只依赖 types/normalize。
 */

import type { WeatherProvider } from './weather/types.ts';
import { openMeteoProvider } from './weather/providers/openMeteo.ts';
import { qweatherProvider } from './weather/providers/qweather.ts';
import { crawlerProvider } from './weather/providers/crawler.ts';

/** 全部已注册的 Provider */
export const PROVIDERS: WeatherProvider[] = [
  qweatherProvider,
  openMeteoProvider,
  crawlerProvider,
];

/** 按 id 索引的 Provider 映射 */
export const PROVIDER_MAP: Record<string, WeatherProvider> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p])
);

/** 取全部已注册 Provider */
export function getAllProviders(): WeatherProvider[] {
  return PROVIDERS;
}

/** 按 id 取 Provider（不存在返回 undefined） */
export function getProvider(id: string): WeatherProvider | undefined {
  return PROVIDER_MAP[id];
}
