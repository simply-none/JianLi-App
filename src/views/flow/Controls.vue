<script setup lang="ts">
import { Panel, useVueFlow } from '@vue-flow/core'
import Icon from './Icon.vue'

const emit = defineEmits<{ (e: 'layoutGraph', direction: string): void }>()

const flowKey = 'vue-flow--save-restore'

const { nodes, addNodes, dimensions, toObject, fromObject } = useVueFlow()

function onSave() {
  const flow = toObject()
  console.log(flow)
  localStorage.setItem(flowKey, JSON.stringify(flow))
}

function onRestore() {
  const flow = JSON.parse(localStorage.getItem(flowKey)!)

  if (flow) {
    fromObject(flow)
  }
}

function onAdd() {
  const id = nodes.value.length + 1

  const newNode = {
    id: `random_node-${id}`,
    label: `Node ${id}`,
    position: { x: Math.random() * dimensions.value.width, y: Math.random() * dimensions.value.height },
  }

  addNodes([newNode])
}

function layoutGraph(direction: string) {
  emit('layoutGraph', direction)
}

function layoutInit(direction: string, mode: string, note: HTMLElement | null = null) {
  console.log(direction, mode, note, '初始化布局')
  layoutGraph(direction)
  if (note) {
    note.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
  }
}
</script>

<template>
  <Panel position="top-right">
    <div class="buttons">
      <button title="保存" @click="onSave">
        <Icon name="save" />
      </button>
      <button title="恢复" @click="onRestore">
        <Icon name="restore" />
      </button>
      <button title="添加节点" @click="onAdd">
        <Icon name="add" />
      </button>
      <button title="水平布局" @click="layoutGraph('LR')">
        <Icon name="horizontal" />
      </button>

      <button title="垂直布局" @click="layoutGraph('TB')">
        <Icon name="vertical" />
      </button>
      <button title="列表布局">
        <Icon name="list" />
      </button>
    </div>
  </Panel>
</template>
