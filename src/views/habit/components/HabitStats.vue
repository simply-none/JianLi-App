<!--
  习惯统计面板（原子组件）：总览指标 + 日历热力图。
  数据由 props 传入（不直接读 store），纯展示，便于复用与测试。
-->
<template>
  <section class="habit-stats">
    <div class="habit-stats__cards">
      <div class="habit-stats__card">
        <span class="habit-stats__value">{{ overview.totalCheckins }}</span>
        <span class="habit-stats__label">累计打卡</span>
      </div>
      <div class="habit-stats__card">
        <span class="habit-stats__value">{{ overview.activeDays }}</span>
        <span class="habit-stats__label">打卡天数</span>
      </div>
      <div class="habit-stats__card">
        <span class="habit-stats__value">{{ overview.longestStreak }}</span>
        <span class="habit-stats__label">最长连击（天）</span>
      </div>
      <div class="habit-stats__card">
        <span class="habit-stats__value">{{ last30Text }}</span>
        <span class="habit-stats__label">近 30 天活跃</span>
      </div>
    </div>

    <div class="habit-stats__heatmap">
      <div class="habit-stats__heatmap-title">打卡热力图</div>
      <HabitHeatmap
        :cells="heatmap.cells"
        :max="heatmap.max"
        :start="heatmap.start"
        :end="heatmap.end"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { HabitCheckin, HabitDef } from "../types";
import { buildHeatmap, computeOverview, countByDateOf } from "../utils/stats";
import HabitHeatmap from "./HabitHeatmap.vue";

const props = defineProps<{
  habits: HabitDef[];
  checkins: HabitCheckin[];
  /** 热力图展示的周数，默认 12 周（约 3 个月） */
  weeks?: number;
}>();

/** 总览指标 */
const overview = computed(() => computeOverview(props.checkins, props.habits));

/** 热力网格 */
const heatmap = computed(() =>
  buildHeatmap(countByDateOf(props.checkins), props.weeks ?? 12)
);

/** 近 30 天活跃占比，按百分比展示 */
const last30Text = computed(() => `${Math.round(overview.value.last30Rate * 100)}%`);
</script>

<style scoped lang="scss">
.habit-stats {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.habit-stats__cards {
  display: flex;
  gap: 10px;
}

.habit-stats__card {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.habit-stats__value {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-primary);
}

.habit-stats__label {
  font-size: 12px;
  color: var(--text-muted);
}

.habit-stats__heatmap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.habit-stats__heatmap-title {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
