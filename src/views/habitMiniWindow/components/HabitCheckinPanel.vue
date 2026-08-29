<!--
  打卡面板：小窗内的主体交互。
  数据全部来自 useHabit store；自身只负责展示、打卡与关闭。

  小窗通用约定（踩过的坑，别改回去）：
  1. 顶部栏用纯 CSS `-webkit-app-region: drag` 拖拽，不用 JS 监听；
     栏内 button / input 必须显式 `no-drag`，否则点不动。
  2. 不做 blur 自动关闭（透明窗边缘点击会穿透导致误关）。
  3. 「唤出即刷新」用 visibilitychange，不用 window focus（后者输入中会反复触发）。
  4. Esc 监听挂 document，不能挂局部元素。
-->
<template>
  <div class="checkin-panel">
    <header class="checkin-panel__header">
      <div class="checkin-panel__title">
        <span class="checkin-panel__name">今日打卡</span>
        <span class="checkin-panel__progress">{{ doneCount }} / {{ enabledHabits.length }}</span>
      </div>
      <button class="checkin-panel__close" title="关闭 (Esc)" @click="close">×</button>
    </header>

    <div class="checkin-panel__body">
      <p v-if="store.loading" class="checkin-panel__empty">加载中…</p>

      <p v-else-if="!enabledHabits.length" class="checkin-panel__empty">
        还没有启用的习惯，先去「习惯打卡」页面添加吧。
      </p>

      <ul v-else class="checkin-panel__list">
        <li
          v-for="habit in enabledHabits"
          :key="habit.key"
          class="checkin-item"
          :class="{ 'is-done': store.isCheckedToday(habit.key) }"
        >
          <div class="checkin-item__main">
            <span class="checkin-item__name">{{ habit.name }}</span>
            <span class="checkin-item__meta">
              {{ habit.freqType === "weekly" ? "每周" : "每天" }}
              · 连续 {{ store.streakOf(habit.key).current }} 天
            </span>
          </div>
          <button
            class="checkin-item__btn"
            :class="{ 'is-done': store.isCheckedToday(habit.key) }"
            @click="onToggleCheck(habit)"
          >
            {{ store.isCheckedToday(habit.key) ? "已完成" : "打卡" }}
          </button>
        </li>
      </ul>
    </div>

    <footer class="checkin-panel__footer">
      <span>Esc 关闭 · 顶部可拖动</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import useHabitStore from "@/store/useHabit";
import type { HabitDef } from "@/views/habit/types";

const store = useHabitStore();

/** 只展示启用的习惯 */
const enabledHabits = computed(() => store.habits.filter((h) => h.enabled === 1));

/** 今日已完成数量 */
const doneCount = computed(
  () => enabledHabits.value.filter((h) => store.isCheckedToday(h.key)).length
);

/** 打卡 / 撤销（面板里点已完成的可直接撤销，避免误触后没法回退） */
async function onToggleCheck(habit: HabitDef) {
  if (store.isCheckedToday(habit.key)) {
    await store.undoCheckIn(habit.key);
  } else {
    await store.checkIn(habit.key, { source: "miniWindow" });
  }
}

function close() {
  // 直接发 IPC 隐藏小窗（与剪贴板小窗一致）：
  // 小窗是 isSecondWindow 独立渲染进程，有自己的 Pinia 实例，
  // 走 store 的 setShowHabitWindow → watcher 再发 IPC 在本进程里不可靠；
  // 直接发 hide-new-window 最稳，且窗口留着复用（hide 而非 destroy）。
  window.ipcRenderer?.send("hide-new-window", "habitMiniWindow");
}

/** Esc 关闭：必须挂 document，挂局部元素会在失焦后失效 */
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") close();
}

/** 唤出即刷新：用 visibilitychange，输入过程中不会误触发 */
function onVisibilityChange() {
  if (!document.hidden) store.load({ sync: false });
}

onMounted(() => {
  // 小窗只展示与打卡，不做提醒同步
  store.load({ sync: false });
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("visibilitychange", onVisibilityChange);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  document.removeEventListener("visibilitychange", onVisibilityChange);
});
</script>

<style scoped lang="scss">
.checkin-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  // 可拖区默认禁止选中文字，否则按下会变划选而不是拖窗口
  -webkit-user-select: none;
  user-select: none;
}

.checkin-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
  // 纯 CSS 拖拽
  -webkit-app-region: drag;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.checkin-panel__title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.checkin-panel__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.checkin-panel__progress {
  font-size: 12px;
  color: var(--text-muted);
}

.checkin-panel__close {
  flex: none;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  // 拖拽区内的按钮必须显式 no-drag
  -webkit-app-region: no-drag;

  &:hover {
    background: var(--bg-hover);
    color: var(--color-error);
  }
}

.checkin-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.checkin-panel__empty {
  margin: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.checkin-panel__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.checkin-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-base);
  transition: border-color 0.2s, background 0.2s;

  &.is-done {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }
}

.checkin-item__main {
  flex: 1;
  min-width: 0;
}

.checkin-item__name {
  display: block;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checkin-item__meta {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-muted);
}

.checkin-item__btn {
  flex: none;
  padding: 4px 12px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-btn);
  background: var(--color-primary);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  -webkit-app-region: no-drag;

  &:hover {
    background: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
  }

  // 已完成：次级样式 + hover 变撤销色
  &.is-done {
    border-color: var(--border-subtle);
    background: transparent;
    color: var(--text-secondary);

    &:hover {
      border-color: var(--color-error);
      color: var(--color-error);
    }
  }
}

.checkin-panel__footer {
  padding: 6px 12px;
  border-top: 1px solid var(--border-subtle);
  font-size: 11px;
  color: var(--text-muted);
  // 底部提示栏也设为可拖，扩大抓握区
  -webkit-app-region: drag;
}
</style>
