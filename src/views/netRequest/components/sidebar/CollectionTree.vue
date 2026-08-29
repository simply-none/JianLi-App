<template>
  <div class="col-node">
    <!-- 节点行（可拖拽移动；文件夹可作为放置目标） -->
    <div
      class="node-row"
      :class="{ active: activeId === node.id, 'drop-target': dropHover }"
      :style="{ paddingLeft: depth * 14 + 'px' }"
      draggable="true"
      @click="onNodeClick"
      @dragstart="onDragStart"
      @dragover="onDragOver"
      @dragleave="dropHover = false"
      @drop="onDrop"
    >
      <!-- 文件夹：展开箭头 -->
      <span
        v-if="node.nodeType === 'folder'"
        class="node-arrow"
        :class="{ expanded: expanded }"
        @click.stop="expanded = !expanded"
      >
        <LucideIcon name="ChevronRight" :size="12" />
      </span>
      <span v-else class="node-arrow-placeholder"></span>

      <!-- 类型图标 -->
      <LucideIcon :name="node.nodeType === 'folder' ? 'Folder' : 'Link'" :size="14" />

      <!-- 名称 + 方法徽标 -->
      <template v-if="!renaming">
        <span v-if="node.nodeType === 'request'" class="node-method" :class="'m-' + node.method.toLowerCase()">
          {{ node.method }}
        </span>
        <span class="node-name" :title="node.name">{{ node.name }}</span>
      </template>

      <!-- 行内重命名输入 -->
      <el-input
        v-else
        v-model="renameText"
        size="small"
        class="rename-input"
        @keyup.enter="confirmRename"
        @keyup.esc="cancelRename"
        @blur="confirmRename"
      />

      <!-- 操作菜单 -->
      <el-dropdown trigger="click" class="node-menu" @command="onMenuCommand">
        <span class="menu-trigger" @click.stop>
          <LucideIcon name="EllipsisVertical" :size="14" />
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-if="node.nodeType === 'folder'" command="folder">
              <LucideIcon name="FolderPlus" :size="13" />
              新建子文件夹
            </el-dropdown-item>
            <el-dropdown-item v-if="node.nodeType === 'request'" command="curl">
              <LucideIcon name="Code" :size="13" />
              复制 cURL
            </el-dropdown-item>
            <el-dropdown-item command="rename">
              <LucideIcon name="Pencil" :size="13" />
              重命名
            </el-dropdown-item>
            <el-dropdown-item command="delete" divided>
              <LucideIcon name="Trash2" :size="13" />
              删除
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 子节点（仅文件夹且展开时） -->
    <template v-if="node.nodeType === 'folder' && expanded">
      <CollectionTree
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :active-id="activeId"
        :expand-all="expandAll"
        :expand-signal="expandSignal"
        @load="(cfg, id, name) => emit('load', cfg, id, name)"
        @create-folder="(pid) => emit('createFolder', pid)"
        @rename="(id, name) => emit('rename', id, name)"
        @delete="(id) => emit('delete', id)"
        @copy-curl="(n) => emit('copyCurl', n)"
        @move="(dragId, targetId) => emit('move', dragId, targetId)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 集合树节点（递归组件）
 * - 文件夹可折叠展开（点击行或箭头），支持全局展开/收起信号
 * - 菜单「新建子文件夹」支持在任意层级创建二级/多级集合
 * - 请求节点点击后向父级冒泡 load 事件（回填请求配置）
 * - 行内重命名（Enter 确认 / Esc 取消）
 */
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CollectionNode, RequestConfig } from '../../types'

/** 组件 props 定义（depth 默认 0，根级节点无需显式传入） */
const props = withDefaults(
  defineProps<{
    /** 当前节点 */
    node: CollectionNode;
    /** 嵌套深度（缩进用） */
    depth?: number;
    /** 当前激活（已加载）的请求节点 id */
    activeId?: number;
    /** 全局展开/收起目标状态（配合 expandSignal 生效） */
    expandAll?: boolean;
    /** 全局展开/收起信号（每次切换自增） */
    expandSignal?: number;
  }>(),
  { depth: 0, activeId: undefined, expandAll: true, expandSignal: 0 }
)

/** 事件：加载 / 新建子文件夹 / 重命名 / 删除 / 复制 cURL / 拖拽移动 */
const emit = defineEmits<{
  (e: 'load', config: RequestConfig, nodeId?: number, name?: string): void
  (e: 'createFolder', parentId: number): void
  (e: 'rename', id: number, name: string): void
  (e: 'delete', id: number): void
  (e: 'copyCurl', node: CollectionNode): void
  (e: 'move', dragId: number, targetParentId: number): void
}>()

/** 文件夹是否展开 */
const expanded = ref(true)

/** 是否处于拖拽悬停高亮状态（仅文件夹作为放置目标时） */
const dropHover = ref(false)

// 监听全局展开/收起信号，同步本节点展开状态
watch(
  () => props.expandSignal,
  () => {
    expanded.value = props.expandAll
  }
)

/** 是否处于重命名状态 */
const renaming = ref(false)
/** 重命名输入内容 */
const renameText = ref('')

/**
 * 节点点击：请求节点触发加载；文件夹节点切换展开
 */
function onNodeClick(): void {
  if (props.node.nodeType === 'request') {
    if (props.node.config) {
      emit('load', props.node.config, props.node.id, props.node.name)
    } else {
      ElMessage.warning('该节点缺少请求配置')
    }
  } else {
    expanded.value = !expanded.value
  }
}

/**
 * 菜单命令分发
 * @param command 命令名：folder / curl / rename / delete
 */
function onMenuCommand(command: string): void {
  if (command === 'folder') {
    emit('createFolder', props.node.id)
  } else if (command === 'curl') {
    emit('copyCurl', props.node)
  } else if (command === 'rename') {
    renameText.value = props.node.name
    renaming.value = true
  } else if (command === 'delete') {
    ElMessageBox.confirm(
      props.node.nodeType === 'folder'
        ? `删除文件夹「${props.node.name}」及其全部内容？`
        : `删除请求「${props.node.name}」？`,
      '提示',
      { type: 'warning' }
    )
      .then(() => emit('delete', props.node.id))
      .catch(() => {})
  }
}

/* ------------------------------------------------------------------ */
/* 拖拽移动                                                            */
/* ------------------------------------------------------------------ */

/** 自定义拖拽数据类型（隔离与其他页面/系统的拖拽行为） */
const DRAG_TYPE = 'application/x-nr-node'

/**
 * 拖拽开始：写入节点 id
 * @param e 原生拖拽事件
 */
function onDragStart(e: DragEvent): void {
  e.dataTransfer?.setData(DRAG_TYPE, String(props.node.id))
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

/**
 * 拖拽悬停：仅文件夹节点接受放置
 * @param e 原生拖拽事件
 */
function onDragOver(e: DragEvent): void {
  if (props.node.nodeType !== 'folder') return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dropHover.value = true
}

/**
 * 放置：把被拖拽节点移动到本文件夹内
 * @param e 原生拖拽事件
 */
function onDrop(e: DragEvent): void {
  dropHover.value = false
  if (props.node.nodeType !== 'folder') return
  const raw = e.dataTransfer?.getData(DRAG_TYPE)
  const dragId = Number(raw)
  if (!raw || Number.isNaN(dragId) || dragId === props.node.id) return
  e.preventDefault()
  emit('move', dragId, props.node.id)
}

/**
 * 确认重命名（空名称取消）
 */
function confirmRename(): void {
  if (!renaming.value) return
  renaming.value = false
  const name = renameText.value.trim()
  if (name && name !== props.node.name) {
    emit('rename', props.node.id, name)
  }
}

/**
 * 取消重命名
 */
function cancelRename(): void {
  renaming.value = false
}
</script>

<style scoped lang="scss">
.col-node {
  .node-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 6px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;

    // 拖拽中的源节点半透明
    &:active {
      opacity: 0.6;
    }

    // 拖拽悬停高亮（作为放置目标的文件夹）
    &.drop-target {
      outline: 1.5px dashed var(--el-color-primary);
      outline-offset: -2px;
      background: var(--el-color-primary-light-9);
    }

    &:hover {
      background: var(--el-fill-color-light);

      .node-menu {
        opacity: 1;
      }
    }

    &.active {
      background: var(--el-color-primary-light-9);
    }
  }

  .node-arrow {
    display: inline-flex;
    cursor: pointer;
    color: var(--el-text-color-secondary);
    transition: transform 0.15s;
    user-select: none;

    &.expanded {
      transform: rotate(90deg);
    }
  }

  .node-arrow-placeholder {
    display: inline-block;
    width: 12px;
  }

  .node-method {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.4px;
    width: 42px;
    text-align: center;
    padding: 1px 0;
    border-radius: 4px;
    background: var(--el-fill-color-light);
    flex-shrink: 0;

    &.m-get {
      color: var(--el-color-success);
      background: var(--el-color-success-light-9);
    }
    &.m-post {
      color: var(--el-color-warning);
      background: var(--el-color-warning-light-9);
    }
    &.m-put {
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
    }
    &.m-delete {
      color: var(--el-color-danger);
      background: var(--el-color-danger-light-9);
    }
    &.m-patch {
      color: var(--el-color-primary-light-3);
      background: var(--el-color-primary-light-9);
    }
    &.m-head,
    &.m-options {
      color: var(--el-color-info);
      background: var(--el-color-info-light-9);
    }
  }

  .node-name {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rename-input {
    flex: 1;
  }

  .node-menu {
    opacity: 0;
    flex-shrink: 0;
  }

  .menu-trigger {
    display: inline-flex;
    padding: 2px;
    border-radius: 4px;
    color: var(--el-text-color-secondary);

    &:hover {
      background: var(--el-fill-color);
    }
  }
}
</style>
