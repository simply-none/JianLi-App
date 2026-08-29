<template>
  <div class="weather-hero glass-card">
    <!-- 右上角操作按钮：星标 + 强制刷新 -->
    <div class="hero-actions">
      <button
        class="action-btn"
        :title="isStarred ? '取消星标' : '加入星标'"
        @click="emit('toggleStar', city)"
      >
        <LucideIcon
          name="Star"
          :size="16"
          :color="isStarred ? '#f7c948' : undefined"
          :class="{ 'star-bounce': isStarred }"
        />
      </button>
      <button class="action-btn" title="强制刷新" @click="emit('refresh')">
        <LucideIcon name="RefreshCw" :size="16" :class="{ spinning: refreshing }" />
      </button>
    </div>

    <!-- 左侧：动态天气图标 -->
    <div class="hero-icon" :class="`icon-${condition}`">
      <LucideIcon :name="icon" :size="96" :stroke-width="1.4" />
    </div>

    <!-- 右侧：温度与描述信息 -->
    <div class="hero-info">
      <div class="city-row">
        <LucideIcon name="MapPin" :size="16" />
        <span class="city-name">{{ city }}</span>
      </div>
      <div class="temperature">{{ data.temperature }}<span class="degree">°C</span></div>
      <div class="description">{{ data.description }}</div>
      <div class="sub-info">
        <span>体感 {{ data.feelsLike }}°</span>
        <template v-if="todayForecast">
          <span class="divider"></span>
          <span>最高 {{ todayForecast.high }}°</span>
          <span class="divider"></span>
          <span>最低 {{ todayForecast.low }}°</span>
        </template>
      </div>
      <div class="update-time">更新于 {{ formatTime(data.updateTime) }}</div>
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
  /** 展示城市名（取自用户查询输入，比爬取的 city 更准确） */
  city: string
  /** 主图标名（由父级根据天气+昼夜计算） */
  icon: string
  /** 天气现象类型（驱动图标动效） */
  condition: string
  /** 是否正在刷新（刷新按钮转圈） */
  refreshing?: boolean
  /** 当前城市是否已星标 */
  isStarred?: boolean
}>()

/** 组件事件 */
const emit = defineEmits<{
  /** 触发强制刷新 */
  (e: 'refresh'): void
  /** 切换当前城市星标状态 */
  (e: 'toggleStar', city: string): void
}>()

/** 今日预报（用于展示最高 / 最低温） */
const todayForecast = computed(() => props.data.forecast?.[0] || null)

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
</script>

<style scoped lang="scss">
.weather-hero {
  position: relative;
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 28px 32px;
}

// 右上角操作按钮组（星标 + 刷新）
.hero-actions {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .spinning {
    animation: refresh-spin 0.8s linear infinite;
  }

  .star-bounce {
    animation: star-bounce 0.35s ease;
  }
}

// 星标弹跳动效
@keyframes star-bounce {
  0% { transform: scale(0.6); }
  60% { transform: scale(1.25); }
  100% { transform: scale(1); }
}

.hero-icon {
  flex-shrink: 0;
  color: #fff;

  :deep(svg) {
    animation: icon-float 4s ease-in-out infinite;
  }

  // 晴天：光晕呼吸效果（覆盖默认漂浮）
  &.icon-sunny :deep(svg) {
    animation: icon-breathe 3s ease-in-out infinite;
  }
}

.hero-info {
  flex: 1;
  min-width: 0;

  .city-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.9);
  }

  .temperature {
    font-size: 4.5rem;
    font-weight: 700;
    line-height: 1.15;
    color: #fff;
    letter-spacing: -2px;

    .degree {
      font-size: 2rem;
      font-weight: 500;
      vertical-align: super;
      color: rgba(255, 255, 255, 0.85);
    }
  }

  .description {
    font-size: 1.15rem;
    color: rgba(255, 255, 255, 0.92);
  }

  .sub-info {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.75);

    .divider {
      width: 1px;
      height: 12px;
      background: rgba(255, 255, 255, 0.35);
    }
  }

  .update-time {
    margin-top: 8px;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.55);
  }
}

// 图标漂浮动效
@keyframes icon-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

// 晴天光晕呼吸动效
@keyframes icon-breathe {
  0%, 100% { filter: drop-shadow(0 0 12px rgba(255, 220, 130, 0.6)); }
  50% { filter: drop-shadow(0 0 26px rgba(255, 220, 130, 0.95)); }
}

// 刷新按钮旋转动效
@keyframes refresh-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
