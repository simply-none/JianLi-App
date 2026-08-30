<!--
  倒计时主页面：左侧列表 + 右侧大计时器。顶部「新建倒计时」打开弹窗。
  监听 countdown-finished 事件刷新列表（通知弹窗由 App.vue 统一处理）。
-->
<template>
  <div class="countdown-page">
    <div class="countdown-page__side">
      <div class="countdown-page__side-head">
        <span class="countdown-page__title">倒计时</span>
        <button class="cd-new" type="button" @click="openCreate">
          <LucideIcon name="PlusIcon" :size="14" /> 新建
        </button>
      </div>
      <div class="countdown-page__list">
        <CountdownList />
      </div>
    </div>

    <div class="countdown-page__main">
      <CountdownTimer :row="store.active" />
    </div>

    <CountdownDialog v-model="dialogVisible" :editing="editing" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import CountdownList from "./components/CountdownList.vue";
import CountdownTimer from "./components/CountdownTimer.vue";
import CountdownDialog from "./components/CountdownDialog.vue";
import { useCountdown } from "@/store/useCountdown";
import type { CountdownRow } from "./types";

const store = useCountdown();
const dialogVisible = ref(false);
const editing = ref<CountdownRow | null>(null);

function openCreate() {
  editing.value = null;
  dialogVisible.value = true;
}

// 倒计时结束时的列表刷新由 useCountdown store 模块级单例监听统一处理
// （preload 的 on 内部包箭头导致 off 无法精确移除、removeListener 未暴露，
//  且 App.vue 也永久监听该通道弹通知，故不能在此 onUnmounted 注销）。

onMounted(() => {
  store.load();
});
</script>

<style scoped lang="scss">
.countdown-page {
  display: flex;
  height: 100%;
  background: var(--bg-base);

  &__side {
    width: 320px;
    flex: none;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border-subtle);
    background: var(--bg-card);
  }

  &__side-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }
}

.cd-new {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  font-size: 13px;

  &:hover {
    filter: brightness(1.05);
  }
}
</style>
