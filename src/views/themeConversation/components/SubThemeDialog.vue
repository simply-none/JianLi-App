<template>
  <app-dialog
    v-model="visible"
    title="发起子主题"
    width="440px"
    append-to-body
    @open="onOpen"
  >
    <div class="st-form">
      <p class="st-desc" v-if="sourceCount">
        <LucideIcon name="Layers" :size="14" />
        在主题「{{ parentTitle }}」下新建子主题，并将
        <b>{{ sourceCount }}</b> 条源对话预置为跨主题引用。
      </p>
      <p class="st-desc" v-else>
        <LucideIcon name="Layers" :size="14" />
        在主题「{{ parentTitle }}」下新建子主题。
      </p>

      <label class="st-label">子主题标题</label>
      <el-input v-model="formTitle" placeholder="例如：该话题的深入讨论" maxlength="50" />

      <label class="st-label">主题标签</label>
      <TagSelector v-model="formTags" :scope="'theme'" />
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!formTitle.trim()" @click="submit">创建子主题</el-button>
    </template>
  </app-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import TagSelector from './TagSelector.vue';
import { useThemeConversation } from '../composables/useThemeConversation';

const emit = defineEmits<{
  /** 子主题创建成功（页面可借此聚焦输入框） */
  (e: 'confirmed'): void;
}>();

const {
  subThemeDialog,
  closeSubThemeDialog,
  confirmSubTheme,
  currentThemeId,
  themes,
  parseArr,
} = useThemeConversation();

/** 弹窗可见态直接绑定 composable 全局状态（右键 / 多选 / 主题列表共用同一实例） */
const visible = computed({
  get: () => subThemeDialog.value.visible,
  set: (v) => {
    if (!v) closeSubThemeDialog();
  },
});

const formTitle = ref('');
const formTags = ref<string[]>([]);

/** 预置源对话数量 */
const sourceCount = computed(() => subThemeDialog.value.sourceConvs.length);

/** 当前父主题标题（弹窗标题展示用） */
const parentTitle = computed(() => {
  const t = themes.value.find((x) => x.id === currentThemeId.value);
  return t ? t.title || '未命名主题' : '';
});

function onOpen() {
  formTitle.value = '';
  formTags.value = [];
  // 默认预填「xxx 的子主题」，便于快速连续创建
  if (parentTitle.value && parentTitle.value !== '未命名主题') {
    formTitle.value = `${parentTitle.value} · 子主题`;
  }
}

async function submit() {
  const title = formTitle.value.trim();
  if (!title) {
    ElMessage.warning('请输入子主题标题');
    return;
  }
  try {
    await confirmSubTheme(title, formTags.value);
    ElMessage.success('子主题已创建并切换到新主题');
    emit('confirmed');
  } catch (e: any) {
    ElMessage.warning(e?.message || '创建子主题失败');
  }
}
</script>

<style scoped lang="scss">
.st-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.st-desc {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  background: var(--color-primary-light);
  border-radius: 8px;
  padding: 8px 10px;

  :deep(.lucide-icon) {
    color: var(--color-primary);
    flex-shrink: 0;
    margin-top: 2px;
  }

  b { color: var(--color-primary-solid); }
}

.st-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}
</style>
