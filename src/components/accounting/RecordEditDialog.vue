<!--
 * 记账 - 记录编辑弹窗（满足「可修改」需求）
 * 修改金额 / 分类 / 备注 / 日期 / 账户，确认后调用 store.updateRecord 落库。
 * 大类（收入/支出）编辑时锁定不可修改：仅当前类型可选，另一类型禁用，避免收入改支出。
 * 分类改为平铺展示（图标 + 名称的 chip，点选即选中，当前项高亮），避免下拉无数据问题。
-->
<template>
  <el-dialog
    :model-value="modelValue"
    title="编辑记录"
    width="420px"
    :append-to-body="true"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="syncFromRecord"
  >
    <div v-if="form" class="edit-body">
      <div class="field">
        <!-- 编辑时锁定大类：仅当前类型可选，另一类型禁用，避免收入/支出互改 -->
        <el-radio-group v-model="form.type" class="edit-type">
          <el-radio-button value="expense" :disabled="form.type !== 'expense'">支出</el-radio-button>
          <el-radio-button value="income" :disabled="form.type !== 'income'">收入</el-radio-button>
        </el-radio-group>
      </div>

      <div class="field">
        <label>金额</label>
        <el-input v-model="form.amount" type="number" :prefix-icon="undefined">
          <template #prefix>¥</template>
        </el-input>
      </div>

      <!-- 分类：平铺展示 -->
      <div class="field">
        <label>分类</label>
        <div class="edit-cats">
          <button
            v-for="c in catList"
            :key="c.name"
            type="button"
            class="cat-chip"
            :class="{ active: form.category === c.name }"
            :style="chipStyle(c)"
            :title="c.name"
            @click="form.category = c.name"
          >
            <LucideIcon :name="c.icon" :size="14" />
            <span>{{ c.name }}</span>
          </button>
          <span v-if="catList.length === 0" class="cat-empty">暂无分类，请先在「设置」中添加</span>
        </div>
      </div>

      <div class="field">
        <label>备注</label>
        <el-input v-model="form.note" placeholder="备注/商户名" />
      </div>

      <div class="field">
        <label>日期</label>
        <el-date-picker
          v-model="form.record_date"
          type="date"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </div>

      <div class="field">
        <label>账户</label>
        <el-select v-model="form.account" placeholder="账户（可选）" clearable style="width: 100%">
          <el-option label="微信" value="微信" />
          <el-option label="支付宝" value="支付宝" />
          <el-option label="银行卡" value="银行卡" />
          <el-option label="现金" value="现金" />
        </el-select>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="onSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import useAccounting from '@/store/useAccounting'
import type { AccountingCategory, AccountingRecord, AccountingType } from '@/constants/accounting'

const props = defineProps<{
  modelValue: boolean
  record: AccountingRecord | null
}>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const store = useAccounting()
const { expenseCategories, incomeCategories, categories } = storeToRefs(store)

const form = ref<AccountingRecord | null>(null)

/** 当前类型下的可选分类（平铺网格的数据源） */
const catList = computed<AccountingCategory[]>(() =>
  (form.value?.type || 'expense') === 'expense'
    ? expenseCategories.value
    : incomeCategories.value,
)

/** 选中 chip 的描边/底色用分类自身颜色 */
function chipStyle(c: AccountingCategory) {
  if (form.value?.category === c.name) {
    return {
      borderColor: c.color,
      color: c.color,
      background: `color-mix(in srgb, ${c.color} 12%, transparent)`,
    }
  }
  return {}
}

// 打开时从 record 同步到表单；若分类尚未加载则兜底加载一次
async function syncFromRecord() {
  if (props.record) {
    form.value = { ...props.record }
  }
  if (categories.value.length === 0) {
    await store.loadCategories()
  }
}

watch(
  () => props.record,
  (r) => {
    if (r) form.value = { ...r }
  },
)

async function onSave() {
  if (!form.value || form.value.id == null) return
  const amt = Number(form.value.amount)
  if (!amt || amt <= 0) {
    ElMessage.warning('请输入有效金额')
    return
  }
  if (!form.value.category) {
    ElMessage.warning('请选择分类')
    return
  }
  const ok = await store.updateRecord(form.value.id, {
    type: form.value.type,
    amount: amt,
    category: form.value.category,
    note: form.value.note,
    account: form.value.account,
    record_date: form.value.record_date,
  })
  if (ok) {
    ElMessage.success('已更新')
    emit('update:modelValue', false)
    emit('saved')
  } else {
    ElMessage.error('保存失败')
  }
}
</script>

<style scoped lang="scss">
.edit-body {
  display: flex;
  flex-direction: column;
  gap: 14px;

  .edit-type {
    align-self: flex-start;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    label {
      font-size: 13px;
      color: var(--text-secondary, #606266);
    }
  }
}

/* 分类平铺网格 */
.edit-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .cat-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--border-subtle, #e4e7ed);
    border-radius: 8px;
    background: var(--bg-card, #fff);
    color: var(--text-primary, #303133);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

    &:hover {
      background: var(--bg-hover, #f5f7fa);
    }
    &.active {
      font-weight: 600;
      border-width: 1.5px;
    }
  }

  .cat-empty {
    font-size: 13px;
    color: var(--text-muted, #999);
  }
}
</style>
