<template>
  <layout-vue>
    <template #main>
      <div class="dev-toolbox-page">
        <!-- 顶部 Tabs -->
        <el-tabs v-model="activeTab" class="toolbox-tabs" stretch>
          <el-tab-pane v-for="tab in tabs" :key="tab.name" :name="tab.name">
            <template #label>
              <span class="tab-label">
                <LucideIcon :name="tab.icon" :size="16" />
                <span>{{ tab.label }}</span>
              </span>
            </template>
          </el-tab-pane>
        </el-tabs>

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
 * 顶部 el-tabs 切换 6 个工具子页面
 */
import { ref } from 'vue';
import LayoutVue from '@/components/layout.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import JsonHashConverter from './tabs/jsonHashConverter/index.vue';
import RegexTester from './tabs/regexTester/index.vue';
import DiffViewer from './tabs/diffViewer/index.vue';
import NetDiagnostic from './tabs/netDiagnostic/index.vue';
import DateCalculator from './tabs/dateCalculator/index.vue';
import UnitConverter from './tabs/unitConverter/index.vue';

interface TabDef {
  name: string;
  label: string;
  icon: string;
}

const tabs: TabDef[] = [
  { name: 'jsonHash', label: 'JSON/Hash/编码', icon: 'Code2' },
  { name: 'regex', label: '正则测试', icon: 'Regex' },
  { name: 'diff', label: '文本对比', icon: 'GitCompare' },
  { name: 'net', label: '网络诊断', icon: 'Wifi' },
  { name: 'date', label: '日期计算', icon: 'CalendarDays' },
  { name: 'unit', label: '单位换算', icon: 'Ruler' },
];

const activeTab = ref('jsonHash');
</script>

<style lang="scss" scoped>
.dev-toolbox-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  gap: 12px;
  box-sizing: border-box;
  background: var(--el-bg-color, #f5f7fa);
}

.toolbox-tabs {
  flex-shrink: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);

  .tab-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
  }

  :deep(.el-tabs__item) {
    height: 40px;
    line-height: 40px;
  }
}

.toolbox-content {
  flex: 1;
  overflow: auto;
  min-height: 0;
}
</style>
