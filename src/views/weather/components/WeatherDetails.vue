<template>
  <div class="weather-details">
    <div v-for="item in detailItems" :key="item.key" class="detail-card glass-card">
      <div class="detail-icon">
        <LucideIcon :name="item.icon" :size="24" :stroke-width="1.6" />
      </div>
      <div class="detail-content">
        <div class="detail-label">{{ item.label }}</div>
        <div class="detail-value" :title="item.value">{{ item.value }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { useWeatherCapability } from '../capability'
import type { WeatherCapability, WeatherData } from '../types'

/** 组件 Props */
const props = defineProps<{
  /** 天气数据 */
  data: WeatherData
}>()

/**
 * 格式化更新时间为 HH:mm
 * @param timestamp 时间戳（ms）
 * @returns 格式化后的时间文本
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 一条详情卡片的定义 */
interface DetailItem {
  /** 唯一键（即能力标识，亦可作为 v-for key） */
  key: string
  /** 该卡片依赖的能力（null = 基础字段，始终展示） */
  cap: WeatherCapability | null
  /** 图标名（LucideIcon 已注册） */
  icon: string
  /** 展示标签 */
  label: string
  /** 展示值（空值返回空串，由过滤逻辑剔除） */
  value: string
}

/** 下拉取数值，避免 `undefined°C` 这类脏展示 */
function num(v: number | undefined): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
}

/** 能力判断器（未声明 capabilities 时 has() 恒为 true，兼容旧缓存） */
const { has } = useWeatherCapability(computed(() => props.data))

/**
 * 全部候选详情卡片（声明式）
 * 基础字段 cap 为 null 恒展示；扩展字段按能力过滤，值缺失亦过滤。
 */
const allItems = computed<DetailItem[]>(() => {
  const d = props.data
  const list: DetailItem[] = [
    /* ---- 基础字段（始终展示） ---- */
    { key: 'feelsLike', cap: null, icon: 'ThermometerSun', label: '体感温度', value: `${d.feelsLike}°C` },
    { key: 'humidity', cap: null, icon: 'Droplets', label: '湿度', value: `${d.humidity}%` },
    { key: 'windDirection', cap: null, icon: 'Navigation', label: '风向', value: d.windDirection || '未知' },
    { key: 'windSpeed', cap: null, icon: 'Wind', label: '风力', value: d.windSpeed || '未知' },
    { key: 'visibility', cap: null, icon: 'Eye', label: '能见度', value: `${d.visibility} km` },

    /* ---- 扩展字段（按能力 + 值双重过滤） ---- */
    {
      key: 'pressure', cap: 'current.pressure', icon: 'Gauge', label: '气压',
      value: num(d.pressure) ? `${d.pressure} hPa` : '',
    },
    {
      key: 'dewPoint', cap: 'current.dewPoint', icon: 'Thermometer', label: '露点',
      value: num(d.dewPoint) ? `${d.dewPoint}°C` : '',
    },
    {
      key: 'cloudCover', cap: 'current.cloudCover', icon: 'Cloudy', label: '云量',
      value: num(d.cloudCover) ? `${d.cloudCover}%` : '',
    },
    {
      key: 'windGust', cap: 'current.windGust', icon: 'Wind', label: '阵风',
      value: num(d.windGust) ? `${d.windGust} km/h` : '',
    },
    {
      key: 'uvIndex', cap: 'current.uvIndex', icon: 'Sun', label: '紫外线',
      value: num(d.uvIndex),
    },
    {
      key: 'precipitation', cap: 'current.precipitation', icon: 'Umbrella', label: '降水量',
      value: d.precipitationText || (num(d.precipitation) ? `${d.precipitation} mm` : ''),
    },

    /* ---- 更新时间（始终最后展示） ---- */
    { key: 'updateTime', cap: null, icon: 'Clock', label: '更新时间', value: formatTime(d.updateTime) },
  ]
  return list
})

/** 过滤后的详情卡片：能力不支持 或 值为空 的项被剔除 */
const detailItems = computed(() =>
  allItems.value.filter((item) => (item.cap ? has(item.cap) : true) && item.value !== '')
)
</script>

<style scoped lang="scss">
.weather-details {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.detail-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;

  .detail-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    flex-shrink: 0;
  }

  .detail-content {
    min-width: 0;

    .detail-label {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.65);
      margin-bottom: 2px;
    }

    .detail-value {
      font-size: 1.05rem;
      font-weight: 600;
      color: #fff;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
