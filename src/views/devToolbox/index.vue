<template>
  <layout-vue>
    <template #main>
      <div class="dev-toolbox-page">
        <!-- 页头：仪表盘态显示大标题，工具态显示返回按钮 -->
        <div class="head">
          <div>
            <h2 class="page-title">开发工具箱</h2>
            <p class="sub">本地开发者实用工具集合</p>
          </div>
          <el-button v-if="activeTool" @click="backToDashboard">
            <LucideIcon name="ChevronLeft" :size="15" /> 返回工具列表
          </el-button>
        </div>

        <!-- 仪表盘：工具卡片网格 -->
        <div v-if="!activeTool" class="cards">
          <DevToolCard
            v-for="t in DEV_TOOL_CATALOG"
            :key="t.key"
            :meta="t"
            @click="openTool(t.key)"
          />
        </div>

        <!-- 工具态：二级标题 + 对应工具子页面 -->
        <template v-else>
          <!-- 二级标题：当前工具名称与描述 -->
          <div class="tool-head">
            <h3 class="tool-title">{{ activeMeta?.title }}</h3>
            <p v-if="activeMeta?.desc" class="tool-desc">{{ activeMeta.desc }}</p>
          </div>
          <!-- 工具级操作提示（来自 catalog 的 tip 字段） -->
          <ToolHint v-if="activeMeta?.tip" class="tool-tip" :text="activeMeta.tip" />

          <!-- 内容区（保留 flex 撑满机制，保证满高工具页布局不变） -->
          <div class="toolbox-content">
            <JsonHashConverter v-if="activeTool === 'jsonHash'" />
            <RegexTester v-else-if="activeTool === 'regex'" />
            <DiffViewer v-else-if="activeTool === 'diff'" />
            <NetDiagnostic v-else-if="activeTool === 'net'" />
            <DateCalculator v-else-if="activeTool === 'date'" />
            <UnitConverter v-else-if="activeTool === 'unit'" />
          </div>
        </template>
      </div>
    </template>
  </layout-vue>
</template>

<script setup lang="ts">
/**
 * 开发工具箱 - 主容器
 * 改造为与 pdfTools 一致的两态布局（移除顶部 TopTabs）：
 * 1. 仪表盘态：页头大标题 + 工具卡片网格（DevToolCard）；
 * 2. 工具态：页头返回按钮 + 二级标题（工具名 + 描述）+ 对应工具子页面。
 * 工具切换状态用本地 ref 管理（无共享数据需求，不引入 Pinia store）。
 */
import { computed, ref } from 'vue';
import LayoutVue from '@/components/layout.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import DevToolCard from './components/DevToolCard.vue';
import ToolHint from '@/components/ToolHint.vue';
import JsonHashConverter from './tabs/jsonHashConverter/index.vue';
import RegexTester from './tabs/regexTester/index.vue';
import DiffViewer from './tabs/diffViewer/index.vue';
import NetDiagnostic from './tabs/netDiagnostic/index.vue';
import DateCalculator from './tabs/dateCalculator/index.vue';
import UnitConverter from './tabs/unitConverter/index.vue';
import { DEV_TOOL_CATALOG, type DevToolMeta } from './catalog';

/** 当前打开的工具 key（null = 仪表盘） */
const activeTool = ref<string | null>(null);

/** 当前工具的元信息（标题/描述），用于二级标题展示 */
const activeMeta = computed<DevToolMeta | undefined>(() =>
  DEV_TOOL_CATALOG.find((t) => t.key === activeTool.value)
);

/**
 * 打开某工具
 * @param key 工具唯一标识（来自 DEV_TOOL_CATALOG）
 */
function openTool(key: string): void {
  activeTool.value = key;
}

/** 返回仪表盘（清空当前工具状态） */
function backToDashboard(): void {
  activeTool.value = null;
}
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

/* 页头：标题区与返回按钮两端对齐 */
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-shrink: 0;
}
/* 区块标题：柔和渐变淡出下划线（与 pdfTools 一致的用户偏好） */
.page-title {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
  position: relative;
  display: inline-block;
  padding-bottom: 8px;
}
.page-title::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 120px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    var(--color-primary),
    color-mix(in srgb, var(--color-primary) 0%, transparent)
  );
}
.sub {
  margin: 6px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

/* 仪表盘：工具卡片网格（与 pdfTools 卡片区一致） */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  overflow: auto;
}

/* 二级标题：当前打开工具的名称与描述（与 pdfTools 一致） */
.tool-head {
  flex-shrink: 0;
  margin-bottom: -12px; /* 与下方操作提示条收紧间距（页面 gap 为 18px） */
}
.tool-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}
/* 标题左侧的竖向强调条，标识当前工具 */
.tool-title::before {
  content: '';
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--color-primary);
}
.tool-desc {
  margin: 4px 0 0 9px;
  color: var(--text-muted);
  font-size: 12px;
}

/* 内容区：工具态下撑满剩余高度（保留原有机制，子页面满高布局不变） */
.toolbox-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}
.toolbox-content > * {
  flex: 1;
  min-height: 0;
}
</style>
