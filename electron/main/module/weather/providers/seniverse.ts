/**
 * 天气数据源 - 心知天气 Seniverse
 * ------------------------------------------------------------------
 * - 免费版 500~1000 次/日（口径以官网为准）；中文城市名与生活指数较好
 * - 文档：https://docs.seniverse.com/
 *
 * 关键实现要点：
 * - 鉴权：Query 参数 `key`（API 密钥），无需签名
 * - location 支持「城市中文名 / 拼音 / 坐标（lat:lon）」⇒ 天然支持中文城市名（location.geo）
 * - ⚠️ 免费版限制（已在能力清单中按实际返回二次裁剪）：
 *   · 实况接口只返回「天气现象文字 / 代码 / 气温」3 项 ⇒ 湿度 / 风向 / 体感等取不到
 *   · 逐日接口只返回 3 天；`precip` 降水概率仅国外城市有效
 *   · 生活指数只返回 6 项基本类且仅 brief（无 details）
 * - ⚠️ 中国城市不支持 `clouds`（云量）与 `dew_point`（露点）
 * - `Promise.allSettled`：指数 / AQI 失败不拖垮整个源
 *
 * 单位约定：请求固定 `unit=c`（摄氏度 / km / km/h / mb），响应中的数值均为字符串，需 Number()。
 */

import { PROVIDER_CAPABILITIES } from '../capability.ts';
import { degreeToCn, isUsableWeatherData, normalizeCondition, round } from '../normalize.ts';
import type {
  AirQuality, ForecastDay, ProviderConfigField, WeatherCapability, WeatherData,
  WeatherIndex, WeatherProvider,
} from '../types.ts';

/* ===================== 常量 ===================== */

const API_BASE = 'https://api.seniverse.com/v3';

/** 心知配置表单定义 */
const CONFIG_SCHEMA: ProviderConfigField[] = [
  {
    key: 'apiKey', label: 'API 密钥', type: 'password', required: true, secret: true,
    placeholder: '在控制台「我的账号 → API 密钥」获取',
    help: '支持中文城市名查询；免费版每日 500~1000 次（以官网为准）',
  },
  {
    key: 'locationMode', label: '城市定位方式', type: 'select', default: 'coords',
    options: [
      { label: '本地坐标表（精确，推荐）', value: 'coords' },
      { label: '心知城市名（支持中文 / 拼音，偶有偏差）', value: 'name' },
    ],
    help: '本地坐标表可精确定位到区县级（含重名消歧）；心知自带的城市名解析对县级支持较弱',
  },
];

/** 生活指数键 → 中文展示名（心知 27 项，此处列基本 6 项 + 常用项） */
const SUGGESTION_LABEL: Record<string, string> = {
  dressing: '穿衣', uv: '紫外线', car_washing: '洗车', travel: '旅游',
  flu: '感冒', sport: '运动', comfort: '舒适度', allergy: '过敏',
  air_pollution: '空气污染扩散', airing: '晾晒', umbrella: '雨伞',
  ac: '空调开启', traffic: '交通', road_condition: '路况', sunscreen: '防晒',
  chill: '风寒', makeup: '化妆', mood: '心情', fishing: '钓鱼',
  morning_sport: '晨练', night_life: '夜生活', shopping: '逛街', dating: '约会',
  beer: '啤酒', boating: '划船', hair_dressing: '美发', kiteflying: '放风筝',
};

/** 空气质量等级（心知 quality 字段已是中文，此处按 AQI 数值兜底映射） */
function aqiCategory(aqi: number): string {
  if (aqi <= 50) return '优';
  if (aqi <= 100) return '良';
  if (aqi <= 150) return '轻度污染';
  if (aqi <= 200) return '中度污染';
  if (aqi <= 300) return '重度污染';
  return '严重污染';
}

/* ===================== 请求封装 ===================== */

/**
 * 发起心知请求
 * @param path 接口路径（如 `/weather/now.json`）
 * @param config 运行期配置
 * @param query 额外查询参数
 */
async function request(path: string, config: any, query: Record<string, string>): Promise<any> {
  const key = config.credentials?.apiKey;
  if (!key) throw new Error('未配置心知 API 密钥');

  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set('key', key);
  url.searchParams.set('language', 'zh-Hans');
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(config.timeout ?? 15000) });
  const json = await res.json().catch(() => null);

  // 心知失败时返回 { status: '错误描述', status_code: 'APxxxxxx' }（HTTP 可能为 403/400）
  if (json?.status_code && !json?.results) {
    throw new Error(`心知错误 ${json.status_code}（${json.status || '未知'}）`);
  }
  if (!res.ok) throw new Error(`心知 HTTP ${res.status}`);
  return json;
}

/** 数值解析（心知返回字符串，可能为空串） */
function num(v: unknown): number | undefined {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/* ===================== 定位参数 ===================== */

/**
 * 解析心知接口所需的 location 参数
 * - coords 模式：用本地坐标表（支持 adcode 精确消歧）得到 `lat:lon`
 * - name 模式：直接传中文城市名（心知自解析）
 * @param city 城市名
 * @param config 运行期配置
 * @param coords 已解析的本地坐标（由 fetchFromSeniverse 传入，避免重复查询）
 */
function resolveLocation(
  city: string,
  config: any,
  coords: { lat: number; lon: number } | null
): string {
  const mode = config.options?.locationMode || 'coords';
  if (mode === 'name') return city;
  // ⚠️ 心知坐标格式为 `纬度:经度`（lat:lon），与常见 lon,lat 相反
  if (coords) return `${coords.lat}:${coords.lon}`;
  return city; // 本地表未收录时回落城市名，让心知自行解析
}

/* ===================== 主流程 ===================== */

/**
 * 从心知天气拉取并归一化
 * @param city 中文城市名
 * @param config 运行期配置（含密钥；cityRef 可选）
 * @param coords 已解析的本地坐标（由调用方 lookupCityCoords 得到，可空）
 */
async function fetchFromSeniverse(city: string, config: any): Promise<WeatherData> {
  const coords = config.__coords as { lat: number; lon: number } | null;
  const location = resolveLocation(city, config, coords);

  // 并发取：实况 / 逐日（3 天）/ 生活指数 / 空气质量（任一失败不拖垮整体）
  const settled = await Promise.allSettled([
    request('/weather/now.json', config, { location, unit: 'c' }),
    request('/weather/daily.json', config, { location, unit: 'c', start: '0', days: '3' }),
    request('/life/suggestion.json', config, { location }),
    request('/air/now.json', config, { location }),
  ]);
  const pick = (i: number): any =>
    settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<any>).value : null;

  const nowRes = pick(0);
  // 实况是唯一必需项：失败时**抛出其真实原因**（而非笼统文案），便于配置页定位是 Key 还是网络问题
  if (!nowRes) {
    const reason = settled[0].status === 'rejected' ? (settled[0] as PromiseRejectedResult).reason : null;
    throw new Error(`心知实况获取失败：${(reason as Error)?.message || '无响应'}`);
  }

  const r0 = nowRes?.results?.[0];
  const now = r0?.now || {};
  const locName = r0?.location?.name || city;

  /* ---- 逐日预报 ---- */
  const dailyArr: any[] = pick(1)?.results?.[0]?.daily || [];
  const forecast: ForecastDay[] = dailyArr.map((d, i) => {
    const desc = d.text_day || d.text_night || '未知';
    const windScale = num(d.wind_scale);
    const windDeg = num(d.wind_direction_degree);
    const date = String(d.date || '');
    return {
      date: i === 0 ? '今天' : i === 1 ? '明天' : date.slice(5) || `D${i + 1}`,
      high: round(d.high),
      low: round(d.low),
      description: desc,
      icon: normalizeCondition(desc),
      windDirection: d.wind_direction || degreeToCn(windDeg) || undefined,
      windPower: windScale != null ? `${windScale}级` : undefined,
    };
  });

  /* ---- 生活指数（仅取有 brief 的项；免费版无 details 时用 brief 兜底） ---- */
  const suggestion = pick(2)?.results?.[0]?.suggestion || {};
  const indices: WeatherIndex[] = Object.entries(suggestion)
    .filter(([k]) => SUGGESTION_LABEL[k])
    .map(([k, v]: [string, any]) => ({
      name: SUGGESTION_LABEL[k],
      level: String(v?.brief || ''),
      tip: String(v?.details || v?.brief || ''),
    }))
    .filter((it) => it.level || it.tip);

  /* ---- 空气质量 ---- */
  const airArr = pick(3)?.results;
  const airRaw = Array.isArray(airArr) ? airArr[0]?.air : null;
  const airQuality: AirQuality | undefined = airRaw
    ? {
        aqi: round(airRaw.aqi),
        category: airRaw.quality || aqiCategory(round(airRaw.aqi)),
        primary: airRaw.primary_pollutant || undefined,
        pm25: airRaw.pm25 != null ? round(airRaw.pm25) : undefined,
      }
    : undefined;

  /* ---- 基础字段：免费版实况只有温度 / 现象，其余用合理兜底 ---- */
  const desc = now.text || '未知';
  const humidity = num(now.humidity);
  const visibility = num(now.visibility);
  const windScale = num(now.wind_scale);

  /* ---- 能力清单：静态声明 ∩ 本次真拿到数据 ---- */
  const capabilities: WeatherCapability[] = PROVIDER_CAPABILITIES.seniverse.filter((cap) => {
    if (cap === 'indices.life') return indices.length > 0;
    if (cap === 'air.quality') return !!airQuality;
    if (cap.startsWith('forecast.daily')) return forecast.length > 0;
    if (cap === 'forecast.precipitation') return dailyArr.some((d) => num(d.precip) != null);
    // 免费版实况缺这些字段：只有值存在才声明（付费版自动全亮）
    if (cap === 'current.feelsLike') return num(now.feels_like) != null;
    if (cap === 'current.humidity') return humidity != null;
    if (cap === 'current.windDirection') return !!now.wind_direction || num(now.wind_direction_degree) != null;
    if (cap === 'current.windSpeed') return num(now.wind_speed) != null;
    if (cap === 'current.windScale') return windScale != null;
    if (cap === 'current.pressure') return num(now.pressure) != null;
    if (cap === 'current.visibility') return visibility != null;
    if (cap === 'current.dewPoint') return num(now.dew_point) != null;
    if (cap === 'current.cloudCover') return num(now.clouds) != null;
    if (cap === 'current.isDay') return false; // 心知实况不返回昼夜标志（界面按钟点推断）
    return true;
  });

  const data: WeatherData = {
    /* ---- 基础字段（兜底齐全） ---- */
    temperature: round(now.temperature),
    feelsLike: round(num(now.feels_like) ?? num(now.temperature)),
    description: desc,
    humidity: humidity != null ? round(humidity) : 0,
    windDirection: now.wind_direction || degreeToCn(num(now.wind_direction_degree)) || '未知',
    windSpeed: windScale != null ? `${windScale}级` : '未知',
    visibility: visibility != null ? round(visibility) : 10,
    updateTime: Date.now(),
    forecast,
    city: locName,
    condition: normalizeCondition(desc),

    /* ---- 扩展字段 ---- */
    source: '心知天气',
    capabilities,
    pressure: num(now.pressure) != null ? round(now.pressure) : undefined,
    dewPoint: num(now.dew_point) != null ? round(now.dew_point) : undefined,
    cloudCover: num(now.clouds) != null ? round(now.clouds) : undefined,
    windScale: windScale,
    uvIndex: undefined, // 实况无紫外线；指数块内的紫外线另见 indices
    airQuality,
    indices: indices.length ? indices : undefined,
  };

  if (!isUsableWeatherData(data)) throw new Error('心知返回数据不可用');
  return data;
}

/** 心知天气 Provider */
export const seniverseProvider: WeatherProvider = {
  id: 'seniverse',
  label: '心知天气',
  zeroConfig: false,
  capabilities: PROVIDER_CAPABILITIES.seniverse,
  configSchema: CONFIG_SCHEMA,
  fetch: fetchFromSeniverse,

  /** 连通性自检：查一次北京实况 */
  async probe(config) {
    if (!config.credentials?.apiKey) return { ok: false, message: '请先填写 API 密钥' };
    try {
      const json = await request('/weather/now.json', config, { location: '北京', unit: 'c' });
      const hit = json?.results?.[0];
      return hit
        ? { ok: true, message: `连接正常，定位到「${hit.location?.name}」，实况 ${hit.now?.text} ${hit.now?.temperature}°C` }
        : { ok: false, message: '接口返回但无数据' };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
};
