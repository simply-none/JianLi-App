<template>
  <el-dialog
    v-model="visible"
    title="导入接口"
    width="640px"
    :close-on-click-modal="false"
  >
    <div class="import-dialog">
      <!-- 格式选择 -->
      <el-radio-group v-model="format" size="small" class="format-group">
        <el-radio-button value="code">代码片段</el-radio-button>
        <el-radio-button value="postman">Postman Collection</el-radio-button>
        <el-radio-button value="postman-env">Postman Environment</el-radio-button>
        <el-radio-button value="openapi">OpenAPI / Swagger</el-radio-button>
      </el-radio-group>

      <!-- 代码片段子页签（5 种格式） -->
      <el-radio-group v-if="format === 'code'" v-model="codeKind" size="small" class="code-kind-group">
        <el-radio-button value="curl-cmd">cURL (cmd)</el-radio-button>
        <el-radio-button value="curl-bash">cURL (bash)</el-radio-button>
        <el-radio-button value="fetch">fetch</el-radio-button>
        <el-radio-button value="fetch-node">fetch (Node.js)</el-radio-button>
        <el-radio-button value="powershell">PowerShell</el-radio-button>
      </el-radio-group>

      <!-- 输入区 -->
      <div class="input-area">
        <div class="input-toolbar">
          <span class="input-tip">
            {{ format === 'code' ? '粘贴代码片段文本，解析后回填到请求编辑区' : '粘贴导出的 JSON，或选择文件读取' }}
          </span>
          <el-button
            v-if="format !== 'code'"
            size="small"
            text
            type="primary"
            @click="pickAndReadFile"
          >
            <LucideIcon name="Upload" :size="13" />
            选择文件
          </el-button>
        </div>
        <el-input
          v-model="content"
          type="textarea"
          :rows="10"
          class="content-editor"
          spellcheck="false"
          :placeholder="placeholder"
        />
      </div>

      <!-- 解析结果预览 -->
      <div v-if="previewLines.length" class="preview-box">
        <div class="preview-title">解析结果预览（{{ previewLines.length }} 项）</div>
        <div class="preview-list">
          <div v-for="(line, i) in previewLines" :key="i" class="preview-line" :title="line">
            {{ line }}
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!previewLines.length" :loading="importing" @click="doImport">
        确认导入
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 导入弹窗：代码片段（cURL cmd/bash、fetch、fetch Node.js、PowerShell）/
 * Postman Collection / Postman Environment / OpenAPI(Swagger)
 * - 解析后先预览再确认写入
 * - 代码片段 → 回填当前请求编辑区；其余 → 写入集合/环境
 */
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { parseCodeSnippet, parseOpenApi, parsePostman } from '../../composables/useImport'
import type { CodeSnippetKind } from '../../composables/useImport'
import type { CollectionNode, Environment, RequestConfig } from '../../types'

/** 弹窗可见性（v-model） */
const visible = defineModel<boolean>({ default: false })

/** 导入格式（code 为代码片段大类） */
const format = ref<'code' | 'postman' | 'postman-env' | 'openapi'>('code')

/** 代码片段子类型（5 个子页签） */
const codeKind = ref<CodeSnippetKind>('curl-bash')

/** 输入内容 */
const content = ref('')

/** 导入中标记 */
const importing = ref(false)

/** 解析后的中间结果（预览与确认导入共用） */
let parsedCurl: RequestConfig | null = null
let parsedNodes: CollectionNode[] = []
let parsedEnv: Environment | null = null

/** 代码片段各子类型的输入占位提示 */
const codePlaceholders: Record<CodeSnippetKind, string> = {
  'curl-cmd': 'curl -X GET "https://api.example.com/users" -H "Authorization: Bearer xxx"',
  'curl-bash': "curl -X GET 'https://api.example.com/users' -H 'Authorization: Bearer xxx'",
  fetch: `fetch("https://api.example.com/users", {\n  "headers": { "content-type": "application/json" },\n  "body": "{\\"name\\":\\"a\\"}",\n  "method": "POST"\n})`,
  'fetch-node': `const res = await fetch('https://api.example.com/users', {\n  method: 'POST',\n  headers: { 'content-type': 'application/json' },\n  body: JSON.stringify({ name: 'a' })\n})`,
  powershell: `$headers = @{ 'Authorization' = 'Bearer xxx' }\nInvoke-RestMethod -Uri 'https://api.example.com/users' -Method Post -Headers $headers -ContentType 'application/json' -Body '{"name":"a"}'`,
}

/** 输入占位提示（按格式区分） */
const placeholder = computed(() => {
  if (format.value === 'code') return codePlaceholders[codeKind.value]
  if (format.value === 'openapi') return '{ "openapi": "3.0.0", "info": {...}, "paths": {...} }'
  if (format.value === 'postman') return '{ "info": { "name": "..." }, "item": [...] }'
  return '{ "name": "环境名", "values": [{ "key": "", "value": "", "enabled": true }] }'
})

/** 预览行列表 */
const previewLines = computed(() => {
  parsedCurl = null
  parsedNodes = []
  parsedEnv = null
  if (!content.value.trim()) return []
  try {
    if (format.value === 'code') {
      parsedCurl = parseCodeSnippet(codeKind.value, content.value)
      return [`${parsedCurl.method} ${parsedCurl.url}`]
    }
    if (format.value === 'postman') {
      const res = parsePostman(content.value)
      if (res.type !== 'collection') throw new Error('该 JSON 是 Environment，请切换到 Postman Environment 页签')
      parsedNodes = res.nodes || []
      return flattenPreview(parsedNodes, 0)
    }
    if (format.value === 'postman-env') {
      const res = parsePostman(content.value)
      if (res.type !== 'environment') throw new Error('该 JSON 是 Collection，请切换到 Postman Collection 页签')
      parsedEnv = res.environment || null
      return parsedEnv
        ? [`环境「${parsedEnv.name}」：${parsedEnv.vars.length} 个变量`]
        : []
    }
    // openapi
    const res = parseOpenApi(content.value)
    parsedNodes = res.nodes
    return [`「${res.name}」`, ...flattenPreview(parsedNodes, 0)]
  } catch (err: any) {
    return [`解析失败：${err?.message || err}`]
  }
})

/**
 * 展平集合树为预览行（含缩进）
 * @param nodes 集合节点
 * @param depth 缩进层级
 * @returns 预览文本行
 */
function flattenPreview(nodes: CollectionNode[], depth: number): string[] {
  const lines: string[] = []
  for (const n of nodes) {
    const indent = '　'.repeat(depth)
    lines.push(
      n.nodeType === 'folder'
        ? `${indent}📁 ${n.name}`
        : `${indent}${n.method} ${n.name}`
    )
    if (n.children?.length) {
      lines.push(...flattenPreview(n.children, depth + 1))
    }
    if (lines.length > 50) {
      lines.push('...（仅展示前 50 项）')
      break
    }
  }
  return lines
}

/**
 * 选择本地 JSON 文件并读取内容（主进程读盘，规避渲染端文件限制）
 */
async function pickAndReadFile(): Promise<void> {
  const pick = await window.ipcRenderer.handlePromise('net-request:pick-file', {
    title: '选择导出的 JSON 文件',
  })
  if (!pick?.success || !pick.path) return
  const read = await window.ipcRenderer.handlePromise('net-request:read-file', {
    path: pick.path,
  })
  if (read?.success) {
    content.value = read.content
  } else {
    ElMessage.error(read?.message || '文件读取失败')
  }
}

/** 导入完成事件：代码片段携带回填配置，集合/环境由父组件各自刷新 */
const emit = defineEmits<{
  (e: 'curl', config: RequestConfig): void
  (e: 'done'): void
}>()

/**
 * 确认导入（预览已解析成功的前提下执行写入）
 */
async function doImport(): Promise<void> {
  importing.value = true
  try {
    const { importNodes, refreshCollection } = await import('../../composables/useCollection')
    const { saveEnvironment, refreshEnvs } = await import('../../composables/useEnvironment')
    if (format.value === 'code') {
      if (!parsedCurl) return
      emit('curl', parsedCurl)
      ElMessage.success('代码片段已回填到请求编辑区')
    } else if (format.value === 'postman' || format.value === 'openapi') {
      if (!parsedNodes.length) {
        ElMessage.warning('未解析出可导入的接口')
        return
      }
      await importNodes(parsedNodes, 0)
      await refreshCollection()
      ElMessage.success(`已导入 ${parsedNodes.length} 个顶层节点`)
    } else if (format.value === 'postman-env') {
      if (!parsedEnv) return
      await saveEnvironment(parsedEnv)
      await refreshEnvs()
      ElMessage.success(`环境「${parsedEnv.name}」已导入`)
    }
    emit('done')
    visible.value = false
    content.value = ''
  } catch (err: any) {
    ElMessage.error('导入失败：' + (err?.message || err))
  } finally {
    importing.value = false
  }
}

/** 弹窗打开时重置状态 */
watch(visible, (val) => {
  if (val) {
    content.value = ''
  }
})
</script>

<style scoped lang="scss">
.import-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.format-group {
  align-self: flex-start;
}

/* 代码片段子页签组 */
.code-kind-group {
  align-self: flex-start;

  :deep(.el-radio-button__inner) {
    padding: 5px 10px;
  }
}

.input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.input-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.content-editor {
  :deep(textarea) {
    font-family: Consolas, Monaco, monospace;
    font-size: 13px;
  }
}

.preview-box {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 8px;
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.preview-list {
  max-height: 160px;
  overflow: auto;
}

.preview-line {
  font-size: 12px;
  font-family: Consolas, Monaco, monospace;
  padding: 2px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
