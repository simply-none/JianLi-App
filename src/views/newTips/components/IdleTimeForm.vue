<template>
  <div class="form-item idle-time-form">
    <span class="form-label">空闲时间（免打扰时段）</span>
    <div class="idle-rows">
      <div v-for="(slot, i) in idleList" :key="i" class="idle-row">
        <el-time-picker
          class="idle-range"
          v-model="rangeModel(i).value"
          is-range
          format="HH:mm"
          value-format="HH:mm"
          range-separator="至"
          start-placeholder="开始"
          end-placeholder="结束"
        />
        <el-button
          v-if="idleList.length > 1"
          class="idle-del"
          text
          type="danger"
          @click="removeSlot(i)"
        >
          <LucideIcon name="Trash" :size="14" />
        </el-button>
      </div>
    </div>
    <el-button class="idle-add" text type="primary" @click="addSlot">
      <LucideIcon name="Plus" :size="14" /> 添加免打扰时段
    </el-button>
    <span class="form-hint">
      在该时段内不触发本提醒（定点/周期不通知、多状态不切换状态）；空闲结束后立即开始新一轮。
      支持跨午夜（如 22:00 - 06:00）。留空表示不设置。
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import LucideIcon from "@/components/LucideIcon.vue";
import type { TipsReminder, IdleTimeSlot } from "../types";

const props = defineProps<{ form: TipsReminder }>();

// 直接读写 form.idleTime（与渲染端其余表单一致），保证提交时一并落库
function ensureIdle(): IdleTimeSlot[] {
  if (!props.form.idleTime) props.form.idleTime = [];
  return props.form.idleTime as IdleTimeSlot[];
}

const idleList = computed<IdleTimeSlot[]>(() => ensureIdle());

// 每行独立的双向绑定：把 {start,end} 映射为 [start,end] 数组交给 el-time-picker。
// 用 v-model 而非 :model-value + @change，避免区间选择器内部状态与 model-value 失步导致「改了又调回去」。
function rangeModel(i: number) {
  return computed<string[] | null>({
    get: () => {
      const list = ensureIdle();
      const s = list[i] || { start: "", end: "" };
      return [s.start || "", s.end || ""];
    },
    set: (v: any) => {
      const list = ensureIdle();
      if (!Array.isArray(v) || v.length < 2) return;
      if (!list[i]) list[i] = { start: "", end: "" };
      list[i].start = v[0];
      list[i].end = v[1];
    },
  });
}

function addSlot() {
  // 直接 push 到响应式数组，v-for 立刻渲染出新行
  ensureIdle().push({ start: "12:00", end: "14:00" });
}

function removeSlot(i: number) {
  ensureIdle().splice(i, 1);
}
</script>

<style scoped lang="scss">
.idle-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.idle-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.idle-range {
  flex: 1;
}
.idle-del {
  flex-shrink: 0;
}
.idle-add {
  align-self: flex-start;
  color: var(--el-text-color-secondary, #909399);
}
.form-hint {
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
}
</style>
