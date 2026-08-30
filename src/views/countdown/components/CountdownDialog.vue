<!--
  倒计时新建/编辑弹窗（AppDialog 继承）。
  仅收集表单并调用 store.save 落库；编辑时若未改动时间设定则保留原 timing（仅改名/设置）。
-->
<template>
  <AppDialog
    :model-value="modelValue"
    :title="editing ? '编辑倒计时' : '新建倒计时'"
    width="460px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="cd-form">
      <label class="cd-form__item">
        <span class="cd-form__label"><i>*</i>名称</span>
        <input v-model="form.name" class="cd-form__input" placeholder="例如：煮蛋 8 分钟 / 发布会倒计时" />
      </label>

      <div class="cd-form__item">
        <span class="cd-form__label">设定方式</span>
        <el-radio-group v-model="form.mode">
          <el-radio value="datetime">指定时刻</el-radio>
          <el-radio value="duration">指定时长</el-radio>
        </el-radio-group>
      </div>

      <label v-if="form.mode === 'datetime'" class="cd-form__item">
        <span class="cd-form__label">目标时刻</span>
        <el-date-picker
          v-model="form.datetime"
          type="datetime"
          placeholder="选择结束时间"
          format="YYYY-MM-DD HH:mm"
          value-format="x"
          :disabled-date="disabledPastDate"
          class="cd-form__picker"
        />
      </label>

      <div v-else class="cd-form__item">
        <span class="cd-form__label">时长</span>
        <div class="cd-form__duration">
          <input v-model.number="form.days" class="cd-form__num" type="number" min="0" /> <span>天</span>
          <input v-model.number="form.hours" class="cd-form__num" type="number" min="0" max="23" /> <span>时</span>
          <input v-model.number="form.minutes" class="cd-form__num" type="number" min="0" max="59" /> <span>分</span>
        </div>
      </div>

      <div class="cd-form__item">
        <span class="cd-form__label">完成提醒</span>
        <el-switch v-model="form.notify" active-text="弹通知" />
      </div>

      <div class="cd-form__item">
        <span class="cd-form__label">颜色</span>
        <div class="cd-form__colors">
          <button
            v-for="c in COLORS"
            :key="c"
            type="button"
            class="cd-form__color"
            :class="{ 'cd-form__color--on': form.color === c }"
            :style="{ background: c }"
            @click="form.color = c"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="cd-form__footer">
        <button class="cd-form__btn cd-form__btn--ghost" type="button" @click="$emit('update:modelValue', false)">
          取消
        </button>
        <button class="cd-form__btn" type="button" @click="onConfirm">确定</button>
      </div>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import { ElMessage } from "element-plus";
import AppDialog from "@/components/AppDialog.vue";
import { useCountdown } from "@/store/useCountdown";
import type { CountdownRow, CountdownMode } from "../types";

const props = defineProps<{ modelValue: boolean; editing: CountdownRow | null }>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const store = useCountdown();
const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];

const form = reactive({
  name: "",
  mode: "duration" as CountdownMode,
  datetime: undefined as number | undefined,
  days: 0,
  hours: 0,
  minutes: 10,
  notify: true,
  color: COLORS[0],
});

function resetForm() {
  const r = props.editing;
  if (r) {
    form.name = r.name;
    form.mode = r.mode;
    form.datetime = r.end_time;
    const totalSec = Math.max(0, Math.round(r.duration / 1000));
    form.days = Math.floor(totalSec / 86400);
    form.hours = Math.floor((totalSec % 86400) / 3600);
    form.minutes = Math.floor((totalSec % 3600) / 60);
    form.notify = r.notify === 1;
    form.color = r.color || COLORS[0];
  } else {
    form.name = "";
    form.mode = "duration";
    form.datetime = undefined;
    form.days = 0;
    form.hours = 0;
    form.minutes = 10;
    form.notify = true;
    form.color = COLORS[0];
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetForm();
  },
);

function disabledPastDate(date: Date) {
  return date.getTime() < Date.now() - 86400000;
}

function onConfirm() {
  if (!form.name.trim()) {
    ElMessage.warning("请填写名称");
    return;
  }
  const editing = props.editing;
  const durationMs =
    form.mode === "datetime"
      ? Math.max(0, (form.datetime || Date.now()) - Date.now())
      : ((form.days * 24 + form.hours) * 60 + form.minutes) * 60 * 1000;

  if (form.mode === "duration" && durationMs <= 0) {
    ElMessage.warning("时长需大于 0");
    return;
  }

  // 编辑时判定时间设定是否被改动：未改动则保留原 timing（仅改名/设置）
  const timingChanged = editing
    ? form.mode !== editing.mode ||
      (form.mode === "datetime" ? form.datetime !== editing.end_time : durationMs !== editing.duration)
    : true;

  store
    .save({
      key: editing?.key,
      name: form.name.trim(),
      mode: form.mode,
      targetTime: form.mode === "datetime" ? form.datetime : undefined,
      durationMs: form.mode === "duration" ? durationMs : undefined,
      notify: form.notify,
      color: form.color,
      // 编辑且未改时间：携带原行字段，store 不再重算
      ...(editing && !timingChanged
        ? { end_time: editing.end_time, duration: editing.duration, status: editing.status, created_at: editing.created_at }
        : {}),
    })
    .then(() => {
      ElMessage.success(editing ? "已保存" : "已创建倒计时");
      emit("update:modelValue", false);
    });
}
</script>

<style scoped lang="scss">
.cd-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 2px;

  &__item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__label {
    font-size: 13px;
    color: var(--text-secondary);

    i {
      color: var(--color-error);
      margin-right: 2px;
      font-style: normal;
    }
  }

  &__input,
  &__picker {
    width: 100%;
  }

  &__duration {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-secondary);
  }

  &__num {
    width: 64px;
    padding: 6px 8px;
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    background: var(--bg-base);
    color: var(--text-primary);
  }

  &__colors {
    display: flex;
    gap: 8px;
  }

  &__color {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;

    &--on {
      border-color: var(--text-primary);
    }
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  &__btn {
    padding: 8px 18px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: var(--color-primary);
    color: #fff;
    cursor: pointer;
    font-size: 13px;

    &--ghost {
      background: var(--bg-hover);
      color: var(--text-primary);
      border-color: var(--border-subtle);
    }
  }
}
</style>
