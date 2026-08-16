<template>
  <!-- 点击已有划线/高亮时弹出的操作菜单：提供「转为笔记/编辑笔记」「删除」两个操作 -->
  <div
    v-if="visible"
    ref="rootRef"
    class="annotation-action-menu"
    :class="{ 'is-below': below }"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    @click.stop
  >
    <!-- 转为笔记：纯划线点击时为「转为笔记」，已带笔记时为「编辑笔记」 -->
    <button class="menu-item" type="button" title="转为笔记" @click="onConvert">
      <LucideIcon :name="hasNote ? 'Pencil' : 'NotebookPen'" :size="14" />
      <span class="menu-label">{{ hasNote ? '编辑笔记' : '转为笔记' }}</span>
    </button>

    <div class="menu-divider"></div>

    <!-- 删除：复用既有删除确认流程 -->
    <button class="menu-item menu-item--danger" type="button" title="删除" @click="onDelete">
      <LucideIcon name="Trash2" :size="14" />
      <span class="menu-label">删除</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';

/** 组件 Props 定义 */
const props = defineProps<{
  /** 是否显示菜单 */
  visible: boolean;
  /** 菜单定位 x 坐标（相对视口，px），为锚点中心 */
  x: number;
  /** 菜单定位 y 坐标（相对视口，px），为锚点（划线）所在的竖直位置 */
  y: number;
  /** 该标注是否已带笔记：决定首项是「转为笔记」还是「编辑笔记」 */
  hasNote: boolean;
}>();

/** 组件 Emits 定义 */
const emit = defineEmits<{
  /** 点击「转为笔记/编辑笔记」：打开笔记输入弹窗 */
  (e: 'convert'): void;
  /** 点击「删除」：走删除确认流程 */
  (e: 'delete'): void;
  /** 关闭菜单（点击外部或按钮后） */
  (e: 'close'): void;
}>();

/** 菜单根元素引用，用于测量尺寸做视口夹紧与上下翻转 */
const rootRef = ref<HTMLElement | null>(null);
/** 实际渲染定位：在 props.x/y 基础上做视口夹紧，并保证菜单整体可见 */
const pos = reactive({ x: props.x, y: props.y });
/** 是否翻转到锚点下方（锚点上方空间不足时） */
const below = ref(false);

/**
 * 将菜单夹紧到视口内，并决定上下翻转。
 * 默认菜单在锚点「上方」：top = y - 高 - 10（底部留 10px 间隙）；
 * 若上方空间不足（top < pad）则翻转到锚点「下方」：top = y + 10，并加 .is-below 反转箭头朝向。
 * 横向以 x 为中线居中，夹紧到 [pad + 宽/2, vw - pad - 宽/2]。
 */
function clampToViewport() {
  const el = rootRef.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = r.width;
  const h = r.height;

  let nx = props.x;
  let ny = props.y - h - 10;
  let flip = false;
  if (ny < pad) {
    ny = props.y + 10;
    flip = true;
  }
  // 横向夹紧（居中）
  if (nx - w / 2 < pad) nx = pad + w / 2;
  else if (nx + w / 2 > vw - pad) nx = vw - pad - w / 2;
  // 纵向夹紧
  if (ny < pad) ny = pad;
  else if (ny + h > vh - pad) ny = vh - pad - h;

  pos.x = nx;
  pos.y = ny;
  below.value = flip;
}

/** 点击「转为笔记/编辑笔记」：触发 convert 事件并关闭菜单 */
function onConvert(): void {
  emit('convert');
  emit('close');
}

/** 点击「删除」：触发 delete 事件并关闭菜单 */
function onDelete(): void {
  emit('delete');
  emit('close');
}

/**
 * document 点击事件处理（捕获阶段）：点击落在菜单外部时关闭菜单。
 * 与 AnnotationToolbar 一致，打开后 250ms 内忽略（吸收打开手势自带的 click）。
 */
const justOpened = ref(false);
let openTimer: ReturnType<typeof setTimeout> | null = null;

function handleDocumentClick(e: MouseEvent): void {
  if (!props.visible) return;
  if (justOpened.value) return;
  const target = e.target as HTMLElement;
  if (target.closest('.annotation-action-menu')) return;
  emit('close');
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick, true);
});

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick, true);
  if (openTimer) clearTimeout(openTimer);
});

watch(
  () => props.visible,
  (v) => {
    if (v) {
      justOpened.value = true;
      if (openTimer) clearTimeout(openTimer);
      openTimer = setTimeout(() => {
        justOpened.value = false;
      }, 250);
      nextTick(() => clampToViewport());
    } else {
      justOpened.value = false;
    }
  }
);

// 定位变化时重新夹紧（如滚动后父组件刷新 x/y）
watch(
  () => [props.x, props.y],
  () => {
    pos.x = props.x;
    pos.y = props.y;
    if (props.visible) nextTick(() => clampToViewport());
  }
);
</script>

<style scoped lang="scss">
/* 浮动操作菜单：绝对定位浮层，定位在锚点上方（空间不足时翻转到下方），水平居中，横向排列 */
.annotation-action-menu {
  position: fixed;
  z-index: 1001;
  transform: translateX(-50%);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  box-shadow: var(--shadow-card);
  user-select: none;
  animation: menu-pop 0.12s ease-out;

  /* 指向锚点的小三角箭头（默认在底部、朝下） */
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

  /* 翻转后箭头在顶部、朝上 */
  &.is-below::before {
    bottom: auto;
    top: -6px;
    border-right: none;
    border-bottom: none;
    border-left: 1px solid var(--border-subtle);
    border-top: 1px solid var(--border-subtle);
  }
}

/* 菜单项按钮 */
.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: none;
  background: transparent;
  border-radius: calc(var(--radius-btn) - 2px);
  color: var(--text-primary);
  font-size: 13px;
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

  &.menu-item--danger {
    color: var(--color-danger, #f56c6c);

    &:hover {
      background: color-mix(in srgb, var(--color-danger, #f56c6c) 12%, transparent);
    }
  }

  .menu-label {
    white-space: nowrap;
  }
}

/* 菜单项间分隔线（横向布局 → 竖线） */
.menu-divider {
  width: 1px;
  height: 16px;
  margin: 0 2px;
  background: var(--border-subtle);
  flex-shrink: 0;
}

/* 出现动画关键帧 */
@keyframes menu-pop {
  from {
    opacity: 0;
    transform: translateX(-50%) scale(0.94);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
}
</style>
