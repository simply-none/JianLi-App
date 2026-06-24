import { ipcMain, app } from "electron";
import puppeteer from "puppeteer";
import axios from "axios";
import colors from "colors";
import { win } from "./mainWindow.ts";
import fs from "fs";
import path from "path";

const WEATHER_CACHE: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 2 * 60 * 60 * 1000;

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
}

interface ForecastDay {
  date: string;
  high: number;
  low: number;
  description: string;
  icon: string;
}

function saveWeatherDataToFile(cityName: string, html: string, data: any) {
  const desktopPath = app.getPath('desktop');
  const baseDir = path.join(desktopPath, './weather_debug');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const timestamp = Date.now();
  const dateStr = new Date(timestamp).toISOString().replace(/[:.]/g, '-');

  const htmlPath = path.join(baseDir, `${cityName}_${dateStr}_raw.html`);
  const jsonPath = path.join(baseDir, `${cityName}_${dateStr}_data.json`);

  fs.writeFileSync(htmlPath, html);
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

  console.log(`天气数据已保存: ${htmlPath}`);
  console.log(`解析数据已保存: ${jsonPath}`);
}

async function crawlWeather(cityName: string): Promise<WeatherData | null> {
  let browser: puppeteer.Browser | null = null;
  let page: puppeteer.Page | null = null;

  try {
    const commonParams = {
      headless: false,
      slowMo: 50,
      timeout: 300000,
      width: 1920,
      height: 1080,
    };

    browser = await puppeteer.launch({
      headless: commonParams.headless,
      slowMo: commonParams.slowMo,
      timeout: commonParams.timeout,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1920,1080",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ],
    });

    const searchUrl = `https://cn.bing.com/search?q=${encodeURIComponent(cityName + '天气')}`;

    const steps = [
      { handleType: 'newPage' },
      { handleType: 'goto', url: searchUrl },
      { handleType: 'wait', waitTime: 2000 },
      {
        handleType: 'saveHtml',
        filename: `test-${Date.now()}.html`,
      },
      {
        handleType: 'locator',
        selector: '#b_results  li:first-child  a',
        elementSteps: [{ action: 'click' }],
      },
      { handleType: 'wait', waitTime: 3000 },
      {
        handleType: 'saveHtml',
        filename: `test-${Date.now()}-1.html`,
      },
      { handleType: 'getData' },
      { handleType: 'close' },
    ];

    let weatherData: any = null;
    let weatherHtml: string = '';

    for (const stepa of steps) {
      const step = stepa.data || stepa;
      const handleType = step.handleType;

      switch (handleType) {
        case 'newPage':
          page = await browser.newPage();
          await page.setViewport({ width: commonParams.width, height: commonParams.height });
          await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
          await page.setExtraHTTPHeaders({
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          });
          break;

        case 'closePage':
          if (page) {
            await page.close();
            page = null;
          }
          break;

        case 'close':
          if (browser) {
            await browser.close();
            browser = null;
          }
          break;

        case 'goto':
          if (page) {
            await page.goto(step.url);
          }
          break;

        case 'locator':
          if (page) {
            await locatorStep(step, page);
            page = (await browser.pages())[1];
          }
          break;

        case 'wait':
          await delay(step.waitTime || 1000);
          break;

        case 'saveHtml':
          if (page) {
            const html = await page.content();
            const desktopPath = app.getPath('desktop');
            const filePath = path.join(desktopPath, step.filename);
            fs.writeFileSync(filePath, html);
            console.log(`搜索页面已保存到桌面: ${filePath}`);
          }
          break;

        case 'getData':
          if (page) {
            const [html, data] = await Promise.all([
              page.content(),
              page.evaluate(() => {
                const result: any = {
                  temperature: 0,
                  feelsLike: 0,
                  description: '未知',
                  humidity: 0,
                  windDirection: '未知',
                  windSpeed: '未知',
                  visibility: 10,
                  forecast: [],
                  city: '',
                  rawData: {},
                };

                const tempElements = document.querySelectorAll('[class*="temp"], [class*="temperature"], .tem span, .temperature');
                for (const el of tempElements) {
                  const text = el.textContent || '';
                  const match = text.match(/(-?\d+)/);
                  if (match) {
                    result.temperature = parseInt(match[1]);
                    break;
                  }
                }

                const descElements = document.querySelectorAll('[class*="desc"], [class*="weather"], .wea, .weather');
                for (const el of descElements) {
                  const text = el.textContent || '';
                  if (text && text.length > 0 && text.length < 20) {
                    result.description = text.trim();
                    break;
                  }
                }

                const feelsLikeElements = document.querySelectorAll('[class*="feels"], [class*="体感"], .tem i');
                for (const el of feelsLikeElements) {
                  const text = el.textContent || '';
                  const match = text.match(/(-?\d+)/);
                  if (match) {
                    result.feelsLike = parseInt(match[1]);
                    break;
                  }
                }

                const humidityElements = document.querySelectorAll('[class*="humidity"], [class*="湿度"], .shidu');
                for (const el of humidityElements) {
                  const text = el.textContent || '';
                  const match = text.match(/(\d+)%/);
                  if (match) {
                    result.humidity = parseInt(match[1]);
                    break;
                  }
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
                  if (text && text.length > 0) {
                    result.city = text.trim();
                    break;
                  }
                }

                const forecastElements = document.querySelectorAll('[class*="forecast"], .t > li, [class*="day"]');
                const forecastList: any[] = [];
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
                    forecastList.push({
                      date: date.trim(),
                      high: high,
                      low: low,
                      description: desc.trim(),
                      icon: '',
                    });
                  }
                });

                result.forecast = forecastList;

                const metaInfo: any = {};
                document.querySelectorAll('script').forEach(script => {
                  const text = script.textContent || '';
                  if (text.includes('weather') && text.length < 5000) {
                    try {
                      const jsonMatch = text.match(/({[^}]*"weather"[^}]*})/);
                      if (jsonMatch) {
                        metaInfo.weatherJson = JSON.parse(jsonMatch[1]);
                      }
                    } catch { }
                  }
                });
                result.rawData = metaInfo;

                return result;
              }),
            ]);
            weatherHtml = html;
            weatherData = data;
          }
          break;

        default:
          console.log(colors.bgRed('未处理的操作类型：'), handleType);
          break;
      }
    }

    if (weatherHtml && weatherData) {
      saveWeatherDataToFile(cityName, weatherHtml, weatherData);
    }

    return weatherData ? {
      ...weatherData,
      updateTime: Date.now(),
    } : null;

  } catch (error) {
    console.error("获取天气数据失败:", error);
    if (page) {
      try {
        await page.close();
      } catch { }
    }
    if (browser) {
      try {
        await browser.close();
      } catch { }
    }
    return null;
  }
}

async function locatorStep(mystep: any, page: puppeteer.Page) {
  let locator = await page.waitForSelector(mystep.selector);

  if (!mystep.elementSteps || mystep.elementSteps.length === 0) {
    return;
  }

  for (const step of mystep.elementSteps) {
    switch (step.action) {
      case 'click':
        await page.evaluate((selector) => {
          (document.querySelector(selector) as HTMLElement).click();
        }, mystep.selector);
        break;

      case 'fill':
        await page.locator(mystep.selector).fill(step.value);
        break;

      case 'hover':
        await locator.hover();
        break;

      case 'scroll':
        await locator.scroll({ scrollTop: step.scrollTop || 300, scrollLeft: step.scrollLeft || 300 });
        break;

      case 'wait':
        await delay(step.value || 1000);
        break;

      default:
        console.log(colors.bgRed('未处理的操作类型：'), step.action);
        break;
    }
  }
}

function delay(time: number) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

async function getWeather(cityName: string, forceRefresh: boolean = false): Promise<WeatherData | null> {
  const cacheKey = cityName.toLowerCase();

  if (!forceRefresh && WEATHER_CACHE[cacheKey]) {
    const now = Date.now();
    if (now - WEATHER_CACHE[cacheKey].timestamp < CACHE_DURATION) {
      console.log(`使用主进程缓存: ${cityName}`);
      return WEATHER_CACHE[cacheKey].data;
    }
  }

  const weatherData = await crawlWeather(cityName);
  if (weatherData) {
    WEATHER_CACHE[cacheKey] = {
      data: weatherData,
      timestamp: Date.now(),
    };
  }

  return weatherData;
}

export function initWeather() {
  ipcMain.handle("get-weather", async (event, params: { city: string; forceRefresh?: boolean }) => {
    try {
      const cityName = typeof params === 'string' ? params : params.city;
      const forceRefresh = typeof params === 'object' ? params.forceRefresh || false : false;
      const result = await getWeather(cityName, forceRefresh);
      console.log(result, 'result');
      return result;
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