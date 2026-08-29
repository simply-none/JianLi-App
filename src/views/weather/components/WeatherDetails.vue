<template>
  <div class="weather-details">
    <div v-for="item in detailItems" :key="item.label" class="detail-card glass-card">
      <div class="detail-icon">
        <LucideIcon :name="item.icon" :size="24" :stroke-width="1.6" />
      </div>
      <div class="detail-content">
        <div class="detail-label">{{ item.label }}</div>
        <div class="detail-value">{{ item.value }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import type { WeatherData } from '../types'

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

/** 详情指标卡片配置（基于天气数据计算） */
const detailItems = computed(() => [
  { icon: 'ThermometerSun', label: '体感温度', value: `${props.data.feelsLike}°C` },
  { icon: 'Droplets', label: '湿度', value: `${props.data.humidity}%` },
  { icon: 'Navigation', label: '风向', value: props.data.windDirection || '未知' },
  { icon: 'Wind', label: '风力', value: props.data.windSpeed || '未知' },
  { icon: 'Eye', label: '能见度', value: `${props.data.visibility} km` },
  { icon: 'Clock', label: '更新时间', value: formatTime(props.data.updateTime) },
])
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
