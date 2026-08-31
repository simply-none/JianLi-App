<template>
  <AppDialog v-model="visible" :title="isEdit ? '编辑持仓' : '添加持仓'" width="460px">
    <div class="edit-form">
      <div class="form-row">
        <label class="form-label">类型</label>
        <el-select v-model="form.type" class="form-control" :disabled="isEdit">
          <el-option label="股票 / ETF" value="stock" />
          <el-option label="场外基金" value="fund" />
        </el-select>
      </div>

      <div class="form-row">
        <label class="form-label">代码</label>
        <el-input
          v-model="form.code"
          :placeholder="form.type === 'stock' ? '如 sh600519 / sz000001' : '如 660001'"
          :disabled="isEdit"
        />
      </div>

      <div class="form-row">
        <label class="form-label">名称</label>
        <el-input v-model="form.name" placeholder="可选，留空用代码展示" />
      </div>

      <div class="form-row">
        <label class="form-label">{{ form.type === 'fund' ? '持有份额' : '持股数量' }}</label>
        <el-input-number v-model="form.shares" :min="0" :precision="4" :step="1" controls-position="right" />
      </div>

      <div class="form-row">
        <label class="form-label">{{ form.type === 'fund' ? '申购净值' : '买入价' }}</label>
        <el-input-number
          v-model="form.costPrice"
          :min="0"
          :precision="4"
          :step="0.01"
          controls-position="right"
        />
      </div>

      <div class="form-row">
        <label class="form-label">所属组合</label>
        <el-select v-model="form.portfolioId" class="form-control" :disabled="!portfolios.length">
          <el-option v-for="p in portfolios" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
      </div>

      <div class="form-row">
        <label class="form-label">买入日期</label>
        <el-date-picker v-model="form.buyDate" type="date" value-format="YYYY-MM-DD" placeholder="可选" />
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <button class="btn" @click="visible = false">取消</button>
        <button class="btn primary" @click="onSubmit">保存</button>
      </div>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import AppDialog from '@/components/AppDialog.vue'
import { useEarningStore } from '../store'
import type { Holding, HoldingType } from '../types'

const props = defineProps<{ modelValue: boolean; edit?: Holding | null; portfolioId?: string }>()
const store = useEarningStore()
const portfolios = store.portfolios
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'submit', form: Omit<Holding, 'key' | 'created_at'> & { key?: string }): void
}>()

const visible = computed<boolean>({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
const isEdit = computed(() => !!props.edit)

const form = reactive<{
  type: HoldingType
  code: string
  name: string
  shares: number
  costPrice: number
  buyDate: string
  portfolioId: string
}>({
  type: 'stock',
  code: '',
  name: '',
  shares: 0,
  costPrice: 0,
  buyDate: '',
  portfolioId: 'default',
})
const error = ref('')

/** 打开弹窗时根据 edit 填充表单 */
watch(
  () => [props.modelValue, props.edit] as const,
  ([open]) => {
    if (!open) return
    error.value = ''
    if (props.edit) {
      const e = props.edit
      form.type = e.type
      form.code = e.code
      form.name = e.name
      form.shares = e.shares
      form.costPrice = e.costPrice
      form.buyDate = e.buyDate || ''
      form.portfolioId = e.portfolioId || 'default'
    } else {
      form.type = 'stock'
      form.code = ''
      form.name = ''
      form.shares = 0
      form.costPrice = 0
      form.buyDate = ''
      form.portfolioId = props.portfolioId || 'default'
    }
  },
  { immediate: true },
)

function onSubmit() {
  const code = form.code.trim()
  if (!code) {
    error.value = '请输入代码'
    return
  }
  if (!(form.shares > 0)) {
    error.value = '持仓数量必须大于 0'
    return
  }
  if (form.costPrice < 0) {
    error.value = '成本不能为负'
    return
  }
  const payload: Omit<Holding, 'key' | 'created_at'> & { key?: string } = {
    type: form.type,
    code,
    name: form.name.trim() || code,
    shares: form.shares,
    costPrice: form.costPrice,
    buyDate: form.buyDate || undefined,
    portfolioId: form.portfolioId || 'default',
  }
  if (props.edit) payload.key = props.edit.key
  emit('submit', payload)
}
</script>

<style scoped lang="scss">
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 2px;

  .form-row {
    display: flex;
    align-items: center;
    gap: 12px;

    .form-label {
      width: 92px;
      flex: 0 0 92px;
      font-size: 0.85rem;
      color: var(--text-secondary);
      text-align: right;
    }
    .form-control {
      flex: 1;
      min-width: 0;
    }
  }

  .form-error {
    margin: 0;
    color: var(--color-error);
    font-size: 0.8rem;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;

  .btn {
    padding: 7px 16px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn, 10px);
    background: var(--bg-card);
    color: var(--text-secondary);
    font-size: 0.85rem;
    cursor: pointer;

    &.primary {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #fff;
    }
  }
}
</style>
