<!--
  思维导图 —— 左侧大纲面板（树的**第二种渲染**）。

  设计立场（这是本面板最重要的性质）：
    大纲与画布**共用 `useMindDoc` 单例**，不引入任何新数据源、不写一条只属于自己的状态
    （除了 `outlineOpen` 与行内编辑的 `outlineEditingId`，两者都在 `useMindView` 里、
    都是视图状态、都不落库）。
    ⇒ 于是「在大纲里折叠」「在画布上折叠」是同一个字段的两次写入，
      「大纲里改名」与「画布里改名」走同一个 `renameNode`，
      删除 / 颜色 / 备注也全部复用右键菜单 —— **零新写路径**。

  可见性语义天然一致：行列表直接由 `flattenVisible()` 拍平，
  与画布 `buildElements()` 用的是同一个函数 ⇒ 大纲里看不到的行，画布上也一定看不到。

  为什么「拍平 + v-for」而不是递归行组件：
    · 拍平后每行只知道自己（缩进读 `level`），组件不再需要关心父子关系；
    · 折叠裁剪、可见性语义全部由 `flattenVisible` 一处决定，不会两处实现漂移。
    （递归写法要自己再实现一遍「折叠就跳过子树」，那正是最容易与画布不一致的地方。）

  本波**明确不做**：拖拽排序 / 换父（P7 已用「拖到目标节点上松手」解决）、
  虚拟滚动（数百节点量级用不上）、多选（框选留给画布）。
-->
<template>
  <aside class="mind-outline">
    <header class="mind-outline__head">
      <LucideIcon name="ListTree" :size="14" class="mind-outline__head-icon" />
      <span class="mind-outline__title">大纲</span>
      <span class="mind-outline__count">{{ rows.length }}</span>
      <button type="button" class="mind-outline__close" title="收起大纲（Ctrl + Shift + O）" @click="view.toggleOutline()">
        <LucideIcon name="X" :size="13" />
      </button>
    </header>

    <!-- 点空白处结束行内编辑（与菜单「点外即关」同一思路：不产生 DOM 变更） -->
    <div class="mind-outline__body" @click="view.endOutlineEdit()">
      <MindOutlineRow
        v-for="row in rows"
        :key="row.id"
        :id="row.id"
        :text="row.text"
        :level="row.level"
        :has-children="row.hasChildren"
        :collapsed="row.collapsed"
        :icon="row.icon"
        :has-note="row.hasNote"
        :has-link="row.hasLink"
        :branch="row.branch"
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import LucideIcon from '@/components/LucideIcon.vue'
import { useMindDoc } from '../composables/useMindDoc'
import { useMindView } from '../composables/useMindView'
import type { MindBranchColor, MindNode } from '../types'
import { flattenVisible } from '../utils/tree'
import MindOutlineRow from './MindOutlineRow.vue'

const mind = useMindDoc()
const view = useMindView()

/**
 * 分支色继承（与 `useMindGraph.collectBranches` 同一套规则）。
 *
 * ⚠️ 这里刻意**再实现一遍**而不是从 `useMindGraph` 导出：那个函数的宿主是
 *    「画布同步」这个职责，从里面导出会让大纲对画布产生依赖；
 *    规则本身只有五行，两处都写明反而更安全（真要改颜色继承语义，两处都要动，
 *    这比「偷偷只改一处、大纲与画布颜色不一致」要好）。
 */
function collectBranches(root: MindNode): Record<string, MindBranchColor | undefined> {
  const result: Record<string, MindBranchColor | undefined> = {}
  const walk = (node: MindNode, inherited?: MindBranchColor) => {
    const color = node.color ?? inherited
    result[node.id] = color
    if (node.collapsed) return
    node.children.forEach(child => walk(child, color))
  }
  walk(root)
  return result
}

/** 拍平成行列表（顺序 = 画布渲染顺序；折叠的子树被自动裁剪） */
const rows = computed(() => {
  const tree = mind.tree.value
  const branches = collectBranches(tree)
  return flattenVisible(tree).map(item => ({
    id: item.node.id,
    text: item.node.text,
    level: item.level,
    hasChildren: item.node.children.length > 0,
    collapsed: item.node.collapsed === true,
    icon: item.node.icon,
    hasNote: Boolean(item.node.note),
    hasLink: Boolean(item.node.link),
    branch: branches[item.node.id],
  }))
})
</script>

<style scoped lang="scss">
.mind-outline {
  display: flex;
  flex-direction: column;
  flex: none;
  width: 260px;
  min-height: 0;
  border-right: 1px solid var(--border-subtle);
  background: var(--bg-card);
}

.mind-outline__head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  height: 34px;
  padding: 0 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.mind-outline__head-icon {
  color: var(--color-primary);
}

.mind-outline__title {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.mind-outline__count {
  flex: 1;
  color: var(--text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.mind-outline__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.mind-outline__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 4px;
}
</style>
