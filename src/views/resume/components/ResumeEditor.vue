<template>
  <div class="resume-editor">
    <el-collapse v-model="activeSections" class="editor-collapse">
      <!-- 基本信息 -->
      <el-collapse-item name="basics">
        <template #title>
          <span class="sec-head"><LucideIcon name="UserRound" :size="14" />基本信息</span>
        </template>
        <BasicInfoForm :basics="data.basics" @update:basics="patch({ basics: $event })" />
      </el-collapse-item>

      <!-- 教育背景 -->
      <el-collapse-item name="education">
        <template #title>
          <span class="sec-head"><LucideIcon name="GraduationCap" :size="14" />教育背景</span>
        </template>
        <ListSectionEditor
          title="教育经历"
          main-key="school"
          :fields="EDU_FIELDS"
          :items="data.education"
          @update:items="patch({ education: $event })"
        />
      </el-collapse-item>

      <!-- 工作经历 -->
      <el-collapse-item name="work">
        <template #title>
          <span class="sec-head"><LucideIcon name="Briefcase" :size="14" />工作经历</span>
        </template>
        <ListSectionEditor
          title="工作经历"
          main-key="company"
          :fields="WORK_FIELDS"
          :items="data.work"
          @update:items="patch({ work: $event })"
        />
      </el-collapse-item>

      <!-- 项目经验 -->
      <el-collapse-item name="project">
        <template #title>
          <span class="sec-head"><LucideIcon name="FolderKanban" :size="14" />项目经验</span>
        </template>
        <ListSectionEditor
          title="项目"
          main-key="name"
          :fields="PROJ_FIELDS"
          :items="data.project"
          @update:items="patch({ project: $event })"
        />
      </el-collapse-item>

      <!-- 技能特长 -->
      <el-collapse-item name="skills">
        <template #title>
          <span class="sec-head"><LucideIcon name="Sparkles" :size="14" />技能特长</span>
        </template>
        <SkillsEditor :skills="data.skills" @update:skills="patch({ skills: $event })" />
      </el-collapse-item>

      <!-- 自我评价 -->
      <el-collapse-item name="evaluation">
        <template #title>
          <span class="sec-head"><LucideIcon name="Quote" :size="14" />自我评价</span>
        </template>
        <EvaluationEditor :evaluation="data.evaluation" @update:evaluation="patch({ evaluation: $event })" />
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import BasicInfoForm from './editor/BasicInfoForm.vue'
import ListSectionEditor, { type FieldDef } from './editor/ListSectionEditor.vue'
import SkillsEditor from './editor/SkillsEditor.vue'
import EvaluationEditor from './editor/EvaluationEditor.vue'
import type { ResumeData } from '../types'

/**
 * 简历内容编辑器容器
 * 按章节折叠分块（基本信息/教育/工作/项目/技能/自评），
 * 各子编辑器不可变更新对应字段后经 update:data 整体上报父组件。
 */
const props = defineProps<{
  /** 简历数据 */
  data: ResumeData
}>()

const emit = defineEmits<{
  /** 数据变更时触发，携带整份最新数据 */
  (e: 'update:data', value: ResumeData): void
}>()

/** 默认展开的章节 */
const activeSections = ref<string[]>(['basics', 'work'])

/** 教育背景字段定义 */
const EDU_FIELDS: FieldDef[] = [
  { key: 'school', label: '学校', placeholder: 'XX大学', span: 12 },
  { key: 'degree', label: '学历', placeholder: '本科', span: 12 },
  { key: 'major', label: '专业', placeholder: '计算机科学与技术', span: 12 },
  { key: 'startTime', label: '开始', placeholder: '2020.09', span: 6 },
  { key: 'endTime', label: '结束', placeholder: '2024.06', span: 6 },
  { key: 'description', label: '描述', type: 'textarea', placeholder: '主修课程、绩点、荣誉等，每行一条', span: 24, rows: 3 },
]

/** 工作经历字段定义 */
const WORK_FIELDS: FieldDef[] = [
  { key: 'company', label: '公司', placeholder: 'XX科技有限公司', span: 12 },
  { key: 'position', label: '职位', placeholder: '前端开发工程师', span: 12 },
  { key: 'startTime', label: '开始', placeholder: '2024.07', span: 6 },
  { key: 'endTime', label: '结束', placeholder: '至今', span: 6 },
  { key: 'description', label: '内容', type: 'textarea', placeholder: '工作职责与业绩，每行一条会转为圆点列表', span: 24, rows: 4 },
]

/** 项目经验字段定义 */
const PROJ_FIELDS: FieldDef[] = [
  { key: 'name', label: '项目', placeholder: 'XX系统', span: 12 },
  { key: 'role', label: '角色', placeholder: '核心开发', span: 12 },
  { key: 'startTime', label: '开始', placeholder: '2024.08', span: 6 },
  { key: 'endTime', label: '结束', placeholder: '至今', span: 6 },
  { key: 'description', label: '描述', type: 'textarea', placeholder: '项目职责与技术产出，每行一条会转为圆点列表', span: 24, rows: 4 },
]

/**
 * 局部更新简历数据（不可变合并后整体上报）
 * @param partial 变更的字段
 */
function patch(partial: Partial<ResumeData>) {
  emit('update:data', { ...props.data, ...partial })
}
</script>

<style scoped>
.resume-editor {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 10px 14px;
}
.editor-collapse :deep(.el-collapse-item__header) {
  height: 40px;
  background: transparent;
}
.sec-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--skin-text-primary, #333);
}
</style>
