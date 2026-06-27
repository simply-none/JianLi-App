import { computed, onMounted, ref, watch } from "vue";
import { defineStore, storeToRefs } from "pinia";
import { getStore, setStore } from "../utils/common";
import { initPiniaStatus, type defaultField } from "@/utils/store";

export interface SearchEngine {
  label: string;
  value: string;
  searchUrl: string;
}

export interface Tab {
  id: string;
  title: string;
  url: string;
  isNewTab: boolean;
}

export const searchEngineList: SearchEngine[] = [
  { label: "百度", value: "baidu", searchUrl: "https://www.baidu.com/s?wd={query}" },
  { label: "Google", value: "google", searchUrl: "https://www.google.com/search?q={query}" },
  { label: "Bing", value: "bing", searchUrl: "https://www.bing.com/search?q={query}" },
  { label: "搜狗", value: "sogou", searchUrl: "https://www.sogou.com/web?query={query}" },
  { label: "360", value: "360", searchUrl: "https://www.so.com/s?q={query}" },
  { label: "DuckDuckGo", value: "duckduckgo", searchUrl: "https://duckduckgo.com/?q={query}" },
];

export default defineStore("browser", () => {
  // 标签页列表
  const tabs = ref<Tab[]>([
    {
      id: "tab-1",
      title: "新标签页",
      url: "newtab",
      isNewTab: true,
    },
  ]);

  // 当前激活的标签页 ID
  const activeTabId = ref("tab-1");

  // 默认搜索引擎
  const defaultEngine = ref("baidu");

  // 获取当前激活的标签页
  const activeTab = computed(() => {
    return tabs.value.find((tab) => tab.id === activeTabId.value) || tabs.value[0];
  });

  // 创建新标签页
  function createTab(url: string = "newtab", title: string = "新标签页") {
    const newTab: Tab = {
      id: `tab-${Date.now()}`,
      title,
      url,
      isNewTab: url === "newtab",
    };
    tabs.value.push(newTab);
    activeTabId.value = newTab.id;
    saveToStore();
    return newTab;
  }

  // 关闭标签页
  function closeTab(tabId: string) {
    const index = tabs.value.findIndex((tab) => tab.id === tabId);
    if (index === -1) return;

    // 如果只剩一个标签页，不允许关闭
    if (tabs.value.length === 1) return;

    tabs.value.splice(index, 1);

    // 如果关闭的是当前激活的标签页，切换到相邻的标签页
    if (activeTabId.value === tabId) {
      const newIndex = Math.min(index, tabs.value.length - 1);
      activeTabId.value = tabs.value[newIndex].id;
    }
    saveToStore();
  }

  // 切换标签页
  function setActiveTab(tabId: string) {
    if (tabs.value.some((tab) => tab.id === tabId)) {
      activeTabId.value = tabId;
      saveToStore();
    }
  }

  // 更新标签页 URL
  function updateTabUrl(tabId: string, url: string, title?: string) {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (tab) {
      tab.url = url;
      tab.isNewTab = url === "newtab";
      if (title) {
        tab.title = title;
      }
      saveToStore();
    }
  }

  // 搜索并在新标签页打开
  function search(query: string, engine: string = defaultEngine.value) {
    const searchEngine = searchEngineList.find((e) => e.value === engine);
    if (!searchEngine) return;

    const url = searchEngine.searchUrl.replace("{query}", encodeURIComponent(query));
    createTab(url, `搜索: ${query}`);
  }

  // 设置默认搜索引擎
  function setDefaultEngine(engine: string) {
    defaultEngine.value = engine;
    setStore("browser-default-engine", engine);
  }

  // 保存到 store
  function saveToStore() {
    setStore("browser-tabs", tabs.value);
    setStore("browser-active-tab-id", activeTabId.value);
  }

  // 初始化
  function init() {
    const objectVars: defaultField[] = [
      {
        field: "browser-tabs",
        default: [],
        map: tabs,
      },
      {
        field: "browser-active-tab-id",
        default: "tab-1",
        map: activeTabId,
      },
      {
        field: "browser-default-engine",
        default: "baidu",
        map: defaultEngine,
      },
    ];

    initPiniaStatus(objectVars);

    // 如果没有标签页，创建一个
    if (tabs.value.length === 0) {
      tabs.value = [
        {
          id: "tab-1",
          title: "新标签页",
          url: "newtab",
          isNewTab: true,
        },
      ];
      activeTabId.value = "tab-1";
    }
  }

  function $reset() {
    tabs.value = [
      {
        id: "tab-1",
        title: "新标签页",
        url: "newtab",
        isNewTab: true,
      },
    ];
    activeTabId.value = "tab-1";
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
    updateTabUrl,
    search,
    setDefaultEngine,
    $reset,
  };
});