<template>
  <div class="extract-editor">
    <!-- 作用域切换：点击记录字段/各提取项容器，下方展示对应字段规则设置区 -->
    <div class="scope-tabs">
      <div
        class="scope-chip"
        :class="{ active: selected === 'record' }"
        title="记录级字段规则（每个记录容器产出一条记录）"
        @click="selected = 'record'"
      >
        记录字段{{ config.itemSelector ? '（容器内）' : '（整页）' }}
      </div>
      <div
        v-for="(g, i) in groupList"
        :key="i"
        class="scope-chip"
        :class="{ active: selected === i }"
        :title="`提取项容器：${g.selector || '未设置选择器'}`"
        @click="selected = i"
      >
        {{ g.name || `未命名容器 ${i + 1}` }}
      </div>
      <el-button size="small" text type="primary" title="新增一个提取项容器（可选）" @click="addGroup">
        + 提取项容器
      </el-button>
    </div>

    <!-- 字段规则设置/查看区（默认展示第一个作用域：记录字段） -->
    <div v-if="selected === 'record'" class="scope-body">
      <RuleEditor :rules="config.rules" :item-mode="!!config.itemSelector" />
    </div>
    <div v-else-if="currentGroup" class="scope-body">
      <el-form label-width="92px" size="small" class="group-form">
        <el-form-item label="组名">
          <el-input v-model="currentGroup.name" placeholder="结果中的字段名，如 相关新闻" class="narrow" />
        </el-form-item>
        <el-form-item label="项容器">
          <el-input
            v-model="currentGroup.selector"
            placeholder="项容器选择器，命中多个元素，每个元素产出一项（返回全部子项）"
            title="在记录容器（或整页）内匹配多个元素"
          />
        </el-form-item>
        <el-form-item label=" ">
          <el-button size="small" text type="danger" @click="removeGroup(selected as number)">
            删除此提取项容器
          </el-button>
        </el-form-item>
      </el-form>
      <RuleEditor :rules="currentGroup.rules" :item-mode="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 提取结果编辑器
 * ------------------------------------------------------------------
 * 步骤③提取结果的配置区：
 * - 顶部作用域芯片：记录字段 + 各提取项容器组，点击切换，默认展示第一个
 * - 记录字段：记录级字段规则（RuleEditor）
 * - 提取项容器（可选，可多个）：组名 + 项容器选择器 + 项内字段规则；
 *   每条记录中该项容器的命中子项以数组返回（全部子项，而非第一个）
 */
import { ref, computed } from 'vue'
import type { ScrapeConfig } from '../../types'
import { createEmptyGroup } from '../../config/defaults'
import RuleEditor from './RuleEditor.vue'

/** 组件属性（引用透传，原地修改） */
const props = defineProps<{
  /** 任务配置对象 */
  config: ScrapeConfig;
}>()

/** 当前选中的作用域：'record' 记录字段 / 数字为提取项容器组下标 */
const selected = ref<'record' | number>('record')

/** 提取项容器组列表（旧任务无 groups 字段时按空数组兜底） */
const groupList = computed(() => {
  if (!props.config.groups) props.config.groups = []
  return props.config.groups
})

/** 当前选中的提取项容器组（未选中组时为 null） */
const currentGroup = computed(() =>
  typeof selected.value === 'number' ? groupList.value[selected.value] || null : null
)

/**
 * 新增一个提取项容器组并选中它
 */
function addGroup(): void {
  groupList.value.push(createEmptyGroup())
  selected.value = groupList.value.length - 1
}

/**
 * 删除指定下标的提取项容器组，选中区回到记录字段
 * @param index 组下标
 */
function removeGroup(index: number): void {
  groupList.value.splice(index, 1)
  selected.value = 'record'
}
</script>

<style scoped>
.extract-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.scope-tabs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.scope-chip {
  padding: 3px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  color: var(--text-secondary);
}
.scope-chip:hover {
  border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
}
.scope-chip.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}
.scope-body {
  padding: 8px 0 0;
}
.group-form {
  max-width: 720px;
}
.narrow {
  width: 260px;
}
</style>
