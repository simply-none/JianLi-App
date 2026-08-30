<template>
  <div class="custom-rows-editor">
    <!-- 行列表 -->
    <div v-for="(row, ri) in rows" :key="row.id" class="row-card">
      <div class="row-head">
        <span class="row-index">行 {{ ri + 1 }}</span>
        <div class="row-actions">
          <el-tooltip content="上移" placement="top">
            <button class="mini-btn" :disabled="ri === 0" @click="moveRow(ri, -1)">
              <LucideIcon name="ArrowUp" :size="13" />
            </button>
          </el-tooltip>
          <el-tooltip content="下移" placement="top">
            <button class="mini-btn" :disabled="ri === rows.length - 1" @click="moveRow(ri, 1)">
              <LucideIcon name="ArrowDown" :size="13" />
            </button>
          </el-tooltip>
          <el-tooltip content="删除行" placement="top">
            <button class="mini-btn is-danger" @click="removeRow(ri)">
              <LucideIcon name="Trash2" :size="13" />
            </button>
          </el-tooltip>
        </div>
      </div>

      <!-- 行内块 -->
      <div v-for="b in row.blocks" :key="b.id" class="block-item">
        <div class="block-head">
          <span class="type-badge" :class="`is-${b.type}`">{{ typeLabel(b.type) }}</span>
          <el-select
            v-if="b.type === 'heading' || b.type === 'text'"
            :model-value="b.span"
            size="small"
            class="span-select"
            @update:model-value="setBlockSpan(row, b, $event as SectionRowBlock['span'])"
          >
            <el-option value="left" label="左侧" />
            <el-option value="center" label="中间" />
            <el-option value="right" label="右侧" />
            <el-option value="full" label="整行" />
          </el-select>
          <span v-else class="span-fixed">整行</span>
          <button class="mini-btn is-danger" title="删除内容" @click="removeBlock(row, b)">
            <LucideIcon name="Trash2" :size="13" />
          </button>
        </div>
        <el-input
          v-if="b.type === 'heading' || b.type === 'text'"
          :model-value="b.text"
          size="small"
          :placeholder="b.type === 'heading' ? '标题内容' : '文本内容'"
          maxlength="60"
          @update:model-value="setBlockText(row, b, $event)"
        />
        <el-input
          v-else
          :model-value="b.text"
          type="textarea"
          :rows="b.type === 'list' ? 3 : 4"
          :placeholder="b.type === 'list' ? '列表内容，每行一条' : '段落内容，支持换行'"
          @update:model-value="setBlockText(row, b, $event)"
        />
      </div>

      <!-- 行内添加内容（列表/文本块独占行；标题/文本可同行多块分区） -->
      <div class="add-block-row">
        <span class="add-hint">添加内容：</span>
        <button class="chip-add" @click="addBlock(row, 'heading')">标题</button>
        <button class="chip-add" @click="addBlock(row, 'text')">文本</button>
        <button class="chip-add" @click="addBlock(row, 'list')">列表</button>
        <button class="chip-add" @click="addBlock(row, 'textbox')">文本块</button>
      </div>
    </div>

    <div v-if="rows.length === 0" class="empty-tip">暂无内容行，点击下方按钮开始搭建</div>

    <!-- 添加行 + 模板操作 -->
    <div class="footer-row">
      <el-button plain size="small" @click="addRow">
        <LucideIcon name="Plus" :size="13" />
        <span>添加行</span>
      </el-button>
      <el-button plain size="small" @click="saveAsTemplate">
        <LucideIcon name="Save" :size="13" />
        <span>存为模板</span>
      </el-button>
      <el-dropdown trigger="click" @command="loadTemplate" @visible-change="loadTemplates">
        <el-button plain size="small" :loading="templatesLoading">
          <LucideIcon name="FolderOpen" :size="13" />
          <span>从模板加载</span>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="t in templates" :key="t.id" :command="t">{{ t.name }}</el-dropdown-item>
            <el-dropdown-item v-if="templates.length === 0" disabled>暂无保存的模板</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import {
  listCustomSectionTemplates,
  saveCustomSectionTemplate,
  type CustomSectionTemplateRecord,
} from '../../db'
import type { CustomSectionData, RowBlockType, SectionRow, SectionRowBlock } from '../../types'

/**
 * 自定义模块行结构编辑器
 * 行 = 内容块集合：标题/文本可同块多块并排（左/中/右分区），列表/文本块独占整行。
 * 全部变更以不可变方式生成新 section 副本经 update:section 上报；
 * 「存为模板/从模板加载」读写 resume_custom_section 表（加载副本，不引用模板 id）。
 */
const props = defineProps<{
  /** 当前自定义模块（draft 内引用） */
  section: CustomSectionData
}>()

const emit = defineEmits<{
  /** 结构变更，携带新副本 */
  (e: 'update:section', value: CustomSectionData): void
}>()

/** 行列表（props 动态访问） */
const rows = computed<SectionRow[]>(() => props.section.rows || [])

/** 模板列表（下拉展开时拉取） */
const templates = ref<CustomSectionTemplateRecord[]>([])
/** 模板加载中 */
const templatesLoading = ref(false)

/** 块类型显示名 */
const TYPE_LABELS: Record<RowBlockType, string> = {
  heading: '标题',
  text: '文本',
  list: '列表',
  textbox: '文本块',
}

/**
 * 取块类型显示名
 * @param type 块类型
 */
function typeLabel(type: RowBlockType): string {
  return TYPE_LABELS[type] || type
}

/**
 * 生成行/块 id
 */
function genId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * 上报新的行列表（不可变替换）
 * @param next 最新行数组
 */
function emitRows(next: SectionRow[]) {
  emit('update:section', { ...props.section, rows: next })
}

/**
 * 替换指定行
 * @param ri 行下标
 * @param newRow 新行对象
 */
function replaceRow(ri: number, newRow: SectionRow) {
  const next = rows.value.map((r, i) => (i === ri ? newRow : r))
  emitRows(next)
}

/**
 * 移动行顺序
 * @param ri 行下标
 * @param dir 方向（-1 上移 / 1 下移）
 */
function moveRow(ri: number, dir: -1 | 1) {
  const target = ri + dir
  if (target < 0 || target >= rows.value.length) return
  const next = [...rows.value]
  ;[next[ri], next[target]] = [next[target], next[ri]]
  emitRows(next)
}

/**
 * 删除行
 * @param ri 行下标
 */
function removeRow(ri: number) {
  emitRows(rows.value.filter((_, i) => i !== ri))
}

/** 添加空行 */
function addRow() {
  emitRows([...rows.value, { id: genId(), blocks: [] }])
}

/**
 * 行内添加内容块（列表/文本块自动整行；标题/文本默认左侧）
 * @param row 目标行
 * @param type 块类型
 */
function addBlock(row: SectionRow, type: RowBlockType) {
  const block: SectionRowBlock = {
    id: genId(),
    type,
    text: '',
    span: type === 'list' || type === 'textbox' ? 'full' : 'left',
  }
  replaceRow(
    rows.value.findIndex((r) => r.id === row.id),
    { ...row, blocks: [...row.blocks, block] }
  )
}

/**
 * 更新块文本
 * @param row 所在行
 * @param block 目标块
 * @param value 新文本
 */
function setBlockText(row: SectionRow, block: SectionRowBlock, value: string) {
  replaceRow(rows.value.findIndex((r) => r.id === row.id), {
    ...row,
    blocks: row.blocks.map((b) => (b.id === block.id ? { ...b, text: value } : b)),
  })
}

/**
 * 更新块水平区域（列表/文本块锁定整行，忽略修改）
 * @param row 所在行
 * @param block 目标块
 * @param span 新区域
 */
function setBlockSpan(row: SectionRow, block: SectionRowBlock, span: SectionRowBlock['span']) {
  if (block.type === 'list' || block.type === 'textbox') return
  replaceRow(rows.value.findIndex((r) => r.id === row.id), {
    ...row,
    blocks: row.blocks.map((b) => (b.id === block.id ? { ...b, span } : b)),
  })
}

/**
 * 删除块
 * @param row 所在行
 * @param block 目标块
 */
function removeBlock(row: SectionRow, block: SectionRowBlock) {
  replaceRow(rows.value.findIndex((r) => r.id === row.id), {
    ...row,
    blocks: row.blocks.filter((b) => b.id !== block.id),
  })
}

/**
 * 拉取模板列表（下拉展开时）
 * @param visible 下拉展开状态
 */
async function loadTemplates(visible: boolean) {
  if (!visible) return
  templatesLoading.value = true
  try {
    templates.value = await listCustomSectionTemplates()
  } catch (e: any) {
    ElMessage.error(`模板加载失败：${e?.message || e}`)
  } finally {
    templatesLoading.value = false
  }
}

/**
 * 存为模板：弹窗输入名称（同名覆盖更新）
 */
async function saveAsTemplate() {
  if (!props.section.rows || props.section.rows.length === 0) {
    ElMessage.warning('当前模块没有内容行，无法保存模板')
    return
  }
  try {
    const { value } = await ElMessageBox.prompt('请输入模板名称', '存为自定义模块模板', {
      inputPlaceholder: '如：获奖条目式 / 兴趣段落式',
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
    })
    const name = value.trim()
    const res = await saveCustomSectionTemplate(name, props.section, { overwrite: true })
    if (!res.ok) {
      ElMessage.error(res.message || '保存失败')
      return
    }
    ElMessage.success(res.created ? `已新增模板「${name}」` : `已更新模板「${name}」`)
  } catch (e: any) {
    if (e !== 'cancel' && e?.message !== 'cancel') ElMessage.error(`保存失败：${e?.message || e}`)
  }
}

/**
 * 深拷贝并重生成行/块 id（避免同一简历多模块加载同一模板后 key 冲突）
 * @param rows 模板行结构
 * @returns 新 id 的行结构
 */
function cloneRowsWithNewIds(rows: SectionRow[]): SectionRow[] {
  return rows.map((row) => ({
    id: genId(),
    blocks: (row.blocks || []).map((b) => ({ ...b, id: genId() })),
  }))
}

/**
 * 从模板加载：深拷贝模板行结构替换当前模块内容（简历保存自己的副本，不引用模板 id）
 * @param tpl 选中的模板
 */
function loadTemplate(tpl: CustomSectionTemplateRecord) {
  const rows = cloneRowsWithNewIds(tpl.structure.rows || [])
  if (rows.length === 0) {
    ElMessage.warning('该模板没有内容行')
    return
  }
  emitRows(rows)
  ElMessage.success(`已加载模板「${tpl.name}」的结构，可直接修改内容`)
}

// ElMessageBox 引用保留（保存模板流程不再需要确认框，取消提示走静默）
void ElMessageBox
</script>

<style scoped>
.custom-rows-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row-card {
  border: 1px solid var(--skin-border, #e4e4e7);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--skin-card, #fff);
}
.row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.row-index {
  font-size: 12px;
  font-weight: 600;
  color: var(--skin-text-secondary, #666);
}
.row-actions {
  display: flex;
  gap: 2px;
}
.mini-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: inherit;
  padding: 3px;
  border-radius: 4px;
  display: inline-flex;
}
.mini-btn:hover:not(:disabled) {
  background: var(--skin-border, #e4e4e7);
}
.mini-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.mini-btn.is-danger:hover {
  color: #e34d59;
}
.block-item {
  border: 1px dashed var(--skin-border, #e4e4e7);
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
}
.block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}
.type-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--skin-btn-bg, #f0f0f0);
  color: var(--skin-text-secondary, #666);
  flex-shrink: 0;
}
.type-badge.is-heading {
  color: #1a1a1a;
  font-weight: 600;
}
.span-select {
  width: 84px;
}
.span-fixed {
  font-size: 11px;
  color: #999;
}
.block-head .mini-btn {
  margin-left: auto;
}
.add-block-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.add-hint {
  font-size: 11px;
  color: #999;
  flex-shrink: 0;
}
.chip-add {
  border: 1px dashed var(--skin-border, #d4d4d8);
  background: transparent;
  color: var(--skin-text-secondary, #666);
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 12px;
  cursor: pointer;
}
.chip-add:hover {
  border-color: #a1a1aa;
  color: var(--skin-text-primary, #333);
}
.empty-tip {
  text-align: center;
  font-size: 12px;
  color: #999;
  padding: 12px 0;
}
.footer-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.footer-row :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 0;
}
</style>
