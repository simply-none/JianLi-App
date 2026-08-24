<template>
  <div class="reminder-page">
    <div class="section-header">
      <h2 class="section-title">
        <LucideIcon name="BellRing" />
        提醒
      </h2>
      <el-button type="primary" size="small" @click="openDialog()" class="add-btn">
        <LucideIcon name="AlarmClockPlus" />
        新增提醒
      </el-button>
    </div>

    <ReminderList
      :reminders="remindersCc"
      @edit="openDialog"
      @delete="onDelete"
      @toggle="onToggle"
    />

    <ReminderDialog
      v-model:visible="dialogVisible"
      :editing="editingItem"
      @submit="onSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { storeToRefs } from "pinia";
import LucideIcon from "@/components/LucideIcon.vue";
import ReminderList from "./components/ReminderList.vue";
import ReminderDialog from "./components/ReminderDialog.vue";
import useNewReminder from "@/store/useNewReminder";
import type { TipsReminder } from "./types";

const reminderStore = useNewReminder();
const { remindersC } = storeToRefs(reminderStore);
const { saveReminder, deleteReminder, toggleReminder } = reminderStore;

const remindersCc = ref<TipsReminder[]>(remindersC.value);
watch(
  () => remindersC.value,
  (v) => {
    remindersCc.value = v;
  },
  { deep: true }
);

const dialogVisible = ref(false);
const editingItem = ref<TipsReminder | null>(null);

function openDialog(item?: TipsReminder) {
  editingItem.value = item ? JSON.parse(JSON.stringify(item)) : null;
  dialogVisible.value = true;
}

function onSubmit(form: TipsReminder) {
  saveReminder(form).catch((err) => {
    console.error("保存提醒失败:", err);
  });
}

function onDelete(item: TipsReminder) {
  deleteReminder(item.id);
}

function onToggle(id: string, enabled: number) {
  toggleReminder(id, enabled);
}

onMounted(() => {
  // 补偿启动竞态：确保拿到多状态提醒的当前运行时
  import("@/hooks/useTipsBridge").then((m) => m.requestTipsState("pomodoro"));
});
</script>

<style scoped lang="scss">
.reminder-page {
  padding: 16px;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  margin: 0;
}
</style>
