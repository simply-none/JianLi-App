<template>
  <div class="basic-info-form">
    <el-form :model="form" label-width="72px" size="default" @submit.prevent>
      <el-row :gutter="12">
        <el-col :span="8">
          <el-form-item label="姓名">
            <el-input v-model="form.name" placeholder="张三" maxlength="20" />
          </el-form-item>
        </el-col>
        <el-col :span="16">
          <el-form-item label="求职意向">
            <el-input v-model="form.jobIntent" placeholder="前端开发工程师" maxlength="30" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="电话">
            <el-input v-model="form.phone" placeholder="138****0000" maxlength="20" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="邮箱">
            <el-input v-model="form.email" placeholder="example@mail.com" maxlength="50" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="12">
        <el-col :span="8">
          <el-form-item label="性别">
            <el-input v-model="form.gender" placeholder="男 / 女" maxlength="4" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="年龄">
            <el-input v-model="form.age" placeholder="24" maxlength="6" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="城市">
            <el-input v-model="form.city" placeholder="北京" maxlength="20" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { ResumeBasics } from '../../types'

/**
 * 基本信息编辑表单
 * 通过 v-model:basics 与父组件双向绑定 ResumeBasics 对象。
 */
const props = defineProps<{
  /** 基本信息对象 */
  basics: ResumeBasics
}>()

const emit = defineEmits<{
  /** 基本信息变更时触发，携带最新副本 */
  (e: 'update:basics', value: ResumeBasics): void
}>()

/** 本地表单副本（避免直接改 props） */
const form = reactive<ResumeBasics>({ ...props.basics })

// 同步父级 → 本地（切换简历时刷新）
watch(
  () => props.basics,
  (v) => Object.assign(form, v),
  { deep: true }
)

// 本地变更 → 通知父级
watch(
  form,
  () => emit('update:basics', { ...form }),
  { deep: true }
)
</script>

<style scoped>
.basic-info-form {
  padding-top: 24px;
}
.basic-info-form :deep(.el-form-item) {
  margin-bottom: 10px;
}
</style>
