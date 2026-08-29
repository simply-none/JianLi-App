/**
 * 内置浏览器 - 键盘快捷键（仅在浏览器页面挂载期生效）
 * ------------------------------------------------------------------
 * 对齐主流浏览器常用快捷键：
 * - Ctrl+T 新标签页 / Ctrl+W 关闭标签 / Ctrl+Shift+T 无（不做会话栈）
 * - Ctrl+Tab / Ctrl+Shift+Tab 循环切换标签 / Ctrl+1~8 定位第 N 个 / Ctrl+9 最后一个
 * - Ctrl+L 或 Alt+D 聚焦地址栏 / Ctrl+F 页内查找 / Ctrl+D 收藏切换
 * - Ctrl+R 或 F5 刷新 / Alt+Left / Alt+Right 后退前进
 * 输入框聚焦时仅屏蔽「会误触」的组合（Ctrl+L/F/D、Alt 方向键交给输入框自身行为）。
 */
import { onMounted, onUnmounted } from "vue";
import useBrowser from "@/store/useBrowser";
import { goBack, goForward, reload, navigateTab } from "./useWebviewBridge";
import { toggleBookmark } from "./useBookmarks";

/** 自定义事件名：聚焦地址栏 */
export const EVENT_FOCUS_ADDRESS = "browser:focus-address";
/** 自定义事件名：切换页内查找条 */
export const EVENT_TOGGLE_FIND = "browser:toggle-find";

/**
 * 派发浏览器内部自定义事件（跨组件通信用，走 window 事件总线）
 * @param name 必填，事件名
 */
function dispatchBrowserEvent(name: string) {
  window.dispatchEvent(new CustomEvent(name));
}

/**
 * 判断事件目标是否为文本输入类元素
 * @param target 必填，事件目标
 * @returns true 表示处于输入框内
 */
function isInputTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * 挂载浏览器快捷键（在 index.vue 的 setup 中调用一次；随组件卸载自动解除）
 */
export function useBrowserShortcuts() {
  const store = useBrowser();

  /**
   * 循环切换到相邻标签
   * @param offset 必填，偏移量（+1 下一个 / -1 上一个）
   */
  function cycleTab(offset: number) {
    const total = store.tabs.length;
    if (total <= 1) return;
    const idx = store.tabs.findIndex((t) => t.id === store.activeTabId);
    const next = (idx + offset + total) % total;
    store.setActiveTab(store.tabs[next].id);
  }

  /**
   * 键盘事件统一处理
   * @param e 必填，键盘事件
   */
  function onKeyDown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    const inInput = isInputTarget(e.target);

    // ===== 输入框聚焦时仍生效（避免与输入行为冲突的除外）=====
    if (mod && e.key === "Tab") {
      e.preventDefault();
      cycleTab(e.shiftKey ? -1 : 1);
      return;
    }
    if (mod && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      const n = Number(e.key);
      const target = n === 9 ? store.tabs[store.tabs.length - 1] : store.tabs[n - 1];
      if (target) store.setActiveTab(target.id);
      return;
    }
    if (mod && e.key.toLowerCase() === "t") {
      e.preventDefault();
      store.createTab();
      return;
    }
    if (mod && e.key.toLowerCase() === "w") {
      e.preventDefault();
      store.closeTab(store.activeTabId);
      return;
    }
    if (e.key === "F5" || (mod && e.key.toLowerCase() === "r")) {
      e.preventDefault();
      reload();
      return;
    }

    // ===== 输入框聚焦时不生效的快捷键 =====
    if (inInput) return;

    if (mod && (e.key.toLowerCase() === "l" || e.key.toLowerCase() === "k")) {
      e.preventDefault();
      dispatchBrowserEvent(EVENT_FOCUS_ADDRESS);
      return;
    }
    if (mod && e.key.toLowerCase() === "f") {
      e.preventDefault();
      dispatchBrowserEvent(EVENT_TOGGLE_FIND);
      return;
    }
    if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault();
      const tab = store.activeTab;
      if (tab && !tab.isNewTab) toggleBookmark(tab.url, tab.title);
      return;
    }
    if (e.altKey && e.key === "ArrowLeft") {
      e.preventDefault();
      goBack();
      return;
    }
    if (e.altKey && e.key === "ArrowRight") {
      e.preventDefault();
      goForward();
      return;
    }
  }

  onMounted(() => {
    document.addEventListener("keydown", onKeyDown);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", onKeyDown);
  });
}
