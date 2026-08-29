<template>
  <div class="weather-page" :style="backgroundStyle">
    <!-- 搜索栏与历史记录 -->
    <WeatherSearch
      :history="historyList"
      :starred="starredCities"
      :loading="loading"
      @search="handleSearch"
      @toggleStar="toggleStarCity"
      @removeHistory="history.remove"
      @clearHistory="history.clear"
    />

    <!-- 主体内容：骨架屏 / 天气数据 / 空状态 -->
    <template v-if="loading && !weatherData">
      <WeatherSkeleton />
    </template>

    <div v-else-if="weatherData" class="weather-content">
      <WeatherHero
        :data="weatherData"
        :city="currentCity"
        :icon="heroIcon"
        :condition="condition"
        :refreshing="refreshing"
        :is-starred="isStarred(currentCity)"
        @refresh="handleRefresh"
        @toggleStar="toggleStarCity"
      />
      <WeatherDetails :data="weatherData" />
      <LifeIndices
        v-if="weatherData.indices?.length"
        :indices="weatherData.indices"
        :source="weatherData.source"
      />
      <DailyForecast v-if="weatherData.forecast?.length" :forecast="weatherData.forecast" />
    </div>

    <div v-else class="empty-state">
      <LucideIcon name="CloudSun" :size="56" :stroke-width="1.2" />
      <p>输入城市名查询天气</p>
      <p class="empty-sub">查询结果会自动记住，下次进入默认展示</p>
    </div>

    <!-- 调试入口按钮（右下角悬浮，默认隐藏面板） -->
    <button class="debug-toggle" title="调试模式" @click="debugVisible = !debugVisible">
      <LucideIcon name="Wrench" :size="16" />
    </button>

    <!-- 调试面板 -->
    <DebugPanel
      v-if="debugVisible"
      :logs="debug.logs.value"
      :raw-data="rawData"
      @save="handleSaveDebug"
      @clear="debug.clearLogs"
      @close="debugVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import WeatherSearch from './components/WeatherSearch.vue'
import WeatherHero from './components/WeatherHero.vue'
import WeatherDetails from './components/WeatherDetails.vue'
import LifeIndices from './components/LifeIndices.vue'
import DailyForecast from './components/DailyForecast.vue'
import WeatherSkeleton from './components/WeatherSkeleton.vue'
import DebugPanel from './components/DebugPanel.vue'
import { useWeather } from './composables/useWeather'
import { useCityHistory } from './composables/useCityHistory'
import { useStarredCities } from './composables/useStarredCities'
import { useWeatherTheme } from './composables/useWeatherTheme'
import { useDebugLog } from './composables/useDebugLog'

/** 调试日志控制器 */
const debug = useDebugLog()

/** 天气数据控制器（日志回调接入调试面板） */
const weather = useWeather(debug.addLog)
const {
  weatherData,
  currentCity,
  rawData,
  loading,
  loadByCity,
  refresh,
} = weather

/** 城市搜索历史控制器 */
const history = useCityHistory()
/** 历史城市列表（模板绑定用，顶层 ref 自动解包） */
const historyList = history.historyList

/** 星标城市控制器（列表置顶展示于搜索栏下方、搜索历史上方） */
const {
  starredList: starredCities,
  isStarred,
  toggle: toggleStar,
  reload: reloadStarred,
} = useStarredCities()

/** 天气主题控制器（背景渐变 / 图标 / 现象类型） */
const { condition, backgroundStyle, heroIcon } = useWeatherTheme(weatherData)

/** 调试面板可见性 */
const debugVisible = ref(false)

/** 是否正在强制刷新（刷新按钮旋转） */
const refreshing = ref(false)

/**
 * 按城市查询天气（查询成功后刷新历史与星标列表，两者均来自数据库）
 * @param city 城市名
 */
async function handleSearch(city: string) {
  try {
    await loadByCity(city)
    await Promise.all([history.add(), reloadStarred()])
  } catch (error) {
    debug.addLog(`获取失败: ${(error as Error).message}`, 'error')
    ElMessage.error('获取天气失败，请稍后重试')
  }
}

/**
 * 强制刷新当前城市天气（跳过缓存）
 */
async function handleRefresh() {
  refreshing.value = true
  try {
    await refresh()
  } catch (error) {
    debug.addLog(`刷新失败: ${(error as Error).message}`, 'error')
    ElMessage.error('刷新失败，请稍后重试')
  } finally {
    refreshing.value = false
  }
}

/** 保存调试数据到本地文件 */
async function handleSaveDebug() {
  const filePath = await debug.saveToFile(currentCity.value, {
    weatherData: weatherData.value,
    rawData: rawData.value,
  })
  if (filePath) {
    ElMessage.success('调试数据已保存')
  } else {
    ElMessage.error('保存失败')
  }
}

/**
 * 切换当前城市星标状态（数据库 is_starred 字段取反）
 * @param city 城市名
 */
async function toggleStarCity(city: string) {
  const ok = await toggleStar(city)
  if (!ok) {
    ElMessage.warning('该城市暂无天气数据，无法星标')
  }
}

onMounted(async () => {
  debug.addLog('天气页面加载完成', 'info')
  // 从数据库加载历史（最近 10 条）与星标列表
  await Promise.all([history.reload(), reloadStarred()])
  // 默认展示最后一次查询的城市（历史列表最近查询在前），无历史时展示空态等待手动输入
  const lastCity = historyList.value[0]
  if (lastCity) {
    debug.addLog(`默认加载上次查询城市: ${lastCity}`, 'info')
    handleSearch(lastCity)
  }
})
</script>

<style scoped lang="scss">
// 页面背景由内联样式动态注入（随天气现象与昼夜切换渐变）
.weather-page {
  position: relative;
  height: 100%;
  box-sizing: border-box;
  padding: 24px;
  overflow-y: auto;
  // 渐变切换时的过渡效果
  transition: background 0.8s ease;
}

// 毛玻璃卡片通用样式（:deep 穿透，作用于子组件内部的卡片元素）
.weather-page {
  :deep(.glass-card) {
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  }
}

.weather-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 400px;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;

  p {
    margin: 0;
    font-size: 0.95rem;
  }

  .empty-sub {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.6);
  }
}

// 调试入口悬浮按钮
.debug-toggle {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.25);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.45);
  }
}
</style>
