<template>
  <div class="col-node">
    <!-- 节点行 -->
    <div
      class="node-row"
      :class="{ active: activeId === node.id }"
      :style="{ paddingLeft: depth * 14 + 'px' }"
      @click="onNodeClick"
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
        @load="(cfg, id, name) => emit('load', cfg, id, name)"
        @create-folder="(pid) => emit('createFolder', pid)"
        @rename="(id, name) => emit('rename', id, name)"
        @delete="(id) => emit('delete', id)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 集合树节点（递归组件）
 * - 文件夹可折叠展开，双击层级内新建子文件夹由菜单触发
 * - 请求节点点击后向父级冒泡 load 事件（回填请求配置）
 * - 行内重命名（Enter 确认 / Esc 取消）
 */
import { ref } from 'vue'
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
  }>(),
  { depth: 0, activeId: undefined }
)

/** 事件：加载 / 新建子文件夹 / 重命名 / 删除 */
const emit = defineEmits<{
  (e: 'load', config: RequestConfig, nodeId?: number, name?: string): void
  (e: 'createFolder', parentId: number): void
  (e: 'rename', id: number, name: string): void
  (e: 'delete', id: number): void
}>()

/** 文件夹是否展开 */
const expanded = ref(true)

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
 * @param command 命令名：folder / rename / delete
 */
function onMenuCommand(command: string): void {
  if (command === 'folder') {
    emit('createFolder', props.node.id)
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
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;

    &.m-get {
      color: var(--el-color-success);
    }
    &.m-post {
      color: var(--el-color-warning);
    }
    &.m-put {
      color: var(--el-color-primary);
    }
    &.m-delete {
      color: var(--el-color-danger);
    }
    &.m-patch {
      color: var(--el-color-primary-light-3);
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
