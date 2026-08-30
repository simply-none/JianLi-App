<!--
 * 记账 - 预算面板（完整页「预算」Tab 与小窗口共用）
 *
 * 功能：
 * - 月份切换（‹ ›），查看 / 维护该月的预算
 * - 月度总预算：未设置时可一键设置；已设置时展示 支出/预算 进度
 * - 分类预算：逐条展示 支出/预算 进度条；比例 >= 80% 黄色预警，超支红色高亮
 * - 支持新增 / 修改 / 删除分类预算（金额 <= 0 视为删除）
 * 数据来自 useAccounting store（预算子模块），超支系统通知在 store 记账动作内触发。
-->
<template>
  <div class="budget-panel" :class="{ compact }">
    <!-- 月份切换 -->
    <div class="bp-header">
      <span class="bp-title">
        <LucideIcon name="Wallet" :size="16" />
        预算
      </span>
      <div class="month-nav">
        <el-button class="nav-btn" size="small" @click="shiftMonth(-1)">
          <LucideIcon name="ArrowLeft" :size="14" />
        </el-button>
        <span class="month-label">{{ monthLabel }}</span>
        <el-button class="nav-btn" size="small" @click="shiftMonth(1)">
          <LucideIcon name="ArrowRight" :size="14" />
        </el-button>
      </div>
    </div>

    <!-- 月度总预算 -->
    <div class="total-card" :class="{ over: totalStatus?.over, near: totalStatus?.near }">
      <template v-if="totalStatus">
        <div class="tc-head">
          <span class="tc-label">本月总预算</span>
          <el-popover placement="bottom-end" :width="220" trigger="click">
            <template #reference>
              <el-button class="mini-btn" size="small" text>
                <LucideIcon name="Pencil" :size="13" />
              </el-button>
            </template>
            <div class="amount-editor">
              <div class="ae-title">修改总预算（元）</div>
              <el-input-number v-model="totalEditAmount" :min="0" :max="99999999" :precision="2" :step="100" style="width: 100%" />
              <div class="ae-actions">
                <el-button size="small" @click="removeTotalBudget">删除</el-button>
                <el-button size="small" type="primary" @click="saveTotalBudget">保存</el-button>
              </div>
            </div>
          </el-popover>
        </div>
        <el-progress
          :percentage="totalPercent"
          :stroke-width="10"
          :color="totalStatus.over ? '#f56c6c' : totalStatus.near ? '#e6a23c' : '#67c23a'"
        />
        <div class="tc-nums">
          <span>已支出 <b>{{ money(totalStatus.spent) }}</b></span>
          <span>预算 {{ money(totalStatus.budget) }}</span>
          <span v-if="totalStatus.over" class="over-tag">超支 {{ money(totalStatus.spent - totalStatus.budget) }}</span>
        </div>
      </template>
      <template v-else>
        <div class="tc-empty">
          <span class="tc-label">本月未设置总预算</span>
          <el-popover placement="bottom-end" :width="220" trigger="click">
            <template #reference>
              <el-button size="small" type="primary" plain>
                <LucideIcon name="Plus" :size="13" />
                设置总预算
              </el-button>
            </template>
            <div class="amount-editor">
              <div class="ae-title">本月总预算（元）</div>
              <el-input-number v-model="totalEditAmount" :min="0" :max="99999999" :precision="2" :step="100" style="width: 100%" />
              <div class="ae-actions">
                <el-button size="small" type="primary" @click="saveTotalBudget">保存</el-button>
              </div>
            </div>
          </el-popover>
        </div>
      </template>
    </div>

    <!-- 分类预算列表 -->
    <div class="cat-list">
      <div v-if="catStatuses.length === 0" class="empty-tip">
        该月暂无分类预算，点下方「添加分类预算」开始
      </div>
      <div
        v-for="s in catStatuses"
        :key="s.category"
        class="cat-row"
        :class="{ over: s.over, near: s.near }"
      >
        <div class="cr-icon" :style="{ background: catColor(s.category) }">
          <LucideIcon :name="catIcon(s.category)" :size="14" />
        </div>
        <div class="cr-main">
          <div class="cr-top">
            <span class="cr-name">{{ s.label }}</span>
            <span class="cr-nums" :class="{ over: s.over }">
              {{ money(s.spent) }} / {{ money(s.budget) }}
              <span v-if="s.over" class="cr-over-tag">
                <LucideIcon name="TriangleAlert" :size="11" />
                超支
              </span>
            </span>
          </div>
          <el-progress
            :percentage="rowPercent(s.ratio)"
            :stroke-width="7"
            :show-text="false"
            :color="s.over ? '#f56c6c' : s.near ? '#e6a23c' : '#67c23a'"
          />
        </div>
        <div class="cr-actions">
          <el-popover placement="bottom-end" :width="220" trigger="click">
            <template #reference>
              <el-button class="mini-btn" size="small" text>
                <LucideIcon name="Pencil" :size="13" />
              </el-button>
            </template>
            <div class="amount-editor">
              <div class="ae-title">修改「{{ s.label }}」预算（元）</div>
              <el-input-number :model-value="s.budget" :min="0" :max="99999999" :precision="2" :step="50" style="width: 100%" @change="(v: number | undefined) => (s.budget = Number(v) || 0)" />
              <div class="ae-actions">
                <el-button size="small" type="primary" @click="saveCategoryBudget(s.category, s.budget)">保存</el-button>
              </div>
            </div>
          </el-popover>
          <el-button class="mini-btn" size="small" text type="danger" @click="removeCategoryBudget(s.category)">
            <LucideIcon name="Trash2" :size="13" />
          </el-button>
        </div>
      </div>
    </div>

    <!-- 添加分类预算 -->
    <el-popover v-model:visible="addPop" placement="top-end" :width="240" trigger="click">
      <template #reference>
        <el-button class="add-btn" size="small" :disabled="availableCategories.length === 0">
          <LucideIcon name="Plus" :size="13" />
          添加分类预算
        </el-button>
      </template>
      <div class="amount-editor">
        <div class="ae-title">新分类预算（元）</div>
        <el-select v-model="addCategory" placeholder="选择分类" style="width: 100%" size="small">
          <el-option v-for="c in availableCategories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-input-number v-model="addAmount" :min="0" :max="99999999" :precision="2" :step="50" style="width: 100%; margin-top: 8px" />
        <div class="ae-actions">
          <el-button size="small" type="primary" :disabled="!addCategory" @click="saveAdd">保存</el-button>
        </div>
      </div>
    </el-popover>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import useAccounting from '@/store/useAccounting'
import { BUDGET_TOTAL_CATEGORY } from '@/constants/accounting'
import { currentMonth } from '../../utils/rangeUtils'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const store = useAccounting()

/** 当前查看的月份 YYYY-MM */
const month = ref(currentMonth())
const monthLabel = computed(() => `${month.value.slice(0, 4)}年${Number(month.value.slice(5, 7))}月`)

function shiftMonth(dir: number) {
  const [y, m] = month.value.split('-').map(Number)
  const dt = new Date(y, m - 1 + dir, 1)
  month.value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

function money(n: number) {
  return '¥' + (Number(n) || 0).toFixed(2)
}

/** 该月全部预算状态（store 返回总预算在首位） */
const monthStatuses = computed(() => store.monthStatus(month.value))

/** 总预算状态（可能为空 = 未设置） */
const totalStatus = computed(() => monthStatuses.value.find((s) => s.category === BUDGET_TOTAL_CATEGORY))

/** 分类预算状态列表（排除总预算） */
const catStatuses = computed(() => monthStatuses.value.filter((s) => s.category !== BUDGET_TOTAL_CATEGORY))

/** 总预算进度百分比（封顶 100） */
const totalPercent = computed(() => rowPercent(totalStatus.value?.ratio ?? 0))

/** 进度条百分比（封顶 100，保底 0） */
function rowPercent(ratio: number) {
  return Math.round(Math.min(Math.max(ratio, 0), 1) * 100)
}

/** 总预算编辑金额（打开编辑时由 popover 内容按需初始化） */
const totalEditAmount = ref(0)

/** 保存总预算 */
async function saveTotalBudget() {
  if (!totalEditAmount.value || totalEditAmount.value <= 0) {
    ElMessage.warning('请输入大于 0 的预算金额')
    return
  }
  const ok = await store.setBudget(month.value, BUDGET_TOTAL_CATEGORY, totalEditAmount.value)
  if (ok) ElMessage.success('总预算已保存')
}

/** 删除总预算 */
async function removeTotalBudget() {
  const ok = await store.removeBudget(month.value, BUDGET_TOTAL_CATEGORY)
  if (ok) ElMessage.success('总预算已删除')
}

/** 保存某分类预算（金额 <= 0 视为删除） */
async function saveCategoryBudget(category: string, amount: number) {
  if (!amount || amount <= 0) {
    ElMessage.warning('请输入大于 0 的预算金额')
    return
  }
  const ok = await store.setBudget(month.value, category, amount)
  if (ok) ElMessage.success('预算已保存')
}

/** 删除某分类预算 */
async function removeCategoryBudget(category: string) {
  const ok = await store.removeBudget(month.value, category)
  if (ok) ElMessage.success('预算已删除')
}

// —— 添加分类预算 ——
const addPop = ref(false)
const addCategory = ref('')
const addAmount = ref(500)

/** 该月还没设预算的支出分类（供新增选择） */
const availableCategories = computed(() => {
  const set = new Set(catStatuses.value.map((s) => s.category))
  return store.expenseCategories.filter((c) => !set.has(c.name)).map((c) => c.name)
})

/** 保存新增的分类预算 */
async function saveAdd() {
  if (!addCategory.value || !addAmount.value || addAmount.value <= 0) {
    ElMessage.warning('请选择分类并输入大于 0 的金额')
    return
  }
  const ok = await store.setBudget(month.value, addCategory.value, addAmount.value)
  if (ok) {
    ElMessage.success('预算已添加')
    addPop.value = false
    addCategory.value = ''
    addAmount.value = 500
  }
}

/** 分类图标（未配置时回退为通用图标） */
function catIcon(name: string) {
  return store.categories.find((c) => c.name === name)?.icon || 'CircleEllipsis'
}

/** 分类主题色 */
function catColor(name: string) {
  return store.categories.find((c) => c.name === name)?.color || '#909399'
}

// 切换月份时重置新增表单
watch(month, () => {
  addPop.value = false
  addCategory.value = ''
})
</script>

<style scoped lang="scss">
.budget-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow: auto;

  .bp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .bp-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 15px;
      font-weight: 600;
      color: var(--el-text-color-primary, #303133);
    }

    .month-nav {
      display: flex;
      align-items: center;
      gap: 6px;

      .month-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--el-text-color-primary, #303133);
        font-variant-numeric: tabular-nums;
        min-width: 76px;
        text-align: center;
      }
      .nav-btn {
        width: 26px;
        padding: 0;
      }
    }
  }

  // 总预算卡片
  .total-card {
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--el-bg-color-overlay, #fff);
    border: 1px solid var(--el-border-color-lighter, #e4e7ed);

    &.over {
      border-color: #f56c6c;
    }
    &.near {
      border-color: #e6a23c;
    }

    .tc-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .tc-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary, #303133);
    }
    .tc-nums {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 6px;
      font-size: 12px;
      color: var(--el-text-color-secondary, #909399);

      b {
        color: var(--el-text-color-primary, #303133);
        font-variant-numeric: tabular-nums;
      }
      .over-tag {
        color: #f56c6c;
        font-weight: 600;
      }
    }

    .tc-empty {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  }

  // 分类预算列表
  .cat-list {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .empty-tip {
      padding: 20px 0;
      text-align: center;
      font-size: 12px;
      color: var(--el-text-color-secondary, #909399);
    }

    .cat-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--el-bg-color-overlay, #fff);
      border: 1px solid var(--el-border-color-lighter, #e4e7ed);

      &.over {
        border-color: #f56c6c;
        background: color-mix(in srgb, #f56c6c 6%, var(--el-bg-color-overlay, #fff));
      }
      &.near {
        border-color: #e6a23c;
      }

      .cr-icon {
        flex-shrink: 0;
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        color: #fff;
      }

      .cr-main {
        flex: 1;
        min-width: 0;

        .cr-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;

          .cr-name {
            font-size: 13px;
            color: var(--el-text-color-primary, #303133);
          }
          .cr-nums {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: var(--el-text-color-secondary, #909399);
            font-variant-numeric: tabular-nums;

            &.over {
              color: #f56c6c;
            }
            .cr-over-tag {
              display: inline-flex;
              align-items: center;
              gap: 2px;
              color: #f56c6c;
              font-weight: 600;
            }
          }
        }
      }

      .cr-actions {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 2px;
      }
    }
  }

  .add-btn {
    align-self: flex-start;
  }

  .mini-btn {
    padding: 4px;
  }

  // ============ compact（小窗口） ============
  &.compact {
    gap: 8px;

    .bp-header .bp-title {
      font-size: 13px;
    }
    .month-nav .month-label {
      font-size: 12px;
      min-width: 70px;
    }
    .total-card {
      padding: 8px 10px;
    }
    .cat-row {
      padding: 8px 10px;
      gap: 8px;
    }
  }
}

// el-popover 内容 teleport 到 body，需非作用域样式
</style>

<style lang="scss">
// 预算金额编辑弹层
.amount-editor {
  .ae-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-primary, #303133);
    margin-bottom: 8px;
  }
  .ae-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 8px;
  }
}
</style>
