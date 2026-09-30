<!--
  思维导图 —— 节点右键菜单（操作浮层）。

  为什么菜单**不画在节点里**，而是独立组件 + `Teleport to="body"`：
    1. 节点是 vue-flow 的自定义节点，挂在 `.vue-flow__viewport` 里，而 viewport 带
       `transform: translate(...) scale(...)` —— 菜单若长在节点内部，会跟着画布一起
       缩放、平移、被 `overflow: hidden` 裁掉（缩到 0.5 倍时菜单字都看不清）。
    2. teleport 到 body 后菜单是纯视口坐标系（`position: fixed`），
       与画布缩放彻底解耦；这也正是「节点属性」弹窗被 teleport 的同一条理由。
    3. 一份菜单而不是「每个节点各渲染一份」：节点数是任意的，隐藏的菜单 DOM 会白占内存，
       而且「同时只能开一个」这条约束在单例里天然成立。

  打开状态存在 `useMindView` 的单例里（`menuNodeId / menuX / menuY`），
  与 `nodePanelId` 同一个模式：触发点在节点组件里，消费点在页面层，
  走 props 得从画布再穿一层。

  ⚠️ 坐标是**视口坐标**（`clientX / clientY`），不是画布坐标 —— 见 useMindView.openNodeMenu。
  ⚠️ 越界时**翻转**到节点的另一侧，以**节点矩形**为基准展开，而不是夹进视口 —— 详见 `place()`。
-->
<template>
  <Teleport to="body">
    <!--
      ⚠️ 刻意**没有**全屏遮罩：遮罩会把「菜单开着时的第二次右键」拦在自己身上，
         而收到右键后又立刻把自己 v-if 掉 —— 事件派发到一半目标被移除，
         Chromium 会重新命中测试、给节点补发一个 **clientX/Y = 0** 的 contextmenu，
         于是菜单被钉到窗口左上角（实测过的真 bug，见文件底部「点击外部关闭」）。
         改成 window 上的捕获阶段 pointerdown 判「点在面板外」，不产生任何 DOM 变更。
    -->
    <div
      v-if="node"
      ref="panelRef"
      class="mind-menu__panel mind-palette-scope"
      :style="panelStyle"
      @contextmenu.prevent.stop
    >
      <!-- 结构操作 -->
      <button
        v-for="item in structItems"
        :key="item.key"
        type="button"
        class="mind-menu__item"
        :disabled="item.disabled"
        @click="run(item)"
      >
        <LucideIcon :name="item.icon" :size="14" class="mind-menu__icon" />
        <span class="mind-menu__label">{{ item.label }}</span>
        <span v-if="item.shortcut" class="mind-menu__shortcut">{{ item.shortcut }}</span>
      </button>

      <div class="mind-menu__sep" />

      <!--
        颜色：三行内联色板，**点选后不关菜单** ——
        设完背景往往还想调文字色，每点一次都关掉会很难用。
      -->
      <div class="mind-menu__colors">
        <MindColorRow
          label="分支色"
          variant="branch"
          none-label="默认"
          :model-value="node.color"
          @pick="onPickBranch"
        />
        <MindColorRow
          label="背景色"
          variant="bg"
          none-label="无"
          :model-value="node.bgColor"
          @pick="onPickBg"
        />
        <MindColorRow
          label="文字色"
          variant="text"
          none-label="默认"
          :model-value="node.textColor"
          @pick="onPickText"
        />
      </div>

      <div class="mind-menu__sep" />

      <!-- 删除：单独一段，视觉上离开常用区 -->
      <button
        type="button"
        class="mind-menu__item mind-menu__item--danger"
        :disabled="isRoot"
        @click="run(deleteItem)"
      >
        <LucideIcon name="Trash2" :size="14" class="mind-menu__icon" />
        <span class="mind-menu__label">删除节点</span>
        <span class="mind-menu__shortcut">Delete</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type CSSProperties } from 'vue'

import LucideIcon from '@/components/LucideIcon.vue'
import { useMindActions } from '../composables/useMindActions'
import { useMindDoc } from '../composables/useMindDoc'
import { useMindView } from '../composables/useMindView'
import type { MindColorKey } from '../types'
import { placePopup } from '../utils/popup'
import { findNode } from '../utils/tree'
import MindColorRow from './MindColorRow.vue'

/** 一条普通菜单项（颜色行是组件、不走这张表） */
interface MenuItem {
  key: string
  label: string
  /** 图标名（必须已登记在 LucideIcon 的 nameMap 里，否则会静默回落成 CloudAlert） */
  icon: string
  /** 右侧快捷键提示（与 constants.SHORTCUT_HINTS 的文案保持一致） */
  shortcut?: string
  disabled?: boolean
  /**
   * ⚠️ id 是**入参**而不是在闭包里读 `view.menuNodeId`：
   *    因为 `run()` 会先把菜单关掉（清空 menuNodeId）再执行动作，
   *    闭包里读到的会是空串 —— 那会让「新增子节点 / 复制 / 重命名」全部静默失效。
   */
  run: (id: string) => void
}

const mind = useMindDoc()
const view = useMindView()
const actions = useMindActions()

/** 当前被右键的节点；节点已被删掉时自动收菜单 */
const node = computed(() => {
  const id = view.menuNodeId.value
  if (!id) return undefined
  return findNode(mind.tree.value, id)
})

const isRoot = computed(() => Boolean(node.value) && node.value?.id === mind.tree.value.id)
const hasChildren = computed(() => Boolean(node.value?.children.length))
const collapsed = computed(() => node.value?.collapsed === true)

/* ------------------------------------------------------------ 菜单项 */

const structItems = computed<MenuItem[]>(() => [
  {
    key: 'child',
    label: '新增子节点',
    icon: 'Plus',
    shortcut: 'Tab',
    run: id => mind.addChild(id),
  },
  {
    key: 'sibling',
    label: '新增同级节点',
    icon: 'CornerDownRight',
    shortcut: 'Enter',
    // 根节点没有同级（addSibling 对根会退化成加子节点，两种语义混在一个按钮里更让人困惑）
    disabled: isRoot.value,
    run: id => mind.addSibling(id),
  },
  {
    key: 'duplicate',
    label: '复制节点',
    icon: 'Copy',
    run: id => {
      mind.duplicateById(id)
    },
  },
  {
    key: 'rename',
    label: '重命名',
    icon: 'Pencil',
    shortcut: 'F2',
    run: id => mind.beginEdit(id),
  },
  {
    key: 'fold',
    label: collapsed.value ? '展开子节点' : '折叠子节点',
    icon: collapsed.value ? 'ListChevronsUpDown' : 'ListChevronsDownUp',
    shortcut: 'Space',
    disabled: !hasChildren.value,
    run: id => {
      mind.toggleFold(id)
    },
  },
  {
    key: 'note',
    label: '备注与属性…',
    icon: 'StickyNotePlus',
    run: id => view.openNodePanel(id),
  },
])

const deleteItem = computed<MenuItem>(() => ({
  key: 'delete',
  label: '删除节点',
  icon: 'Trash2',
  shortcut: 'Delete',
  // 根节点不可删；不给禁用态的话点了弹「根节点不可删除」的提示，不如直接置灰
  disabled: isRoot.value,
  // 复用 useMindActions 的策略：带子节点时弹确认、叶子节点直接删。
  // 它读的是 selectedId —— 右键时已经 select 过了，所以这里不需要 id（也不该再传）。
  // 与工具条按钮、Delete 快捷键走的是同一条路径，不会出现行为漂移。
  run: () => void actions.deleteSelected(),
}))

/**
 * 执行一条菜单项：**先取出 id，再收菜单，最后执行**。
 *
 * 顺序不能反：
 *   · 先取 id —— `view.closeNodeMenu()` 会把 menuNodeId 清空，晚一步就读不到了；
 *   · 先收菜单 —— 删除 / 重命名会让节点重排甚至消失，菜单还浮在上面会挡住
 *     「刚变化的那片区域」，看起来像卡住了。
 */
function run(item: MenuItem) {
  if (item.disabled) return
  const id = view.menuNodeId.value
  view.closeNodeMenu()
  if (id) item.run(id)
}

/* -------------------------------------------------------------- 颜色 */

/*
  颜色点选**不关菜单**（设完背景往往还想调文字色），所以这里直接读 menuNodeId 是安全的
  —— 与 `run()` 不同，这条路径上没有人会把 id 提前清掉。
*/
function onPickBranch(key?: MindColorKey) {
  const id = view.menuNodeId.value
  if (id) mind.setNodeColor(id, key)
}

function onPickBg(key?: MindColorKey) {
  const id = view.menuNodeId.value
  if (id) mind.setNodeBg(id, key)
}

function onPickText(key?: MindColorKey) {
  const id = view.menuNodeId.value
  if (id) mind.setNodeTextColor(id, key)
}

/* -------------------------------------------------------- 定位与关闭 */

const panelRef = ref<HTMLElement>()
const pos = ref({ x: 0, y: 0 })

/**
 * 定位完成前先**藏起来**。
 *
 * 菜单高 ~400px，翻转时整体要挪几百像素：若先按光标渲染一帧再挪，
 * 用户会看到它「在光标处闪一下、再跳到节点上方」。
 * 用 `visibility: hidden` 而不是 `display: none` —— 后者会把
 * `offsetWidth / offsetHeight` 量成 0，定位就全废了。
 */
const placed = ref(false)

/** 并发保护：快速换节点右键时，只让**最后一次** `place()` 写坐标 */
let placeSeq = 0

const panelStyle = computed<CSSProperties>(() => ({
  left: `${pos.value.x}px`,
  top: `${pos.value.y}px`,
  visibility: placed.value ? 'visible' : 'hidden',
}))

/**
 * 把菜单摆到光标处，放不下就翻到**节点**的另一侧（几何见 `utils/popup.ts`）。
 *
 * 这里只做三件组件该做的事：
 *   1. **渲染之后**量真实尺寸（高矮取决于节点有没有子节点、是不是根节点，估不准）；
 *   2. 把「光标 / 节点矩形 / 尺寸 / 视口」交给 `placePopup()` 算落点；
 *   3. 校对实测落点（见下方 `nextTick` 那段注释）。
 *
 * ⚠️ 翻转的基准是**节点矩形**而不是光标：光标只是落在节点里的某个随机角落，
 *    用它当基准，同一个节点在左上角右键与在右下角右键会差出大半个菜单的高度，
 *    表现就是「菜单一会儿贴着节点、一会儿飞到屏幕另一头」。
 * ⚠️ 更不能「直接夹进视口」：菜单高 ~400px，按 `innerHeight - height` 夹 y，
 *    窗口下半部分右键时菜单会被整体拽到光标上方几百像素处，离节点极远。
 */
async function place() {
  const seq = ++placeSeq
  const cursorX = view.menuX.value
  const cursorY = view.menuY.value
  const anchor = view.menuAnchor.value

  // 先落到光标上：否则第一帧会从视口左上角闪一下（此帧被 placed 藏住，看不见）
  placed.value = false
  pos.value = { x: cursorX, y: cursorY }

  await nextTick()
  const el = panelRef.value
  if (!el || seq !== placeSeq) return

  const width = el.offsetWidth
  const height = el.offsetHeight
  const next = placePopup({
    cursorX,
    cursorY,
    width,
    height,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    anchor,
  })
  pos.value = { x: next.x, y: next.y }

  /*
    自检兜底：比对「期望落点」与「实测落点」。

    正常情况下两者完全相等（菜单挂在 body 下、`position: fixed` 以视口为基准），
    这段不会触发。但 fixed 的基准会被祖先的 `transform` / `filter` / 系统缩放改掉
    （Electron 下偶发），一旦发生，实测矩形就会偏 —— 此刻按实测差值把自己拉回光标：
    除以实测缩放比是为了「有缩放时也能一次拉准」，而不是试一次差一次。

    ⚠️⚠️ **必须等这一帧真正渲染完再量**（上面那次 `await nextTick()`）。
        刚给 `pos.value` 赋了新值，而 Vue 的 DOM 更新排在下一次微任务里 ——
        若紧接着读 `getBoundingClientRect()`，量到的是**上一帧**的位置：
        `dx`/`dy` 会正好等于这次翻转的位移，于是「再翻一次」（实测：右下角右键
        ⇒ 菜单被推到光标外侧**两个菜单宽 / 高**处 —— 正是「偏移太远 / 直接到顶部」）。
        这段静态看每步都「正确」，只有量过才知道 —— 别再把它搬回同步路径上。
  */
  await nextTick()
  if (seq !== placeSeq) return
  const rect = el.getBoundingClientRect()
  const dx = rect.left - next.x
  const dy = rect.top - next.y
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
    const scaleX = width ? rect.width / width : 1
    const scaleY = height ? rect.height / height : 1
    pos.value = { x: next.x - dx / scaleX, y: next.y - dy / scaleY }
  }
  placed.value = true
}

/**
 * 打开 / 换位置时重新定位。
 * 键里带上坐标而不是只监听 id：**同一个节点再右键一次**（比如往上挪一点）
 * 时 id 没变，只监听 id 会让菜单停在旧位置。
 */
watch(
  () => `${view.menuNodeId.value}@${view.menuX.value},${view.menuY.value}`,
  () => {
    if (view.menuNodeId.value) void place()
  },
)

/** 节点被删（撤销 / 同步）时自动收菜单，避免浮层指向一个不存在的节点 */
watch(node, value => {
  if (!value) view.closeNodeMenu()
})

function close() {
  view.closeNodeMenu()
}

/**
 * 点在面板外就收菜单（左键 / 右键都算）。
 *
 * ⚠️ 这是全屏遮罩的替代品，而且**必须**用它 —— 遮罩方案有个实测过的真 bug：
 *    菜单开着时再右键另一个节点，`contextmenu` 会先落到遮罩上，遮罩的处理是
 *    立刻把自己 v-if 掉 —— **事件派发到一半目标元素被移除**，Chromium 会重新
 *    命中测试、给底下的节点补发一个 `clientX/Y = 0` 的 contextmenu，
 *    节点拿着 0,0 去开菜单 ⇒ 菜单被 clamp 钉在窗口左上角（「偏移太远」的元凶）。
 *    捕获阶段的 `pointerdown` 不改动任何 DOM：菜单先关、随后的 contextmenu
 *    正常落到节点上、带着真实光标坐标重新打开 —— 这也让「开着菜单换一个节点
 *    右键」一步到位，与系统右键菜单的行为一致。
 */
function onOutsidePointerDown(event: PointerEvent) {
  if (!view.menuNodeId.value) return
  const el = panelRef.value
  if (el && event.target instanceof Node && el.contains(event.target)) return
  view.closeNodeMenu()
}

/** 在面板外滚动（平移画布）就收菜单，与旧遮罩的 `@wheel` 行为一致 */
function onWindowWheel(event: WheelEvent) {
  if (!view.menuNodeId.value) return
  const el = panelRef.value
  if (el && event.target instanceof Node && el.contains(event.target)) return
  view.closeNodeMenu()
}

/** Esc 关闭：用捕获阶段抢在其它按键处理之前，且不让这次 Esc 继续传播 */
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !view.menuNodeId.value) return
  event.preventDefault()
  event.stopPropagation()
  close()
}

/** 窗口尺寸变化会让夹好的坐标失效，直接收掉最省事（重开一次即可） */
function onWindowChange() {
  if (view.menuNodeId.value) close()
}

onMounted(() => {
  window.addEventListener('pointerdown', onOutsidePointerDown, true)
  window.addEventListener('wheel', onWindowWheel, true)
  window.addEventListener('keydown', onKeydown, true)
  window.addEventListener('resize', onWindowChange)
  window.addEventListener('blur', onWindowChange)
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', onOutsidePointerDown, true)
  window.removeEventListener('wheel', onWindowWheel, true)
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('resize', onWindowChange)
  window.removeEventListener('blur', onWindowChange)
  // 路由切走时若菜单还开着，单例里的 id 会留着；下次回到本页会「凭空弹出一个菜单」。
  // 卸载时顺手清掉，让跨页面的状态保持干净。
  view.closeNodeMenu()
})
</script>

<style scoped lang="scss">
@use '../styles/palette.scss';

.mind-menu__panel {
  position: fixed;
  /* 没有遮罩了，层级要自己扛：压过 el-dialog（~2000）等浮层 */
  z-index: 3000;
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: 244px;
  /* 视口太矮时自己滚，而不是把底部的「删除」推出屏幕 */
  max-height: calc(100vh - 12px);
  overflow-y: auto;
  padding: 5px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.mind-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;

  &:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &--danger {
    color: var(--color-error, #f56c6c);
  }
}

.mind-menu__icon {
  flex: none;
  color: var(--text-muted);
}

.mind-menu__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mind-menu__shortcut {
  flex: none;
  padding: 1px 5px;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
}

.mind-menu__sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--border-subtle);
}

/*
  颜色区：三行色板在 244px 宽度里排得下 —— `.mind-color-row__swatches` 是
  flex-wrap 的，色块换行时菜单会自然变高（`place()` 每次都重新量尺寸并夹边界）。

  但「排得下」不是自动的：色板行默认的 26px 色块 + 8px 间距一行要 ~258px，
  远超菜单可用宽度（会折成两行、菜单变很高）。所以这里用**可继承的尺寸变量**
  把它压到 21px / 5px（一行 ~207px）。变量带 fallback 写在 `MindColorRow` 里，
  本组件只在祖先上赋值 —— 比 `:deep()` 改四条规则更稳，也不给共用组件加 API。
*/
.mind-menu__colors {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 6px 8px 8px;
  --mind-swatch-size: 21px;
  --mind-swatch-gap: 5px;
}
</style>
