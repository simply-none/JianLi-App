<!--
  倒计时展示组件：按全局 displayStyle 渲染 4 种效果（不含圆环）。
  - 实时剩余 = end_time - now（模块级 250ms 时钟，天然抗节流漂移）。
  - 进度 = 剩余 / 总时长(duration)，用于进度条与数字细线。
  - 颜色取 row.color，空则回退主题主色（由 --cd-color 注入）。
  - finished 统一显示「已结束」；paused 文字转警告色。
-->
<template>
  <div class="cd-display" :class="`cd-display--${displayStyle}`" :style="{ '--cd-color': color }">
    <div v-if="isFinished" class="cd-display__done">已结束</div>

    <template v-else>
      <!-- 数字：大号等宽 + 底部细进度线 -->
      <template v-if="displayStyle === 'digital'">
        <div class="cd-digital" :style="textStyle">{{ formatted.text }}</div>
        <div class="cd-digital__bar">
          <span class="cd-digital__fill" :style="{ width: pct + '%' }" />
        </div>
      </template>

      <!-- 进度条：圆角进度 + 文字 -->
      <template v-else-if="displayStyle === 'bar'">
        <div class="cd-bar__track">
          <span class="cd-bar__fill" :style="{ width: pct + '%' }" />
        </div>
        <div class="cd-bar__text" :style="textStyle">{{ formatted.text }}</div>
      </template>

      <!-- 翻转：分格翻牌 -->
      <template v-else-if="displayStyle === 'flip'">
        <div class="cd-flip">
          <div v-for="(seg, i) in segments" :key="i" class="cd-flip__cell">
            <span class="cd-flip__num">{{ seg.v }}</span>
            <span class="cd-flip__label">{{ seg.l }}</span>
          </div>
        </div>
      </template>

      <!-- 渐变文字：双色渐变填充 -->
      <template v-else>
        <div class="cd-gradient">{{ formatted.text }}</div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useCountdown } from "@/store/useCountdown";
import { useCountdownTimer, formatRemaining } from "../composables/useCountdownTimer";
import type { CountdownRow } from "../types";

const props = defineProps<{ row: CountdownRow }>();
const store = useCountdown();
const { now } = useCountdownTimer();

const displayStyle = computed(() => store.displayStyle);
const color = computed(() => props.row.color || "var(--color-primary)");

const isFinished = computed(() => props.row.status === "finished");
const isPaused = computed(() => props.row.status === "paused");

const remainingMs = computed(() => {
  const r = props.row;
  if (r.status === "paused") return Math.max(0, r.paused_remaining);
  if (r.status === "finished") return 0;
  return Math.max(0, r.end_time - now.value);
});

const formatted = computed(() => formatRemaining(remainingMs.value));

const progress = computed(() => {
  if (!props.row.duration) return 0;
  return Math.min(1, Math.max(0, remainingMs.value / props.row.duration));
});

const pct = computed(() => Math.round(progress.value * 100));

/** 翻转分格：天(可选) / 时 / 分 / 秒 */
const segments = computed(() => {
  const f = formatRemaining(remainingMs.value);
  const segs: { l: string; v: string }[] = [];
  if (f.d > 0) segs.push({ l: "天", v: String(f.d).padStart(2, "0") });
  segs.push({ l: "时", v: String(f.h).padStart(2, "0") });
  segs.push({ l: "分", v: String(f.m).padStart(2, "0") });
  segs.push({ l: "秒", v: String(f.s).padStart(2, "0") });
  return segs;
});

const textStyle = computed(() => {
  if (isPaused.value) return { color: "var(--color-warning)" };
  return { color: color.value };
});
</script>

<style scoped lang="scss">
.cd-display {
  --cd-color: var(--color-primary);
  width: 100%;
  font-variant-numeric: tabular-nums;

  &__done {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-muted);
  }

  /* 数字 */
  &--digital {
    .cd-digital {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
      line-height: 1.2;
    }
    .cd-digital__bar {
      margin-top: 6px;
      height: 4px;
      border-radius: 999px;
      background: var(--bg-hover);
      overflow: hidden;
    }
    .cd-digital__fill {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: var(--cd-color);
      transition: width 0.25s linear;
    }
  }

  /* 进度条 */
  &--bar {
    .cd-bar__track {
      height: 10px;
      border-radius: 999px;
      background: var(--bg-hover);
      overflow: hidden;
    }
    .cd-bar__fill {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: var(--cd-color);
      transition: width 0.25s linear;
    }
    .cd-bar__text {
      margin-top: 6px;
      font-size: 15px;
      font-weight: 600;
    }
  }

  /* 翻转 */
  &--flip {
    .cd-flip {
      display: flex;
      gap: 6px;
      align-items: stretch;
    }
    .cd-flip__cell {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 6px 4px;
      border-radius: 8px;
      background: var(--bg-hover);
      border: 1px solid var(--border-subtle);
    }
    .cd-flip__num {
      font-size: 18px;
      font-weight: 700;
      line-height: 1;
      color: var(--cd-color);
    }
    .cd-flip__label {
      font-size: 10px;
      color: var(--text-muted);
    }
  }

  /* 渐变文字 */
  &--gradient {
    .cd-gradient {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
      background-image: linear-gradient(90deg, var(--cd-color), var(--color-info));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
  }
}
</style>
