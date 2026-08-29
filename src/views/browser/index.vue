<template>
  <layout-vue>
    <template #main>
      <div class="browser-page">
        <!-- 顶部：标签栏 + 导航栏 -->
        <div class="browser-header">
          <TabBar />
        </div>
        <NavBar
          :tab="activeTab"
          @open-history="showHistory = true"
          @open-bookmarks="onOpenBookmarks"
          @open-downloads="showDownloads = true"
          @open-find="showFind = true"
        />

        <!-- 内容区域：每标签一个独立容器（v-show 切换，状态不丢失） -->
        <div class="browser-content">
          <WebViewPane
            v-for="tab in tabs"
            :key="tab.id"
            :tab="tab"
            :active="tab.id === activeTabId"
            @context-menu="onWebviewContextMenu"
          />
          <FindInPage v-model:visible="showFind" />
        </div>

        <!-- 抽屉与浮层 -->
        <HistoryDrawer v-model:visible="showHistory" />
        <BookmarkPanel v-model:visible="showBookmarks" />
        <DownloadDrawer v-model:visible="showDownloads" />
        <ContextMenu
          v-model:visible="ctxVisible"
          :items="ctxItems"
          :x="ctxX"
          :y="ctxY"
          @select="onCtxSelect"
        />
      </div>
    </template>
  </layout-vue>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - 主面板
 * ------------------------------------------------------------------
 * 架构（P1 重构后）：
 * - TabBar（标签栏）+ NavBar（导航栏/地址栏）+ WebViewPane（每标签独立 webview，v-show 切换）
 * - 数据层：浏览历史/书签存 SQLite（browserApi），标签会话存 localStorage（useBrowser store）
 * - 下载由主进程拦截（electron/main/module/browserDownload.ts），前端 useDownloads 订阅推送
 * 本组件负责：面板组装、抽屉显隐、右键菜单项构造与动作分发、全局监听。
 */
import { onMounted, onUnmounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { ElMessage } from "element-plus";
import LayoutVue from "@/components/layout.vue";
import TabBar from "./components/TabBar.vue";
import NavBar from "./components/NavBar.vue";
import WebViewPane from "./components/WebViewPane.vue";
import HistoryDrawer from "./components/HistoryDrawer.vue";
import BookmarkPanel from "./components/BookmarkPanel.vue";
import DownloadDrawer from "./components/DownloadDrawer.vue";
import FindInPage from "./components/FindInPage.vue";
import ContextMenu from "./components/ContextMenu.vue";
import useBrowser from "@/store/useBrowser";
import { loadBookmarks, toggleBookmark } from "./composables/useBookmarks";
import { useBrowserShortcuts, EVENT_TOGGLE_FIND } from "./composables/useBrowserShortcuts";
import { goBack, goForward, reload, toggleDevTools } from "./composables/useWebviewBridge";

const browserStore = useBrowser();
const { tabs, activeTabId, activeTab } = storeToRefs(browserStore);

// ==================== 抽屉/浮层状态 ====================
const showHistory = ref(false);
const showBookmarks = ref(false);
const showDownloads = ref(false);
const showFind = ref(false);

// ==================== 右键菜单 ====================
/** 菜单项结构（与 ContextMenu 组件约定一致） */
interface CtxMenuItem {
  key: string;
  label: string;
  icon: string;
  danger?: boolean;
}

const ctxVisible = ref(false);
const ctxX = ref(0);
const ctxY = ref(0);
/** 当前菜单对应的标签 ID */
const ctxTabId = ref("");
/** webview context-menu 事件参数（x/y/linkURL/selectionText 等） */
const ctxParams = ref<any>(null);
/** 菜单项列表（按参数动态构造） */
const ctxItems = ref<CtxMenuItem[]>([]);

/**
 * webview 右键菜单事件：按上下文构造菜单项
 * @param payload 必填，{ tabId, params }
 */
function onWebviewContextMenu(payload: { tabId: string; params: any }) {
  const p = payload.params || {};
  const items: CtxMenuItem[] = [];

  // 链接上下文
  if (p.linkURL) {
    items.push({ key: "open-link", label: "在新标签页中打开链接", icon: "SquareArrowOutUpRight" });
    items.push({ key: "copy-link", label: "复制链接地址", icon: "Link" });
  }
  // 选中文本上下文
  if (p.selectionText && p.selectionText.trim()) {
    items.push({ key: "copy-text", label: "复制", icon: "Copy" });
  }
  // 常规导航
  items.push({ key: "back", label: "返回", icon: "ArrowLeft" });
  items.push({ key: "forward", label: "前进", icon: "ArrowRight" });
  items.push({ key: "reload", label: "重新加载", icon: "RotateCw" });
  if (!p.linkURL && !p.selectionText) {
    items.push({ key: "bookmark", label: "收藏此页", icon: "BookmarkPlus" });
  }
  items.push({ key: "devtools", label: "检查元素", icon: "Code" });

  ctxTabId.value = payload.tabId;
  ctxParams.value = p;
  ctxItems.value = items;
  // 防止菜单溢出视口
  ctxX.value = Math.min(p.x ?? 0, window.innerWidth - 200);
  ctxY.value = Math.min(p.y ?? 0, window.innerHeight - items.length * 36 - 20);
  ctxVisible.value = true;
}

/**
 * 右键菜单项动作分发
 * @param item 必填，被选中的菜单项
 */
async function onCtxSelect(item: CtxMenuItem) {
  const params = ctxParams.value || {};
  switch (item.key) {
    case "open-link":
      browserStore.createTab(params.linkURL, "新页面");
      break;
    case "copy-link":
      window.ipcRenderer.clipboard.writeText(params.linkURL || "");
      ElMessage.success("链接地址已复制");
      break;
    case "copy-text":
      window.ipcRenderer.clipboard.writeText(params.selectionText || "");
      ElMessage.success("已复制");
      break;
    case "back":
      goBack(ctxTabId.value);
      break;
    case "forward":
      goForward(ctxTabId.value);
      break;
    case "reload":
      reload(ctxTabId.value);
      break;
    case "bookmark": {
      const tab = browserStore.tabs.find((t) => t.id === ctxTabId.value);
      if (tab) {
        const marked = await toggleBookmark(tab.url, tab.title);
        ElMessage.success(marked ? "已收藏" : "已取消收藏");
      }
      break;
    }
    case "devtools":
      toggleDevTools(ctxTabId.value);
      break;
  }
}

/**
 * 打开书签面板（首次打开时拉取数据）
 */
function onOpenBookmarks() {
  showBookmarks.value = true;
}

// ==================== 初始化 ====================

/** 全局事件监听：Ctrl+F 切换查找条 */
function onToggleFindEvent() {
  showFind.value = !showFind.value;
}

onMounted(async () => {
  // 加载书签（供地址栏建议与星标状态）
  loadBookmarks();
  // 页内查找快捷键
  window.addEventListener(EVENT_TOGGLE_FIND, onToggleFindEvent);
});

onUnmounted(() => {
  window.removeEventListener(EVENT_TOGGLE_FIND, onToggleFindEvent);
});

// 挂载浏览器快捷键（内部自管理生命周期）
useBrowserShortcuts();
</script>

<style scoped lang="scss">
.browser-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  position: relative;
  overflow: hidden;
}

.browser-header {
  display: flex;
  align-items: center;
  padding: 6px 12px 0;
  background: var(--bg-sidebar);
}

.browser-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}
</style>
