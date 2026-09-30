/**
 * 天气数据源 - 彩云天气 Caiyun
 * ------------------------------------------------------------------
 * - 免费版 500 次/日（以官网为准）；**分钟级降水最准**
 * - 文档：https://docs.caiyunapp.com/weather-api/v2/v2.6/
 *
 * 关键实现要点：
 * - 鉴权：Token 直接内嵌在 URL 路径 `/v2.6/{token}/{经度},{纬度}/...`
 * - ⚠️ 路径中**经度在前、纬度在后**（`lng,lat`），与常见 lat,lon 相反
 * - 单接口多块：realtime.json 返回 `result.realtime`，minutely.json 返回 `result.minutely`
 *   · 分钟级降水需独立接口，失败不影响主流程
 * - 天气现象 `skycon` 是**英文枚举**（CLEAR_DAY / PARTLY_CLOUDY_NIGHT / LIGHT_RAIN …），需本地映射
 * - ⚠️ `humidity` / `cloudrate` 为 **0–1 小数**，需 ×100
 * - ⚠️ `pressure` 单位 **Pa**（约 100000），需 ÷100 转 hPa
 * - `visibility` 单位 km；`wind.speed` 单位 km/h；`wind.direction` 为角度
 * - 错误：`status: 'failed'` + `error` 字段（如 `token is invalid`）
 */

import { PROVIDER_CAPABILITIES } from '../capability.ts';
import { degreeToCn, isUsableWeatherData, normalizeCondition, round } from '../normalize.ts';
import type {
  AirQuality, AstroInfo, ForecastDay, HourlyForecast, MinutelyRain, ProviderConfigField,
  WeatherCapability, WeatherData, WeatherIndex, WeatherProvider,
} from '../types.ts';

/* ===================== 常量 ===================== */

const API_BASE = 'https://api.caiyunapp.com/v2.6';

/** 彩云配置表单定义 */
const CONFIG_SCHEMA: ProviderConfigField[] = [
  {
    key: 'token', label: 'API Token', type: 'password', required: true, secret: true,
    placeholder: '在控制台「开发者 → API Token」获取',
    help: '免费版 500 次/日；分钟级降水精度高，适合补充分钟级降水展示',
  },
];

/**
 * 彩云 skycon 英文枚举 → 中文描述
 * 参考 https://docs.caiyunapp.com/weather-api/v2/v2.6/tables/skycon.html
 */
const SKYCON_CN: Record<string, string> = {
  CLEAR_DAY: '晴', CLEAR_NIGHT: '晴',
  PARTLY_CLOUDY_DAY: '多云', PARTLY_CLOUDY_NIGHT: '多云',
  CLOUDY: '阴',
  LIGHT_HAZE: '轻度雾霾', MODERATE_HAZE: '中度雾霾', HEAVY_HAZE: '重度雾霾',
  LIGHT_RAIN: '小雨', MODERATE_RAIN: '中雨', HEAVY_RAIN: '大雨', STORM_RAIN: '暴雨',
  FOG: '雾', LIGHT_SNOW: '小雪', MODERATE_SNOW: '中雪', HEAVY_SNOW: '大雪', STORM_SNOW: '暴雪',
  DUST: '浮尘', SAND: '沙尘', WIND: '大风',
};

/** 彩云生活指数键 → 中文展示名 */
const LIFE_INDEX_LABEL: Record<string, string> = {
  ultraviolet: '紫外线', comfort: '舒适度', carWashing: '洗车',
  dressing: '穿衣', coldRisk: '感冒',
};

/* ===================== 请求封装 ===================== */

/** 判断天空现象是否为夜间（用于 isDay） */
function isNightSkycon(skycon: string): boolean {
  return /_NIGHT$/.test(skycon);
}

/**
 * 发起彩云请求
 * @param config 运行期配置（含 token）
 * @param coords 坐标（本地表解析）
 * @param path realtime / minutely / daily / hourly
 * @param query 额外查询参数
 */
async function request(config: any, coords: { lat: number; lon: number }, path: string, query?: Record<string, string>): Promise<any> {
  const token = config.credentials?.token;
  if (!token) throw new Error('未配置彩云 Token');

  // ⚠️ 彩云路径为 `经度,纬度` 顺序
  const url = new URL(`${API_BASE}/${encodeURIComponent(token)}/${coords.lon},${coords.lat}/${path}`);
  url.searchParams.set('lang', 'zh_CN');
  url.searchParams.set('unit', 'metric');
  Object.entries(query || {}).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(config.timeout ?? 15000) });
  const json = await res.json().catch(() => null);

  // 彩云失败：`status: 'failed'` + `error` 文案（HTTP 可能为 400/403）
  if (json?.status === 'failed') throw new Error(`彩云错误：${json.error || '未知'}`);
  if (!res.ok) throw new Error(`彩云 HTTP ${res.status}`);
  return json;
}

/* ===================== 主流程 ===================== */

/**
 * 从彩云天气拉取并归一化
 * @param city 中文城市名
 * @param config 运行期配置
 */
async function fetchFromCaiyun(city: string, config: any): Promise<WeatherData> {
  const coords = config.__coords as { lat: number; lon: number } | null;
  if (!coords) throw new Error(`本地坐标表未收录「${city}」，彩云无法定位`);

  // 并发取：实况 / 分钟级降水 / 逐日 / 逐小时（任一失败不拖垮整体）
  const settled = await Promise.allSettled([
    request(config, coords, 'realtime.json'),
    request(config, coords, 'minutely.json'),
    request(config, coords, 'daily.json', { dailysteps: '7' }),
    request(config, coords, 'hourly.json', { hourlysteps: '24' }),
  ]);
  const pick = (i: number): any =>
    settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<any>).value : null;

  const rtRes = pick(0);
  const rt = rtRes?.result?.realtime;
  // 实况是唯一必需项：失败时抛出真实原因（Token 无效 / 网络 / 超时）
  if (!rt) {
    const reason = settled[0].status === 'rejected' ? (settled[0] as PromiseRejectedResult).reason : null;
    throw new Error(`彩云实况获取失败：${(reason as Error)?.message || '无响应'}`);
  }

  /* ---- 逐日预报 ---- */
  const daily = pick(2)?.result?.daily || {};
  const dTemp: any[] = daily.temperature || [];
  const dSky: any[] = daily.skycon || [];
  const dWind: any[] = daily.wind || [];
  const dPrecip: any[] = daily.precipitation || [];
  const dAstro: any[] = daily.astro || [];

  const forecast: ForecastDay[] = dTemp.slice(0, 7).map((t, i) => {
    const skycon = dSky[i]?.value || '';
    const desc = SKYCON_CN[skycon] || '未知';
    const wind = dWind[i]?.avg;
    const date = String(t.date || '').slice(0, 10);
    return {
      date: i === 0 ? '今天' : i === 1 ? '明天' : date.slice(5) || `D${i + 1}`,
      high: round(t.max),
      low: round(t.min),
      description: desc,
      icon: normalizeCondition(desc),
      windDirection: wind?.direction != null ? degreeToCn(round(wind.direction)) || undefined : undefined,
      windPower: wind?.speed != null ? `${Math.max(1, Math.round(wind.speed / 12))}级` : undefined,
      // 降水概率挂在 description 之外，由 capabilities 决定是否展示（此处不强塞）
    };
  });

  /* ---- 逐小时预报 ---- */
  const hourlyRaw = pick(3)?.result?.hourly || {};
  const hTemp: any[] = hourlyRaw.temperature || [];
  const hSky: any[] = hourlyRaw.skycon || [];
  const hPrecip: any[] = hourlyRaw.precipitation || [];
  const hourly: HourlyForecast[] = hTemp.slice(0, 24).map((t, i) => {
    const desc = SKYCON_CN[hSky[i]?.value || ''] || '未知';
    const dt = String(t.datetime || '');
    return {
      time: dt.slice(11, 16),
      temperature: round(t.value),
      condition: normalizeCondition(desc),
      precipProbability: hPrecip[i]?.probability != null ? round(hPrecip[i].probability) : undefined,
    };
  });

  /* ---- 分钟级降水 ---- */
  const minutelyRaw = pick(1)?.result?.minutely;
  const minutely: MinutelyRain | undefined = minutelyRaw
    ? {
        summary: minutelyRaw.description || '',
        // precipitation_2h 已是「逐 5 分钟、2 小时（24 点）」的数组
        values: (minutelyRaw.precipitation_2h || []).map((v: any) => Number(v) || 0),
      }
    : undefined;

  /* ---- 空气质量 ---- */
  const aq = rt.air_quality;
  const airQuality: AirQuality | undefined = aq
    ? {
        aqi: round(aq.aqi?.chn ?? aq.aqi),
        category: '', // 彩云不给等级文案，渲染端按 AQI 数值色阶自适应
        pm25: aq.pm25 != null ? round(aq.pm25) : undefined,
      }
    : undefined;

  /* ---- 生活指数（realtime.life_index 只有紫外线 / 舒适度） ---- */
  const li = rt.life_index || {};
  const indices: WeatherIndex[] = Object.entries(li)
    .filter(([k]) => LIFE_INDEX_LABEL[k])
    .map(([k, v]: [string, any]) => ({
      name: LIFE_INDEX_LABEL[k],
      level: String(v?.desc || ''),
      tip: String(v?.desc || ''),
    }))
    .filter((it) => it.level);

  /* ---- 天文 ---- */
  const astro: AstroInfo | undefined = dAstro[0]
    ? { sunrise: dAstro[0].sunrise?.time || '', sunset: dAstro[0].sunset?.time || '' }
    : undefined;

  const skycon = rt.skycon || '';
  const desc = SKYCON_CN[skycon] || '未知';
  const precipLocal = rt.precipitation?.local;

  /* ---- 能力清单：静态声明 ∩ 本次真拿到数据 ---- */
  const capabilities: WeatherCapability[] = PROVIDER_CAPABILITIES.caiyun.filter((cap) => {
    if (cap.startsWith('indices.')) return indices.length > 0;
    if (cap.startsWith('air.')) return !!airQuality;
    if (cap === 'minutely.precipitation') return !!minutely;
    if (cap === 'forecast.hourly') return hourly.length > 0;
    if (cap.startsWith('forecast.daily')) return forecast.length > 0;
    if (cap === 'forecast.precipitation') return dPrecip.length > 0;
    if (cap === 'forecast.uvIndexMax') return false; // 彩云逐日不含紫外线最大值
    if (cap === 'astro.sunriseSunset') return !!astro?.sunrise;
    if (cap === 'current.windGust') return false; // 彩云实况无阵风
    if (cap === 'current.cloudCover') return rt.cloudrate != null;
    if (cap === 'current.visibility') return rt.visibility != null;
    if (cap === 'current.pressure') return rt.pressure != null;
    if (cap === 'current.uvIndex') return li.ultraviolet?.index != null;
    return true;
  });

  const data: WeatherData = {
    /* ---- 基础字段（兜底齐全） ---- */
    temperature: round(rt.temperature),
    feelsLike: round(rt.apparent_temperature ?? rt.temperature),
    description: desc,
    humidity: round((rt.humidity ?? 0) * 100), // 0–1 小数 → 百分数
    windDirection: degreeToCn(round(rt.wind?.direction)) || '未知',
    windSpeed: rt.wind?.speed != null ? `${Math.max(1, Math.round(rt.wind.speed / 12))}级` : '未知',
    visibility: rt.visibility != null ? round(rt.visibility) : 10,
    updateTime: Date.now(),
    forecast,
    city,
    condition: normalizeCondition(desc),

    /* ---- 扩展字段 ---- */
    source: '彩云天气',
    capabilities,
    pressure: rt.pressure != null ? round(rt.pressure / 100) : undefined, // Pa → hPa
    cloudCover: rt.cloudrate != null ? round(rt.cloudrate * 100) : undefined,
    precipitation: precipLocal?.intensity != null ? Number(precipLocal.intensity) : undefined,
    precipitationText: precipLocal?.status && precipLocal.status !== 'NONE' ? desc : undefined,
    uvIndex: li.ultraviolet?.index != null ? Number(li.ultraviolet.index) : undefined,
    isDay: skycon ? !isNightSkycon(skycon) : undefined,
    airQuality,
    hourly: hourly.length ? hourly : undefined,
    minutely,
    astro: astro?.sunrise ? astro : undefined,
    indices: indices.length ? indices : undefined,
  };

  if (!isUsableWeatherData(data)) throw new Error('彩云返回数据不可用');
  return data;
}

/** 彩云天气 Provider */
export const caiyunProvider: WeatherProvider = {
  id: 'caiyun',
  label: '彩云天气',
  zeroConfig: false,
  capabilities: PROVIDER_CAPABILITIES.caiyun,
  configSchema: CONFIG_SCHEMA,
  fetch: fetchFromCaiyun,

  /** 连通性自检：用北京坐标查一次实况 */
  async probe(config) {
    if (!config.credentials?.token) return { ok: false, message: '请先填写 API Token' };
    try {
      const json = await request(config, { lat: 39.92, lon: 116.41 }, 'realtime.json');
      const rt = json?.result?.realtime;
      return rt
        ? { ok: true, message: `连接正常，北京实况 ${SKYCON_CN[rt.skycon] || rt.skycon} ${round(rt.temperature)}°C` }
        : { ok: false, message: '接口返回但无数据' };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
};
