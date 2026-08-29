<!--
  习惯卡片（原子组件）：只负责展示与派发事件，不碰 store、不碰 IPC。
  事件契约（改动 UI 时保持稳定）：checkin / undo / toggle / edit / delete
-->
<template>
  <article class="habit-card" :class="{ 'is-done': checked, 'is-off': !habit.enabled }">
    <div class="habit-card__bar" />

    <div class="habit-card__main">
      <div class="habit-card__title">
        <span class="habit-card__name">{{ habit.name }}</span>
        <span class="habit-card__badge">{{ freqLabel }}</span>
      </div>

      <p v-if="habit.remark" class="habit-card__remark">{{ habit.remark }}</p>

      <div class="habit-card__meta">
        <span>提醒 {{ timesLabel }}</span>
        <span>连续 <b>{{ streak.current }}</b> 天</span>
        <span>累计 {{ streak.total }} 天</span>
        <span>最长 {{ streak.longest }} 天</span>
      </div>
    </div>

    <div class="habit-card__actions">
      <el-switch
        :model-value="habit.enabled === 1"
        size="small"
        active-text="开"
        inactive-text="关"
        @change="onToggle"
      />
      <button
        class="habit-card__btn habit-card__btn--primary"
        :class="{ 'is-done': checked }"
        @click="checked ? emit('undo') : emit('checkin')"
      >
        {{ checked ? "撤销打卡" : "打卡" }}
      </button>
      <button class="habit-card__btn" @click="emit('edit')">编辑</button>
      <button class="habit-card__btn habit-card__btn--danger" @click="emit('delete')">删除</button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { HabitDef, StreakInfo } from "../types";

const props = defineProps<{
  habit: HabitDef;
  /** 该习惯的连击统计，由上层从 store 取好后传入 */
  streak: StreakInfo;
  /** 今天是否已打卡 */
  checked: boolean;
}>();

const emit = defineEmits<{
  (e: "checkin"): void;
  (e: "undo"): void;
  (e: "toggle", enabled: number): void;
  (e: "edit"): void;
  (e: "delete"): void;
}>();

/** 星期中文名，与提醒系统的 weekDays（0=周日）保持一致 */
const WEEK_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** 频率文案：每周时附上具体星期 */
const freqLabel = computed(() => {
  if (props.habit.freqType === "weekly") {
    const days = (props.habit.weekDays ?? []).slice().sort().map((d) => WEEK_LABELS[d] ?? "").filter(Boolean);
    return days.length ? `每周 ${days.join("、")}` : "每周";
  }
  return "每天";
});

/** 提醒时刻文案 */
const timesLabel = computed(() => {
  const times = props.habit.reminderTimes ?? [];
  return times.length ? times.join("、") : "未设置";
});

function onToggle(val: boolean | string | number) {
  emit("toggle", val ? 1 : 0);
}
</script>

<style scoped lang="scss">
.habit-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px 14px 20px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: var(--color-primary);
  }

  /* 今日已完成：整体置灰降透明度，左侧强调条改成功色作"已完成"标识，仍保留撤销能力 */
  &.is-done {
    opacity: 0.6;
    border-color: var(--border-subtle);
  }
  &.is-done .habit-card__bar {
    background: var(--color-success);
    opacity: 1;
  }

  /* 已停用：整体降透明度 */
  &.is-off {
    opacity: 0.6;
  }
}

/* 左侧强调条 */
.habit-card__bar {
  position: absolute;
  left: 8px;
  top: 14px;
  bottom: 14px;
  width: 3px;
  border-radius: 2px;
  background: var(--border-subtle);
  opacity: 0.7;
}

.habit-card__main {
  flex: 1;
  min-width: 0;
}

.habit-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.habit-card__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.habit-card__badge {
  flex: none;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--tag-bg-danger, rgba(99, 102, 241, 0.1));
  color: var(--color-primary);
  font-size: 12px;
}

.habit-card__remark {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.habit-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);

  b {
    color: var(--color-primary);
  }
}

.habit-card__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
}

.habit-card__btn {
  padding: 5px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &--primary {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: #fff;

    &:hover {
      background: var(--color-primary-hover);
      border-color: var(--color-primary-hover);
      color: #fff;
    }

    /* 已完成：改为次级样式，避免"再打一次"的错觉 */
    &.is-done {
      background: transparent;
      color: var(--text-secondary);
      border-color: var(--border-subtle);

      &:hover {
        border-color: var(--color-error);
        color: var(--color-error);
      }
    }
  }

  &--danger:hover {
    border-color: var(--color-error);
    color: var(--color-error);
  }
}
</style>
