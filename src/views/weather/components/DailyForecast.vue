<template>
  <div class="daily-forecast">
    <div class="section-title">
      <LucideIcon name="Calendar" :size="15" />
      <span>未来预报</span>
    </div>

    <div class="forecast-card glass-card">
      <div v-for="day in forecast" :key="day.date" class="forecast-row">
        <!-- 日期 -->
        <div class="row-date">{{ day.date }}</div>

        <!-- 天气图标与描述 -->
        <div class="row-weather">
          <LucideIcon :name="getIcon(day.icon)" :size="22" :stroke-width="1.6" />
          <span class="row-desc">{{ day.description || '--' }}</span>
        </div>

        <!-- 温度范围条 -->
        <div class="row-temp">
          <span class="temp-low">{{ day.low }}°</span>
          <div class="range-track">
            <div
              class="range-bar"
              :style="{ left: barLeft(day) + '%', width: barWidth(day) + '%' }"
            ></div>
          </div>
          <span class="temp-high">{{ day.high }}°</span>
        </div>

        <!-- 风向 / 风力（来源站支持时展示） -->
        <div v-if="day.windDirection || day.windPower" class="row-wind">
          <LucideIcon name="Wind" :size="14" :stroke-width="1.6" />
          <span>{{ day.windDirection || '--' }} {{ day.windPower || '' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import type { ForecastDay } from '../types'
import { CONDITION_ICON_MAP } from '../constants'

/** 组件 Props */
const props = defineProps<{
  /** 未来预报列表 */
  forecast: ForecastDay[]
}>()

/** 全部预报日中的最低温（用于范围条归一化；空列表时回退 0） */
const minLow = computed(() =>
  props.forecast.length ? Math.min(...props.forecast.map((d) => d.low)) : 0
)

/** 全部预报日中的最高温（用于范围条归一化；空列表时回退 1 避免除零） */
const maxHigh = computed(() =>
  props.forecast.length ? Math.max(...props.forecast.map((d) => d.high)) : 1
)

/** 温度总跨度（避免除零） */
const tempRange = computed(() => Math.max(maxHigh.value - minLow.value, 1))

/**
 * 范围条起点百分比
 * @param day 单日预报
 * @returns 左侧偏移百分比（0-100）
 */
function barLeft(day: ForecastDay): number {
  return ((day.low - minLow.value) / tempRange.value) * 100
}

/**
 * 范围条宽度百分比
 * @param day 单日预报
 * @returns 宽度百分比（0-100）
 */
function barWidth(day: ForecastDay): number {
  const width = ((day.high - day.low) / tempRange.value) * 100
  return Math.max(width, 4) // 最小宽度保证可见
}

/**
 * 根据天气现象类型取对应 Lucide 图标名
 * @param conditionText 归一化天气现象类型
 * @returns 图标名（无法识别时回退为 Cloudy）
 */
function getIcon(conditionText: string): string {
  const icons = CONDITION_ICON_MAP[conditionText as keyof typeof CONDITION_ICON_MAP]
  return icons ? icons.day : CONDITION_ICON_MAP.unknown.day
}
</script>

<style scoped lang="scss">
.daily-forecast {
  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    margin-bottom: 10px;
  }

  .forecast-card {
    padding: 6px 20px;
  }

  .forecast-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 0;

    & + .forecast-row {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .row-date {
      width: 72px;
      flex-shrink: 0;
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.9);
    }

    .row-weather {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 130px;
      flex-shrink: 0;
      color: #fff;

      .row-desc {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.8);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .row-wind {
      display: flex;
      align-items: center;
      gap: 5px;
      width: 150px;
      flex-shrink: 0;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.7);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .row-temp {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;

      .temp-low {
        width: 32px;
        text-align: right;
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.65);
      }
      .range-track {
        position: relative;
        flex: 1;
        height: 6px;
        border-radius: 3px;
        background: rgba(255, 255, 255, 0.15);
        overflow: hidden;

        .range-bar {
          position: absolute;
          top: 0;
          height: 100%;
          border-radius: 3px;
          background: linear-gradient(90deg, #7cc4f5 0%, #ffd57c 100%);
          transition: left 0.3s, width 0.3s;
        }
      }

      .temp-high {
        width: 32px;
        font-size: 0.85rem;
        font-weight: 600;
        color: #fff;
      }
    }
  }
}
</style>
