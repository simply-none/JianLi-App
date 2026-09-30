<!--
  思维导图 —— 顶部工具条（文档 / 布局 / 操作三段式）。

  三段从左到右：文档信息 → 布局方向（含「整理布局」）→ 文档与节点操作，两端对齐（space-between）。
  按钮只负责「转发意图」，确认策略与提示文案全部由 useMindActions / useMindTransfer 决定，
  保证与键盘快捷键走的是同一条路径。

  ⚠️ 容器刻意**不加** `overflow`：搜索面板是绝对定位在这个容器里的，
     一旦给容器加 `overflow-x: auto`，下拉面板就会被裁掉。
     窄窗口下宁可让按钮组略微溢出，也不要牺牲浮层。
-->
<template>
  <div class="mind-toolbar">
    <!-- ① 文档信息 -->
    <div class="mind-toolbar__doc">
      <LucideIcon name="Network" :size="18" class="mind-toolbar__logo" />
      <el-input
        v-model="docName"
        class="mind-toolbar__name"
        size="small"
        maxlength="60"
        placeholder="未命名导图"
        @change="commitName"
        @keydown.enter.prevent="commitName"
      />
      <span v-if="mind.dirty.value" class="mind-toolbar__badge" title="有未保存的改动">未保存</span>
      <span class="mind-toolbar__meta">{{ mind.nodeCount.value }} 节点</span>
    </div>

    <!-- ② 布局：方向分段按钮 + 整理布局 -->
    <div class="mind-toolbar__layout">
      <div class="mind-toolbar__segment" role="group" aria-label="布局方向">
        <button
          v-for="item in LAYOUT_OPTIONS"
          :key="item.value"
          type="button"
          class="mind-toolbar__segment-btn"
          :class="{ 'is-active': mind.layout.value === item.value }"
          @click="onLayout(item.value)"
        >
          {{ item.label }}
        </button>
      </div>
      <button
        type="button"
        class="mind-toolbar__btn"
        :title="resetPositionsTitle"
        :disabled="!mind.fixedPositionCount.value"
        @click="actions.resetPositions()"
      >
        <LucideIcon name="LayoutGrid" :size="16" />
      </button>
    </div>

    <!-- ③ 操作 -->
    <div class="mind-toolbar__actions">
      <!-- 文档 -->
      <button type="button" class="mind-toolbar__btn" title="新建导图" @click="actions.createNew()">
        <LucideIcon name="FilePlus" :size="16" />
      </button>
      <button type="button" class="mind-toolbar__btn" title="打开导图" @click="emit('open-docs')">
        <LucideIcon name="FolderOpen" :size="16" />
      </button>
      <button
        type="button"
        class="mind-toolbar__btn"
        :title="saving ? '保存中…' : '保存（Ctrl + S）'"
        :disabled="saving"
        @click="actions.save()"
      >
        <LucideIcon name="Save" :size="16" />
      </button>

      <span class="mind-toolbar__divider" />

      <!-- 撤销 / 重做 -->
      <button
        type="button"
        class="mind-toolbar__btn"
        :title="undoTitle"
        :disabled="!mind.canUndo.value"
        @click="mind.undo()"
      >
        <LucideIcon name="Undo2" :size="16" />
      </button>
      <button
        type="button"
        class="mind-toolbar__btn"
        title="重做（Ctrl + Shift + Z）"
        :disabled="!mind.canRedo.value"
        @click="mind.redo()"
      >
        <LucideIcon name="Redo2" :size="16" />
      </button>

      <span class="mind-toolbar__divider" />

      <!-- 导入 / 导出 / 联动生成 -->
      <button
        type="button"
        class="mind-toolbar__btn"
        :title="importTitle"
        @click="transfer.importFile()"
      >
        <LucideIcon name="FileUp" :size="16" />
      </button>
      <el-dropdown trigger="click" placement="bottom-end" @command="onExportCommand">
        <button type="button" class="mind-toolbar__btn" title="导出（SVG / PNG / JSON / 大纲 / XMind…）">
          <LucideIcon name="FileDown" :size="16" />
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="item in EXPORT_ITEMS" :key="item.key" :command="item.key">
              {{ item.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <button
        type="button"
        class="mind-toolbar__btn"
        title="从待办 / 笔记 / 主题对话生成导图"
        @click="emit('open-generate')"
      >
        <LucideIcon name="Database" :size="16" />
      </button>

      <span class="mind-toolbar__divider" />

      <!-- 节点 -->
      <button type="button" class="mind-toolbar__btn" title="添加子节点（Tab）" @click="mind.addChild()">
        <LucideIcon name="Plus" :size="16" />
      </button>
      <button
        type="button"
        class="mind-toolbar__btn"
        title="添加同级节点（Enter）"
        @click="mind.addSibling()"
      >
        <LucideIcon name="CornerDownRight" :size="16" />
      </button>
      <button
        type="button"
        class="mind-toolbar__btn"
        title="重命名（F2 / 双击）"
        :disabled="!hasSelection"
        @click="onRename"
      >
        <LucideIcon name="Pencil" :size="16" />
      </button>
      <button
        type="button"
        class="mind-toolbar__btn"
        title="删除节点及其子树（Delete）"
        :disabled="!hasSelection"
        @click="actions.deleteSelected()"
      >
        <LucideIcon name="Trash2" :size="16" />
      </button>
      <button
        type="button"
        class="mind-toolbar__btn"
        :title="foldAllTitle"
        :disabled="!hasCollapsible"
        @click="mind.toggleFoldAll()"
      >
        <LucideIcon name="ListChevronsDownUp" :size="16" />
      </button>
      <button
        type="button"
        class="mind-toolbar__btn"
        title="节点属性：备注 / 分支色 / 背景色 / 文字色"
        :disabled="!hasSelection"
        @click="onNodePanel"
      >
        <LucideIcon name="StickyNotePlus" :size="16" />
      </button>

      <span class="mind-toolbar__divider" />

      <!-- 搜索 / 帮助 -->
      <MindSearchBox />
      <button type="button" class="mind-toolbar__btn" title="快捷键说明" @click="emit('open-help')">
        <LucideIcon name="CircleHelp" :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import LucideIcon from '@/components/LucideIcon.vue'
import { DEFAULT_DOC_NAME, LAYOUT_OPTIONS } from '../constants'
import { useMindActions } from '../composables/useMindActions'
import { useMindDoc } from '../composables/useMindDoc'
import { EXPORT_ITEMS, useMindTransfer, type MindExportKey } from '../composables/useMindTransfer'
import { useMindView } from '../composables/useMindView'
import type { MindLayoutDir, MindNode } from '../types'
import MindSearchBox from './MindSearchBox.vue'

const emit = defineEmits<{
  (e: 'open-docs'): void
  (e: 'open-help'): void
  (e: 'open-generate'): void
}>()

const mind = useMindDoc()
const actions = useMindActions()
const transfer = useMindTransfer()
const view = useMindView()

const { saving } = actions

const importTitle = '导入（.json / .md / .opml / .mm / .xmind，都会作为新文档载入）'

/**
 * 导出菜单的分发。
 * 放在这里而不是给每个菜单项绑一个 @click：命令名与 EXPORT_ITEMS 共用同一套 key，
 * 菜单加一项只需在 useMindTransfer 的 EXPORT_ITEMS 与这张表里各加一行，不会漏绑。
 */
async function onExportCommand(command: MindExportKey) {
  const handlers: Record<MindExportKey, () => boolean | Promise<boolean>> = {
    svg: transfer.exportSvg,
    png: transfer.exportPng,
    json: transfer.exportJson,
    markdown: transfer.exportMarkdown,
    opml: transfer.exportOpml,
    freemind: transfer.exportFreeMind,
    xmind: transfer.exportXmind,
  }
  await handlers[command]()
}

const hasSelection = computed(() => Boolean(mind.selectedId.value))
const hasCollapsible = computed(() => mind.tree.value.children.length > 0)
const foldAllTitle = computed(() =>
  hasExpanded(mind.tree.value) ? '折叠全部（Ctrl + A）' : '展开全部（Ctrl + A）',
)
const undoTitle = computed(() =>
  mind.canUndo.value ? `撤销（Ctrl + Z，还可回退 ${mind.historyDepth.value} 步）` : '没有可撤销的操作',
)

/**
 * 「整理布局」的提示文案。
 * 顺带承担「有没有手动固定坐标」的可见性 —— 节点被拖过后位置不再自动排，
 * 用户需要一个明确的地方知道「有几个节点被固定了、怎么还原」。
 */
const resetPositionsTitle = computed(() => {
  const count = mind.fixedPositionCount.value
  return count
    ? `整理布局：清除 ${count} 个节点的手动位置，全部按算法重排`
    : '整理布局：当前没有手动固定位置的节点'
})

/* --------------------------------------------------------- 文档名输入 */

/**
 * 本地草稿 + 提交式写回。
 * 不直接 v-model 到 store：setName 会把空串回落成默认名，
 * 边删边写会出现「删到空就立刻弹回『未命名导图』」的输入体验灾难。
 */
const docName = ref(mind.doc.value.name)

watch(
  () => mind.doc.value.name,
  (next) => {
    if (next !== docName.value) docName.value = next
  },
)

function commitName() {
  mind.setName(docName.value || DEFAULT_DOC_NAME)
  docName.value = mind.doc.value.name
}

/* ------------------------------------------------------------ 其它动作 */

function onLayout(dir: MindLayoutDir) {
  if (mind.layout.value === dir) return
  // 换布局等于整体重排，需要重新适应画布
  view.requestFit()
  mind.setLayout(dir)
}

function onRename() {
  const id = mind.selectedId.value
  if (id) mind.beginEdit(id)
}

function onNodePanel() {
  const id = mind.selectedId.value
  if (id) view.openNodePanel(id)
}

/** 是否还有展开着的分支（决定「折叠全部」的标题与语义） */
function hasExpanded(node: MindNode): boolean {
  if (!node.collapsed && node.children.length) return true
  return node.children.some(child => hasExpanded(child))
}
</script>

<style scoped lang="scss">
.mind-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: none;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-card);
}

/* ---- ① 文档信息 ---- */
.mind-toolbar__doc {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mind-toolbar__logo {
  flex: none;
  color: var(--color-primary);
}

.mind-toolbar__name {
  width: 170px;

  :deep(.el-input__wrapper) {
    box-shadow: none;
    background: transparent;
    padding-left: 0;
    padding-right: 0;
  }

  :deep(.el-input__inner) {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  &:hover :deep(.el-input__wrapper),
  :deep(.el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 1px var(--border-subtle) inset;
  }
}

.mind-toolbar__badge {
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-warning) 18%, transparent);
  color: var(--color-warning);
  font-size: 11px;
  line-height: 1.6;
}

.mind-toolbar__meta {
  flex: none;
  color: var(--text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

/* ---- ② 布局：分段按钮 + 整理布局 ---- */
.mind-toolbar__layout {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.mind-toolbar__segment {
  display: flex;
  flex: none;
  padding: 2px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-hover);
}

.mind-toolbar__segment-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;

  &:hover {
    color: var(--text-primary);
  }

  &.is-active {
    background: var(--bg-card);
    color: var(--color-primary);
    font-weight: 600;
    box-shadow: var(--shadow-card);
  }
}

/* ---- ③ 操作 ---- */
.mind-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}

.mind-toolbar__btn {
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

  &:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.mind-toolbar__divider {
  width: 1px;
  height: 18px;
  margin: 0 5px;
  background: var(--border-subtle);
}
</style>
