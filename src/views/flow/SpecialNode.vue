<script setup>
import { computed, useAttrs } from 'vue'
import { Position, Handle, useVueFlow } from '@vue-flow/core'
import { NodeToolbar } from '@vue-flow/node-toolbar'
import { NodeResizer } from '@vue-flow/node-resizer'

const props = defineProps({
  position: {
    type: Object,
    required: true,
  },
  data: {
    type: Object,
    required: true,
  },

  id: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['add'])

const actions = ['👎', '✋', '👍', '➕']

const { updateNodeData } = useVueFlow()

const x = computed(() => `${Math.round(props.position.x)}px`)
const y = computed(() => `${Math.round(props.position.y)}px`)

function add(id, { action }) {
  if (action == '➕') {
    emit('add', {
      position: props.position,
      parentId: id,
    })
    return
  }
  updateNodeData(props.id, {
    action: action,
  })
  
}
</script>

<template>
  <NodeResizer min-width="100" min-height="30" />
  <NodeToolbar :is-visible="data.toolbarVisible" :position="data.toolbarPosition">
    <button
      v-for="action of actions"
      :key="action"
      type="button"
      :class="{ selected: action === data.action }"
      @click="add(props.id, { action })"
    >
      {{ action }}
    </button>
    
  </NodeToolbar>
  <div class="vue-flow__node-default special-node">

    <div>
      {{ x }} {{ y }} {{ data.label }}
    </div>
    <Handle id="right" type="source" :position="Position.Right" />
    <Handle id="bottom" type="source" :position="Position.Bottom" />

    <Handle id="left" type="target" :position="Position.Left" />
    <Handle id="top" type="target" :position="Position.Top" />

  </div>

</template>

<style scoped>
.special-node {
  padding: 18px 9px;
  background-color: #ffffff;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  border: 1px solid #ffffff;
  position: relative;
}

.special-node-test {
  /* 右边居中 */
  position: absolute;
  top: 50%;
  right: -20px;
  transform: translateY(-50%);
  background-color: aqua;
  width: 20px;
  height: 20px;
}
</style>