export const presets = {
  sumi: '#1C1C1C',
  gofun: '#FFFFFB',
  byakuroku: '#A8D8B9',
  mizu: '#81C7D4',
  asagi: '#33A6B8',
  ukon: '#EFBB24',
  mushikuri: '#D9CD90',
  hiwa: '#BEC23F',
  ichigo: '#B5495B',
  kurenai: '#CB1B45',
  syojyohi: '#E83015',
  konjyo: '#113285',
  fuji: '#8B81C3',
  ayame: '#6F3381',
  torinoko: '#DAC9A6',
  kurotsurubami: '#0B1013',
  ohni: '#F05E1C',
  kokikuchinashi: '#FB9966',
  beniukon: '#E98B2A',
  sakura: '#FEDFE1',
  toki: '#EEA9A9',
}

export const colors = Object.keys(presets).map((color) => {
  return {
    name: color,
    value: presets[color as keyof typeof presets],
  }
})

/**
 * 1. 打开新页面：browser.newPage()
 * 2. 页面导航：page.goto(url)
 * 2. 元素定位：page.locator(selector)
 *    2.1 元素点击：locator.click()
 *    2.2 元素输入：locator.fill(text)
 *    2.3 元素获取文本：locator.textContent()
 *    2.4 元素悬停：locator.hover()
 *    2.5 元素滚动：locator.scroll({ scrollTop: 1000, scrollLeft: 0 })
 *    2.6 等待元素可见：locator.wait()
 *    2.7 元素过滤：locator.filter(callback)
 *    2.8 元素转JS：locator.map(callback).wait()
 *    2.9 返回elementHandle：(await locator.waitHandle()).click()
 *    2.10 元素定位配置：locatorsetEnsureElementIsInTheViewport(true),setVisibility('visible'),setWaitForEnabled(true),setWaitForStableBoundingBox(true)
 *    2.11 元素定位超时：locator.setTimeout(timeout)
 * 3. 等待元素在DOM中可用：page.waitForSelector(selector)
 * 4. 无需等待查询（已知元素存在）：page.$(selector)单个，page.$$(selector)所有，
 * 5. 监听网络请求：page.on('request', request => {}),page.on('response', response => {})
 */

export const selectType = ([
  // 打开新页面
  {
    label: "打开新页面",
    value: 'newPage',
  },
  // 关闭当前页面
  {
    label: "关闭当前页面",
    value: 'closePage',
  },
  // 关闭浏览器
  {
    label: "关闭浏览器",
    value: 'close',
  },
  // 页面导航
  {
    label: "页面导航",
    value: 'goto',
  },
  // 选取元素
  {
    label: "选取元素",
    value: 'locator',
  },
  // 监听网络请求
  {
    label: "监听网络请求",
    value: 'request',
  },
  {
    label: "监听网络响应",
    value: 'response',
  },
  // 等待
  {
    label: "等待",
    value: 'wait',
  },
  // 执行脚本
  {
    label: "执行脚本",
    value: 'evaluate',
  },
  // 截图
  {
    label: "截图",
    value: 'screenshot',
  },
  // 生成pdf
  {
    label: "生成pdf",
    value: 'generatePdf',
  },
  // 写入数据
  {
    label: "写入数据",
    value: 'writeData',
  },
  // 获取数据
  {
    label: "获取数据",
    value: 'getData',
  },
])

export const elementStepOptions = ([
  {
    label: "点击",
    value: 'click',
  },
  {
    label: "输入",
    value: 'fill',
  },
  {
    label: "获取文本",
    value: 'textContent',
  },
  {
    label: "悬停",
    value: 'hover',
  },
  {
    label: "滚动",
    value: 'scroll',
  },
  {
    label: "等待可见",
    value: 'wait',
  },
  {
    label: "过滤",
    value: 'filter',
  },
  {
    label: "元素转JS",
    value: 'map',
  },
  {
    label: "返回elementHandle",
    value: 'waitHandle',
  },
  {
    label: "元素定位配置",
    value: 'setEnsureElementIsInTheViewport',
  },
  {
    label: "元素定位超时",
    value: 'setTimeout',
  },
])