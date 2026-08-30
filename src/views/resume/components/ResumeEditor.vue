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

      <!-- 自定义模块（动态，行级自由结构） -->
      <el-collapse-item v-for="sec in customSections" :key="`c-${sec.id}`" :name="`custom:${sec.id}`">
        <template #title>
          <span class="sec-head">
            <LucideIcon name="Layers" :size="14" />
            <span class="custom-name">{{ sec.title || '未命名模块' }}</span>
            <span class="custom-badge">自定义</span>
          </span>
        </template>
        <!-- 模块管理行：改名 + 删除 -->
        <div class="custom-toolbar">
          <el-input
            :model-value="sec.title"
            size="small"
            class="custom-title-input"
            maxlength="20"
            placeholder="模块标题"
            @update:model-value="renameCustom(sec, $event)"
          >
            <template #prepend>标题</template>
          </el-input>
          <el-button size="small" type="danger" plain @click="removeCustom(sec)">
            <LucideIcon name="Trash2" :size="13" />
            <span>删除模块</span>
          </el-button>
        </div>
        <!-- 行结构编辑器（行 = 内容块集合；支持模板保存/加载） -->
        <CustomRowsEditor :section="sec" @update:section="updateCustom(sec, $event)" />
      </el-collapse-item>
    </el-collapse>

    <!-- 添加自定义模块 -->
    <div class="add-custom-row">
      <span class="add-label">添加自定义模块</span>
      <el-button plain size="small" @click="addCustom">
        <LucideIcon name="Plus" :size="13" />
        <span>自定义模块</span>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import BasicInfoForm from './editor/BasicInfoForm.vue'
import ListSectionEditor, { type FieldDef } from './editor/ListSectionEditor.vue'
import SkillsEditor from './editor/SkillsEditor.vue'
import EvaluationEditor from './editor/EvaluationEditor.vue'
import CustomRowsEditor from './editor/CustomRowsEditor.vue'
import type { CustomSectionData, ResumeData } from '../types'

/**
 * 简历内容编辑器容器
 * 按章节折叠分块（基本信息/教育/工作/项目/技能/自评 + 动态自定义模块），
 * 各子编辑器不可变更新对应字段后经 update:data 整体上报父组件；
 * 自定义模块的 添加/删除 经专用事件交父组件同步排版层。
 */
const props = defineProps<{
  /** 简历数据 */
  data: ResumeData
}>()

const emit = defineEmits<{
  /** 数据变更时触发，携带整份最新数据 */
  (e: 'update:data', value: ResumeData): void
  /** 添加自定义模块（父组件同步注入排版配置） */
  (e: 'add-custom', sec: CustomSectionData): void
  /** 删除自定义模块（父组件同步清理排版配置） */
  (e: 'remove-custom', id: string): void
}>()

/** 默认展开的章节 */
const activeSections = ref<string[]>(['basics', 'work'])

/** 自定义模块列表（数据缺省时按空数组） */
const customSections = computed<CustomSectionData[]>(() => props.data.customSections || [])

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

/**
 * 替换自定义模块列表
 * @param list 最新列表
 */
function patchCustom(list: CustomSectionData[]) {
  patch({ customSections: list })
}

/**
 * 更新指定自定义模块结构（行结构编辑器上报）
 * @param sec 目标模块
 * @param value 最新结构
 */
function updateCustom(sec: CustomSectionData, value: CustomSectionData) {
  patchCustom(customSections.value.map((s) => (s.id === sec.id ? value : s)))
}

/**
 * 自定义模块改名（同步数据层 title，排版层由父组件 onDataChange 联动）
 * @param sec 目标模块
 * @param value 新标题
 */
function renameCustom(sec: CustomSectionData, value: string) {
  patchCustom(customSections.value.map((s) => (s.id === sec.id ? { ...s, title: value } : s)))
}

/**
 * 删除自定义模块（二次确认后交父组件同步清理数据与排版）
 * @param sec 目标模块
 */
async function removeCustom(sec: CustomSectionData) {
  try {
    await ElMessageBox.confirm(`确定删除自定义模块「${sec.title}」？其内容与排版配置将一并移除。`, '删除模块', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    emit('remove-custom', sec.id)
  } catch {
    /* 用户取消，不处理 */
  }
}

/**
 * 生成自定义模块 id
 * @returns 如 c1abc2def3
 */
function genCustomId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * 添加自定义模块（弹窗输入标题，交父组件同步数据与排版；初始为一条空行）
 */
async function addCustom() {
  try {
    const { value } = await ElMessageBox.prompt('请输入模块标题', '添加自定义模块', {
      inputPlaceholder: '如 获奖荣誉 / 兴趣爱好 / 语言能力',
      inputPattern: /\S+/,
      inputErrorMessage: '标题不能为空',
      confirmButtonText: '添加',
      cancelButtonText: '取消',
    })
    const sec: CustomSectionData = {
      id: genCustomId(),
      title: value.trim(),
      rows: [{ id: genCustomId(), blocks: [] }],
    }
    emit('add-custom', sec)
    // 新模块自动展开
    const name = `custom:${sec.id}`
    if (!activeSections.value.includes(name)) activeSections.value.push(name)
  } catch {
    /* 用户取消，不处理 */
  }
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
.custom-name {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.custom-badge {
  font-size: 10px;
  font-weight: 400;
  color: #999;
  border: 1px solid var(--skin-border, #e4e4e7);
  border-radius: 4px;
  padding: 0 4px;
  line-height: 16px;
}
.custom-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.custom-title-input {
  flex: 1;
}
.add-custom-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 2px 2px;
}
.add-label {
  font-size: 12px;
  color: #999;
}
.add-custom-row :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
