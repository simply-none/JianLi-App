/**
 * 内置浏览器状态仓库
 * ------------------------------------------------------------------
 * 职责：标签页生命周期（创建/关闭/切换/更新）、默认搜索引擎、标签会话持久化。
 * - 运行时状态（favicon/loading/错误/前进后退/缩放）保存在内存中的 Tab 对象上，不持久化；
 * - 持久化仅保存 { id, title, url }，应用重启后按保存的 url 恢复会话（懒加载：切到该标签才挂载 webview）；
 * - 浏览历史 / 书签等业务数据不在此仓库，走 views/browser/api/browserApi.ts（SQLite）。
 */
import { computed, onMounted, ref } from "vue";
import { defineStore } from "pinia";
import { getStore, setStore } from "../utils/common";
import { initPiniaStatus, type defaultField } from "@/utils/store";

/** 搜索引擎配置 */
export interface SearchEngine {
  /** 显示名称 */
  label: string;
  /** 引擎标识 */
  value: string;
  /** 搜索地址模板，{query} 为关键词占位符 */
  searchUrl: string;
}

/** 标签页加载失败信息 */
export interface TabError {
  /** Chromium 网络错误码（如 -105 名称解析失败、-106 无法连接） */
  code: number;
  /** 错误描述（Chromium 英文原文） */
  desc: string;
  /** 加载失败的地址 */
  url: string;
}

/** 标签页数据（含运行时状态） */
export interface Tab {
  /** 唯一 ID，形如 tab-{时间戳}-{随机串} */
  id: string;
  /** 标签标题 */
  title: string;
  /** 当前地址，'newtab' 表示新标签页 */
  url: string;
  /** 是否新标签页 */
  isNewTab: boolean;
  /** 页面图标地址（运行时，不持久化） */
  favicon: string;
  /** 是否加载中（运行时） */
  loading: boolean;
  /** 加载失败信息（运行时，null 表示正常） */
  error: TabError | null;
  /** 是否可后退（运行时） */
  canBack: boolean;
  /** 是否可前进（运行时） */
  canForward: boolean;
  /** 缩放级别，0 表示 100%，范围 [-3, 3]，步进 0.5（运行时） */
  zoomLevel: number;
}

/** 搜索引擎列表 */
export const searchEngineList: SearchEngine[] = [
  { label: "百度", value: "baidu", searchUrl: "https://www.baidu.com/s?wd={query}" },
  { label: "Google", value: "google", searchUrl: "https://www.google.com/search?q={query}" },
  { label: "Bing", value: "bing", searchUrl: "https://www.bing.com/search?q={query}" },
  { label: "搜狗", value: "sogou", searchUrl: "https://www.sogou.com/web?query={query}" },
  { label: "360", value: "360", searchUrl: "https://www.so.com/s?q={query}" },
  { label: "DuckDuckGo", value: "duckduckgo", searchUrl: "https://duckduckgo.com/?q={query}" },
];

/**
 * 按引擎标识构造搜索地址
 * @param query 必填，搜索关键词
 * @param engineValue 可选，引擎标识，默认百度
 * @returns 编码关键词后的完整搜索地址；引擎不存在时返回空串
 */
export function buildSearchUrl(query: string, engineValue: string = "baidu"): string {
  const engine = searchEngineList.find((e) => e.value === engineValue);
  if (!engine) return "";
  return engine.searchUrl.replace("{query}", encodeURIComponent(query));
}

/**
 * 生成新标签页对象（含运行时状态默认值）
 * @param url 可选，初始地址，默认 'newtab'
 * @param title 可选，初始标题，默认 '新标签页'
 * @returns 完整 Tab 对象
 */
function makeTab(url: string = "newtab", title: string = "新标签页"): Tab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    url,
    isNewTab: url === "newtab",
    favicon: "",
    loading: false,
    error: null,
    canBack: false,
    canForward: false,
    zoomLevel: 0,
  };
}

/** 持久化时的精简 Tab 结构（仅会话恢复所需字段） */
interface StoredTab {
  id: string;
  title: string;
  url: string;
}

export default defineStore("browser", () => {
  // ==================== 状态 ====================
  /** 标签页列表 */
  const tabs = ref<Tab[]>([makeTab()]);
  /** 当前激活的标签页 ID */
  const activeTabId = ref("");
  /** 默认搜索引擎标识 */
  const defaultEngine = ref("baidu");

  /** 当前激活的标签页（找不到时回退第一个标签） */
  const activeTab = computed<Tab>(() => {
    return tabs.value.find((tab) => tab.id === activeTabId.value) || tabs.value[0];
  });

  // ==================== 标签生命周期 ====================
  /**
   * 创建新标签页
   * @param url 可选，初始地址，默认 'newtab'
   * @param title 可选，初始标题，默认 '新标签页'
   * @param activate 可选，创建后是否立即激活，默认 true（后台打开传 false）
   * @returns 新建的 Tab 对象
   */
  function createTab(url: string = "newtab", title: string = "新标签页", activate: boolean = true): Tab {
    const tab = makeTab(url, title);
    tabs.value.push(tab);
    if (activate) {
      activeTabId.value = tab.id;
    }
    saveToStore();
    return tab;
  }

  /**
   * 关闭标签页；关闭最后一个标签时自动补一个空白新标签页（对齐主流浏览器行为）
   * @param tabId 必填，要关闭的标签 ID
   */
  function closeTab(tabId: string) {
    const index = tabs.value.findIndex((tab) => tab.id === tabId);
    if (index === -1) return;

    // 关闭最后一个：直接替换为空白新标签页
    if (tabs.value.length === 1) {
      tabs.value = [makeTab()];
      activeTabId.value = tabs.value[0].id;
      saveToStore();
      return;
    }

    tabs.value.splice(index, 1);

    // 关闭的是当前激活标签时，切换到相邻（优先右侧）标签
    if (activeTabId.value === tabId) {
      const newIndex = Math.min(index, tabs.value.length - 1);
      activeTabId.value = tabs.value[newIndex].id;
    }
    saveToStore();
  }

  /**
   * 切换激活标签页
   * @param tabId 必填，目标标签 ID（不存在时忽略）
   */
  function setActiveTab(tabId: string) {
    if (tabs.value.some((tab) => tab.id === tabId)) {
      activeTabId.value = tabId;
      saveToStore();
    }
  }

  /**
   * 批量更新标签页字段（局部 patch）
   * @param tabId 必填，标签 ID
   * @param patch 必填，要更新的字段集合（浅合并）
   */
  function updateTab(tabId: string, patch: Partial<Tab>) {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (!tab) return;
    Object.assign(tab, patch);
    if (patch.url !== undefined) {
      tab.isNewTab = patch.url === "newtab";
    }
  }

  /**
   * 更新标签页 URL（兼容旧接口，语义同 updateTab）
   * @param tabId 必填，标签 ID
   * @param url 必填，新地址
   * @param title 可选，新标题
   */
  function updateTabUrl(tabId: string, url: string, title?: string) {
    updateTab(tabId, title ? { url, title } : { url });
  }

  /**
   * 按引擎构造搜索地址（返回地址由调用方决定导航目标）
   * @param query 必填，搜索关键词
   * @param engine 可选，引擎标识，默认当前默认引擎
   * @returns 搜索地址；引擎不存在返回空串
   */
  function search(query: string, engine: string = defaultEngine.value): string {
    return buildSearchUrl(query, engine);
  }

  /**
   * 设置默认搜索引擎并持久化
   * @param engine 必填，引擎标识
   */
  function setDefaultEngine(engine: string) {
    defaultEngine.value = engine;
    setStore("browser-default-engine", engine);
  }

  // ==================== 持久化 ====================
  /** 保存标签会话（仅精简字段）与激活标签 ID */
  function saveToStore() {
    const stored: StoredTab[] = tabs.value.map((t) => ({ id: t.id, title: t.title, url: t.url }));
    setStore("browser-tabs", stored);
    setStore("browser-active-tab-id", activeTabId.value);
  }

  /**
   * 初始化：从持久化恢复标签会话与配置
   * 历史兼容：老版本持久化的是完整 Tab 数组，此处仅取会话恢复所需字段并补全运行时默认值
   */
  function init() {
    const objectVars: defaultField[] = [
      { field: "browser-active-tab-id", default: "", map: activeTabId },
      { field: "browser-default-engine", default: "baidu", map: defaultEngine },
    ];
    initPiniaStatus(objectVars);

    // 恢复标签会话（手动处理，运行时字段不参与合并）
    let raw: any = getStore("browser-tabs");
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }
    if (Array.isArray(raw) && raw.length > 0) {
      tabs.value = raw
        .filter((t: any) => t && typeof t.url === "string")
        .map((t: any) => makeTab(t.url, typeof t.title === "string" && t.title ? t.title : "新标签页"));
      // 恢复 id 与激活态（id 冲突时重新生成）
      const usedIds = new Set<string>();
      tabs.value = tabs.value.map((t) => {
        const id = t.id && !usedIds.has(t.id) ? t.id : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        usedIds.add(id);
        return { ...t, id };
      });
      if (!tabs.value.some((t) => t.id === activeTabId.value)) {
        activeTabId.value = tabs.value[0].id;
      }
    } else {
      tabs.value = [makeTab()];
      activeTabId.value = tabs.value[0].id;
    }
  }

  /** 重置为初始状态（单个空白新标签页） */
  function $reset() {
    tabs.value = [makeTab()];
    activeTabId.value = tabs.value[0].id;
    defaultEngine.value = "baidu";
  }

  onMounted(() => {
    init();
  });

  return {
    tabs,
    activeTabId,
    defaultEngine,
    activeTab,
    searchEngineList,
    createTab,
    closeTab,
    setActiveTab,
    updateTab,
    updateTabUrl,
    search,
    setDefaultEngine,
    $reset,
  };
});
