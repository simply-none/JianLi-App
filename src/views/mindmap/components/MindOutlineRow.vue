<!--
  思维导图 —— 大纲的**一行**（原子组件）。

  一行只表达一件事：`level` 深度的节点名称 + 折叠箭头 + 备注/图标/色点标记。

  交互全部复用既有写路径（**零新写路径**，这就是「写路径只有一份」的红利）：
    · 单击   → `select` + `requestFocus`（画布同步居中）
    · 双击   → 行内 `<input>` 改名，提交走 `renameNode`
    · 折叠箭头 → `toggleFold`（与画布上的折叠钮**同一个字段、同一份状态**）
    · 右键   → 复用节点右键菜单，锚点传**本行矩形** ——
               `utils/popup.ts` 的 `placePopup` 是纯几何，对非节点锚点同样成立
               （这正是当初把它抽出来的收益：换成行锚点一行代码都不用改）。

  ⚠️ 面板在画布**外**，所以不需要 `nodrag` / `nowheel`（那是 vue-flow 节点内部的约定）。
-->
<template>
  <div
    class="mind-outline__row"
    :class="{ 'is-selected': isSelected, 'is-primary': isPrimary }"
    :style="{ paddingLeft: `${8 + level * 14}px` }"
    @click="onClick"
    @dblclick.stop="onDblClick"
    @contextmenu="onContextMenu"
  >
    <!-- 折叠箭头：无子节点时用同宽占位，保证同级行的文字左缘对齐 -->
    <button
      v-if="hasChildren"
      type="button"
      class="mind-outline__caret"
      :title="collapsed ? '展开子节点' : '折叠子节点'"
      @click.stop="onFold"
    >
      <LucideIcon :name="collapsed ? 'ChevronRight' : 'ChevronDown'" :size="12" />
    </button>
    <span v-else class="mind-outline__caret mind-outline__caret--empty" />

    <span v-if="icon" class="mind-outline__icon">{{ icon }}</span>
    <span v-if="branch" class="mind-outline__dot" :style="{ background: branchVar(branch) }" />

    <input
      v-if="editing"
      ref="inputRef"
      v-model="draft"
      class="mind-outline__input"
      type="text"
      @keydown.stop="onKeydown"
      @blur="commit"
      @click.stop
      @dblclick.stop
    />
    <span v-else class="mind-outline__text" :title="text">{{ text }}</span>

    <LucideIcon v-if="hasNote" name="StickyNotePlus" :size="11" class="mind-outline__note" />
    <LucideIcon v-if="hasLink" name="ExternalLink" :size="11" class="mind-outline__note" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import LucideIcon from '@/components/LucideIcon.vue'
import { branchVar } from '../constants'
import { useMindDoc } from '../composables/useMindDoc'
import { useMindView } from '../composables/useMindView'
import type { MindBranchColor, MindMenuAnchor } from '../types'

const props = defineProps<{
  id: string
  text: string
  /** 可见树深度（根 = 0），缩进即由它决定 */
  level: number
  hasChildren: boolean
  collapsed: boolean
  icon?: string
  hasNote: boolean
  hasLink: boolean
  /** 继承到的分支色 key（用于行首色点） */
  branch?: MindBranchColor
}>()

const mind = useMindDoc()
const view = useMindView()

const isSelected = computed(() => mind.selectedIds.value.has(props.id))
const isPrimary = computed(
  () => isSelected.value && mind.selectedIds.value.size > 1 && mind.selectedId.value === props.id,
)
const editing = computed(() => view.outlineEditingId.value === props.id)

const inputRef = ref<HTMLInputElement>()
const draft = ref(props.text)

// 进入编辑时把草稿灌成当前文本并聚焦（等 DOM 出来后再 focus / 全选）
watch(editing, async (value) => {
  if (!value) return
  draft.value = props.text
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
})

/** 单击：选中 + 请求画布居中（画布与大纲双向定位的另一半在 MindCanvas 的选中 watch 里） */
function onClick() {
  mind.select(props.id)
  view.requestFocus(props.id)
}

function onDblClick() {
  view.beginOutlineEdit(props.id)
}

function onFold() {
  // 与画布折叠钮完全同一条路径：同一个字段、同一份撤销粒度
  mind.toggleFold(props.id)
}

/** 提交改名（空串由 `renameNode` → `sanitizeText` 回落成原文本，不会变成空节点） */
function commit() {
  if (!editing.value) return
  mind.renameNode(props.id, draft.value)
  view.endOutlineEdit()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commit()
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    // 取消：直接放弃草稿（不改树），与画布内联编辑器的 Esc 行为一致
    view.endOutlineEdit()
  }
}

/**
 * 右键：复用节点右键菜单，锚点用**本行的视口矩形**。
 *
 * 顺序与 `MindNode.vue` 完全一致，不能反：
 *   先 `select`（菜单里的删除 / 重命名读的是 `selectedId`）→ 再开菜单。
 * 菜单是 teleport 到 body 的浮层，会自然压在右侧画布之上。
 */
function onContextMenu(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  mind.select(props.id)
  const rect = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect()
  const anchor: MindMenuAnchor | undefined = rect
    ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    : undefined
  const x = event.clientX || (rect ? rect.right + 4 : 24)
  const y = event.clientY || (rect ? rect.top + 12 : 24)
  view.openNodeMenu(props.id, x, y, anchor)
}
</script>

<style scoped lang="scss">
.mind-outline__row {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding-right: 8px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  &.is-selected {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    color: var(--color-primary);
  }

  /* 主选中（多选里最后点的那个）加深一档，与画布上的区分方式保持一致 */
  &.is-primary {
    background: color-mix(in srgb, var(--color-primary) 20%, transparent);
  }
}

.mind-outline__caret {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;

  &:hover {
    background: var(--bg-active-btn, var(--bg-hover));
    color: var(--text-primary);
  }

  &--empty {
    cursor: default;
  }
}

.mind-outline__icon {
  flex: none;
  font-size: 13px;
  line-height: 1;
}

.mind-outline__dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.mind-outline__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.mind-outline__input {
  flex: 1;
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--color-primary);
  border-radius: 5px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.mind-outline__note {
  flex: none;
  color: var(--text-muted);
}
</style>
