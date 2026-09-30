/**
 * 天气数据源 - 高德地图 AMap
 * ------------------------------------------------------------------
 * - 个人开发者认证后 5000 次/月（以官网为准）
 * - 文档：https://lbs.amap.com/api/webservice/guide/api/weatherinfo
 *
 * 关键实现要点：
 * - 单接口双模式：`extensions=base` 取实况，`extensions=all` 取预报（需分别请求）
 * - `city` 参数官方要求 **adcode**（城市编码），非城市名 ⇒ 用本地坐标表的 adcode
 *   · 有 cityRef.adcode 直接用；否则按城市名反查本地表
 * - ⚠️ 字段很少：无体感 / 气压 / 能见度 / 紫外线 / 生活指数 / AQI
 *   · 实况只有 temperature / weather / winddirection / windpower / humidity
 *   · 且**无逐日以外的预报粒度**，预报最多 4 天（当天 + 未来 3 天）
 * - 风向是文字（如「东北」），风力是文字（如「≤3」），需归一化
 * - 返回 `status: '1'` 为成功，`status: '0'` 失败（info 为错误码描述）
 */

import { PROVIDER_CAPABILITIES } from '../capability.ts';
import { isUsableWeatherData, normalizeCondition, round } from '../normalize.ts';
import { getAllAreas } from '../data/cnCities.ts';
import type {
  ForecastDay, ProviderConfigField, WeatherCapability, WeatherData, WeatherProvider,
} from '../types.ts';

/* ===================== 常量 ===================== */

const API_BASE = 'https://restapi.amap.com/v3/weather/weatherInfo';

/** 高德配置表单定义 */
const CONFIG_SCHEMA: ProviderConfigField[] = [
  {
    key: 'apiKey', label: 'Web 服务 Key', type: 'password', required: true, secret: true,
    placeholder: '在控制台「应用管理 → 我的应用」创建 Web 服务类型 Key',
    help: '个人认证 5000 次/月；接口按 adcode 查询，本地坐标表已内置全国 adcode',
  },
];

/* ===================== 定位 ===================== */

/** 坐标 → adcode 的惰性索引（全国 3237 条，构建一次后 O(1) 命中） */
let coordIndex: Map<string, number> | null = null;

/** 坐标键（经纬度各保留 6 位小数，规避浮点误差） */
function coordKey(lng: number, lat: number): string {
  return `${lng.toFixed(6)},${lat.toFixed(6)}`;
}

/** 构建坐标索引 */
function buildCoordIndex(): Map<string, number> {
  if (coordIndex) return coordIndex;
  const map = new Map<string, number>();
  for (const area of getAllAreas()) {
    map.set(coordKey(area.lng, area.lat), area.adcode);
  }
  coordIndex = map;
  return map;
}

/**
 * 解析高德接口所需的 adcode
 * 优先级：cityRef.adcode → 本地表按坐标反查
 * @param city 城市名
 * @param config 运行期配置（可能带 cityRef）
 * @returns adcode 数字串；无法解析时返回空串
 */
function resolveAdcode(city: string, config: any): string {
  const hint = config?.cityRef;
  if (hint?.adcode) return String(hint.adcode);

  const coords = config.__coords as { lat: number; lon: number } | null;
  if (!coords) return '';

  const adcode = buildCoordIndex().get(coordKey(coords.lon, coords.lat));
  return adcode ? String(adcode) : '';
}

/* ===================== 请求封装 ===================== */

/**
 * 发起高德天气请求
 * @param config 运行期配置
 * @param city adcode
 * @param extensions base（实况）/ all（预报）
 */
async function request(config: any, city: string, extensions: 'base' | 'all'): Promise<any> {
  const key = config.credentials?.apiKey;
  if (!key) throw new Error('未配置高德 Key');
  if (!city) throw new Error('未解析到城市 adcode');

  const url = new URL(API_BASE);
  url.searchParams.set('key', key);
  url.searchParams.set('city', city);
  url.searchParams.set('extensions', extensions);
  url.searchParams.set('output', 'JSON');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(config.timeout ?? 15000) });
  if (!res.ok) throw new Error(`高德 HTTP ${res.status}`);

  const json = await res.json();
  if (json?.status !== '1') {
    throw new Error(`高德错误 ${json?.infocode || ''}（${json?.info || '未知'}）`);
  }
  return json;
}

/** 高德风力文字（如「≤3」「4」）→ 数字风级 */
function parseWindPower(power?: string): number | undefined {
  if (!power) return undefined;
  const m = String(power).match(/\d+/);
  return m ? Number(m[0]) : undefined;
}

/* ===================== 主流程 ===================== */

/**
 * 从高德地图拉取并归一化
 * @param city 中文城市名
 * @param config 运行期配置
 */
async function fetchFromAmap(city: string, config: any): Promise<WeatherData> {
  const adcode = resolveAdcode(city, config);

  // 实况 + 预报（两个接口分别请求）
  const [liveRes, forecastRes] = await Promise.allSettled([
    request(config, adcode, 'base'),
    request(config, adcode, 'all'),
  ]);
  const live = liveRes.status === 'fulfilled' ? liveRes.value?.lives?.[0] : null;
  const casts: any[] = forecastRes.status === 'fulfilled'
    ? (forecastRes.value?.forecasts?.[0]?.casts || [])
    : [];

  if (!live && !casts.length) {
    // 两个接口都空：抛出实况请求的真实原因（Key 无效 / 配额 / 网络）
    const reason = liveRes.status === 'rejected' ? (liveRes as PromiseRejectedResult).reason
      : forecastRes.status === 'rejected' ? (forecastRes as PromiseRejectedResult).reason : null;
    throw new Error(`高德获取失败：${(reason as Error)?.message || '实况与预报均无数据'}`);
  }

  /* ---- 逐日预报（当天 + 未来 3 天） ---- */
  const forecast: ForecastDay[] = casts.map((c: any, i: number) => {
    const desc = c.dayweather || c.nightweather || '未知';
    return {
      date: i === 0 ? '今天' : i === 1 ? '明天' : String(c.date || '').slice(5) || `D${i + 1}`,
      high: round(c.daytemp),
      low: round(c.nighttemp),
      description: desc,
      icon: normalizeCondition(desc),
      windDirection: c.daywind || undefined,
      windPower: c.daypower ? `${parseWindPower(c.daypower) ?? ''}级` : undefined,
    };
  });

  const desc = live?.weather || casts[0]?.dayweather || '未知';
  const windScale = parseWindPower(live?.windpower);

  /* ---- 能力清单：静态声明 ∩ 本次真拿到数据 ---- */
  const capabilities: WeatherCapability[] = PROVIDER_CAPABILITIES.amap.filter((cap) => {
    if (cap.startsWith('forecast.daily')) return forecast.length > 0;
    if (cap === 'current.humidity') return !!live?.humidity;
    if (cap === 'current.windDirection') return !!live?.winddirection;
    if (cap === 'current.windScale') return windScale != null;
    return true;
  });

  const data: WeatherData = {
    /* ---- 基础字段（兜底齐全） ---- */
    temperature: round(live?.temperature ?? casts[0]?.daytemp),
    // 高德无体感温度，用实况温度兜底（能力清单不声明 feelsLike ⇒ 界面不展示该格）
    feelsLike: round(live?.temperature ?? casts[0]?.daytemp),
    description: desc,
    humidity: live?.humidity ? round(live.humidity) : 0,
    windDirection: live?.winddirection || '未知',
    windSpeed: windScale != null ? `${windScale}级` : '未知',
    // 高德无能见度字段，兜底 10km（能力清单不声明 ⇒ 界面不展示）
    visibility: 10,
    updateTime: Date.now(),
    forecast,
    city: live?.city || city,
    condition: normalizeCondition(desc),

    /* ---- 扩展字段 ---- */
    source: '高德天气',
    capabilities,
    windScale,
  };

  if (!isUsableWeatherData(data)) throw new Error('高德返回数据不可用');
  return data;
}

/** 高德天气 Provider */
export const amapProvider: WeatherProvider = {
  id: 'amap',
  label: '高德天气',
  zeroConfig: false,
  capabilities: PROVIDER_CAPABILITIES.amap,
  configSchema: CONFIG_SCHEMA,
  fetch: fetchFromAmap,

  /** 连通性自检：用北京 adcode 查一次实况 */
  async probe(config) {
    if (!config.credentials?.apiKey) return { ok: false, message: '请先填写 Web 服务 Key' };
    try {
      const json = await request(config, '110000', 'base');
      const hit = json?.lives?.[0];
      return hit
        ? { ok: true, message: `连接正常，定位到「${hit.city}」，实况 ${hit.weather} ${hit.temperature}°C` }
        : { ok: false, message: '接口返回但无数据' };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
};
