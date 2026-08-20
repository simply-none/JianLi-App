<template>
  <el-dialog
    :model-value="visible"
    title="记录待办进展"
    width="460px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:visible', $event)"
    @close="handleClose"
  >
    <div class="record-progress">
      <p class="record-target">
        将记录到主题对话：<strong>《{{ todo?.title || '未命名待办' }}》</strong>
      </p>
      <el-input
        v-model="content"
        type="textarea"
        :rows="5"
        maxlength="2000"
        show-word-limit
        placeholder="填写本次待办进展，例如：已完成接口联调，等待测试反馈..."
      />
      <p class="record-tip">相同待办名称的进展会汇总到同一主题下，按时间先后排列。</p>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存记录</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import moment from 'moment';
import { useThemeConversation } from '@/views/themeConversation/composables/useThemeConversation';

const props = defineProps<{
  visible: boolean;
  todo: { title?: string } | null;
}>();

const emit = defineEmits(['update:visible']);

// 复用主题对话单例：按标题查/建主题（同名复用）+ 写入对话
const { init, findOrCreateThemeByTitle, createConversation } = useThemeConversation();

const content = ref('');
const saving = ref(false);
// schema 仅需确保一次（首次保存时），避免重复初始化
let schemaReady = false;

watch(() => props.visible, (val) => {
  if (val) {
    content.value = '';
    saving.value = false;
  }
});

function handleClose() {
  emit('update:visible', false);
}

async function handleSave() {
  const text = content.value.trim();
  if (!text) {
    ElMessage.warning('请填写进展内容');
    return;
  }

  const title = props.todo?.title || '未命名待办';
  saving.value = true;
  try {
    // 跨模块写入主题对话表，首次确保列结构存在（幂等）
    if (!schemaReady) {
      await init();
      schemaReady = true;
    }
    // 按待办名称定位/创建主题（同名复用，多次记录汇总到同一主题）
    await findOrCreateThemeByTitle(title);
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    await createConversation({ content: `[${now}] ${text}` });
    ElMessage.success('已记录到主题对话《' + title + '》');
    emit('update:visible', false);
  } catch (e: any) {
    ElMessage.error('记录失败：' + (e?.message || e));
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped lang="scss">
.record-progress {
  .record-target {
    margin: 0 0 10px;
    font-size: 13px;
    color: var(--text-secondary);

    strong {
      color: var(--color-primary);
    }
  }

  .record-tip {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
  }
}
</style>
