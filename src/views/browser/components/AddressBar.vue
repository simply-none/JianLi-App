<template>
  <!-- 地址栏：URL/关键词智能识别 + 历史/书签下拉建议 + 安全标识 -->
  <div class="address-bar" ref="rootRef">
    <div class="address-input-wrap" :class="{ 'is-focused': focused }">
      <!-- 安全标识：https 锁形 / http 警示 / 新标签页搜索图标 -->
      <span class="address-prefix">
        <LucideIcon
          :name="prefixIcon"
          :size="14"
          :color="prefixColor"
        />
      </span>
      <input
        ref="inputRef"
        v-model="inputValue"
        class="address-input"
        :placeholder="placeholder"
        spellcheck="false"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.enter.prevent="onEnter"
        @keydown.esc.prevent="onEsc"
        @keydown.down.prevent="moveSuggestion(1)"
        @keydown.up.prevent="moveSuggestion(-1)"
        @input="onInput"
      />
      <!-- 收藏星标（仅非新标签页展示） -->
      <span
        v-if="!tab.isNewTab && tab.url"
        class="address-star"
        :class="{ 'is-marked': marked }"
        :title="marked ? '取消收藏 (Ctrl+D)' : '收藏此页 (Ctrl+D)'"
        @mousedown.prevent
        @click="onToggleBookmark"
      >
        <LucideIcon :name="marked ? 'Star' : 'BookmarkPlus'" :size="15" />
      </span>
    </div>

    <!-- 下拉建议：历史/书签匹配 + 搜索兜底项 -->
    <div v-if="focused && suggestions.length > 0" class="address-suggestions">
      <div
        v-for="(item, index) in suggestions"
        :key="item.key"
        class="suggestion-item"
        :class="{ 'is-highlight': index === highlightIndex }"
        @mouseenter="highlightIndex = index"
        @mousedown.prevent="chooseSuggestion(item)"
      >
        <span class="suggestion-icon">
          <LucideIcon :name="item.icon" :size="14" />
        </span>
        <span class="suggestion-title">{{ item.title }}</span>
        <span class="suggestion-sub" v-if="item.sub">{{ item.sub }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - 地址栏
 * 职责：
 * - 展示/编辑当前标签地址，回车时智能识别「网址 or 搜索词」并导航当前标签；
 * - 输入时从 SQLite 历史 + 本地书签中检索建议，第一项恒为「用默认引擎搜索」；
 * - 响应全局快捷键事件（browser:focus-address）聚焦并全选；
 * - 星标按钮切换当前页收藏。
 */
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import LucideIcon from "@/components/LucideIcon.vue";
import type { Tab } from "@/store/useBrowser";
import useBrowser, { buildSearchUrl } from "@/store/useBrowser";
import { navigateActiveTab } from "../composables/useWebviewBridge";
import { useBookmarks, toggleBookmark, isBookmarked } from "../composables/useBookmarks";
import { fetchHistory } from "../api/browserApi";

/** 组件入参 */
const props = defineProps<{
  /** 必填，当前激活标签（展示其地址/状态） */
  tab: Tab;
}>();

const browserStore = useBrowser();
const { bookmarks } = useBookmarks();

// ==================== 输入状态 ====================
const rootRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
/** 输入框内容 */
const inputValue = ref("");
/** 是否聚焦中 */
const focused = ref(false);
/** 下拉高亮下标（-1 表示未选中任何建议） */
const highlightIndex = ref(-1);
/** 历史建议（输入防抖查询结果） */
const historySuggestions = ref<{ key: string; title: string }[]>([]);

/** 历史查询防抖定时器 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** 是否已收藏当前页 */
const marked = computed(() => {
  if (props.tab.isNewTab || !props.tab.url) return false;
  return isBookmarked(props.tab.url);
});

/** 输入框占位文案 */
const placeholder = computed(() => (props.tab.isNewTab ? "输入网址，或搜索内容" : "搜索或输入新地址"));

/** 前缀图标（按协议与页面状态） */
const prefixIcon = computed(() => {
  if (props.tab.isNewTab || !props.tab.url) return "Search";
  if (/^https:/i.test(props.tab.url)) return "Lock";
  if (/^http:/i.test(props.tab.url)) return "TriangleAlert";
  return "Earth";
});

/** 前缀图标颜色 */
const prefixColor = computed(() => {
  if (props.tab.isNewTab || !props.tab.url) return "var(--text-muted)";
  if (/^https:/i.test(props.tab.url)) return "var(--color-success, #67c23a)";
  if (/^http:/i.test(props.tab.url)) return "var(--color-warning, #e6a23c)";
  return "var(--text-muted)";
});

/** 同步展示当前标签地址（未聚焦时跟随 tab.url 变化） */
watch(
  () => [props.tab.url, props.tab.id],
  () => {
    if (!focused.value) {
      inputValue.value = props.tab.isNewTab ? "" : props.tab.url;
    }
  },
  { immediate: true }
);

// ==================== 建议数据 ====================

/** 建议条目统一结构 */
interface Suggestion {
  /** 唯一键 */
  key: string;
  /** 展示标题 */
  title: string;
  /** 副标题（如地址、引擎名） */
  sub: string;
  /** 图标名 */
  icon: string;
  /** 选中后要导航的地址 */
  url: string;
}

/**
 * 下拉建议列表：搜索兜底 + 书签匹配 + 历史匹配（去重）
 */
const suggestions = computed<Suggestion[]>(() => {
  const kw = inputValue.value.trim();
  const list: Suggestion[] = [];

  // 1) 搜索兜底（有输入时恒展示）
  if (kw) {
    const engine = browserStore.searchEngineList.find((e) => e.value === browserStore.defaultEngine);
    list.push({
      key: "search-fallback",
      title: kw,
      sub: `使用 ${engine?.label ?? "默认引擎"} 搜索`,
      icon: "Search",
      url: buildSearchUrl(kw, browserStore.defaultEngine),
    });
  }

  // 2) 书签匹配（本地过滤）
  if (kw) {
    const lower = kw.toLowerCase();
    bookmarks.value
      .filter((b) => b.key.toLowerCase().includes(lower) || (b.title || "").toLowerCase().includes(lower))
      .slice(0, 3)
      .forEach((b) => {
        list.push({ key: `bm-${b.key}`, title: b.title || b.key, sub: b.key, icon: "Bookmark", url: b.key });
      });
  } else {
    // 无输入：展示前几个书签
    bookmarks.value.slice(0, 5).forEach((b) => {
      list.push({ key: `bm-${b.key}`, title: b.title || b.key, sub: b.key, icon: "Bookmark", url: b.key });
    });
  }

  // 3) 历史匹配（去重：已出现在书签建议中的地址跳过）
  const existUrls = new Set(list.map((s) => s.url));
  historySuggestions.value.forEach((h) => {
    if (!existUrls.has(h.key)) {
      list.push({ key: `hs-${h.key}`, title: h.title || h.key, sub: h.key, icon: "History", url: h.key });
    }
  });

  return list;
});

/**
 * 输入变化：重置高亮并防抖查询历史建议
 */
function onInput() {
  highlightIndex.value = -1;
  if (debounceTimer) clearTimeout(debounceTimer);
  const kw = inputValue.value.trim();
  debounceTimer = setTimeout(async () => {
    if (!kw) {
      historySuggestions.value = [];
      return;
    }
    const rows = await fetchHistory(6, kw);
    historySuggestions.value = rows.map((r) => ({ key: r.key, title: r.title }));
  }, 150);
}

/**
 * 键盘上下移动建议高亮（-1 表示未选中任何建议，上下均在边界处截断）
 * @param offset 必填，偏移量（+1 下移 / -1 上移）
 */
function moveSuggestion(offset: number) {
  const total = suggestions.value.length;
  if (total === 0) return;
  const next = highlightIndex.value + offset;
  highlightIndex.value = Math.min(total - 1, Math.max(-1, next));
}

// ==================== 动作 ====================

/** 聚焦：全选现有内容并展示建议 */
function onFocus() {
  focused.value = true;
  highlightIndex.value = -1;
  inputValue.value = props.tab.isNewTab ? inputValue.value : props.tab.url;
  requestAnimationFrame(() => inputRef.value?.select());
}

/** 失焦：还原展示值、清建议、收起下拉 */
function onBlur() {
  focused.value = false;
  inputValue.value = props.tab.isNewTab ? "" : props.tab.url;
  historySuggestions.value = [];
}

/**
 * 判断输入是否像网址（含协议 / localhost / IP / 域名形态）
 * @param input 必填，用户输入
 * @returns true 表示按网址处理
 */
function looksLikeUrl(input: string): boolean {
  const s = input.trim();
  if (!s || /\s/.test(s)) return false;
  if (/^(https?|file):\/\//i.test(s)) return true;
  if (/^localhost(:\d+)?([/?#].*)?$/i.test(s)) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?([/?#].*)?$/.test(s)) return true;
  return /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/i.test(s);
}

/**
 * 输入转可导航地址：补协议，否则走搜索引擎
 * @param input 必填，用户输入
 * @returns 目标地址
 */
function resolveInput(input: string): string {
  const s = input.trim();
  if (looksLikeUrl(s)) {
    return /^(https?|file):\/\//i.test(s) ? s : `https://${s}`;
  }
  return buildSearchUrl(s, browserStore.defaultEngine);
}

/** 回车：高亮建议优先，否则智能识别导航 */
function onEnter() {
  const idx = highlightIndex.value;
  if (idx >= 0 && suggestions.value[idx]) {
    chooseSuggestion(suggestions.value[idx]);
    return;
  }
  const url = resolveInput(inputValue.value);
  if (!url) return;
  navigateActiveTab(url);
  inputRef.value?.blur();
}

/** Esc：还原并失焦 */
function onEsc() {
  inputValue.value = props.tab.isNewTab ? "" : props.tab.url;
  inputRef.value?.blur();
}

/**
 * 选择建议项导航
 * @param item 必填，建议条目
 */
function chooseSuggestion(item: Suggestion) {
  navigateActiveTab(item.url);
  inputRef.value?.blur();
}

/** 切换当前页收藏 */
async function onToggleBookmark() {
  if (props.tab.isNewTab || !props.tab.url) return;
  await toggleBookmark(props.tab.url, props.tab.title);
}

// 监听全局「聚焦地址栏」事件（Ctrl+L）
function onFocusEvent() {
  inputRef.value?.focus();
}
onMounted(() => window.addEventListener(EVENT_NAME, onFocusEvent));
onUnmounted(() => window.removeEventListener(EVENT_NAME, onFocusEvent));

/** 与 useBrowserShortcuts 约定的事件名 */
const EVENT_NAME = "browser:focus-address";
</script>

<style scoped lang="scss">
.address-bar {
  position: relative;
  flex: 1;
  min-width: 0;
  max-width: 640px;
}

.address-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border-radius: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  transition: all 0.2s;

  &.is-focused {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-light);
  }

  .address-prefix {
    display: flex;
    align-items: center;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .address-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 13px;
    color: var(--text-primary);

    &::placeholder {
      color: var(--text-muted);
    }
  }

  .address-star {
    display: flex;
    align-items: center;
    cursor: pointer;
    color: var(--text-muted);
    flex-shrink: 0;
    transition: color 0.2s;

    &:hover {
      color: var(--text-primary);
    }

    &.is-marked {
      color: var(--color-warning, #e6a23c);
    }
  }
}

.address-suggestions {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 320px;
  overflow-y: auto;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  box-shadow: var(--shadow-card);
  z-index: 60;
  padding: 4px;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;

  &.is-highlight {
    background: var(--bg-hover);
  }

  .suggestion-icon {
    display: flex;
    align-items: center;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .suggestion-title {
    font-size: 13px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
    max-width: 50%;
  }

  .suggestion-sub {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }
}
</style>
