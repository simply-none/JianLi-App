/**
 * 天气模块 - 通用归一化工具
 * ------------------------------------------------------------------
 * 从原 electron/main/module/weather.ts 迁入，供所有 provider 复用：
 * - normalizeCondition：天气描述文本 → 归一化现象枚举
 * - isValidWeatherData：页面抽取结果的严格有效性校验（仅 crawler provider 使用）
 * - isUsableWeatherData：adapter 出口的宽松校验（不同源字段丰俭不同）
 * - compassToCn / windScaleToText / maskSecret 等格式化助手
 */

import type { WeatherCondition } from './types.ts';

/**
 * 天气现象关键词映射表
 * 顺序即匹配优先级：雷暴 > 雪 > 雨 > 雾 > 霾 > 风 > 晴 > 阴 > 多云
 * 例如「雷阵雨」优先命中雷暴，「雨夹雪」优先命中雪
 */
const CONDITION_KEYWORDS: [WeatherCondition, string[]][] = [
  ['thunder', ['雷', '冰雹', 'thunder', 'storm', '暴风']],
  ['snow', ['雪', 'sleet', 'hail', 'snow']],
  ['rain', ['雨', 'rain', 'drizzle', 'shower']],
  ['fog', ['雾', 'fog', 'mist']],
  ['haze', ['霾', '沙', '尘', 'haze', 'smoke', 'dust', 'sand', 'ash']],
  ['wind', ['大风', '台风', 'gale', 'squall', 'typhoon', 'tornado']],
  ['sunny', ['晴', 'sun', 'clear']],
  ['overcast', ['阴', 'overcast']],
  ['cloudy', ['云', 'cloud']],
];

/**
 * 根据天气描述文本归一化出天气现象类型
 * @param desc 天气描述（中英文均可，如「雷阵雨」「Partly Cloudy」）
 * @returns 归一化天气现象类型，无法识别时返回 'cloudy'（兜底）
 */
export function normalizeCondition(desc: string): WeatherCondition {
  const text = (desc || '').toLowerCase();
  if (!text) return 'cloudy';
  for (const [condition, keywords] of CONDITION_KEYWORDS) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return condition;
    }
  }
  return 'cloudy';
}

/**
 * 判断页面抽取结果是否为有效天气数据（严格版）
 * 温度 / 描述 / 湿度 / 预报 至少命中两项才视为有效，
 * 避免把「全默认值」的空页面当成功。仅供 crawler provider 使用。
 * @param data 页面抽取出的天气数据
 */
export function isValidWeatherData(data: any): boolean {
  if (!data) return false;
  const hasTemp = typeof data.temperature === 'number' && data.temperature !== 0;
  const hasDesc = !!data.description && data.description !== '未知';
  const hasHumidity = typeof data.humidity === 'number' && data.humidity > 0;
  const hasForecast = Array.isArray(data.forecast) && data.forecast.length > 0;
  return [hasTemp, hasDesc, hasHumidity, hasForecast].filter(Boolean).length >= 2;
}

/**
 * 判断 adapter 产出的数据是否可用（宽松版）
 * 不同数据源字段丰俭不同，故只要求「温度」或「描述」至少有一个有效。
 * @param data adapter 返回的天气数据
 */
export function isUsableWeatherData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  const hasTemp = typeof data.temperature === 'number' && !Number.isNaN(data.temperature);
  const hasDesc = typeof data.description === 'string' && data.description.length > 0 && data.description !== '未知';
  return hasTemp || hasDesc;
}

/* ===================== 格式化助手 ===================== */

/** 方位代码 → 中文风向 */
const COMPASS_CN: Record<string, string> = {
  n: '北风', nne: '北东北风', ne: '东北风', ene: '东东北风',
  e: '东风', ese: '东东南风', se: '东南风', sse: '南东南风',
  s: '南风', ssw: '南西南风', sw: '西南风', wsw: '西西南风',
  w: '西风', wnw: '西西北风', nw: '西北风', nnw: '北西北风',
  none: '', vrb: '风向不定',
};

/**
 * 和风 compass 方位代码 → 中文风向
 * @param compass 方位代码（如 'sw'）
 */
export function compassToCn(compass?: string): string {
  if (!compass) return '';
  return COMPASS_CN[compass.toLowerCase()] ?? '';
}

/**
 * 风向角度 → 中文风向（16 方位）
 * @param degree 角度（0-359，0 为正北）
 */
export function degreeToCn(degree?: number): string {
  if (degree == null || Number.isNaN(degree)) return '';
  const dirs = [
    '北风', '北东北风', '东北风', '东东北风',
    '东风', '东东南风', '东南风', '南东南风',
    '南风', '南西南风', '西南风', '西西南风',
    '西风', '西西北风', '西北风', '北西北风',
  ];
  const idx = Math.round(((degree % 360) + 360) % 360 / 22.5) % 16;
  return dirs[idx];
}

/**
 * 蒲福风级 → 风力文案（与项目既有「3级」风格一致）
 * @param scale 风级
 */
export function windScaleToText(scale?: number): string {
  if (scale == null || Number.isNaN(scale)) return '';
  return scale <= 0 ? '<1级' : `${scale}级`;
}

/**
 * 米/秒 → km/h
 * @param ms 米每秒
 */
export function msToKmh(ms: number): number {
  return Math.round(ms * 3.6);
}

/**
 * 保留指定小数位（避免 31.710000000000004 这类浮点脏值）
 * @param value 数值
 * @param digits 小数位，默认 0
 */
export function round(value: unknown, digits = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * ISO 时间串 → HH:mm
 * @param iso ISO 8601 时间（如 '2024-08-11T04:22Z'）
 */
export function isoToHm(iso?: string): string {
  if (!iso) return '';
  // 和风 localTime=true 时返回本地时间串（无 Z），可直接截取
  const local = iso.match(/T(\d{2}:\d{2})/);
  if (local) return local[1];
  return '';
}

/**
 * 敏感字段脱敏预览（如 `abc****xyz`）
 * @param value 明文
 * @returns 脱敏后的预览文本；空值返回空串
 */
export function maskSecret(value?: string): string {
  if (!value) return '';
  const s = String(value);
  if (s.length <= 8) return '*'.repeat(s.length);
  return `${s.slice(0, 3)}${'*'.repeat(Math.min(8, s.length - 6))}${s.slice(-3)}`;
}

/**
 * 校验和风 API Host 格式（专属 Host 形如 xxx.xy.qweatherapi.com）
 * 用于配置保存前的合法性提示，避免误填公共域名
 * @param host 用户填写的 Host
 */
export function validateQWeatherHost(host?: string): { ok: boolean; message: string } {
  const h = (host || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!h) return { ok: false, message: '请填写 API Host' };
  if (/^(api|devapi|geoapi)\.qweather\.com$/i.test(h)) {
    return { ok: false, message: '这是公共域名，2026 年起将逐步停服，请改用控制台分配的专属 Host' };
  }
  if (!/\.qweatherapi\.com$/i.test(h)) {
    return { ok: false, message: 'Host 格式不正确，应以 .qweatherapi.com 结尾' };
  }
  return { ok: true, message: '' };
}
