<!--
  思维导图 —— 页面装配层。

  只做三件事：拼装（工具条 / 画布 / 两个弹窗）、持有弹窗开关、挂载快捷键。
  任何业务逻辑都不放在这里 —— 状态在 useMindDoc，动作在 useMindActions。
-->
<template>
  <div class="mindmap-page">
    <MindToolbar
      @open-docs="showDocs = true"
      @open-help="showHelp = true"
      @open-generate="showGenerate = true"
    />

    <MindCanvas ref="canvasRef" class="mindmap-page__canvas" />

    <MindDocDialog v-model="showDocs" />
    <!-- 节点属性弹窗自己按单例里的 nodePanelId 决定开关，不需要父级传 v-model -->
    <MindNodeDialog />
    <MindGenerateDialog v-model="showGenerate" />
    <MindHelpDialog v-model="showHelp" />
  </div>
</template>

<script setup lang="ts">
/**
 * 思维导图
 *
 * 结构：树（唯一真源，落库）→ 布局算法（现算坐标，不落库）→ vue-flow（只负责渲染）。
 * 一层不越界：布局算法不认识 vue-flow，vue-flow 不认识数据库，
 * 所以将来换布局（鱼骨图 / 组织结构图）或换渲染层都不需要动数据。
 */
import { onMounted, onUnmounted, ref } from 'vue'

import MindCanvas from './components/MindCanvas.vue'
import MindDocDialog from './components/MindDocDialog.vue'
import MindGenerateDialog from './components/MindGenerateDialog.vue'
import MindHelpDialog from './components/MindHelpDialog.vue'
import MindNodeDialog from './components/MindNodeDialog.vue'
import MindToolbar from './components/MindToolbar.vue'
import { useMindActions } from './composables/useMindActions'
import { useMindShortcuts } from './composables/useMindShortcuts'

const showDocs = ref(false)
const showHelp = ref(false)
const showGenerate = ref(false)

/** 画布实例：只有「适应画布」需要从页面层调进去，其余能力由画布自己管理 */
const canvasRef = ref<InstanceType<typeof MindCanvas> | null>(null)

const actions = useMindActions()

/**
 * 快捷键只在页面存活期间监听 window。
 * 删除 / 保存这类带确认策略的动作一律转交 actions，保证与工具条按钮行为完全一致。
 */
const shortcuts = useMindShortcuts({
  save: () => actions.save(),
  fit: () => canvasRef.value?.fit(),
  remove: () => actions.deleteSelected(),
})

onMounted(() => shortcuts.attach())
onUnmounted(() => shortcuts.detach())
</script>

<style scoped lang="scss">
.mindmap-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-base);
}

.mindmap-page__canvas {
  flex: 1;
  min-height: 0;
}
</style>
