<!--
  思维导图 —— 节点搜索（工具条右侧的搜索按钮 + 下拉结果面板）。

  交互约定：
    · Ctrl + F 打开 / 关闭（由 useMindShortcuts 转发进来，这里只管开关状态）
    · 输入即搜（内存里的树，不需要防抖）；↑ ↓ 在结果间移动、Enter 定位、Esc 关闭
    · 点结果 = 展开祖先 → 选中 → 画布居中 → 关闭面板（顺序在 useMindSearch.pick 里）

  为什么结果面板自己做而不是用 el-popover：
    面板里要接管键盘（方向键 / 回车），用现成组件反而要跟它的焦点管理打架；
    而且这里只是「绝对定位在触发按钮下方的块」，几十行 CSS 就够。
-->
<template>
  <div ref="rootRef" class="mind-search">
    <button
      type="button"
      class="mind-search__trigger"
      :class="{ 'is-active': open }"
      title="搜索节点（Ctrl + F）"
      @click="toggle()"
    >
      <LucideIcon name="Search" :size="16" />
    </button>

    <div v-if="open" class="mind-search__panel">
      <div class="mind-search__head">
        <LucideIcon name="Search" :size="14" class="mind-search__icon" />
        <input
          ref="inputRef"
          v-model="query"
          class="mind-search__input"
          type="text"
          placeholder="搜索节点文本…"
          spellcheck="false"
          @keydown.down.prevent="moveCursor(1)"
          @keydown.up.prevent="moveCursor(-1)"
          @keydown.enter.prevent="onPick()"
          @keydown.esc.prevent="close()"
          @keydown.stop
        />
        <span class="mind-search__count">{{ hits.length }}</span>
      </div>

      <ul v-if="hits.length" class="mind-search__list">
        <li v-for="(hit, index) in hits" :key="hit.id">
          <button
            type="button"
            class="mind-search__item"
            :class="{ 'is-active': index === activeIndex }"
            @click="onPick(index)"
            @mousemove="activeIndex = index"
          >
            <span class="mind-search__line">
              <span class="mind-search__text">{{ hit.text }}</span>
              <span v-if="hit.hasNote" class="mind-search__badge">备注</span>
            </span>
            <span v-if="hit.breadcrumb" class="mind-search__crumb">{{ hit.breadcrumb }}</span>
          </button>
        </li>
      </ul>

      <div v-else class="mind-search__empty">
        {{
          query.trim()
            ? '没有匹配的节点'
            : '输入关键词开始搜索（被折叠起来的节点也会被搜到）'
        }}
      </div>

      <div class="mind-search__hint">↑ ↓ 选择 · Enter 定位 · Esc 关闭</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'

import LucideIcon from '@/components/LucideIcon.vue'
import { useMindSearch } from '../composables/useMindSearch'

// 解构出来的都是顶层 ref，模板里会自动解包（不能用 search.open.value 那样写，可读性很差）
const { open, query, hits, activeIndex, toggle, close, moveCursor, pick } = useMindSearch()

const rootRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()

/** 点击面板外部时关闭 */
function onDocPointerDown(event: PointerEvent) {
  if (rootRef.value?.contains(event.target as Node)) return
  close()
}

watch(open, (value) => {
  if (value) {
    // 捕获阶段监听：面板里的 pointerdown 先经过这里，但 contains 会拦住误关
    document.addEventListener('pointerdown', onDocPointerDown, true)
    nextTick(() => inputRef.value?.focus())
    return
  }
  document.removeEventListener('pointerdown', onDocPointerDown, true)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
})

function onPick(index?: number) {
  pick(index)
}
</script>

<style scoped lang="scss">
.mind-search {
  position: relative;
  flex: none;
}

.mind-search__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;

  &:hover,
  &.is-active {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.mind-search__panel {
  position: absolute;
  top: 36px;
  right: 0;
  z-index: 20;
  width: 320px;
  padding: 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.mind-search__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.mind-search__icon {
  flex: none;
  color: var(--text-muted);
}

.mind-search__input {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;

  &::placeholder {
    color: var(--text-muted);
  }
}

.mind-search__count {
  flex: none;
  color: var(--text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.mind-search__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 6px 0 0;
  padding: 0;
  max-height: 320px;
  overflow: auto;
  list-style: none;
}

.mind-search__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;

  &.is-active {
    background: var(--bg-hover);
  }
}

.mind-search__line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.mind-search__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.mind-search__badge {
  flex: none;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-warning) 20%, transparent);
  color: var(--color-warning);
  font-size: 11px;
  line-height: 1.6;
}

.mind-search__crumb {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  font-size: 11px;
}

.mind-search__empty {
  padding: 18px 8px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.7;
  text-align: center;
}

.mind-search__hint {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 11px;
  text-align: center;
}
</style>
