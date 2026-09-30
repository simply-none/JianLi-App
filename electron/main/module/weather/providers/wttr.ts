/**
 * 天气数据源 - wttr.in（零配置兜底）
 * ------------------------------------------------------------------
 * - **完全免费、无需注册 / 无需 Key**；底层数据来自 World Weather Online
 * - 文档：https://wttr.in/:help
 *
 * 关键实现要点：
 * - JSON 模式：URL 追加 `?format=j1` 即返回结构化 JSON
 * - ⚠️ 服务器**按 User-Agent 判断输出格式**：不带 UA 会返回「纯文本」导致 JSON.parse 失败
 *   ⇒ 必须显式发送 `User-Agent`（实测 curl 默认 UA 会被拒，指定 `curl/8` 才返回 JSON）
 * - ⚠️ 位置解析精度差（中文名走 OpenCage，实测「南康」→ Nankanghsien 尚可，但常有偏差）
 *   ⇒ 统一用**坐标模式**（本地坐标表），URL 为 `/{纬度},{经度}`（lat,lon 顺序）
 * - JSON 结构（`current_condition[0]`）：temp_C / FeelsLikeC / humidity / windspeedKmph /
 *   winddir16Point / winddirDegree / visibility / pressure / cloudcover / precipMM /
 *   uvIndex / weatherCode / weatherDesc[0].value / observation_time
 * - 逐日（`weather[]`）：date / maxtempC / mintempC / astronomy[0].{sunrise,sunset,moon_phase}
 *   / hourly[]（3 小时粒度，含 tempC / weatherDesc / chanceofrain / windspeedKmph）
 * - ⚠️ 免费服务稳定性一般，故置于降级链末尾；`weatherDesc` 为英文，需本地映射为中文
 * - ⚠️ `lang=zh` 实测**不生效**（仍返回英文）⇒ 必须自建英文 → 中文映射表
 */

import { PROVIDER_CAPABILITIES } from '../capability.ts';
import { isUsableWeatherData, normalizeCondition, round } from '../normalize.ts';
import type {
  AstroInfo, ForecastDay, HourlyForecast, ProviderConfigField,
  WeatherCapability, WeatherData, WeatherProvider,
} from '../types.ts';

/* ===================== 常量 ===================== */

const API_BASE = 'https://wttr.in';

/** 零配置源：无表单字段 */
const CONFIG_SCHEMA: ProviderConfigField[] = [];

/** 请求 UA（必须显式设置，否则 wttr.in 返回纯文本而非 JSON） */
const USER_AGENT = 'JianliApp-Weather/1.0';

/**
 * wttr.in 英文天气描述 → 中文
 * 覆盖常见 weatherDesc 值（World Weather Online 词表）
 */
const DESC_CN: Record<string, string> = {
  'sunny': '晴', 'clear': '晴', 'clear ':'晴',
  'partly cloudy': '多云', 'cloudy': '多云', 'overcast': '阴',
  'mist': '薄雾', 'fog': '雾', 'freezing fog': '冻雾',
  'patchy rain nearby': '零星小雨', 'patchy rain possible': '可能有雨',
  'light rain': '小雨', 'light rain shower': '小阵雨',
  'moderate rain': '中雨', 'moderate rain at times': '间歇中雨',
  'heavy rain': '大雨', 'heavy rain at times': '间歇大雨',
  'light drizzle': '毛毛雨', 'drizzle': '毛毛雨', 'freezing drizzle': '冻毛毛雨',
  'patchy light rain': '零星小雨', 'torrential rain shower': '暴雨',
  'light snow': '小雪', 'patchy snow possible': '可能有雪', 'moderate snow': '中雪',
  'heavy snow': '大雪', 'blizzard': '暴雪', 'snow': '雪',
  'light sleet': '小雨夹雪', 'sleet': '雨夹雪', 'moderate or heavy sleet': '强雨夹雪',
  'thundery outbreaks possible': '可能有雷阵雨', 'thundery outbreaks in nearby': '附近有雷暴',
  'patchy light rain with thunder': '雷阵雨', 'moderate or heavy rain with thunder': '强雷雨',
  'patchy light snow with thunder': '雷阵雪', 'heavy snow with thunder': '强雷雪',
  'light freezing rain': '小冻雨', 'moderate or heavy freezing rain': '强冻雨',
  'ice pellets': '冰粒', 'light showers of ice pellets': '小冰粒', 'heavy showers of ice pellets': '强冰粒',
  'blowing snow': '吹雪', 'blowing sand': '扬沙', 'sandstorm': '沙尘暴',
  'dust': '浮尘', 'duststorm': '沙尘暴', 'smoky': '烟霾', 'haze': '霾',
};

/**
 * 英文描述 → 中文（先精确匹配，再关键词兜底）
 * @param desc wttr.in 返回的英文描述
 */
function descToCn(desc: string): string {
  const s = (desc || '').trim().toLowerCase();
  if (!s) return '未知';
  if (DESC_CN[s]) return DESC_CN[s];
  // 关键词兜底：确保至少命中「雷/雪/雨/雾/霾/云/晴」
  if (/thunder/.test(s)) return '雷阵雨';
  if (/snow|blizzard|sleet|ice/.test(s)) return '雪';
  if (/drizzle/.test(s)) return '毛毛雨';
  if (/rain|shower/.test(s)) return '雨';
  if (/fog|mist/.test(s)) return '雾';
  if (/haze|smok|dust|sand/.test(s)) return '霾';
  if (/overcast/.test(s)) return '阴';
  if (/cloud/.test(s)) return '多云';
  if (/clear|sunny/.test(s)) return '晴';
  return '未知';
}

/** 月相英文 → 中文 */
const MOON_PHASE_CN: Record<string, string> = {
  'new moon': '新月', 'waxing crescent': '蛾眉月', 'first quarter': '上弦月',
  'waxing gibbous': '盈凸月', 'full moon': '满月', 'waning gibbous': '亏凸月',
  'last quarter': '下弦月', 'waning crescent': '残月',
};

/**
 * wttr.in 的 12 小时制时间串 → 24 小时 HH:mm
 * ⚠️ wttr.in 返回的是 `"6:09 AM"` / `"5:59 PM"` 这类 12 小时制文本，
 *    不是 ISO 时间，无法直接截取，必须做 AM/PM 换算（否则界面会显示「6:09 AM」）。
 * @param text 形如 `06:09 AM` / `5:59 PM`
 */
function to24h(text?: string): string {
  const m = (text || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return '';
  let hour = Number(m[1]);
  const min = m[2];
  const ampm = (m[3] || '').toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${min}`;
}

/* ===================== 请求封装 ===================== */

/**
 * 发起 wttr.in 请求（坐标模式）
 * @param config 运行期配置
 * @param coords 坐标
 */
async function request(config: any, coords: { lat: number; lon: number }): Promise<any> {
  // ⚠️ 坐标顺序为 `纬度,经度`（lat,lon）
  const url = `${API_BASE}/${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}?format=j1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(config.timeout ?? 15000),
  });
  if (!res.ok) throw new Error(`wttr.in HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // 服务端有时返回纯文本错误页（如 "location not found: ..."）
    throw new Error(`wttr.in 返回非 JSON：${text.slice(0, 80)}`);
  }
}

/* ===================== 主流程 ===================== */

/**
 * 从 wttr.in 拉取并归一化
 * @param city 中文城市名
 * @param config 运行期配置（无需凭据，用坐标）
 */
async function fetchFromWttr(city: string, config: any): Promise<WeatherData> {
  const coords = config.__coords as { lat: number; lon: number } | null;
  if (!coords) throw new Error(`本地坐标表未收录「${city}」，wttr.in 无法定位`);

  const json = await request(config, coords);
  const cur = json?.current_condition?.[0];
  if (!cur) throw new Error('wttr.in 返回数据无效');

  const areaName = json?.nearest_area?.[0]?.areaName?.[0]?.value || city;
  const desc = descToCn(cur.weatherDesc?.[0]?.value || '');

  const num = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  /* ---- 逐日预报 ---- */
  const days: any[] = json?.weather || [];
  const forecast: ForecastDay[] = days.slice(0, 7).map((d, i) => {
    // 取正午（12:00）那一条的天气描述作为全天代表
    const noon = (d.hourly || []).find((h: any) => Number(h.time) === 1200) || d.hourly?.[0];
    const dayDesc = descToCn(noon?.weatherDesc?.[0]?.value || '');
    const windKmph = num(noon?.windspeedKmph);
    const date = String(d.date || '');
    return {
      date: i === 0 ? '今天' : i === 1 ? '明天' : date.slice(5) || `D${i + 1}`,
      high: round(d.maxtempC),
      low: round(d.mintempC),
      description: dayDesc,
      icon: normalizeCondition(dayDesc),
      windDirection: noon?.winddir16Point ? pointsToCn(noon.winddir16Point) : undefined,
      windPower: windKmph != null ? `${Math.max(1, Math.round(windKmph / 12))}级` : undefined,
    };
  });

  /* ---- 逐小时预报：取今天剩余的 3h 采样，最多 8 条（≈24h） ---- */
  const hourly: HourlyForecast[] = (days[0]?.hourly || []).slice(0, 8).map((h: any) => {
    const hDesc = descToCn(h.weatherDesc?.[0]?.value || '');
    return {
      time: `${String(Math.floor(Number(h.time) / 100)).padStart(2, '0')}:00`,
      temperature: round(h.tempC),
      condition: normalizeCondition(hDesc),
      precipProbability: num(h.chanceofrain),
    };
  });

  /* ---- 天文 ---- */
  const astroRaw = days[0]?.astronomy?.[0];
  const astro: AstroInfo | undefined = astroRaw
    ? {
        sunrise: to24h(astroRaw.sunrise),
        sunset: to24h(astroRaw.sunset),
        moonPhase: MOON_PHASE_CN[String(astroRaw.moon_phase || '').toLowerCase()] || undefined,
      }
    : undefined;

  const windKmph = num(cur.windspeedKmph);
  const isDay = !/night/i.test(cur.weatherDesc?.[0]?.value || '');

  /* ---- 能力清单：静态声明 ∩ 本次真拿到数据 ---- */
  const capabilities: WeatherCapability[] = PROVIDER_CAPABILITIES.wttr.filter((cap) => {
    if (cap === 'forecast.hourly') return hourly.length > 0;
    if (cap.startsWith('forecast.daily')) return forecast.length > 0;
    if (cap === 'forecast.precipitation') return hourly.some((h) => h.precipProbability != null);
    if (cap === 'forecast.dailyWind') return forecast.some((f) => f.windDirection || f.windPower);
    if (cap === 'astro.moonPhase') return !!astro?.moonPhase;
    if (cap === 'astro.sunriseSunset') return !!astro?.sunrise;
    if (cap === 'current.windGust') return false; // 实况无阵风（hourly 有 WindGustKmph，但实况块无）
    if (cap === 'current.uvIndex') return cur.uvIndex != null;
    if (cap === 'current.pressure') return cur.pressure != null;
    if (cap === 'current.cloudCover') return cur.cloudcover != null;
    if (cap === 'current.visibility') return cur.visibility != null;
    if (cap === 'current.precipitation') return cur.precipMM != null;
    return true;
  });

  const data: WeatherData = {
    /* ---- 基础字段（兜底齐全） ---- */
    temperature: round(cur.temp_C),
    feelsLike: round(cur.FeelsLikeC ?? cur.temp_C),
    description: desc,
    humidity: round(cur.humidity),
    windDirection: pointsToCn(cur.winddir16Point) || '未知',
    windSpeed: windKmph != null ? `${Math.max(1, Math.round(windKmph / 12))}级` : '未知',
    visibility: cur.visibility != null ? round(cur.visibility) : 10,
    updateTime: Date.now(),
    forecast,
    city: areaName,
    condition: normalizeCondition(desc),

    /* ---- 扩展字段 ---- */
    source: 'wttr.in',
    capabilities,
    pressure: num(cur.pressure) != null ? round(cur.pressure) : undefined,
    cloudCover: num(cur.cloudcover) != null ? round(cur.cloudcover) : undefined,
    precipitation: num(cur.precipMM),
    uvIndex: num(cur.uvIndex),
    isDay,
    hourly: hourly.length ? hourly : undefined,
    astro: astro?.sunrise ? astro : undefined,
    // 无生活指数 / AQI / 预警 ⇒ 能力清单不声明
  };

  if (!isUsableWeatherData(data)) throw new Error('wttr.in 返回数据不可用');
  return data;
}

/** 16 方位英文缩写 → 中文风向 */
function pointsToCn(point?: string): string {
  const map: Record<string, string> = {
    N: '北风', NNE: '北东北风', NE: '东北风', ENE: '东东北风',
    E: '东风', ESE: '东东南风', SE: '东南风', SSE: '南东南风',
    S: '南风', SSW: '南西南风', SW: '西南风', WSW: '西西南风',
    W: '西风', WNW: '西西北风', NW: '西北风', NNW: '北西北风',
  };
  return map[(point || '').toUpperCase()] || '';
}

/** wttr.in Provider（零配置） */
export const wttrProvider: WeatherProvider = {
  id: 'wttr',
  label: 'wttr.in',
  zeroConfig: true,
  capabilities: PROVIDER_CAPABILITIES.wttr,
  configSchema: CONFIG_SCHEMA,
  fetch: fetchFromWttr,

  /** 连通性自检：用北京坐标打一次轻量请求 */
  async probe(config) {
    try {
      const json = await request(config, { lat: 39.92, lon: 116.41 });
      const cur = json?.current_condition?.[0];
      return cur
        ? { ok: true, message: `连接正常，北京实况 ${descToCn(cur.weatherDesc?.[0]?.value)} ${round(cur.temp_C)}°C` }
        : { ok: false, message: '返回数据异常' };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
};
