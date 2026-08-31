<template>
  <div class="skills-editor">
    <div v-for="(item, idx) in skills" :key="idx" class="skill-row">
      <el-input
        :model-value="item.name"
        class="skill-input"
        placeholder="技能名称，如 Vue3 / SQL"
        maxlength="30"
        @update:model-value="setName(idx, $event)"
      />
      <el-rate
        :model-value="item.level"
        :max="5"
        class="skill-rate"
        @update:model-value="setLevel(idx, Number($event))"
      />
      <el-button text size="small" type="danger" @click="remove(idx)">
        <LucideIcon name="Trash2" :size="14" />
      </el-button>
    </div>
    <div v-if="skills.length === 0" class="empty-tip">暂无技能，点击下方按钮添加</div>
    <el-button class="add-btn" plain size="small" @click="addItem">
      <LucideIcon name="Plus" :size="14" />
      <span>添加技能</span>
    </el-button>
  </div>
</template>

<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue'
import type { ResumeSkillItem } from '../../types'

/**
 * 技能特长编辑器
 * 每行：技能名称输入 + 熟练度星级（1-5）+ 删除按钮。
 * 通过 v-model:skills 与父组件双向绑定。
 */
const props = defineProps<{
  /** 技能列表 */
  skills: ResumeSkillItem[]
}>()

const emit = defineEmits<{
  /** 技能列表变更时触发 */
  (e: 'update:skills', value: ResumeSkillItem[]): void
}>()

/**
 * 更新指定技能名称
 * @param idx 下标
 * @param name 新名称
 */
function setName(idx: number, name: string) {
  emit('update:skills', props.skills.map((s, i) => (i === idx ? { ...s, name } : s)))
}

/**
 * 更新指定技能熟练度（限制 1-5）
 * @param idx 下标
 * @param level 新熟练度
 */
function setLevel(idx: number, level: number) {
  const lv = Math.max(1, Math.min(5, level || 3))
  emit('update:skills', props.skills.map((s, i) => (i === idx ? { ...s, level: lv } : s)))
}

/**
 * 删除技能
 * @param idx 下标
 */
function remove(idx: number) {
  emit('update:skills', props.skills.filter((_, i) => i !== idx))
}

/** 添加一条空技能（默认熟练度 3） */
function addItem() {
  emit('update:skills', [...props.skills, { name: '', level: 3 }])
}
</script>

<style scoped>
.skill-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.skill-input {
  flex: 1;
  max-width: 260px;
}
.skill-rate {
  flex-shrink: 0;
}
.empty-tip {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  padding: 12px 0;
}
.add-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
</style>
