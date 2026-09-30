<!--
  思维导图 —— 文档管理弹窗（打开 / 删除 / 新建）。

  打开与删除都委托给 useMindActions：那里带着「打开后要重新适应画布」和
  「删掉的正是当前文档时要回到空白图」这两条策略，弹窗不该再实现一遍。
-->
<template>
  <AppDialog v-model="visible" title="导图文档" width="620px" :show-fullscreen="false" @open="reload">
    <div class="mind-docs">
      <div v-if="listLoading" class="mind-docs__hint">正在读取…</div>

      <div v-else-if="!docs.length" class="mind-docs__empty">
        <LucideIcon name="FolderOpen" :size="36" />
        <p>还没有保存过任何导图</p>
        <span>点右下角「新建导图」开始，或先在画布上编辑再按 Ctrl + S 保存。</span>
      </div>

      <ul v-else class="mind-docs__list">
        <li
          v-for="item in docs"
          :key="item.id"
          class="mind-docs__item"
          :class="{ 'is-current': item.id === currentId }"
        >
          <button type="button" class="mind-docs__main" @click="onOpen(item)">
            <span class="mind-docs__name">{{ item.name || '未命名导图' }}</span>
            <span class="mind-docs__time">{{ item.update_time || item.create_time || '' }}</span>
          </button>
          <span v-if="item.id === currentId" class="mind-docs__badge">当前</span>
          <button type="button" class="mind-docs__del" title="删除这份导图" @click="onDelete(item)">
            <LucideIcon name="Trash2" :size="15" />
          </button>
        </li>
      </ul>
    </div>

    <div class="mind-docs__footer">
      <span class="mind-docs__count">共 {{ docs.length }} 份</span>
      <div class="mind-docs__footer-actions">
        <button type="button" class="mind-docs__btn" @click="visible = false">关闭</button>
        <button type="button" class="mind-docs__btn mind-docs__btn--primary" @click="onCreate">
          <LucideIcon name="FilePlus" :size="15" /> 新建导图
        </button>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * 文档管理弹窗。
 * `@open`（el-dialog 的开场事件）时重新拉一次列表 —— 每次打开都拿最新数据，
 * 比在父组件里手动维护「什么时候该刷新」省心得多。
 */
import { computed } from 'vue'
import { ElMessageBox } from 'element-plus'

import AppDialog from '@/components/AppDialog.vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { useMindActions } from '../composables/useMindActions'
import { useMindDoc } from '../composables/useMindDoc'
import type { MindDocRecord } from '../types'

const visible = defineModel<boolean>({ default: false })

const mind = useMindDoc()
const actions = useMindActions()
const { docs, listLoading } = actions

/** 当前打开文档的 id（用于高亮与「当前」标记） */
const currentId = computed(() => mind.doc.value.id)

function reload() {
  actions.refreshList()
}

async function onOpen(item: MindDocRecord) {
  const ok = await actions.openDoc(item.id)
  if (ok) visible.value = false
}

async function onDelete(item: MindDocRecord) {
  try {
    await ElMessageBox.confirm(
      `确定删除导图「${item.name || '未命名导图'}」吗？此操作不可恢复。`,
      '删除导图',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  await actions.removeById(item.id)
}

async function onCreate() {
  const ok = await actions.createNew()
  if (ok) visible.value = false
}
</script>

<style scoped lang="scss">
.mind-docs {
  min-height: 180px;
  max-height: 52vh;
  overflow: auto;
}

.mind-docs__hint {
  padding: 40px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.mind-docs__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px 12px;
  color: var(--text-muted);
  text-align: center;

  p {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--text-secondary);
  }

  span {
    font-size: 12px;
    line-height: 1.6;
  }
}

.mind-docs__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mind-docs__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-base);
  transition: border-color 0.15s, background-color 0.15s;

  &:hover {
    border-color: var(--color-primary);
  }

  &.is-current {
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  }
}

.mind-docs__main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}

.mind-docs__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.mind-docs__time {
  flex: none;
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.mind-docs__badge {
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 16%, transparent);
  color: var(--color-primary);
  font-size: 11px;
}

.mind-docs__del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;

  &:hover {
    background: var(--bg-hover);
    color: var(--color-error);
  }
}

.mind-docs__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
}

.mind-docs__count {
  font-size: 12px;
  color: var(--text-muted);
}

.mind-docs__footer-actions {
  display: flex;
  gap: 8px;
}

.mind-docs__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;

  &:hover {
    color: var(--text-primary);
    border-color: var(--color-primary);
  }

  &--primary {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: #fff;

    &:hover {
      color: #fff;
      background: var(--color-primary-solid, var(--color-primary));
    }
  }
}
</style>
