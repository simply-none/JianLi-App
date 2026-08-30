/**
 * 数据获取模块 - 任务配置默认值工厂
 * ------------------------------------------------------------------
 * 新建任务 / 空状态时提供合理的缺省配置，避免用户从零摸索。
 */
import type { ScrapeConfig, FieldRule } from '../types'

/**
 * 创建一条空白字段规则
 * @returns 字段规则对象
 */
export function createEmptyRule(): FieldRule {
  return {
    field: '',
    selector: '',
    attr: 'text',
    optional: true,
    multiple: false,
    transforms: [],
  }
}

/**
 * 创建默认任务配置（含示例规则，可演示「豆瓣电影 Top250」式列表页采集）
 * @returns 默认配置对象
 */
export function createDefaultConfig(): ScrapeConfig {
  return {
    name: `采集任务 ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    url: '',
    source: 'dom',
    wait: {
      until: 'domcontentloaded',
      selector: '',
      selectorTimeout: 10000,
      settleMs: 800,
    },
    itemSelector: '',
    rules: [createEmptyRule()],
    actions: [],
    capture: {
      urlPattern: '',
      method: '',
      dataPath: '',
      maxCount: 50,
    },
    pagination: {
      type: 'none',
      next: '',
      pageParam: 'page',
      startPage: 1,
      maxPages: 1,
      scrollTimes: 5,
      scrollWaitMs: 1000,
    },
    antiCrawl: {
      userAgent: '',
      viewport: { width: 1920, height: 1080 },
      blockResources: ['image', 'font', 'media'],
      delayMs: [500, 1500],
      loginProfile: '',
    },
    output: {
      htmlSnapshot: false,
      screenshot: false,
      maxRecords: 0,
    },
  }
}
