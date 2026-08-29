<template>
  <el-dialog
    :model-value="modelValue"
    title="新建下载任务"
    width="520px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div class="new-task-form">
      <div class="form-row">
        <div class="form-label">下载链接</div>
        <el-input
          v-model="url"
          placeholder="粘贴 http/https 直链"
          clearable
          @keydown.enter="onSubmit"
        />
      </div>

      <!-- 错误提示（链接不合法 / 主进程探测失败） -->
      <div v-if="probeError" class="probe-result is-error">{{ probeError }}</div>

      <div class="form-row">
        <div class="form-label">保存目录</div>
        <div class="dir-row">
          <el-input v-model="saveDir" placeholder="留空使用默认下载目录" clearable />
          <el-button @click="onSelectDir">
            <LucideIcon name="FolderOpen" :size="14" style="margin-right: 4px" />
            浏览
          </el-button>
        </div>
      </div>

      <div class="form-row inline">
        <span class="form-label">下载线程数</span>
        <el-select v-model="connections" class="thread-select" size="small">
          <el-option label="默认（跟随设置）" :value="0" />
          <el-option v-for="n in threadOptions" :key="n" :label="`${n} 线程`" :value="n" />
        </el-select>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="probing" :disabled="!url.trim()" @click="onSubmit">
        开始下载
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 新建下载任务弹窗
 * - 链接大小/续传探测与创建合并到主进程（渲染端不直接发网络请求）；
 * - 保存目录支持「浏览」按钮调用系统文件夹选择框；
 * - 可选指定本任务的下载线程数（0 = 跟随全局设置）；
 * - 剪贴板检测命中时父组件通过 setPrefill 预填链接。
 */
import { ref } from "vue";
import { ElMessage } from "element-plus";
import LucideIcon from "@/components/LucideIcon.vue";
import { createTask, selectFolder } from "../api/downloaderApi";

/** 弹窗可见性（v-model） */
const modelValue = defineModel<boolean>({ required: true });

/** 链接输入 */
const url = ref("");
/** 保存目录（可选） */
const saveDir = ref("");
/** 本任务线程数（0 = 跟随设置） */
const connections = ref(0);
/** 提交中 */
const probing = ref(false);
/** 错误提示 */
const probeError = ref("");

/** 线程数可选项 */
const threadOptions = [1, 2, 4, 8, 16, 24, 32, 64];

/**
 * 浏览选择保存目录（系统文件夹选择框）
 * @returns void
 */
function onSelectDir(): void {
  const dir = selectFolder();
  if (dir) saveDir.value = dir;
}

/**
 * 弹窗打开时重置表单（保留可能的剪贴板预填）
 * @returns void
 */
function onOpen(): void {
  probeError.value = "";
}

/**
 * 提交创建任务
 * @returns Promise，成功后关闭弹窗
 */
async function onSubmit(): Promise<void> {
  const link = url.value.trim();
  if (!link) return;
  if (!/^https?:\/\//i.test(link)) {
    probeError.value = "链接必须以 http:// 或 https:// 开头";
    return;
  }
  probing.value = true;
  const res = await createTask(link, {
    saveDir: saveDir.value.trim() || undefined,
    connections: connections.value || undefined,
  });
  probing.value = false;
  if (!res.success) {
    probeError.value = res.error || "创建失败";
    ElMessage.error(probeError.value);
    return;
  }
  modelValue.value = false;
  url.value = "";
  connections.value = 0;
}

/**
 * 设置预填链接（父组件在剪贴板检测命中时调用）
 * @param link 必填，预填链接
 * @returns void
 */
function setPrefill(link: string): void {
  url.value = link;
}

defineExpose({ setPrefill });
</script>

<style scoped lang="scss">
.new-task-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &.inline {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;

    .thread-select { width: 150px; }
  }

  .form-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .dir-row {
    display: flex;
    gap: 8px;

    .el-button { flex-shrink: 0; }
  }
}

.probe-result {
  display: flex;
  gap: 18px;
  padding: 8px 12px;
  border-radius: var(--radius-btn);
  background: var(--bg-hover);
  font-size: 0.8rem;
  color: var(--text-secondary);

  b { color: var(--color-primary-solid); }

  &.is-error {
    color: var(--el-color-danger, #f56c6c);
    background: var(--el-color-danger-light-9, #fef0f0);
  }
}
</style>
