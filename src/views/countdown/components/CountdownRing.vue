<!--
  倒计时进度环：剩余比例 = remaining/duration，随时间流逝环逐渐耗尽。
  纯 SVG，颜色走 props（默认主题主色 token）。
-->
<template>
  <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" class="countdown-ring">
    <circle
      :cx="size / 2"
      :cy="size / 2"
      :r="radius"
      fill="none"
      stroke="var(--border-subtle)"
      :stroke-width="stroke"
    />
    <circle
      :cx="size / 2"
      :cy="size / 2"
      :r="radius"
      fill="none"
      :stroke="color || 'var(--color-primary)'"
      :stroke-width="stroke"
      stroke-linecap="round"
      :stroke-dasharray="circumference"
      :stroke-dashoffset="offset"
      :transform="`rotate(-90 ${size / 2} ${size / 2})`"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    /** 剩余比例 0..1 */
    progress?: number;
    color?: string;
    size?: number;
    stroke?: number;
  }>(),
  { progress: 0, color: "var(--color-primary)", size: 220, stroke: 12 },
);

const radius = computed(() => (props.size - props.stroke) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const offset = computed(() => circumference.value * (1 - Math.min(1, Math.max(0, props.progress))));
</script>

<style scoped lang="scss">
.countdown-ring {
  display: block;
}
</style>
