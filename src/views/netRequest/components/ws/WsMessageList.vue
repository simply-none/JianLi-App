<template>
  <div class="ws-messages">
    <div
      v-for="msg in messages"
      :key="msg.id"
      class="ws-msg"
      :class="'dir-' + msg.direction"
    >
      <!-- 方向标识 + 时间 -->
      <div class="msg-head">
        <span class="msg-direction">
          {{ msg.direction === 'in' ? '↓ 收到' : msg.direction === 'out' ? '↑ 发送' : '● 系统' }}
        </span>
        <span class="msg-time">{{ formatTs(msg.time) }}</span>
      </div>
      <!-- 消息内容 -->
      <div class="msg-body">{{ msg.data }}</div>
    </div>
    <div v-if="!messages.length" class="ws-empty">
      暂无消息，连接后收发的消息会在这里展示
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * WebSocket 消息时间线：收/发/系统事件混排展示（自动滚动到底部）
 */
import { nextTick, watch } from 'vue'
import type { WsMessageItem } from '../../types'
import moment from 'moment'

/** 组件 props 定义 */
const props = defineProps<{
  /** 消息列表（最新在后） */
  messages: WsMessageItem[];
}>()

/** 消息变化时自动滚动到底部 */
watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    const el = document.querySelector('.ws-messages')
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }
)

/**
 * 格式化消息时间
 * @param ts 毫秒时间戳
 * @returns HH:mm:ss
 */
function formatTs(ts: number): string {
  return moment(ts).format('HH:mm:ss')
}
</script>

<style scoped lang="scss">
.ws-messages {
  flex: 1;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--el-fill-color-extra-light);
}

.ws-msg {
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 13px;

  &.dir-in {
    background: var(--el-color-primary-light-9);
    align-self: flex-start;
    max-width: 85%;
  }
  &.dir-out {
    background: var(--el-color-success-light-9);
    align-self: flex-end;
    max-width: 85%;
  }
  &.dir-sys {
    background: var(--el-fill-color);
    align-self: center;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.msg-head {
  display: flex;
  gap: 8px;
  margin-bottom: 2px;
}

.msg-direction {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.msg-time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.msg-body {
  white-space: pre-wrap;
  word-break: break-all;
  font-family: Consolas, Monaco, monospace;
  line-height: 1.5;
}

.ws-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}
</style>
