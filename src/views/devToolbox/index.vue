<template>
  <layout-vue>
    <template #main>
      <div class="dev-toolbox-page">
        <!-- 顶部工具切换 Tab（通用组件：单行不换行 + 滚轮横滚） -->
        <TopTabs
          :tabs="tabs"
          :model-value="activeTab"
          @update:modelValue="(k: string | number) => (activeTab = k as string)"
        />

        <!-- 内容区 -->
        <div class="toolbox-content">
          <JsonHashConverter v-if="activeTab === 'jsonHash'" />
          <RegexTester v-else-if="activeTab === 'regex'" />
          <DiffViewer v-else-if="activeTab === 'diff'" />
          <NetDiagnostic v-else-if="activeTab === 'net'" />
          <DateCalculator v-else-if="activeTab === 'date'" />
          <UnitConverter v-else-if="activeTab === 'unit'" />
        </div>
      </div>
    </template>
  </layout-vue>
</template>

<script setup lang="ts">
/**
 * 开发工具箱 - 主容器
 * 顶部用通用 TopTabs 组件切换 6 个工具子页面（替代 el-tabs）；
 * 每个工具配一枚主色图标，未设置 color 时回退主题主色
 */
import { ref } from 'vue';
import LayoutVue from '@/components/layout.vue';
import TopTabs, { type TopTabItem } from '@/components/TopTabs.vue';
import JsonHashConverter from './tabs/jsonHashConverter/index.vue';
import RegexTester from './tabs/regexTester/index.vue';
import DiffViewer from './tabs/diffViewer/index.vue';
import NetDiagnostic from './tabs/netDiagnostic/index.vue';
import DateCalculator from './tabs/dateCalculator/index.vue';
import UnitConverter from './tabs/unitConverter/index.vue';

/** 顶部 Tab 数据源：唯一 key + 中文名 + Lucide 图标名 + 专属强调色 */
const tabs: TopTabItem[] = [
  { key: 'jsonHash', label: 'JSON/Hash/编码', icon: 'Code2', color: '#6366f1' },
  { key: 'regex', label: '正则测试', icon: 'Regex', color: '#a855f7' },
  { key: 'diff', label: '文本对比', icon: 'GitCompare', color: '#22c55e' },
  { key: 'net', label: '网络诊断', icon: 'Wifi', color: '#06b6d4' },
  { key: 'date', label: '日期计算', icon: 'CalendarDays', color: '#f59e0b' },
  { key: 'unit', label: '单位换算', icon: 'Ruler', color: '#f43f5e' },
];

const activeTab = ref('jsonHash');
</script>

<style lang="scss" scoped>
:deep(.main) {
  padding: 0 !important;
}

.dev-toolbox-page {
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

/* 主 Tab 区：去掉通用组件的底部间距，改由 page 的 gap 统一控制 */
.dev-toolbox-page :deep(.top-tabs) {
  margin-bottom: 0;
  flex-shrink: 0;
}

.toolbox-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  /* 子组件（各工具页）默认拉伸撑满剩余高度 */
  display: flex;
  flex-direction: column;
}
.toolbox-content > * {
  flex: 1;
  min-height: 0;
}
</style>