# 天气爬虫逻辑改造方案 - 必应搜索

## 需求分析

用户要求改变天气处理逻辑，使用必应搜索获取天气数据：
1. 打开空白页
2. 使用必应搜索 "xxx天气"
3. 打开第一个搜索结果页面
4. 返回页面结果
5. 将结果写入当前文件夹以供分析

## 改造方案

### 核心思路

使用 Puppeteer 模拟浏览器操作，通过必应搜索获取天气页面，解析后返回数据并保存到文件。

### 文件修改

**修改文件**: `electron/main/module/weather.ts`

### 改造步骤

1. **简化天气数据接口** - 保留核心字段
2. **新增必应搜索函数** - 通过必应搜索城市天气
3. **新增页面解析函数** - 解析搜索结果页面获取天气数据
4. **新增数据保存函数** - 将原始HTML和解析数据写入文件
5. **修改主获取函数** - 使用必应搜索流程
6. **保留缓存机制** - 2小时缓存

### 实现细节

#### 步骤1: 打开空白页
```typescript
await page.goto('about:blank');
```

#### 步骤2: 访问必应搜索
```typescript
const searchUrl = `https://cn.bing.com/search?q=${encodeURIComponent(cityName + '天气')}`;
await page.goto(searchUrl);
```

#### 步骤3: 获取第一个搜索结果链接
```typescript
// 查找包含天气关键词的链接
const weatherUrl = await page.evaluate(() => {
  const links = document.querySelectorAll('a');
  for (const link of links) {
    const href = link.getAttribute('href');
    if (href && href.includes('weather')) {
      return href;
    }
  }
  return null;
});
```

#### 步骤4: 打开天气页面并解析
```typescript
await page.goto(weatherUrl);
const weatherData = await page.evaluate(() => {
  // 解析页面数据
});
```

#### 步骤5: 保存到文件
```typescript
import fs from 'fs';
import path from 'path';

// 保存原始HTML
fs.writeFileSync(path.join(__dirname, 'weather_raw.html'), html);
// 保存解析数据
fs.writeFileSync(path.join(__dirname, 'weather_data.json'), JSON.stringify(data, null, 2));
```

### 风险处理

1. **必应搜索结果结构变化** - 增加多种选择器方案
2. **网络超时** - 增加超时重试机制
3. **页面加载不完整** - 增加等待时间和重试

### 预期效果

- 通过必应搜索获取天气，更稳定可靠
- 数据保存到文件，便于分析和调试
- 保留原有缓存机制，减少重复请求

## 通知用户

请确认此方案是否符合预期。