<template>
  <div class="weather-page">
    <div class="search-section">
      <el-autocomplete
        v-model="searchQuery"
        :fetch-suggestions="fetchCitySuggestions"
        placeholder="输入城市名称搜索天气"
        class="search-input"
        :trigger-on-focus="false"
        @select="handleCitySelect"
      >
        <template #prefix>
          <LucideIcon name="Search" class="search-icon" />
        </template>
        <template #suffix>
          <el-button v-if="searchQuery" icon="Close" circle size="small" @click="searchQuery = ''" />
        </template>
      </el-autocomplete>
      <el-button type="primary" @click="searchWeather" :loading="loading">
        查询
      </el-button>
      <div class="cache-switch">
        <span>使用缓存</span>
        <el-switch v-model="useCache" />
      </div>
      <el-button type="warning" @click="toggleDebugPanel" size="small">
        {{ debugPanelVisible ? '隐藏调试' : '调试模式' }}
      </el-button>
    </div>

    <div v-if="historyList.length > 0" class="history-section">
      <div class="section-title">
        <LucideIcon name="Clock1" />
        <span>搜索历史</span>
        <el-button text size="small" @click="clearHistory">清除</el-button>
      </div>
      <div class="history-tags">
        <el-tag
          v-for="item in historyList"
          :key="item"
          closable
          @close="removeHistory(item)"
          @click="loadWeatherByCity(item)"
        >
          {{ item }}
        </el-tag>
      </div>
    </div>

    <div class="location-badge">
      <LucideIcon name="MapPin" />
      <span>{{ currentCity }}</span>
      <el-button text size="small" @click="locateAndLoad">重新定位</el-button>
    </div>

    <div v-if="weatherData" class="weather-content">
      <div class="weather-card main-card">
        <div class="weather-icon-large">
          <LucideIcon :name="weatherIconName" />
        </div>
        <div class="weather-info">
          <div class="temperature">{{ weatherData.temperature }}°C</div>
          <div class="weather-desc">{{ weatherData.description }}</div>
          <div class="update-time">更新于 {{ formatUpdateTime(weatherData.updateTime) }}</div>
        </div>
      </div>

      <div class="weather-grid">
        <div class="weather-card info-card">
          <div class="info-icon"><LucideIcon name="Sun" /></div>
          <div class="info-content">
            <div class="info-label">体感温度</div>
            <div class="info-value">{{ weatherData.feelsLike }}°C</div>
          </div>
        </div>
        <div class="weather-card info-card">
          <div class="info-icon"><LucideIcon name="Cloud" /></div>
          <div class="info-content">
            <div class="info-label">湿度</div>
            <div class="info-value">{{ weatherData.humidity }}%</div>
          </div>
        </div>
        <div class="weather-card info-card">
          <div class="info-icon"><LucideIcon name="Cloud" /></div>
          <div class="info-content">
            <div class="info-label">风力</div>
            <div class="info-value">{{ weatherData.windDirection }} {{ weatherData.windSpeed }}</div>
          </div>
        </div>
        <div class="weather-card info-card">
          <div class="info-icon"><LucideIcon name="Calendar" /></div>
          <div class="info-content">
            <div class="info-label">能见度</div>
            <div class="info-value">{{ weatherData.visibility }}km</div>
          </div>
        </div>
      </div>

      <div class="forecast-section">
        <div class="section-title">
          <LucideIcon name="Calendar" />
          <span>未来预报</span>
        </div>
        <div class="forecast-list">
          <div v-for="day in weatherData.forecast" :key="day.date" class="forecast-item">
            <div class="forecast-date">{{ day.date }}</div>
            <LucideIcon :name="getForecastIconName(day.icon)" class="forecast-icon" />
            <div class="forecast-temp">
              <span class="high">{{ day.high }}°</span>
              <span class="low">{{ day.low }}°</span>
            </div>
            <div class="forecast-desc">{{ day.description }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="loading" class="loading-state">
      <span>{{ loadingText }}</span>
    </div>

    <div v-else class="empty-state">
      <p>点击"重新定位"获取当前天气</p>
      <p>或搜索其他城市</p>
    </div>

    <div v-if="debugPanelVisible" class="debug-panel">
      <div class="debug-header">
        <h3>调试信息</h3>
        <div class="debug-actions">
          <el-button size="small" @click="saveDebugData">保存数据到文件</el-button>
          <el-button size="small" @click="clearDebugLogs">清空日志</el-button>
        </div>
      </div>

      <div class="debug-tabs">
        <el-tabs v-model="debugActiveTab">
          <el-tab-pane label="请求日志" name="logs">
            <div class="debug-logs">
              <div v-for="(log, index) in debugLogs" :key="index" :class="['log-item', log.type]">
                <span class="log-time">{{ log.time }}</span>
                <span class="log-message">{{ log.message }}</span>
              </div>
              <div v-if="debugLogs.length === 0" class="empty-logs">暂无日志</div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="原始数据" name="raw">
            <pre class="raw-data">{{ JSON.stringify(rawWeatherData, null, 2) }}</pre>
          </el-tab-pane>
          <el-tab-pane label="定位信息" name="location">
            <pre class="raw-data">{{ JSON.stringify(locationData, null, 2) }}</pre>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'

interface WeatherData {
  temperature: number
  feelsLike: number
  description: string
  humidity: number
  windDirection: string
  windSpeed: string
  visibility: number
  updateTime: number
  forecast: ForecastDay[]
}

interface ForecastDay {
  date: string
  high: number
  low: number
  description: string
  icon: string
}

interface DebugLog {
  time: string
  type: 'info' | 'success' | 'error' | 'warning'
  message: string
}

const searchQuery = ref('')
const currentCity = ref('')
const weatherData = ref<WeatherData | null>(null)
const rawWeatherData = ref<any>(null)
const locationData = ref<any>(null)
const loading = ref(false)
const loadingText = ref('')
const historyList = ref<string[]>([])
const debugPanelVisible = ref(false)
const debugActiveTab = ref('logs')
const debugLogs = ref<DebugLog[]>([])
const useCache = ref(true)

const weatherIconMap: Record<string, string> = {
  'Sunny': 'sun',
  'Clear': 'sun',
  'Partly': 'cloud',
  'Cloudy': 'cloud',
  'Clouds': 'cloud',
  'Rain': 'cloud',
  'Snow': 'cloud',
  'Thunder': 'cloud',
  'Storm': 'cloud',
  'Fog': 'cloud',
  'Mist': 'cloud',
  'Haze': 'cloud',
  'Drizzle': 'cloud',
  '晴': 'sun',
  '多云': 'cloud',
  '阴': 'cloud',
  '雨': 'cloud',
  '雪': 'cloud',
  '雷': 'cloud',
  '雾': 'cloud',
  '冰雹': 'cloud',
  '风': 'cloud',
}

const weatherIconName = computed(() => {
  if (!weatherData.value) return 'cloud'
  const desc = weatherData.value.description
  for (const [key, iconName] of Object.entries(weatherIconMap)) {
    if (desc.includes(key)) return iconName
  }
  return 'cloud'
})

function addDebugLog(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const now = new Date()
  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  debugLogs.value.push({ time, type, message })
  console.log(`[${time}] [${type.toUpperCase()}] ${message}`)
}

function clearDebugLogs() {
  debugLogs.value = []
}

async function saveDebugData() {
  addDebugLog('正在保存调试数据...', 'info')
  try {
    const data = {
      city: currentCity.value,
      weatherData: weatherData.value,
      rawWeatherData: rawWeatherData.value,
      locationData: locationData.value,
      debugLogs: debugLogs.value,
      timestamp: Date.now(),
    }
    const result = await window.ipcRenderer.invoke('save-debug-data', {
      data,
      fileName: `weather_debug_${currentCity.value}`.replace(/[\s\/\\:*?"<>|]/g, '_'),
    })
    if (result.success) {
      addDebugLog(`调试数据已保存: ${result.filePath}`, 'success')
      ElMessage.success(`调试数据已保存到: ${result.filePath}`)
    } else {
      addDebugLog(`保存失败: ${result.error}`, 'error')
      ElMessage.error('保存失败')
    }
  } catch (error) {
    addDebugLog(`保存异常: ${error}`, 'error')
  }
}

function toggleDebugPanel() {
  debugPanelVisible.value = !debugPanelVisible.value
}

function fetchCitySuggestions(query: string, cb: (data: { value: string }[]) => void) {
  if (!query) {
    cb([])
    return
  }
  const suggestions = ['北京', '上海', '广州', '深圳', '杭州', '南京', '成都', '武汉', '西安', '重庆']
    .filter(city => city.includes(query))
    .map(city => ({ value: city }))
  cb(suggestions)
}

function handleCitySelect(item: { value: string }) {
  loadWeatherByCity(item.value)
}

function searchWeather() {
  if (!searchQuery.value.trim()) {
    ElMessage.warning('请输入城市名称')
    return
  }
  loadWeatherByCity(searchQuery.value.trim())
}

async function loadWeatherByCity(city: string) {
  loading.value = true
  loadingText.value = `正在获取 ${city} 的天气...`
  addDebugLog(`开始获取天气: ${city}, 使用缓存: ${useCache.value}`, 'info')

  try {
    if (useCache.value) {
      const cached = getCachedWeather(city)
      if (cached) {
        addDebugLog(`使用前端缓存数据: ${city}`, 'success')
        weatherData.value = cached
        currentCity.value = city
        loading.value = false
        addHistory(city)
        return
      }
    }

    addDebugLog(`调用爬虫获取天气: ${city}, 强制刷新: ${!useCache.value}`, 'info')
    const rawData = await fetchWeather(city, !useCache.value)
    rawWeatherData.value = rawData

    const formattedData = {
      temperature: rawData.temperature,
      feelsLike: rawData.feelsLike,
      description: rawData.description,
      humidity: rawData.humidity,
      windDirection: rawData.windDirection,
      windSpeed: rawData.windSpeed,
      visibility: rawData.visibility,
      updateTime: rawData.updateTime,
      forecast: rawData.forecast || [],
    }

    addDebugLog(`获取成功: ${JSON.stringify(formattedData)}`, 'success')
    weatherData.value = formattedData
    currentCity.value = city
    cacheWeather(city, formattedData)
    addHistory(city)
  } catch (error) {
    addDebugLog(`获取失败: ${(error as Error).message}`, 'error')
    ElMessage.error('获取天气失败，请稍后重试')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function locateAndLoad() {
  loading.value = true
  loadingText.value = '正在定位...'
  addDebugLog('开始定位', 'info')

  try {
    const position = await window.ipcRenderer.invoke('get-current-position')
    locationData.value = position
    addDebugLog(`定位结果: ${JSON.stringify(position)}`, 'info')

    if (!position || position.error) {
      throw new Error('定位失败')
    }

    const city = position.city || position.region || '未知城市'
    addDebugLog(`定位城市: ${city}`, 'success')
    await loadWeatherByCity(city)
  } catch (error) {
    addDebugLog(`定位失败: ${(error as Error).message}`, 'error')
    ElMessage.error('定位失败，请手动搜索城市')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function fetchWeather(city: string, forceRefresh: boolean = false): Promise<any> {
  addDebugLog(`IPC调用: get-weather, city=${city}, forceRefresh=${forceRefresh}`, 'info')
  const result = await window.ipcRenderer.invoke('get-weather', { city, forceRefresh })
  
  if (!result || result.error) {
    throw new Error(result?.error || '获取天气失败')
  }

  addDebugLog(`爬虫返回数据: ${JSON.stringify(result)}`, 'info')
  return result
}

function getCachedWeather(city: string): WeatherData | null {
  const cached = localStorage.getItem(`weather_${city}`)
  if (!cached) return null

  try {
    const data = JSON.parse(cached)
    const now = Date.now()
    if (now - data.updateTime < 2 * 60 * 60 * 1000) {
      return data
    }
    localStorage.removeItem(`weather_${city}`)
    return null
  } catch {
    return null
  }
}

function cacheWeather(city: string, data: WeatherData) {
  localStorage.setItem(`weather_${city}`, JSON.stringify(data))
}

function addHistory(city: string) {
  const index = historyList.value.indexOf(city)
  if (index > -1) {
    historyList.value.splice(index, 1)
  }
  historyList.value.unshift(city)
  if (historyList.value.length > 10) {
    historyList.value.pop()
  }
  localStorage.setItem('weather_history', JSON.stringify(historyList.value))
}

function removeHistory(city: string) {
  const index = historyList.value.indexOf(city)
  if (index > -1) {
    historyList.value.splice(index, 1)
    localStorage.setItem('weather_history', JSON.stringify(historyList.value))
  }
}

function clearHistory() {
  historyList.value = []
  localStorage.removeItem('weather_history')
}

function formatUpdateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function getForecastIconName(icon: string): string {
  const iconMap: Record<string, string> = {
    'Sunny': 'Sun',
    'Clear': 'Sun',
    'Mostly Sunny': 'Sun',
    'Sun': 'Sun',
    'Cloudy': 'Cloud',
    'Clouds': 'Cloud',
    'Partly Cloudy': 'Cloud',
    'Partly': 'Cloud',
    'Rain': 'Cloud',
    'Rainy': 'Cloud',
    'Snow': 'Cloud',
    'Snowy': 'Cloud',
    'Thunder': 'Cloud',
    'Thunderstorm': 'Cloud',
    'Storm': 'Cloud',
    'Drizzle': 'Cloud',
    'Mist': 'Cloud',
    'Fog': 'Cloud',
    'Haze': 'Cloud',
    'Smoke': 'Cloud',
    'Dust': 'Cloud',
    'Sand': 'Cloud',
    'Ash': 'Cloud',
    'Squalls': 'Cloud',
    'Tornado': 'Cloud',
  }
  return iconMap[icon] || 'Cloud'
}

onMounted(() => {
  addDebugLog('天气页面加载完成', 'info')
  
  const savedHistory = localStorage.getItem('weather_history')
  if (savedHistory) {
    historyList.value = JSON.parse(savedHistory)
    addDebugLog(`加载历史记录: ${historyList.value.join(', ')}`, 'info')
  }

  locateAndLoad()
})
</script>

<style scoped lang="scss">
.weather-page {
  padding: 24px;
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-primary) 100%);
}

.search-section {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  align-items: center;

  .search-input {
    flex: 1;
  }

  .search-icon {
    color: var(--text-muted);
  }

  .cache-switch {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
}

.history-section {
  margin-bottom: 20px;

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 10px;
  }

  .history-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
}

.location-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-hover);
  border-radius: var(--radius-btn);
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.weather-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.weather-card {
  background: var(--bg-card);
  border-radius: var(--radius-card);
  padding: 24px;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--border-subtle);
}

.main-card {
  display: flex;
  align-items: center;
  gap: 24px;

  .weather-icon-large {
    font-size: 80px;
    color: var(--color-primary);
  }

  .weather-info {
    flex: 1;

    .temperature {
      font-size: 4rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.1;
    }

    .weather-desc {
      font-size: 1.2rem;
      color: var(--text-secondary);
      margin: 8px 0;
    }

    .update-time {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
  }
}

.weather-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;

  .info-icon {
    font-size: 32px;
    color: var(--color-primary);
    flex-shrink: 0;
  }

  .info-content {
    .info-label {
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-bottom: 4px;
    }

    .info-value {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
    }
  }
}

.forecast-section {
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .forecast-list {
    display: flex;
    gap: 12px;
  }

  .forecast-item {
    flex: 1;
    background: var(--bg-card);
    border-radius: var(--radius-card);
    padding: 16px;
    text-align: center;
    border: 1px solid var(--border-subtle);

    .forecast-date {
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .forecast-icon {
      font-size: 28px;
      color: var(--color-primary);
      margin-bottom: 8px;
    }

    .forecast-temp {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 4px;

      .high {
        font-weight: 600;
        color: var(--text-primary);
      }

      .low {
        color: var(--text-muted);
      }
    }

    .forecast-desc {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: 16px;
  color: var(--text-muted);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: 12px;
  color: var(--text-muted);
  text-align: center;

  p {
    margin: 0;
    font-size: 0.9rem;
  }
}

.debug-panel {
  margin-top: 24px;
  background: var(--bg-card);
  border-radius: var(--radius-card);
  border: 1px solid var(--border-subtle);
  overflow: hidden;

  .debug-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: var(--bg-hover);
    border-bottom: 1px solid var(--border-subtle);

    h3 {
      margin: 0;
      font-size: 1rem;
      color: var(--text-primary);
    }

    .debug-actions {
      display: flex;
      gap: 8px;
    }
  }

  .debug-tabs {
    padding: 16px;
  }

  .debug-logs {
    max-height: 400px;
    overflow-y: auto;
    padding: 8px;
    background: #1a1a2e;
    border-radius: 8px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.8rem;

    .log-item {
      padding: 4px 8px;
      margin-bottom: 4px;
      border-radius: 4px;

      &.info {
        background: #16213e;
        color: #a8b2d1;
      }

      &.success {
        background: #1a3a2a;
        color: #69db7c;
      }

      &.warning {
        background: #3a351a;
        color: #fcc419;
      }

      &.error {
        background: #3a1a1a;
        color: #ff6b6b;
      }

      .log-time {
        margin-right: 12px;
        color: #6c757d;
      }

      .log-message {
        word-break: break-all;
      }
    }

    .empty-logs {
      text-align: center;
      color: #6c757d;
      padding: 20px;
    }
  }

  .raw-data {
    max-height: 400px;
    overflow-y: auto;
    padding: 12px;
    background: #1a1a2e;
    border-radius: 8px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.75rem;
    color: #a8b2d1;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>