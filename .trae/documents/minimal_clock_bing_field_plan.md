# 极简时钟 Bing 图片配置字段扩展计划

## 需求概述

为 `home-mode:minimal-clock` 配置新增两个字段：
- `useBing` (boolean): 是否使用 Bing 每日图片作为背景
- `date` (string): Bing 图片的日期（格式：YYYY-MM-DD）

### 功能逻辑
1. **选择 Bing 图片时**：`useBing` 设为 `true`，保存图片 URL、日期等信息到数据库
2. **初始化加载时**：如果 `useBing` 为 `true`，自动请求最新日期的 Bing 图片
3. **日期更新时**：如果最新日期与存储日期不一致，自动更新为新的 Bing 图片并保存配置

## 当前状态分析

### 现有配置结构
```ts
{
  type: 'gradient' | 'image' | 'custom',
  value: string,           // 背景值
  customUrl?: string,      // 自定义图片 URL
  bingTitle?: string       // Bing 图片标题（已有）
}
```

### 主进程 Bing 模块
- 文件：`electron/main/module/bing.ts`
- 当前返回：`{ url, title, copyright }`
- 缺少：日期字段 `date`

### 渲染进程逻辑
- 加载配置：`loadBackgroundConfig()` - 仅读取 type 和 value
- 选择 Bing 图片：`selectBingImage()` - 仅保存 type 和 value
- 获取 Bing 图片：`fetchBingImage()` - 每次挂载都调用，不检查配置

## 实现方案

### 1. 主进程 bing.ts 修改

**新增返回字段**：
- `date`: string - Bing 图片的日期（从 API 返回的 `startdate` 字段获取，格式化为 YYYY-MM-DD）

**BingImage 接口扩展**：
```ts
interface BingImage {
  url: string;
  title: string;
  copyright: string;
  date: string;  // 新增：YYYY-MM-DD
}
```

### 2. 渲染进程 minimalClock.vue 修改

#### 配置结构扩展
```ts
{
  type: 'gradient' | 'image' | 'custom',
  value: string,
  useBing?: boolean,     // 新增：是否使用 Bing 图片
  date?: string,         // 新增：Bing 图片日期
  customUrl?: string,
  bingTitle?: string
}
```

#### loadBackgroundConfig() 修改
加载配置后检查：
- 如果 `useBing === true`：
  - 比较存储的 `date` 与今天日期
  - 如果不一致或没有 date，调用 `fetchBingImage()` 获取最新图片
  - 更新背景并保存新配置

#### selectBingImage() 修改
保存时新增字段：
- `useBing: true`
- `date: bingImageDate`（从主进程获取的日期）

#### onMounted 逻辑调整
- 先调用 `loadBackgroundConfig()`
- 然后如果配置中 `useBing` 为 true，则触发 Bing 图片更新检查
- 如果 `useBing` 为 false，则不主动请求 Bing 图片（或延迟请求以支持用户后续选择）

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `electron/main/module/bing.ts` | BingImage 接口新增 date 字段，fetchBingImage 返回日期 |
| `src/views/home/minimalClock.vue` | 配置结构扩展、加载逻辑修改、选择逻辑修改、初始化逻辑调整 |

## 详细实现步骤

### 步骤 1: 修改主进程 bing.ts
1. 扩展 `BingImage` 接口，新增 `date` 字段
2. 在 `fetchBingImage` 中从 API 返回数据提取 `startdate`（格式 YYYYMMDD）
3. 将日期格式化为 `YYYY-MM-DD`
4. 返回时带上 `date` 字段

### 步骤 2: 修改 minimalClock.vue 数据
1. 新增 `bingImageDate` ref 存储当前 Bing 图片日期
2. 新增 `isUseBing` ref 存储是否使用 Bing 图片（从配置读取）

### 步骤 3: 修改 loadBackgroundConfig()
1. 读取配置中的 `useBing` 和 `date` 字段
2. 如果 `useBing === true`：
   - 设置 `isUseBing.value = true`
   - 记录存储的日期
   - 不立即应用，等待 fetchBingImage 后比较日期

### 步骤 4: 修改 fetchBingImage()
1. 获取结果后，保存 `bingImageDate.value = result.date`
2. 如果 `isUseBing.value === true`：
   - 比较获取的日期与配置中存储的日期
   - 如果日期不同或配置中没有日期：
     - 更新背景为新的 Bing 图片
     - 保存新配置（更新 date 字段）
   - 如果日期相同：
     - 保持当前背景不变（使用配置中缓存的 value）

### 步骤 5: 修改 selectBingImage()
1. 设置 `isUseBing.value = true`
2. 保存配置时新增：
   - `useBing: true`
   - `date: bingImageDate.value`

### 步骤 6: 修改 selectBackground() 和 removeCustomBackground()
1. 选择非 Bing 背景时，设置 `useBing: false`
2. 保存配置时清除 `useBing` 和 `date` 字段（或设为 false/undefined）

### 步骤 7: 调整 onMounted 执行顺序
1. `loadBackgroundConfig()` - 先加载配置
2. `fetchBingImage()` - 再获取 Bing 图片（内部会根据 useBing 决定是否更新背景）

## 验证步骤

1. 选择 Bing 图片作为背景
2. 检查 `home-mode:minimal-clock` 存储中是否包含 `useBing: true` 和 `date` 字段
3. 刷新页面，验证背景自动加载 Bing 图片
4. 模拟日期变更（或修改存储日期），验证是否自动获取新图片
5. 切换到其他背景，验证 `useBing` 变为 false
6. TypeScript 类型检查: `npx tsc --noEmit`

## 风险与注意事项

1. **日期格式统一**：确保主进程和渲染进程使用相同的日期格式（YYYY-MM-DD）
2. **网络失败处理**：如果获取 Bing 图片失败，应保留上一次的背景，不要清空
3. **性能优化**：非 Bing 模式下也可以延迟获取 Bing 图片，避免不必要的网络请求
4. **配置兼容**：旧配置没有 `useBing` 字段时应正常工作，默认值为 false
