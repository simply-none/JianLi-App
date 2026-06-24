# 天气爬虫步骤化改造方案

## 需求分析

参考 `apiTest.ts` 中 `spider-test` 的步骤化爬虫逻辑，重写 `weather.ts` 的天气爬虫。

### spider-test 核心特点

1. **浏览器连接方式**：支持连接已打开的浏览器（WebSocket）或启动新浏览器
2. **步骤化配置**：通过 `steps` 数组定义操作流程
3. **元素定位**：使用 `page.waitForSelector` 和 `locator` 方式
4. **操作类型**：`newPage`, `goto`, `locator`, `wait`, `evaluate`, `getData` 等
5. **元素操作**：`click`, `fill`, `hover`, `scroll`

## 改造方案

### 核心思路

将天气爬虫改为步骤化配置，模拟真实用户操作：
1. 打开新页面 → 访问必应搜索
2. 等待搜索结果 → 点击第一个链接
3. 等待页面跳转 → 获取天气数据
4. 关闭浏览器

### 文件修改

**修改文件**: `electron/main/module/weather.ts`

### 改造步骤

1. **导入必要模块** - puppeteer, axios, colors 等
2. **修改浏览器启动逻辑** - 支持连接已有浏览器或启动新浏览器
3. **定义步骤数组** - 模拟搜索和点击流程
4. **实现步骤执行逻辑** - 遍历步骤执行操作
5. **实现 locatorStep** - 元素定位和操作
6. **保留数据保存和缓存功能**

### 步骤定义示例

```typescript
const steps = [
  { handleType: 'newPage' },
  { handleType: 'goto', url: `https://cn.bing.com/search?q=${encodeURIComponent(cityName + '天气')}` },
  { handleType: 'wait', waitTime: 2000 },
  { 
    handleType: 'locator', 
    selector: '#b_results > li:first-child > a',
    elementSteps: [{ action: 'click' }]
  },
  { handleType: 'wait', waitTime: 3000 },
  { handleType: 'getData' },
  { handleType: 'close' },
];
```

### 实现细节

参考 `apiTest.ts` 中的 `spider-test` 监听逻辑，实现：
- 浏览器连接/启动
- 步骤遍历执行
- locatorStep 元素操作
- getData 数据提取

## 通知用户

请确认此方案是否符合预期。