<template>
  <app-dialog
    v-model="visibleModel"
    :title="isEdit ? '编辑提醒' : '新增提醒'"
    width="520px"
    class="reminder-dialog"
    @close="resetForm"
  >
    <div class="dialog-form">
      <div class="form-item">
        <span class="form-label">标题</span>
        <el-input v-model="form.title" placeholder="请输入提醒标题" class="form-input" />
      </div>

      <div class="form-item">
        <span class="form-label">提醒内容</span>
        <el-input v-model="form.content" type="textarea" :rows="2" placeholder="提醒正文（可空）" class="form-input" />
      </div>

      <div class="form-item">
        <span class="form-label">提醒方式</span>
        <el-radio-group v-model="form.mode" :disabled="isEdit">
          <el-radio-button value="time">定点提醒</el-radio-button>
          <el-radio-button value="interval">周期提醒</el-radio-button>
          <el-radio-button value="stateful">多状态提醒</el-radio-button>
        </el-radio-group>
      </div>

      <div class="form-item">
        <span class="form-label">开始时间</span>
        <el-date-picker
          v-model="startTimeDate"
          type="datetime"
          format="YYYY-MM-DD HH:mm"
          value-format="x"
          :placeholder="isEdit && form.mode === 'stateful' ? '留空=沿用原开始时间（按新时长重算轮次）' : '首次生效时间（留空=立即）'"
          class="form-select"
        />
        <span class="form-hint">{{ form.mode === 'stateful'
          ? '多状态：开始时间=第1个状态进入时刻；编辑时留空则基于原开始时间用新时长重算当前轮次，整轮过期则开新一轮'
          : '周期：开始时间+间隔推算下次；多状态：开始时间=第1个状态进入时刻' }}</span>
      </div>

      <TimeRuleForm v-if="form.mode === 'time'" :form="form" />
      <IntervalForm v-else-if="form.mode === 'interval'" :form="form" />
      <StatefulForm v-else-if="form.mode === 'stateful'" :form="form" />

      <IdleTimeForm :form="form" />

      <div class="form-item">
        <span class="form-label">是否结束后记录</span>
        <div class="record-after-wrap">
          <el-switch v-model="form.recordAfter" :active-value="1" :inactive-value="0" />
          <span class="form-hint">开启后，提醒结束会自动跳转到「主题对话」并记录当前情绪</span>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="visibleModel = false">取消</el-button>
      <el-button type="primary" @click="submit">确定</el-button>
    </template>
  </app-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { ElMessage } from "element-plus";
import TimeRuleForm from "./TimeRuleForm.vue";
import IntervalForm from "./IntervalForm.vue";
import StatefulForm from "./StatefulForm.vue";
import IdleTimeForm from "./IdleTimeForm.vue";
import type { TipsReminder, TipsState } from "../types";

const props = defineProps<{
  visible: boolean;
  editing: TipsReminder | null;
}>();
const emit = defineEmits<{
  "update:visible": [v: boolean];
  submit: [form: TipsReminder];
}>();

const visibleModel = computed({
  get: () => props.visible,
  set: (v) => emit("update:visible", v),
});
const isEdit = computed(() => !!props.editing);

const form = ref<TipsReminder>(defaultForm());
const startTimeDate = ref<number | null>(null);

function tsToDate(ts?: number | null): number | null {
  if (!ts || isNaN(Number(ts))) return null;
  return Number(ts);
}
function dateToTs(d: number | null): number | null {
  if (!d) return null;
  const t = Number(d);
  return isNaN(t) ? null : t;
}

function defaultForm(): TipsReminder {
  return {
    id: "",
    mode: "time",
    title: "",
    content: "",
    enabled: 1,
    startTime: null,
    time: "09:00",
    repeat: "daily",
    date: "",
    weekDays: [1, 2, 3, 4, 5],
    minute: 0,
    dayOfMonth: 1,
    month: 1,
    interval: 30,
    unit: 60 * 1000,
    recordAfter: 0,
    states: [],
    loop: 1,
    idleTime: [],
  };
}

function defaultState(): TipsState {
  return {
    key: "state_" + Date.now().toString(36),
    label: "",
    content: "",
    duration: 1,
    unit: 60 * 1000,
    record: 1,
    lockScreen: 0,
    sequential: 1,
    continueLoop: 1,
  };
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 打开时根据 editing 初始化表单
watch(
  () => props.visible,
  (v) => {
    if (v) {
      form.value = props.editing
        ? JSON.parse(JSON.stringify(props.editing))
        : defaultForm();
      // 保证 states 数组存在（多状态模式）
      if (!form.value.states) form.value.states = [];
      startTimeDate.value = tsToDate(form.value.startTime);
    }
  },
  { immediate: true }
);

function resetForm() {
  form.value = defaultForm();
  isEdit.value; // noop，保持引用
}

function submit() {
  const f = form.value;
  // 编辑且未改动开始时间：继承原开始时间，使主进程按新时长重算轮次（而非误当新轮）
  if (isEdit.value && startTimeDate.value == null) {
    f.startTime = props.editing ? (props.editing.startTime ?? null) : null;
  } else {
    f.startTime = dateToTs(startTimeDate.value);
  }
  if (!f.title.trim()) {
    ElMessage({ message: "请输入提醒标题", type: "warning" });
    return;
  }
  if (f.mode === "time") {
    if (f.repeat === "hourly") {
      if (f.minute === undefined || f.minute === null) {
        ElMessage({ message: "请设置分钟", type: "warning" });
        return;
      }
    } else if (!f.time) {
      ElMessage({ message: "请选择提醒时间", type: "warning" });
      return;
    }
    if (f.repeat === "once" && !f.date) {
      ElMessage({ message: "请选择提醒日期", type: "warning" });
      return;
    }
    if (f.repeat === "weekly" && (!f.weekDays || f.weekDays.length === 0)) {
      ElMessage({ message: "请选择星期", type: "warning" });
      return;
    }
    if (f.repeat === "monthly" && !f.dayOfMonth) {
      ElMessage({ message: "请设置日期（几号）", type: "warning" });
      return;
    }
    if (f.repeat === "yearly" && (!f.month || !f.dayOfMonth)) {
      ElMessage({ message: "请设置月份与日期", type: "warning" });
      return;
    }
  } else if (f.mode === "interval") {
    if (!f.interval || Number(f.interval) <= 0) {
      ElMessage({ message: "请输入有效的间隔数值", type: "warning" });
      return;
    }
  } else if (f.mode === "stateful") {
    if (!f.states || f.states.length === 0) {
      ElMessage({ message: "请至少添加一个状态", type: "warning" });
      return;
    }
    for (const s of f.states) {
      if (!s.label.trim()) {
        ElMessage({ message: "请填写所有状态的名称", type: "warning" });
        return;
      }
      if (Number(s.duration) < 0) {
        ElMessage({ message: "状态时长不能为负", type: "warning" });
        return;
      }
    }
  }

  if (!f.id) f.id = genId();
  emit("submit", JSON.parse(JSON.stringify(f)));
  visibleModel.value = false;
}
</script>

<style scoped lang="scss">
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
}
.form-hint {
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
}
.record-after-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
