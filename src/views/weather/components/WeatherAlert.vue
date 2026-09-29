<template>
  <div class="weather-alert">
    <div
      v-for="(warn, index) in warnings"
      :key="`${warn.title}-${index}`"
      class="alert-card glass-card"
      :style="{ borderLeftColor: severityColor(warn.severity) }"
    >
      <div class="alert-head">
        <LucideIcon name="TriangleAlert" :size="16" :stroke-width="1.8" :color="severityColor(warn.severity)" />
        <span class="alert-title">{{ warn.title || warn.type || '天气预警' }}</span>
        <span class="alert-severity" :style="{ background: severityColor(warn.severity) }">
          {{ severityText(warn.severity) }}
        </span>
      </div>
      <p v-if="warn.text" class="alert-text">{{ warn.text }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue'
import { WARNING_SEVERITY_COLOR } from '../capability'
import type { WeatherWarning } from '../types'

/** 组件 Props */
defineProps<{
  /** 天气预警列表 */
  warnings: WeatherWarning[]
}>()

/** 严重程度英文 → 中文 */
const SEVERITY_CN: Record<string, string> = {
  Minor: '蓝色',
  Moderate: '黄色',
  Severe: '橙色',
  Extreme: '红色',
  Unknown: '未知',
}

/**
 * 取严重程度对应的展示色
 * @param severity 严重程度英文标识
 */
function severityColor(severity: string): string {
  return WARNING_SEVERITY_COLOR[severity] ?? WARNING_SEVERITY_COLOR.Unknown
}

/**
 * 取严重程度的中文名
 * @param severity 严重程度英文标识
 */
function severityText(severity: string): string {
  return SEVERITY_CN[severity] ?? '预警'
}
</script>

<style scoped lang="scss">
.weather-alert {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-card {
  padding: 12px 16px;
  border-left: 4px solid #f59e0b;

  .alert-head {
    display: flex;
    align-items: center;
    gap: 8px;

    .alert-title {
      font-size: 0.88rem;
      font-weight: 600;
      color: #fff;
    }

    .alert-severity {
      margin-left: auto;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.7rem;
      color: #fff;
      flex-shrink: 0;
    }
  }

  .alert-text {
    margin: 8px 0 0;
    font-size: 0.78rem;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.78);
  }
}
</style>
