<template>
  <AppDialog v-model="visible" title="组合管理" width="460px">
    <div class="pm">
      <!-- 新增组合 -->
      <div class="pm-add">
        <el-input v-model="newName" placeholder="输入新组合名称" size="small" @keyup.enter="onAdd" />
        <button class="btn primary" @click="onAdd">新增</button>
      </div>

      <!-- 组合列表 -->
      <div class="pm-list">
        <div v-for="p in portfolios" :key="p.id" class="pm-item">
          <!-- 重命名态 -->
          <template v-if="editingId === p.id">
            <el-input v-model="editingName" size="small" class="pm-edit-input" @keyup.enter="onRename(p.id)" />
            <div class="pm-ops">
              <button class="op" @click="onRename(p.id)">保存</button>
              <button class="op ghost" @click="editingId = ''">取消</button>
            </div>
          </template>
          <!-- 常态 -->
          <template v-else>
            <span class="pm-name" :class="{ current: p.id === currentId }">
              {{ p.name }}
              <em v-if="p.id === DEFAULT_ID" class="pm-tag">默认</em>
            </span>
            <div class="pm-ops">
              <button class="op" :disabled="p.id === currentId" @click="onSelect(p.id)">
                {{ p.id === currentId ? '当前' : '切换' }}
              </button>
              <button class="op ghost" :disabled="p.id === DEFAULT_ID" @click="startEdit(p)">重命名</button>
              <button class="op danger" :disabled="p.id === DEFAULT_ID" @click="onRemove(p)">删除</button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="btn" @click="visible = false">关闭</button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import AppDialog from '@/components/AppDialog.vue'
import { useEarningStore, DEFAULT_PORTFOLIO_ID } from '../store'
import type { Portfolio } from '../types'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', id: string): void
}>()

const store = useEarningStore()
const visible = computed<boolean>({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
const portfolios = store.portfolios
const currentId = store.currentPortfolioId
const DEFAULT_ID = DEFAULT_PORTFOLIO_ID

const newName = ref('')
const editingId = ref('')
const editingName = ref('')

async function onAdd() {
  const name = newName.value.trim()
  if (!name) return
  const id = await store.savePortfolio(name)
  newName.value = ''
  store.setCurrentPortfolio(id)
  emit('select', id)
}

function startEdit(p: Portfolio) {
  editingId.value = p.id
  editingName.value = p.name
}

async function onRename(id: string) {
  const name = editingName.value.trim()
  if (!name) return
  await store.renamePortfolio(id, name)
  editingId.value = ''
}

function onSelect(id: string) {
  store.setCurrentPortfolio(id)
  emit('select', id)
}

async function onRemove(p: Portfolio) {
  try {
    await ElMessageBox.confirm(
      `删除组合「${p.name}」后，其下持仓将移动到默认组合，确定删除？`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
    await store.removePortfolio(p.id)
    ElMessage.success('已删除组合')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="scss">
.pm {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 2px;

  .pm-add {
    display: flex;
    gap: 8px;
  }

  .pm-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 320px;
    overflow: auto;
  }

  .pm-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    background: var(--bg-card);

    .pm-name {
      font-size: 0.9rem;
      color: var(--text-primary);
      display: inline-flex;
      align-items: center;
      gap: 6px;

      &.current {
        color: var(--color-primary);
        font-weight: 600;
      }
      .pm-tag {
        font-style: normal;
        font-size: 0.68rem;
        padding: 1px 6px;
        border-radius: 5px;
        background: var(--bg-hover, rgba(0, 0, 0, 0.06));
        color: var(--text-muted);
      }
    }

    .pm-edit-input {
      flex: 1;
    }

    .pm-ops {
      display: flex;
      gap: 6px;
      flex-shrink: 0;

      .op {
        padding: 5px 10px;
        border: 1px solid var(--border-subtle);
        border-radius: 7px;
        background: transparent;
        color: var(--text-secondary);
        font-size: 0.78rem;
        cursor: pointer;

        &:hover:not(:disabled) {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }
        &:disabled {
          opacity: 0.5;
          cursor: default;
        }
        &.ghost:hover:not(:disabled) {
          border-color: var(--border-subtle);
          color: var(--text-secondary);
        }
        &.danger:hover:not(:disabled) {
          border-color: var(--color-error);
          color: var(--color-error);
        }
      }
    }
  }
}

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
</style>
