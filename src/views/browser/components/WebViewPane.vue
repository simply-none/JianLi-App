<template>
  <!-- 单标签容器：每标签独立 webview（懒加载），v-show 由父级控制显隐 -->
  <div v-show="active" class="webview-pane">
    <!-- 新标签页内容 -->
    <NewTabPage v-if="tab.isNewTab" />

    <template v-else>
      <!-- 加载进度条 -->
      <div v-if="tab.loading" class="pane-loading-bar"></div>

      <!-- 网页内容（首次激活才挂载，之后常驻，切换不丢状态） -->
      <webview
        v-if="shouldMount"
        ref="webviewRef"
        :src="initialUrl"
        :useragent="initialUserAgent"
        class="webview-frame"
        partition="persist:browser"
        allowpopups
        webpreferences="nodeIntegration=no,contextIsolation=yes"
        @did-start-loading="onStartLoading"
        @did-stop-loading="onStopLoading"
        @dom-ready="onDomReady"
        @did-navigate="onDidNavigate"
        @did-navigate-in-page="onDidNavigateInPage"
        @did-fail-load="onFailLoad"
        @page-title-updated="onTitleUpdated"
        @page-favicon-updated="onFaviconUpdated"
        @new-window="onNewWindow"
        @context-menu="onContextMenu"
        @found-in-page="onFoundInPage"
      />

      <!-- 加载失败错误页 -->
      <div v-if="tab.error && !tab.loading" class="pane-error">
        <LucideIcon name="TriangleAlert" :size="44" color="var(--color-warning, #e6a23c)" />
        <h2 class="pane-error-title">网页无法访问</h2>
        <p class="pane-error-desc">{{ errorDesc }}（错误码 {{ tab.error.code }}）</p>
        <p class="pane-error-url">{{ tab.error.url }}</p>
        <el-button type="primary" @click="onErrorReload">
          <LucideIcon name="RotateCw" :size="14" />
          <span style="margin-left: 6px">重新加载</span>
        </el-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - 单标签 webview 容器
 * ------------------------------------------------------------------
 * 核心设计（解决旧版「单 webview 复用导致状态丢失」的架构缺陷）：
 * - 每个标签对应一个独立 webview 实例，标签间切换用 v-show，页面状态全程保留；
 * - 懒加载：标签首次被激活才挂载 webview（后台标签不占资源）；
 * - 会话分区：partition="persist:browser"，cookie/登录态跨会话持久且与爬虫等模块隔离；
 * - :src 只绑定挂载时的初始地址（initialUrl），后续导航一律走 loadURL，避免
 *   Vue 响应式更新 src 属性造成的重复导航。
 */
import { ref, watch, onMounted, onUnmounted, computed } from "vue";
import LucideIcon from "@/components/LucideIcon.vue";
import NewTabPage from "./NewTabPage.vue";
import type { Tab } from "@/store/useBrowser";
import useBrowser from "@/store/useBrowser";
import { setWebview, removeWebview, refreshNavState, recordHistory, emitFoundInPage, applyTabUserAgent, uaStringFor } from "../composables/useWebviewBridge";
import { applyNightMode, useNightMode } from "../composables/useNightMode";
import { injectSnifferHook } from "../composables/useSnifferHook";

/** 组件入参 */
const props = defineProps<{
  /** 必填，本容器对应的标签数据 */
  tab: Tab;
  /** 必填，是否为当前激活标签（控制 v-show） */
  active: boolean;
}>();

/** 组件事件 */
const emit = defineEmits<{
  /** 右键菜单：透传 webview context-menu 事件参数 */
  (e: "context-menu", payload: { tabId: string; params: any }): void;
}>();

const browserStore = useBrowser();

// ==================== 懒加载控制 ====================
const webviewRef = ref<any>(null);
/** 是否已挂载 webview（首次激活置 true） */
const shouldMount = ref(false);
/** 挂载时的初始地址（不再响应式跟随 tab.url） */
const initialUrl = ref("");
/** 挂载时的初始 UA（按标签 uaMode 决定；default 为空串不覆盖） */
const initialUserAgent = computed(() => uaStringFor(props.tab.uaMode));

// 夜间模式状态（单例）：模式变化时对本标签重新注入
const { nightOn } = useNightMode();
watch(nightOn, () => {
  if (shouldMount.value) applyNightMode(props.tab.id);
});

// UA 模式变化：立即应用到已挂载的 webview 并重载（UA 仅对新请求生效）
watch(
  () => props.tab.uaMode,
  () => {
    if (!shouldMount.value) return;
    if (applyTabUserAgent(props.tab.id)) {
      webviewRef.value?.reload();
    }
  }
);

// 激活时懒挂载
watch(
  () => props.active,
  (val) => {
    if (val && !shouldMount.value && !props.tab.isNewTab) {
      initialUrl.value = props.tab.url;
      shouldMount.value = true;
    }
  },
  { immediate: true }
);

// 新标签页被导航为网页地址且处于激活态：立即挂载
watch(
  () => props.tab.url,
  (url) => {
    if (props.active && !props.tab.isNewTab && url && url !== "newtab" && (!initialUrl.value || initialUrl.value === "newtab")) {
      initialUrl.value = url;
      shouldMount.value = true;
    }
  }
);

// 挂载后向注册表登记
watch(webviewRef, (el) => {
  if (el) {
    setWebview(props.tab.id, el);
    refreshNavState(props.tab.id, el);
  }
});

// ==================== webview 事件处理 ====================

/**
 * DOM 就绪：应用夜间模式样式注入（夜间模式开关）；注入视频嗅探页面 Hook
 */
function onDomReady() {
  applyNightMode(props.tab.id);
  injectSnifferHook(props.tab.id);
}

/** 开始加载：置 loading、清错误 */
function onStartLoading() {
  browserStore.updateTab(props.tab.id, { loading: true, error: null });
}

/** 停止加载：清 loading 并刷新前进后退状态 */
function onStopLoading() {
  browserStore.updateTab(props.tab.id, { loading: false });
  refreshNavState(props.tab.id, webviewRef.value);
}

/**
 * 主框架导航完成：回写地址、记录历史、刷新导航状态
 * @param e 必填，did-navigate 事件参数
 */
function onDidNavigate(e: any) {
  if (e?.isMainFrame === false) return;
  const url: string = e?.url || "";
  browserStore.updateTab(props.tab.id, { url, error: null });
  recordHistory(props.tab.id, url, props.tab.title);
  refreshNavState(props.tab.id, webviewRef.value);
}

/**
 * 页内导航（SPA 路由跳转）：回写地址并记录历史
 * @param e 必填，did-navigate-in-page 事件参数
 */
function onDidNavigateInPage(e: any) {
  if (e?.isMainFrame === false) return;
  const url: string = e?.url || "";
  if (!url) return;
  browserStore.updateTab(props.tab.id, { url });
  recordHistory(props.tab.id, url, props.tab.title);
  refreshNavState(props.tab.id, webviewRef.value);
}

/**
 * 加载失败：主框架且非用户中断（-3）时记录错误并展示错误页
 * @param e 必填，did-fail-load 事件参数
 */
function onFailLoad(e: any) {
  if (e?.isMainFrame === false) return;
  if (e?.errorCode === -3) return; // ERR_ABORTED：用户主动停止/跳转，不算失败
  browserStore.updateTab(props.tab.id, {
    loading: false,
    error: { code: e?.errorCode ?? -1, desc: e?.errorDescription ?? "未知错误", url: e?.validatedURL || props.tab.url },
  });
}

/**
 * 页面标题更新
 * @param e 必填，page-title-updated 事件参数
 */
function onTitleUpdated(e: any) {
  const title: string = e?.title || "";
  if (title) {
    browserStore.updateTab(props.tab.id, { title: title.slice(0, 30) });
  }
}

/**
 * 页面图标更新
 * @param e 必填，page-favicon-updated 事件参数
 */
function onFaviconUpdated(e: any) {
  const favicons: string[] = e?.favicons || [];
  browserStore.updateTab(props.tab.id, { favicon: favicons[favicons.length - 1] || "" });
}

/**
 * 新窗口请求（target=_blank / window.open，配合 allowpopups）：以新标签打开
 * @param e 必填，new-window 事件参数
 */
function onNewWindow(e: any) {
  const url: string = e?.url || "";
  if (url && url.startsWith("http")) {
    browserStore.createTab(url, "新页面");
  }
}

/**
 * 右键菜单：透传给父级展示
 * @param e 必填，context-menu 事件参数
 */
function onContextMenu(e: any) {
  emit("context-menu", { tabId: props.tab.id, params: e?.params || e });
}

/**
 * 页内查找结果：经桥分发到查找条组件
 * @param e 必填，found-in-page 事件参数
 */
function onFoundInPage(e: any) {
  emitFoundInPage(props.tab.id, e?.result ?? e);
}

/** 错误页描述文案（常见错误码中文化） */
const errorDesc = computed(() => {
  const code = props.tab.error?.code;
  const map: Record<number, string> = {
    [-105]: "找不到该网站的服务器，请检查网址是否正确",
    [-106]: "网络连接失败，请检查网络后重试",
    [-118]: "连接超时，服务器响应时间过长",
    [-7]: "连接被拒绝",
    [-21]: "网络已更改，请重试",
    [-50]: "访问被拒绝",
  };
  return map[code as number] || props.tab.error?.desc || "加载页面时出现问题";
});

/** 错误页「重新加载」 */
function onErrorReload() {
  browserStore.updateTab(props.tab.id, { error: null, loading: true });
  webviewRef.value?.reload();
}

// ==================== 生命周期 ====================
onMounted(() => {
  // 已激活且非新标签页（如会话恢复后当前标签）需要立即挂载
  if (props.active && !props.tab.isNewTab && props.tab.url && props.tab.url !== "newtab") {
    initialUrl.value = props.tab.url;
    shouldMount.value = true;
  }
});

onUnmounted(() => {
  removeWebview(props.tab.id);
});
</script>

<style scoped lang="scss">
.webview-pane {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);

  .webview-frame {
    width: 100%;
    height: 100%;
    flex: 1;
    border: none;
    background: #fff;
  }
}

.pane-loading-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 5;
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
  background-size: 40% 100%;
  background-repeat: no-repeat;
  animation: pane-loading-slide 1.2s ease-in-out infinite;
}

@keyframes pane-loading-slide {
  0% {
    background-position: -40% 0;
  }
  100% {
    background-position: 140% 0;
  }
}

.pane-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--bg-base);
  z-index: 4;
  padding: 20px;

  .pane-error-title {
    font-size: 20px;
    color: var(--text-primary);
    margin: 6px 0 0;
  }

  .pane-error-desc {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0;
  }

  .pane-error-url {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0 0 10px;
    max-width: 80%;
    word-break: break-all;
    text-align: center;
  }
}
</style>
