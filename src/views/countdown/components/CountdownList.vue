<!--
  倒计时列表：简单可滚动列表（倒计时数量通常不多，未引入 VirtualList）。
  空态给出引导。选中/快捷操作通过事件上抛给页面。
-->
<template>
  <div class="cd-list">
    <template v-if="rows.length">
      <CountdownCard
        v-for="row in rows"
        :key="row.key"
        :row="row"
        :active="row.key === activeKey"
        @select="(k) => store.setActive(k)"
        @pause="(r) => store.pause(r.key, computeRemaining(r))"
        @resume="(r) => store.start(r.key, r.paused_remaining)"
        @reset="(r) => store.reset(r.key, r.duration)"
        @delete="onDelete"
      />
    </template>
    <el-empty v-else description="暂无倒计时" :image-size="80" />
  </div>
</template>

<script setup lang="ts">
import { ElMessageBox } from "element-plus";
import CountdownCard from "./CountdownCard.vue";
import { useCountdown } from "@/store/useCountdown";
import { useCountdownTimer } from "../composables/useCountdownTimer";
import type { CountdownRow } from "../types";

const store = useCountdown();
const { now } = useCountdownTimer();
const rows = store.rows;
const activeKey = store.activeKey;

function computeRemaining(r: CountdownRow) {
  return Math.max(0, r.end_time - now.value);
}

function onDelete(r: CountdownRow) {
  ElMessageBox.confirm(`确定删除倒计时「${r.name}」？`, "删除确认", {
    type: "warning",
    confirmButtonText: "删除",
    cancelButtonText: "取消",
  })
    .then(() => store.remove(r.key))
    .catch(() => {});
}
</script>

<style scoped lang="scss">
.cd-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px;
}
</style>
