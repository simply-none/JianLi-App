<script setup lang="ts">

import { ref, nextTick, onMounted } from 'vue'
import { VueFlow, Position, Handle, useVueFlow, MarkerType } from '@vue-flow/core'
import type { NodeMouseEvent, EdgeMouseEvent, Connection, EdgeUpdateEvent, GraphNode, GraphEdge } from '@vue-flow/core'
import { Background } from '@vue-flow/background'

// these components are only shown as examples of how to use a custom node or edge
// you can find many examples of how to create these custom components in the examples page of the docs
import SpecialNode from './SpecialNode.vue'
import SpecialEdge from './SpecialEdge.vue'
import ToolbarNode from './ToolbarNode.vue'
import Controls from './Controls.vue'
import { presets, colors } from './preset.ts'
import { useLayout } from './useLayout.ts'

const emit = defineEmits(['click', 'pane-click'])

const { updateEdge, addEdges, addNodes, removeNodes, getEdges, getNodes, fitView, fromObject } = useVueFlow()
const { graph, layout } = useLayout()
const currentFlow = ref<any>({})

// these are our nodes
const nodes = ref<any>([
  // an input node, specified by using `type: 'input'`
  {
    id: '1',
    type: 'special',
    position: { x: 250, y: 5 },
    // all nodes can have a data object containing any data you want to pass to the node
    // a label can property can be used for default nodes
    data: { id: '操作名称' },
  },
])

// these are our edges
const edges = ref([
  // default bezier edge
  // consists of an edge id, source node id and target node id
  // {
  //   id: 'e1->2',
  //   source: '1',
  //   sourceHandle: 'right',
  //   targetHandle: 'left',
  //   type: 'step',
  //   target: '2',
  //   updatable: true,
  //   style: {
  //     stroke: presets.ayame,
  //   },
  // },

  // // set `animated: true` to create an animated edge path
  // {
  //   id: 'e2->3',
  //   source: '2',
  //   target: '3',
  //   sourceHandle: 'right',
  //   targetHandle: 'left',
  //   type: 'step',
  //   animated: true,
  //   updatable: true,
  // },

  // // a custom edge, specified by using a custom type name
  // // we choose `type: 'special'` for this example
  // {
  //   id: 'e3->4',
  //   source: '3',
  //   target: '4',
  //   // 边的连线，对应源头和目标节点的id
  //   sourceHandle: 'right',
  //   targetHandle: 'left',
  //   type: 'step',

  //   // all edges can have a data object containing any data you want to pass to the edge
  //   data: {
  //     hello: 'world',
  //   }
  // },
])




// these are the event handlers for node and edge clicks
const onNodeClick = (node: NodeMouseEvent) => {
  console.log('node clicked', node)
  emit('click', node.node)
}

const onEdgeClick = (edge: EdgeMouseEvent) => {
  console.log('edge clicked', edge)
}

// this is a function to add nodes
const addNode = ({ position = { x: 0, y: 0 }, parentId }: ObjectType) => {
  // 判断parentId的节点有多少个子节点，找到最大节点id
  let maxChildId = '0'
  let allNodes = getNodes
  let allEdges = getEdges
  console.log(allNodes, 'allNodes')
  console.log(allEdges, 'allEdges')
  getNodes.value.forEach((edge: ObjectType & GraphNode) => {
    if (edge.source == parentId) {
      maxChildId = Math.max(parseInt(maxChildId), parseInt(edge.target)).toString()
    }
  })
  const maxChild = maxChildId ? getNodes.value.find(node => node.id == maxChildId) : null
  let newPosition = {
    x: maxChild ? (maxChild.position.x) : position.x + 200,
    y: maxChild ? (maxChild.position.y + 200) : position.y + 200,
  }
  console.log(maxChild, 'maxChild, newPosition')

  let obj = {
    id: Date.now().toString(),
    type: 'special',
    position: newPosition,
    data: {
      id: `操作名称${getNodes.value.length + 1}`,
      parentId,
    },
  }
  addNodes(obj)
  // nodes.value.push(obj)
  // 连线
  addEdges({
    id: `e${parentId}->${obj.id}`,
    source: parentId,
    target: obj.id,
    sourceHandle: 'right',
    targetHandle: 'left',
    animated: true,
    type: 'step',
    markerEnd: MarkerType.ArrowClosed,
  })

}

// 移除节点
const removeNode = ({ id }: ObjectType) => {
  removeNodes([id], true, true)
}



// 连接事件
const onConnect = (...args: Connection[]) => {
  console.log('connect', args)
  // edges.value.push(args)
  addEdges({
    id: `e${args[0].source}->${args[0].target}`,
    animated: true,
    type: 'step',
    markerEnd: MarkerType.ArrowClosed,
    ...args[0],
  })
}

// 开始更新事件
const onEdgeUpdateStart = (edge: EdgeMouseEvent) => {
  console.log('edge update start', edge)
}

// 结束更新事件
const onEdgeUpdateEnd = (edge: EdgeMouseEvent) => {
  console.log('edge update end', edge)
}

// 更新事件
const onEdgeUpdate = ({ edge, connection }: EdgeUpdateEvent) => {
  console.log('edge update', edge)
  // 更新连线
  updateEdge(edge, connection)
}

// 面板点击事件
const onPaneClick = (event: MouseEvent) => {
  console.log('pane clicked', event)
  // 关闭右侧面板
  emit('pane-click', event)
}

// 面板右键点击事件
const onPaneContextMenu = (event: MouseEvent) => {
  console.log('pane context menu clicked', event)
  // 保存数据，
  
}



async function layoutGraph(direction: string = 'LR') {
  console.log(getNodes.value, 'getNodes.value')
  nodes.value = layout(getNodes.value || nodes.value, edges.value, direction)

  nextTick(() => {
    fitView()
  })
}

const updateFlow = (flow: ObjectType) => {
  currentFlow.value = flow
}

const updateNodes = (nodes: ObjectType[]) => {
  console.log(nodes, 'nodes in updateNodes')
}

onMounted(() => {
  window.ipcRenderer.handlePromise('query-data', {
    tableName: 'flow',
    conditions: {
      limit: 1,
      orderBy: 'id',
      orderByDesc: true
    }
  }).then(result => {
    if (result.success) {
      console.log(result.data, 'result.data')
      if (Array.isArray(result.data) && result.data.length > 0) {
        currentFlow.value = result.data[0]

        fromObject(JSON.parse(result.data[0].data))
      }
      // fromObject(JSON.parse(result.data.data))
    } else {
      console.log('查询失败')
    }
  })
})
</script>

<template>
  <div class="flow">
    <VueFlow 
      :nodes="nodes" 
      :edges="edges" 
      :max-zoom="10"
      :min-zoom="0.8"
      @update:nodes="updateNodes"
      @pane-click="onPaneClick"
      @pane-context-menu="onPaneContextMenu"
      @node-click="onNodeClick" 
      @edge-click="onEdgeClick"
      @edge-update="onEdgeUpdate" 
      @connect="onConnect" 
      @edge-update-start="onEdgeUpdateStart"
      @edge-update-end="onEdgeUpdateEnd">
      <Controls @layoutGraph="layoutGraph" @update="updateFlow" :currentFlow="currentFlow" />
      <Background />
      <!-- bind your custom node type to a component by using slots, slot names are always `node-<type>` -->
      <template #node-special="specialNodeProps">
        <SpecialNode :position="specialNodeProps.position" :data="specialNodeProps.data" :id="specialNodeProps.id"
          @add="addNode" @remove="removeNode" />
      </template>

      <!-- bind your custom edge type to a component by using slots, slot names are always `edge-<type>` -->
      <template #edge-special="specialEdgeProps">
        <SpecialEdge :data="specialEdgeProps.data" />
      </template>
    </VueFlow>
  </div>
</template>

<style lang="scss">
/* import the necessary styles for Vue Flow to work */
@import '@vue-flow/core/dist/style.css';

/* import the default theme, this is optional but generally recommended */
@import '@vue-flow/core/dist/theme-default.css';

html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}

.flow {
  width: 100%;
  height: 100%;
}

.vue-flow__pane.draggable,
.vue-flow__node.draggable {
  cursor: inherit;

  &:active {
    cursor: pointer;
  }
}

.vue-flow__handle {
  background-color: #e3e3e3 !important;

  &-left,
  &-right {
    height: 24px;
    width: 8px;
    border-radius: 4px
  }

  &-top,
  &-bottom {
    height: 8px;
    width: 24px;
    border-radius: 4px
  }
}

.vue-flow__node-toolbar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  background-color: #2d3748;
  padding: 8px;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

.vue-flow__node-toolbar button {
  background: #4a5568;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
}

.vue-flow__node-toolbar button.selected {
  background: #2563eb;
}

.vue-flow__node-toolbar button:hover {
  background: #2563eb;
}

.vue-flow__node-menu {
  padding: 16px 24px;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
}

.vue-flow__node-menu.selected {
  box-shadow: 0 0 0 2px #2563eb;
}

.vue-flow__minimap {
  transform: scale(75%);
  transform-origin: bottom right;
}

.vue-flow__panel {
  background-color: #2d3748;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 0 10px #00000080
}

.vue-flow__panel .buttons {
  display: flex;
  gap: 8px
}

.vue-flow__panel button {
  border: none;
  cursor: pointer;
  background-color: #4a5568;
  border-radius: 8px;
  color: #fff;
  box-shadow: 0 0 10px #0000004d;
  width: 40px;
  height: 40px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center
}

.vue-flow__panel button:hover {
  background-color: #2563eb;
  transition: background-color .2s
}

.vue-flow__panel button svg {
  width: 100%;
  height: 100%
}
</style>