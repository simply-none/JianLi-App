<template>
  <div class="resume-select">
    <!-- 标题 -->
    <span class="page-title">简历</span>

    <!-- 简历选择框：切换 + 悬停操作（重命名/删除） -->
    <el-select
      :model-value="activeId"
      class="select"
      placeholder="选择简历"
      :popper-class="'resume-select-popper'"
      @change="$emit('select', $event as number)"
    >
      <template #label="{ value }">
        <span class="select-label">{{ labelOf(value as number) }}</span>
      </template>
      <el-option v-for="item in records" :key="item.id" :value="item.id" :label="item.name">
        <div class="option-row">
          <span class="opt-name">{{ item.name }}</span>
          <span class="opt-time">{{ formatTime(item.updatedAt) }}</span>
          <span class="opt-ops" @click.stop>
            <el-tooltip content="重命名" placement="top">
              <button class="icon-btn" @click="handleRename(item)">
                <LucideIcon name="Pencil" :size="13" />
              </button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <button class="icon-btn is-danger" @click="handleDelete(item)">
                <LucideIcon name="Trash2" :size="13" />
              </button>
            </el-tooltip>
          </span>
        </div>
      </el-option>
    </el-select>

    <!-- 新建 -->
    <el-tooltip content="新建简历" placement="top">
      <button class="icon-btn" @click="handleCreate">
        <LucideIcon name="FilePlus" :size="15" />
      </button>
    </el-tooltip>
  </div>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import type { ResumeRecord } from '../types'

/**
 * 顶部简历选择器
 * 以下拉框替代原左侧列表：切换选中、悬停条目可重命名/删除，尾部新建按钮。
 * 弹窗交互（输入名称/删除确认）在本组件完成，数据操作经事件交父组件执行。
 */
const props = defineProps<{
  /** 全部简历记录（按更新时间倒序） */
  records: ResumeRecord[]
  /** 当前选中 id */
  activeId: number | null
}>()

const emit = defineEmits<{
  /** 选中切换 */
  (e: 'select', id: number): void
  /** 新建（携带输入的名称） */
  (e: 'create', name: string): void
  /** 重命名 */
  (e: 'rename', id: number, name: string): void
  /** 删除 */
  (e: 'remove', id: number): void
}>()

/**
 * 按已选 id 取显示名称（用于选择框收起态标签）
 * @param id 记录 id
 * @returns 简历名称；未命中返回空串
 */
function labelOf(id: number): string {
  return props.records.find((r) => r.id === id)?.name || ''
}

/**
 * 格式化更新时间为简短展示
 * @param ts 时间戳（ms）
 * @returns 如 2026-08-30 16:20
 */
function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * 新建简历：弹窗输入名称（必填）
 */
async function handleCreate() {
  try {
    const { value } = await ElMessageBox.prompt('请输入简历名称', '新建简历', {
      inputValue: '',
      inputPlaceholder: '如：Java 后端岗',
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空',
      confirmButtonText: '创建',
      cancelButtonText: '取消',
    })
    emit('create', value.trim())
  } catch {
    /* 用户取消，不处理 */
  }
}

/**
 * 重命名简历
 * @param item 目标记录
 */
async function handleRename(item: ResumeRecord) {
  try {
    const { value } = await ElMessageBox.prompt('请输入新名称', '重命名简历', {
      inputValue: item.name,
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
    })
    const name = value.trim()
    if (name === item.name) return
    emit('rename', item.id, name)
  } catch {
    /* 用户取消，不处理 */
  }
}

/**
 * 删除简历（二次确认）
 * @param item 目标记录
 */
async function handleDelete(item: ResumeRecord) {
  try {
    await ElMessageBox.confirm(`确定删除「${item.name}」？该操作不可恢复。`, '删除简历', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    emit('remove', item.id)
  } catch {
    /* 用户取消，不处理 */
  }
}
</script>

<style scoped>
.resume-select {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.page-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--skin-text-primary, #333);
  flex-shrink: 0;
}
.select {
  width: 220px;
}
.select-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.opt-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.opt-time {
  font-size: 11px;
  color: #999;
  flex-shrink: 0;
}
.opt-ops {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}
.option-row:hover .opt-ops {
  opacity: 1;
}
.icon-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: inherit;
  padding: 4px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
}
.icon-btn:hover {
  background: var(--skin-border, #e4e4e7);
}
.icon-btn.is-danger:hover {
  color: #e34d59;
}
</style>
