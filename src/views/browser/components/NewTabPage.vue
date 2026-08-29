<template>
  <!-- 新标签页：搜索框 + 快捷网站 + 常访问站点 + 最近访问 -->
  <div class="new-tab-page">
    <div class="nt-container">
      <h1 class="nt-title">快捷搜索</h1>

      <!-- 搜索框 -->
      <div class="nt-search">
        <el-select
          :model-value="browserStore.defaultEngine"
          class="nt-engine"
          size="large"
          @update:model-value="browserStore.setDefaultEngine"
        >
          <el-option v-for="engine in browserStore.searchEngineList" :key="engine.value" :label="engine.label" :value="engine.value" />
        </el-select>
        <el-input
          v-model="query"
          class="nt-input"
          placeholder="输入关键词搜索..."
          size="large"
          @keyup.enter="onSearch"
        >
          <template #prefix>
            <LucideIcon name="Search" />
          </template>
        </el-input>
        <el-button type="primary" size="large" @click="onSearch">搜索</el-button>
      </div>

      <!-- 快捷网站 -->
      <div class="nt-section">
        <div class="nt-grid">
          <div v-for="site in quickSites" :key="site.name" class="nt-link" @click="navigateActiveTab(site.url)">
            <span class="nt-link-icon">
              <LucideIcon :name="site.icon" :size="22" />
            </span>
            <span class="nt-link-text">{{ site.name }}</span>
          </div>
        </div>
      </div>

      <!-- 常访问站点（来自浏览历史，按访问次数排序） -->
      <div v-if="topSites.length > 0" class="nt-section">
        <div class="nt-section-title">
          <LucideIcon name="History" :size="14" />
          <span>常访问</span>
        </div>
        <div class="nt-grid">
          <div v-for="site in topSites" :key="site.key" class="nt-link" :title="site.key" @click="navigateActiveTab(site.key)">
            <span class="nt-link-icon nt-link-favicon" v-if="siteHostFavicon(site.key)">
              <img :src="siteHostFavicon(site.key)" alt="" />
            </span>
            <span class="nt-link-icon" v-else>
              <LucideIcon name="Globe" :size="22" />
            </span>
            <span class="nt-link-text">{{ site.title || site.key }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - 新标签页
 * 职责：搜索框（引擎可切换）、固定快捷网站、来自 SQLite 历史的「常访问」站点。
 * 搜索/导航都作用于当前标签（新标签页就地变成网页）。
 */
import { onMounted, ref } from "vue";
import LucideIcon from "@/components/LucideIcon.vue";
import useBrowser from "@/store/useBrowser";
import { navigateActiveTab } from "../composables/useWebviewBridge";
import { fetchTopSites, type HistoryRecord } from "../api/browserApi";

const browserStore = useBrowser();

/** 搜索关键词 */
const query = ref("");

/** 常访问站点（SQLite 历史） */
const topSites = ref<HistoryRecord[]>([]);

/** 固定快捷网站（语义化图标，均已在 LucideIcon nameMap 中验证存在） */
const quickSites = [
  { name: "百度", url: "https://www.baidu.com", icon: "Search" },
  { name: "Google", url: "https://www.google.com", icon: "Earth" },
  { name: "Bing", url: "https://www.bing.com", icon: "Globe" },
  { name: "GitHub", url: "https://github.com", icon: "Code" },
  { name: "哔哩哔哩", url: "https://www.bilibili.com", icon: "SquarePlay" },
  { name: "知乎", url: "https://www.zhihu.com", icon: "MessageCircle" },
];

/** 执行搜索（就地导航当前标签） */
function onSearch() {
  const kw = query.value.trim();
  if (!kw) return;
  navigateActiveTab(browserStore.search(kw));
  query.value = "";
}

/**
 * 从地址推导站点图标地址（Google favicon 服务，失败则由模板回退 Globe 图标）
 * @param url 必填，站点地址
 * @returns 图标地址；无法解析域名返回空串
 */
function siteHostFavicon(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return "";
  }
}

onMounted(async () => {
  topSites.value = await fetchTopSites(8);
});
</script>

<style scoped lang="scss">
.new-tab-page {
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
  background: linear-gradient(135deg, var(--bg-base) 0%, var(--bg-card) 100%);
}

.nt-container {
  width: 100%;
  max-width: 640px;
  padding: 8vh 20px 40px;
  text-align: center;
}

.nt-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 24px;
}

.nt-search {
  display: flex;
  gap: 8px;
  margin-bottom: 32px;

  .nt-engine {
    width: 110px;
    flex-shrink: 0;
  }

  .nt-input {
    flex: 1;
  }
}

.nt-section {
  margin-bottom: 24px;
}

.nt-section-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.nt-grid {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.nt-link {
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
  max-width: 120px;

  .nt-link-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: var(--text-secondary);

    img {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      object-fit: contain;
    }
  }

  .nt-link-text {
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  &:hover {
    background: var(--bg-hover);
    border-color: var(--color-primary);
    transform: translateY(-2px);
    box-shadow: var(--shadow-card);
  }
}
</style>
