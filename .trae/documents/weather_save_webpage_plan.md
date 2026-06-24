# 天气爬虫保存搜索页面到桌面方案

## 需求分析

完成第78行的TODO：将必应搜索结果页面保存到桌面，文件名以 `test-` 开头，后面跟上时间戳。

## 实现方案

### 核心思路

在爬虫流程中，访问必应搜索后、点击第一个结果之前，获取当前页面HTML并保存到桌面。

### 文件修改

**修改文件**: `electron/main/module/weather.ts`

### 实现步骤

1. **获取桌面路径** - 使用 `app.getPath('desktop')` 获取用户桌面路径
2. **生成文件名** - `test-{时间戳}.html`
3. **获取页面HTML** - 使用 `page.content()` 获取当前页面内容
4. **保存到文件** - 使用 `fs.writeFileSync()` 写入桌面

### 代码实现

```typescript
// 在等待2秒后，保存搜索页面到桌面
await new Promise(resolve => setTimeout(resolve, 2000));

// 获取当前页面HTML并保存到桌面
const searchHtml = await page.content();
const desktopPath = app.getPath('desktop');
const timestamp = Date.now();
const fileName = `test-${timestamp}.html`;
const filePath = path.join(desktopPath, fileName);
fs.writeFileSync(filePath, searchHtml);
console.log(`搜索页面已保存到桌面: ${filePath}`);
```

### 注意事项

1. 需要导入 `app` 模块：`import { ipcMain, app } from "electron";`
2. 文件路径需要使用 `path.join()` 处理跨平台兼容性

## 通知用户

请确认此方案是否符合预期。