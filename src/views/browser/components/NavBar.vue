<template>
  <!-- 导航工具栏：后退/前进/刷新/停止 + 地址栏 + 缩放/菜单 -->
  <div class="nav-bar">
    <div class="nav-actions">
      <span
        class="nav-btn"
        :class="{ 'is-disabled': !tab.canBack }"
        title="后退 (Alt+←)"
        @click="goBack()"
      >
        <LucideIcon name="ArrowLeft" :size="16" />
      </span>
      <span
        class="nav-btn"
        :class="{ 'is-disabled': !tab.canForward }"
        title="前进 (Alt+→)"
        @click="goForward()"
      >
        <LucideIcon name="ArrowRight" :size="16" />
      </span>
      <span class="nav-btn" :title="tab.loading ? '停止加载' : '刷新 (Ctrl+R)'" @click="onReloadOrStop">
        <LucideIcon :name="tab.loading ? 'X' : 'RotateCw'" :size="15" />
      </span>
      <span class="nav-btn" title="回到新标签页" @click="goHome()">
        <LucideIcon name="House" :size="15" />
      </span>
    </div>

    <!-- 地址栏 -->
    <AddressBar :tab="tab" />

    <div class="nav-actions">
      <!-- 缩放控制（仅网页页展示） -->
      <el-dropdown v-if="!tab.isNewTab" trigger="click" @command="onZoomCommand">
        <span class="nav-btn" :title="`缩放 ${zoomPercent}%`">
          <span class="zoom-label">{{ zoomPercent }}%</span>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="in">放大</el-dropdown-item>
            <el-dropdown-item command="out">缩小</el-dropdown-item>
            <el-dropdown-item command="reset" divided>重置为 100%</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 主菜单：历史/书签/下载/查找/开发者工具/清数据 -->
      <el-dropdown trigger="click" @command="onMenuCommand">
        <span class="nav-btn" title="浏览器菜单">
          <LucideIcon name="EllipsisVertical" :size="16" />
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="history">
              <span class="menu-item"><LucideIcon name="History" :size="14" />历史记录</span>
            </el-dropdown-item>
            <el-dropdown-item command="bookmarks">
              <span class="menu-item"><LucideIcon name="BookMarked" :size="14" />书签管理</span>
            </el-dropdown-item>
            <el-dropdown-item command="downloads">
              <span class="menu-item"><LucideIcon name="Download" :size="14" />下载内容</span>
            </el-dropdown-item>
            <el-dropdown-item v-if="!tab.isNewTab" command="find" divided>
              <span class="menu-item"><LucideIcon name="Search" :size="14" />页内查找 (Ctrl+F)</span>
            </el-dropdown-item>
            <el-dropdown-item v-if="!tab.isNewTab" command="devtools">
              <span class="menu-item"><LucideIcon name="Code" :size="14" />开发者工具</span>
            </el-dropdown-item>
            <el-dropdown-item command="clear-history" divided>
              <span class="menu-item is-danger"><LucideIcon name="Trash2" :size="14" />清空浏览历史</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - 导航工具栏
 * 职责：前进/后退/刷新/停止/主页按钮、承载地址栏、缩放控制与主菜单。
 * 全部动作经 useWebviewBridge 作用到当前激活标签的 webview。
 */
import { computed } from "vue";
import { ElMessageBox } from "element-plus";
import LucideIcon from "@/components/LucideIcon.vue";
import AddressBar from "./AddressBar.vue";
import type { Tab } from "@/store/useBrowser";
import { goBack, goForward, reload, stopLoad, goHome, applyZoom, zoomToPercent, toggleDevTools } from "../composables/useWebviewBridge";
import { clearHistory } from "../api/browserApi";

/** 组件入参 */
const props = defineProps<{
  /** 必填，当前激活标签 */
  tab: Tab;
}>();

/** 组件事件 */
const emit = defineEmits<{
  /** 打开历史抽屉 */
  (e: "open-history"): void;
  /** 打开书签面板 */
  (e: "open-bookmarks"): void;
  /** 打开下载抽屉 */
  (e: "open-downloads"): void;
  /** 打开页内查找条 */
  (e: "open-find"): void;
}>();

/** 缩放百分比显示值 */
const zoomPercent = computed(() => zoomToPercent(props.tab.zoomLevel));

/**
 * 刷新/停止：加载中点击为停止，否则刷新
 */
function onReloadOrStop() {
  if (props.tab.loading) {
    stopLoad();
  } else {
    reload();
  }
}

/**
 * 缩放菜单指令处理
 * @param command 必填，指令：in / out / reset
 */
function onZoomCommand(command: string) {
  const delta = command === "in" ? 0.5 : command === "out" ? -0.5 : 0;
  applyZoom(props.tab.id, delta);
}

/**
 * 主菜单指令处理
 * @param command 必填，菜单指令
 */
async function onMenuCommand(command: string) {
  switch (command) {
    case "history":
      emit("open-history");
      break;
    case "bookmarks":
      emit("open-bookmarks");
      break;
    case "downloads":
      emit("open-downloads");
      break;
    case "find":
      emit("open-find");
      break;
    case "devtools":
      toggleDevTools(props.tab.id);
      break;
    case "clear-history":
      try {
        await ElMessageBox.confirm("将删除全部浏览历史记录，此操作不可恢复。", "清空浏览历史", {
          confirmButtonText: "清空",
          cancelButtonText: "取消",
          type: "warning",
        });
        await clearHistory();
        ElMessageBox.alert("浏览历史已清空。", "提示", { confirmButtonText: "知道了" });
      } catch {
        // 用户取消
      }
      break;
  }
}
</script>

<style scoped lang="scss">
.nav-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border-subtle);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.nav-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.15s;
  user-select: none;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  &.is-disabled {
    opacity: 0.35;
    pointer-events: none;
  }

  .zoom-label {
    font-size: 11px;
    white-space: nowrap;
  }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;

  &.is-danger {
    color: var(--color-danger, #f56c6c);
  }
}
</style>
