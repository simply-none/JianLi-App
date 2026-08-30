<!--
  倒计时主页面（单列表布局）。
  顶栏：标题 + 全局展示样式切换 + 新建；下方为可滚动列表（每行三栏）。
  结束刷新由 useCountdown store 模块级单例监听统一处理，组件不自行 on/off 通道。
-->
<template>
  <div class="countdown-page">
    <div class="countdown-page__head">
      <div class="countdown-page__title">
        <span>倒计时</span>
        <span class="countdown-page__count">{{ store.rows.length }} 个</span>
      </div>
      <div class="countdown-page__tools">
        <el-select
          :model-value="store.displayStyle"
          size="small"
          class="countdown-page__style"
          @update:model-value="(v: any) => store.setDisplayStyle(v as CountdownStyle)"
        >
          <el-option v-for="s in styles" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <button class="cd-new" type="button" @click="openCreate">
          <LucideIcon name="PlusIcon" :size="14" /> 新建
        </button>
      </div>
    </div>

    <div class="countdown-page__list">
      <CountdownList @edit="openEdit" />
    </div>

    <CountdownDialog v-model="dialogVisible" :editing="editing" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import CountdownList from "./components/CountdownList.vue";
import CountdownDialog from "./components/CountdownDialog.vue";
import { useCountdown } from "@/store/useCountdown";
import { COUNTDOWN_STYLES, type CountdownRow, type CountdownStyle } from "./types";

const store = useCountdown();
const styles = COUNTDOWN_STYLES;
const dialogVisible = ref(false);
const editing = ref<CountdownRow | null>(null);

function openCreate() {
  editing.value = null;
  dialogVisible.value = true;
}

function openEdit(row: CountdownRow) {
  editing.value = row;
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
  flex-direction: column;
  height: 100%;
  background: var(--bg-base);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--bg-card);
  }

  &__title {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  &__count {
    font-size: 12px;
    font-weight: 400;
    color: var(--text-muted);
  }

  &__tools {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__style {
    width: 110px;
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }
}

.cd-new {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
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
