<template>
  <div class="debug-panel">
    <div class="debug-header">
      <h3>调试信息</h3>
      <div class="debug-actions">
        <el-button size="small" @click="emit('save')">保存数据到文件</el-button>
        <el-button size="small" @click="emit('clear')">清空日志</el-button>
        <el-button size="small" type="danger" plain @click="emit('close')">关闭</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="debug-tabs">
      <!-- 请求日志 -->
      <el-tab-pane label="请求日志" name="logs">
        <div class="debug-logs">
          <div v-for="(log, index) in logs" :key="index" :class="['log-item', log.type]">
            <span class="log-time">{{ log.time }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
          <div v-if="logs.length === 0" class="empty-logs">暂无日志</div>
        </div>
      </el-tab-pane>

      <!-- 天气原始数据 -->
      <el-tab-pane label="天气原始数据" name="raw">
        <pre class="raw-data">{{ formatJson(rawData) }}</pre>
      </el-tab-pane>

      <!-- 数据源轨迹 -->
      <el-tab-pane label="数据源轨迹" name="trace">
        <div class="trace-list">
          <div
            v-for="(t, index) in trace"
            :key="`${t.id}-${index}`"
            class="trace-item"
            :class="t.ok ? 'ok' : 'fail'"
          >
            <span class="trace-status">
              <LucideIcon :name="t.ok ? 'CircleCheck' : 'CircleX'" :size="14" :stroke-width="1.9" />
            </span>
            <span class="trace-label">{{ t.label }}</span>
            <span class="trace-ms">{{ t.ok ? `${t.ms} ms` : '' }}</span>
            <span class="trace-err">{{ t.ok ? '成功' : t.error || '失败' }}</span>
          </div>
          <div v-if="trace.length === 0" class="empty-logs">暂无轨迹（数据可能来自旧缓存）</div>
        </div>

        <div v-if="usedCaps.length" class="cap-block">
          <div class="cap-block-title">本次数据具备的字段能力（{{ usedCaps.length }} 项）</div>
          <div class="cap-tags">
            <span v-for="cap in usedCaps" :key="cap" class="cap-tag">{{ capabilityLabel(cap) }}</span>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { capabilityLabel } from '../capability'
import type { DebugLog, WeatherData } from '../types'

/** 组件 Props */
const props = defineProps<{
  /** 调试日志列表 */
  logs: DebugLog[]
  /** 天气原始数据 */
  rawData: unknown
  /** 当前天气数据（用于读取降级轨迹与能力清单） */
  data?: WeatherData | null
}>()

/** 组件事件 */
const emit = defineEmits<{
  /** 保存调试数据到文件 */
  (e: 'save'): void
  /** 清空调试日志 */
  (e: 'clear'): void
  /** 关闭调试面板 */
  (e: 'close'): void
}>()

/** 当前激活的调试标签页 */
const activeTab = ref('logs')

/** 本次请求的降级轨迹 */
const trace = computed(() => props.data?._trace ?? [])

/** 本次数据具备的字段能力 */
const usedCaps = computed(() => props.data?.capabilities ?? [])

/**
 * 格式化 JSON 数据用于展示
 * @param data 任意数据
 * @returns 格式化后的文本（空数据时显示占位提示）
 */
function formatJson(data: unknown): string {
  if (data === null || data === undefined) {
    return '暂无数据'
  }
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}
</script>

<style scoped lang="scss">
.debug-panel {
  margin-top: 20px;
  background: var(--bg-card, #1e1e2e);
  border-radius: 12px;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  overflow: hidden;

  .debug-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    background: var(--bg-hover, rgba(255, 255, 255, 0.05));
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));

    h3 {
      margin: 0;
      font-size: 0.95rem;
      color: var(--text-primary, #fff);
    }

    .debug-actions {
      display: flex;
      gap: 8px;
    }
  }

  .debug-tabs {
    padding: 12px 16px 16px;
  }

  .debug-logs {
    max-height: 360px;
    overflow-y: auto;
    padding: 8px;
    background: #16161f;
    border-radius: 8px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.78rem;

    .log-item {
      display: flex;
      gap: 10px;
      padding: 4px 8px;
      margin-bottom: 4px;
      border-radius: 4px;
      word-break: break-all;

      &.info {
        background: #1c2233;
        color: #a8b2d1;
      }

      &.success {
        background: #16281e;
        color: #69db7c;
      }

      &.warning {
        background: #2e2a16;
        color: #fcc419;
      }

      &.error {
        background: #2e1717;
        color: #ff6b6b;
      }

      .log-time {
        flex-shrink: 0;
        color: #6c757d;
      }
    }

    .empty-logs {
      text-align: center;
      color: #6c757d;
      padding: 24px;
    }
  }

  .raw-data {
    max-height: 360px;
    overflow-y: auto;
    margin: 0;
    padding: 12px;
    background: #16161f;
    border-radius: 8px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.75rem;
    color: #a8b2d1;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .trace-list {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .trace-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 0.78rem;

      &.ok {
        background: #16281e;
      }

      &.fail {
        background: #2e1717;
      }

      .trace-status {
        display: flex;
        flex-shrink: 0;
      }

      &.ok .trace-status {
        color: #69db7c;
      }

      &.fail .trace-status {
        color: #ff6b6b;
      }

      .trace-label {
        min-width: 100px;
        color: #d9e0f0;
      }

      .trace-ms {
        width: 70px;
        color: #6c757d;
        font-family: 'Consolas', 'Monaco', monospace;
      }

      .trace-err {
        flex: 1;
        color: #a8b2d1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .cap-block {
    margin-top: 14px;

    .cap-block-title {
      font-size: 0.78rem;
      color: var(--text-primary, #fff);
      margin-bottom: 8px;
    }

    .cap-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;

      .cap-tag {
        padding: 2px 9px;
        border-radius: 999px;
        font-size: 0.7rem;
        color: #a8b2d1;
        background: #1c2233;
        border: 1px solid var(--glass-divider);
      }
    }
  }
}
</style>
