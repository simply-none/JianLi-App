# 天气页面缓存开关功能方案

## 需求分析

在天气页面新增一个开关，控制是否使用缓存：
- 默认开启缓存（使用现有2小时缓存机制）
- 关闭缓存时，强制请求新数据，跳过前端和主进程的缓存

## 实现方案

### 文件修改

**修改文件**: `src/views/weather/index.vue`

### 改造步骤

1. **新增缓存开关状态** - 添加 `useCache` ref 变量
2. **在模板中添加开关** - 在搜索区域添加 el-switch 组件
3. **修改 `loadWeatherByCity` 函数** - 根据开关状态决定是否使用前端缓存
4. **修改 `fetchWeather` 函数** - 传递 `useCache` 参数给主进程
5. **修改主进程接口** - 在 `get-weather` 处理中支持 `useCache` 参数

### 实现细节

#### 步骤1: 添加状态变量
```typescript
const useCache = ref(true);
```

#### 步骤2: 在模板中添加开关
```html
<el-switch
  v-model="useCache"
  active-text="使用缓存"
  inactive-text="不使用缓存"
  :active-value="true"
  :inactive-value="false"
/>
```

#### 步骤3: 修改 `loadWeatherByCity` 函数
```typescript
async function loadWeatherByCity(city: string) {
  loading.value = true;
  
  try {
    if (useCache.value) {
      const cached = getCachedWeather(city);
      if (cached) {
        weatherData.value = cached;
        return;
      }
    }
    
    const rawData = await fetchWeather(city, !useCache.value);
    // ...后续逻辑
  }
}
```

#### 步骤4: 修改 `fetchWeather` 函数
```typescript
async function fetchWeather(city: string, forceRefresh: boolean = false): Promise<any> {
  const result = await window.ipcRenderer.invoke('get-weather', { city, forceRefresh });
  // ...
}
```

#### 步骤5: 修改主进程 `weather.ts`
```typescript
ipcMain.handle("get-weather", async (event, params) => {
  const { cityName, forceRefresh } = params;
  
  if (!forceRefresh && WEATHER_CACHE[cacheKey]) {
    // 使用缓存
  }
  
  // 获取新数据
});
```

## 通知用户

请确认此方案是否符合预期。