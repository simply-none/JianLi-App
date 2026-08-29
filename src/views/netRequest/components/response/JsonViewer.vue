<template>
  <div class="json-viewer">
    <div v-if="!isParsable" class="json-raw">{{ rawText }}</div>
    <template v-else>
      <!-- 工具条：展开/收起 + 复制 -->
      <div class="json-toolbar">
        <el-button size="small" text type="primary" @click="expandAll">
          <LucideIcon name="UnfoldVertical" :size="13" />
          展开
        </el-button>
        <el-button size="small" text type="primary" @click="collapseAll">
          <LucideIcon name="ListChevronsDownUp" :size="13" />
          收起
        </el-button>
        <el-button size="small" text type="primary" @click="copyAll">
          <LucideIcon name="Copy" :size="13" />
          复制
        </el-button>
      </div>
      <div class="json-tree">
        <JsonNode
          :key="collapseSignal"
          node-key="root"
          :value="body"
          :depth="0"
          :initial-expand="collapseSignal === 0"
          :expand-signal="expandSignal"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * JSON 树形查看器
 * - 可折叠展开（含全部展开/收起）
 * - 值按类型着色，键可点击复制 JSON 路径（如 data.list[0].name）
 * - 非 JSON 文本直接原样展示
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import JsonNode from './JsonNode.vue'

/** 组件 props 定义 */
const props = defineProps<{
  /** 响应体数据（可能为对象/数组/字符串） */
  body: any;
}>()

/** 是否可解析为 JSON 树（对象或数组） */
const isParsable = computed(() => props.body !== null && typeof props.body === 'object')

/** 非 JSON 时的原始文本 */
const rawText = computed(() =>
  typeof props.body === 'string' ? props.body : JSON.stringify(props.body, null, 2)
)

/** 展开信号（自增触发全部展开） */
const expandSignal = ref(0)
/** 收起信号（自增触发全部收起） */
const collapseSignal = ref(0)

/**
 * 全部展开（根节点接收 expandSignal 变化后递归展开）
 */
function expandAll(): void {
  expandSignal.value++
}

/**
 * 全部收起：通过重新渲染实现（key 变化重建树，初始状态为收起）
 */
function collapseAll(): void {
  collapseSignal.value++
  expandSignal.value = 0
}

/**
 * 复制完整 JSON 文本
 */
async function copyAll(): Promise<void> {
  const text = JSON.stringify(props.body, null, 2)
  window.ipcRenderer.clipboard.writeText(text)
  ElMessage.success('已复制 JSON')
}
</script>

<style scoped lang="scss">
.json-viewer {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.json-raw {
  white-space: pre-wrap;
  word-break: break-all;
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  line-height: 1.6;
}

.json-toolbar {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}

.json-tree {
  flex: 1;
  overflow: auto;
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  line-height: 1.7;
}
</style>
