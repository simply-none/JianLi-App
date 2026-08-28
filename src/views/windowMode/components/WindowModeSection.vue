<template>
  <!-- 单个小窗的设置区块（原子组件）：标题 + 开关/应用 + 配置项列表 -->
  <section class="window-section">
    <h2 class="section-title">
      <LucideIcon :name="section.icon" :size="16" />
      {{ section.title }}
    </h2>

    <div class="toggle-card">
      <span class="toggle-label">小窗口状态</span>
      <div class="toggle-group">
        <el-button
          :type="visible ? 'primary' : 'default'"
          :plain="!visible"
          class="toggle-btn"
          @click="emit('toggle', true)"
        >
          <LucideIcon name="MonitorCheck" :size="14" />
          开启
        </el-button>
        <el-button
          :type="!visible ? 'primary' : 'default'"
          :plain="visible"
          class="toggle-btn"
          @click="emit('toggle', false)"
        >
          <LucideIcon name="MonitorX" :size="14" />
          关闭
        </el-button>
        <el-button type="primary" class="apply-btn" @click="emit('apply')">
          <LucideIcon name="MonitorCloud" :size="14" />
          应用
        </el-button>
      </div>
    </div>

    <div class="window-card">
      <WindowModeOptionGroup
        v-if="section.fields.position"
        label="位置选择"
        icon="MousePointerClick"
        variant="grid"
        :options="positionOptions"
        :custom-text="custom.position"
        @select="(v) => emit('select', { field: 'position', value: v })"
        @custom="emit('custom', 'position')"
      />

      <WindowModeOptionGroup
        v-if="section.fields.size"
        label="窗口尺寸"
        icon="MonitorCog"
        :options="sizeOptions"
        :custom-text="custom.size"
        @select="(v) => emit('select', { field: 'size', value: v })"
        @custom="emit('custom', 'size')"
      />

      <WindowModeOptionGroup
        v-if="section.fields.gap"
        label="边缘间隙"
        icon="UnfoldVertical"
        :options="gapOptions"
        :custom-text="custom.gap"
        @select="(v) => emit('select', { field: 'gap', value: v })"
        @custom="emit('custom', 'gap')"
      />

      <WindowModeOptionGroup
        v-if="section.fields.skin && section.skinOptions?.length"
        label="皮肤主题"
        icon="PaintbrushVertical"
        :options="skinOptions"
        scrollable
        @select="(v) => emit('select', { field: 'skin', value: v })"
      />

      <WindowModeOptionGroup
        v-if="section.fields.layout && section.layoutOptions?.length"
        label="排版样式"
        icon="LayoutDashboard"
        :options="layoutOptions"
        @select="(v) => emit('select', { field: 'layout', value: v })"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import WindowModeOptionGroup from './WindowModeOptionGroup.vue'
import {
  GAP_OPTIONS,
  POSITION_OPTIONS,
  type WindowConfig,
  type WindowSection,
} from '../config/windowSections'

const props = defineProps<{
  section: WindowSection
  config: WindowConfig
  /** 当前小窗是否已开启 */
  visible: boolean
  /** 各配置项的自定义值展示文本 */
  custom: { position: string; size: string; gap: string }
}>()

const emit = defineEmits<{
  (e: 'toggle', value: boolean): void
  (e: 'apply'): void
  (
    e: 'select',
    payload: { field: 'position' | 'size' | 'gap' | 'skin' | 'layout'; value: any }
  ): void
  (e: 'custom', type: 'position' | 'size' | 'gap'): void
}>()

// 候选项的选中态由当前配置实时计算
const positionOptions = computed(() =>
  POSITION_OPTIONS.map((opt) => ({ ...opt, active: props.config.position === opt.value }))
)

const sizeOptions = computed(() =>
  props.section.sizeOptions.map((size) => ({
    label: size.label,
    value: { width: size.width, height: size.height },
    active: props.config.width === size.width && props.config.height === size.height,
  }))
)

const gapOptions = computed(() =>
  GAP_OPTIONS.map((gap) => ({ label: `${gap}px`, value: gap, active: props.config.gap === gap }))
)

const skinOptions = computed(() =>
  (props.section.skinOptions ?? []).map((opt) => ({ ...opt, active: props.config.skin === opt.value }))
)

const layoutOptions = computed(() =>
  (props.section.layoutOptions ?? []).map((opt) => ({
    ...opt,
    active: props.config.layout === opt.value,
  }))
)
</script>

<style scoped lang="scss">
// 紧凑排布的按钮组：去掉 element-plus 默认的相邻按钮间距
:deep(.el-button + .el-button) {
  margin-left: 0;
}

.window-section {
  margin-bottom: 26px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 14px;
  padding-bottom: 10px;
  background: linear-gradient(90deg, var(--color-primary), transparent) no-repeat left bottom / 100% 1px;
}

.toggle-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 14px 18px;
  margin-bottom: 14px;

  .toggle-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .toggle-group {
    display: flex;
    gap: 8px;

    .toggle-btn,
    .apply-btn {
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 13px;
    }

    .apply-btn {
      font-weight: 500;
    }
  }
}

.window-card {
  position: relative;
  overflow: hidden;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 18px;

  // 左侧主色渐变条：保留原设计的视觉锚点
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, var(--color-primary), var(--color-primary) 50%, rgba(0, 0, 0, 0.1));
  }
}
</style>
