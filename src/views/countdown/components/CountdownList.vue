<!--
  倒计时列表：可滚动列表（数量通常不多，未引入 VirtualList）。
  用 storeToRefs 取 rows/activeKey，确保 store.load() 整体替换数组后列表实时刷新。
  选中/快捷操作通过事件上抛给页面。
-->
<template>
  <div class="cd-list">
    <template v-if="rows.length">
      <CountdownRow
        v-for="row in rows"
        :key="row.key"
        :row="row"
        :active="row.key === activeKey"
        @select="(k) => store.setActive(k)"
        @pause="(r) => store.pause(r.key, computeRemaining(r))"
        @resume="(r) => store.start(r.key, r.paused_remaining)"
        @reset="(r) => store.reset(r.key, r.duration)"
        @edit="(r) => emit('edit', r)"
        @delete="onDelete"
      />
    </template>
    <el-empty v-else description="暂无倒计时" :image-size="80" />
  </div>
</template>

<script setup lang="ts">
import { ElMessageBox } from "element-plus";
import { storeToRefs } from "pinia";
import CountdownRow from "./CountdownRow.vue";
import { useCountdown } from "@/store/useCountdown";
import { useCountdownTimer } from "../composables/useCountdownTimer";
import type { CountdownRow as CountdownRowType } from "../types";

const store = useCountdown();
// 关键修复：用 storeToRefs 保持响应式；否则 const rows = store.rows 只拿到当时的引用快照，
// store.load() 整体替换数组后本地 rows 仍指向旧数组，列表不刷新。
const { rows, activeKey } = storeToRefs(store);
const { now } = useCountdownTimer();

const emit = defineEmits<{ (e: "edit", row: CountdownRowType): void }>();

function computeRemaining(r: CountdownRowType) {
  return Math.max(0, r.end_time - now.value);
}

function onDelete(r: CountdownRowType) {
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
