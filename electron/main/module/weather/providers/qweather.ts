/**
 * 天气数据源 - 和风天气 QWeather
 * ------------------------------------------------------------------
 * - 免费订阅 5 万次/月（0–50000 次 CNY 0）
 * - ⚠️ 公共域名（api/devapi/geoapi.qweather.com）自 2026 年起逐步停服
 *   ⇒ 必须使用控制台分配的**专属 API Host**（形如 h2a9cf3mhs.xy.qweatherapi.com）
 * - ⚠️ API KEY 自 2027-01-01 起限制每日请求量 ⇒ 默认推荐 JWT(EdDSA/Ed25519)
 * - 文档：https://dev.qweather.com/docs/
 *
 * 关键实现要点：
 * - JWT 用 Node 原生 crypto 签发（零依赖）；失败可回退 jose（见 createJwt 注释）
 * - v1 接口的 humidity / cloudCover / precipitation.probability 均为 0–1 小数，需 ×100
 * - visibility 单位为米
 * - Promise.allSettled：指数 / 空气质量 / 预警任一失败不拖垮整个源
 */

import crypto from 'node:crypto';
import { PROVIDER_CAPABILITIES } from '../capability.ts';
import {
  compassToCn, degreeToCn, isoToHm, isUsableWeatherData, normalizeCondition,
  round, validateQWeatherHost, windScaleToText,
} from '../normalize.ts';
import type {
  AirQuality, AstroInfo, ForecastDay, HourlyForecast, MinutelyRain,
  ProviderConfigField, WeatherCapability, WeatherData, WeatherProvider, WeatherWarning,
} from '../types.ts';

/* ===================== 常量 ===================== */

/** 和风配置表单定义 */
const CONFIG_SCHEMA: ProviderConfigField[] = [
  {
    key: 'apiHost', label: 'API Host', type: 'text', required: true,
    placeholder: 'h2a9cf3mhs.xy.qweatherapi.com',
    help: '控制台 → 设置 中查看专属 Host。公共域名 2026 年起逐步停服，必须使用专属 Host',
  },
  {
    key: 'authMode', label: '认证方式', type: 'select', default: 'jwt',
    options: [
      { label: 'JWT（推荐，不受 2027 每日限流影响）', value: 'jwt' },
      { label: 'API KEY（简单，2027-01-01 起限制每日请求量）', value: 'apikey' },
    ],
  },
  {
    key: 'kid', label: '凭据 ID (kid)', type: 'text', required: true,
    when: { authMode: 'jwt' }, help: '控制台 → 项目管理 → 凭据',
  },
  {
    key: 'projectId', label: '项目 ID (sub)', type: 'text', required: true,
    when: { authMode: 'jwt' }, help: '控制台 → 项目管理',
  },
  {
    key: 'developerId', label: '开发者 ID (iss)', type: 'text', required: true,
    when: { authMode: 'jwt' }, placeholder: 'Q1234567890',
    help: '控制台 → 设置，Q 开头的 10 位字符',
  },
  {
    key: 'privateKey', label: 'Ed25519 私钥 (PEM)', type: 'textarea', required: true,
    secret: true, when: { authMode: 'jwt' },
    help: '生成：openssl genpkey -algorithm ED25519 -out ed25519-private.pem；公钥需上传到控制台',
  },
  {
    key: 'apiKey', label: 'API KEY', type: 'password', required: true,
    secret: true, when: { authMode: 'apikey' },
  },
];

/** 和风错误码提示（常见项） */
const CODE_HINT: Record<string, string> = {
  '204': '该地区暂无数据',
  '400': '请求参数错误',
  '401': '认证失败（凭据 / API Host 不正确）',
  '402': '超过每日访问次数或余额不足',
  '403': '无访问权限（请检查订阅与 Host）',
  '404': '查询的城市或数据不存在',
  '429': '请求过于频繁，请稍后再试',
  '500': '和风服务器错误',
};

/** 月相英文 → 中文 */
const MOON_PHASE_CN: Record<string, string> = {
  'new-moon': '新月', 'waxing-crescent': '蛾眉月', 'first-quarter': '上弦月',
  'waxing-gibbous': '盈凸月', 'full-moon': '满月', 'waning-gibbous': '亏凸月',
  'last-quarter': '下弦月', 'waning-crescent': '残月',
};

/** 生活指数类型 → 展示名（和风 type 编号） */
const INDEX_TYPE_NAME: Record<string, string> = {
  '1': '运动', '2': '洗车', '3': '穿衣', '4': '钓鱼', '5': '紫外线',
  '6': '旅游', '7': '过敏', '8': '舒适度', '9': '感冒', '10': '空气污染扩散',
  '11': '空调开启', '12': '太阳镜', '13': '化妆', '14': '晾晒', '15': '交通', '16': '防晒',
};

/* ===================== JWT ===================== */

/** JWT 内存缓存（剩余 > 5 分钟时复用，避免每请求都签名） */
let jwtCache: { token: string; exp: number; fingerprint: string } | null = null;

/**
 * 生成和风天气 JWT（EdDSA / Ed25519，Node 原生零依赖）
 *
 * - Header:  { alg: 'EdDSA', kid }
 * - Payload: { iss: 开发者ID, sub: 项目ID, iat: now-30, exp: iat+900 }
 *   （官方建议 iat 提前 30s 防时钟误差；有效期上限 24h）
 * - 必须 Base64URL 编码（非 Base64）
 *
 * 若本机 Node 的 Ed25519 不可用，回退方案：`npm i jose`
 *   import { SignJWT, importPKCS8 } from 'jose'
 *   const key = await importPKCS8(pem, 'EdDSA')
 *   await new SignJWT(payload).setProtectedHeader({ alg: 'EdDSA', kid }).sign(key)
 *
 * @see https://dev.qweather.com/docs/configuration/authentication/
 */
function signJwt(kid: string, projectId: string, developerId: string, privateKey: string): string {
  const b64url = (input: string | Buffer): string =>
    Buffer.from(input as any).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'EdDSA', kid }));
  const payload = b64url(JSON.stringify({
    iss: developerId,
    sub: projectId,
    iat: now - 30,
    exp: now + 900,
  }));
  const data = `${header}.${payload}`;

  const key = crypto.createPrivateKey({ key: privateKey, format: 'pem' });
  // EdDSA 的签名算法参数传 null
  const signature = crypto.sign(null, Buffer.from(data, 'utf8'), key);
  return `${data}.${b64url(signature)}`;
}

/**
 * 取 JWT（带缓存，凭据变更自动失效）
 * @param creds 凭据集合
 */
function getJwt(creds: Record<string, string>): string {
  const fingerprint = `${creds.kid}|${creds.projectId}|${creds.developerId}|${(creds.privateKey || '').length}`;
  const now = Math.floor(Date.now() / 1000);
  if (jwtCache && jwtCache.fingerprint === fingerprint && jwtCache.exp > now + 300) {
    return jwtCache.token;
  }
  const token = signJwt(creds.kid, creds.projectId, creds.developerId, creds.privateKey);
  jwtCache = { token, exp: now + 900, fingerprint };
  return token;
}

/* ===================== 请求封装 ===================== */

/** 归一化 API Host（去协议头与尾斜杠） */
function normalizeHost(host: string): string {
  return (host || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

/**
 * 发起和风请求
 * @param path 接口路径（如 `/weather/v1/current/39.92/116.41`）
 * @param config 运行期配置（凭据已解密）
 * @param query 查询参数
 */
async function request(path: string, config: any, query?: Record<string, string>): Promise<any> {
  const creds = config.credentials || {};
  const host = normalizeHost(creds.apiHost);

  const hostCheck = validateQWeatherHost(host);
  if (!hostCheck.ok) throw new Error(hostCheck.message);

  const url = new URL(`https://${host}${path}`);
  Object.entries(query || {}).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers: Record<string, string> = creds.authMode === 'apikey'
    ? { 'X-QW-Api-Key': creds.apiKey || '' }
    : { Authorization: `Bearer ${getJwt(creds)}` };

  const res = await fetch(url.toString(), {
    headers,
    signal: AbortSignal.timeout(config.timeout ?? 15000),
  });
  if (!res.ok) throw new Error(`和风 HTTP ${res.status}`);

  const json = await res.json();
  if (json?.code && json.code !== '200') {
    throw new Error(`和风错误 ${json.code}（${CODE_HINT[json.code] || '未知'}）`);
  }
  return json;
}

/* ===================== 字段映射 ===================== */

/** 和风 v1 逐日 → ForecastDay[] */
function mapDaily(days: any[]): ForecastDay[] {
  return (days || []).map((d, i) => {
    const day = d.daytime || {};
    const desc = day.condition?.text || d.nighttime?.condition?.text || '未知';
    // 风向：优先取 compass（方位码）转中文，兜底用角度换算
    const windDir = compassToCn(day.wind?.direction?.compass)
      || degreeToCn(day.wind?.direction?.degree);
    const firstDate = (d.forecastStartTime || '').slice(0, 10);
    return {
      date: i === 0 ? '今天' : i === 1 ? '明天' : firstDate.slice(5) || `D${i + 1}`,
      high: round(d.temperatureMax?.value),
      low: round(d.temperatureMin?.value),
      description: desc,
      icon: normalizeCondition(desc),
      windDirection: windDir || undefined,
      windPower: day.wind?.scale != null ? windScaleToText(day.wind.scale) : undefined,
    };
  });
}

/** 和风 v1 逐时 → HourlyForecast[] */
function mapHourly(hours: any[]): HourlyForecast[] {
  return (hours || []).slice(0, 24).map((h) => ({
    time: isoToHm(h.fxTime) || '',
    temperature: round(h.temperature?.value),
    condition: normalizeCondition(h.condition?.text || ''),
    precipProbability: h.precipitation?.probability != null
      ? round(h.precipitation.probability * 100)
      : undefined,
  }));
}

/* ===================== 主流程 ===================== */

/**
 * 从和风天气拉取并归一化
 * @param city 中文城市名（GeoAPI 支持县级）
 * @param config 运行期配置
 */
async function fetchFromQWeather(city: string, config: any): Promise<WeatherData> {
  const creds = config.credentials || {};
  if (!creds.apiHost) throw new Error('未配置 API Host');
  if (creds.authMode === 'apikey' ? !creds.apiKey : !creds.privateKey) {
    throw new Error('和风凭据未填齐');
  }

  // 1. 城市名 → 经纬度 + LocationID（GeoAPI 支持中文城市名与县级）
  const geo = await request('/geo/v2/city/lookup', config, {
    location: city, range: 'cn', number: '1', lang: 'zh',
  });
  const loc = geo?.location?.[0];
  if (!loc) throw new Error(`未找到城市「${city}」`);
  const { lat, lon, id: locationId, name: geoName } = loc;

  // 2. 并发取各接口（allSettled：任一失败不拖垮整体）
  const settled = await Promise.allSettled([
    request(`/weather/v1/current/${lat}/${lon}`, config, { localTime: 'true', lang: 'zh' }),
    request(`/weather/v1/daily/${lat}/${lon}`, config, { days: '7', localTime: 'true', lang: 'zh' }),
    request(`/weather/v1/hourly/${lat}/${lon}`, config, { hours: '24', localTime: 'true', lang: 'zh' }),
    request('/v7/indices/1d', config, { type: '0', location: locationId, lang: 'zh' }),
    request('/v7/air/now', config, { location: locationId, lang: 'zh' }),
    request('/v7/warning/now', config, { location: locationId, lang: 'zh' }),
  ]);
  const pick = (i: number): any =>
    settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<any>).value : null;

  const cur = pick(0);
  if (!cur) throw new Error('和风实时天气获取失败');
  const dly = pick(1);
  const hrly = pick(2);
  const idx = pick(3);
  const air = pick(4);
  const warn = pick(5);

  const days: any[] = dly?.days || [];
  const hours: any[] = hrly?.hours || [];

  // 3. 逐日 / 逐时
  const forecast = mapDaily(days);
  const hourly = mapHourly(hours);

  // 4. 生活指数（type=0 返回全部；name 已含「指数」后缀，去掉保持与 v1 契约一致）
  const indices = (idx?.daily || []).map((d: any) => ({
    name: String(d.name || '').replace(/指数$/, ''),
    level: d.category || '',
    tip: d.text || '',
  }));

  // 5. 空气质量
  const airQuality: AirQuality | undefined = air?.now
    ? {
        aqi: Number(air.now.aqi) || 0,
        category: air.now.category || '',
        primary: air.now.primary || undefined,
        pm25: air.now.pm2p5 != null ? Number(air.now.pm2p5) : undefined,
      }
    : undefined;

  // 6. 预警
  const warnings: WeatherWarning[] = (warn?.warning || []).map((w: any) => ({
    title: w.title || '',
    severity: w.severity || 'Unknown',
    text: w.text || '',
    type: w.typeName || undefined,
  }));

  // 7. 天文
  const astroRaw = days[0]?.astro;
  const astro: AstroInfo | undefined = astroRaw
    ? {
        sunrise: isoToHm(astroRaw.sunrise),
        sunset: isoToHm(astroRaw.sunset),
        moonPhase: MOON_PHASE_CN[astroRaw.moonPhase] || undefined,
      }
    : undefined;

  // 8. 分钟级降水（独立接口，失败不影响主流程）
  let minutely: MinutelyRain | undefined;
  try {
    const min = await request(`/v7/minutely/5m`, config, { location: locationId });
    if (min?.minutely?.length) {
      minutely = {
        summary: min.summary || '',
        values: min.minutely.map((m: any) => Number(m.precip) || 0),
      };
    }
  } catch {
    // 免费订阅可能不含分钟级降水，静默跳过
  }

  // 9. 能力清单：静态声明 ∩ 本次真拿到数据
  const rawCaps: WeatherCapability[] = PROVIDER_CAPABILITIES.qweather.filter((cap) => {
    if (cap.startsWith('indices.')) return indices.length > 0;
    if (cap.startsWith('air.')) return !!airQuality;
    if (cap.startsWith('alert.')) return warnings.length > 0;
    if (cap === 'minutely.precipitation') return !!minutely;
    if (cap === 'forecast.hourly') return hourly.length > 0;
    if (cap.startsWith('forecast.daily')) return forecast.length > 0;
    if (cap === 'astro.sunriseSunset' || cap === 'astro.moonPhase') return !!astro;
    if (cap === 'forecast.uvIndexMax') return days.some((d) => d.uvIndexMax != null);
    if (cap === 'forecast.precipitation') return days.some((d) => d.daytime?.precipitation?.probability != null);
    // 实时字段：值存在即声明
    if (cap === 'current.dewPoint') return cur.dewPoint?.value != null;
    if (cap === 'current.cloudCover') return cur.cloudCover != null;
    if (cap === 'current.pressure') return cur.pressure?.value != null;
    if (cap === 'current.windGust') return cur.windGust?.value != null;
    if (cap === 'current.windScale') return cur.wind?.scale != null;
    if (cap === 'current.precipitation') return cur.precipitation?.amount?.value != null;
    if (cap === 'current.uvIndex') return cur.uvIndex != null;
    if (cap === 'current.isDay') return cur.isDay != null;
    return true;
  });

  // 10. 组装（注意 v1 的 humidity / cloudCover 为 0–1 小数，需 ×100）
  const windScale = cur.wind?.scale;
  const data: WeatherData = {
    /* ---- 基础字段 ---- */
    temperature: round(cur.temperature?.value),
    feelsLike: round(cur.feelsLike?.value ?? cur.temperature?.value),
    description: cur.condition?.text || '未知',
    humidity: round((cur.humidity ?? 0) * 100),
    windDirection: compassToCn(cur.wind?.direction?.compass)
      || degreeToCn(cur.wind?.direction?.degree) || '未知',
    windSpeed: windScale != null ? windScaleToText(windScale) : '未知',
    visibility: cur.visibility?.value != null ? round(cur.visibility.value / 1000) : 10,
    updateTime: Date.now(),
    forecast,
    city: geoName || city,
    condition: normalizeCondition(cur.condition?.text || ''),

    /* ---- 扩展字段 ---- */
    source: '和风天气',
    capabilities: rawCaps,
    pressure: cur.pressure?.value != null ? round(cur.pressure.value) : undefined,
    dewPoint: cur.dewPoint?.value != null ? round(cur.dewPoint.value) : undefined,
    cloudCover: cur.cloudCover != null ? round(cur.cloudCover * 100) : undefined,
    windGust: cur.windGust?.value != null ? round(cur.windGust.value) : undefined,
    windScale,
    precipitation: cur.precipitation?.amount?.value,
    precipitationText: cur.precipitation?.type && cur.precipitation.type !== 'none'
      ? cur.condition?.text
      : undefined,
    uvIndex: cur.uvIndex ?? undefined,
    isDay: cur.isDay != null ? !!cur.isDay : undefined,
    airQuality,
    warnings: warnings.length ? warnings : undefined,
    hourly: hourly.length ? hourly : undefined,
    minutely,
    astro,
    indices: indices.length ? indices : undefined,
  };

  if (!isUsableWeatherData(data)) throw new Error('和风返回数据不可用');
  return data;
}

/** 和风天气 Provider */
export const qweatherProvider: WeatherProvider = {
  id: 'qweather',
  label: '和风天气',
  zeroConfig: false,
  capabilities: PROVIDER_CAPABILITIES.qweather,
  configSchema: CONFIG_SCHEMA,
  fetch: fetchFromQWeather,

  /** 连通性自检：GeoAPI 查一次北京 */
  async probe(config) {
    const creds = config.credentials || {};
    const hostCheck = validateQWeatherHost(creds.apiHost);
    if (!hostCheck.ok) return { ok: false, message: hostCheck.message };

    if (creds.authMode !== 'apikey') {
      if (!creds.privateKey || !creds.kid || !creds.projectId || !creds.developerId) {
        return { ok: false, message: '请先填齐 JWT 所需字段（kid / 项目 ID / 开发者 ID / 私钥）' };
      }
      try {
        crypto.createPrivateKey({ key: creds.privateKey, format: 'pem' });
      } catch (e) {
        return { ok: false, message: `私钥格式无法解析：${(e as Error).message}` };
      }
    } else if (!creds.apiKey) {
      return { ok: false, message: '请先填写 API KEY' };
    }

    try {
      const geo = await request('/geo/v2/city/lookup', config, {
        location: '北京', range: 'cn', number: '1',
      });
      const hit = geo?.location?.[0];
      return hit
        ? { ok: true, message: `连接正常，定位到「${hit.name}」(${hit.lat}, ${hit.lon})` }
        : { ok: false, message: '接口返回但未匹配到城市' };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
};
