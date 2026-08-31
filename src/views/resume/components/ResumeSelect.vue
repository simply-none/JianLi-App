<template>
  <div class="resume-select">
    <!-- 标题 -->
    <span class="page-title">简历</span>

    <!-- 简历选择：el-popover 弹框，支持搜索 + 重命名/删除/新建/另存为 -->
    <el-popover
      v-model:visible="popVisible"
      placement="bottom-start"
      :width="300"
      trigger="click"
      popper-class="resume-select-popper"
    >
      <template #reference>
        <el-button size="small" class="select-trigger">
          <LucideIcon name="FileText" :size="14" />
          <span class="trigger-label">{{ activeName || '选择简历' }}</span>
          <LucideIcon name="ChevronDown" :size="13" class="caret" />
        </el-button>
      </template>

      <div class="rs-pop">
        <el-input
          v-model="search"
          size="small"
          placeholder="搜索简历名称"
          clearable
        >
          <template #prefix>
            <LucideIcon name="Search" :size="13" />
          </template>
        </el-input>

        <div class="rs-list">
          <div
            v-for="item in filtered"
            :key="item.id"
            class="rs-item"
            :class="{ 'is-active': item.id === activeId }"
            @click="onSelect(item)"
          >
            <LucideIcon v-if="item.id === activeId" name="Check" :size="13" class="rs-check" />
            <span class="rs-name">{{ item.name }}</span>
            <span class="rs-time">{{ formatTime(item.updatedAt) }}</span>
            <span class="rs-ops" @click.stop>
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
          <div v-if="filtered.length === 0" class="rs-empty">
            {{ records.length === 0 ? '暂无简历' : '无匹配的简历' }}
          </div>
        </div>

        <div class="rs-foot">
          <el-button size="small" @click="handleCreate">
            <LucideIcon name="FilePlus" :size="13" />
            <span>新建</span>
          </el-button>
          <el-button size="small" :disabled="!activeId" @click="handleSaveAs">
            <LucideIcon name="Copy" :size="13" />
            <span>另存为</span>
          </el-button>
        </div>
      </div>
    </el-popover>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import type { ResumeRecord } from '../types'

/**
 * 顶部简历选择器
 * 改用 el-popover 弹框（与「选择排版」一致）：支持按名称搜索、悬停条目可重命名/删除，
 * 底部提供新建/另存为。弹窗交互（输入名称/删除确认）在本组件完成，数据操作经事件交父组件执行。
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
  /** 另存为（复制当前简历，携带新名称） */
  (e: 'saveAs', name: string): void
}>()

/** 弹框显隐 */
const popVisible = ref(false)
/** 搜索关键字（按名称过滤） */
const search = ref('')

/** 触发按钮展示的当前简历名 */
const activeName = computed(
  () => props.records.find((r) => r.id === props.activeId)?.name || ''
)

/** 按搜索关键字过滤后的简历（名称包含匹配，大小写不敏感） */
const filtered = computed<ResumeRecord[]>(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return props.records
  return props.records.filter((r) => r.name.toLowerCase().includes(kw))
})

/**
 * 选中某项：通知父组件切换并收起弹框
 * @param item 目标记录
 */
function onSelect(item: ResumeRecord) {
  emit('select', item.id)
  popVisible.value = false
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

/**
 * 另存为：复制当前简历为新简历，弹窗输入新名称（默认「当前名 副本」）
 */
async function handleSaveAs() {
  try {
    const base = props.records.find((r) => r.id === props.activeId)?.name || '我的简历'
    const { value } = await ElMessageBox.prompt('请输入新简历名称', '另存为', {
      inputValue: `${base} 副本`,
      inputPlaceholder: '如：Java 后端岗 - 副本',
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空',
      confirmButtonText: '另存为',
      cancelButtonText: '取消',
    })
    emit('saveAs', value.trim())
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
  color: var(--text-primary);
  flex-shrink: 0;
}
.select-trigger {
  max-width: 220px;
}
.trigger-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.caret {
  flex-shrink: 0;
}
</style>

<!-- 弹框内容（el-popover 默认 teleport 到 body，scoped 样式无法命中，故用非 scoped） -->
<style>
.resume-select-popper .rs-pop {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.resume-select-popper .rs-list {
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 -4px;
  padding: 0 4px;
}
.resume-select-popper .rs-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
}
.resume-select-popper .rs-item:hover {
  background: var(--bg-hover);
}
/* 当前选中的简历：跟随主题主色高亮 */
.resume-select-popper .rs-item.is-active {
  background: var(--color-primary-light);
  color: var(--color-primary);
}
.resume-select-popper .rs-check {
  flex-shrink: 0;
  color: var(--color-primary);
}
.resume-select-popper .rs-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.resume-select-popper .rs-item.is-active .rs-name {
  font-weight: 600;
}
.resume-select-popper .rs-time {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.resume-select-popper .rs-ops {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.resume-select-popper .rs-empty {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 16px 0;
}
.resume-select-popper .rs-foot {
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--border-subtle);
  padding-top: 8px;
}
.resume-select-popper .icon-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: inherit;
  padding: 4px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
}
.resume-select-popper .icon-btn:hover {
  background: var(--bg-hover);
}
.resume-select-popper .icon-btn.is-danger:hover {
  color: var(--color-error);
}
</style>
