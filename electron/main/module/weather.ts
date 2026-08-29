import { ipcMain } from "electron";
import colors from "colors";
import { win } from "./mainWindow.ts";
import { crawlPage } from "./crawler.ts";

/**
 * 天气模块（基于【新爬虫】工具 crawler.ts 重写）
 *
 * 爬取链路：
 * 1. 打开必应搜索「{城市名}天气」
 * 2. 点击搜索结果第一条（自动兼容本页跳转 / 新标签页两种行为）
 * 3. 等待目标页面网络空闲并完成真实性校验（是否真的跳转、内容是否充实）
 * 4. 在页面上下文抽取天气数据
 * 5. 归一化天气现象类型 → 校验有效性 → 写缓存 → 返回
 *
 * 每次爬取的原始网页 HTML 由 crawler.ts 统一落盘到项目 cache-data 文件夹。
 */

/** 天气缓存容器：键为小写城市名 */
const WEATHER_CACHE: Record<string, { data: any; timestamp: number }> = {};
/** 缓存有效期：2 小时 */
const CACHE_DURATION = 2 * 60 * 60 * 1000;

/**
 * 天气现象类型（归一化枚举）
 * 供渲染端驱动图标选择与动态背景主题
 */
export type WeatherCondition =
  | 'sunny'     // 晴
  | 'cloudy'    // 多云
  | 'overcast'  // 阴
  | 'rain'      // 雨
  | 'snow'      // 雪
  | 'thunder'   // 雷暴
  | 'fog'       // 雾
  | 'haze'      // 霾 / 沙尘
  | 'wind'      // 大风
  | 'unknown';  // 未知

interface WeatherData {
  temperature: number;
  feelsLike: number;
  description: string;
  humidity: number;
  windDirection: string;
  windSpeed: string;
  visibility: number;
  updateTime: number;
  forecast: ForecastDay[];
  city: string;
  /** 归一化天气现象类型 */
  condition: WeatherCondition;
  /** 生活指数列表（来源站支持时返回） */
  indices: WeatherIndex[];
  /** 数据来源站名称（如「中国天气网」，可选） */
  source?: string;
}

/** 生活指数（源自中国天气网：穿衣/洗车/紫外线/运动/感冒/过敏等） */
interface WeatherIndex {
  /** 指数名称（不含「指数」后缀，如「穿衣」「洗车」） */
  name: string;
  /** 等级（如「炎热」「不宜」「最弱」） */
  level: string;
  /** 建议文案 */
  tip: string;
}

interface ForecastDay {
  date: string;
  high: number;
  low: number;
  description: string;
  /** 归一化天气现象类型（由当日描述推导） */
  icon: string;
  /** 风向（如「东风转东南风」，可选） */
  windDirection?: string;
  /** 风力等级（如「<3级」，可选） */
  windPower?: string;
}

/**
 * 天气现象关键词映射表
 * 顺序即匹配优先级：雷暴 > 雪 > 雨 > 雾 > 霾 > 风 > 晴 > 阴 > 多云
 * 例如「雷阵雨」会优先命中雷暴，「雨夹雪」会优先命中雪
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
function normalizeCondition(desc: string): WeatherCondition {
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
 * 判断爬取解析结果是否为有效天气数据
 * 温度 / 描述 / 湿度 / 预报 至少命中两项才视为有效，避免把「全默认值」的空页面当成功
 * @param data 页面抽取出的天气数据
 * @returns 有效返回 true，无效返回 false
 */
function isValidWeatherData(data: any): boolean {
  if (!data) return false;
  const hasTemp = typeof data.temperature === 'number' && data.temperature !== 0;
  const hasDesc = !!data.description && data.description !== '未知';
  const hasHumidity = typeof data.humidity === 'number' && data.humidity > 0;
  const hasForecast = Array.isArray(data.forecast) && data.forecast.length > 0;
  return [hasTemp, hasDesc, hasHumidity, hasForecast].filter(Boolean).length >= 2;
}

/**
 * 页面上下文天气抽取函数（由 crawlPage 在浏览器内执行）
 * 注意：该函数会被序列化后注入页面，禁止引用任何外部变量
 *
 * 解析策略：优先适配「中国天气网 weather.com.cn」的稳定结构（必应第一条结果的主流天气站），
 * 未命中时回退到通用选择器扫描。
 * @returns 解析出的天气数据对象
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

  // —— 生活指数（中国天气网：li > span 等级 + em 名称 + p 建议）——
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
    indexMap[name] = {
      name: name.replace(/指数$/, ''),
      level: level,
      tip: tip,
    };
  });
  result.indices = Object.values(indexMap);

  // —— 7 天预报（中国天气网：ul.t > li；含日期/现象/高低温/风向/风力）——
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
        date: date,
        high: parseInt(high) || 0,
        low: parseInt(low) || 0,
        description: desc,
        icon: '',
        windDirection: windDirs.join('转'),
        windPower: windPower,
      });
    }
  });

  // 预报命中中国天气网结构：当日风向/风力回填主字段
  if (forecastList.length > 0) {
    result.forecast = forecastList;
    const today = forecastList[0];
    if (today.windDirection) result.windDirection = today.windDirection;
    if (today.windPower) result.windSpeed = today.windPower;
  }

  // —— 通用结构兜底（非中国天气网页面时使用）——
  if (!hiddenTitle) {
    // 当前温度
    const tempElements = document.querySelectorAll('[class*="temp"], [class*="temperature"], .tem span, .temperature');
    for (const el of tempElements) {
      const text = el.textContent || '';
      const match = text.match(/(-?\d+)/);
      if (match) {
        result.temperature = parseInt(match[1]);
        break;
      }
    }

    // 天气描述
    const descElements = document.querySelectorAll('[class*="desc"], [class*="weather"], .wea, .weather');
    for (const el of descElements) {
      const text = el.textContent || '';
      if (text && text.length > 0 && text.length < 20) {
        result.description = text.trim();
        break;
      }
    }

    // 体感温度
    const feelsLikeElements = document.querySelectorAll('[class*="feels"], [class*="体感"], .tem i');
    for (const el of feelsLikeElements) {
      const text = el.textContent || '';
      const match = text.match(/(-?\d+)/);
      if (match) {
        result.feelsLike = parseInt(match[1]);
        break;
      }
    }

    // 湿度
    const humidityElements = document.querySelectorAll('[class*="humidity"], [class*="湿度"], .shidu');
    for (const el of humidityElements) {
      const text = el.textContent || '';
      const match = text.match(/(\d+)%/);
      if (match) {
        result.humidity = parseInt(match[1]);
        break;
      }
    }

    // 风向 / 风力
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

    // 城市名
    const cityElements = document.querySelectorAll('h1, .city, [class*="city"], .crumbs a:last-child');
    for (const el of cityElements) {
      const text = el.textContent || '';
      if (text && text.length > 0) {
        result.city = text.trim();
        break;
      }
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
        genericForecast.push({
          date: date.trim(),
          high: high,
          low: low,
          description: desc.trim(),
          icon: '',
        });
      }
    });
    if (genericForecast.length > 0) {
      result.forecast = genericForecast;
    }
  }

  // 页面内嵌的天气元信息（调试用）
  const metaInfo: any = {};
  document.querySelectorAll('script').forEach((script) => {
    const text = script.textContent || '';
    if (text.includes('weather') && text.length < 5000) {
      try {
        const jsonMatch = text.match(/({[^}]*"weather"[^}]*})/);
        if (jsonMatch) {
          metaInfo.weatherJson = JSON.parse(jsonMatch[1]);
        }
      } catch { /* 忽略非 JSON 内容 */ }
    }
  });
  result.rawData = metaInfo;

  return result;
}

/**
 * 必应搜索页链接挑选函数（由 crawlPage 在起始页执行，禁止引用外部变量）
 * 由于 SEO 排名原因，中国天气网未必排在结果第一位，
 * 这里遍历所有搜索结果，返回第一个真实地址指向 weather.com.cn 的链接
 * @returns 目标 URL（未找到返回空串，由调用方回退到点击第一条的逻辑）
 */
function pickWeatherSiteHref() {
  // 结果标题/条目链接（b_tpcn 为标题链接容器，b_algo 为结果条目）
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

/**
 * 通过【新爬虫】获取指定城市的天气数据（带 2 小时内存缓存）
 * @param cityName 城市名
 * @param forceRefresh 是否强制刷新（跳过缓存）
 * @returns 成功返回天气数据，失败返回 null（失败原因打印到主进程日志）
 */
async function getWeather(cityName: string, forceRefresh: boolean = false): Promise<WeatherData | null> {
  const cacheKey = cityName.toLowerCase();

  // 命中缓存直接返回
  if (!forceRefresh && WEATHER_CACHE[cacheKey]) {
    const now = Date.now();
    if (now - WEATHER_CACHE[cacheKey].timestamp < CACHE_DURATION) {
      console.log(`使用主进程缓存: ${cityName}`);
      return WEATHER_CACHE[cacheKey].data;
    }
  }

  // 链路：必应搜索「xx天气」→ 挑选第一个中国天气网链接进入（无则点击第一条结果）
  // → 等待加载 → 页面内抽取天气数据（含生活指数/风向风力）
  const crawlResult = await crawlPage({
    url: `https://cn.bing.com/search?q=${encodeURIComponent(cityName + '天气')}`,
    // 优先：在结果列表中挑选第一个中国天气网链接（规避 SEO 排名干扰）
    pickHref: pickWeatherSiteHref,
    // 兜底：未找到中国天气网链接时按序尝试点击第一条真实搜索结果
    clickSelector: [
      '#b_results > li > div.b_tpcn > a',
      '#b_results li.b_algo a',
      '#b_results li:first-child a',
    ],
    extract: extractWeatherFromPage,
    saveHtml: true,
    saveName: cityName,
    timeout: 45000,
  });

  // 爬虫真实性校验失败：直接失败并记录原因
  if (!crawlResult.success) {
    console.error(`天气爬取失败: ${cityName}, 原因: ${crawlResult.reason}`);
    return null;
  }

  // 解析结果有效性校验
  const data = crawlResult.extracted;
  if (!isValidWeatherData(data)) {
    console.error(`天气数据无效: ${cityName}, 抽取结果: ${JSON.stringify(data).substring(0, 200)}`);
    return null;
  }

  // 补充归一化天气现象类型（当前天气 + 每日预报），驱动渲染端图标与背景主题
  const weatherData: WeatherData = {
    ...data,
    condition: normalizeCondition(data.description),
    updateTime: Date.now(),
  };
  (weatherData.forecast || []).forEach((day: ForecastDay) => {
    day.icon = normalizeCondition(day.description);
  });

  // 写入主进程缓存
  WEATHER_CACHE[cacheKey] = {
    data: weatherData,
    timestamp: Date.now(),
  };
  console.log(colors.bgGreen(`天气获取成功: ${cityName}, 来源页: ${crawlResult.url}`));
  return weatherData;
}

/**
 * 注册天气模块 IPC 通道
 * 通道契约与旧版保持一致，渲染端无需改动：
 * - get-weather（invoke，{city, forceRefresh?}）→ WeatherData | null | {error}
 * - get-weather-broadcast（on，cityName）→ 主进程广播 get-weather-broadcast-reply
 */
export function initWeather() {
  ipcMain.handle("get-weather", async (event, params: { city: string; forceRefresh?: boolean }) => {
    try {
      const cityName = typeof params === 'string' ? params : params.city;
      const forceRefresh = typeof params === 'object' ? params.forceRefresh || false : false;
      return await getWeather(cityName, forceRefresh);
    } catch (error) {
      console.error("天气API处理失败:", error);
      return { error: (error as Error).message };
    }
  });

  ipcMain.on("get-weather-broadcast", async (event, cityName: string) => {
    try {
      const result = await getWeather(cityName);
      if (win && !win.isDestroyed()) {
        win.webContents.send("get-weather-broadcast-reply", result);
      }
    } catch (error) {
      console.error("天气广播处理失败:", error);
    }
  });
}
