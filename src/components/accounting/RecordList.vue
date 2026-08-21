<!--
 * 记账 - 记录列表（完整页与小窗口共用）
 * 按日期分组展示；每行显示分类图标/名称、备注、金额（支出红/收入绿）、账户。
 * 支持行内编辑（emit edit）与删除（带确认）。compact 模式限制条数。
-->
<template>
  <div class="record-list" :class="{ compact }" @contextmenu.prevent="onListContextMenu">
    <el-empty v-if="!list.length" :description="emptyText" :image-size="compact ? 50 : 80" />

    <template v-for="group in grouped" :key="group.date">
      <div class="group-date">{{ group.date }}</div>
      <div
        v-for="rec in group.items"
        :key="rec.id"
        class="record-row"
        :class="{ compact }"
        @contextmenu.prevent="openMenu($event, rec)"
      >
        <div class="cat-icon" :style="{ background: catColor(rec.category) }">
          <LucideIcon :name="catIcon(rec.category)" :size="compact ? 14 : 16" color="#fff" />
        </div>
        <div class="rec-main">
          <div class="rec-top">
            <span class="rec-cat">{{ rec.category }}</span>
            <span v-if="rec.note" class="rec-note">{{ rec.note }}</span>
          </div>
          <div class="rec-sub">
            <span v-if="rec.account" class="rec-account">{{ rec.account }}</span>
            <span class="rec-time">{{ rec.created_at?.slice(11, 16) }}</span>
          </div>
        </div>
        <div class="rec-amount" :class="rec.type">
          {{ rec.type === 'expense' ? '-' : '+' }}{{ money(rec.amount) }}
        </div>
        <div class="rec-ops">
          <button class="op-btn" title="编辑" @click="$emit('edit', rec)">
            <LucideIcon name="Pencil" :size="14" />
          </button>
          <button class="op-btn danger" title="删除" @click="onDelete(rec)">
            <LucideIcon name="Trash2" :size="14" />
          </button>
        </div>
      </div>
    </template>

    <!-- 右键菜单（position: fixed，仍属 .accounting-page 的 DOM 后代，可继承小窗皮肤变量） -->
    <div
      v-if="menu.visible && menu.rec"
      class="rec-ctx-menu"
      :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      @click.stop
    >
      <button type="button" class="ctx-item" @click="doEdit">
        <LucideIcon name="Pencil" :size="14" />
        <span>编辑</span>
      </button>
      <button type="button" class="ctx-item danger" @click="doDelete">
        <LucideIcon name="Trash2" :size="14" />
        <span>删除</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessageBox, ElMessage } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import useAccounting from '@/store/useAccounting'
import type { AccountingRecord, AccountingCategory } from '@/constants/accounting'

const props = withDefaults(
  defineProps<{
    records: AccountingRecord[]
    limit?: number
    compact?: boolean
    emptyText?: string
  }>(),
  { limit: 0, compact: false, emptyText: '暂无记录' },
)

const emit = defineEmits<{ edit: [rec: AccountingRecord]; deleted: [id: number] }>()

const store = useAccounting()
const { categories } = storeToRefs(store)

const list = computed(() =>
  props.limit > 0 ? props.records.slice(0, props.limit) : props.records,
)

/** 按日期分组（记录已按日期倒序） */
const grouped = computed(() => {
  const map = new Map<string, AccountingRecord[]>()
  for (const r of list.value) {
    const arr = map.get(r.record_date) || []
    arr.push(r)
    map.set(r.record_date, arr)
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }))
})

function catOf(name: string) {
  return categories.value.find((c) => c.name === name)
}
function catIcon(name: string) {
  return catOf(name)?.icon || 'CircleEllipsis'
}
function catColor(name: string) {
  return catOf(name)?.color || '#909399'
}
function money(n: number) {
  return '¥' + (Number(n) || 0).toFixed(2)
}

// ============ 右键菜单 ============
const menu = ref<{ visible: boolean; x: number; y: number; rec: AccountingRecord | null }>({
  visible: false,
  x: 0,
  y: 0,
  rec: null,
})
let listenersBound = false

function addMenuListeners() {
  document.addEventListener('click', closeMenu)
  window.addEventListener('scroll', closeMenu, true)
  window.addEventListener('resize', closeMenu)
  window.addEventListener('keydown', onMenuKey)
  listenersBound = true
}
function removeMenuListeners() {
  document.removeEventListener('click', closeMenu)
  window.removeEventListener('scroll', closeMenu, true)
  window.removeEventListener('resize', closeMenu)
  window.removeEventListener('keydown', onMenuKey)
  listenersBound = false
}
function closeMenu() {
  menu.value.visible = false
  menu.value.rec = null
  if (listenersBound) {
    removeMenuListeners()
  }
}
function onMenuKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeMenu()
}

/** 行右键：打开菜单（重复右键仅重定位，不重复绑定监听） */
function openMenu(ev: MouseEvent, rec: AccountingRecord) {
  const x = ev.clientX
  const y = ev.clientY
  // 简单边界修正，避免超出视口
  const maxX = window.innerWidth - 140
  const maxY = window.innerHeight - 90
  menu.value = {
    visible: true,
    x: x > maxX ? maxX : x,
    y: y > maxY ? maxY : y,
    rec,
  }
  if (!listenersBound) addMenuListeners()
}

/** 列表空白处右键：不在行内则关闭菜单（在行内由 openMenu 重新定位，不会触发此关闭） */
function onListContextMenu(ev: MouseEvent) {
  const target = ev.target as HTMLElement | null
  if (target && target.closest('.record-row')) return
  closeMenu()
}

function doEdit() {
  const rec = menu.value.rec
  closeMenu()
  if (rec) emit('edit', rec)
}
async function doDelete() {
  const rec = menu.value.rec
  closeMenu()
  if (rec) await onDelete(rec)
}

onBeforeUnmount(removeMenuListeners)

async function onDelete(rec: AccountingRecord) {
  try {
    await ElMessageBox.confirm(`确认删除「${rec.category} ${money(rec.amount)}」？`, '删除记录', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    const ok = await store.deleteRecord(rec.id!)
    if (ok) {
      ElMessage.success('已删除')
      emit('deleted', rec.id!)
    } else {
      ElMessage.error('删除失败')
    }
  } catch {
    /* 取消 */
  }
}
</script>

<style scoped lang="scss">
.record-list {
  width: 100%;

  .group-date {
    font-size: 12px;
    color: var(--text-muted, #999);
    margin: 10px 2px 6px;
    position: sticky;
    top: 0;
    // 列表位于白色卡片内，粘性分组头需与卡片同底色（原为页面灰底会露出色差）
    background: var(--bg-card, #fff);
    z-index: 1;
  }

  .record-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 6px;
    border-radius: 8px;
    transition: background 0.15s;

    &:hover {
      background: var(--bg-hover, #f0f2f5);
      .rec-ops {
        opacity: 1;
      }
    }

    .cat-icon {
      flex-shrink: 0;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .rec-main {
      flex: 1;
      min-width: 0;

      .rec-top {
        display: flex;
        align-items: baseline;
        gap: 8px;
        .rec-cat {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary, #303133);
        }
        .rec-note {
          font-size: 12px;
          color: var(--text-secondary, #606266);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
      .rec-sub {
        display: flex;
        gap: 8px;
        font-size: 11px;
        color: var(--text-muted, #aaa);
        margin-top: 2px;
        .rec-account {
          padding: 0 6px;
          border-radius: 4px;
          background: var(--bg-hover, #eef);
        }
      }
    }

    .rec-amount {
      font-size: 15px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      &.expense {
        color: #f56c6c;
      }
      &.income {
        color: #67c23a;
      }
    }

    .rec-ops {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s;

      .op-btn {
        border: none;
        background: transparent;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        color: var(--text-secondary, #606266);
        display: inline-flex;
        &:hover {
          background: var(--bg-card, #fff);
          color: var(--color-primary, #409eff);
        }
        &.danger:hover {
          color: #f56c6c;
        }
      }
    }

    &.compact {
      padding: 6px 2px;
      .cat-icon {
        width: 24px;
        height: 24px;
      }
      .rec-amount {
        font-size: 13px;
      }
    }
  }

  &.compact .record-row .rec-ops {
    opacity: 1;
  }

  // ===== 右键菜单 =====
  .rec-ctx-menu {
    position: fixed;
    z-index: 9999;
    min-width: 124px;
    padding: 4px;
    background: var(--bg-card, #fff);
    border: 1px solid var(--border-subtle, #e4e7ed);
    border-radius: 10px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14);

    .ctx-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 7px 10px;
      border: none;
      background: transparent;
      border-radius: 7px;
      cursor: pointer;
      font-size: 13px;
      color: var(--text-primary, #303133);
      text-align: left;

      &:hover {
        background: var(--bg-hover, #f0f2f5);
        color: var(--color-primary, #409eff);
      }
      &.danger:hover {
        color: #f56c6c;
        background: color-mix(in srgb, #f56c6c 10%, transparent);
      }
      :deep(.lucide) {
        flex-shrink: 0;
      }
    }
  }
}
</style>
