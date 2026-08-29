<template>
  <div class="history-panel">
    <!-- 搜索 + 清空 -->
    <div class="history-toolbar">
      <el-input
        v-model="keyword"
        size="small"
        clearable
        placeholder="搜索历史 URL"
        @input="onSearch"
      >
        <template #prefix>
          <LucideIcon name="Search" :size="13" />
        </template>
      </el-input>
      <el-tooltip content="清空全部历史" placement="top">
        <el-button size="small" text type="danger" @click="onClear">
          <LucideIcon name="Trash2" :size="14" />
        </el-button>
      </el-tooltip>
    </div>

    <!-- 历史列表 -->
    <div class="history-list">
      <div
        v-for="item in items"
        :key="item.id"
        class="history-item"
        @click="emit('load', item.config)"
      >
        <span class="item-method" :class="'m-' + item.method.toLowerCase()">{{ item.method }}</span>
        <div class="item-main">
          <div class="item-url" :title="item.url">{{ item.url }}</div>
          <div class="item-meta">
            <span :class="item.status >= 200 && item.status < 400 ? 'meta-ok' : 'meta-err'">
              {{ item.status || '失败' }}
            </span>
            <span>{{ item.time }}ms</span>
            <span>{{ formatTs(item.createdAt) }}</span>
          </div>
        </div>
        <el-button
          class="item-delete"
          text
          size="small"
          type="danger"
          @click.stop="emit('delete', item.id)"
        >
          <LucideIcon name="X" :size="13" />
        </el-button>
      </div>
      <div v-if="!items.length" class="history-empty">暂无请求历史</div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 历史面板：搜索 / 清空 / 单条删除 / 点击回填请求
 * 列表数据由父组件传入（composables/useHistory 管理）
 */
import { ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { HistoryItem, RequestConfig } from '../../types'
import moment from 'moment'

/** 组件 props 定义 */
defineProps<{
  /** 历史列表 */
  items: HistoryItem[];
}>()

/** 事件：加载请求 / 删除单条 / 清空 / 搜索 */
const emit = defineEmits<{
  (e: 'load', config: RequestConfig): void
  (e: 'delete', id: number): void
  (e: 'clear'): void
  (e: 'search', keyword: string): void
}>()

/** 搜索关键字 */
const keyword = ref('')

/**
 * 搜索输入变化（防抖 300ms）
 */
let searchTimer: any = null
function onSearch(): void {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    emit('search', keyword.value.trim())
  }, 300)
}

/**
 * 清空历史（二次确认）
 */
function onClear(): void {
  ElMessageBox.confirm('确认清空全部请求历史？', '提示', { type: 'warning' })
    .then(() => emit('clear'))
    .catch(() => {})
}

/**
 * 时间戳格式化为短时间（今天显示 HH:mm，否则 MM-DD HH:mm）
 * @param ts 毫秒时间戳
 * @returns 短时间文本
 */
function formatTs(ts: number): string {
  return moment(ts).isSame(moment(), 'day')
    ? moment(ts).format('HH:mm')
    : moment(ts).format('MM-DD HH:mm')
}
</script>

<style scoped lang="scss">
.history-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.history-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}

.history-list {
  flex: 1;
  overflow: auto;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: var(--el-fill-color-light);

    .item-delete {
      opacity: 1;
    }
  }
}

// 方法徽标：等宽 + 按方法着色
.item-method {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.4px;
  width: 42px;
  text-align: center;
  padding: 1px 0;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  flex-shrink: 0;

  &.m-get {
    color: var(--el-color-success);
    background: var(--el-color-success-light-9);
  }
  &.m-post {
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
  }
  &.m-put {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
  &.m-delete {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
  }
  &.m-patch {
    color: var(--el-color-primary-light-3);
    background: var(--el-color-primary-light-9);
  }
  &.m-head,
  &.m-options {
    color: var(--el-color-info);
    background: var(--el-color-info-light-9);
  }
}

.item-main {
  flex: 1;
  min-width: 0;
}

.item-url {
  font-size: 12px;
  font-family: Consolas, Monaco, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;

  .meta-ok {
    color: var(--el-color-success);
  }
  .meta-err {
    color: var(--el-color-danger);
  }
}

.item-delete {
  opacity: 0;
  flex-shrink: 0;
}

.history-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}
</style>
