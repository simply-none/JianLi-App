<template>
  <el-dialog
    v-model="visible"
    title="保存请求到集合"
    width="420px"
    :close-on-click-modal="false"
  >
    <el-form label-width="70px">
      <!-- 请求名称 -->
      <el-form-item label="名称">
        <el-input
          v-model="name"
          spellcheck="false"
          placeholder="给请求起个名字（默认取 URL）"
        />
      </el-form-item>
      <!-- 目标文件夹 -->
      <el-form-item label="保存到">
        <el-tree-select
          v-model="parentId"
          :data="folderOptions"
          check-strictly
          default-expand-all
          placeholder="根目录"
          clearable
          style="width: 100%"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="confirmSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 保存请求到集合弹窗
 * - 名称默认取 URL 末段
 * - 目标文件夹树选择（仅可选文件夹，根目录 = parentId 0）
 */
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { CollectionNode, RequestConfig } from '../../types'

/** 弹窗可见性（v-model） */
const visible = defineModel<boolean>({ default: false })

/** 组件 props 定义 */
const props = defineProps<{
  /** 集合树（用于构建文件夹选择树） */
  tree: CollectionNode[];
  /** 待保存的请求配置 */
  config: RequestConfig;
  /** 编辑模式：已存在的请求节点 id（新建时为 0） */
  editingId?: number;
  /** 编辑模式：原有名称 */
  editingName?: string;
}>()

/** 保存事件（携带名称与目标文件夹 id） */
const emit = defineEmits<{
  (e: 'save', name: string, parentId: number): void
}>()

/** 请求名称 */
const name = ref('')
/** 目标文件夹 id（0 = 根目录） */
const parentId = ref(0)

/** 文件夹选择树数据（el-tree-select 格式） */
const folderOptions = computed(() => buildFolderOptions(props.tree, 0))

/**
 * 递归构建文件夹选择树
 * @param nodes 集合节点
 * @param depth 递归层数（防环保护，最多 10 层）
 * @returns tree-select 节点数组
 */
function buildFolderOptions(nodes: CollectionNode[], depth: number): any[] {
  if (depth > 10) return []
  return nodes
    .filter((n) => n.nodeType === 'folder')
    .map((n) => ({
      value: n.id,
      label: n.name,
      children: buildFolderOptions(n.children || [], depth + 1),
    }))
}

/** 弹窗打开时初始化默认名称 */
watch(visible, (val) => {
  if (val) {
    name.value =
      props.editingName ||
      (props.config.url
        ? props.config.url.split('?')[0].split('/').filter(Boolean).pop() || props.config.url
        : '新建请求')
  }
})

/**
 * 确认保存
 * @throws 名称为空时提示
 */
function confirmSave(): void {
  if (!name.value.trim()) {
    ElMessage.warning('请输入请求名称')
    return
  }
  emit('save', name.value.trim(), parentId.value || 0)
  visible.value = false
}
</script>
