<script setup lang="ts">

import { ref, nextTick } from 'vue'
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

const emit = defineEmits(['click'])

const { updateEdge, addEdges, addNodes, getEdges, getNodes, fitView } = useVueFlow()
const { graph, layout } = useLayout()

// these are our nodes
const nodes = ref<any>([
  // an input node, specified by using `type: 'input'`
  {
    id: '1',
    type: 'special',
    position: { x: 250, y: 5 },
    // all nodes can have a data object containing any data you want to pass to the node
    // a label can property can be used for default nodes
    data: { label: 'Node 1' },
  },

  // default node, you can omit `type: 'default'` as it's the fallback type
  {
    id: '2',
    type: 'special',
    position: { x: 100, y: 100 },
    data: { label: 'Node 2' },
  },

  // An output node, specified by using `type: 'output'`
  {
    id: '3',
    type: 'special',
    position: { x: 400, y: 200 },
    data: { label: 'Node 3' },
  },

  // this is a custom node
  // we set it by using a custom type name we choose, in this example `special`
  // the name can be freely chosen, there are no restrictions as long as it's a string
  {
    id: '4',
    type: 'special', // <-- this is the custom node type name
    position: { x: 400, y: 300 },
    data: {
      label: 'Node 4',
      hello: 'world',
    },
  },
])

// these are our edges
const edges = ref([
  // default bezier edge
  // consists of an edge id, source node id and target node id
  {
    id: 'e1->2',
    source: '1',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'step',
    target: '2',
    updatable: true,
    style: {
      stroke: presets.ayame,
    },
  },

  // set `animated: true` to create an animated edge path
  {
    id: 'e2->3',
    source: '2',
    target: '3',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'step',
    animated: true,
    updatable: true,
  },

  // a custom edge, specified by using a custom type name
  // we choose `type: 'special'` for this example
  {
    id: 'e3->4',
    source: '3',
    target: '4',
    // 边的连线，对应源头和目标节点的id
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'step',

    // all edges can have a data object containing any data you want to pass to the edge
    data: {
      hello: 'world',
    }
  },
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
      label: `Node ${nodes.value.length + 1}`,
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


// 连接事件
const onConnect = (...args: Connection[]) => {
  console.log('connect', ...args)
  // edges.value.push(args)
  addEdges(args)
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

async function layoutGraph(direction: string = 'LR') {
  console.log(getNodes.value, 'getNodes.value')
  nodes.value = layout(getNodes.value || nodes.value, edges.value, direction)

  nextTick(() => {
    fitView()
  })
}
</script>

<template>
  <div class="flow">
    <VueFlow 
      :nodes="nodes" 
      :edges="edges" 
      @node-click="onNodeClick" 
      @edge-click="onEdgeClick"
      @edge-update="onEdgeUpdate" 
      @connect="onConnect" 
      @edge-update-start="onEdgeUpdateStart"
      @edge-update-end="onEdgeUpdateEnd">
      <Controls @layoutGraph="layoutGraph" />
      <Background />
      <!-- bind your custom node type to a component by using slots, slot names are always `node-<type>` -->
      <template #node-special="specialNodeProps">
        <SpecialNode :position="specialNodeProps.position" :data="specialNodeProps.data" :id="specialNodeProps.id"
          @add="addNode" />
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