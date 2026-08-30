<template>
  <el-dialog
    :model-value="visible"
    fullscreen
    append-to-body
    destroy-on-close
    class="style-dialog"
    @update:model-value="$emit('update:visible', $event)"
  >
    <template #header>
      <div class="dialog-head">
        <span class="head-title">排版设置</span>
        <span class="head-sub">左侧调整即时生效于右侧示例简历，点击「完成」应用到当前简历</span>
      </div>
    </template>

    <div v-if="draft" class="dialog-body">
      <!-- 左：排版配置面板 -->
      <div class="config-panel">
        <div class="panel-actions">
          <el-button size="small" @click="handleSavePreset">
            <LucideIcon name="Save" :size="13" />
            <span>保存</span>
          </el-button>
          <el-button size="small" @click="handleSaveAsPreset">
            <LucideIcon name="Copy" :size="13" />
            <span>另存为</span>
          </el-button>
          <el-button size="small" @click="resetDefault">
            <LucideIcon name="RotateCcw" :size="13" />
            <span>恢复默认排版</span>
          </el-button>
        </div>
        <div class="panel-scroll">
          <div class="panel-section">
            <div class="section-title">页面全局</div>
            <PageStyleGroup :model="draft.page" @change="markChanged" />
          </div>
          <div class="panel-section">
            <div class="section-title">模块（顺序 = 渲染顺序）</div>
            <ModuleList :modules="draft.modules" @change="markChanged" />
          </div>
        </div>
      </div>

      <!-- 右：示例简历实时渲染 -->
      <div class="preview-panel">
        <div class="preview-tip">
          <LucideIcon name="Info" :size="13" />
          <span>示例数据预览（不影响当前简历内容），宽度自适应</span>
        </div>
        <ResumePaper :key="renderTick" :html="previewHtml" />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button size="small" @click="close">取消</el-button>
        <el-button size="small" type="primary" @click="apply">
          <LucideIcon name="Check" :size="13" />
          <span>完成</span>
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import ResumePaper from '../ResumePaper.vue'
import PageStyleGroup from './groups/PageStyleGroup.vue'
import ModuleList from './groups/ModuleList.vue'
import { mergeConfig } from '../../engine/defaultConfig'
import { renderResume } from '../../engine/sections'
import { createMockResumeData } from '../../mock'
import { saveLayoutPreset } from '../../db'
import type { ResumeLayoutConfig } from '../../engine/types'

/**
 * 排版设置全屏弹窗
 * 左侧：页面全局 + 模块（排序/显隐）+ 组件/原子字段配置；
 * 右侧：以内置示例简历数据实时渲染当前配置效果（fit-width）。
 * 打开时对当前配置深拷贝生成 draft，编辑仅作用于 draft；
 * 「完成」回传应用，「取消/关闭」丢弃。
 */
const props = defineProps<{
  /** 弹窗显隐 */
  visible: boolean
  /** 当前生效的排版配置 */
  config: ResumeLayoutConfig
}>()

const emit = defineEmits<{
  /** 显隐切换 */
  (e: 'update:visible', value: boolean): void
  /** 应用 draft 配置（点击「完成」） */
  (e: 'apply', value: ResumeLayoutConfig): void
}>()

/** 弹窗内草稿配置（reactive 由 mergeConfig 深拷贝产出） */
const draft = ref<ResumeLayoutConfig | null>(null)
/** 预览 HTML（防抖更新） */
const previewHtml = ref('')
/** 渲染序号：每次渲染 +1，作为 ResumePaper 的 key 强制 iframe 重建，杜绝 srcdoc 不重载的边角问题 */
const renderTick = ref(0)
/** 当前 draft 关联的预设名（保存/另存为成功后更新；恢复默认后清空） */
const presetName = ref<string | null>(null)
/** 示例简历数据（弹窗生命周期内固定一份） */
const mockData = createMockResumeData()
/** 防抖定时器 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 以 draft 渲染示例简历（120ms 防抖，避免拖动滑块时高频重渲染）。
 * 渲染输入做深拷贝脱离 reactive proxy，输出确定性 HTML；
 * renderTick 递增驱动 ResumePaper 整体重建。
 */
function scheduleRender() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (draft.value) {
      const plain = JSON.parse(JSON.stringify(draft.value)) as ResumeLayoutConfig
      previewHtml.value = renderResume(mockData, plain)
      renderTick.value++
    }
  }, 120)
}

/**
 * 配置变更通知（子组件 mutate 后触发）
 */
function markChanged() {
  scheduleRender()
}

// 兜底：draft 任意深层变更都触发重渲染，防止个别控件漏发 change 事件
watch(draft, scheduleRender, { deep: true })

/**
 * 弹窗打开：以当前配置生成 draft（仅在 visible 变化时执行一次，
 * 不再绑定 el-dialog @open，避免 draft 被二次替换导致子组件快照引用脱节）
 */
function onOpen() {
  draft.value = mergeConfig(JSON.parse(JSON.stringify(props.config)))
  presetName.value = null
  scheduleRender()
}

// visible 打开时初始化 draft（唯一入口）
watch(
  () => props.visible,
  (v) => {
    if (v) onOpen()
  },
  { immediate: true }
)

/**
 * 恢复默认排版（作用于 draft，并解除预设关联）
 */
function resetDefault() {
  draft.value = mergeConfig(null)
  presetName.value = null
  scheduleRender()
}

/**
 * 通用「弹窗输入排版名 + 确认」
 * @param title 对话框标题
 * @param defaultValue 输入框默认值
 * @returns 用户确认的名称；取消返回 null
 */
async function promptPresetName(title: string, defaultValue: string): Promise<string | null> {
  try {
    const { value } = await ElMessageBox.prompt('请输入排版名称', title, {
      inputValue: defaultValue,
      inputPlaceholder: '如：极简黑白 / 双栏商务',
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    return value.trim()
  } catch {
    return null
  }
}

/**
 * 保存排版预设（新增/编辑一体）：
 * 输入的名字已存在则覆盖更新（编辑），不存在则新增。
 */
async function handleSavePreset() {
  if (!draft.value) return
  const name = await promptPresetName('保存排版', presetName.value || '')
  if (!name) return
  try {
    const res = await saveLayoutPreset(name, draft.value, { overwrite: true })
    if (!res.ok) {
      ElMessage.error(res.message || '保存失败')
      return
    }
    presetName.value = name
    ElMessage.success(res.created ? `已新增排版「${name}」` : `已更新排版「${name}」`)
  } catch (e: any) {
    ElMessage.error(`保存失败：${e?.message || e}`)
  }
}

/**
 * 另存为新排版预设：强制新增，同名将被拒绝提示改名。
 */
async function handleSaveAsPreset() {
  if (!draft.value) return
  const name = await promptPresetName('另存为排版', `${presetName.value || '我的排版'}-副本`)
  if (!name) return
  try {
    const res = await saveLayoutPreset(name, draft.value, { overwrite: false })
    if (!res.ok) {
      ElMessage.warning(res.message || '另存失败，请换个名称')
      return
    }
    presetName.value = name
    ElMessage.success(`已另存为「${name}」`)
  } catch (e: any) {
    ElMessage.error(`另存失败：${e?.message || e}`)
  }
}

/**
 * 应用 draft 并关闭
 */
function apply() {
  if (draft.value) emit('apply', JSON.parse(JSON.stringify(draft.value)))
  close()
}

/**
 * 关闭弹窗（丢弃 draft）
 */
function close() {
  emit('update:visible', false)
}
</script>

<style scoped>
.dialog-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.head-title {
  font-size: 16px;
  font-weight: 600;
}
.head-sub {
  font-size: 12px;
  color: #999;
}
.dialog-body {
  height: calc(100vh - 130px);
  display: flex;
  gap: 0;
  overflow: hidden;
}
.config-panel {
  width: 420px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--skin-border, #e4e4e7);
  background: var(--skin-card, #fff);
}
.panel-actions {
  padding: 8px 12px;
  border-bottom: 1px solid var(--skin-border, #e4e4e7);
  display: flex;
  justify-content: flex-end;
}
.panel-actions :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.panel-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.panel-section {
  margin-bottom: 16px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--skin-text-primary, #333);
}
.preview-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--skin-bg, #f3f4f6);
}
.preview-tip {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #999;
  padding: 8px 14px;
  flex-shrink: 0;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.dialog-footer :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
