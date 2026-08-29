<template>
  <!-- 网页右键菜单：固定定位浮层，点击外部关闭 -->
  <teleport to="body">
    <div v-if="visible" class="ctx-mask" @click="onClose" @contextmenu.prevent="onClose">
      <div
        class="ctx-menu"
        :style="{ left: `${x}px`, top: `${y}px` }"
        @click.stop
      >
        <div
          v-for="item in items"
          :key="item.key"
          class="ctx-item"
          :class="{ 'is-danger': item.danger }"
          @click="onSelect(item)"
        >
          <span class="ctx-icon">
            <LucideIcon :name="item.icon" :size="14" />
          </span>
          <span class="ctx-label">{{ item.label }}</span>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - 网页右键菜单（通用浮层）
 * 职责：按父级构造的菜单项列表渲染浮层，选中后回调并关闭。
 * 菜单项由 index.vue 根据 webview context-menu 事件参数动态构造。
 */
import LucideIcon from "@/components/LucideIcon.vue";

/** 菜单项结构（与 index.vue 中构造的字段一致） */
interface CtxMenuItem {
  /** 唯一键 */
  key: string;
  /** 显示文案 */
  label: string;
  /** 图标名（需存在于 LucideIcon nameMap） */
  icon: string;
  /** 是否危险操作（红色强调） */
  danger?: boolean;
}

const visible = defineModel<boolean>("visible", { default: false });

/** 组件入参 */
defineProps<{
  /** 必填，菜单项列表 */
  items: CtxMenuItem[];
  /** 必填，浮层横坐标（相对视口） */
  x: number;
  /** 必填，浮层纵坐标（相对视口） */
  y: number;
}>();

const emit = defineEmits<{
  /** 选中某菜单项 */
  (e: "select", item: CtxMenuItem): void;
}>();

/**
 * 选中菜单项：回调父级并关闭
 * @param item 必填，被选中的菜单项
 */
function onSelect(item: CtxMenuItem) {
  emit("select", item);
  visible.value = false;
}

/** 关闭菜单 */
function onClose() {
  visible.value = false;
}
</script>

<style scoped lang="scss">
.ctx-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
}

.ctx-menu {
  position: fixed;
  min-width: 180px;
  padding: 4px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  box-shadow: var(--shadow-card);
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);

  &:hover {
    background: var(--bg-hover);
  }

  &.is-danger {
    color: var(--color-danger, #f56c6c);
  }

  .ctx-icon {
    display: flex;
    align-items: center;
    color: var(--text-muted);
  }
}
</style>
