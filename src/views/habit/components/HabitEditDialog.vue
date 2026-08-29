<!--
  习惯编辑弹窗（原子组件）：只负责收集表单，落库交给上层 store。
  habit 为 null 时表示新增；打开时（modelValue 由 false→true）自动用 habit 重置表单。
-->
<template>
  <AppDialog
    :model-value="modelValue"
    :title="habit ? '编辑习惯' : '新建习惯'"
    width="480px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="habit-form">
      <label class="form-item">
        <span class="form-item__label"><i>*</i>习惯名称</span>
        <input v-model="form.name" class="form-item__input" placeholder="例如：每天读书 30 分钟" />
      </label>

      <label class="form-item">
        <span class="form-item__label">备注</span>
        <textarea
          v-model="form.remark"
          class="form-item__input form-item__input--area"
          rows="2"
          placeholder="提醒时展示的文案，留空则使用默认文案"
        />
      </label>

      <div class="form-item">
        <span class="form-item__label">频率</span>
        <div class="form-item__row">
          <el-radio-group v-model="form.freqType">
            <el-radio value="daily">每天</el-radio>
            <el-radio value="weekly">每周</el-radio>
          </el-radio-group>
        </div>
      </div>

      <div v-if="form.freqType === 'weekly'" class="form-item">
        <span class="form-item__label">星期</span>
        <div class="form-item__row">
          <el-checkbox-group v-model="form.weekDays">
            <el-checkbox v-for="d in WEEK_OPTIONS" :key="d.value" :value="d.value">
              {{ d.label }}
            </el-checkbox>
          </el-checkbox-group>
        </div>
      </div>

      <div class="form-item">
        <span class="form-item__label">提醒时刻</span>
        <div class="habit-form__times">
          <div v-for="(t, i) in form.reminderTimes" :key="i" class="habit-form__time">
            <input v-model="form.reminderTimes[i]" class="form-item__input" type="time" />
            <button class="habit-form__del" type="button" @click="removeTime(i)">移除</button>
          </div>
          <button class="habit-form__add" type="button" @click="addTime">+ 添加提醒时刻</button>
          <p class="habit-form__tip">留空表示不提醒；每个时刻会同步为提醒系统中的一条定点提醒。</p>
        </div>
      </div>

      <div v-if="availableActions.length" class="form-item">
        <span class="form-item__label">打卡后串接</span>
        <div class="form-item__row">
          <label v-for="a in availableActions" :key="a.type" class="chain-item">
            <input v-model="form.actionTypes" type="checkbox" :value="a.type" />
            <span>{{ a.label }}</span>
          </label>
        </div>
        <input
          v-if="form.actionTypes.includes('todo')"
          v-model="form.todoKeys"
          class="form-item__input"
          placeholder="关联待办 key，多个用逗号分隔"
        />
        <p v-for="a in selectedActions" :key="a.type" class="habit-form__tip">
          {{ a.description }}
        </p>
      </div>

      <div class="form-item">
        <span class="form-item__label">启用</span>
        <el-switch v-model="form.enabled" :active-value="1" :inactive-value="0" />
      </div>
    </div>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" @click="submit">保存</el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import type { HabitChainActionConfig, HabitDef, HabitFreqType } from "../types";
import { listHabitChainActions } from "../chainActions";

const props = defineProps<{
  modelValue: boolean;
  /** 传入则编辑，null 则新建 */
  habit: HabitDef | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "save", payload: Partial<HabitDef> & { name: string }): void;
}>();

/** 星期选项（0=周日，与提醒系统 weekDays 一致） */
const WEEK_OPTIONS = [
  { label: "周一", value: 1 },
  { label: "周二", value: 2 },
  { label: "周三", value: 3 },
  { label: "周四", value: 4 },
  { label: "周五", value: 5 },
  { label: "周六", value: 6 },
  { label: "周日", value: 0 },
];

interface FormState {
  key: string;
  name: string;
  remark: string;
  freqType: HabitFreqType;
  weekDays: number[];
  reminderTimes: string[];
  enabled: number;
  /** 勾选中的链式动作 type */
  actionTypes: string[];
  /** todo 动作的待办 key（逗号分隔） */
  todoKeys: string;
}

/** 可供勾选的串接动作，直接来自注册表 —— 新增动作这里自动出现 */
const availableActions = listHabitChainActions();

/** 已勾选的动作，用于展示各自的说明 */
const selectedActions = computed(() =>
  availableActions.filter((a) => form.actionTypes.includes(a.type))
);

const form = reactive<FormState>({
  key: "",
  name: "",
  remark: "",
  freqType: "daily",
  weekDays: [],
  reminderTimes: [],
  enabled: 1,
  actionTypes: [],
  todoKeys: "",
});

/** 每次打开弹窗都用当前 habit 重置表单，避免残留上一次的编辑内容 */
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    const h = props.habit;
    form.key = h?.key ?? "";
    form.name = h?.name ?? "";
    form.remark = h?.remark ?? "";
    form.freqType = h?.freqType ?? "daily";
    form.weekDays = h?.weekDays ? [...h.weekDays] : [];
    form.reminderTimes = h?.reminderTimes?.length ? [...h.reminderTimes] : [""];
    form.enabled = h?.enabled ?? 1;
    // 链式动作回填：todo 的待办 key 用逗号拼接展示
    form.actionTypes = (h?.chainActions ?? []).map((a) => a.type);
    form.todoKeys = (
      (h?.chainActions ?? []).find((a) => a.type === "todo")?.params?.todoKeys ?? []
    ).join(",");
  }
);

function addTime() {
  form.reminderTimes.push("");
}

function removeTime(index: number) {
  form.reminderTimes.splice(index, 1);
  if (!form.reminderTimes.length) form.reminderTimes.push("");
}

function close() {
  emit("update:modelValue", false);
}

function submit() {
  const name = form.name.trim();
  if (!name) {
    // 名称是唯一必填项
    (window as any).ElMessage?.warning?.("请填写习惯名称");
    return;
  }
  if (form.freqType === "weekly" && !form.weekDays.length) {
    (window as any).ElMessage?.warning?.("每周频率请至少选择一个星期");
    return;
  }

  emit("save", {
    key: form.key,
    name,
    remark: form.remark.trim(),
    freqType: form.freqType,
    weekDays: form.freqType === "weekly" ? [...form.weekDays] : [],
    // 过滤掉空时刻
    reminderTimes: form.reminderTimes.map((t) => t.trim()).filter(Boolean),
    enabled: form.enabled,
    chainActions: buildChainActions(),
  });
  close();
}

/** 把表单里的勾选状态组装成链式动作配置 */
function buildChainActions(): HabitChainActionConfig[] {
  const actions: HabitChainActionConfig[] = [];
  if (form.actionTypes.includes("note")) {
    actions.push({ type: "note" });
  }
  if (form.actionTypes.includes("todo")) {
    actions.push({
      type: "todo",
      params: {
        todoKeys: form.todoKeys
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      },
    });
  }
  if (form.actionTypes.includes("themeConversation")) {
    actions.push({ type: "themeConversation" });
  }
  return actions;
}
</script>

<style scoped lang="scss">
.habit-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__label {
    font-size: 13px;
    color: var(--text-secondary);

    i {
      margin-right: 4px;
      color: var(--color-error);
      font-style: normal;
    }
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  &__input {
    width: 100%;
    padding: 7px 10px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    background: var(--bg-base);
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;

    &:focus {
      border-color: var(--color-primary);
    }

    &--area {
      resize: vertical;
      font-family: inherit;
    }
  }
}

.habit-form__times {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.habit-form__time {
  display: flex;
  align-items: center;
  gap: 8px;

  .form-item__input {
    width: 140px;
  }
}

.habit-form__del,
.habit-form__add {
  padding: 5px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}

.habit-form__add {
  align-self: flex-start;
}

.habit-form__tip {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.chain-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
}
</style>
