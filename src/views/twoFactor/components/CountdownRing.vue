<template>
  <div class="countdown-ring" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :viewBox="`0 0 ${size} ${size}`" class="countdown-ring__svg">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        class="countdown-ring__track"
        :stroke-width="stroke"
        fill="none"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        class="countdown-ring__progress"
        :stroke-width="stroke"
        fill="none"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
      />
    </svg>
    <span class="countdown-ring__label">{{ remaining }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * 倒计时环：纯展示组件，输入 remaining / period 输出环形进度 + 秒数。
 * 颜色走主题 token，不硬编码。
 */
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    remaining: number;
    period: number;
    size?: number;
    stroke?: number;
  }>(),
  { size: 44, stroke: 4 },
);

const radius = computed(() => props.size / 2 - props.stroke);
const circumference = computed(() => 2 * Math.PI * radius.value);
const ratio = computed(() => (props.period > 0 ? props.remaining / props.period : 0));
const dashOffset = computed(() => circumference.value * (1 - ratio.value));
</script>

<style scoped lang="scss">
.countdown-ring {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.countdown-ring__svg {
  width: 100%;
  height: 100%;
}
.countdown-ring__track {
  stroke: var(--border-subtle);
}
.countdown-ring__progress {
  stroke: var(--color-primary);
  transition: stroke-dashoffset 1s linear;
}
.countdown-ring__label {
  position: absolute;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
