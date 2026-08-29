<template>
  <!-- 保存响应到笔记对话框：写入 note_book 表，字段约定与 QuickNote / 浏览器存入笔记一致 -->
  <el-dialog
    v-model="visible"
    title="保存到笔记"
    width="460px"
    :append-to-body="true"
    :close-on-click-modal="false"
    @open="onOpen"
  >
    <div class="save-note">
      <div class="form-row">
        <span class="form-label">分类</span>
        <el-select
          v-model="category"
          filterable
          allow-create
          default-first-option
          placeholder="选择或输入新分类"
          size="default"
        >
          <el-option v-for="cat in categoryOptions" :key="cat" :label="cat" :value="cat" />
        </el-select>
      </div>
      <div class="form-row">
        <span class="form-label">标题</span>
        <el-input v-model="title" placeholder="笔记标题" maxlength="100" />
      </div>
      <div class="form-row is-top">
        <span class="form-label">内容</span>
        <el-input
          v-model="content"
          type="textarea"
          :rows="10"
          placeholder="默认包含请求信息与响应体（Markdown），可编辑"
        />
      </div>
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 网络请求工作台 - 保存响应到笔记对话框
 * ------------------------------------------------------------------
 * 职责：把响应记录（请求地址/状态/耗时/响应体）整理为 Markdown 片段，
 * 写入 note_book 表（key/excerpt/content/html/mdText/category/createTime/updateTime）。
 * - 分类：预置分类 + 从库中 DISTINCT 读取的历史分类，支持输入新建；
 * - 内容：默认 Markdown（请求摘要 + 响应体代码块），可编辑后保存。
 */
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { ResponseRecord } from '../../types'

/** 弹窗可见性（v-model） */
const visible = defineModel<boolean>({ default: false })

/** 组件 props 定义 */
const props = defineProps<{
  /** 待保存的响应记录 */
  record: ResponseRecord | null;
  /** 预填的 Markdown 内容（由父组件根据响应生成） */
  presetContent?: string;
}>()

/** 预置分类（库中有历史分类时合并展示） */
const PRESET_CATEGORIES = ['接口文档', '调试记录', '网页收藏', '技术笔记']

/** 分类（可创建） */
const category = ref('接口文档')
/** 笔记标题 */
const title = ref('')
/** 笔记内容 */
const content = ref('')
/** 保存中标记 */
const saving = ref(false)
/** 分类下拉选项 */
const categoryOptions = ref<string[]>([...PRESET_CATEGORIES])

/**
 * 从 note_book 读取历史分类（DISTINCT，查询失败时静默回退预置列表）
 */
async function loadCategories(): Promise<void> {
  try {
    const res = await (window as any).ipcRenderer.invoke('new-sql:query', {
      tableName: 'note_book',
      conditions: {
        SqlStr:
          "SELECT DISTINCT category FROM note_book WHERE category IS NOT NULL AND category <> '' LIMIT 50",
      },
    })
    const rows = Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res?.data?.rows)
        ? res.data.rows
        : []
    const extra = rows
      .map((r: any) => String(r.category))
      .filter((c: string) => c && !PRESET_CATEGORIES.includes(c))
    categoryOptions.value = [...PRESET_CATEGORIES, ...extra]
  } catch {
    categoryOptions.value = [...PRESET_CATEGORIES]
  }
}

/**
 * 弹窗打开：初始化标题（请求地址）与内容（预填 Markdown）
 */
function onOpen(): void {
  loadCategories()
  title.value = props.record?.requestUrl || ''
  content.value = props.presetContent || ''
}

/**
 * 保存笔记到 note_book（字段约定与 QuickNote 一致，附加 category）
 * @throws 内容为空时提示；写库失败显式报错
 */
async function onSave(): Promise<void> {
  if (!content.value.trim()) {
    ElMessage.warning('内容不能为空')
    return
  }
  saving.value = true
  try {
    const now = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    const time = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`
    const plain = content.value.trim()
    const res = await (window as any).ipcRenderer.invoke('new-sql:upsert', {
      tableName: 'note_book',
      data: {
        key: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        excerpt: plain.replace(/\s+/g, ' ').substring(0, 20) + '...',
        content: plain,
        html: '',
        mdText: plain,
        category: (category.value || '接口文档').trim(),
        createTime: time,
        updateTime: time,
      },
      config: { primaryKey: 'key' },
    })
    if (res?.success) {
      ElMessage.success(`已保存到笔记（${category.value || '接口文档'}）`)
      visible.value = false
    } else {
      ElMessage.error(`保存失败：${res?.error || '未知错误'}`)
    }
  } catch (e) {
    console.error('[netRequest] 保存到笔记失败:', e)
    ElMessage.error('保存失败，请重试')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.save-note {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .form-row {
    display: flex;
    align-items: center;
    gap: 10px;

    &.is-top {
      align-items: flex-start;

      .form-label {
        margin-top: 6px;
      }
    }

    .form-label {
      width: 40px;
      flex-shrink: 0;
      font-size: 13px;
      color: var(--el-text-color-secondary);
      text-align: right;
    }

    .el-select,
    .el-input {
      flex: 1;
    }
  }
}
</style>
