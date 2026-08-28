<!--
  日历热力图（原子组件）：只负责渲染，数据由上层算好传入。
  列优先网格：一列 = 一周（周一起），共 weeks 列，最后一列包含结束日。
-->
<template>
  <div class="habit-heatmap">
    <div class="habit-heatmap__body">
      <div class="habit-heatmap__weekdays">
        <span v-for="(label, i) in WEEKDAY_LABELS" :key="i">{{ label }}</span>
      </div>
      <div class="habit-heatmap__grid">
        <div
          v-for="cell in cells"
          :key="cell.date"
          class="habit-heatmap__cell"
          :class="[`is-level-${levelOf(cell)}`, { 'is-future': cell.future }]"
          :title="titleOf(cell)"
        />
      </div>
    </div>

    <div class="habit-heatmap__legend">
      <span class="habit-heatmap__legend-text">少</span>
      <i v-for="n in 4" :key="n" class="habit-heatmap__cell" :class="`is-level-${n}`" />
      <span class="habit-heatmap__legend-text">多</span>
      <span class="habit-heatmap__range">{{ start }} ~ {{ end }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HeatCell } from "../utils/stats";

const props = defineProps<{
  cells: HeatCell[];
  /** 单日最大打卡次数，用于归一化着色 */
  max: number;
  start: string;
  end: string;
}>();

/** 左侧星期标签：一三五七显示文字，其余留空 */
const WEEKDAY_LABELS = ["一", "", "三", "", "五", "", "日"];

/** 0~4 级着色；未打卡为 0 级（底色），未来格子不参与 */
function levelOf(cell: HeatCell): number {
  if (cell.future || cell.count <= 0) return 0;
  const ratio = props.max > 0 ? cell.count / props.max : 1;
  return Math.min(4, Math.max(1, Math.ceil(ratio * 4)));
}

function titleOf(cell: HeatCell): string {
  if (cell.future) return "";
  return cell.count > 0 ? `${cell.date}：打卡 ${cell.count} 次` : `${cell.date}：未打卡`;
}
</script>

<style scoped lang="scss">
.habit-heatmap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.habit-heatmap__body {
  display: flex;
  gap: 6px;
}

.habit-heatmap__weekdays {
  display: grid;
  grid-template-rows: repeat(7, 12px);
  gap: 3px;
  font-size: 10px;
  line-height: 12px;
  color: var(--text-muted);
  text-align: right;
}

.habit-heatmap__grid {
  display: grid;
  // 列优先：每列 7 行 = 一周
  grid-auto-flow: column;
  grid-template-rows: repeat(7, 12px);
  grid-auto-columns: 12px;
  gap: 3px;
}

.habit-heatmap__cell {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: var(--bg-hover);

  &.is-level-1 { background: var(--color-primary); opacity: 0.25; }
  &.is-level-2 { background: var(--color-primary); opacity: 0.45; }
  &.is-level-3 { background: var(--color-primary); opacity: 0.7; }
  &.is-level-4 { background: var(--color-primary); opacity: 1; }

  // 未来日期：淡化，避免误以为漏打卡
  &.is-future {
    background: transparent;
    border: 1px dashed var(--border-subtle);
    opacity: 1;
  }
}

.habit-heatmap__legend {
  display: flex;
  align-items: center;
  gap: 4px;
}

.habit-heatmap__legend-text {
  font-size: 11px;
  color: var(--text-muted);
}

.habit-heatmap__range {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
}
</style>
