<template>
  <div class="run-panel">
    <div class="run-actions">
      <el-button type="primary" size="small" :disabled="disabled || running" @click="emit('run', 'test')">
        试运行（第一页）
      </el-button>
      <el-button type="success" size="small" :disabled="disabled || running" @click="emit('run', 'run')">
        正式运行
      </el-button>
      <el-button
        v-if="running"
        type="danger"
        size="small"
        @click="emit('stop', currentState!.taskId)"
      >
        停止
      </el-button>
    </div>

    <div v-if="currentState" class="run-status">
      <div class="status-row">
        <el-tag :type="statusTagType" size="small">{{ statusText }}</el-tag>
        <span class="status-phase">{{ currentState.phase }}</span>
        <span class="status-meta">
          第 {{ currentState.page }} 页 · 已采集 {{ currentState.recordCount }} 条 ·
          {{ elapsedText }}
        </span>
      </div>
      <el-progress
        v-if="currentState.status === 'running'"
        :percentage="100"
        :indeterminate="true"
        :duration="2"
        :show-text="false"
        :stroke-width="6"
      />
      <!-- 失败/停止：显著展示错误定位详情（含步骤上下文） -->
      <el-alert
        v-if="currentState.status === 'error' || currentState.status === 'stopped'"
        :title="currentState.status === 'error' ? '任务失败' : '任务已停止'"
        type="error"
        :closable="false"
        show-icon
      >
        <div class="error-detail">{{ currentState.phase }}</div>
      </el-alert>
      <div class="run-logs">
        <div v-for="(log, i) in currentState.logs" :key="i" class="log-line">{{ log }}</div>
        <div v-if="!currentState.logs.length" class="log-empty">暂无日志</div>
      </div>
    </div>
    <div v-else class="run-empty">点击「试运行」预览第一页数据，调好规则后再「正式运行」</div>
  </div>
</template>

<script setup lang="ts">
/**
 * 运行控制面板
 * ------------------------------------------------------------------
 * 展示当前任务的运行控制（试运行/正式运行/停止）、
 * 实时状态（页码/记录数/阶段/耗时）与日志流。
 * 运行状态由父组件（index.vue）从 useTask 的 runningMap 传入。
 */
import { computed } from 'vue'
import type { RunningState } from '../../composables/useTask'

/** 组件属性 */
const props = defineProps<{
  /** 当前任务的运行状态（无运行记录时为 null） */
  currentState: RunningState | null;
  /** 是否禁用运行按钮（如 URL 未配置） */
  disabled?: boolean;
}>()

/** 组件事件 */
const emit = defineEmits<{
  /** 请求运行（mode: test 试运行 / run 正式运行） */
  (e: 'run', mode: 'test' | 'run'): void;
  /** 请求停止任务 */
  (e: 'stop', taskId: string): void;
}>()

/** 是否有任务在运行 */
const running = computed(() => props.currentState?.status === 'running')

/** 状态标签类型 */
const statusTagType = computed(() => {
  switch (props.currentState?.status) {
    case 'running':
      return 'primary'
    case 'done':
      return 'success'
    case 'stopped':
      return 'warning'
    case 'error':
      return 'danger'
    default:
      return 'info'
  }
})

/** 状态文案 */
const statusText = computed(() => {
  switch (props.currentState?.status) {
    case 'running':
      return '运行中'
    case 'done':
      return '已完成'
    case 'stopped':
      return '已停止'
    case 'error':
      return '失败'
    default:
      return '未知'
  }
})

/** 运行耗时文案 */
const elapsedText = computed(() => {
  if (!props.currentState) return ''
  const end = props.currentState.status === 'running' ? Date.now() : props.currentState.startedAt
  const ms = Math.max(0, end - props.currentState.startedAt)
  return ms > 60000 ? `${Math.floor(ms / 60000)}分${Math.floor((ms % 60000) / 1000)}秒` : `${(ms / 1000).toFixed(1)}秒`
})
</script>

<style scoped>
.run-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.run-actions {
  display: flex;
  gap: 8px;
}
.run-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.status-phase {
  font-size: 13px;
  font-weight: 600;
}
.status-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.error-detail {
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
  white-space: pre-wrap;
}
.run-logs {
  max-height: 260px;
  overflow-y: auto;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  padding: 8px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.7;
}
.log-line {
  word-break: break-all;
}
.log-empty {
  color: var(--el-text-color-secondary);
}
.run-empty {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 16px 0;
}
</style>
