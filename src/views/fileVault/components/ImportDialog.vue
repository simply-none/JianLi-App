<template>
  <AppDialog v-model="visible" title="导入加密文件" :show-fullscreen="false">
    <div class="imp">
      <button class="imp-pick" @click="choose">
        <LucideIcon name="FolderOpen" :size="16" />
        <span>{{ picked.length ? `已选择 ${picked.length} 个文件` : '选择要加密的文件…' }}</span>
      </button>

      <label class="imp-opt">
        <input type="checkbox" v-model="deleteSource" />
        <span>导入后删除原文件（安全删除，防止明文残留在原位置）</span>
      </label>

      <div v-if="picked.length" class="imp-list">
        <div v-for="p in picked" :key="p" class="imp-item" :title="p">
          {{ basename(p) }}
        </div>
      </div>

      <div v-if="progress.total" class="imp-progress">
        已加密 {{ progress.done }} / {{ progress.total }}
      </div>

      <p v-if="error" class="imp-error">{{ error }}</p>

      <div class="imp-footer">
        <button class="imp-btn" @click="visible = false">取消</button>
        <button class="imp-btn imp-btn--primary" :disabled="!picked.length || importing" @click="run">
          {{ importing ? '加密中…' : '开始加密导入' }}
        </button>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * 导入加密对话框：原生多选 → 逐文件加密落盘。
 * 主进程负责读取源文件、加密、写元数据；本组件只管选文件与进度。
 */
import { ref, reactive, watch } from 'vue';
import { ElMessage } from 'element-plus';
import AppDialog from '@/components/AppDialog.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { fileVaultApi } from '../api/fileVaultApi';
import { suspendAutoLockForNative, resumeAutoLockForNative } from '@/composables/useAutoLock';

const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ (e: 'done', result: { ok: number; fail: number }): void }>();
/** 右键菜单预填的文件路径（来自资源管理器「加密到保险箱」）；为空时走原生选择 */
const props = defineProps<{ initialFiles?: string[] }>();

const picked = ref<string[]>([]);
const importing = ref(false);
const error = ref('');
const progress = reactive({ done: 0, total: 0 });
/** 导入后是否安全删除原文件（避免明文残留在原位置）；保险箱语义下默认开启 */
const deleteSource = ref(true);

function basename(p: string): string {
  return p.split(/[\\/]/).pop() || p;
}

/** 右键预填：把 initialFiles 直接填入待加密列表；为空则清空（走原生选择） */
watch(
  () => props.initialFiles,
  (v) => {
    picked.value = v && v.length ? v : [];
  },
  { immediate: true },
);

async function choose() {
  // 原生多选对话框会让渲染窗口失焦，挂起自动锁定避免误触发
  suspendAutoLockForNative();
  try {
    const paths = await fileVaultApi.pickImport();
    if (paths && paths.length) picked.value = paths;
  } finally {
    resumeAutoLockForNative();
  }
}

async function run() {
  error.value = '';
  if (!picked.value.length) return;
  importing.value = true;
  progress.total = picked.value.length;
  progress.done = 0;
  let ok = 0;
  let fail = 0;
  let deleted = 0;
  for (const p of picked.value) {
    const res = await fileVaultApi.importFile(p, undefined, deleteSource.value);
    if (res.ok) {
      ok++;
      if (res.sourceDeleted) deleted++;
    } else fail++;
    progress.done++;
  }
  importing.value = false;
  if (ok)
    ElMessage.success(
      `已加密导入 ${ok} 个文件${deleted ? `，已安全删除原文件 ${deleted} 个` : ''}`,
    );
  if (fail) ElMessage.warning(`${fail} 个文件导入失败`);
  picked.value = [];
  progress.total = 0;
  progress.done = 0;
  visible.value = false;
  emit('done', { ok, fail });
}
</script>

<style scoped lang="scss">
.imp {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 2px;
}
.imp-pick {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}
.imp-list {
  max-height: 200px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.imp-opt {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  input {
    width: 15px;
    height: 15px;
    accent-color: var(--color-primary);
    cursor: pointer;
  }
}
.imp-item {
  padding: 6px 8px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
  border-radius: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.imp-progress {
  font-size: 12px;
  color: var(--text-muted);
}
.imp-error {
  margin: 0;
  font-size: 12px;
  color: var(--color-error, #e11d48);
}
.imp-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.imp-btn {
  padding: 8px 16px;
  font-size: 13px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  &--primary {
    color: #fff;
    background: var(--color-primary);
    border-color: var(--color-primary);
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}
</style>
