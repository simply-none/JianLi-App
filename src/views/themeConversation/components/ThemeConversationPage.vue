<template>
  <div class="theme-conversation-page" :class="{ compact }">
    <!-- 左侧：对话主题列表 -->
    <ThemeList class="tcp-left" />

    <!-- 右侧：工具栏 + 历史对话列表 + 输入框 -->
    <div class="tcp-right">
      <ConversationToolbar class="tcp-toolbar" @new-conversation="onNewConversation" />
      <ConversationList class="tcp-list" />
      <ChatInput ref="chatInputRef" class="tcp-input" />
    </div>

    <!-- 引用历史对话的右侧弹窗（全局，跟随状态） -->
    <ReferenceDrawer />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ThemeList from './ThemeList.vue';
import ConversationToolbar from './ConversationToolbar.vue';
import ConversationList from './ConversationList.vue';
import ChatInput from './ChatInput.vue';
import ReferenceDrawer from './ReferenceDrawer.vue';
import { useThemeConversation } from '../composables/useThemeConversation';

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

const { init } = useThemeConversation();
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null);

function onNewConversation() {
  chatInputRef.value?.focus();
}

onMounted(() => {
  init();
});
</script>

<style scoped lang="scss">
.theme-conversation-page {
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--bg-base);

  .tcp-right {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
}

/* 小窗模式：整体收紧间距，方便后续作为独立小窗口引入 */
.theme-conversation-page.compact {
  :deep(.theme-list) { width: 200px; }
  :deep(.tcp-toolbar) { padding: 8px 12px; }
  :deep(.tcp-list) { padding: 10px; gap: 10px; }
  :deep(.chat-input) { padding: 8px 12px 10px; }
}
</style>
