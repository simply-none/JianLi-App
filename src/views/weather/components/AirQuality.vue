<template>
  <div class="air-quality">
    <div class="section-title">
      <LucideIcon name="Leaf" :size="15" />
      <span>空气质量</span>
      <span v-if="primary" class="source-tag">首要污染物：{{ primary }}</span>
    </div>

    <div class="air-card glass-card">
      <!-- AQI 数值与等级 -->
      <div class="aqi-block">
        <div class="aqi-value" :style="{ color }">{{ air.aqi }}</div>
        <div class="aqi-level" :style="{ background: color }">{{ air.category || levelText }}</div>
      </div>

      <!-- 国标六级色阶刻度 -->
      <div class="aqi-scale">
        <div
          v-for="seg in SCALE"
          :key="seg.label"
          class="scale-seg"
          :style="{ background: seg.color, opacity: activeSegment === seg.label ? 1 : 0.35 }"
        >
          <span>{{ seg.label }}</span>
        </div>
        <div class="scale-pointer" :style="{ left: pointerLeft + '%' }"></div>
      </div>

      <!-- PM2.5 -->
      <div v-if="air.pm25 != null" class="pm-row">
        <span class="pm-label">PM2.5</span>
        <span class="pm-value">{{ air.pm25 }} μg/m³</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { aqiColor } from '../capability'
import type { AirQuality } from '../types'

/** 组件 Props */
const props = defineProps<{
  /** 空气质量数据 */
  air: AirQuality
}>()

/** 国标 AQI 六级色阶（用于刻度条） */
const SCALE = [
  { label: '优', max: 50, color: '#00b050' },
  { label: '良', max: 100, color: '#d4c000' },
  { label: '轻度', max: 150, color: '#ff8c00' },
  { label: '中度', max: 200, color: '#e02020' },
  { label: '重度', max: 300, color: '#8b00a0' },
  { label: '严重', max: 500, color: '#7a0b0b' },
]

/** AQI 对应的展示色 */
const color = computed(() => aqiColor(props.air.aqi))

/** 当前所处等级标签 */
const activeSegment = computed(
  () => (SCALE.find((s) => props.air.aqi <= s.max) ?? SCALE[SCALE.length - 1]).label
)

/** 等级文案（接口未给出 category 时的兜底） */
const levelText = computed(() => {
  const map: Record<string, string> = {
    优: '优', 良: '良', 轻度: '轻度污染', 中度: '中度污染', 重度: '重度污染', 严重: '严重污染',
  }
  return map[activeSegment.value] ?? '未知'
})

/** 首要污染物 */
const primary = computed(() => props.air.primary)

/** 指针位置（按 AQI 在 0-500 区间内的比例） */
const pointerLeft = computed(() => Math.min(Math.max((props.air.aqi / 500) * 100, 0), 100))
</script>

<style scoped lang="scss">
.air-quality {
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

.air-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 20px;

  .aqi-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;

    .aqi-value {
      font-size: 2.2rem;
      font-weight: 700;
      line-height: 1;
    }

    .aqi-level {
      padding: 2px 12px;
      border-radius: 999px;
      font-size: 0.72rem;
      color: #fff;
    }
  }

  .aqi-scale {
    position: relative;
    flex: 1;
    display: flex;
    gap: 3px;

    .scale-seg {
      flex: 1;
      height: 22px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.25s;

      span {
        font-size: 0.62rem;
        color: #fff;
        opacity: 0.9;
      }
    }

    .scale-pointer {
      position: absolute;
      bottom: -6px;
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 7px solid #fff;
      transform: translateX(-50%);
      transition: left 0.3s;
    }
  }

  .pm-row {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;

    .pm-label {
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.6);
    }

    .pm-value {
      font-size: 0.9rem;
      font-weight: 600;
      color: #fff;
    }
  }
}
</style>
