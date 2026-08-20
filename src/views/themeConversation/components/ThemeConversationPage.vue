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

    <!-- 提醒「结束后记录」：跳转携带 query 时弹出的情绪记录弹窗 -->
    <RecordEmotionDialog v-model="recordDialogVisible" :reminder-title="recordReminderTitle" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ThemeList from './ThemeList.vue';
import ConversationToolbar from './ConversationToolbar.vue';
import ConversationList from './ConversationList.vue';
import ChatInput from './ChatInput.vue';
import ReferenceDrawer from './ReferenceDrawer.vue';
import CrossThemeRefDialog from './CrossThemeRefDialog.vue';
import SubThemeDialog from './SubThemeDialog.vue';
import RecordEmotionDialog from './RecordEmotionDialog.vue';
import { useThemeConversation } from '../composables/useThemeConversation';

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

const {
  init,
  crossRefPickerOpen,
  addPendingCrossRefs,
} = useThemeConversation();
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null);

const route = useRoute();
const router = useRouter();
const recordDialogVisible = ref(false);
const recordReminderTitle = ref('');

// 提醒「结束后记录」场景：从其它路由跳转并带 query 时，自动弹出情绪记录弹窗
watch(
  () => route.query.rt,
  (val) => {
    const title = route.query.recordReminder;
    if (val && title) {
      recordReminderTitle.value = String(title);
      recordDialogVisible.value = true;
    }
  },
  { immediate: true },
);

// 弹窗关闭（取消或保存）后清理 query，避免再次进入页面时重复弹出
watch(recordDialogVisible, (open) => {
  if (!open && (route.query.recordReminder || route.query.rt)) {
    router.replace({ query: {} });
  }
});

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

/* 小窗模式：整体收紧间距，并把内部依赖的「应用主题变量」重映射为皮肤变量，
   使对话页内部与外壳视觉一致（仅靠 CSS 变量继承生效，子组件无需改动）。
   中间色（卡片背景/静音文字）用 color-mix 基于皮肤变量派生，深浅皮肤自动适配。 */
.theme-conversation-page.compact {
  /* —— 背景类 —— */
  --bg-base: var(--skin-bg);
  --bg-card: color-mix(in srgb, var(--skin-bg) 88%, var(--skin-text-primary) 12%);
  --bg-hover: var(--skin-btn-hover);
  --bg-active-btn: var(--skin-btn-bg);
  /* —— 文字类 —— */
  --text-primary: var(--skin-text-primary);
  --text-secondary: var(--skin-text-secondary);
  --text-muted: color-mix(in srgb, var(--skin-text-secondary) 70%, var(--skin-bg) 30%);
  /* —— 主色类 —— */
  --color-primary: var(--skin-dot);
  --color-primary-light: var(--skin-btn-bg);
  --color-primary-solid: var(--skin-dot);
  /* —— 边框/滚动条（阴影、圆角保持原应用主题，不影响皮肤感） —— */
  --border-subtle: var(--skin-border);
  --scrollbar-thumb: var(--skin-border);

  :deep(.theme-list) { width: 200px; }
  :deep(.tcp-toolbar) { padding: 8px 12px; }
  :deep(.tcp-list) { padding: 10px; gap: 10px; }
  :deep(.chat-input) { padding: 8px 12px 10px; }
}
</style>
