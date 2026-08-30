<!--
  大计时器视图：居中展示选中倒计时的剩余时间 + 进度环 + 控制条。
  剩余时间实时由 useCountdownTimer 的 now 驱动；暂停态显示冻结的 paused_remaining。
-->
<template>
  <div v-if="row" class="countdown-timer" :style="{ '--cd-color': row.color || 'var(--color-primary)' }">
    <div class="countdown-timer__ring">
      <CountdownRing :progress="progress" :color="row.color || 'var(--color-primary)'" :size="240" :stroke="14" />
      <div class="countdown-timer__center">
        <div class="countdown-timer__name">{{ row.name }}</div>
        <div class="countdown-timer__digits">{{ remainingText }}</div>
        <div class="countdown-timer__status">
          <span class="tag" :class="`tag--${row.status}`">{{ statusLabel }}</span>
        </div>
      </div>
    </div>

    <div class="countdown-timer__controls">
      <template v-if="row.status === 'running'">
        <button class="cd-btn" type="button" @click="onPause">
          <LucideIcon name="PauseIcon" :size="16" /> 暂停
        </button>
        <button class="cd-btn cd-btn--ghost" type="button" @click="onReset">
          <LucideIcon name="RotateCcwIcon" :size="16" /> 重置
        </button>
      </template>
      <template v-else-if="row.status === 'paused'">
        <button class="cd-btn" type="button" @click="onResume">
          <LucideIcon name="PlayIcon" :size="16" /> 继续
        </button>
        <button class="cd-btn cd-btn--ghost" type="button" @click="onReset">
          <LucideIcon name="RotateCcwIcon" :size="16" /> 重置
        </button>
      </template>
      <template v-else>
        <button class="cd-btn cd-btn--ghost" type="button" @click="onReset">
          <LucideIcon name="RotateCcwIcon" :size="16" /> 重新计时
        </button>
      </template>
      <button class="cd-btn cd-btn--danger" type="button" @click="onDelete">
        <LucideIcon name="Trash2Icon" :size="16" /> 删除
      </button>
    </div>
  </div>

  <div v-else class="countdown-timer countdown-timer--empty">
    <el-empty description="还没有倒计时，点左上角「新建倒计时」开始" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import CountdownRing from "./CountdownRing.vue";
import { useCountdown } from "@/store/useCountdown";
import { useCountdownTimer, formatRemaining } from "../composables/useCountdownTimer";
import type { CountdownRow } from "../types";

const props = defineProps<{ row: CountdownRow | null }>();
const store = useCountdown();
const { now } = useCountdownTimer();

const statusLabel = computed(() => {
  if (!props.row) return "";
  return { running: "进行中", paused: "已暂停", finished: "已结束" }[props.row.status] || props.row.status;
});

/** 当前剩余毫秒：暂停态用冻结值；结束态为 0；运行态实时算 */
const remainingMs = computed(() => {
  const r = props.row;
  if (!r) return 0;
  if (r.status === "paused") return r.paused_remaining;
  if (r.status === "finished") return 0;
  return Math.max(0, r.end_time - now.value);
});

const remainingText = computed(() => formatRemaining(remainingMs.value).text);

/** 进度：剩余 / 原始时长（环随时间耗尽） */
const progress = computed(() => {
  const r = props.row;
  if (!r || !r.duration) return 0;
  return remainingMs.value / r.duration;
});

function onPause() {
  const r = props.row;
  if (!r) return;
  store.pause(r.key, remainingMs.value);
}

function onResume() {
  const r = props.row;
  if (!r) return;
  store.start(r.key, r.paused_remaining);
}

function onReset() {
  const r = props.row;
  if (!r) return;
  store.reset(r.key, r.duration);
}

function onDelete() {
  const r = props.row;
  if (!r) return;
  ElMessageBox.confirm(`确定删除倒计时「${r.name}」？`, "删除确认", {
    type: "warning",
    confirmButtonText: "删除",
    cancelButtonText: "取消",
  })
    .then(() => store.remove(r.key))
    .catch(() => {});
}
</script>

<style scoped lang="scss">
.countdown-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 24px;

  &--empty {
    color: var(--text-muted);
  }

  &__ring {
    position: relative;
    width: 240px;
    height: 240px;
  }

  &__center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  &__name {
    font-size: 15px;
    color: var(--text-secondary);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__digits {
    font-size: 30px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--cd-color);
    letter-spacing: 1px;
  }

  &__status {
    margin-top: 2px;
  }

  &__controls {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
}

.tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--bg-hover);

  &--running {
    color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 14%, transparent);
  }
  &--paused {
    color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 14%, transparent);
  }
  &--finished {
    color: var(--text-muted);
  }
}

.cd-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-btn, 8px);
  border: 1px solid transparent;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  font-size: 13px;

  &:hover {
    background: var(--color-primary-hover, var(--color-primary));
    filter: brightness(1.05);
  }

  &--ghost {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border-subtle);
  }

  &--danger {
    background: transparent;
    color: var(--color-error);
    border-color: color-mix(in srgb, var(--color-error) 40%, transparent);
  }
}
</style>
