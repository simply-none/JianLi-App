<!--
  倒计时行：三栏布局。
  左 = 名称 + 状态/模式标签；中 = 实时展示(CountdownDisplay)；右 = 操作区。
  点击行触发 select；操作按钮 @click.stop 避免误触选中。
-->
<template>
  <div class="cd-row" :class="{ 'cd-row--active': active }" @click="$emit('select', row.key)">
    <div class="cd-row__left">
      <div class="cd-row__name" :title="row.name">{{ row.name }}</div>
      <div class="cd-row__tags">
        <span class="cd-tag" :class="`cd-tag--${row.status}`">{{ statusLabel }}</span>
        <span class="cd-tag cd-tag--mode">{{ modeLabel }}</span>
      </div>
    </div>

    <div class="cd-row__mid">
      <CountdownDisplay :row="row" />
    </div>

    <div class="cd-row__ops" @click.stop>
      <button
        v-if="row.status === 'running'"
        class="cd-op"
        type="button"
        title="暂停"
        @click="$emit('pause', row)"
      >
        暂停
      </button>
      <button
        v-else-if="row.status === 'paused'"
        class="cd-op"
        type="button"
        title="继续"
        @click="$emit('resume', row)"
      >
        继续
      </button>
      <button
        v-if="row.status !== 'running'"
        class="cd-op"
        type="button"
        title="重新开始"
        @click="$emit('reset', row)"
      >
        重置
      </button>
      <button class="cd-op" type="button" title="编辑" @click="$emit('edit', row)">编辑</button>
      <button class="cd-op cd-op--danger" type="button" title="删除" @click="$emit('delete', row)">
        删除
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import CountdownDisplay from "./CountdownDisplay.vue";
import type { CountdownRow, CountdownStatus, CountdownMode } from "../types";

const props = defineProps<{ row: CountdownRow; active?: boolean }>();

const statusMap: Record<CountdownStatus, string> = {
  running: "进行中",
  paused: "已暂停",
  finished: "已结束",
};
const modeMap: Record<CountdownMode, string> = {
  datetime: "时刻",
  duration: "时长",
};

// 用 computed 以响应行状态切换（暂停/继续/结束）
const statusLabel = computed(() => statusMap[props.row.status]);
const modeLabel = computed(() => modeMap[props.row.mode]);

defineEmits<{
  (e: "select", key: string): void;
  (e: "pause", row: CountdownRow): void;
  (e: "resume", row: CountdownRow): void;
  (e: "reset", row: CountdownRow): void;
  (e: "edit", row: CountdownRow): void;
  (e: "delete", row: CountdownRow): void;
}>();
</script>

<style scoped lang="scss">
.cd-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-radius: var(--radius-card, 12px);
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--color-primary);
  }

  &--active {
    border-color: var(--color-primary);
    background: var(--bg-hover);
  }

  &__left {
    flex: 0 0 160px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__tags {
    display: flex;
    gap: 6px;
  }

  &__mid {
    flex: 1;
    min-width: 0;
  }

  &__ops {
    flex: 0 0 auto;
    display: flex;
    gap: 6px;
  }
}

.cd-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  white-space: nowrap;

  &--running {
    background: color-mix(in srgb, var(--color-success) 18%, transparent);
    color: var(--color-success);
  }
  &--paused {
    background: color-mix(in srgb, var(--color-warning) 18%, transparent);
    color: var(--color-warning);
  }
  &--finished {
    background: var(--bg-hover);
    color: var(--text-muted);
  }
  &--mode {
    background: var(--bg-hover);
    color: var(--text-muted);
  }
}

.cd-op {
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &--danger:hover {
    border-color: var(--color-error);
    color: var(--color-error);
  }
}
</style>
