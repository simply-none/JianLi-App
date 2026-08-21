<!--
 * 记账 - 记账表单（完整页与小窗口共用）
 * 功能：支出/收入切换、便捷金额输入（回车保存）、分类 Popover 选择、备注、日期、账户。
 * 布局：
 *   - 默认（inline=false）：纵向堆叠，适合侧栏/独立区块。
 *   - inline=true：单行紧凑横条（宽度不足时自动折行），用于「记录列表」Tab 底部的记账条。
 * 自动匹配：输入备注时实时调用 matchCategory（关键词规则 + 历史学习），
 *          命中即直接切换分类（即使与当前手动选择的分类不一致也切换），下方提示作为反馈。
-->
<template>
  <div class="record-form" :class="{ compact, inline }">
    <!-- 控件主体：纵向 / 横条由 CSS 切换，DOM 保持扁平 -->
    <div class="rf-main">
      <!-- 收支类型切换 -->
      <el-radio-group v-model="type" :size="typeSize" class="f-type">
        <el-radio-button value="expense">支出</el-radio-button>
        <el-radio-button value="income">收入</el-radio-button>
      </el-radio-group>

      <!-- 金额输入 -->
      <div class="f-amount">
        <AmountInput
          v-model="amount"
          :autofocus="autofocus"
          :compact="compact"
          @confirm="onSave"
        />
      </div>

      <!-- 分类选择（Popover） -->
      <div class="f-cat">
        <CategorySelector
          v-model="category"
          :categories="catList"
          :matched="suggested?.category"
          :compact="compact"
        />
      </div>

      <!-- 备注 -->
      <el-input
        v-model="note"
        class="f-note"
        :placeholder="notePlaceholder"
        :size="ctrlSize"
        clearable
        @keyup.enter="onSave"
      />

      <!-- 日期 -->
      <el-date-picker
        v-model="date"
        class="f-date"
        type="date"
        value-format="YYYY-MM-DD"
        format="MM-DD"
        placeholder="日期"
        :size="ctrlSize"
        :clearable="false"
      />

      <!-- 账户 -->
      <el-select
        v-model="account"
        class="f-account"
        placeholder="账户"
        clearable
        :size="ctrlSize"
      >
        <el-option label="微信" value="微信" />
        <el-option label="支付宝" value="支付宝" />
        <el-option label="银行卡" value="银行卡" />
        <el-option label="现金" value="现金" />
      </el-select>

      <!-- 保存 -->
      <el-button type="primary" class="f-save" :size="ctrlSize" @click="onSave">
        <LucideIcon name="Plus" :size="15" color="#fff" />
        保存
      </el-button>
    </div>

    <!-- 智能匹配提示（命中即已切换分类，此处作为反馈）+ 回车提示 -->
    <div class="rf-hint">
      <transition name="fade">
        <span v-if="suggested?.category" class="match-hint">
          <LucideIcon name="Wand" :size="12" />
          <template v-if="suggested.source === 'history'">
            已按历史匹配「{{ suggested.category }}」
          </template>
          <template v-else>
            已识别「{{ suggested.matchedKeyword }}」→ 「{{ suggested.category }}」
          </template>
        </span>
      </transition>
      <span class="enter-hint">回车快速保存</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import AmountInput from './AmountInput.vue'
import CategorySelector from './CategorySelector.vue'
import LucideIcon from '@/components/LucideIcon.vue'
import useAccounting from '@/store/useAccounting'
import { matchCategory, type CategoryMatchResult } from '@/utils/autoCategory'
import type { AccountingType } from '@/constants/accounting'

const props = withDefaults(
  defineProps<{ compact?: boolean; autofocus?: boolean; inline?: boolean }>(),
  { compact: false, autofocus: false, inline: false },
)
const emit = defineEmits<{ saved: [] }>()

const store = useAccounting()
const { expenseCategories, incomeCategories, records } = storeToRefs(store)

const type = ref<AccountingType>('expense')
const amount = ref('')
const category = ref('')
const note = ref('')
const date = ref(todayStr())
const account = ref('')

/** 控件尺寸：横条在完整页用 default（更大），小窗保持 small 以适配窄屏 */
const ctrlSize = computed<'small' | 'default'>(() =>
  props.compact ? 'small' : 'default',
)
/** 收支切换：横条用 default（更大），纵向用 large */
const typeSize = computed<'small' | 'default' | 'large'>(() =>
  props.inline ? 'default' : 'large',
)

/** 备注占位文案：横条模式更短 */
const notePlaceholder = computed(() => {
  if (props.inline) return type.value === 'expense' ? '备注/商户名' : '备注'
  return type.value === 'expense' ? '备注/商户名，如：美团外卖' : '备注，如：工资到账'
})

/** 当前类型对应的分类列表 */
const catList = computed(() =>
  type.value === 'expense' ? expenseCategories.value : incomeCategories.value,
)

/** 实时自动匹配结果 */
const suggested = computed<CategoryMatchResult | null>(() => {
  if (!note.value.trim()) return null
  return matchCategory(note.value, catList.value, records.value)
})

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 备注变化：命中推荐分类即直接切换（即使与当前分类不一致也切换）
watch(note, () => {
  if (suggested.value?.category) {
    category.value = suggested.value.category
  }
})

// 切换收支类型后重置分类选择
watch(type, () => {
  category.value = ''
})

async function onSave() {
  const amt = Number(amount.value)
  if (!amt || amt <= 0) {
    ElMessage.warning('请输入有效金额')
    return
  }
  if (!category.value) {
    ElMessage.warning('请选择分类')
    return
  }
  const ok = await store.addRecord({
    type: type.value,
    amount: amt,
    category: category.value,
    note: note.value.trim(),
    account: account.value || '',
    record_date: date.value || todayStr(),
  })
  if (ok) {
    ElMessage.success('已记一笔')
    // 保留类型、分类、账户以便连续记账；清空金额与备注
    amount.value = ''
    note.value = ''
    emit('saved')
  } else {
    ElMessage.error('保存失败，请重试')
  }
}
</script>

<style scoped lang="scss">
.record-form {
  .rf-main {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }

  .rf-hint {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-top: 6px;

    .match-hint {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--color-primary, #409eff);
    }

    .enter-hint {
      font-size: 11px;
      color: var(--text-muted, #aaa);
    }
  }

  // ============ 纵向布局（默认） ============
  &:not(.inline) .rf-main {
    // 多数控件独占一行，日期与账户同行
    .f-type,
    .f-amount,
    .f-cat,
    .f-note,
    .f-save {
      flex: 0 0 100%;
    }
    .f-date {
      width: 140px;
    }
    .f-account {
      flex: 1;
      min-width: 0;
    }
    .f-save {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-weight: 600;
    }
  }

  // ============ 横条布局（Tab 底部记账条） ============
  &.inline {
    .rf-main {
      gap: 8px;
    }
    .f-amount {
      width: 132px;
      flex-shrink: 0;
    }
    .f-cat {
      flex-shrink: 0;
    }
    .f-note {
      flex: 1 1 150px;
      min-width: 130px;
    }
    .f-date {
      width: 118px;
      flex-shrink: 0;
    }
    .f-account {
      width: 104px;
      flex-shrink: 0;
    }
    .f-save {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 600;
    }

    // 金额框在横条内：高一点、字大一点，与 default 控件高度对齐
    :deep(.amount-input) {
      padding: 5px 12px;
      border-radius: 8px;
    }
    :deep(.amount-input .currency) {
      font-size: 18px;
    }
    :deep(.amount-input .amount-field) {
      font-size: 22px;
    }

    .rf-hint {
      flex-direction: row;
      align-items: center;
      gap: 10px;
      margin-top: 6px;
      min-height: 16px;

      .enter-hint {
        margin-left: auto;
      }
    }
  }

  // ============ 横条 + 小窗口（宽度约 360px，自动折成多行） ============
  &.inline.compact {
    .rf-main {
      gap: 6px;
    }
    .f-amount {
      width: 108px;
    }
    .f-note {
      flex: 1 1 120px;
      min-width: 100px;
    }
    .f-date {
      width: 100px;
    }
    .f-account {
      width: 88px;
    }
    :deep(.amount-input) {
      padding: 2px 8px;
    }
    :deep(.amount-input .amount-field) {
      font-size: 16px;
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
