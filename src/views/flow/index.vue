<template>
  <div class="flow-pannel">
    <flow class="flow" @click="handleClick" @pane-click="onPaneClick"/>
    <!-- 右侧：流程编辑面板 -->
    <panel v-if="showPanel" class="panel" :node="node" @update="updateNode"/>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useVueFlow, type GraphNode } from "@vue-flow/core";
import flow from './flow.vue'
import panel from './panel.vue'

const showPanel = ref(false)
const node = ref<GraphNode>({} as GraphNode)
const { getNodes } = useVueFlow()

const handleClick = (mynode: GraphNode) => {
  if (mynode.id == node.value?.id) {
    showPanel.value = !showPanel.value
  } else {
    showPanel.value = true
  }
  node.value = mynode
}

// 面板点击事件
const onPaneClick = (event: MouseEvent) => {
  console.log('pane clicked', event)
  // 关闭右侧面板
  showPanel.value = false
}

const updateNode = (newNode: GraphNode) => {
  console.log(getNodes, 'nodes')
}
</script>

<style scoped lang="scss">
.flow-pannel {
  width: 100%;
  height: 100%;
  display: flex;

  .flow {
    flex: 2;
  }
  .panel {
    flex: 1;
  }
}
</style>