<template>
  <div class="hourly-forecast">
    <div class="section-title">
      <LucideIcon name="Clock" :size="15" />
      <span>逐小时预报</span>
      <span class="source-tag">未来 {{ hourly.length }} 小时</span>
    </div>

    <div class="hourly-card glass-card">
      <div v-for="(hour, index) in hourly" :key="`${hour.time}-${index}`" class="hour-col">
        <div class="col-time">{{ index === 0 ? '现在' : hour.time }}</div>
        <div class="col-icon">
          <LucideIcon :name="getIcon(hour.condition)" :size="20" :stroke-width="1.6" />
        </div>
        <div class="col-temp">{{ hour.temperature }}°</div>
        <div class="col-precip">
          <template v-if="hour.precipProbability != null">
            <LucideIcon name="Droplets" :size="11" :stroke-width="1.8" />
            <span>{{ hour.precipProbability }}%</span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue'
import type { HourlyForecast, WeatherCondition } from '../types'
import { CONDITION_ICON_MAP } from '../constants'

/** 组件 Props */
defineProps<{
  /** 逐小时预报列表（通常 24 条） */
  hourly: HourlyForecast[]
}>()

/**
 * 根据天气现象取对应 Lucide 图标名
 * @param condition 归一化天气现象类型
 * @returns Lucide 图标名（无法识别时回退 Cloudy）
 */
function getIcon(condition: WeatherCondition): string {
  const icons = CONDITION_ICON_MAP[condition]
  return icons ? icons.day : CONDITION_ICON_MAP.unknown.day
}
</script>

<style scoped lang="scss">
.hourly-forecast {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);

  .source-tag {
    margin-left: auto;
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.55);
  }
}

.hourly-card {
  display: flex;
  gap: 4px;
  padding: 14px 16px;
  overflow-x: auto;
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
}

.hour-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 56px;
  flex-shrink: 0;

  .col-time {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.65);
    white-space: nowrap;
  }

  .col-icon {
    color: #fff;
    display: flex;
    align-items: center;
    height: 22px;
  }

  .col-temp {
    font-size: 0.85rem;
    font-weight: 600;
    color: #fff;
  }

  .col-precip {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 14px;
    font-size: 0.68rem;
    color: #9fd6ff;
  }
}
</style>
