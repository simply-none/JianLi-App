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
      <!-- 目标集合 -->
      <el-form-item label="保存到">
        <div class="save-to-row">
          <el-tree-select
            v-model="parentId"
            :data="folderOptions"
            check-strictly
            default-expand-all
            placeholder="请选择集合"
            style="flex: 1"
          />
          <el-button size="default" @click="toggleCreating">
            <LucideIcon name="FolderPlus" :size="13" />
            新建
          </el-button>
        </div>
      </el-form-item>
      <!-- 内联新建集合：在当前选中集合下创建子集合（未选中则在根目录） -->
      <el-form-item v-if="creating" label="">
        <div class="new-folder-row">
          <el-input
            ref="newFolderInputRef"
            v-model="newFolderName"
            size="small"
            spellcheck="false"
            placeholder="集合名称（创建于当前选中集合内）"
            @keyup.enter="confirmCreateFolder"
            @keyup.esc="toggleCreating"
          />
          <el-button size="small" type="primary" :loading="creatingFolder" @click="confirmCreateFolder">
            创建
          </el-button>
        </div>
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
 * - 名称默认取 URL 末段（UUID/超长哈希段自动回退到更有语义的段）
 * - 目标集合：从数据库集合树中选择（根目录 + 各级文件夹）
 * - 支持内联新建集合（在选中集合下创建，创建后自动选中）
 */
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { CollectionNode, RequestConfig } from '../../types'

/** 弹窗可见性（v-model） */
const visible = defineModel<boolean>({ default: false })

/** 组件 props 定义 */
const props = defineProps<{
  /** 集合树（用于构建集合选择树） */
  tree: CollectionNode[];
  /** 待保存的请求配置 */
  config: RequestConfig;
  /** 编辑模式：已存在的请求节点 id（新建时为 0） */
  editingId?: number;
  /** 编辑模式：原有名称 */
  editingName?: string;
}>()

/** 事件：保存 / 新建集合（onDone 回调携带新集合 id，用于自动选中） */
const emit = defineEmits<{
  (e: 'save', name: string, parentId: number): void
  (e: 'createFolder', parentId: number, name: string, onDone: (id: number) => void): void
}>()

/** 请求名称 */
const name = ref('')
/** 目标集合 id（0 = 根目录） */
const parentId = ref(0)

/** 是否处于内联新建集合状态 */
const creating = ref(false)
/** 新集合名称输入 */
const newFolderName = ref('')
/** 新建请求进行中（防重复提交） */
const creatingFolder = ref(false)
/** 新集合名称输入框引用（打开后自动聚焦） */
const newFolderInputRef = ref()

/** 集合选择树数据（el-tree-select 格式，顶部内置「根目录」选项 value=0） */
const folderOptions = computed(() => [
  { value: 0, label: '根目录', children: buildFolderOptions(props.tree, 0) },
])

/**
 * 递归构建集合选择树（仅文件夹节点，请求节点不作为保存目标）
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
    name.value = props.editingName || deriveName(props.config.url)
    creating.value = false
    newFolderName.value = ''
  }
})

/**
 * 切换内联新建集合状态
 */
function toggleCreating(): void {
  creating.value = !creating.value
  if (creating.value) {
    newFolderName.value = ''
    nextTick(() => newFolderInputRef.value?.focus())
  }
}

/**
 * 确认新建集合
 * - 创建于当前选中的集合内（未选中则在根目录）
 * - 成功后回调父组件刷新树，并把新集合 id 设为保存目标
 * @throws 名称为空时提示
 */
function confirmCreateFolder(): void {
  const folderName = newFolderName.value.trim()
  if (!folderName) {
    ElMessage.warning('请输入集合名称')
    return
  }
  creatingFolder.value = true
  emit('createFolder', parentId.value || 0, folderName, (newId) => {
    creatingFolder.value = false
    creating.value = false
    newFolderName.value = ''
    parentId.value = newId
  })
}

/**
 * 从 URL 推导默认请求名称
 * 取路径末段；若末段疑似 UUID / 超长哈希 / 纯长数字，则向前回退到更有语义的段；
 * 无可用路径段时取主机名
 * @param url 请求地址
 * @returns 默认名称（无 URL 时返回「新建请求」）
 */
function deriveName(url: string): string {
  if (!url) return '新建请求'
  // 清理复制链路可能残留的引号/反引号，再去查询串
  const clean = url.replace(/[`'"]/g, '').split('?')[0]
  const segs = clean.split('/').filter(Boolean)
  const hasProto = Boolean(segs[0]?.includes(':'))
  const host = hasProto ? segs[1] || '' : segs[0] || ''
  const pathSegs = hasProto ? segs.slice(2) : segs.slice(1)
  for (let i = pathSegs.length - 1; i >= 0; i--) {
    const seg = pathSegs[i]
    // 跳过疑似无语义的段：标准 UUID、超长段（可能是哈希/签名）、10 位以上纯数字
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) ||
      seg.length > 48 ||
      /^\d{10,}$/.test(seg)
    ) {
      continue
    }
    return decodeURIComponent(seg)
  }
  return host || '新建请求'
}

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

<style scoped lang="scss">
.save-to-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.new-folder-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}
</style>
