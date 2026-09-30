/**
 * 天气数据源 - 中国天气网（HTTP 接口）
 * ------------------------------------------------------------------
 * 与 `crawler.ts`（Puppeteer 爬虫）是**两条独立链路**，本文件走纯 HTTP：
 * 直接用 citycode 构造接口地址，**不经过搜索引擎、不依赖页面 DOM 渲染**，
 * 因此不存在「搜索没命中 → 跳错站点 → 拿不到数据」的问题。
 *
 * 接口：https://d1.weather.com.cn/weather_index/{citycode}.html
 *
 * ⚠️ 三条硬约束（均经实测确认，勿改）：
 *   1. **必须 HTTPS**：明文 http 一律返回 403（无论带不带 UA / Referer）；
 *   2. **必须带 Referer**，且协议也要是 https:// —— 用 `http://` 的 Referer 同样 403；
 *   3. citycode 只能从本地快照表查（见 data/cnWeatherCodes.ts），接口不接受中文名。
 *
 * 单次请求返回 5 个 JS 变量，覆盖本 provider 声明的全部能力：
 *   - `dataSK`  实况：温度 / 湿度 / 风向 / 风力 / 能见度 / AQI / 降水 / 天气现象
 *   - `cityDZ`  今日：天气现象 / 高低温 / 风向 / 风力
 *   - `fc`      7 天预报：天气码 / 高低温(℃) / 风向 / 风力 / 日期
 *   - `dataZS`  **生活指数 30 项**（`xx_name` / `xx_hint` / `xx_des_s` 三段式）
 *   - `alarmDZ` 预警：省 / 市 / 区三级（含等级、正文、生效时间）
 *
 * 响应体不是纯 JSON，而是 `var xxx = {...};` 拼接的 JS 片段，
 * 需先按变量名切段再用 JSON.parse 解析（见 parseVars）。
 */

import { PROVIDER_CAPABILITIES } from '../capability.ts';
import { isUsableWeatherData, normalizeCondition } from '../normalize.ts';
import { lookupCnWeatherCode } from '../data/cnWeatherCodes.ts';
import type {
  AirQuality, ForecastDay, ProviderConfigField, WeatherCapability, WeatherData,
  WeatherProvider, WeatherWarning,
} from '../types.ts';

/* ===================== 常量 ===================== */

const API_BASE = 'https://d1.weather.com.cn';

/** 零配置源：无表单字段 */
const CONFIG_SCHEMA: ProviderConfigField[] = [];

/**
 * 请求头
 * ⚠️ Referer 必须存在且协议为 https://，否则接口返回 403
 */
function buildHeaders(code: string): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      + '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': `https://www.weather.com.cn/weather1d/${code}.shtml`,
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
  };
}

/**
 * 天气现象码 → 中文
 * ------------------------------------------------------------------
 * `fc` 的 `fa` / `fb` 是**纯数字码**（如 `04`），不含天气文本；
 * `dataSK.weathercode` / `cityDZ.weathercode` 则是 `d04` / `n04` 形态（d=白天 n=夜间）。
 *
 * 下表由 57 份真实页面样本（`cache-data/*.html` 的 `hour3data`）**实测反查**得到，
 * 实测确认：**白天 `d` 与夜间 `n` 的数字部分含义完全相同**（d04=雷阵雨，n04 也是雷阵雨）。
 * 故纯数字码与带前缀码统一按数字查表。
 *
 * 未命中的码回落「未知」，由 normalizeCondition 自行归类。
 */
const WEATHER_CODE_CN: Record<string, string> = {
  '00': '晴',
  '01': '多云',
  '02': '阴',
  '03': '阵雨',
  '04': '雷阵雨',
  '05': '雷阵雨伴有冰雹',
  '06': '雨夹雪',
  '07': '小雨',
  '08': '中雨',
  '09': '大雨',
  '10': '暴雨',
  '11': '大暴雨',
  '12': '特大暴雨',
  '13': '阵雪',
  '14': '小雪',
  '15': '中雪',
  '16': '大雪',
  '17': '暴雪',
  '18': '雾',
  '19': '冻雨',
  '20': '沙尘暴',
  '21': '小到中雨',
  '22': '中到大雨',
  '23': '大到暴雨',
  '24': '暴雨到大暴雨',
  '25': '大暴雨到特大暴雨',
  '26': '小到中雪',
  '27': '中到大雪',
  '28': '大到暴雪',
  '29': '浮尘',
  '30': '扬沙',
  '31': '强沙尘暴',
  '53': '霾',
};

/**
 * 天气码 → 中文描述
 * @param code 形如 `04` / `d04` / `n04`
 */
function weatherCodeToCn(code: unknown): string {
  const s = String(code ?? '').trim().toLowerCase();
  if (!s) return '';
  // 去掉 d / n 前缀（白天 / 夜间，数字含义相同）
  const digits = s.replace(/^[dn]/, '');
  return WEATHER_CODE_CN[digits] || '';
}

/**
 * 预警等级中文 → severity
 * 接口 `w7` 字段给出「蓝色 / 黄色 / 橙色 / 红色」四色
 */
const SEVERITY_MAP: Record<string, string> = {
  蓝色: 'Minor',
  黄色: 'Moderate',
  橙色: 'Severe',
  红色: 'Extreme',
};

/**
 * AQI 数值 → 等级文案（GB/T 3095 六档）
 * 接口只给 `aqi` 数值，不给等级，故本地换算
 * @param aqi 空气质量指数
 */
function aqiCategory(aqi: number): string {
  if (aqi <= 50) return '优';
  if (aqi <= 100) return '良';
  if (aqi <= 150) return '轻度污染';
  if (aqi <= 200) return '中度污染';
  if (aqi <= 300) return '重度污染';
  return '严重污染';
}

/* ===================== 响应解析 ===================== */

/**
 * 从 `var name = {...};` 形式的响应里提取指定变量并解析为对象
 *
 * ⚠️ 不能用 `[\s\S]*?` 非贪婪匹配大括号 —— 变量值含嵌套对象，
 *    非贪婪会在第一个 `};` 处提前截断。这里实现**引号感知的括号配对扫描**。
 *
 * @param raw 接口原始响应
 * @param name 变量名（如 `dataSK`）
 */
function pickVar<T = any>(raw: string, name: string): T | null {
  const re = new RegExp(`var\\s+${name}\\s*=\\s*`);
  const m = re.exec(raw);
  if (!m) return null;

  const start = raw.indexOf('{', m.index + m[0].length);
  if (start < 0) return null;

  let depth = 0;
  let inStr = false;
  let quote = '';
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];

    if (inStr) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        inStr = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inStr = true;
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const literal = raw.slice(start, i + 1);
        try {
          return JSON.parse(literal) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * 请求接口并解析全部变量
 * @param code 9 位 citycode
 * @param timeout 超时（ms）
 */
async function requestIndex(code: string, timeout: number): Promise<{
  sk: any; dz: any; fc: any; zs: any; alarm: any;
}> {
  const url = `${API_BASE}/weather_index/${code}.html`;
  const res = await fetch(url, {
    headers: buildHeaders(code),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    // 403 通常是 Referer / 协议不对；接口失效也走这里
    throw new Error(`中国天气网接口 HTTP ${res.status}${res.status === 403 ? '（Referer 缺失或协议不符）' : ''}`);
  }
  const raw = await res.text();

  const sk = pickVar(raw, 'dataSK');
  const dz = pickVar(raw, 'cityDZ');
  const fc = pickVar(raw, 'fc');
  const zs = pickVar(raw, 'dataZS');
  const alarm = pickVar(raw, 'alarmDZ');

  // 实况是核心：没有它视为接口异常（页面结构或接口契约变更）
  if (!sk) throw new Error('中国天气网接口返回为空或结构已变更');

  return { sk, dz, fc, zs, alarm };
}

/* ===================== 字段映射 ===================== */

/** 数字解析（返回 undefined 而非 NaN） */
function num(v: unknown): number | undefined {
  const n = Number(String(v ?? '').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/** 提取百分比数值（如 `63%` → 63） */
function pct(v: unknown): number | undefined {
  const m = String(v ?? '').match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : undefined;
}

/** 提取带单位距离的数值（如 `23km` → 23） */
function km(v: unknown): number | undefined {
  const m = String(v ?? '').match(/(\d+(?:\.\d+)?)\s*(?:km|公里)?/i);
  return m ? Number(m[1]) : undefined;
}

/**
 * 解析 `dataZS` 的 30 项生活指数
 * 结构为扁平对象，每项三个键：`{prefix}_name` / `_hint` / `_des_s`
 * @param zs dataZS 对象
 */
function parseIndices(zs: any): Array<{ name: string; level: string; tip: string }> {
  const bag = zs?.zs;
  if (!bag || typeof bag !== 'object') return [];
  const out: Array<{ name: string; level: string; tip: string }> = [];
  for (const key of Object.keys(bag)) {
    if (!key.endsWith('_name')) continue;
    const prefix = key.slice(0, -'_name'.length);
    const name = String(bag[key] ?? '').trim();
    if (!name) continue;
    out.push({
      name: name.replace(/指数$/, ''),
      level: String(bag[`${prefix}_hint`] ?? '').trim(),
      tip: String(bag[`${prefix}_des_s`] ?? '').trim(),
    });
  }
  return out;
}

/**
 * 解析 `fc` 的 7 天预报
 * 字段：fa/fb 白天/夜间**天气码**、fc/fd 高/低温(℃)、fe/ff 白天/夜间风向、
 *       fg/fh 白天/夜间风力、fi 日期、fj 星期
 *
 * ⚠️ `fc` 项**不含天气文本**，只有天气码（如 `04`）⇒ 必须查 `WEATHER_CODE_CN`；
 *    白天码与夜间码不同（如 d04/n07）时拼成「雷阵雨转小雨」。
 * @param fc fc 对象
 */
function parseForecast(fc: any): ForecastDay[] {
  const list: any[] = fc?.f;
  if (!Array.isArray(list)) return [];
  return list.slice(0, 7).map((d: any, i: number) => {
    // 天气现象：白天码 + 夜间码，不同则「A转B」
    const dayCn = weatherCodeToCn(d?.fa);
    const nightCn = weatherCodeToCn(d?.fb);
    const desc = dayCn && nightCn && dayCn !== nightCn
      ? `${dayCn}转${nightCn}`
      : (dayCn || nightCn || '未知');

    // 风向：白天与夜间不同则「A转B」
    const windDirs = [d?.fe, d?.ff].map((x) => String(x ?? '').trim()).filter(Boolean);
    const uniqDirs = windDirs.filter((v, idx) => windDirs.indexOf(v) === idx);
    // 风力：白天与夜间不同则「A转B」
    const powers = [d?.fg, d?.fh].map((x) => String(x ?? '').trim()).filter(Boolean);
    const uniqPowers = powers.filter((v, idx) => powers.indexOf(v) === idx);

    return {
      // fi 形如 `9/30`（JSON 里被转义为 `9\/30`，parse 后自动还原）
      date: (i === 0 ? '今天' : String(d?.fi ?? '').trim()) || `D${i + 1}`,
      high: num(d?.fc) ?? 0,
      low: num(d?.fd) ?? 0,
      description: desc,
      icon: normalizeCondition(desc),
      windDirection: uniqDirs.length ? uniqDirs.join('转') : undefined,
      windPower: uniqPowers.length ? uniqPowers.join('转') : undefined,
    };
  });
}

/**
 * 解析 `alarmDZ` 的预警列表
 * 字段：w1/w2/w3 省/市/区、w5 类型、w7 等级、w8 发布时间、
 *       w9 正文、w13 标题、w14 状态（Alert/Update/Cancel）
 * @param alarm alarmDZ 对象
 */
function parseWarnings(alarm: any): WeatherWarning[] {
  const list: any[] = alarm?.w;
  if (!Array.isArray(list)) return [];
  return list
    // Cancel = 已解除，不再展示
    .filter((w: any) => String(w?.w14 ?? '').toLowerCase() !== 'cancel')
    .slice(0, 5)
    .map((w: any) => ({
      title: String(w?.w13 ?? w?.w5 ?? '天气预警').trim(),
      severity: SEVERITY_MAP[String(w?.w7 ?? '').trim()] ?? 'Moderate',
      text: String(w?.w9 ?? '').trim(),
    }));
}

/* ===================== 主流程 ===================== */

/**
 * 从中国天气网 HTTP 接口拉取并归一化
 * @param city 中文城市名
 * @param config 运行期配置（零配置，仅用 timeout；`cityRef` 用于重名消歧）
 */
async function fetchFromCnWeather(city: string, config: any): Promise<WeatherData> {
  // registry 注入的消歧提示键名为 `cityRef`（中文名重名时用于挑选正确的 citycode）
  const ref = config.cityRef ?? null;
  const code = lookupCnWeatherCode(city, ref);
  if (!code) throw new Error(`中国天气网城市码表未收录「${city}」`);

  const { sk, dz, fc, zs, alarm } = await requestIndex(code, config.timeout ?? 15000);

  /* ---- 天气现象：实况文本 → 今日预报文本 → 实况天气码 ---- */
  const desc = String(sk?.weather ?? dz?.weatherinfo?.weather ?? '').trim()
    || weatherCodeToCn(sk?.weathercode)
    || '未知';

  /* ---- 逐日预报 ---- */
  let forecast = parseForecast(fc);
  // fc 缺失时用 cityDZ 补一天
  if (!forecast.length && dz?.weatherinfo) {
    const info = dz.weatherinfo;
    forecast = [{
      date: '今天',
      high: num(info.temp) ?? 0,
      low: num(info.tempn) ?? 0,
      description: String(info.weather ?? '未知').trim(),
      icon: normalizeCondition(String(info.weather ?? '')),
      windDirection: String(info.wd ?? '').trim() || undefined,
      windPower: String(info.ws ?? '').trim() || undefined,
    }];
  }

  /* ---- 生活指数 ---- */
  const indices = parseIndices(zs);

  /* ---- 预警 ---- */
  const warnings = parseWarnings(alarm);

  /* ---- 实况基础字段 ---- */
  const temperature = num(sk?.temp) ?? 0;
  const humidity = pct(sk?.SD) ?? 0;
  const visibility = km(sk?.njd) ?? 10;
  const aqi = num(sk?.aqi);

  // 空气质量：接口只给 aqi 数值，等级本地换算
  const airQuality: AirQuality | undefined = aqi != null
    ? { aqi: Math.round(aqi), category: aqiCategory(aqi), pm25: num(sk?.aqi_pm25) }
    : undefined;

  // 风向 / 风力：实况优先，回落今日预报
  const windDirection = String(sk?.WD ?? dz?.weatherinfo?.wd ?? '').trim() || '未知';
  const windSpeed = String(sk?.WS ?? dz?.weatherinfo?.ws ?? '').trim() || '未知';

  /* ---- 能力清单：静态声明 ∩ 本次真拿到数据 ---- */
  const capabilities: WeatherCapability[] = PROVIDER_CAPABILITIES.cnweather.filter((cap) => {
    if (cap === 'indices.life') return indices.length > 0;
    if (cap === 'alert.warning') return warnings.length > 0;
    if (cap.startsWith('forecast.daily')) return forecast.length > 0;
    if (cap === 'forecast.dailyWind') return forecast.some((d) => d.windDirection || d.windPower);
    if (cap === 'current.visibility') return visibility > 0;
    if (cap === 'current.humidity') return humidity > 0;
    if (cap === 'air.quality') return !!airQuality;
    return true;
  });

  const data: WeatherData = {
    /* ---- 基础字段 ---- */
    temperature,
    feelsLike: temperature,
    description: desc,
    humidity,
    windDirection,
    windSpeed,
    visibility,
    updateTime: Date.now(),
    forecast,
    city: String(sk?.cityname ?? dz?.weatherinfo?.city ?? city),
    condition: normalizeCondition(desc),

    /* ---- 扩展字段 ---- */
    source: '中国天气网',
    capabilities,
    indices: indices.length ? indices : undefined,
    warnings: warnings.length ? warnings : undefined,
    airQuality,
  };

  if (!isUsableWeatherData(data)) throw new Error('中国天气网返回数据不可用');
  return data;
}

/** 中国天气网（HTTP 接口）Provider（零配置） */
export const cnweatherProvider: WeatherProvider = {
  id: 'cnweather',
  label: '中国天气网（接口）',
  zeroConfig: true,
  capabilities: PROVIDER_CAPABILITIES.cnweather,
  configSchema: CONFIG_SCHEMA,
  fetch: fetchFromCnWeather,

  /** 连通性自检：查一次北京 */
  async probe(config) {
    try {
      const { sk } = await requestIndex('101010100', config.timeout ?? 15000);
      const name = String(sk?.cityname ?? '北京');
      const temp = String(sk?.temp ?? '');
      return {
        ok: true,
        message: `连接正常，${name}实况 ${temp}°C（数据源：中国天气网接口）`,
      };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
};
