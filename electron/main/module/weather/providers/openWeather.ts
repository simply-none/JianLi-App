/**
 * 天气数据源 - OpenWeatherMap
 * ------------------------------------------------------------------
 * - 免费版 1000 次/日（以官网为准）
 * - 文档：https://openweathermap.org/current 、https://openweathermap.org/api/air-pollution
 *
 * 关键实现要点：
 * - 鉴权：Query 参数 `appid`（API Key）
 * - ⚠️ 内置 geocoding（按城市名 `q=`）**已废弃且不支持中文** ⇒ 统一走
 *   `/geo/1.0/direct` 或者直接用本地坐标表（本 adapter 用本地表，最稳）
 * - 单位：`units=metric` 得摄氏度 / m/s；`lang=zh_cn` 可得中文描述
 * - ⚠️ **无中文生活指数、无天气预警**（免费版）；降水概率只在 forecast 里
 * - 免费版 forecast 接口是「5 天 / 3 小时」采样（非逐小时连续），此处按 3h 粒度取前 24 条
 * - `dew_point` 免费版实况**不返回**（需 One Call 3.0）⇒ 能力清单不声明
 * - `sunrise` / `sunset` 为 UTC 秒级时间戳，需用响应中的 `timezone`（秒偏移）换算本地时刻
 * - 错误：HTTP 401（Key 无效）/ 429（超限），响应体含 `message`
 */

import { PROVIDER_CAPABILITIES } from '../capability.ts';
import { degreeToCn, isUsableWeatherData, normalizeCondition, round } from '../normalize.ts';
import type {
  AirQuality, AstroInfo, ForecastDay, HourlyForecast, ProviderConfigField,
  WeatherCapability, WeatherData, WeatherProvider,
} from '../types.ts';

/* ===================== 常量 ===================== */

const WEATHER_API = 'https://api.openweathermap.org/data/2.5/weather';
const FORECAST_API = 'https://api.openweathermap.org/data/2.5/forecast';
const AIR_API = 'https://api.openweathermap.org/data/2.5/air_pollution';

/** OpenWeatherMap 配置表单定义 */
const CONFIG_SCHEMA: ProviderConfigField[] = [
  {
    key: 'apiKey', label: 'API Key', type: 'password', required: true, secret: true,
    placeholder: '在 https://home.openweathermap.org/api_keys 创建',
    help: '免费版 1000 次/日；新 Key 需等待约 10 分钟生效。天气描述已是中文（lang=zh_cn）',
  },
];

/** OWM 空气质量 AQI（1~5 档整数）→ 中文等级 */
const AQI_CATEGORY: Record<number, string> = {
  1: '优', 2: '良', 3: '轻度污染', 4: '中度污染', 5: '重度污染',
};

/* ===================== 请求封装 ===================== */

/**
 * 发起 OWM 请求
 * @param url0 基础 URL
 * @param config 运行期配置（含 apiKey）
 * @param query 查询参数
 */
async function request(url0: string, config: any, query: Record<string, string>): Promise<any> {
  const key = config.credentials?.apiKey;
  if (!key) throw new Error('未配置 OpenWeatherMap API Key');

  const url = new URL(url0);
  url.searchParams.set('appid', key);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(config.timeout ?? 15000) });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.message || `HTTP ${res.status}`;
    throw new Error(`OpenWeatherMap 错误：${msg}`);
  }
  return json;
}

/** UTC 秒级时间戳 + 时区偏移（秒）→ HH:mm */
function tsToHm(sec?: number, tzOffsetSec = 0): string {
  if (sec == null) return '';
  const d = new Date((sec + tzOffsetSec) * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** Unix 秒 → 本地日期串 MM-DD（按 offset 换算） */
function tsToDate(sec?: number, tzOffsetSec = 0): string {
  if (sec == null) return '';
  const d = new Date((sec + tzOffsetSec) * 1000);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/* ===================== 主流程 ===================== */

/**
 * 从 OpenWeatherMap 拉取并归一化
 * @param city 中文城市名
 * @param config 运行期配置
 */
async function fetchFromOpenWeather(city: string, config: any): Promise<WeatherData> {
  const coords = config.__coords as { lat: number; lon: number } | null;
  if (!coords) throw new Error(`本地坐标表未收录「${city}」，OpenWeatherMap 无法定位`);
  const q = { lat: String(coords.lat), lon: String(coords.lon), units: 'metric', lang: 'zh_cn' };

  // 并发取：实况 / 预报 / 空气质量
  const settled = await Promise.allSettled([
    request(WEATHER_API, config, q),
    request(FORECAST_API, config, q),
    request(AIR_API, config, { lat: q.lat, lon: q.lon }),
  ]);
  const pick = (i: number): any =>
    settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<any>).value : null;

  const cur = pick(0);
  if (!cur || !cur.main) {
    // 实况是唯一必需项：失败时抛出真实原因（Key 无效 401 / 超限 429 / 网络）
    const reason = settled[0].status === 'rejected' ? (settled[0] as PromiseRejectedResult).reason : null;
    throw new Error(`OpenWeatherMap 实况获取失败：${(reason as Error)?.message || '无响应'}`);
  }

  const tz = Number(cur.timezone) || 0;
  const desc = cur.weather?.[0]?.description || '未知';

  /* ---- 逐日预报：从 3 小时粒度聚合（OWM 免费版无逐日接口） ---- */
  const list: any[] = pick(1)?.list || [];
  const dayMap = new Map<string, { high: number; low: number; desc: string; windDeg?: number; windSpeed?: number; pop?: number }>();
  for (const item of list) {
    const key = tsToDate(item.dt, tz);
    if (!key) continue;
    const t = Number(item.main?.temp);
    const d = item.weather?.[0]?.description || '未知';
    const exist = dayMap.get(key);
    if (!exist) {
      dayMap.set(key, {
        high: t, low: t, desc: d,
        windDeg: item.wind?.deg, windSpeed: item.wind?.speed,
        pop: item.pop != null ? Math.round(item.pop * 100) : undefined,
      });
    } else {
      exist.high = Math.max(exist.high, t);
      exist.low = Math.min(exist.low, t);
    }
  }
  const forecast: ForecastDay[] = [...dayMap.entries()].slice(0, 7).map(([date, d], i) => ({
    date: i === 0 ? '今天' : i === 1 ? '明天' : date,
    high: round(d.high),
    low: round(d.low),
    description: d.desc,
    icon: normalizeCondition(d.desc),
    windDirection: d.windDeg != null ? degreeToCn(d.windDeg) || undefined : undefined,
    windPower: d.windSpeed != null ? `${Math.max(1, Math.round(d.windSpeed * 3.6 / 12))}级` : undefined,
  }));

  /* ---- 逐小时预报：取未来 24 条 3h 采样 ---- */
  const hourly: HourlyForecast[] = list.slice(0, 8).map((item) => {
    const d = item.weather?.[0]?.description || '未知';
    return {
      time: tsToHm(item.dt, tz),
      temperature: round(item.main?.temp),
      condition: normalizeCondition(d),
      precipProbability: item.pop != null ? Math.round(item.pop * 100) : undefined,
    };
  });

  /* ---- 空气质量 ---- */
  const airRaw = pick(2)?.list?.[0];
  const airQuality: AirQuality | undefined = airRaw?.main
    ? {
        aqi: Number(airRaw.main.aqi) || 0,
        category: AQI_CATEGORY[Number(airRaw.main.aqi)] || '',
        pm25: airRaw.components?.pm2_5 != null ? round(airRaw.components.pm2_5) : undefined,
      }
    : undefined;

  /* ---- 天文（实况接口自带 sunrise/sunset） ---- */
  const astro: AstroInfo | undefined = cur.sys?.sunrise
    ? { sunrise: tsToHm(cur.sys.sunrise, tz), sunset: tsToHm(cur.sys.sunset, tz) }
    : undefined;

  const windSpeedMs = cur.wind?.speed;

  /* ---- 能力清单：静态声明 ∩ 本次真拿到数据 ---- */
  const capabilities: WeatherCapability[] = PROVIDER_CAPABILITIES.openWeather.filter((cap) => {
    if (cap.startsWith('air.')) return !!airQuality;
    if (cap === 'astro.sunriseSunset') return !!astro?.sunrise;
    if (cap === 'forecast.hourly') return hourly.length > 0;
    if (cap.startsWith('forecast.daily')) return forecast.length > 0;
    if (cap === 'forecast.precipitation') return hourly.some((h) => h.precipProbability != null);
    if (cap === 'forecast.dailyWind') return forecast.some((f) => f.windDirection || f.windPower);
    if (cap === 'current.windGust') return cur.wind?.gust != null;
    if (cap === 'current.cloudCover') return cur.clouds?.all != null;
    if (cap === 'current.pressure') return cur.main?.pressure != null;
    if (cap === 'current.precipitation') return cur.rain?.['1h'] != null || cur.snow?.['1h'] != null;
    if (cap === 'current.visibility') return cur.visibility != null;
    return true;
  });

  const data: WeatherData = {
    /* ---- 基础字段（兜底齐全） ---- */
    temperature: round(cur.main.temp),
    feelsLike: round(cur.main.feels_like ?? cur.main.temp),
    description: desc,
    humidity: round(cur.main.humidity),
    windDirection: degreeToCn(cur.wind?.deg) || '未知',
    windSpeed: windSpeedMs != null ? `${Math.max(1, Math.round(windSpeedMs * 3.6 / 12))}级` : '未知',
    visibility: cur.visibility != null ? round(cur.visibility / 1000) : 10,
    updateTime: Date.now(),
    forecast,
    city: cur.name || city,
    condition: normalizeCondition(desc),

    /* ---- 扩展字段 ---- */
    source: 'OpenWeatherMap',
    capabilities,
    pressure: cur.main.pressure != null ? round(cur.main.pressure) : undefined,
    cloudCover: cur.clouds?.all != null ? round(cur.clouds.all) : undefined,
    windGust: cur.wind?.gust != null ? round(cur.wind.gust * 3.6) : undefined, // m/s → km/h
    precipitation: cur.rain?.['1h'] ?? cur.snow?.['1h'] ?? undefined,
    airQuality,
    hourly: hourly.length ? hourly : undefined,
    astro,
    // ⚠️ 免费版无天气预警（Alert API 需 One Call 3.0 / 付费）⇒ 不声明 alert.warning
  };

  if (!isUsableWeatherData(data)) throw new Error('OpenWeatherMap 返回数据不可用');
  return data;
}

/** OpenWeatherMap Provider */
export const openWeatherProvider: WeatherProvider = {
  id: 'openWeather',
  label: 'OpenWeatherMap',
  zeroConfig: false,
  capabilities: PROVIDER_CAPABILITIES.openWeather,
  configSchema: CONFIG_SCHEMA,
  fetch: fetchFromOpenWeather,

  /** 连通性自检：用北京坐标查一次实况 */
  async probe(config) {
    if (!config.credentials?.apiKey) return { ok: false, message: '请先填写 API Key' };
    try {
      const json = await request(WEATHER_API, config, {
        lat: '39.92', lon: '116.41', units: 'metric', lang: 'zh_cn',
      });
      return json?.main
        ? { ok: true, message: `连接正常，北京实况 ${json.weather?.[0]?.description} ${round(json.main.temp)}°C` }
        : { ok: false, message: '接口返回但无数据' };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
};
