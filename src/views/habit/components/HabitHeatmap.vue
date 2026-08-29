<!--
  习惯打卡矩阵热力图（ECharts 实现）。
  - 横轴：日期（最近 weeks 周，含今天），底部滑块可左右平移。
  - 纵轴：各习惯名称。
  - 单元格颜色：当天是否打卡（0 = 未打卡，1 = 已打卡），避免某天打卡次数过多形成突兀高柱。
  - 主题色从 CSS 变量派生，自动适配明暗与全部内置主题。
  数据由 props 传入（不直接读 store），纯展示，便于复用与测试。
-->
<template>
  <div class="habit-heatmap">
    <div v-if="!hasData" class="habit-heatmap__empty">还没有习惯，先去添加一个吧～</div>
    <div
      v-else
      ref="chartRef"
      class="habit-heatmap__chart"
      :style="{ height: chartHeight + 'px' }"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import * as echarts from "echarts";
import { storeToRefs } from "pinia";
import useThemeStore from "@/store/useTheme";
import { installPassiveScrollListeners } from "@/utils/passiveEvents";
import type { HabitCheckin, HabitDef } from "../types";
import { shiftDateStr, todayStr } from "../utils/streak";
import { weekdayIndex } from "../utils/stats";

// ECharts 在 init 时为图表容器注册非 passive 的 wheel/mousewheel 监听器，
// 触发 Chrome "[Violation] Added non-passive event listener..." 警告。
installPassiveScrollListeners();

const { currentTheme } = storeToRefs(useThemeStore());

const props = defineProps<{
  /** 习惯列表（纵轴） */
  habits: HabitDef[];
  /** 打卡记录 */
  checkins: HabitCheckin[];
  /** 展示的周数，默认 12 周（约 3 个月） */
  weeks?: number;
}>();

const hasData = computed(() => props.habits.length > 0);

/** 每行习惯固定高度，保证单元格可读；整体高度随习惯数量增长 */
const chartHeight = computed(() => 20 + 64 + Math.max(props.habits.length, 1) * 26);

const chartRef = ref<HTMLElement | null>(null);
let chart: echarts.ECharts | null = null;
let ro: ResizeObserver | null = null;

// ---- 主题色派生（读 CSS 变量，自动适配全部主题 / 明暗） ----
function readVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6) return null;
  const n = parseInt(full, 16);
  if (isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 两个颜色按比例混合（t=0 取 a，t=1 取 b） */
function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a; // 非 hex（如 rgba）时退回 a，避免出错
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return "#" + [r, g, bl].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function buildOption(): echarts.EChartsOption {
  const weeks = props.weeks ?? 12;
  const end = todayStr();
  // 与 buildHeatmap 一致的起止：结束日所在周的周一，再往前推 weeks-1 周
  const endWeekday = weekdayIndex(end);
  const lastColMonday = shiftDateStr(end, -endWeekday);
  const start = shiftDateStr(lastColMonday, -(weeks - 1) * 7);

  // 生成日期序列（含今天）
  const dates: string[] = [];
  const dateSet = new Set<string>();
  {
    let cur = start;
    while (cur <= end) {
      dates.push(cur);
      dateSet.add(cur);
      cur = shiftDateStr(cur, 1);
    }
  }

  // 打卡计数：habitKey#date -> 实际次数（仅统计区间内的记录）
  const countMap: Record<string, number> = {};
  for (const c of props.checkins) {
    if (!c?.date || !c?.habitKey) continue;
    if (!dateSet.has(c.date)) continue;
    const k = `${c.habitKey}#${c.date}`;
    countMap[k] = (countMap[k] ?? 0) + 1;
  }

  // 热力图只用「是否打卡」做颜色（0/1），防止某天次数过高拉高 visualMap
  // tooltip 仍显示真实次数
  const displayMap: Record<string, number> = {};
  for (const [k, v] of Object.entries(countMap)) {
    displayMap[k] = v > 0 ? 1 : 0;
  }

  // 矩阵数据：[xIdx, yIdx, displayValue]
  const data: [number, number, number][] = [];
  props.habits.forEach((h, yi) => {
    dates.forEach((d, xi) => {
      data.push([xi, yi, displayMap[`${h.key}#${d}`] ?? 0]);
    });
  });

  // 主题色
  const primary = readVar("--color-primary", "#6366f1");
  const empty = readVar("--bg-hover", "#ebedf0");
  const labelColor = readVar("--text-muted", "#6b7280");
  const border = readVar("--border-subtle", "#e5e7eb");
  const tooltipBg = readVar("--bg-card", "#ffffff");
  const tooltipText = readVar("--text-primary", "#1f2937");
  // 二元色阶：未打卡（空）→ 已打卡（主色）
  const ramp = [empty, primary];

  return {
    backgroundColor: "transparent",
    animation: false,
    tooltip: {
      position: "inside",
      confine: true,
      enterable: false,
      backgroundColor: tooltipBg,
      borderColor: border,
      extraCssText: "max-width: 220px; white-space: normal; word-break: break-all;",
      textStyle: { color: tooltipText },
      formatter: (p: any) => {
        const xi = p.data[0] as number;
        const yi = p.data[1] as number;
        const habit = props.habits[yi];
        const date = dates[xi] ?? "";
        const name = habit?.name ?? "";
        const realV = countMap[`${habit?.key}#${date}`] ?? 0;
        if (!realV) return `${name}<br/>${date}<br/>未打卡`;
        return `${name}<br/>${date}<br/>打卡 ${realV} 次`;
      },
    },
    grid: { left: 92, right: 16, top: 20, bottom: 64 },
    xAxis: {
      type: "category",
      data: dates,
      position: "top",
      boundaryGap: true,
      axisLabel: { color: labelColor, fontSize: 10, hideOverlap: true },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "category",
      data: props.habits.map((h) => h.name),
      axisLabel: { color: labelColor, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    visualMap: {
      // 仅做颜色映射（0=未打卡 / 1=已打卡），控件本身对二元信息无用，故隐藏
      show: false,
      min: 0,
      max: 1,
      type: "continuous",
      inRange: { color: ramp },
    },
    dataZoom: [
      {
        type: "slider",
        xAxisIndex: 0,
        height: 16,
        bottom: 8,
        borderColor: border,
        fillerColor: "rgba(99,102,241,0.12)",
        handleStyle: { color: primary },
        textStyle: { color: labelColor, fontSize: 10 },
        labelFormatter: (v: number) => dates[Math.round(v)] ?? "",
      },
      { type: "inside", xAxisIndex: 0 },
    ],
    series: [
      {
        name: "打卡",
        type: "heatmap",
        data,
        label: { show: false },
        itemStyle: { borderColor: border, borderWidth: 1, borderRadius: 2 },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.25)" } },
      },
    ],
  };
}

function render() {
  if (!hasData.value) {
    if (chart) {
      chart.dispose();
      chart = null;
    }
    return;
  }
  if (!chartRef.value || chartRef.value.offsetWidth === 0) return;
  if (!chart) chart = echarts.init(chartRef.value);
  chart.setOption(buildOption(), true);

  if (ro) ro.disconnect();
  ro = new ResizeObserver(() => chart?.resize());
  ro.observe(chartRef.value);
}

function handleResize() {
  chart?.resize();
}

onMounted(() => {
  if (hasData.value) nextTick(render);
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  ro?.disconnect();
  ro = null;
  chart?.dispose();
  chart = null;
});

// 数据 / 周数 / 主题变化后重绘（主题切换时重新读 CSS 变量取色）
watch(
  () => [props.habits, props.checkins, props.weeks, currentTheme.value],
  () => nextTick(render),
);
</script>

<style scoped lang="scss">
.habit-heatmap {
  width: 100%;
}

.habit-heatmap__chart {
  width: 100%;
}

.habit-heatmap__empty {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}
</style>
