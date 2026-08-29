<template>
  <div class="collection-panel">
    <!-- 工具条：新建根文件夹 / 导入 -->
    <div class="col-toolbar">
      <el-button size="small" text type="primary" @click="emit('createFolder', 0)">
        <LucideIcon name="FolderPlus" :size="14" />
        新建文件夹
      </el-button>
      <el-button size="small" text type="primary" @click="emit('import')">
        <LucideIcon name="Upload" :size="14" />
        导入
      </el-button>
    </div>

    <!-- 集合树（递归渲染） -->
    <div class="col-tree">
      <CollectionTree
        v-for="node in tree"
        :key="node.id"
        :node="node"
        @load="(cfg, id, name) => emit('load', cfg, id, name)"
        @create-folder="(pid) => emit('createFolder', pid)"
        @rename="(id, name) => emit('rename', id, name)"
        @delete="(id) => emit('delete', id)"
      />
      <div v-if="!tree.length" class="col-empty">
        暂无集合，点击「保存」将请求存入集合
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 集合面板：根级新建文件夹 / 导入入口 / 集合树展示
 */
import CollectionTree from './CollectionTree.vue'
import type { CollectionNode, RequestConfig } from '../../types'

/** 组件 props 定义 */
defineProps<{
  /** 集合树（根级节点） */
  tree: CollectionNode[];
}>()

/** 事件：加载请求 / 新建文件夹 / 重命名 / 删除 / 导入 */
const emit = defineEmits<{
  (e: 'load', config: RequestConfig, nodeId?: number, name?: string): void
  (e: 'createFolder', parentId: number): void
  (e: 'rename', id: number, name: string): void
  (e: 'delete', id: number): void
  (e: 'import'): void
}>()
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
}

.col-tree {
  flex: 1;
  overflow: auto;
}

.col-empty {
  padding: 24px 8px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}
</style>
