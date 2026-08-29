<template>
  <div class="backup-card">
    <div class="backup-card-header">
      <LucideIcon name="CalendarClock" :size="18" />
      <span>自动备份</span>
    </div>
    <div class="backup-card-body">
      <div class="setting-row">
        <div class="setting-label">
          <div class="label-main">启用自动备份</div>
          <div class="label-desc">应用运行期间每达到设定间隔自动静默备份一次</div>
        </div>
        <el-switch v-model="form.enabled" />
      </div>

      <div class="setting-row">
        <div class="setting-label">
          <div class="label-main">备份间隔（小时）</div>
          <div class="label-desc">距上次备份超过该时长时触发自动备份</div>
        </div>
        <el-input-number v-model="form.intervalHours" :min="1" :max="168" :step="1" />
      </div>

      <div class="setting-row">
        <div class="setting-label">
          <div class="label-main">保留份数</div>
          <div class="label-desc">自动备份超出该数量时自动清理最旧的备份</div>
        </div>
        <el-input-number v-model="form.keepCount" :min="1" :max="30" :step="1" />
      </div>

      <div class="info-row">
        <span class="info-label">上次自动备份</span>
        <span class="info-value">{{ lastBackupText }}</span>
      </div>

      <div class="save-bar">
        <el-button type="primary" :loading="saving" @click="handleSave">
          <LucideIcon name="Save" :size="14" />
          保存设置
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import moment from 'moment';
import LucideIcon from '@/components/LucideIcon.vue';
import type { AutoBackupConfig } from '../types';
import { setAutoConfig } from '../api/backupApi';

/** 组件入参：自动备份配置（父页面加载传入） */
const props = defineProps<{
  /** 自动备份配置，加载中可为 null */
  config: AutoBackupConfig | null;
}>();

/** 组件事件：change 配置保存成功（父页面刷新概况） */
const emit = defineEmits<{
  (e: 'change'): void;
}>();

/** 本地编辑表单（跟随 props 初始化，保存后才写回主进程） */
const form = reactive<AutoBackupConfig>({
  enabled: false,
  intervalHours: 24,
  keepCount: 7,
  lastBackupAt: 0,
});

/** 是否正在保存 */
const saving = ref(false);

// props 变化时同步到本地表单（父页面刷新后回显最新值）
watch(
  () => props.config,
  (val) => {
    if (val) Object.assign(form, val);
  },
  { immediate: true, deep: true }
);

/** 上次自动备份时间展示文本 */
const lastBackupText = computed(() =>
  form.lastBackupAt ? moment(form.lastBackupAt).format('YYYY-MM-DD HH:mm:ss') : '从未自动备份'
);

/**
 * 保存自动备份配置
 *
 * @returns {Promise<void>}
 */
async function handleSave(): Promise<void> {
  saving.value = true;
  try {
    await setAutoConfig({
      enabled: form.enabled,
      intervalHours: form.intervalHours,
      keepCount: form.keepCount,
    });
    ElMessage.success('自动备份设置已保存');
    emit('change');
  } catch (err: any) {
    ElMessage.error('保存失败：' + (err?.message || String(err)));
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped lang="scss">
@use '../styles/backup-shared.scss';

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 8px;

  &:nth-child(odd) {
    background: var(--bg-hover);
  }

  .setting-label {
    .label-main {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .label-desc {
      margin-top: 2px;
      font-size: 12px;
      color: var(--text-muted);
    }
  }
}

.save-bar {
  margin-top: 16px;
}
</style>
