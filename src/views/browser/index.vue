<template>
  <layout-vue>
    <template #main>
      <div class="browser-page">
        <!-- 顶部标签栏 -->
        <div class="browser-header">
          <div class="tab-bar">
            <div
              v-for="tab in tabs"
              :key="tab.id"
              class="tab-item"
              :class="{ 'is-active': tab.id === activeTabId }"
              @click="setActiveTab(tab.id)"
            >
              <span class="tab-title">{{ tab.title }}</span>
              <span v-if="tabs.length > 1" class="tab-close" @click.stop="closeTab(tab.id)">
                <LucideIcon name="X" />
              </span>
            </div>
            <div class="tab-add" @click="createTab()">
              <LucideIcon name="Plus" />
            </div>
          </div>
          <div class="header-actions">
            <el-select v-model="currentEngine" placeholder="选择搜索引擎" size="small" class="engine-select">
              <el-option
                v-for="engine in searchEngineList"
                :key="engine.value"
                :label="engine.label"
                :value="engine.value"
              />
            </el-select>
          </div>
        </div>

        <!-- 内容区域 -->
        <div class="browser-content">
          <!-- 新标签页 -->
          <div v-if="activeTab?.isNewTab" class="new-tab-page">
            <div class="search-container">
              <h1 class="search-title">快捷搜索</h1>
              <div class="search-box">
                <el-input
                  v-model="searchQuery"
                  placeholder="输入关键词搜索..."
                  size="large"
                  class="search-input"
                  @keyup.enter="handleSearch"
                >
                  <template #prefix>
                    <LucideIcon name="Search" />
                  </template>
                </el-input>
                <el-button type="primary" size="large" @click="handleSearch" class="search-btn">
                  搜索
                </el-button>
              </div>
              <div class="quick-links">
                <div class="quick-link" @click="quickSearch('百度首页', 'baidu')">
                  <span class="link-icon">🔍</span>
                  <span class="link-text">百度</span>
                </div>
                <div class="quick-link" @click="quickSearch('Google首页', 'google')">
                  <span class="link-icon">🌐</span>
                  <span class="link-text">Google</span>
                </div>
                <div class="quick-link" @click="quickSearch('Bing首页', 'bing')">
                  <span class="link-icon">🪶</span>
                  <span class="link-text">Bing</span>
                </div>
                <div class="quick-link" @click="quickSearch('GitHub', 'github')">
                  <span class="link-icon">🐙</span>
                  <span class="link-text">GitHub</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 网页内容 -->
          <webview
            ref="webviewRef"
            v-else-if="activeTab?.url && !activeTab.isNewTab"
            :src="activeTab.url"
            class="webview-frame"
            @did-navigate="didNavigate"
            @did-navigate-in-page="didNavigateInPage"
            @will-navigate="willNavigate"
            @update-target-url="updateTargetUrl"
            @new-window="newWindow"
            @page-title-updated="pageTitleUpdated"
            allowpopups
            webpreferences="nodeIntegration=no,contextIsolation=yes"
          />
        </div>
      </div>
    </template>
  </layout-vue>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { storeToRefs } from "pinia";
import LayoutVue from "@/components/layout.vue";
import LucideIcon from "@/components/LucideIcon.vue";
import useBrowser, { searchEngineList } from "@/store/useBrowser";

const browserStore = useBrowser();
const { tabs, activeTabId, activeTab } = storeToRefs(browserStore);
const { createTab, closeTab, setActiveTab, search, setDefaultEngine, updateTabUrl } = browserStore;

const currentEngine = ref(activeTab.value?.isNewTab ? browserStore.defaultEngine : "baidu");
const searchQuery = ref("");

const engineWatch = computed(() => browserStore.defaultEngine);
currentEngine.value = engineWatch.value;

const webviewRef = ref<any>(null);

const handleEngineChange = (val: string) => {
  setDefaultEngine(val);
};

function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    if (pathname && pathname !== '/') {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        return parts[parts.length - 1].replace(/\.[^/.]+$/, '') || urlObj.hostname;
      }
    }
    return urlObj.hostname;
  } catch {
    return '网页';
  }
}

function pageTitleUpdated(e: any) {
  console.error(e, 'pageTitleUpdated')
  const title = e.title;
  if (activeTab.value && title) {
    const tab = tabs.value.find(t => t.id === activeTabId.value);
    if (tab && tab.title !== title) {
      tab.title = title.slice(0, 20);
    }
  }
}
function didNavigate(e: any) {
  console.error(e, 'didNavigate')
  // 如果url存在于tabs中，则切换到该tab，否则创建一个新的tab
  const tab = tabs.value.find(t => {
    // 去掉尾部/
    let turl = t.url.replace(/\/$/, '');
    let eurl = e.url.replace(/\/$/, '');
    return turl === eurl;
  });
  if (tab) {
    setActiveTab(tab.id);
  } else {
    createTab(e.url);
  }
}
function didNavigateInPage(e: any) {
  console.error(e, 'didNavigateInPage')
  const { url, isMainFrame } = e;
  if (isMainFrame) {
    updateTabUrl(activeTabId.value, url);
  }
}

function willNavigate(e: any) {
  console.error(e, 'willNavigate')
  // const { url } = e;
  // if (url && url.startsWith('http')) {
  //   createTab(url);
  // }
}

function updateTargetUrl(e: any) {
  // console.error(e, 'updateTargetUrl')
  // const { url } = e;
  // if (url && url.startsWith('http')) {
  //   createTab(url);
  // }
}

function newWindow(e: any) {
  console.error(e, 'newWindow')
  const url = e.url;
  if (url && url.startsWith('http')) {
    const title = extractTitleFromUrl(url);
    createTab(url, title);
  } 
}

function handleSearch() {
  if (!searchQuery.value.trim()) return;
  const searchEngine = searchEngineList.find((e) => e.value === currentEngine.value);
  if (!searchEngine) return;
  const url = searchEngine.searchUrl.replace("{query}", encodeURIComponent(searchQuery.value));
  
  createTab(url, `搜索: ${searchQuery.value}`);
  searchQuery.value = "";
}

function quickSearch(keyword: string, engine: string) {
  console.error(tabs.value, 'quickSearch')
  const url = engine === "github" 
    ? "https://github.com" 
    : searchEngineList.find((e) => e.value === engine)?.searchUrl.replace("{query}", encodeURIComponent(keyword)) || "";
  
  createTab(url, engine === "github" ? "GitHub" : keyword);
}
</script>

<style scoped lang="scss">
.browser-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
}

.browser-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border-subtle);
  gap: 12px;
}

.tab-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
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
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  max-width: 160px;
  transition: all 0.2s;
  user-select: none;

  .tab-title {
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .tab-close {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    opacity: 0.6;
    transition: all 0.2s;

    &:hover {
      opacity: 1;
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
  }

  &:hover:not(.is-active) {
    background: var(--bg-hover);
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.engine-select {
  width: 110px;
}

.browser-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.new-tab-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--bg-base) 0%, var(--bg-card) 100%);
}

.search-container {
  text-align: center;
  max-width: 560px;
  padding: 20px;
}

.search-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 24px;
}

.search-box {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;

  .search-input {
    flex: 1;
  }

  .search-btn {
    flex-shrink: 0;
  }
}

.quick-links {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.quick-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;

  .link-icon {
    font-size: 24px;
  }

  .link-text {
    font-size: 13px;
    color: var(--text-secondary);
  }

  &:hover {
    background: var(--bg-hover);
    border-color: var(--color-primary);
    transform: translateY(-2px);
    box-shadow: var(--shadow-card);
  }
}

.webview-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}
</style>