<template>
  <div class="form-item">
    <span class="form-label">状态序列</span>
    <div class="state-list">
      <StateRow
        v-for="(st, idx) in form.states"
        :key="st.key || idx"
        :state="st"
        :index="idx"
        @remove="removeState(idx)"
      />
      <div class="state-list-foot">
        <el-button size="small" @click="addState" class="state-add-btn">
          <LucideIcon name="Plus" :size="14" /> 添加状态
        </el-button>
        <div class="state-tip">
          <LucideIcon name="Info" :size="13" />
          「序列」状态参与循环；「非序列」状态不参与循环，仅可运行时强制插入，结束后自动归位。
        </div>
      </div>
    </div>
  </div>

  <div class="form-item">
    <span class="form-label">循环</span>
    <el-switch v-model="form.loop" :active-value="1" :inactive-value="0" />
    <span class="form-hint">开启后序列状态依次执行并循环（如工作 → 休息 → 工作 …）</span>
  </div>
</template>

<script setup lang="ts">
import LucideIcon from "@/components/LucideIcon.vue";
import StateRow from "./StateRow.vue";
import type { TipsReminder, TipsState } from "../types";

const props = defineProps<{ form: TipsReminder }>();

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

function addState() {
  if (!props.form.states) props.form.states = [];
  props.form.states.push(defaultState());
}

function removeState(idx: number) {
  props.form.states?.splice(idx, 1);
}
</script>

<style scoped lang="scss">
.state-list { display: flex; flex-direction: column; gap: 10px; }
.state-list-foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.state-tip {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
}
</style>
