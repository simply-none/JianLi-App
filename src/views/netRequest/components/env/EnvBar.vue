<template>
  <div class="env-bar">
    <el-select
      :model-value="activeId"
      size="small"
      class="env-select"
      placeholder="无环境"
      clearable
      @update:model-value="onSelect"
    >
      <el-option
        v-for="env in envs"
        :key="env.id"
        :label="env.name"
        :value="env.id"
      >
        <span>{{ env.name }}</span>
        <span class="env-var-count">{{ env.vars.length }} 个变量</span>
      </el-option>
    </el-select>
    <el-button size="small" text type="primary" @click="visible = true">
      <LucideIcon name="Settings" :size="14" />
      管理环境
    </el-button>

    <!-- 环境管理弹窗 -->
    <EnvDialog v-model="visible" :envs="envs" />
  </div>
</template>

<script setup lang="ts">
/**
 * 环境切换条：选择当前激活环境 + 打开环境管理弹窗
 * 环境变量用于 {{变量名}} 占位替换
 */
import { computed, ref } from 'vue'
import EnvDialog from './EnvDialog.vue'
import type { Environment } from '../../types'

/** 组件 props 定义 */
const props = defineProps<{
  /** 环境列表 */
  envs: Environment[];
}>()

/** 切换环境事件 */
const emit = defineEmits<{
  (e: 'select', id: number): void
}>()

/** 管理弹窗可见性 */
const visible = ref(false)

/** 当前激活环境 id */
const activeId = computed(() => props.envs.find((e) => e.isActive)?.id || 0)

/**
 * 选择环境（清空选择 = 不使用环境）
 * @param id 环境 id（0/undefined = 取消激活）
 */
function onSelect(id: number | undefined): void {
  if (id) {
    emit('select', id)
  }
}
</script>

<style scoped lang="scss">
.env-bar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.env-select {
  width: 160px;
}

.env-var-count {
  float: right;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
