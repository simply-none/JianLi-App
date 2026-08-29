<template>
  <div class="collection-panel">
    <!-- 工具条：新建根文件夹 / 全部展开收起 / 导入 -->
    <div class="col-toolbar">
      <el-button size="small" text type="primary" @click="emit('createFolder', 0)">
        <LucideIcon name="FolderPlus" :size="14" />
        新建文件夹
      </el-button>
      <el-button size="small" text type="primary" @click="toggleExpandAll">
        <LucideIcon :name="allExpanded ? 'ListChevronsDownUp' : 'ListChevronsUpDown'" :size="14" />
        {{ allExpanded ? '全部收起' : '全部展开' }}
      </el-button>
      <el-button size="small" text type="primary" @click="emit('import')">
        <LucideIcon name="Upload" :size="14" />
        导入
      </el-button>
    </div>

    <!-- 集合树（递归渲染，空白区可作为「移入根目录」的放置区） -->
    <div
      class="col-tree"
      :class="{ 'root-drop': rootDrop }"
      @dragover="onRootDragOver"
      @dragleave="rootDrop = false"
      @drop="onRootDrop"
    >
      <CollectionTree
        v-for="node in tree"
        :key="node.id"
        :node="node"
        :expand-all="allExpanded"
        :expand-signal="expandSignal"
        @load="(cfg, id, name) => emit('load', cfg, id, name)"
        @create-folder="(pid) => emit('createFolder', pid)"
        @rename="(id, name) => emit('rename', id, name)"
        @delete="(id) => emit('delete', id)"
        @copy-curl="(n) => emit('copyCurl', n)"
        @move="(dragId, targetId) => emit('move', dragId, targetId)"
      />
      <div v-if="!tree.length" class="col-empty">
        暂无集合，点击「保存」将请求存入集合
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 集合面板：根级新建文件夹 / 全部展开收起 / 导入入口 / 集合树展示
 * 树节点为集合（文件夹）与请求的混合树，支持多级嵌套（二级及更深集合）；
 * 树节点可拖拽移动（放入文件夹或拖到空白区移入根目录）
 */
import { ref } from 'vue'
import CollectionTree from './CollectionTree.vue'
import type { CollectionNode, RequestConfig } from '../../types'

/** 组件 props 定义 */
defineProps<{
  /** 集合树（根级节点） */
  tree: CollectionNode[];
}>()

/** 事件：加载请求 / 新建文件夹 / 重命名 / 删除 / 导入 / 复制 cURL / 拖拽移动 */
const emit = defineEmits<{
  (e: 'load', config: RequestConfig, nodeId?: number, name?: string): void
  (e: 'createFolder', parentId: number): void
  (e: 'rename', id: number, name: string): void
  (e: 'delete', id: number): void
  (e: 'import'): void
  (e: 'copyCurl', node: CollectionNode): void
  (e: 'move', dragId: number, targetParentId: number): void
}>()

/** 当前是否全部展开（用于按钮文案/图标切换） */
const allExpanded = ref(true)
/** 展开收起信号（每次切换自增，通知各递归节点同步状态） */
const expandSignal = ref(0)
/** 根区拖拽悬停高亮 */
const rootDrop = ref(false)

/** 与 CollectionTree 一致的自定义拖拽数据类型 */
const DRAG_TYPE = 'application/x-nr-node'

/**
 * 根区拖拽悬停（允许放置，阻止默认行为）
 * @param e 原生拖拽事件
 */
function onRootDragOver(e: DragEvent): void {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  rootDrop.value = true
}

/**
 * 根区放置：把被拖拽节点移入根目录（parentId = 0）
 * @param e 原生拖拽事件
 */
function onRootDrop(e: DragEvent): void {
  rootDrop.value = false
  const raw = e.dataTransfer?.getData(DRAG_TYPE)
  const dragId = Number(raw)
  if (!raw || Number.isNaN(dragId)) return
  e.preventDefault()
  emit('move', dragId, 0)
}

/**
 * 切换全部展开 / 收起
 */
function toggleExpandAll(): void {
  allExpanded.value = !allExpanded.value
  expandSignal.value++
}
</script>

<style scoped lang="scss">
.collection-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.col-toolbar {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.col-tree {
  flex: 1;
  overflow: auto;

  // 根区拖拽悬停高亮（提示可移入根目录）
  &.root-drop {
    outline: 1.5px dashed var(--el-color-primary);
    outline-offset: -2px;
    border-radius: 8px;
  }
}

.col-empty {
  padding: 24px 8px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}
</style>
