# 天气爬虫保存HTML数据错误修复方案

## 问题分析

当前代码在点击搜索结果后，保存的页面数据仍然是搜索页的数据，而不是天气页面的数据。

**根本原因**：
1. `locatorStep` 中 `click` 操作使用 `page.evaluate()` 执行，这是异步操作但没有等待页面导航完成
2. 点击后立即执行 `wait` 和 `saveHtml`，此时页面可能还未完成跳转
3. 缺少 `page.waitForNavigation()` 来等待页面跳转

## 修复方案

### 文件修改

**修改文件**: `electron/main/module/weather.ts`

### 改造步骤

1. **修改 `locatorStep` 函数** - 在 `click` 操作后添加页面导航等待
2. **优化步骤流程** - 移除多余的 `wait`，确保导航完成后再保存数据

### 实现细节

#### 步骤1: 修改 `locatorStep` 函数
```typescript
async function locatorStep(mystep: any, page: puppeteer.Page) {
  let locator = await page.waitForSelector(mystep.selector);

  if (!mystep.elementSteps || mystep.elementSteps.length === 0) {
    return;
  }

  for (const step of mystep.elementSteps) {
    switch (step.action) {
      case 'click':
        // 使用 Promise.all 同时执行点击和等待导航
        await Promise.all([
          page.evaluate((selector) => {
            (document.querySelector(selector) as HTMLElement).click();
          }, mystep.selector),
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 })
        ]);
        break;
      // ...其他操作
    }
  }
}
```

#### 步骤2: 优化步骤流程
```typescript
const steps = [
  { handleType: 'newPage' },
  { handleType: 'goto', url: searchUrl },
  { handleType: 'wait', waitTime: 2000 },
  { handleType: 'saveHtml', filename: `test-${Date.now()}_search.html` },
  {
    handleType: 'locator',
    selector: '#b_results li:first-child a',
    elementSteps: [{ action: 'click' }],
  },
  // 移除这里的 wait，因为 click 操作已经包含了 waitForNavigation
  { handleType: 'saveHtml', filename: `test-${Date.now()}_weather.html` },
  { handleType: 'getData' },
  { handleType: 'close' },
];
```

## 通知用户

请确认此方案是否符合预期。