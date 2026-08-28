<template>
  <!-- 单个配置项（原子组件）：标签 + 预设按钮组 + 自定义按钮 -->
  <div class="config-section">
    <div class="config-label">
      <LucideIcon :name="icon" :size="16" />
      {{ label }}
    </div>

    <!-- 位置选择：九宫格 -->
    <div v-if="variant === 'grid'" class="position-wrapper">
      <div class="position-grid">
        <el-button
          v-for="opt in options"
          :key="String(opt.value)"
          :type="opt.active ? 'primary' : 'default'"
          :plain="!opt.active"
          class="position-card"
          @click="$emit('select', opt.value)"
        >
          {{ opt.label }}
        </el-button>
      </div>
      <el-button type="default" plain class="custom-btn" @click="$emit('custom')">
        <LucideIcon name="Columns3Cog" :size="14" />
        自定义
        <span v-if="customText" class="custom-value">{{ customText }}</span>
      </el-button>
    </div>

    <!-- 尺寸 / 间隙 / 皮肤 / 排版：横排按钮 -->
    <div v-else class="option-row" :class="{ 'is-scroll': scrollable }">
      <el-button
        v-for="opt in options"
        :key="String(opt.value)"
        :type="opt.active ? 'primary' : 'default'"
        :plain="!opt.active"
        class="config-option"
        @click="$emit('select', opt.value)"
      >
        {{ opt.label }}
      </el-button>
      <el-button type="default" plain class="config-option custom-option" @click="$emit('custom')">
        <LucideIcon name="Columns3Cog" :size="14" />
        自定义
        <span v-if="customText" class="custom-value">{{ customText }}</span>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue'

defineProps<{
  /** 配置项名称 */
  label: string
  /** LucideIcon 图标名 */
  icon: string
  /** 预设候选项，active 由父级按当前配置计算 */
  options: { label: string; value: any; active: boolean }[]
  /** 当前为自定义值时的展示文本，为空表示用的是预设值 */
  customText?: string
  /** grid 用于位置九宫格，row 用于普通横排 */
  variant?: 'row' | 'grid'
  /** 候选项较多时限制高度并滚动（如皮肤列表） */
  scrollable?: boolean
}>()

defineEmits<{
  (e: 'select', value: any): void
  (e: 'custom'): void
}>()
</script>

<style scoped lang="scss">
// 紧凑排布的按钮组：去掉 element-plus 默认的相邻按钮间距
:deep(.el-button + .el-button) {
  margin-left: 0;
}

.config-section {
  margin-bottom: 18px;

  &:last-child {
    margin-bottom: 0;
  }
}

.config-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.position-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.position-grid {
  display: grid;
  grid-template-columns: repeat(3, 36px);
  gap: 6px;
}

.position-card {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  border-radius: 8px;
  padding: 0;
}

.option-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  // 皮肤等候选较多的组：限高滚动，避免单个区块过长
  &.is-scroll {
    max-height: 116px;
    overflow-y: auto;
  }
}

.config-option {
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;

  &.custom-option {
    color: var(--color-primary);
  }
}

.custom-btn {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  white-space: nowrap;
}

.custom-value {
  margin-left: 4px;
  font-size: 12px;
  opacity: 0.75;
  font-weight: 400;
}
</style>
