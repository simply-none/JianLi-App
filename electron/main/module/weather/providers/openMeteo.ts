/**
 * 天气数据源 - Open-Meteo（零配置）
 * ------------------------------------------------------------------
 * - 非商用 < 10000 次/日，无需注册 / 无需 Key，CC BY 4.0
 * - 文档：https://open-meteo.com/en/docs
 *
 * 局限（已在能力清单中如实声明，不做数据造假）：
 * - 无生活指数、无空气质量、无天气预警、无月相
 * - weather_code 为 WMO 数字码，需本地映射为中文描述
 * - 不支持中文城市名搜索 ⇒ 依赖本地经纬度表（./data/cnCities.ts）
 */

import { PROVIDER_CAPABILITIES } from '../capability.ts';
import {
  degreeToCn, isUsableWeatherData, normalizeCondition, round,
} from '../normalize.ts';
import { lookupCityCoords } from '../data/cnCities.ts';
import type {
  ForecastDay, HourlyForecast, WeatherCapability, WeatherData, WeatherProvider,
} from '../types.ts';

const API_BASE = 'https://api.open-meteo.com/v1/forecast';

/**
 * WMO 天气码 → 中文描述
 * 参考 https://open-meteo.com/en/docs 的 WMO Weather interpretation codes
 */
const WMO_CODE_CN: Record<number, string> = {
  0: '晴', 1: '晴间多云', 2: '多云', 3: '阴',
  45: '雾', 48: '冻雾',
  51: '毛毛雨', 53: '小雨', 55: '中雨', 56: '冻毛毛雨', 57: '冻雨',
  61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '强冻雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
  80: '阵雨', 81: '强阵雨', 82: '暴雨',
  85: '阵雪', 86: '强阵雪',
  95: '雷阵雨', 96: '雷阵雨伴冰雹', 97: '强雷暴',
};

/** 请求参数（一次性取齐实况 + 逐日 + 逐小时） */
const CURRENT_FIELDS = [
  'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
  'is_day', 'weather_code', 'cloud_cover',
  'surface_pressure', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'dew_point_2m', 'precipitation', 'visibility',
].join(',');

const HOURLY_FIELDS = [
  'temperature_2m', 'weather_code', 'precipitation_probability',
].join(',');

const DAILY_FIELDS = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min',
  'uv_index_max', 'sunrise', 'sunset', 'precipitation_probability_max',
  'wind_speed_10m_max', 'wind_direction_10m_dominant',
].join(',');

/** Open-Meteo 响应结构（仅声明用到的字段） */
interface OpenMeteoResponse {
  current?: Record<string, unknown>;
  hourly?: { time?: string[]; temperature_2m?: number[]; weather_code?: number[]; precipitation_probability?: number[] };
  daily?: {
    time?: string[]; weather_code?: number[]; temperature_2m_max?: number[];
    temperature_2m_min?: number[]; uv_index_max?: number[]; sunrise?: string[]; sunset?: string[];
    precipitation_probability_max?: number[]; wind_speed_10m_max?: number[];
    wind_direction_10m_dominant?: number[];
  };
  error?: boolean;
  reason?: string;
}

/** 日期串（YYYY-MM-DD）→ 展示文本（今天 / 明天 / MM-DD） */
function formatDayLabel(iso: string, index: number): string {
  if (index === 0) return '今天';
  if (index === 1) return '明天';
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}-${m[2]}` : iso;
}

/** ISO 本地时间串 → HH:mm */
function pickHm(iso?: string): string {
  const m = (iso || '').match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
}

/**
 * 拉取并归一化天气数据
 * @param city 中文城市名
 * @param config 运行期配置
 */
async function fetchFromOpenMeteo(city: string, config: any): Promise<WeatherData> {
  // 有消歧提示（adcode / 坐标）时优先按其定位，跳过名称猜测
  const coords = lookupCityCoords(city, config?.cityRef);
  if (!coords) {
    throw new Error(`本地坐标表未收录「${city}」，Open-Meteo 无法定位（可先启用和风天气）`);
  }

  const url = new URL(API_BASE);
  url.searchParams.set('latitude', String(coords.lat));
  url.searchParams.set('longitude', String(coords.lon));
  url.searchParams.set('current', CURRENT_FIELDS);
  url.searchParams.set('hourly', HOURLY_FIELDS);
  url.searchParams.set('daily', DAILY_FIELDS);
  url.searchParams.set('timezone', 'Asia/Shanghai');
  url.searchParams.set('forecast_days', '7');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(config.timeout ?? 15000) });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);

  const json = (await res.json()) as OpenMeteoResponse;
  if (json.error) throw new Error(`Open-Meteo 错误: ${json.reason || '未知'}`);

  const cur = json.current || {};
  const num = (v: unknown): number | undefined => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const code = num(cur.weather_code) ?? 0;
  const desc = WMO_CODE_CN[code] ?? '未知';

  /* ---- 逐日预报 ---- */
  const daily = json.daily || {};
  const forecast: ForecastDay[] = (daily.time || []).map((iso, i) => {
    const dayCode = daily.weather_code?.[i] ?? 0;
    const dayDesc = WMO_CODE_CN[dayCode] ?? '未知';
    const windDir = degreeToCn(daily.wind_direction_10m_dominant?.[i]);
    const windMax = daily.wind_speed_10m_max?.[i];
    return {
      date: formatDayLabel(iso, i),
      high: round(daily.temperature_2m_max?.[i]),
      low: round(daily.temperature_2m_min?.[i]),
      description: dayDesc,
      icon: normalizeCondition(dayDesc),
      windDirection: windDir || undefined,
      windPower: windMax != null ? `${Math.max(1, Math.round(windMax / 12))}级` : undefined,
    };
  });

  /* ---- 逐小时预报（未来 24 条，从当前整点起） ---- */
  const hourly: HourlyForecast[] = [];
  const hTimes = json.hourly?.time || [];
  if (hTimes.length) {
    const nowIso = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    let start = hTimes.findIndex((t) => t.slice(0, 13) >= nowIso);
    if (start < 0) start = 0;
    for (let i = start; i < Math.min(start + 24, hTimes.length); i++) {
      const hCode = json.hourly?.weather_code?.[i] ?? 0;
      const hDesc = WMO_CODE_CN[hCode] ?? '未知';
      hourly.push({
        time: pickHm(hTimes[i]),
        temperature: round(json.hourly?.temperature_2m?.[i]),
        condition: normalizeCondition(hDesc),
        precipProbability: num(json.hourly?.precipitation_probability?.[i]),
      });
    }
  }

  /* ---- 能力清单：静态声明 ∩ 本次真拿到数据 ---- */
  const capabilities: WeatherCapability[] = PROVIDER_CAPABILITIES.openMeteo.filter((cap) => {
    if (cap.startsWith('forecast.daily')) return forecast.length > 0;
    if (cap === 'forecast.hourly') return hourly.length > 0;
    if (cap === 'forecast.precipitation') return (daily.precipitation_probability_max || []).length > 0;
    if (cap === 'forecast.uvIndexMax') return (daily.uv_index_max || []).length > 0;
    if (cap === 'astro.sunriseSunset') return !!daily.sunrise?.[0];
    return true;
  });

  const visibilityM = num(cur.visibility);
  const windMs = num(cur.wind_speed_10m);          // 默认单位 km/h（请求未改单位）
  const windGust = num(cur.wind_gusts_10m);

  const data: WeatherData = {
    /* ---- 基础字段（兜底齐全） ---- */
    temperature: round(cur.temperature_2m),
    feelsLike: round(num(cur.apparent_temperature) ?? num(cur.temperature_2m)),
    description: desc,
    humidity: round(cur.relative_humidity_2m),
    windDirection: degreeToCn(num(cur.wind_direction_10m)) || '未知',
    // Open-Meteo 不提供蒲福风级，用 km/h 近似换算（12 km/h ≈ 1 级）
    windSpeed: windMs != null ? `${Math.max(1, Math.round(windMs / 12))}级` : '未知',
    visibility: visibilityM != null ? round(visibilityM / 1000) : 10,
    updateTime: Date.now(),
    forecast,
    city,
    condition: normalizeCondition(desc),

    /* ---- 扩展字段 ---- */
    source: 'Open-Meteo',
    capabilities,
    pressure: round(num(cur.surface_pressure)),
    dewPoint: round(num(cur.dew_point_2m)),
    cloudCover: round(num(cur.cloud_cover)),
    windGust: windGust != null ? round(windGust) : undefined,
    precipitation: num(cur.precipitation),
    uvIndex: num(daily.uv_index_max?.[0]),
    isDay: num(cur.is_day) === 1,
    hourly,
    astro: daily.sunrise?.[0]
      ? { sunrise: pickHm(daily.sunrise[0]), sunset: pickHm(daily.sunset?.[0]) }
      : undefined,
  };

  if (!isUsableWeatherData(data)) throw new Error('Open-Meteo 返回数据不可用');
  return data;
}

/** Open-Meteo Provider（零配置） */
export const openMeteoProvider: WeatherProvider = {
  id: 'openMeteo',
  label: 'Open-Meteo',
  zeroConfig: true,
  capabilities: PROVIDER_CAPABILITIES.openMeteo,
  configSchema: [],
  fetch: fetchFromOpenMeteo,

  /** 连通性自检：用北京坐标打一次轻量请求 */
  async probe(config) {
    try {
      const url = new URL(API_BASE);
      url.searchParams.set('latitude', '39.92');
      url.searchParams.set('longitude', '116.41');
      url.searchParams.set('current', 'temperature_2m');
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(config.timeout ?? 10000) });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      const json = await res.json();
      return json?.current
        ? { ok: true, message: '连接正常（无需配置）' }
        : { ok: false, message: '返回数据异常' };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
};
