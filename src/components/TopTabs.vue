<template>
  <!--
    通用顶部 Tab 切换组件（单行不换行 + 鼠标滚轮横向滚动 + 滚动条仅 hover 时显示）
    用法：
      <TopTabs :tabs="tabs" v-model="activeKey" />
    tabs 项结构：{ key, label, icon?, color? }
      - icon:  可选，Lucide 图标名
      - color: 可选，指定该 Tab 图标色与激活态强调色；缺省则使用主题主色
  -->
  <div
    ref="tabsRef"
    class="top-tabs"
    :class="{ 'is-overflow': isOverflow }"
    role="tablist"
    @wheel="onWheel"
  >
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="top-tab"
      :class="{ 'is-active': tab.key === modelValue }"
      type="button"
      role="tab"
      :aria-selected="tab.key === modelValue"
      :style="tabStyle(tab)"
      @click="$emit('update:modelValue', tab.key)"
    >
      <LucideIcon v-if="tab.icon" :name="tab.icon" :size="16" class="top-tab-icon" />
      <span class="top-tab-label">{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';

export interface TopTabItem {
  key: string | number;
  label: string;
  icon?: string;
  color?: string;
}

const props = defineProps<{
  tabs: TopTabItem[];
  modelValue: string | number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', key: string | number): void;
}>();

const tabsRef = ref<HTMLElement | null>(null);
// 是否发生横向溢出：仅溢出且 hover 时才显示滚动条，避免无内容时显示一条灰条
const isOverflow = ref(false);

function updateOverflow() {
  const el = tabsRef.value;
  if (!el) return;
  isOverflow.value = el.scrollWidth > el.clientWidth;
}

let ro: ResizeObserver | null = null;

onMounted(() => {
  updateOverflow();
  // 容器宽度变化（窗口缩放、内容增减）时同步溢出状态
  if (tabsRef.value && 'ResizeObserver' in window) {
    ro = new ResizeObserver(updateOverflow);
    ro.observe(tabsRef.value);
  }
});

onBeforeUnmount(() => {
  ro?.disconnect();
  ro = null;
});

// tabs 数量变化也重新计算溢出
watch(() => props.tabs.length, updateOverflow);

// 滚轮横滚的位移倍率：部分鼠标/触控板 deltaY 偏小，放大让一次滚动明显推进
const WHEEL_FACTOR = 4;

// 溢出时把竖直滚轮转为横向滚动；未溢出则放行页面纵向滚动
function onWheel(e: WheelEvent) {
  const el = e.currentTarget as HTMLElement;
  if (e.deltaY === 0 || el.scrollWidth <= el.clientWidth) return;
  // 规范 deltaY：行模式(deltaMode=1)≈16px/行，页模式(deltaMode=2)≈整屏宽，像素模式=1
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1;
  el.scrollLeft += e.deltaY * unit * WHEEL_FACTOR;
  e.preventDefault();
}

// 每枚 Tab 注入强调色：color 存在则用其作为图标&激活色，否则回退主题主色
function tabStyle(tab: TopTabItem): Record<string, string> {
  const accent = tab.color || 'var(--color-primary)';
  return {
    '--tab-accent': accent,
    // 图标色：有专属色则常驻该色（呼应 homeMode 各模式区分色），否则用次要文字色
    '--tab-icon': tab.color || 'var(--text-secondary)',
  };
}
</script>

<style scoped lang="scss">
.top-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  margin-bottom: 18px;
  overflow-x: auto;
  scroll-behavior: smooth;
  // 默认完全隐藏滚动条（Firefox）
  scrollbar-width: none;

  &::-webkit-scrollbar {
    height: 0;
  }

  &::-webkit-scrollbar-thumb,
  &::-webkit-scrollbar-track {
    background: transparent;
  }

  // 仅当内容横向溢出且鼠标悬停时才显示滚动条
  &.is-overflow:hover {
    scrollbar-width: thin;
    scrollbar-color: var(--border-subtle) transparent;

    &::-webkit-scrollbar {
      height: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--border-subtle);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }
  }
}

.top-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  white-space: nowrap;
  padding: 9px 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 10px);
  background: var(--bg-card);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;

  &:hover {
    border-color: var(--tab-accent);
    color: var(--text-primary);
  }

  &.is-active {
    border-color: var(--tab-accent);
    // 任意强调色的浅底：用 color-mix 兼容主色与自定义色
    background: color-mix(in srgb, var(--tab-accent) 14%, transparent);
    box-shadow: var(--shadow-card);

    .top-tab-label {
      color: var(--tab-accent);
    }
  }

  .top-tab-icon {
    display: inline-flex;
    color: var(--tab-icon);
  }
}
</style>
