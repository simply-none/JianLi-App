<!--
  思维导图 —— 顶部工具条（文档 / 布局 / 操作三段式）。

  三段从左到右：文档信息 → 布局方向（含「整理布局」）→ 文档与节点操作，两端对齐（space-between）。
  按钮只负责「转发意图」，确认策略与提示文案全部由 useMindActions / useMindTransfer 决定，
  保证与键盘快捷键走的是同一条路径。

  ⚠️ 窄窗口下工具条要能**横向滚动**，但滚动**只能加在 `__scroll` 这一层**：
     它内部只有 button，没有任何绝对定位浮层。搜索下拉面板（`.mind-search__panel`）
     是绝对定位的，一旦被放进入 `overflow: auto` 的容器就会被裁掉 ——
     所以「搜索 + 帮助」被单独放在 `__tail`（滚动区之外），始终钉在右侧。
     未来再往工具条加浮层（popover / 下拉面板）时，同样放进 `__tail`，别放进 `__scroll`。
-->
<template>
  <div class="mind-toolbar" @wheel="onWheel">
    <!-- 可横向滚动的主区：文档信息 / 布局 / 操作。
         窄窗口下左右滚动即可看到全部按钮（鼠标竖向滚轮也会被转成横向滚动，见 onWheel）。
         ⚠️ 滚动只能加在**这一层**：它内部只有 button，没有任何绝对定位浮层。
         搜索下拉面板刻意放在滚动区之外（见下方 __tail），否则会被 overflow 裁掉。 -->
    <div ref="scrollRef" class="mind-toolbar__scroll">
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
        <!-- 折叠全部 / 展开全部：**互斥出现** —— 还有展开着的分支时给「折叠全部」，
             全折叠时给「展开全部」，两者不会同时出现；扁平树（例如刚新建、只有根）
             两者都没有意义，落一个禁用的占位，避免槽位忽有忽无让工具条抖动 -->
        <button
          v-if="mind.hasExpanded.value"
          type="button"
          class="mind-toolbar__btn"
          title="折叠全部（Ctrl + A）"
          @click="mind.collapseAll()"
        >
          <LucideIcon name="ListChevronsDownUp" :size="16" />
        </button>
        <button
          v-else-if="mind.hasFolded.value"
          type="button"
          class="mind-toolbar__btn"
          title="展开全部（Ctrl + A）"
          @click="mind.expandAll()"
        >
          <LucideIcon name="ListChevronsUpDown" :size="16" />
        </button>
        <button v-else type="button" class="mind-toolbar__btn" title="当前没有可折叠的分支" disabled>
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

        <!-- 视图：大纲面板 / 缩略图（都是本机视图偏好，不落文档） -->
        <button
          type="button"
          class="mind-toolbar__btn"
          :class="{ 'is-on': view.outlineOpen.value }"
          :title="view.outlineOpen.value ? '收起大纲（Ctrl + Shift + O）' : '打开大纲（Ctrl + Shift + O）'"
          @click="view.toggleOutline()"
        >
          <LucideIcon name="ListTree" :size="16" />
        </button>
        <button
          type="button"
          class="mind-toolbar__btn"
          :class="{ 'is-on': view.minimapOpen.value }"
          :title="view.minimapOpen.value ? '隐藏缩略图' : '显示缩略图'"
          @click="view.toggleMinimap()"
        >
          <LucideIcon name="Map" :size="16" />
        </button>

      </div>
    </div>

    <!-- 右侧固定尾部：搜索（含下拉面板）+ 帮助。
         ⚠️ 必须在滚动区**之外** —— 放进 __scroll 就会被 overflow 裁掉。 -->
    <div class="mind-toolbar__tail">
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
import type { MindLayoutDir } from '../types'
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

/* ------------------------------------------------- 横向滚动 / 鼠标滚轮 */

const scrollRef = ref<HTMLElement>()

/**
 * 把鼠标**竖向滚轮**转成工具条的横向滚动。
 *
 * 为什么需要它：`overflow-x: auto` 只让「横向滚动条 / 触控板横向手势 / Shift + 滚轮」生效，
 * 普通鼠标的竖向滚轮对「只有横向溢出」的容器**默认什么都不做** ——
 * 而工具条恰恰是这种容器（按钮一行排开）。
 *
 * 三条约束：
 *   ① 只在真的溢出时才接管（`scrollWidth > clientWidth`）：没溢出就一个字节都不碰，
 *      免得把本该冒泡的事件吞掉；
 *   ② 指针必须落在工具条**自身的矩形**内：搜索面板虽然挂在 `__tail` 下，
 *      但它浮在工具条**下方**（视觉上在盒外），而且面板里的结果列表自己会竖向滚动 ——
 *      不挡的话「滚结果列表」会连带把工具条横向推动；
 *   ③ 纯横向手势（触控板 `|deltaX| >= |deltaY|`）交给原生处理，不抢。
 */
function onWheel(event: WheelEvent) {
  const scroll = scrollRef.value
  if (!scroll) return
  if (scroll.scrollWidth <= scroll.clientWidth) return
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return

  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (event.clientY < box.top || event.clientY > box.bottom) return

  const max = scroll.scrollWidth - scroll.clientWidth
  const next = Math.min(max, Math.max(0, scroll.scrollLeft + wheelStep(event, scroll)))
  // 已经顶到两端：不接管，让事件继续冒泡
  if (next === scroll.scrollLeft) return

  event.preventDefault()
  scroll.scrollLeft = next
}

/** 归一化滚轮步长：真实鼠标多为像素，个别环境按「行」/「页」给 `deltaMode` */
function wheelStep(event: WheelEvent, el: HTMLElement): number {
  if (event.deltaMode === 1) return event.deltaY * 16 // DOM_DELTA_LINE
  if (event.deltaMode === 2) return event.deltaY * el.clientWidth // DOM_DELTA_PAGE
  return event.deltaY // DOM_DELTA_PIXEL
}

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
</script>

<style scoped lang="scss">
.mind-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-card);
}

/* ---- 可横向滚动的主区（文档 / 布局 / 操作） ----
   窄窗口下左右滚动即可看到全部按钮。
   ⚠️ 滚动只加在这一层：内部只有 button，没有绝对定位浮层（见文件头注释）。
   `overflow-x: auto` 会把 `overflow-y` 一并算成 `auto`，故显式钉成 hidden，
   免得 30px 的按钮行冒出竖向滚动条。 */
.mind-toolbar__scroll {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;

  /* 细横向滚动条：Windows 默认 ~15px 太高，会明显撑高工具条 */
  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background: var(--border-subtle);
  }

  &:hover::-webkit-scrollbar-thumb {
    background: var(--text-muted);
  }
}

/* ---- 右侧固定尾部（搜索 + 帮助）----
   不参与滚动：搜索下拉面板是绝对定位的，放进 `__scroll` 会被 overflow 裁掉。
   后续往工具条加浮层也放这里。 */
.mind-toolbar__tail {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}

/* ---- ① 文档信息 ---- */
.mind-toolbar__doc {
  display: flex;
  align-items: center;
  gap: 8px;
  /* 不参与压缩：宁可让 __scroll 溢出出滚动条，也不要把文档名挤成一团 */
  flex: none;
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

  /* 处于开启状态的视图开关（大纲 / 缩略图）：用主色淡底，一眼能看出当前是开的 */
  &.is-on {
    background: color-mix(in srgb, var(--color-primary) 14%, transparent);
    color: var(--color-primary);
  }
}

.mind-toolbar__divider {
  width: 1px;
  height: 18px;
  margin: 0 5px;
  background: var(--border-subtle);
}
</style>
