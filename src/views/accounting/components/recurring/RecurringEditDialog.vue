<!--
 * 记账 - 周期账单编辑弹窗（新增 / 修改共用）
 *
 * 字段：名称、支出/收入、金额、分类（按类型联动）、账户、周期（每周/每月/每年）、
 *       执行日（按周期联动：每月几号 / 每周几 / 每年某日）、下次执行日期（可改，填过去日期可补账）。
 * 保存直接调用 useAccounting store 的 addRecurring / updateRecurring，成功后 emit('saved')。
-->
<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑周期账单' : '新增周期账单'"
    width="420px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form class="rec-form" label-width="84px" label-position="left">
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="如：房租 / 视频会员" maxlength="30" />
      </el-form-item>
      <el-form-item label="类型">
        <el-radio-group v-model="form.type" @change="onTypeChange">
          <el-radio-button value="expense">支出</el-radio-button>
          <el-radio-button value="income">收入</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="每期金额" required>
        <el-input-number v-model="form.amount" :min="0.01" :max="99999999" :precision="2" :step="10" style="width: 160px" />
      </el-form-item>
      <el-form-item label="分类" required>
        <el-select v-model="form.category" placeholder="选择分类" style="width: 100%">
          <el-option
            v-for="c in typeCategories"
            :key="c.name"
            :label="c.name"
            :value="c.name"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="账户">
        <el-select v-model="form.account" placeholder="可选" clearable style="width: 100%">
          <el-option label="微信" value="微信" />
          <el-option label="支付宝" value="支付宝" />
          <el-option label="银行卡" value="银行卡" />
          <el-option label="现金" value="现金" />
        </el-select>
      </el-form-item>
      <el-form-item label="周期">
        <el-radio-group v-model="form.cycle" @change="onCycleChange">
          <el-radio-button value="weekly">每周</el-radio-button>
          <el-radio-button value="monthly">每月</el-radio-button>
          <el-radio-button value="yearly">每年</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item :label="dayLabel" required>
        <!-- 每月：1~31 号（当月无该日自动取月末） -->
        <el-select v-if="form.cycle === 'monthly'" v-model="form.day" style="width: 140px">
          <el-option v-for="d in 31" :key="d" :label="`${d} 号`" :value="String(d)" />
        </el-select>
        <!-- 每周：周一 ~ 周日 -->
        <el-select v-else-if="form.cycle === 'weekly'" v-model="form.day" style="width: 140px">
          <el-option v-for="(w, i) in WEEKDAYS" :key="w" :label="w" :value="String(i + 1)" />
        </el-select>
        <!-- 每年：选一个日期，取其月-日 -->
        <el-date-picker
          v-else
          :model-value="yearlyDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width: 160px"
          @update:model-value="onYearlyPick"
        />
      </el-form-item>
      <el-form-item label="下次执行" required>
        <el-date-picker
          v-model="form.next_date"
          type="date"
          value-format="YYYY-MM-DD"
          style="width: 160px"
        />
        <div class="next-tip">填过去日期会在保存后自动补记相应期数</div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import useAccounting from '@/store/useAccounting'
import {
  RECURRING_CYCLE_LABELS,
  type AccountingRecurring,
  type RecurringCycle,
} from '@/constants/accounting'

const props = defineProps<{
  /** 弹窗可见性（v-model） */
  modelValue: boolean
  /** 编辑目标；为空表示新增 */
  bill?: AccountingRecurring | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved'): void
}>()

const store = useAccounting()

/** 周几选项（1=周一 … 7=周日） */
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 是否编辑模式 */
const isEdit = computed(() => !!props.bill)
const saving = ref(false)

/** 表单数据 */
const form = ref({
  name: '',
  type: 'expense' as 'expense' | 'income',
  amount: 0,
  category: '',
  account: '',
  cycle: 'monthly' as RecurringCycle,
  day: '1',
  next_date: '',
})

/** 当前类型下可选的分类 */
const typeCategories = computed(() =>
  form.value.type === 'income' ? store.incomeCategories : store.expenseCategories,
)

/** 执行日字段标签随周期变化 */
const dayLabel = computed(() =>
  form.value.cycle === 'monthly' ? '每月几号' : form.value.cycle === 'weekly' ? '每周几' : '每年日期',
)

/** 每年周期下用于日期选择的临时值（MM-DD 补全年份） */
const yearlyDate = computed(() => `2000-${form.value.day || '01-01'}`)

/** 年度日期选择回调：取所选日期的月-日作为执行日 */
function onYearlyPick(v: string | null) {
  if (v) form.value.day = v.slice(5, 10)
}

/** 切换类型时清空已选分类（避免收入/支出分类错配） */
function onTypeChange() {
  form.value.category = ''
}

/** 切换周期时重置执行日为合理默认值 */
function onCycleChange() {
  if (form.value.cycle === 'yearly') {
    const d = new Date()
    form.value.day = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } else {
    form.value.day = '1'
  }
  form.value.next_date = store.defaultRecurringNextDate(form.value.cycle, form.value.day)
}

/** 打开弹窗时初始化表单（新增给默认值，编辑回填） */
watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    if (props.bill) {
      form.value = {
        name: props.bill.name,
        type: props.bill.type,
        amount: props.bill.amount,
        category: props.bill.category,
        account: props.bill.account || '',
        cycle: props.bill.cycle,
        day: props.bill.day,
        next_date: props.bill.next_date,
      }
    } else {
      const cycle: RecurringCycle = 'monthly'
      form.value = {
        name: '',
        type: 'expense',
        amount: 0,
        category: '',
        account: '',
        cycle,
        day: '1',
        next_date: store.defaultRecurringNextDate(cycle, '1'),
      }
    }
  },
  { immediate: true },
)

/**
 * 保存：校验后调用 store 新增 / 修改
 *
 * @throws 校验失败时仅 ElMessage 提示，不抛出
 */
async function save() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入账单名称')
    return
  }
  if (!form.value.amount || form.value.amount <= 0) {
    ElMessage.warning('请输入大于 0 的金额')
    return
  }
  if (!form.value.category) {
    ElMessage.warning('请选择分类')
    return
  }
  if (!form.value.day) {
    ElMessage.warning('请选择执行日')
    return
  }
  if (!form.value.next_date) {
    ElMessage.warning('请选择下次执行日期')
    return
  }
  saving.value = true
  try {
    if (props.bill?.id) {
      const ok = await store.updateRecurring(props.bill.id, {
        name: form.value.name.trim(),
        type: form.value.type,
        amount: form.value.amount,
        category: form.value.category,
        note: props.bill.note || '',
        account: form.value.account || '',
        cycle: form.value.cycle,
        day: form.value.day,
        next_date: form.value.next_date,
      })
      if (!ok) {
        ElMessage.error('保存失败')
        return
      }
      ElMessage.success('周期账单已更新')
    } else {
      const ok = await store.addRecurring({
        name: form.value.name.trim(),
        type: form.value.type,
        amount: form.value.amount,
        category: form.value.category,
        note: '',
        account: form.value.account || '',
        cycle: form.value.cycle,
        day: form.value.day,
        enabled: 1,
        next_date: form.value.next_date,
      })
      if (!ok) {
        ElMessage.error('保存失败')
        return
      }
      ElMessage.success(`周期账单已创建（${RECURRING_CYCLE_LABELS[form.value.cycle]}自动记账）`)
    }
    emit('update:modelValue', false)
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.rec-form {
  .next-tip {
    font-size: 11px;
    color: var(--el-text-color-secondary, #909399);
    line-height: 1.4;
    margin-top: 2px;
  }
}
</style>
