<template>
  <layout-vue>
    <template #main>
      <div class="qr-code-page">
        <TopTabs
          :tabs="tabs"
          :model-value="activeTab"
          @update:modelValue="(k: string | number) => (activeTab = k as string)"
        />

        <div class="qr-content">
          <GenerateTab v-if="activeTab === 'generate'" />
          <BatchTab v-else-if="activeTab === 'batch'" />
          <ScanTab v-else-if="activeTab === 'scan'" />
          <HistoryTab v-else-if="activeTab === 'history'" />
        </div>
      </div>
    </template>
  </layout-vue>
</template>

<script setup lang="ts">
/**
 * 二维码中心（L3 主容器）
 * 顶部通用 TopTabs 切换 4 个 Tab：生成 / 批量 / 识别 / 历史。
 */
import { ref } from 'vue';
import LayoutVue from '@/components/layout.vue';
import TopTabs, { type TopTabItem } from '@/components/TopTabs.vue';
import GenerateTab from './tabs/generate/index.vue';
import BatchTab from './tabs/batch/index.vue';
import ScanTab from './tabs/scan/index.vue';
import HistoryTab from './tabs/history/index.vue';

const tabs: TopTabItem[] = [
  { key: 'generate', label: '生成', icon: 'QrCode', color: '#6366f1' },
  { key: 'batch', label: '批量', icon: 'Grid2x2', color: '#a855f7' },
  { key: 'scan', label: '识别', icon: 'ScanQrCode', color: '#06b6d4' },
  { key: 'history', label: '历史', icon: 'History', color: '#f59e0b' },
];

const activeTab = ref('generate');
</script>

<style lang="scss" scoped>
:deep(.main) {
  padding: 0 !important;
}

.qr-code-page {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: var(--bg-base, var(--el-bg-color));
  overflow: hidden;
}

.qr-code-page :deep(.top-tabs) {
  margin-bottom: 0;
  flex-shrink: 0;
}

.qr-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}
.qr-content > * {
  flex: 1;
  min-height: 0;
}
</style>
