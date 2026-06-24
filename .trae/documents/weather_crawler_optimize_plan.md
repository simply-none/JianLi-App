# 天气爬虫逻辑优化方案

## 需求分析

当前 `weather.ts` 中的爬虫逻辑存在问题：
1. `bingSearchWeather` 和 `fetchWeatherData` 各自独立启动浏览器，造成资源浪费
2. 应该在同一个浏览器窗口中逐步操作：打开必应搜索 → 点击第一个搜索结果 → 获取天气页面数据
3. 搜索结果选择器明确为：`#b_results` 下第一个 `li` 下的 `a` 标签
4. 不需要关闭再打开页面

## 改造方案

### 核心思路

合并两个函数为一个流程，在同一个浏览器实例中完成：
1. 启动浏览器 → 打开必应搜索
2. 点击第一个搜索结果链接（`#b_results > li:first-child > a`）
3. 获取天气页面HTML和数据
4. 保存到文件
5. 关闭浏览器

### 文件修改

**修改文件**: `electron/main/module/weather.ts`

### 改造步骤

1. **合并 `bingSearchWeather` 和 `fetchWeatherData` 函数** - 使用同一个浏览器实例
2. **修改选择器** - 使用 `#b_results > li:first-child > a` 定位第一个搜索结果
3. **使用 `click()` 方法** - 模拟点击跳转，而非重新打开页面
4. **保留数据保存功能** - 将HTML和解析数据写入文件
5. **保留缓存机制** - 2小时缓存

### 实现细节

```typescript
async function getWeather(cityName: string): Promise<WeatherData | null> {
  let browser: puppeteer.Browser | null = null;
  try {
    // 1. 启动浏览器
    browser = await puppeteer.launch({ headless: true, ... });
    
    // 2. 打开必应搜索
    const page = await browser.newPage();
    await page.goto(`https://cn.bing.com/search?q=${encodeURIComponent(cityName + '天气')}`);
    
    // 3. 等待搜索结果加载并点击第一个链接
    await page.waitForSelector('#b_results > li:first-child > a', { timeout: 10000 });
    await page.click('#b_results > li:first-child > a');
    
    // 4. 等待天气页面加载
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // 5. 获取页面HTML和解析数据
    const [html, weatherData] = await Promise.all([
      page.content(),
      page.evaluate(() => { /* 解析逻辑 */ })
    ]);
    
    // 6. 保存到文件
    saveWeatherDataToFile(cityName, html, weatherData);
    
    // 7. 关闭浏览器
    await browser.close();
    
    return weatherData;
  } catch (error) {
    // 错误处理
  }
}
```

### 风险处理

1. **选择器变化** - 增加备选选择器方案
2. **点击后页面跳转超时** - 增加超时处理
3. **页面加载不完整** - 增加等待时间

### 预期效果

- 减少浏览器实例创建，提高性能
- 模拟真实用户操作，降低被反爬拦截风险
- 代码逻辑更清晰，易于维护

## 通知用户

请确认此方案是否符合预期。