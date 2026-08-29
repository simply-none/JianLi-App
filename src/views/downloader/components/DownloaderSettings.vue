<template>
  <el-dialog
    :model-value="modelValue"
    title="下载设置"
    width="480px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div class="settings-form" v-if="form">
      <div class="form-row">
        <div class="form-label">默认保存目录</div>
        <div class="dir-row">
          <el-input v-model="form.saveDir" placeholder="系统「下载」文件夹" />
          <el-button @click="onSelectDir">
            <LucideIcon name="FolderOpen" :size="14" style="margin-right: 4px" />
            浏览
          </el-button>
        </div>
      </div>

      <div class="form-row inline">
        <span class="form-label">同时下载任务数</span>
        <el-input-number v-model="form.maxConcurrent" :min="1" :max="10" size="small" />
      </div>

      <div class="form-row multi-thread">
        <div class="inline-row">
          <span class="form-label">多线程下载（单任务连接数）</span>
          <el-input-number v-model="form.connectionsPerTask" :min="1" :max="64" size="small" />
        </div>
        <div class="form-hint">每个任务分成的分段数量，服务器支持断点续传时生效；部分网站不支持多线程会自动降为单线程</div>
      </div>

      <div class="form-row inline">
        <span class="form-label">限速（KB/s，0 不限）</span>
        <el-input-number v-model="maxSpeedKb" :min="0" :max="1048576" size="small" :step="256" />
      </div>

      <div class="form-row inline">
        <span class="form-label">接管内置浏览器下载</span>
        <el-switch v-model="form.takeOverBrowser" />
      </div>

      <div class="form-row inline">
        <span class="form-label">剪贴板监视（复制直链自动弹窗）</span>
        <el-switch v-model="form.clipboardMonitor" />
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 下载器设置弹窗
 * 配置项：保存目录 / 并发任务数 / 单任务连接数 / 全局限速 /
 * 浏览器下载接管开关 / 剪贴板监视开关。保存后主进程立即生效。
 */
import { ref, computed } from "vue";
import { ElMessage } from "element-plus";
import LucideIcon from "@/components/LucideIcon.vue";
import { useDownloader } from "../composables/useDownloader";
import { selectFolder } from "../api/downloaderApi";
import type { DownloaderConfig } from "../api/downloaderApi";

/** 弹窗可见性（v-model） */
const modelValue = defineModel<boolean>({ required: true });

/** 选中分类变化事件 */
defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const { config, saveConfig } = useDownloader();

/** 表单副本（打开弹窗时从配置深拷贝） */
const form = ref<DownloaderConfig | null>(null);
/** 保存中 */
const saving = ref(false);

/** 限速 KB/s 与主进程 B/s 的双向换算 */
const maxSpeedKb = computed({
  get: () => Math.round((form.value?.maxSpeed || 0) / 1024),
  set: (v: number) => {
    if (form.value) form.value.maxSpeed = Math.max(0, Math.floor(v * 1024));
  },
});

/**
 * 弹窗打开：快照当前配置到表单
 * @returns void
 */
function onOpen(): void {
  form.value = config.value ? { ...config.value } : null;
}

/**
 * 浏览选择默认保存目录（系统文件夹选择框）
 * @returns void
 */
function onSelectDir(): void {
  const dir = selectFolder();
  if (dir && form.value) form.value.saveDir = dir;
}

/**
 * 保存配置
 * @returns Promise，成功后关闭弹窗
 */
async function onSave(): Promise<void> {
  if (!form.value) return;
  saving.value = true;
  const ok = await saveConfig({
    saveDir: form.value.saveDir.trim(),
    maxConcurrent: form.value.maxConcurrent,
    connectionsPerTask: form.value.connectionsPerTask,
    maxSpeed: form.value.maxSpeed,
    takeOverBrowser: form.value.takeOverBrowser,
    clipboardMonitor: form.value.clipboardMonitor,
  });
  saving.value = false;
  if (ok) {
    ElMessage.success("设置已保存");
    modelValue.value = false;
  }
}
</script>

<style scoped lang="scss">
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dir-row {
  display: flex;
  gap: 8px;

  .el-button { flex-shrink: 0; }
}

.multi-thread {
  .inline-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .form-hint {
    font-size: 0.74rem;
    line-height: 1.5;
    color: var(--text-muted);
  }
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &.inline {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;

    .form-label { font-weight: 500; }
  }

  .form-label {
    font-size: 0.84rem;
    font-weight: 600;
    color: var(--text-secondary);
  }
}
</style>
