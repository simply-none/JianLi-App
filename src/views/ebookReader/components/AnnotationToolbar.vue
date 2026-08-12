<template>
  <!-- 选中文本后弹出的浮动工具条：仅含「划线」「笔记」两个操作 -->
  <div
    v-if="visible"
    class="annotation-toolbar"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @click.stop
  >
    <!-- 划线按钮：按右上角「阅读设置」中预设的颜色与样式直接划线，不弹颜色/类型选择 -->
    <button
      class="toolbar-btn"
      type="button"
      title="划线"
      @click="handleHighlight"
    >
      <LucideIcon name="Pencil" :size="14" />
      <span class="toolbar-label">划线</span>
    </button>

    <!-- 分隔线 -->
    <span class="toolbar-divider"></span>

    <!-- 笔记按钮：按预设格式划线并直接弹出笔记输入框 -->
    <button
      class="toolbar-btn"
      type="button"
      title="笔记"
      @click="handleNote"
    >
      <LucideIcon name="NotebookPen" :size="14" />
      <span class="toolbar-label">笔记</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';

/** 组件 Props 定义 */
const props = defineProps<{
  /** 是否显示工具条 */
  visible: boolean;
  /** 工具条定位 x 坐标（相对视口，px） */
  x: number;
  /** 工具条定位 y 坐标（相对视口，px） */
  y: number;
}>();

/** 组件 Emits 定义 */
const emit = defineEmits<{
  /** 点击「划线」按钮：按预设颜色与样式高亮选中文本，不添加笔记 */
  (e: 'highlight'): void;
  /** 点击「笔记」按钮：按预设颜色与样式高亮选中文本并添加笔记 */
  (e: 'note'): void;
  /** 关闭工具条（点击外部或按钮后） */
  (e: 'close'): void;
}>();

/**
 * 点击「划线」按钮处理：触发 highlight 事件，然后关闭工具条
 * 颜色与样式由阅读设置 store 预设，无需在工具条上选择。
 *
 * @returns 无返回值
 */
function handleHighlight(): void {
  emit('highlight');
  emit('close');
}

/**
 * 点击「笔记」按钮处理：触发 note 事件，然后关闭工具条
 * 颜色与样式由阅读设置 store 预设，无需在工具条上选择。
 *
 * @returns 无返回值
 */
function handleNote(): void {
  emit('note');
  emit('close');
}

/**
 * document 点击事件处理（捕获阶段）
 * 用于检测工具条外部点击：点击落在 .annotation-toolbar 内不关闭，
 * 真正点击在工具条外部时触发 close 关闭整个工具条。
 *
 * @param e - 鼠标事件对象
 * @returns 无返回值
 */
function handleDocumentClick(e: MouseEvent): void {
  // 工具条未显示时不处理，避免无意义的 close 事件
  if (!props.visible) return;

  const target = e.target as HTMLElement;
  // 点击落在工具条内 → 不关闭工具条
  if (target.closest('.annotation-toolbar')) {
    return;
  }

  // 真正点击工具条外部 → 关闭工具条
  emit('close');
}

onMounted(() => {
  // 注册 document 点击监听用于检测工具条外部点击（捕获阶段，确保先于冒泡触发）
  document.addEventListener('click', handleDocumentClick, true);
});

onUnmounted(() => {
  // 移除 document 点击监听，防止内存泄漏
  document.removeEventListener('click', handleDocumentClick, true);
});
</script>

<style scoped lang="scss">
/* 浮动工具条：绝对定位浮层，定位在选区上方，水平居中 */
.annotation-toolbar {
  position: fixed;
  z-index: 1000;
  transform: translate(-50%, -120%);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  box-shadow: var(--shadow-card);
  user-select: none;
  /* 出现动画：scale + opacity 过渡 */
  animation: toolbar-pop 0.12s ease-out;

  /* 指向选区的小三角箭头（CSS 伪元素） */
  &::before {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -6px;
    width: 10px;
    height: 10px;
    background: var(--bg-card);
    border-right: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
    transform: translateX(-50%) rotate(45deg);
  }
}

/* 紧凑按钮样式 */
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  border-radius: calc(var(--radius-btn) - 2px);
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background: var(--bg-hover);
  }

  &:active {
    background: var(--bg-hover);
    opacity: 0.85;
  }

  .toolbar-label {
    white-space: nowrap;
  }
}

/* 按钮间分隔线 */
.toolbar-divider {
  width: 1px;
  height: 16px;
  background: var(--border-subtle);
  flex-shrink: 0;
  margin: 0 2px;
}

/* 出现动画关键帧 */
@keyframes toolbar-pop {
  from {
    opacity: 0;
    transform: translate(-50%, -110%) scale(0.92);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -120%) scale(1);
  }
}
</style>
