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

    <!-- 跨主题引用：选择弹窗（全局，由输入框工具条 / 右键菜单唤起） -->
    <CrossThemeRefDialog
      v-model="crossRefPickerOpen"
      @confirm="onCrossRefConfirm"
    />

    <!-- 子主题创建弹窗（全局，由对话右键 / 多选 / 主题右键唤起；创建成功后聚焦输入框） -->
    <SubThemeDialog @confirmed="onNewConversation" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ThemeList from './ThemeList.vue';
import ConversationToolbar from './ConversationToolbar.vue';
import ConversationList from './ConversationList.vue';
import ChatInput from './ChatInput.vue';
import ReferenceDrawer from './ReferenceDrawer.vue';
import CrossThemeRefDialog from './CrossThemeRefDialog.vue';
import SubThemeDialog from './SubThemeDialog.vue';
import { useThemeConversation } from '../composables/useThemeConversation';

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

const {
  init,
  crossRefPickerOpen,
  addPendingCrossRefs,
} = useThemeConversation();
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null);

function onNewConversation() {
  chatInputRef.value?.focus();
}

/** 跨主题引用选择弹窗确认：把选中的目标对话加入草稿 */
function onCrossRefConfirm(refs: Array<{ themeId: number; convId: number }>) {
  addPendingCrossRefs(refs);
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
