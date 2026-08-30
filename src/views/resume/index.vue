<template>
  <div class="resume-page">
    <!-- 顶部工具条：左（标题+简历选择+新建） / 右（填充示例/保存/导出） -->
    <div class="toolbar">
      <ResumeSelect
        :records="records"
        :active-id="activeId"
        @select="handleSelect"
        @create="handleCreate"
        @rename="handleRename"
        @remove="handleRemove"
      />
      <div class="toolbar-right">
        <span v-if="dirty" class="dirty-dot" title="有未保存的更改"></span>
        <!-- 选择排版：应用已保存的命名排版预设 -->
        <el-dropdown class="preset-dropdown" trigger="click" @command="handleApplyPreset" @visible-change="loadPresets">
          <el-button size="small" :loading="presetsLoading">
            <LucideIcon name="LayoutTemplate" :size="14" />
            <span>选择排版</span>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="p in presets" :key="p.id" :command="p">
                {{ p.name }}
              </el-dropdown-item>
              <el-dropdown-item v-if="presets.length === 0" disabled>暂无保存的排版</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button size="small" :disabled="!activeRecord" @click="handleFillMock">
          <LucideIcon name="Wand2" :size="14" />
          <span>填充示例</span>
        </el-button>
        <el-button size="small" :disabled="!activeRecord" :loading="saving" @click="handleSave">
          <LucideIcon name="Save" :size="14" />
          <span>保存</span>
        </el-button>
        <el-button size="small" type="primary" :disabled="!activeRecord" :loading="exporting" @click="handleExport">
          <LucideIcon name="Download" :size="14" />
          <span>导出 PDF</span>
        </el-button>
      </div>
    </div>

    <!-- 主体：编辑器 | 预览 -->
    <div class="main-area">
      <ResumeEditor v-if="activeRecord" :data="localData" @update:data="onDataChange" />
      <div v-else class="editor-empty">
        <LucideIcon name="FileText" :size="36" />
        <p>新建或选择一份简历开始编辑</p>
      </div>
      <ResumePreview :html="previewHtml" @open-style="styleDialogVisible = true" />
    </div>

    <!-- 排版设置全屏弹窗（左配置 / 右示例简历实时渲染） -->
    <StyleDialog v-model:visible="styleDialogVisible" :config="layoutConfig" @apply="applyLayout" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import ResumeSelect from './components/ResumeSelect.vue'
import ResumeEditor from './components/ResumeEditor.vue'
import ResumePreview from './components/ResumePreview.vue'
import StyleDialog from './components/styleDrawer/StyleDialog.vue'
import { listResumes, createResume, updateResume, deleteResume, getResumeById, getLayoutByResumeId, saveLayout, listLayoutPresets, type LayoutPresetRecord } from './db'
import { getTemplate, DEFAULT_TEMPLATE_ID } from './templates'
import { createMockResumeData } from './mock'
import { defaultLayoutConfig } from './engine/defaultConfig'
import type { ResumeData, ResumeRecord, ResumeLayoutConfig } from './types'

/** IPC 句柄 */
const ipc: any = (window as any).ipcRenderer

/** 全部简历记录（按更新时间倒序） */
const records = ref<ResumeRecord[]>([])
/** 当前选中简历 id */
const activeId = ref<number | null>(null)
/** 当前编辑中的简历数据（本地副本） */
const localData = ref<ResumeData>(emptyResumeData())
/** 当前简历排版配置（随简历加载，保存时落库） */
const layoutConfig = ref<ResumeLayoutConfig>(defaultLayoutConfig)
/** 是否有未保存更改 */
const dirty = ref(false)
/** 保存中 */
const saving = ref(false)
/** 导出中 */
const exporting = ref(false)
/** 排版弹窗显隐 */
const styleDialogVisible = ref(false)
/** 排版预设列表（选择排版下拉） */
const presets = ref<LayoutPresetRecord[]>([])
/** 预设列表加载中 */
const presetsLoading = ref(false)

/** 当前选中的记录（来自列表，仅用于判断存在性） */
const activeRecord = computed(() => records.value.find((r) => r.id === activeId.value) || null)

/** 当前模板（简历数据里存的 templateId） */
const currentTemplate = computed(() =>
  getTemplate(activeRecord.value?.templateId || DEFAULT_TEMPLATE_ID)
)

/** 预览 HTML：模板 + 排版配置渲染结果（150ms 防抖，与导出同源） */
const previewHtml = ref('')
let renderTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 防抖重渲染预览（数据或排版配置变化均触发）
 */
function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    previewHtml.value = currentTemplate.value.render(localData.value, layoutConfig.value)
  }, 150)
}

// 数据/排版变更 → 防抖渲染（immediate 保证首屏出图）
watch([localData, layoutConfig], scheduleRender, { deep: true, immediate: true })

/**
 * 生成一份空白简历数据（作为新建默认值）
 * @returns 空白 ResumeData
 */
function emptyResumeData(): ResumeData {
  return {
    basics: { name: '', jobIntent: '', phone: '', email: '', gender: '', age: '', city: '' },
    education: [],
    work: [],
    project: [],
    skills: [],
    evaluation: '',
  }
}

/**
 * 刷新简历列表
 */
async function refreshList() {
  records.value = await listResumes()
}

/**
 * 加载指定简历到编辑区
 * @param id 简历 id
 */
async function loadResume(id: number) {
  const rec = await getResumeById(id)
  if (!rec) return
  activeId.value = id
  localData.value = rec.data
  // 加载该简历的排版配置（无则回退默认）
  layoutConfig.value = await getLayoutByResumeId(id)
  dirty.value = false
}

/**
 * 页面加载：拉取列表，无简历时自动创建一份默认简历
 */
onMounted(async () => {
  await refreshList()
  if (records.value.length > 0) {
    await loadResume(records.value[0].id)
  } else {
    const id = await createResume('我的简历', emptyResumeData())
    await refreshList()
    await loadResume(id)
  }
})

/**
 * 编辑数据变更（编辑器上报）
 * @param value 最新简历数据
 */
function onDataChange(value: ResumeData) {
  localData.value = value
  dirty.value = true
}

/**
 * 填充示例数据（调试用）：把虚构的完整简历灌入当前编辑区，
 * 仅改本地副本并标记未保存，点「保存」才落库，切走/刷新可丢弃。
 */
function handleFillMock() {
  localData.value = createMockResumeData()
  dirty.value = true
  ElMessage.success('已填充示例数据，点击保存可写入')
}

/**
 * 应用排版弹窗回传的配置（置为未保存，预览经 watch 自动重渲染）
 * @param value 弹窗 draft 配置
 */
function applyLayout(value: ResumeLayoutConfig) {
  layoutConfig.value = value
  dirty.value = true
  ElMessage.success('排版已应用，点击保存可写入')
}

/**
 * 拉取排版预设列表（选择排版下拉展开时）
 * @param visible 下拉展开状态
 */
async function loadPresets(visible: boolean) {
  if (!visible) return
  presetsLoading.value = true
  try {
    presets.value = await listLayoutPresets()
  } catch (e: any) {
    ElMessage.error(`排版预设加载失败：${e?.message || e}`)
  } finally {
    presetsLoading.value = false
  }
}

/**
 * 应用选中的排版预设到当前简历（预览即时变化，置未保存）
 * @param preset 选中的预设
 */
function handleApplyPreset(preset: LayoutPresetRecord) {
  layoutConfig.value = JSON.parse(JSON.stringify(preset.config))
  dirty.value = true
  ElMessage.success(`已应用排版「${preset.name}」，点击保存可写入当前简历`)
}

/**
 * 保存当前简历（内容；名称由顶部选择器重命名管理）
 * @throws 写库失败时 ElMessage 提示
 */
async function handleSave() {
  if (!activeId.value) return
  saving.value = true
  try {
    await updateResume(activeId.value, localData.value)
    // 排版配置一并落库（resume_layout 表）
    await saveLayout(activeId.value, layoutConfig.value)
    await refreshList()
    dirty.value = false
    ElMessage.success('保存成功')
  } catch (e: any) {
    ElMessage.error(`保存失败：${e?.message || e}`)
  } finally {
    saving.value = false
  }
}

/**
 * 切换选中的简历（有未保存更改时先静默保存）
 * @param id 目标简历 id
 */
async function handleSelect(id: number) {
  if (id === activeId.value) return
  // 有未保存更改时自动保存（内容 + 排版），避免丢失
  if (dirty.value && activeId.value) {
    try {
      await updateResume(activeId.value, localData.value)
      await saveLayout(activeId.value, layoutConfig.value)
      await refreshList()
    } catch (e: any) {
      ElMessage.error(`自动保存失败：${e?.message || e}`)
      return
    }
  }
  await loadResume(id)
}

/**
 * 新建简历
 * @param name 简历名称（侧栏弹窗输入）
 */
async function handleCreate(name: string) {
  try {
    const id = await createResume(name, emptyResumeData())
    await refreshList()
    await loadResume(id)
    ElMessage.success('创建成功')
  } catch (e: any) {
    ElMessage.error(/UNIQUE/i.test(String(e?.message)) ? '已存在同名简历，请换个名称' : `创建失败：${e?.message || e}`)
  }
}

/**
 * 重命名简历（立即落库）
 * @param id 简历 id
 * @param name 新名称
 */
async function handleRename(id: number, name: string) {
  try {
    const rec = await getResumeById(id)
    if (!rec) return
    await updateResume(id, rec.data, { name })
    await refreshList()
  } catch (e: any) {
    ElMessage.error(/UNIQUE/i.test(String(e?.message)) ? '已存在同名简历，请换个名称' : `重命名失败：${e?.message || e}`)
  }
}

/**
 * 删除简历（若是当前简历则切换到列表第一条）
 * @param id 简历 id
 */
async function handleRemove(id: number) {
  try {
    await deleteResume(id)
    await refreshList()
    if (id === activeId.value) {
      if (records.value.length > 0) {
        await loadResume(records.value[0].id)
      } else {
        const nid = await createResume('我的简历', emptyResumeData())
        await refreshList()
        await loadResume(nid)
      }
    }
    ElMessage.success('已删除')
  } catch (e: any) {
    ElMessage.error(`删除失败：${e?.message || e}`)
  }
}

/**
 * 生成导出文件名：简历名称-时间戳.pdf（与项目 CSV 导出格式一致）
 * @returns 如 张三-20260830-162000.pdf
 */
function buildExportFileName(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  const base = activeRecord.value?.name?.trim() || '简历'
  return `${base}-${ts}.pdf`
}

/**
 * 导出 PDF：先落库保存，再把模板渲染的 HTML 交给主进程 printToPDF
 */
async function handleExport() {
  if (!activeId.value) return
  exporting.value = true
  try {
    if (dirty.value) {
      await updateResume(activeId.value, localData.value)
      await saveLayout(activeId.value, layoutConfig.value)
      await refreshList()
      dirty.value = false
    }
    const html = currentTemplate.value.render(localData.value, layoutConfig.value)
    const res = await ipc.invoke('resume:export-pdf', { html, fileName: buildExportFileName() })
    if (res && res.ok) {
      ElMessage.success(`已导出：${res.path}`)
    } else if (res && res.canceled) {
      // 用户取消保存对话框，不提示
    } else {
      ElMessage.error(`导出失败：${(res && res.error) || '未知错误'}`)
    }
  } catch (e: any) {
    ElMessage.error(`导出失败：${e?.message || e}`)
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.resume-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--skin-border, #e4e4e7);
  background: var(--skin-card, #fff);
  flex-shrink: 0;
}
.dirty-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f59e0b;
  display: inline-block;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.toolbar-right :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.main-area {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.editor-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #999;
  font-size: 13px;
}
</style>
