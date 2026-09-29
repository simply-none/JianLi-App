<template>
  <div class="minutely-rain">
    <div class="section-title">
      <LucideIcon name="CloudSunRain" :size="15" />
      <span>分钟级降水</span>
      <span v-if="minutely.summary" class="source-tag">{{ minutely.summary }}</span>
    </div>

    <div class="rain-card glass-card">
      <svg class="rain-chart" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none">
        <!-- 面积填充 -->
        <defs>
          <linearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(124, 196, 245, 0.55)" />
            <stop offset="100%" stop-color="rgba(124, 196, 245, 0.05)" />
          </linearGradient>
        </defs>
        <path :d="areaPath" fill="url(#rainFill)" />
        <path :d="linePath" fill="none" stroke="#9fd6ff" stroke-width="1.5" vector-effect="non-scaling-stroke" />
      </svg>

      <div class="rain-axis">
        <span>现在</span>
        <span>30 分钟</span>
        <span>1 小时</span>
        <span>2 小时</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import type { MinutelyRain } from '../types'

/** 组件 Props */
const props = defineProps<{
  /** 分钟级降水数据（values 长度 24，每 5 分钟一点） */
  minutely: MinutelyRain
}>()

/** SVG 逻辑尺寸（配合 preserveAspectRatio="none" 自适应拉伸） */
const W = 240
const H = 48

/**
 * 各点的归一化 Y 坐标（降水强度越大越靠上）
 * @returns 与 values 等长的 Y 坐标数组
 */
const points = computed(() => {
  const values = props.minutely.values?.length ? props.minutely.values : [0]
  const max = Math.max(...values, 0.1) // 避免全 0 时除零
  const stepX = W / Math.max(values.length - 1, 1)
  return values.map((v, i) => ({
    x: i * stepX,
    y: H - (Math.max(v, 0) / max) * (H - 4) - 2,
  }))
})

/** 折线路径 */
const linePath = computed(() =>
  points.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
)

/** 面积路径（折线闭合到底边） */
const areaPath = computed(() => {
  if (!points.value.length) return ''
  const last = points.value[points.value.length - 1]
  return `${linePath.value} L${last.x.toFixed(1)},${H} L0,${H} Z`
})
</script>

<style scoped lang="scss">
.minutely-rain {
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

.rain-card {
  padding: 14px 18px 10px;

  .rain-chart {
    width: 100%;
    height: 56px;
    display: block;
  }

  .rain-axis {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.5);
  }
}
</style>
