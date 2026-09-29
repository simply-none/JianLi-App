/**
 * 天气数据源 - 内置爬虫（中国天气网）
 * ------------------------------------------------------------------
 * 从原 electron/main/module/weather.ts 迁移而来，作为**最后一层兜底**：
 * 它虽慢且脆，但中国天气网的**生活指数**是和风不可用时的唯一指数来源。
 *
 * 链路：必应搜索「{城市}天气」→ pickHref 挑第一个 weather.com.cn 链接
 *       → 点击/跳转 → 等待加载 → 页面内抽取 → 有效性校验
 *
 * 注意：extract / pickHref 函数会被序列化注入页面执行，**禁止引用外部变量**。
 */

import { crawlPage } from '../../crawler.ts';
import { PROVIDER_CAPABILITIES } from '../capability.ts';
import { isValidWeatherData, normalizeCondition } from '../normalize.ts';
import type { ForecastDay, WeatherCapability, WeatherData, WeatherProvider } from '../types.ts';

/* ===================== 页面内抽取函数 ===================== */

/**
 * 页面上下文天气抽取函数（由 crawlPage 在浏览器内执行）
 * ⚠️ 会被序列化注入，禁止引用任何外部变量
 */
function extractWeatherFromPage() {
  const result: any = {
    temperature: 0,
    feelsLike: 0,
    description: '未知',
    humidity: 0,
    windDirection: '未知',
    windSpeed: '未知',
    visibility: 10,
    forecast: [],
    indices: [],
    city: '',
    source: '',
    warnings: [],
    rawData: {},
  };

  // —— 中国天气网结构适配 ——
  // 今日概况藏在隐藏输入框中，格式如「08月29日08时 周六 小雨 34/27°C」
  const hiddenTitle = (document.querySelector('#hidden_title') as HTMLInputElement | null)?.value || '';
  if (hiddenTitle) {
    result.source = '中国天气网';
    const parts = hiddenTitle.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      // 高温/低温段：34/27°C（当前温度取高温）
      if (part.includes('°C') || part.includes('℃')) {
        const match = part.match(/(-?\d+)\s*\/\s*(-?\d+)/);
        if (match) {
          result.temperature = parseInt(match[1]) || 0;
          result.feelsLike = parseInt(match[2]) || 0;
        }
        continue;
      }
      // 跳过日期时间与星期段，其余短文本视为天气描述
      if (/^\d{1,2}月\d{1,2}日/.test(part) || /^周[一二三四五六日天]$/.test(part)) continue;
      if (part.length <= 12 && result.description === '未知') {
        result.description = part;
      }
    }

    // 城市名：面包屑最后一个链接（省 > 市）
    const crumbLinks = document.querySelectorAll('.crumbs a');
    if (crumbLinks.length > 0) {
      result.city = (crumbLinks[crumbLinks.length - 1].textContent || '').trim();
    }
  }

  // —— 生活指数（li > span 等级 + em 名称 + p 建议）——
  // 页面中存在隐藏重复块，按名称去重取首个
  const indexMap: Record<string, any> = {};
  document.querySelectorAll('li > em').forEach((em) => {
    const name = (em.textContent || '').trim();
    if (!name.endsWith('指数') || indexMap[name]) return;
    const li = em.parentElement;
    if (!li) return;
    const level = (li.querySelector('span')?.textContent || '').trim();
    const tip = (li.querySelector('p')?.textContent || '').trim();
    if (!level && !tip) return;
    indexMap[name] = { name: name.replace(/指数$/, ''), level, tip };
  });
  result.indices = Object.values(indexMap);

  // —— 7 天预报（ul.t > li；含日期/现象/高低温/风向/风力）——
  const forecastList: any[] = [];
  document.querySelectorAll('ul.t > li').forEach((li, index) => {
    if (index >= 7) return;
    const date = (li.querySelector('h1')?.textContent || '').trim();
    const descEl = li.querySelector('p.wea');
    const desc = (descEl?.textContent || descEl?.getAttribute('title') || '').trim();
    const high = (li.querySelector('p.tem span')?.textContent || '').replace(/[^0-9-]/g, '');
    const low = (li.querySelector('p.tem i')?.textContent || '').replace(/[^0-9-]/g, '');
    // 风向：win em 内多个 span 的 title（如「东风」+「东南风」→「东风转东南风」）
    const windDirs: string[] = [];
    li.querySelectorAll('p.win em span').forEach((span) => {
      const dir = (span.getAttribute('title') || '').trim();
      if (dir && windDirs[windDirs.length - 1] !== dir) windDirs.push(dir);
    });
    const windPower = (li.querySelector('p.win i')?.textContent || '').trim();

    if (date || desc) {
      forecastList.push({
        date,
        high: parseInt(high) || 0,
        low: parseInt(low) || 0,
        description: desc,
        icon: '',
        windDirection: windDirs.join('转'),
        windPower,
      });
    }
  });

  // 预报命中结构：当日风向/风力回填主字段
  if (forecastList.length > 0) {
    result.forecast = forecastList;
    const today = forecastList[0];
    if (today.windDirection) result.windDirection = today.windDirection;
    if (today.windPower) result.windSpeed = today.windPower;
  }

  // —— 天气预警（中国天气网预警条）——
  document.querySelectorAll('.warning-list li, .alarm-list li, [class*="warning"] li').forEach((li) => {
    const text = (li.textContent || '').trim();
    if (text && text.length > 4 && text.length < 200) {
      result.warnings.push({ title: text.slice(0, 30), severity: 'Moderate', text });
    }
  });

  // —— 通用结构兜底（非中国天气网页面时使用）——
  if (!hiddenTitle) {
    const tempElements = document.querySelectorAll('[class*="temp"], [class*="temperature"], .tem span, .temperature');
    for (const el of tempElements) {
      const match = (el.textContent || '').match(/(-?\d+)/);
      if (match) { result.temperature = parseInt(match[1]); break; }
    }

    const descElements = document.querySelectorAll('[class*="desc"], [class*="weather"], .wea, .weather');
    for (const el of descElements) {
      const text = el.textContent || '';
      if (text && text.length > 0 && text.length < 20) { result.description = text.trim(); break; }
    }

    const feelsLikeElements = document.querySelectorAll('[class*="feels"], [class*="体感"], .tem i');
    for (const el of feelsLikeElements) {
      const match = (el.textContent || '').match(/(-?\d+)/);
      if (match) { result.feelsLike = parseInt(match[1]); break; }
    }

    const humidityElements = document.querySelectorAll('[class*="humidity"], [class*="湿度"], .shidu');
    for (const el of humidityElements) {
      const match = (el.textContent || '').match(/(\d+)%/);
      if (match) { result.humidity = parseInt(match[1]); break; }
    }

    const windElements = document.querySelectorAll('[class*="wind"], [class*="风"], .win');
    for (const el of windElements) {
      const text = el.textContent || '';
      if (text) {
        const parts = text.split(/[\s\n]+/).filter(Boolean);
        result.windDirection = parts[0] || '未知';
        result.windSpeed = parts[1] || '未知';
        break;
      }
    }

    const cityElements = document.querySelectorAll('h1, .city, [class*="city"], .crumbs a:last-child');
    for (const el of cityElements) {
      const text = el.textContent || '';
      if (text && text.length > 0) { result.city = text.trim(); break; }
    }

    // 未来预报（最多取 5 天）
    const forecastElements = document.querySelectorAll('[class*="forecast"], .t > li, [class*="day"]');
    const genericForecast: any[] = [];
    forecastElements.forEach((el, index) => {
      if (index >= 5) return;
      const dateEl = el.querySelector('[class*="date"], .date');
      const highEl = el.querySelector('[class*="high"], [class*="max"], .high');
      const lowEl = el.querySelector('[class*="low"], [class*="min"], .low');
      const descEl = el.querySelector('[class*="desc"], [class*="weather"], .wea');

      const date = dateEl?.textContent || '';
      const high = highEl?.textContent ? parseInt(highEl.textContent.replace(/[^0-9-]/g, '')) || 0 : 0;
      const low = lowEl?.textContent ? parseInt(lowEl.textContent.replace(/[^0-9-]/g, '')) || 0 : 0;
      const desc = descEl?.textContent || '';

      if (date || desc) {
        genericForecast.push({ date: date.trim(), high, low, description: desc.trim(), icon: '' });
      }
    });
    if (genericForecast.length > 0) result.forecast = genericForecast;
  }

  // 页面内嵌的天气元信息（调试用）
  const metaInfo: any = {};
  document.querySelectorAll('script').forEach((script) => {
    const text = script.textContent || '';
    if (text.includes('weather') && text.length < 5000) {
      try {
        const jsonMatch = text.match(/({[^}]*"weather"[^}]*})/);
        if (jsonMatch) metaInfo.weatherJson = JSON.parse(jsonMatch[1]);
      } catch { /* 忽略非 JSON 内容 */ }
    }
  });
  result.rawData = metaInfo;

  return result;
}

/**
 * 必应搜索页链接挑选函数（在起始页执行，禁止引用外部变量）
 * 由于 SEO 排名，中国天气网未必排在第一位，
 * 这里遍历所有搜索结果，返回第一个真实地址指向 weather.com.cn 的链接
 */
function pickWeatherSiteHref() {
  const anchors = document.querySelectorAll(
    '#b_results li.b_algo a[href], #b_results li.b_tpcn a[href]'
  );
  for (const a of anchors) {
    const href = a.getAttribute('href') || '';
    if (!href) continue;
    let real = href;
    // 必应跳转链接形如 /ck/a?...&u=a1<base64url>，解码出真实地址再判断域名
    const match = href.match(/[?&]u=a1([A-Za-z0-9_-]+)/);
    if (match) {
      try {
        real = atob(match[1].replace(/-/g, '+').replace(/_/g, '/'));
      } catch {
        real = href;
      }
    }
    // 精确匹配 weather.com.cn 及其子域（如 www.weather.com.cn）
    if (/^https?:\/\/([^/]+\.)?weather\.com\.cn\//i.test(real)) {
      return real;
    }
  }
  return '';
}

/* ===================== 主流程 ===================== */

/**
 * 通过 Puppeteer 爬取指定城市的天气数据
 * @param city 城市名
 * @param config 运行期配置（crawler 无需凭据，仅用 timeout）
 */
async function fetchFromCrawler(city: string, config: any): Promise<WeatherData> {
  const crawlResult = await crawlPage({
    url: `https://cn.bing.com/search?q=${encodeURIComponent(city + '天气')}`,
    pickHref: pickWeatherSiteHref,
    clickSelector: [
      '#b_results > li > div.b_tpcn > a',
      '#b_results li.b_algo a',
      '#b_results li:first-child a',
    ],
    extract: extractWeatherFromPage,
    saveHtml: true,
    saveName: city,
    timeout: Math.max(config.timeout ?? 15000, 45000), // 爬虫链路天然慢，下限 45s
  });

  if (!crawlResult.success) {
    throw new Error(`爬取失败: ${crawlResult.reason || '未知原因'}`);
  }

  const raw: any = crawlResult.extracted;
  if (!isValidWeatherData(raw)) {
    throw new Error('页面抽取结果无效（结构可能已变更）');
  }

  const forecast: ForecastDay[] = (raw.forecast || []).map((day: any) => ({
    ...day,
    icon: normalizeCondition(day.description || ''),
  }));

  // 能力清单：按实际抽到内容的字段裁剪
  const capabilities: WeatherCapability[] = PROVIDER_CAPABILITIES.crawler.filter((cap) => {
    if (cap === 'indices.life') return (raw.indices || []).length > 0;
    if (cap === 'alert.warning') return (raw.warnings || []).length > 0;
    if (cap.startsWith('forecast.daily')) return forecast.length > 0;
    if (cap === 'forecast.dailyWind') return forecast.some((d) => d.windDirection || d.windPower);
    if (cap === 'current.visibility') return typeof raw.visibility === 'number' && raw.visibility > 0;
    return true;
  });

  const data: WeatherData = {
    /* ---- 基础字段 ---- */
    temperature: raw.temperature ?? 0,
    feelsLike: raw.feelsLike || raw.temperature || 0,
    description: raw.description || '未知',
    humidity: raw.humidity ?? 0,
    windDirection: raw.windDirection || '未知',
    windSpeed: raw.windSpeed || '未知',
    visibility: raw.visibility ?? 10,
    updateTime: Date.now(),
    forecast,
    city: raw.city || city,
    condition: normalizeCondition(raw.description || ''),

    /* ---- 扩展字段 ---- */
    source: '中国天气网',
    capabilities,
    indices: (raw.indices || []).length ? raw.indices : undefined,
    warnings: (raw.warnings || []).length ? raw.warnings : undefined,
  };

  return data;
}

/** 内置爬虫 Provider（最后一层兜底） */
export const crawlerProvider: WeatherProvider = {
  id: 'crawler',
  label: '中国天气网（爬虫）',
  zeroConfig: true,
  capabilities: PROVIDER_CAPABILITIES.crawler,
  configSchema: [],
  fetch: fetchFromCrawler,

  /** 连通性自检：爬一次北京 */
  async probe(config) {
    try {
      const result = await crawlPage({
        url: 'https://cn.bing.com/search?q=' + encodeURIComponent('北京天气'),
        pickHref: pickWeatherSiteHref,
        extract: () => ({ ok: !!document.querySelector('#hidden_title') }),
        timeout: Math.max(config.timeout ?? 15000, 45000),
      });
      if (!result.success) return { ok: false, message: `爬取失败: ${result.reason}` };
      const extracted = result.extracted as { ok?: boolean } | undefined;
      return extracted?.ok
        ? { ok: true, message: `连接正常，耗时 ${result.elapsed}ms` }
        : { ok: true, message: `可访问但结构可能已变化（耗时 ${result.elapsed}ms）` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
};
