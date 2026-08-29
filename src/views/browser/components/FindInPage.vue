<template>
  <!-- 页内查找条：关键词输入 + 匹配计数 + 上/下一个 + 关闭 -->
  <div v-if="visible" class="find-bar">
    <span class="find-prefix">
      <LucideIcon name="Search" :size="14" />
    </span>
    <input
      ref="inputRef"
      v-model="keyword"
      class="find-input"
      placeholder="在页面中查找..."
      spellcheck="false"
      @input="onInput"
      @keydown.enter.prevent="findNext(true)"
      @keydown.esc.prevent="onClose"
    />
    <span class="find-count">{{ countText }}</span>
    <span class="find-btn" title="上一个 (Shift+Enter)" @click="findNext(false)">
      <LucideIcon name="ChevronUp" :size="14" />
    </span>
    <span class="find-btn" title="下一个 (Enter)" @click="findNext(true)">
      <LucideIcon name="ChevronDown" :size="14" />
    </span>
    <span class="find-btn" title="关闭 (Esc)" @click="onClose">
      <LucideIcon name="X" :size="14" />
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - 页内查找条
 * 职责：调用 webview.findInPage 在当前激活标签内查找文本，
 * 展示匹配序号/总数；关闭时清除高亮。
 */
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import LucideIcon from "@/components/LucideIcon.vue";
import useBrowser from "@/store/useBrowser";
import { findInPage, stopFindInPage, onFoundInPage } from "../composables/useWebviewBridge";

/** 显隐（v-model:visible） */
const visible = defineModel<boolean>("visible", { default: false });

const browserStore = useBrowser();

const inputRef = ref<HTMLInputElement | null>(null);
/** 查找关键词 */
const keyword = ref("");
/** 当前匹配序号 */
const activeOrdinal = ref(0);
/** 匹配总数 */
const matches = ref(0);

/** 匹配计数文案 */
const countText = computed(() => {
  if (!keyword.value) return "";
  if (!matches.value) return "无结果";
  return `${activeOrdinal.value}/${matches.value}`;
});

// 显示时聚焦输入框；切换标签时重置计数
watch(visible, async (v) => {
  if (v) {
    activeOrdinal.value = 0;
    matches.value = 0;
    await nextTick();
    inputRef.value?.focus();
  } else {
    stopFindInPage();
  }
});

watch(
  () => browserStore.activeTabId,
  () => {
    activeOrdinal.value = 0;
    matches.value = 0;
  }
);

/** 输入变化：重新查找 */
function onInput() {
  if (!keyword.value) {
    stopFindInPage();
    matches.value = 0;
    return;
  }
  findInPage(browserStore.activeTabId, keyword.value, true);
}

/**
 * 查找上/下一个
 * @param forward 必填，方向
 */
function findNext(forward: boolean) {
  if (keyword.value) {
    findInPage(browserStore.activeTabId, keyword.value, forward);
  }
}

/** 关闭查找条 */
function onClose() {
  visible.value = false;
}

// 订阅 webview 的 found-in-page 结果（仅处理激活标签的）
const unsubscribe = onFoundInPage((payload) => {
  if (payload.tabId !== browserStore.activeTabId) return;
  activeOrdinal.value = payload.activeMatchOrdinal;
  matches.value = payload.matches;
});

onUnmounted(() => {
  unsubscribe();
  stopFindInPage();
});
</script>

<style scoped lang="scss">
.find-bar {
  position: absolute;
  top: 8px;
  right: 16px;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-card);
}

.find-prefix {
  display: flex;
  align-items: center;
  color: var(--text-muted);
}

.find-input {
  width: 180px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--text-primary);

  &::placeholder {
    color: var(--text-muted);
  }
}

.find-count {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 40px;
  text-align: center;
}

.find-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.15s;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}
</style>
