<script setup lang="ts">
import { Panel, useVueFlow } from '@vue-flow/core'
import type { FlowExportObject } from '@vue-flow/core'
import Icon from './Icon.vue'
import moment from 'moment';
import { ElMessage } from 'element-plus';
import { ref, watch, computed } from 'vue';

const props = defineProps<{
  currentFlow: any
}>()

const emit = defineEmits<{ 
  (e: 'layoutGraph', direction: string): void 
  (e: 'update', flow: FlowExportObject): void
}>()

const flowKey = 'vue-flow--save-restore'

const { nodes, addNodes, dimensions, toObject, fromObject } = useVueFlow()

const dialogVisible = ref(false)
const form = ref({
  name: ''
})

watch(() => props.currentFlow, (newVal, oldVal) => {
  console.log(newVal, 'newVal')
  if (newVal && newVal.name) {
    form.value.name = newVal.name
  }
}, {
  immediate: true,
  deep: true
})

const title = computed(() => {
  return props.currentFlow.id ? '编辑流程' : '新增流程'
})

function onSavePre() {
  dialogVisible.value = true
}

function onSave(isSaveAs: boolean = false) {
  const flow = toObject()
  console.log(flow)
  // localStorage.setItem(flowKey, JSON.stringify(flow))
  window.ipcRenderer.handlePromise('set-data', {
    tableName: 'flow',
    data: props.currentFlow.id || !isSaveAs ? {
      id: props.currentFlow.id,
      time: moment().format('YYYY-MM-DD HH:mm:ss'),
      type: 'flow',
      name: form.value.name,
      data: JSON.stringify(flow)
    } : {
      time: moment().format('YYYY-MM-DD HH:mm:ss'),
      type: 'flow',
      name: form.value.name,
      data: JSON.stringify(flow)
    }
  }).then(result => {
    if (result.success) {
      console.log('保存成功')
      ElMessage.success('保存成功')
    } else {
      console.log('保存失败')
      ElMessage.error('保存失败')
    }
  }).finally(() => {
    dialogVisible.value = false
  })
}

const dialogVisibleFlow = ref(false)
const flowList = ref([])

function onRestorePre() {
  dialogVisibleFlow.value = true
  window.ipcRenderer.handlePromise('query-data', {
    tableName: 'flow',
    conditions: {
      limit: 100,
      orderBy: 'id',
      orderByDesc: true
    }
  }).then(result => {
    if (result.success) {
      console.log(result.data, 'result.data')
      if (Array.isArray(result.data) && result.data.length > 0) {
        flowList.value = result.data
      }
    } else {
      console.log('查询失败')
    }
  })
}

function onRestore(flow: any) {
  console.log(flow, 'flow')
  emit('update', flow)
  if (flow && flow.data) {
    fromObject(JSON.parse(flow.data))
    dialogVisibleFlow.value = false
  }
}

function onRemove(flow: any) {
  console.log(flow, '删除')
  window.ipcRenderer.handlePromise('delete-data', {
    tableName: 'flow',
    condition: {
      id: flow.id
    }
  }).then(result => {
    if (result.success) {
      console.log('删除成功')
      ElMessage.success('删除成功')
      dialogVisibleFlow.value = false
      // 过滤删除的flow
      flowList.value = flowList.value.filter((item: any) => item.id !== flow.id)
    } else {
      console.log('删除失败')
      ElMessage.error('删除失败')
    }
  })
}

function onNewPage() {
  const id = nodes.value.length + 1

  const newNode = {
    id: `random_node-${id}`,
    label: `Node ${id}`,
    type: 'special',
    position: { x: Math.random() * dimensions.value.width, y: Math.random() * dimensions.value.height },
    data: {
      id: '操作名称'
    }
  }

  fromObject({
    nodes: [newNode],
    edges: [],
  } as unknown as FlowExportObject)

  // addNodes([newNode])
}

function onAdd() {
  const id = nodes.value.length + 1

  const newNode = {
    id: `random_node-${id}`,
    label: `Node ${id}`,
    type: 'special',
    position: { x: Math.random() * dimensions.value.width, y: Math.random() * dimensions.value.height },
    data: {
      id: '操作名称'
    }
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
  <Panel position="top-left" class="flow-name">
    <div class="name">
      流程：{{ props.currentFlow.name || '新建流程' }}
    </div>
  </Panel>
  <Panel position="top-right">
    <div class="buttons">
      <button title="保存" @click="onSavePre">
        <Icon name="save" />
      </button>
      <button title="恢复" @click="onRestorePre">
        <Icon name="list" />
      </button>
      <button title="添加节点" @click="onAdd">
        <Icon name="add" />
      </button>
      <button title="新页面" @click="onNewPage">
        <Icon name="newPage" />
      </button>
      <button title="水平布局" @click="layoutGraph('LR')">
        <Icon name="horizontal" />
      </button>
      <button title="垂直布局" @click="layoutGraph('TB')">
        <Icon name="vertical" />
      </button>
    </div>
  </Panel>
  <el-dialog v-model="dialogVisible" :title="title" width="600">
    <el-form :model="form">
      <el-form-item label="流程名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入流程名称" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button  @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="onSave">保存</el-button>
      <el-button type="success" @click="onSave(true)">另存为</el-button>
    </template>
  </el-dialog>
  <!-- 获取所有的流程 -->
  <el-dialog v-model="dialogVisibleFlow" title="获取所有的流程" width="600">
    <el-table :max-height="400" :data="flowList" style="width: 100%">
      <el-table-column prop="name" label="流程名称" />
      <el-table-column prop="time" label="创建时间" />
      <!-- 操作列 -->
      <el-table-column label="操作">
        <template #default="scope">
          <el-button type="primary" size="small" @click="onRestore(scope.row)">恢复</el-button>
          <el-button type="danger" size="small" @click="onRemove(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<style  lang="scss">
.flow-name.vue-flow__panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  font-size: 16px;
  font-weight: bold;
  color: #333;
  font-weight: 600;
  background-color: #fff;
}
</style>
