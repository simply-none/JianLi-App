<template>
  <div class="hourly-forecast">
    <div class="section-title">
      <LucideIcon name="Clock" :size="15" />
      <span>逐小时预报</span>
      <span class="source-tag">未来 {{ hourly.length }} 小时</span>

      <!-- 列表 / 图表 形态切换 -->
      <div class="view-switch" role="group" aria-label="展示形态">
        <button
          v-for="opt in VIEW_OPTIONS"
          :key="opt.value"
          type="button"
          class="switch-btn"
          :class="{ active: view === opt.value }"
          :title="opt.label"
          :aria-pressed="view === opt.value"
          @click="view = opt.value"
        >
          <LucideIcon :name="opt.icon" :size="14" :stroke-width="1.8" />
        </button>
      </div>
    </div>

    <!-- 图表形态 -->
    <div v-if="view === 'chart'" class="hourly-card glass-card chart-card">
      <HourlyForecastChart :hourly="hourly" />
    </div>

    <!-- 列表形态（默认） -->
    <div v-else class="hourly-card glass-card">
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
import HourlyForecastChart from './HourlyForecastChart.vue'
import type { HourlyForecast, WeatherCondition } from '../types'
import { CONDITION_ICON_MAP } from '../constants'
import { useForecastView } from '../composables/useForecastView'

/** 组件 Props */
defineProps<{
  /** 逐小时预报列表（通常 24 条） */
  hourly: HourlyForecast[]
}>()

/** 当前展示形态（列表 / 图表），状态跨会话记忆 */
const view = useForecastView('hourly')

/** 切换按钮配置（图标已在 LucideIcon 注册） */
const VIEW_OPTIONS = [
  { value: 'list' as const, label: '列表', icon: 'List' },
  { value: 'chart' as const, label: '图表', icon: 'ChartLine' },
]

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

/* 列表 / 图表 分段切换按钮 */
.view-switch {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 8px;
  padding: 2px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);

  .switch-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.65);
    cursor: pointer;
    transition: background 0.2s, color 0.2s;

    &:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.14);
    }

    &.active {
      color: #fff;
      background: rgba(255, 255, 255, 0.28);
    }
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

/* 图表形态：不需横向滚动，去掉滚动条相关规则 */
.chart-card {
  display: block;
  overflow: hidden;
  padding: 12px 14px;
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
