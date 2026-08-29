<template>
  <div class="json-node">
    <!-- 对象/数组节点：可折叠 -->
    <template v-if="isObjectNode">
      <div class="node-line" :style="{ paddingLeft: depth * 14 + 'px' }">
        <span class="node-arrow" :class="{ expanded: expanded }" @click="expanded = !expanded">
          <LucideIcon name="ChevronRight" :size="12" />
        </span>
        <span v-if="nodeKey !== 'root'" class="node-key" :title="'点击复制路径'" @click="copyPath">
          {{ nodeKey }}
        </span>
        <span v-if="nodeKey !== 'root'" class="node-colon">:</span>
        <span class="node-brace">
          {{ Array.isArray(value) ? '[' : '{' }}
        </span>
        <span class="node-meta">
          {{ Array.isArray(value) ? value.length + ' 项' : Object.keys(value).length + ' 个字段' }}
        </span>
        <span v-if="!expanded" class="node-brace">
          {{ Array.isArray(value) ? ']' : '}' }}
        </span>
      </div>
      <!-- 子节点（仅展开时渲染） -->
      <template v-if="expanded">
        <JsonNode
          v-for="(child, key) in childEntries"
          :key="key"
          :node-key="String(key)"
          :value="child"
          :depth="depth + 1"
          :initial-expand="false"
          :expand-signal="expandSignal"
          :path-prefix="childPath"
        />
        <div class="node-line node-close" :style="{ paddingLeft: depth * 14 + 'px' }">
          {{ Array.isArray(value) ? ']' : '}' }}
        </div>
      </template>
    </template>

    <!-- 叶子节点：按类型着色 -->
    <div v-else class="node-line" :style="{ paddingLeft: depth * 14 + 'px' }">
      <span class="node-leaf-space"></span>
      <span v-if="nodeKey !== 'root'" class="node-key" :title="'点击复制路径'" @click="copyPath">
        {{ nodeKey }}
      </span>
      <span v-if="nodeKey !== 'root'" class="node-colon">:</span>
      <span :class="'node-value-' + valueKind">{{ displayValue }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * JSON 树节点（递归组件）
 * - 对象/数组可折叠展开；受父级 expandSignal 控制全部展开
 * - 叶子值按类型着色（字符串/数字/布尔/null）
 * - 点击键名复制 JSON 路径
 */
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

/** 组件 props 定义 */
const props = defineProps<{
  /** 节点键名（root 表示根节点，不显示键名） */
  nodeKey: string;
  /** 节点值（任意 JSON 值） */
  value: any;
  /** 嵌套深度（控制缩进） */
  depth: number;
  /** 初始是否展开 */
  initialExpand?: boolean;
  /** 展开信号（自增时全部展开） */
  expandSignal?: number;
  /** 父级路径前缀（用于生成完整路径） */
  pathPrefix?: string;
}>()

/** 是否展开（对象/数组节点用） */
const expanded = ref(!!props.initialExpand)

/** 监听展开信号：变化时展开自身（子组件递归响应） */
watch(
  () => props.expandSignal,
  () => {
    expanded.value = true
  }
)

/** 当前节点是否为对象/数组 */
const isObjectNode = computed(
  () => props.value !== null && typeof props.value === 'object'
)

/** 子节点键值对列表（对象键序 / 数组下标序） */
const childEntries = computed(() => {
  if (!isObjectNode.value) return []
  return Array.isArray(props.value) ? props.value : props.value
})

/** 本节点的 JSON 路径（如 data.list[0]） */
const childPath = computed(() => {
  if (props.nodeKey === 'root') return props.pathPrefix || ''
  const prefix = props.pathPrefix || ''
  const seg = Array.isArray(props.value) && !isNaN(Number(props.nodeKey))
    ? `[${props.nodeKey}]`
    : prefix
      ? `.${props.nodeKey}`
      : props.nodeKey
  // 数组下标场景（父级是数组时键名为数字）
  if (!isNaN(Number(props.nodeKey)) && prefix) {
    return `${prefix}[${props.nodeKey}]`
  }
  return prefix ? `${prefix}${seg}` : seg
})

/** 叶子值类型标识（决定着色 class） */
const valueKind = computed(() => {
  const v = props.value
  if (v === null) return 'null'
  if (typeof v === 'number') return 'number'
  if (typeof v === 'boolean') return 'boolean'
  return 'string'
})

/** 叶子值展示文本 */
const displayValue = computed(() => {
  const v = props.value
  if (v === null) return 'null'
  if (typeof v === 'string') return `"${v}"`
  return String(v)
})

/**
 * 复制当前节点的 JSON 路径
 */
function copyPath(): void {
  window.ipcRenderer.clipboard.writeText(childPath.value)
  ElMessage.success(`已复制路径：${childPath.value}`)
}
</script>

<style scoped lang="scss">
.json-node {
  .node-line {
    display: flex;
    align-items: baseline;
    gap: 4px;
    white-space: nowrap;
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

  .node-leaf-space {
    display: inline-block;
    width: 16px;
  }

  .node-key {
    color: var(--el-color-primary);
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  .node-colon {
    color: var(--el-text-color-secondary);
  }

  .node-brace {
    color: var(--el-text-color-regular);
  }

  .node-meta {
    color: var(--el-text-color-placeholder);
    font-size: 11px;
  }

  .node-close {
    color: var(--el-text-color-regular);
  }

  .node-value-string {
    color: var(--el-color-success);
    white-space: pre-wrap;
    word-break: break-all;
  }
  .node-value-number {
    color: var(--el-color-warning);
  }
  .node-value-boolean {
    color: var(--el-color-danger);
  }
  .node-value-null {
    color: var(--el-text-color-placeholder);
  }
}
</style>
