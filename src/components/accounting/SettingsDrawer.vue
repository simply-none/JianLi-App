<!--
 * 记账 - 设置抽屉（右侧弹窗）
 * 功能：分类设置 + 关键字设置，均平铺展示；支持分类与关键字的增删改。
 * - 分类：平铺彩色卡片，点击选中驱动下方关键字区；hover 可编辑/删除；「新增分类」弹框。
 * - 关键字：展示选中分类（默认第一个）的关键字，平铺 chip，hover 可改名/删除；底部输入新增。
 * - 跨分类去重：新增/改名关键字时，若该关键字已在「其他」分类下，提示「无法重复添加」。
 * 数据来自共用 store，落 SQLite（accounting_categories / accounting_keywords），改动后广播同步。
-->
<template>
  <el-drawer :model-value="modelValue" :direction="'rtl'" :size="compact ? '92%' : '440px'" :append-to-body="false"
    modal-class="accounting-settings-drawer" @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <template #header>
      <span class="sd-title">分类与关键字设置</span>
    </template>

    <template #default>
      <div class="settings-drawer">
        <!-- ===== 分类设置 ===== -->
        <section class="sd-section">
          <div class="sd-sec-head">
            <span class="sd-sec-title">
              <LucideIcon name="Tags" :size="15" />
              分类设置
            </span>
            <button type="button" class="sd-add-btn" @click="openCatDialog(null)">
              <LucideIcon name="Plus" :size="13" />
              新增分类
            </button>
          </div>

          <div class="cat-grid">
            <div v-for="cat in categories" :key="cat.name" class="cat-tile"
              :class="{ active: cat.name === selectedCategoryName }" :style="catTileStyle(cat)"
              @click="selectedCategoryName = cat.name">
              <LucideIcon :name="cat.icon" :size="16" class="cat-ico" :style="{ color: cat.color }" />
              <span class="cat-name">{{ cat.name }}</span>
              <span class="cat-type" :class="cat.type">{{ cat.type === 'expense' ? '支出' : '收入' }}</span>
              <span class="cat-actions" @click.stop>
                <button type="button" class="ca-btn" title="编辑" @click="openCatDialog(cat)">
                  <LucideIcon name="Pencil" :size="12" />
                </button>
                <button type="button" class="ca-btn danger" title="删除" @click="removeCategory(cat)">
                  <LucideIcon name="Trash2" :size="12" />
                </button>
              </span>
            </div>
          </div>
        </section>

        <!-- ===== 关键字设置 ===== -->
        <section class="sd-section">
          <div class="sd-sec-head">
            <span class="sd-sec-title">
              <LucideIcon name="Hash" :size="15" />
              「{{ selectedCategory?.name || '—' }}」的关键字
            </span>
          </div>

          <div v-if="selectedCategory" class="kw-grid">
            <div v-for="kw in selectedCategory.keywords" :key="kw" class="kw-chip">
              <input v-if="editingKeyword === kw" ref="editInput" v-model="editKeywordText" class="kw-edit-input"
                spellcheck="false" @keyup.enter="confirmEditKeyword(kw)" @keyup.esc="cancelEditKeyword"
                @blur="confirmEditKeyword(kw)" />
              <template v-else>
                <span class="kw-text">{{ kw }}</span>
                <span class="kw-actions" @click.stop>
                  <button type="button" class="kw-btn" title="改名" @click="startEditKeyword(kw)">
                    <LucideIcon name="Pencil" :size="11" />
                  </button>
                  <button type="button" class="kw-btn danger" title="删除" @click="removeKeyword(kw)">
                    <LucideIcon name="X" :size="11" />
                  </button>
                </span>
              </template>
            </div>

            <div v-if="!selectedCategory.keywords.length" class="kw-empty">该分类暂无关键字</div>
          </div>
          <div v-else class="kw-empty">请选择左侧分类</div>

          <!-- 新增关键字 -->
          <div class="kw-add">
            <el-input v-model="newKeyword" size="small" placeholder="输入关键字后回车新增" @keyup.enter="addNewKeyword">
              <template #prefix>
                <LucideIcon name="Plus" :size="13" />
              </template>
            </el-input>
            <button type="button" class="sd-add-btn solid" @click="addNewKeyword">
              新增
            </button>
          </div>
        </section>
      </div>
    </template>
  </el-drawer>

  <!-- 分类新增/编辑弹框 -->
  <el-dialog v-model="catDialogVisible" :title="catEditingName ? '编辑分类' : '新增分类'" width="320px" align-center
    append-to-body>
    <div class="cat-form">
      <label class="cf-row">
        <span class="cf-label">名称</span>
        <el-input v-model="catForm.name" size="small" placeholder="如：餐饮" />
      </label>
      <label class="cf-row">
        <span class="cf-label">类型</span>
        <el-radio-group v-model="catForm.type" size="small">
          <el-radio value="expense">支出</el-radio>
          <el-radio value="income">收入</el-radio>
        </el-radio-group>
      </label>
      <label class="cf-row">
        <span class="cf-label">图标</span>
        <el-select v-model="catForm.icon" size="small" class="cf-icon">
          <el-option v-for="ic in CATEGORY_ICONS" :key="ic" :label="ic" :value="ic" />
        </el-select>
      </label>
      <label class="cf-row">
        <span class="cf-label">颜色</span>
        <el-color-picker v-model="catForm.color" size="small" />
      </label>
    </div>
    <template #footer>
      <el-button size="small" @click="catDialogVisible = false">取消</el-button>
      <el-button size="small" type="primary" @click="saveCategory">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import useAccounting from '@/store/useAccounting'
import type { AccountingCategory, AccountingType } from '@/constants/accounting'

const props = withDefaults(defineProps<{ modelValue: boolean; compact?: boolean }>(), {
  compact: false,
})
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const store = useAccounting()
const { categories } = storeToRefs(store)

/** 选中的分类（默认第一个） */
const selectedCategoryName = ref('')
const selectedCategory = computed(
  () => categories.value.find((c) => c.name === selectedCategoryName.value) || null,
)

/** 打开抽屉时默认选中第一个分类 */
watch(
  () => props.modelValue,
  (open) => {
    if (open && !selectedCategoryName.value && categories.value.length) {
      selectedCategoryName.value = categories.value[0].name
    }
  },
  { immediate: true },
)

/** 分类卡片样式（选中态用分类色描边/底色） */
function catTileStyle(cat: AccountingCategory) {
  const active = cat.name === selectedCategoryName.value
  return {
    borderColor: active ? cat.color : 'var(--border-subtle, #e4e7ed)',
    background: active ? `color-mix(in srgb, ${cat.color} 12%, var(--bg-card, #fff))` : 'var(--bg-card, #fff)',
  }
}

// ============ 关键字：增删改 ============
const newKeyword = ref('')
const editingKeyword = ref('')
const editKeywordText = ref('')
const editInput = ref<HTMLInputElement | null>(null)

/** 跨分类查重：返回拥有该关键字的其他分类名（无则 null） */
function keywordOwnerInOther(keyword: string, exceptCategory: string): string | null {
  const kw = keyword.trim()
  if (!kw) return null
  const owner = categories.value.find(
    (c) => c.name !== exceptCategory && (c.keywords || []).includes(kw),
  )
  return owner ? owner.name : null
}

/** 新增关键字 */
async function addNewKeyword() {
  const kw = (newKeyword.value || '').trim()
  if (!kw) return
  const cat = selectedCategory.value
  if (!cat) {
    ElMessage.warning('请先选择一个分类')
    return
  }
  // 同分类内已存在 → 不重复添加
  if ((cat.keywords || []).includes(kw)) {
    ElMessage.info(`「${cat.name}」已包含关键字「${kw}」`)
    newKeyword.value = ''
    return
  }
  // 跨分类去重
  const owner = keywordOwnerInOther(kw, cat.name)
  if (owner) {
    ElMessage.warning(`该关键字已在「${owner}」分类下，无法重复添加`)
    return
  }
  await store.addKeyword(cat.name, kw)
  newKeyword.value = ''
}

/** 开始行内改名 */
function startEditKeyword(kw: string) {
  editingKeyword.value = kw
  editKeywordText.value = kw
  nextTick(() => editInput.value?.focus())
}

/** 确认改名 */
async function confirmEditKeyword(oldKw: string) {
  if (!editingKeyword.value) return
  const cat = selectedCategory.value
  const newKw = (editKeywordText.value || '').trim()
  editingKeyword.value = ''
  if (!cat || !newKw || newKw === oldKw) return
  // 跨分类去重（新值）
  const owner = keywordOwnerInOther(newKw, cat.name)
  if (owner) {
    ElMessage.warning(`该关键字已在「${owner}」分类下，无法重复添加`)
    return
  }
  await store.updateKeyword(cat.name, oldKw, newKw)
}

/** 取消改名 */
function cancelEditKeyword() {
  editingKeyword.value = ''
}

/** 删除关键字 */
async function removeKeyword(kw: string) {
  const cat = selectedCategory.value
  if (!cat) return
  await store.deleteKeyword(cat.name, kw)
}

// ============ 分类：增删改（弹框） ============
const catDialogVisible = ref(false)
const catEditingName = ref<string | null>(null)
const catForm = ref<{ name: string; type: AccountingType; icon: string; color: string }>({
  name: '',
  type: 'expense',
  icon: 'CircleEllipsis',
  color: '#6B7280',
})

/** 分类可选图标（复用既有分类图标，确保 LucideIcon 已注册） */
const CATEGORY_ICONS = [
  'UtensilsCrossed', 'Car', 'ShoppingBag', 'Home', 'Gamepad2', 'HeartPulse',
  'BookOpen', 'Smartphone', 'Gift', 'CircleEllipsis', 'Wallet', 'Trophy',
  'TrendingUp', 'Briefcase', 'HandCoins', 'RotateCcw',
]

function openCatDialog(cat: AccountingCategory | null) {
  if (cat) {
    catEditingName.value = cat.name
    catForm.value = { name: cat.name, type: cat.type, icon: cat.icon, color: cat.color }
  } else {
    catEditingName.value = null
    catForm.value = { name: '', type: 'expense', icon: 'CircleEllipsis', color: '#6B7280' }
  }
  catDialogVisible.value = true
}

async function saveCategory() {
  const name = (catForm.value.name || '').trim()
  if (!name) {
    ElMessage.warning('请输入分类名称')
    return
  }
  // 重名校验（排除自身）
  const dup = categories.value.find(
    (c) => c.name === name && c.name !== catEditingName.value,
  )
  if (dup) {
    ElMessage.warning(`已存在分类「${name}」`)
    return
  }
  const patch: Partial<AccountingCategory> = {
    name,
    type: catForm.value.type,
    icon: catForm.value.icon,
    color: catForm.value.color,
  }
  if (catEditingName.value) {
    // 编辑：仅更新基础字段，不传 keywords，避免清空该分类已有关键字
    await store.updateCategory(catEditingName.value, patch)
  } else {
    // 新增：keywords 初始为空，后续在关键字区添加
    await store.addCategory({ name, type: catForm.value.type, icon: catForm.value.icon, color: catForm.value.color, keywords: [] })
  }
  catDialogVisible.value = false
  // 新增后选中它，便于接着加关键字
  if (!catEditingName.value) selectedCategoryName.value = name
}

async function removeCategory(cat: AccountingCategory) {
  try {
    await ElMessageBox.confirm(`确认删除分类「${cat.name}」？其下关键字也会一并删除。`, '删除分类', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  await store.deleteCategory(cat.name)
  // 若删除的是当前选中，回退到第一个
  if (selectedCategoryName.value === cat.name) {
    selectedCategoryName.value = categories.value[0]?.name || ''
  }
}
</script>

<style lang="scss">
.accounting-settings-drawer {
  .el-drawer__header {
    margin-bottom: 0;

    .sd-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary, #303133);
    }
  }

  .el-drawer__body {
    padding: 8px 16px 16px;
    overflow: auto;
  }
}

.settings-drawer {
  .sd-section {
    margin-bottom: 18px;
  }

  .sd-sec-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .sd-sec-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, #303133);
  }

  // 新增按钮
  .sd-add-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 4px 10px;
    border: 1px solid var(--border-subtle, #e4e7ed);
    border-radius: 7px;
    background: var(--bg-card, #fff);
    color: var(--color-primary, #409eff);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: var(--bg-hover, #f5f7fa);
    }

    &.solid {
      color: #fff;
      background: var(--color-primary, #409eff);
      border-color: var(--color-primary, #409eff);
    }
  }

  // ===== 分类平铺网格 =====
  .cat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
  }

  .cat-tile {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border: 1px solid var(--border-subtle, #e4e7ed);
    border-radius: 9px;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;

    .cat-ico {
      flex-shrink: 0;
    }

    .cat-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary, #303133);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cat-type {
      margin-left: auto;
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 5px;
      flex-shrink: 0;

      &.expense {
        color: #f56c6c;
        background: rgba(245, 108, 108, 0.12);
      }

      &.income {
        color: #67c23a;
        background: rgba(103, 194, 58, 0.12);
      }
    }

    .cat-actions {
      position: absolute;
      top: 4px;
      right: 4px;
      display: none;
      gap: 2px;
    }

    &:hover .cat-actions {
      display: flex;
    }

    .ca-btn {
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 5px;
      background: var(--bg-hover, #f0f0f0);
      color: var(--text-muted, #999);
      cursor: pointer;

      &:hover {
        color: var(--text-primary, #303133);
      }

      &.danger:hover {
        color: #f56c6c;
      }
    }
  }

  // ===== 关键字平铺 =====
  .kw-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 32px;
  }

  .kw-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: 1px solid var(--border-subtle, #e4e7ed);
    border-radius: 14px;
    background: var(--bg-card, #fff);
    font-size: 12px;
    color: var(--text-secondary, #606266);

    .kw-text {
      max-width: 160px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .kw-actions {
      display: none;
      gap: 2px;
    }

    &:hover .kw-actions {
      display: flex;
    }

    .kw-btn {
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: var(--text-muted, #999);
      cursor: pointer;

      &:hover {
        color: var(--text-primary, #303133);
      }

      &.danger:hover {
        color: #f56c6c;
      }
    }

    .kw-edit-input {
      width: 110px;
      border: none;
      outline: none;
      background: transparent;
      font-size: 12px;
      color: var(--text-primary, #303133);
    }
  }

  .kw-empty {
    font-size: 12px;
    color: var(--text-muted, #999);
    padding: 6px 0;
  }

  .kw-add {
    display: flex;
    gap: 8px;
    margin-top: 10px;

    .sd-add-btn {
      flex-shrink: 0;
    }
  }
}

// 分类弹框（el-dialog 默认 append-to-body，挂在 body 下，故样式需全局）
.cat-form {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .cf-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .cf-label {
    width: 44px;
    flex-shrink: 0;
    font-size: 13px;
    color: var(--text-secondary, #606266);
  }

  .cf-icon {
    flex: 1;
  }
}
</style>
