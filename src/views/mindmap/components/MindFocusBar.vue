<!--
  思维导图 —— 分支聚焦浮条（画布顶部居中的小胶囊）。

  只在「分支聚焦」生效时出现：显示当前被当作根渲染的那个节点的文本 + 「返回全图」按钮。

  为什么是个独立组件而不是画在 MindCanvas 里：
    · 它读的是 `useMindView.focusRootId` + 树，两处状态，逻辑虽短但够独立；
    · 画布组件已经背了「唯一持有 VueFlow」这件事，能外移的都外移。

  定位：**绝对定位在 `.mind-canvas` 内部**即可，不需要 teleport ——
  与 `MindZoomBar` 同一个层级。父容器有 `overflow: hidden`，但浮条在容器内部、
  也不会超出容器边界，所以不会被裁（会溢出的是「贴着画布边缘的菜单」，那个才必须 teleport）。
-->
<template>
  <div v-if="node" class="mind-focusbar">
    <LucideIcon name="Crosshair" :size="13" class="mind-focusbar__icon" />
    <span class="mind-focusbar__label" :title="node.text">聚焦：{{ node.text }}</span>
    <button type="button" class="mind-focusbar__btn" title="返回全图（Esc 也可退出）" @click="exit">
      返回全图
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import LucideIcon from '@/components/LucideIcon.vue'
import { useMindDoc } from '../composables/useMindDoc'
import { useMindView } from '../composables/useMindView'
import { findNode } from '../utils/tree'

const mind = useMindDoc()
const view = useMindView()

/**
 * 聚焦根节点。取不到时（被删除 / 撤销掉的悬空 id）整条浮条不渲染 ——
 * 这与 `useMindGraph.buildElements` 的「取不到就回落全图」是同一套容错：
 * 状态里残留一个失效 id，界面上不该跟着残留一个指向不存在节点的浮条。
 */
const node = computed(() => {
  const id = view.focusRootId.value
  if (!id) return undefined
  return findNode(mind.tree.value, id)
})

function exit() {
  view.exitFocus()
}
</script>

<style scoped lang="scss">
.mind-focusbar {
  position: absolute;
  top: 12px;
  left: 50%;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(520px, calc(100% - 32px));
  padding: 4px 6px 4px 10px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
  border-radius: 999px;
  background: var(--mm-focusbar-bg, var(--bg-card));
  box-shadow: var(--shadow-card);
  transform: translateX(-50%);
}

.mind-focusbar__icon {
  flex: none;
  color: var(--color-primary);
}

.mind-focusbar__label {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.mind-focusbar__btn {
  flex: none;
  padding: 3px 10px;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 16%, transparent);
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--color-primary) 28%, transparent);
  }
}
</style>
