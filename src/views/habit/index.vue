<!--
  通用习惯打卡 —— 主页面（薄壳）。
  只负责组装：拉 store 数据 → 下发给原子组件 → 承接事件回调。
  所有数据操作都在 src/store/useHabit.ts，所有 IPC 都在 api/habitApi.ts。
-->
<template>
  <div class="habit-page">
    <header class="habit-page__header">
      <div class="habit-page__title">
        <h2>习惯打卡</h2>
        <p>
          共 {{ store.habits.length }} 个习惯，今日已打卡 {{ doneTodayCount }} 个 ·
          提醒时刻自动同步给提醒引擎统一调度
        </p>
      </div>
      <div class="habit-page__actions">
        <button class="habit-page__btn" @click="openCheckinWindow">打开打卡小窗</button>
        <button class="habit-page__create" @click="openCreate">+ 新建习惯</button>
      </div>
    </header>

    <HabitStats :habits="store.habits" :checkins="store.checkins" />

    <div v-if="store.loading" class="habit-page__empty">加载中…</div>

    <div v-else-if="!store.habits.length" class="habit-page__empty">
      还没有习惯，点击右上角「新建习惯」开始吧。
    </div>

    <div v-else class="habit-page__list">
      <HabitCard
        v-for="habit in store.habits"
        :key="habit.key"
        :habit="habit"
        :streak="store.streakOf(habit.key)"
        :checked="store.isCheckedToday(habit.key)"
        @checkin="onCheckIn(habit)"
        @undo="onUndo(habit)"
        @toggle="(enabled) => onToggle(habit, enabled)"
        @edit="openEdit(habit)"
        @delete="onDelete(habit)"
      />
    </div>

    <HabitEditDialog v-model="dialogVisible" :habit="editing" @save="onSave" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import useHabitStore from "@/store/useHabit";
import useWindowMode from "@/store/useWindowMode";
import type { HabitDef } from "./types";
import HabitCard from "./components/HabitCard.vue";
import HabitEditDialog from "./components/HabitEditDialog.vue";
import HabitStats from "./components/HabitStats.vue";

const store = useHabitStore();

/** 弹窗是否可见 */
const dialogVisible = ref(false);
/** 正在编辑的习惯，null 表示新增 */
const editing = ref<HabitDef | null>(null);

/** 今日已打卡数量 */
const doneTodayCount = computed(() => store.checkedTodayKeys.size);

onMounted(() => {
  store.load();
});

function openCreate() {
  editing.value = null;
  dialogVisible.value = true;
}

/** 手动唤起打卡小窗（不必等提醒到点） */
function openCheckinWindow() {
  useWindowMode().openHabitWindow();
}

function openEdit(habit: HabitDef) {
  editing.value = habit;
  dialogVisible.value = true;
}

async function onSave(payload: Partial<HabitDef> & { name: string }) {
  const ok = await store.saveHabit(payload);
  ElMessage[ok ? "success" : "error"](ok ? "保存成功" : "保存失败");
}

async function onCheckIn(habit: HabitDef) {
  const results = await store.checkIn(habit.key, { source: "manual" });
  if (!results) {
    ElMessage.error("打卡失败");
    return;
  }
  reportChain(results, `「${habit.name}」打卡成功`);
}

async function onUndo(habit: HabitDef) {
  const results = await store.undoCheckIn(habit.key);
  if (!results) {
    ElMessage.error("撤销失败");
    return;
  }
  reportChain(results, "已撤销今日打卡");
}

/**
 * 提示打卡结果 + 串接动作结果。
 * 打卡本身已成功，串接失败只降级提示，不改变主流程结论。
 */
function reportChain(results: { ok: boolean; message: string }[], successText: string) {
  const failed = results.filter((r) => !r.ok);
  if (!failed.length) {
    ElMessage.success(successText);
    return;
  }
  ElMessage.warning(
    `${successText}，但串接动作未全部完成：${failed.map((f) => f.message).join("；")}`
  );
}

async function onToggle(habit: HabitDef, enabled: number) {
  await store.toggleHabit(habit.key, enabled);
}

async function onDelete(habit: HabitDef) {
  try {
    await ElMessageBox.confirm(
      `删除「${habit.name}」会同时清除它的全部打卡记录与对应提醒，确定继续？`,
      "删除习惯",
      { type: "warning" }
    );
  } catch {
    return; // 用户取消
  }
  await store.removeHabit(habit.key);
  ElMessage.success("已删除");
}
</script>

<style scoped lang="scss">
.habit-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.habit-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  p {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--text-muted);
  }
}

.habit-page__actions {
  flex: none;
  display: flex;
  gap: 8px;
}

.habit-page__btn {
  padding: 7px 14px;
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
}

.habit-page__create {
  flex: none;
  padding: 7px 14px;
  border: none;
  border-radius: var(--radius-btn);
  background: var(--color-primary);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--color-primary-hover);
  }
}

.habit-page__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.habit-page__empty {
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}
</style>
