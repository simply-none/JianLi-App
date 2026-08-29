<template>
  <div v-if="record" class="response-tabs-wrap">
    <!-- 状态条 + 操作 -->
    <div class="response-head">
      <ResponseStatusBar :record="record" />
      <ResponseActions :record="record" @save-note="noteVisible = true" />
    </div>
    <!-- 响应页签 -->
    <el-tabs v-model="activeTab" class="response-tabs">
      <el-tab-pane label="Body" name="body">
        <!-- JSON 树 / 纯文本切换 -->
        <div v-if="record.isJson" class="body-mode-bar">
          <el-radio-group v-model="bodyMode" size="small">
            <el-radio-button value="tree">树形</el-radio-button>
            <el-radio-button value="raw">原始</el-radio-button>
          </el-radio-group>
        </div>
        <div class="body-content">
          <JsonViewer v-if="record.isJson && bodyMode === 'tree'" :body="record.body" />
          <div v-else class="body-raw">{{ rawBodyText }}</div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="Headers" name="headers">
        <HeadersTable :headers="record.headers" />
      </el-tab-pane>
      <el-tab-pane :label="'请求信息'" name="info">
        <div class="request-info">
          <div class="info-row">
            <span class="info-label">请求地址</span>
            <span class="info-value">{{ record.requestUrl }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">完成时间</span>
            <span class="info-value">{{ formatTime(record.createdAt) }}</span>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>

  <!-- 空态 -->
  <div v-else class="response-empty">
    <LucideIcon name="Globe" :size="36" />
    <div class="empty-text">输入 URL 并点击「发送」查看响应</div>
  </div>

  <!-- 保存响应到笔记 -->
  <SaveResponseToNoteDialog v-model="noteVisible" :record="record" :preset-content="noteMarkdown" />
</template>

<script setup lang="ts">
/**
 * 响应区容器：状态条 + Body/Headers/请求信息页签 + 空态
 * Body 默认按响应类型选择展示方式（JSON → 树形，其余 → 原始文本）
 */
import { computed, ref } from 'vue'
import ResponseStatusBar from './ResponseStatusBar.vue'
import ResponseActions from './ResponseActions.vue'
import HeadersTable from './HeadersTable.vue'
import JsonViewer from './JsonViewer.vue'
import SaveResponseToNoteDialog from './SaveResponseToNoteDialog.vue'
import type { ResponseRecord } from '../../types'
import { copyAsCurl } from '../../composables/useRequest'
import moment from 'moment'

/** 组件 props 定义 */
const props = defineProps<{
  /** 响应记录（null = 空态） */
  record: ResponseRecord | null;
}>()

/** 当前响应页签 */
const activeTab = ref('body')

/** Body 展示模式：tree=JSON 树，raw=原始文本 */
const bodyMode = ref<'tree' | 'raw'>('tree')

/** 笔记对话框显隐 */
const noteVisible = ref(false)

/** 存入笔记的预填 Markdown（请求摘要 + cURL + 响应体） */
const noteMarkdown = computed(() => {
  const r = props.record
  if (!r) return ''
  const sizeText = r.size >= 1024 ? (r.size / 1024).toFixed(1) + ' KB' : r.size + ' B'
  const bodyText = typeof r.body === 'object' ? JSON.stringify(r.body, null, 2) : String(r.body ?? '')
  const lang = r.isJson ? 'json' : 'text'
  return [
    `## ${r.requestUrl}`,
    '',
    `- 状态：${r.status} ${r.statusText || ''}`.trimEnd(),
    `- 耗时：${r.time} ms`,
    `- 大小：${sizeText}`,
    `- 时间：${moment(r.createdAt).format('YYYY-MM-DD HH:mm:ss')}`,
    '',
    '### cURL',
    '',
    '```bash',
    copyAsCurl(),
    '```',
    '',
    '### 响应体',
    '',
    '```' + lang,
    bodyText.length > 20000 ? bodyText.slice(0, 20000) + '\n...(过长已截断)' : bodyText,
    '```',
    '',
  ].join('\n')
})

/** 原始响应文本（JSON 格式化后展示） */
const rawBodyText = computed(() => {
  if (!props.record) return ''
  const body = props.record.body
  return typeof body === 'object' ? JSON.stringify(body, null, 2) : String(body ?? '')
})

/**
 * 格式化时间戳为本地时间
 * @param ts 毫秒时间戳
 * @returns YYYY-MM-DD HH:mm:ss
 */
function formatTime(ts: number): string {
  return moment(ts).format('YYYY-MM-DD HH:mm:ss')
}
</script>

<style scoped lang="scss">
@use '../../styles/shared' as *;

.response-tabs-wrap {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 12px 8px;
  @include nr-panel;
}

.response-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.response-tabs {
  flex: 1;
  overflow: hidden;
  min-height: 0;

  // 页签头部精简
  :deep(.el-tabs__header) {
    margin-bottom: 8px;
  }
  :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
  }
  :deep(.el-tabs__item) {
    height: 36px;
    font-size: 13px;
  }

  :deep(.el-tabs__content) {
    height: calc(100% - 40px);
    overflow: auto;
  }
}

.body-mode-bar {
  margin-bottom: 8px;
}

.body-content {
  height: calc(100% - 40px);
  overflow: auto;
}

.body-raw {
  white-space: pre-wrap;
  word-break: break-all;
  font-family: $nr-mono;
  font-size: 12.5px;
  line-height: 1.6;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.request-info {
  padding: 8px 0;
}

.info-row {
  display: flex;
  gap: 12px;
  padding: 5px 0;
  font-size: 13px;
  border-bottom: 1px dashed var(--el-border-color-lighter);

  &:last-child {
    border-bottom: none;
  }
}

.info-label {
  width: 80px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.info-value {
  word-break: break-all;
  font-family: $nr-mono;
  font-size: 12.5px;
}

.response-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--el-text-color-placeholder);
}

.empty-text {
  font-size: 13px;
}
</style>
