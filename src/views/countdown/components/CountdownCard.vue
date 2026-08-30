<!--
  倒计时卡片（列表项）：展示名称、剩余时间、状态与细进度条。
  点击选中（用于大计时器）；行内提供暂停/继续快捷按钮。
-->
<template>
  <div class="cd-card" :class="{ 'cd-card--active': active }" @click="$emit('select', row.key)">
    <div class="cd-card__head">
      <span class="cd-card__name">{{ row.name }}</span>
      <span class="cd-card__tag" :class="`cd-card__tag--${row.status}`">
        {{ { running: "进行中", paused: "已暂停", finished: "已结束" }[row.status] }}
      </span>
    </div>

    <div class="cd-card__time">{{ remainingText }}</div>

    <div class="cd-card__bar">
      <div class="cd-card__bar-fill" :style="{ width: progressPct + '%', background: row.color || 'var(--color-primary)' }" />
    </div>

    <div class="cd-card__actions" @click.stop>
      <button
        v-if="row.status === 'running'"
        class="cd-card__btn"
        type="button"
        title="暂停"
        @click="$emit('pause', row)"
      >
        <LucideIcon name="PauseIcon" :size="14" />
      </button>
      <button
        v-else-if="row.status === 'paused'"
        class="cd-card__btn"
        type="button"
        title="继续"
        @click="$emit('resume', row)"
      >
        <LucideIcon name="PlayIcon" :size="14" />
      </button>
      <button
        v-if="row.status !== 'finished'"
        class="cd-card__btn"
        type="button"
        title="重置"
        @click="$emit('reset', row)"
      >
        <LucideIcon name="RotateCcwIcon" :size="14" />
      </button>
      <button class="cd-card__btn cd-card__btn--danger" type="button" title="删除" @click="$emit('delete', row)">
        <LucideIcon name="Trash2Icon" :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useCountdownTimer, formatRemaining } from "../composables/useCountdownTimer";
import type { CountdownRow } from "../types";

const props = defineProps<{ row: CountdownRow; active?: boolean }>();
defineEmits<{
  (e: "select", key: string): void;
  (e: "pause", row: CountdownRow): void;
  (e: "resume", row: CountdownRow): void;
  (e: "reset", row: CountdownRow): void;
  (e: "delete", row: CountdownRow): void;
}>();

const { now } = useCountdownTimer();

const remainingMs = computed(() => {
  if (props.row.status === "paused") return props.row.paused_remaining;
  if (props.row.status === "finished") return 0;
  return Math.max(0, props.row.end_time - now.value);
});

const remainingText = computed(() => formatRemaining(remainingMs.value).text);

const progressPct = computed(() => {
  if (!props.row.duration) return 0;
  return Math.min(100, (remainingMs.value / props.row.duration) * 100);
});
</script>

<style scoped lang="scss">
.cd-card {
  position: relative;
  padding: 12px 14px;
  border-radius: var(--radius-card, 12px);
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover {
    border-color: color-mix(in srgb, var(--color-primary) 40%, var(--border-subtle));
  }

  &--active {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 18%, transparent);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__tag {
    flex: none;
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 999px;
    color: var(--text-muted);
    background: var(--bg-hover);

    &--running {
      color: var(--color-success);
      background: color-mix(in srgb, var(--color-success) 14%, transparent);
    }
    &--paused {
      color: var(--color-warning);
      background: color-mix(in srgb, var(--color-warning) 14%, transparent);
    }
  }

  &__time {
    margin-top: 6px;
    font-size: 18px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--text-primary);
  }

  &__bar {
    margin-top: 8px;
    height: 6px;
    border-radius: 999px;
    background: var(--bg-hover);
    overflow: hidden;
  }

  &__bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.25s linear;
  }

  &__actions {
    position: absolute;
    top: 10px;
    right: 10px;
    display: none;
    gap: 4px;
  }

  &:hover &__actions {
    display: flex;
  }

  &__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 6px;
    background: var(--bg-hover);
    color: var(--text-secondary);
    cursor: pointer;

    &:hover {
      background: var(--color-primary);
      color: #fff;
    }

    &--danger:hover {
      background: var(--color-error);
    }
  }
}
</style>
