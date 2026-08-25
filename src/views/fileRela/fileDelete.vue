<template>
  <div class="file-card">
    <div class="card-header del-header">
      <h3 class="card-title">
        <el-icon><LucideIcon name="Trash2" /></el-icon>
        文件删除
      </h3>
      <el-checkbox v-model="showProgress" class="progress-toggle">进度检测</el-checkbox>
    </div>

    <div class="card-body">
      <div class="del-section">
        <!-- 原子组件：目标文件夹选择 -->
        <DelPathSelect v-model="folder" />

        <!-- 原子组件：删除规则（含/不含 + 整体删除） -->
        <DelRulePanel v-model="filter" />

        <!-- 原子组件：选项（遍历 + 处理方式） -->
        <DelOptions v-model="filter" />

        <!-- 原子组件：预览（仅按规则筛选时显示） -->
        <DelPreview
          v-if="folder && !filter.wholeFolder"
          ref="previewRef"
          :folder="folder"
          :filter="filter"
        />
        <div v-else-if="folder && filter.wholeFolder" class="whole-hint">
          <el-icon><LucideIcon name="CircleAlert" /></el-icon>
          将删除整个文件夹：<code class="mono">{{ folder }}</code>
        </div>

        <div class="copy-btn-wrap">
          <el-button type="danger" @click="onDelete" class="del-btn">
            <el-icon><LucideIcon name="Trash2" /></el-icon>
            开始删除
          </el-button>
        </div>
      </div>
    </div>

    <!-- 原子组件：确认弹窗 -->
    <DelConfirmDialog v-model="confirmVisible" :plan="plan" @confirm="doDelete" />

    <!-- 原子组件：进度 -->
    <DelProgress :monitor="showProgress" @finished="onFinished" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { send } from '@/utils/common';
import { ElMessage } from 'element-plus';
import DelPathSelect from './fileDelete/DelPathSelect.vue';
import DelRulePanel from './fileDelete/DelRulePanel.vue';
import DelOptions from './fileDelete/DelOptions.vue';
import DelPreview from './fileDelete/DelPreview.vue';
import DelConfirmDialog from './fileDelete/DelConfirmDialog.vue';
import DelProgress from './fileDelete/DelProgress.vue';
import { createDefaultDeleteFilter, type DeletePlan } from './fileDelete/types';

const folder = ref('');
const filter = reactive(createDefaultDeleteFilter());
const showProgress = ref(false);
const confirmVisible = ref(false);
const plan = ref<DeletePlan | null>(null);
const previewRef = ref<InstanceType<typeof DelPreview> | null>(null);

function onDelete() {
  if (!folder.value) {
    ElMessage.warning('请先选择目标文件夹');
    return;
  }
  if (filter.wholeFolder) {
    plan.value = {
      wholeFolder: true,
      folder: folder.value,
      paths: [],
      count: 0,
      size: 0,
      recycleBin: filter.recycleBin,
    };
    confirmVisible.value = true;
    return;
  }
  const p = previewRef.value?.getDeletePlan();
  if (!p || p.count === 0) {
    ElMessage.warning('没有匹配的文件');
    return;
  }
  plan.value = {
    wholeFolder: false,
    folder: folder.value,
    paths: p.paths,
    count: p.count,
    size: p.size,
    recycleBin: filter.recycleBin,
  };
  confirmVisible.value = true;
}

function doDelete() {
  if (!plan.value) return;
  const args = plan.value.wholeFolder
    ? { folder: plan.value.folder, wholeFolder: true, recycleBin: plan.value.recycleBin }
    : { folder: plan.value.folder, paths: plan.value.paths, recycleBin: plan.value.recycleBin };
  send('delete-files', args);
  plan.value = null;
}

function onFinished() {
  // 删除完成后刷新预览（清理已删项）
  previewRef.value?.refresh();
}
</script>

<style scoped lang="scss">
.file-card {
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.card-body {
  padding: 20px;
}

.del-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.del-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.progress-toggle {
  margin-left: auto;
}

.whole-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-warning, #ba7517);
  word-break: break-all;
}

.mono {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: var(--text-secondary);
}

.copy-btn-wrap {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}

.del-btn {
  padding: 10px 40px;
}
</style>
