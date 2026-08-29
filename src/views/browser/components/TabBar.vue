<template>
  <!-- 顶部标签栏：favicon / 加载动画 / 标题 / 关闭按钮，支持中键关闭与右键菜单 -->
  <div class="tab-bar" @dblclick.self="onAddTab">
    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-item"
      :class="{ 'is-active': tab.id === activeTabId, 'is-pinned': tab.pinned }"
      :title="tab.url === 'newtab' ? tab.title : tab.url"
      @click="setActiveTab(tab.id)"
      @auxclick.middle="closeTab(tab.id)"
      @contextmenu.prevent.stop="openTabMenu($event, tab.id)"
    >
      <!-- 图标区：加载中转圈，否则 favicon，兜底地球图标；固定标签显示图钉 -->
      <span class="tab-icon">
        <LucideIcon v-if="tab.loading" name="LoaderCircle" :size="14" class="is-spinning" />
        <LucideIcon v-else-if="tab.pinned" name="Pin" :size="12" />
        <img v-else-if="tab.favicon" :src="tab.favicon" class="tab-favicon" alt="" />
        <LucideIcon v-else-if="!tab.isNewTab" name="Earth" :size="14" />
        <LucideIcon v-else name="Plus" :size="14" />
      </span>
      <span class="tab-title">{{ tab.title }}</span>
      <span v-if="!tab.pinned" class="tab-close" title="关闭标签页 (Ctrl+W)" @click.stop="closeTab(tab.id)">
        <LucideIcon name="X" :size="12" />
      </span>
    </div>
    <div class="tab-add" title="新建标签页 (Ctrl+T)" @click="onAddTab">
      <LucideIcon name="Plus" :size="15" />
    </div>

    <!-- 标签右键菜单 -->
    <teleport to="body">
      <div v-if="menuVisible" class="tab-ctx-mask" @click="closeMenu" @contextmenu.prevent="closeMenu" />
      <div v-if="menuVisible" class="tab-ctx-menu" :style="{ left: `${menuX}px`, top: `${menuY}px` }">
        <div class="tab-ctx-item" :class="{ 'is-disabled': closedCount === 0 }" @click="onMenu('restore')">
          <LucideIcon name="History" :size="14" />重新打开已关闭标签
        </div>
        <div class="tab-ctx-item" @click="onMenu('pin')">
          <LucideIcon :name="menuTab?.pinned ? 'PinOff' : 'Pin'" :size="14" />
          {{ menuTab?.pinned ? "取消固定标签" : "固定标签" }}
        </div>
        <div class="tab-ctx-item" @click="onMenu('ua')">
          <LucideIcon name="MonitorSmartphone" :size="14" />
          UA：{{ uaLabel(menuTab?.uaMode) }}
        </div>
        <div class="tab-ctx-item is-danger" @click="onMenu('close-others')">
          <LucideIcon name="X" :size="14" />关闭其他标签
        </div>
        <div class="tab-ctx-item is-danger" @click="onMenu('close-right')">
          <LucideIcon name="X" :size="14" />关闭右侧标签
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - 标签栏
 * 职责：展示标签列表、切换/关闭/新建标签；中键关闭、双击空白新建；
 * 右键菜单（恢复关闭/固定/UA 切换/关闭其他/关闭右侧）；固定标签不可关闭且排最前。
 * 状态与动作来自 useBrowser store。
 */
import { computed, onUnmounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { ElMessage } from "element-plus";
import LucideIcon from "@/components/LucideIcon.vue";
import useBrowser, { type UaMode } from "@/store/useBrowser";

const browserStore = useBrowser();
const { tabs, activeTabId, closedStack } = storeToRefs(browserStore);
const { createTab, closeTab, setActiveTab, restoreClosedTab, togglePin, closeOtherTabs, closeRightTabs, updateTab } = browserStore;

/** 新建空白标签页 */
function onAddTab() {
  createTab();
}

// ==================== 右键菜单 ====================
const menuVisible = ref(false);
const menuX = ref(0);
const menuY = ref(0);
/** 当前菜单对应的标签 ID */
const menuTabId = ref("");
/** 可恢复标签数（控制菜单项禁用态） */
const closedCount = computed(() => closedStack.value.length);
/** 当前菜单对应的标签对象 */
const menuTab = computed(() => tabs.value.find((t) => t.id === menuTabId.value));

/**
 * UA 模式中文标签
 * @param mode 可选，UA 模式
 * @returns 中文
 */
function uaLabel(mode?: UaMode): string {
  const map: Record<UaMode, string> = { default: "默认", mobile: "移动端", desktop: "电脑" };
  return map[mode || "default"];
}

/**
 * 打开标签右键菜单
 * @param e 必填，鼠标事件
 * @param tabId 必填，标签 ID
 */
function openTabMenu(e: MouseEvent, tabId: string) {
  menuTabId.value = tabId;
  menuX.value = Math.min(e.clientX, window.innerWidth - 190);
  menuY.value = Math.min(e.clientY, window.innerHeight - 210);
  menuVisible.value = true;
}

/** 关闭右键菜单 */
function closeMenu() {
  menuVisible.value = false;
}

/**
 * 菜单项动作分发
 * @param action 必填，动作标识
 */
function onMenu(action: string) {
  const tabId = menuTabId.value;
  closeMenu();
  if (!tabId) return;
  switch (action) {
    case "restore":
      if (!restoreClosedTab()) {
        ElMessage.info("没有可恢复的标签");
      }
      break;
    case "pin":
      togglePin(tabId);
      break;
    case "ua": {
      // 循环切换 UA：default -> mobile -> desktop -> default
      const tab = tabs.value.find((t) => t.id === tabId);
      if (!tab) break;
      const order: UaMode[] = ["default", "mobile", "desktop"];
      const next = order[(order.indexOf(tab.uaMode) + 1) % order.length];
      updateTab(tabId, { uaMode: next });
      ElMessage.success(`UA 已切换为${uaLabel(next)}，页面将重新加载`);
      break;
    }
    case "close-others":
      closeOtherTabs(tabId);
      break;
    case "close-right":
      closeRightTabs(tabId);
      break;
  }
}

// 全局兜底：点击其它区域关闭菜单
window.addEventListener("click", closeMenu);
onUnmounted(() => window.removeEventListener("click", closeMenu));
</script>

<style scoped lang="scss">
.tab-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 3px;
  }
  &:hover::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
  }
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  max-width: 180px;
  min-width: 100px;
  transition: all 0.2s;
  user-select: none;
  flex-shrink: 0;

  .tab-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: var(--text-muted);
  }

  .tab-favicon {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    object-fit: contain;
  }

  .tab-title {
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .tab-close {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    opacity: 0;
    transition: all 0.2s;

    &:hover {
      background: var(--bg-hover);
    }
  }

  &.is-active {
    background: var(--color-primary-light);
    border-color: var(--color-primary);

    .tab-title {
      color: var(--color-primary-solid);
      font-weight: 500;
    }
    .tab-close {
      opacity: 0.6;
    }
  }

  &.is-pinned {
    min-width: 0;
    padding: 6px 8px;
    border-style: dashed;

    .tab-icon {
      color: var(--color-primary-solid);
    }
  }

  &:hover {
    &:not(.is-active) {
      background: var(--bg-hover);
    }
    .tab-close {
      opacity: 0.6;
    }
  }
}

.tab-add {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  background: var(--bg-card);
  border: 1px dashed var(--border-subtle);
  color: var(--text-muted);
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--color-primary);
  }
}

.is-spinning {
  animation: tab-spin 1s linear infinite;
}

@keyframes tab-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

<style lang="scss">
/* 标签右键菜单（teleport 到 body，非 scoped） */
.tab-ctx-mask {
  position: fixed;
  inset: 0;
  z-index: 900;
}

.tab-ctx-menu {
  position: fixed;
  z-index: 901;
  min-width: 180px;
  padding: 4px;
  border-radius: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-card);

  .tab-ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }

    &.is-danger {
      color: var(--color-danger, #f56c6c);
    }

    &.is-disabled {
      opacity: 0.4;
      pointer-events: none;
    }
  }
}
</style>
