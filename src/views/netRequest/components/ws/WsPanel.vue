<template>
  <div class="ws-panel">
    <!-- 连接栏 -->
    <div class="ws-connect-bar">
      <el-input
        v-model="wsUrl"
        class="ws-url"
        spellcheck="false"
        placeholder="ws://localhost:8080/ws 或 wss://..."
        @keyup.enter="onConnect"
      >
        <template #prepend>
          <span
            class="ws-status-dot"
            :class="'dot-' + wsStatus"
            :title="wsStatus"
          ></span>
        </template>
      </el-input>
      <el-button
        v-if="wsStatus !== 'open'"
        type="primary"
        :loading="wsStatus === 'connecting'"
        @click="onConnect"
      >
        连接
      </el-button>
      <el-button v-else type="danger" plain @click="onDisconnect">断开</el-button>
    </div>

    <!-- 消息时间线 -->
    <WsMessageList :messages="wsMessages" />

    <!-- 发送栏 -->
    <div class="ws-send-bar">
      <el-input
        v-model="sendText"
        class="ws-send-input"
        type="textarea"
        :rows="3"
        spellcheck="false"
        placeholder="要发送的文本消息"
        @keydown.enter.exact.prevent="onSend"
      />
      <div class="ws-send-actions">
        <el-button size="small" text @click="clearWsMessages">
          <LucideIcon name="Trash2" :size="13" />
          清空
        </el-button>
        <el-button size="small" type="primary" :disabled="wsStatus !== 'open'" @click="onSend">
          <LucideIcon name="Send" :size="13" />
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * WebSocket 调试面板：连接管理 + 消息时间线 + 发送
 * 底层能力由 useWebSocket composable（主进程 ws 实例）提供
 */
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import WsMessageList from './WsMessageList.vue'
import {
  clearWsMessages,
  connectWs,
  disconnectWs,
  sendWsMessage,
  useWsState,
} from '../../composables/useWebSocket'

/** ws 状态（url/status/消息列表） */
const { wsUrl, wsStatus, wsMessages } = useWsState()

/** 待发送文本 */
const sendText = ref('')

/**
 * 建立连接
 */
async function onConnect(): Promise<void> {
  const err = await connectWs()
  if (err) {
    ElMessage.error(err)
  }
}

/**
 * 断开连接
 */
function onDisconnect(): void {
  disconnectWs()
}

/**
 * 发送消息
 */
async function onSend(): Promise<void> {
  const err = await sendWsMessage(sendText.value)
  if (err) {
    ElMessage.error(err)
  } else {
    sendText.value = ''
  }
}
</script>

<style scoped lang="scss">
.ws-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ws-connect-bar {
  display: flex;
  gap: 8px;
}

.ws-url {
  flex: 1;
}

.ws-status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &.dot-closed {
    background: var(--el-color-info-light-5);
  }
  &.dot-connecting {
    background: var(--el-color-warning);
  }
  &.dot-open {
    background: var(--el-color-success);
  }
}

.ws-send-bar {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.ws-send-input {
  flex: 1;
}

.ws-send-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
