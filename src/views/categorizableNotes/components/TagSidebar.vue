<template>
  <aside class="tag-sidebar">
    <!-- 顶部：标题 + 新建入口 -->
    <div class="sidebar-head">
      <div class="brand">
        <LucideIcon name="LibraryBig" class="brand-icon" />
        <span class="brand-name">可归类笔记</span>
      </div>
      <el-button type="primary" class="new-btn" @click="$emit('create-note')">
        <LucideIcon name="Plus" />
        新建笔记
      </el-button>
    </div>

    <!-- 导航：全部 + 标签 -->
    <el-scrollbar class="nav-scroll">
      <nav class="nav">
        <div
          class="nav-item"
          :class="{ active: selected.length === 0 }"
          @click="$emit('select', [])"
        >
          <LucideIcon name="FileText" class="nav-icon" />
          <span class="nav-name">全部笔记</span>
          <span class="nav-count">{{ total }}</span>
        </div>

        <div
          v-for="tag in activeTags"
          :key="tag.key"
          class="nav-item"
          :class="{ active: selected.includes(tag.key) }"
          @click="toggleTag(tag.key)"
        >
          <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
          <span class="nav-name">{{ tag.name }}</span>
          <span class="nav-count">{{ counts[tag.key] || 0 }}</span>
          <LucideIcon
            name="Trash2"
            class="nav-delete"
            title="删除标签"
            @click.stop="confirmDeleteTag(tag)"
          />
        </div>

        <!-- 废弃标签：可折叠分组，仍可点击筛选（与旧版能力一致） -->
        <div v-if="deletedTags.length > 0" class="deleted-group">
          <div class="group-toggle" @click="deletedExpanded = !deletedExpanded">
            <LucideIcon
              :name="deletedExpanded ? 'ChevronDown' : 'ChevronRight'"
              class="toggle-icon"
            />
            <span>废弃标签</span>
            <span class="group-count">{{ deletedTags.length }}</span>
          </div>
          <template v-if="deletedExpanded">
            <div
              v-for="tag in deletedTags"
              :key="tag.key"
              class="nav-item deleted"
              :class="{ active: selected.includes(tag.key) }"
              @click="toggleTag(tag.key)"
            >
              <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
              <span class="nav-name">{{ tag.name }}</span>
              <span class="nav-count">{{ counts[tag.key] || 0 }}</span>
            </div>
          </template>
        </div>

        <div v-if="activeTags.length === 0" class="no-tag-hint">
          暂无标签，可在下方创建，或在编辑笔记时添加
        </div>
      </nav>
    </el-scrollbar>

    <!-- 底部：内联新建标签 -->
    <div class="sidebar-foot">
      <div v-if="creating" class="create-box">
        <el-input
          ref="createInputRef"
          v-model="newTagName"
          size="small"
          placeholder="标签名称，回车确认"
          maxlength="20"
          @keyup.enter="confirmCreate"
          @keyup.esc="cancelCreate"
        />
        <el-button type="primary" size="small" :disabled="!newTagName.trim()" @click="confirmCreate">
          确定
        </el-button>
      </div>
      <button v-else class="create-trigger" @click="startCreate">
        <LucideIcon name="FolderPlus" />
        新建标签
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * 左栏标签导航（原子组件）
 * - 「全部笔记」+ 标签列表（色点 / 计数 / hover 删除）
 * - 废弃标签折叠分组（仍可筛选，数据行为与旧版一致）
 * - 底部内联新建标签
 * 本组件不直接读写数据，删除 / 新建通过事件交由父级处理。
 */
import { ref, computed, nextTick } from 'vue'
import { ElMessageBox } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import type { NoteTag } from '../composables/useNotes'

const props = defineProps<{
  /** 全量标签（含废弃） */
  tags: NoteTag[]
  /** 各标签笔记计数 */
  counts: Record<string, number>
  /** 笔记总数（全部笔记项展示） */
  total: number
  /** 当前选中的筛选标签 key 列表 */
  selected: string[]
}>()

const emit = defineEmits<{
  /** 筛选标签变化（空数组 = 全部笔记） */
  select: [tagKeys: string[]]
  /** 新建标签（父级负责落库） */
  'create-tag': [name: string]
  /** 删除标签（软删，父级负责落库） */
  'delete-tag': [tag: NoteTag]
  /** 新建笔记 */
  'create-note': []
}>()

const activeTags = computed(() => props.tags.filter((t) => !t.deleted))
const deletedTags = computed(() => props.tags.filter((t) => t.deleted))

const deletedExpanded = ref(false)
const creating = ref(false)
const newTagName = ref('')
const createInputRef = ref()

function toggleTag(key: string) {
  const next = props.selected.includes(key)
    ? props.selected.filter((k) => k !== key)
    : [...props.selected, key]
  emit('select', next)
}

function startCreate() {
  creating.value = true
  newTagName.value = ''
  nextTick(() => createInputRef.value?.focus())
}

function cancelCreate() {
  creating.value = false
  newTagName.value = ''
}

function confirmCreate() {
  const name = newTagName.value.trim()
  if (!name) return
  emit('create-tag', name)
  cancelCreate()
}

async function confirmDeleteTag(tag: NoteTag) {
  try {
    await ElMessageBox.confirm(
      `确定要删除标签 "${tag.name}" 吗？删除后笔记中已选该标签的数据将保留，但不能继续使用该标签。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
    emit('delete-tag', tag)
  } catch {
    /* 用户取消 */
  }
}
</script>

<style scoped lang="scss">
.tag-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  box-sizing: border-box;
}

.sidebar-head {
  padding: 16px 14px 12px;
  border-bottom: 1px solid var(--border-subtle);

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;

    .brand-icon {
      font-size: 18px;
      color: var(--color-primary);
    }

    .brand-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
    }
  }

  .new-btn {
    width: 100%;

    :deep(.el-icon) {
      margin-right: 2px;
    }
  }
}

.nav-scroll {
  flex: 1;
  min-height: 0;
}

.nav {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: background 0.15s, color 0.15s;
  user-select: none;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);

    .nav-delete {
      opacity: 1;
    }
  }

  &.active {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    color: var(--color-primary);
    font-weight: 600;

    .nav-count {
      color: var(--color-primary);
    }
  }

  .nav-icon {
    font-size: 15px;
    flex-shrink: 0;
  }

  .tag-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .nav-name {
    flex: 1;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nav-count {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-hover);
    border-radius: 8px;
    padding: 0 6px;
    line-height: 16px;
    min-width: 16px;
    text-align: center;
  }

  .nav-delete {
    font-size: 13px;
    color: var(--text-muted);
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;

    &:hover {
      color: var(--color-error);
    }
  }

  &.deleted {
    opacity: 0.65;

    .nav-name {
      text-decoration: line-through;
    }
  }
}

.deleted-group {
  margin-top: 4px;
  border-top: 1px dashed var(--border-subtle);
  padding-top: 4px;

  .group-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    font-size: 12px;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 8px;

    &:hover {
      background: var(--bg-hover);
    }

    .toggle-icon {
      font-size: 13px;
    }

    .group-count {
      margin-left: auto;
      font-size: 11px;
      background: var(--bg-hover);
      border-radius: 8px;
      padding: 0 6px;
      line-height: 16px;
    }
  }
}

.no-tag-hint {
  padding: 16px 10px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
  text-align: center;
}

.sidebar-foot {
  padding: 10px 12px;
  border-top: 1px solid var(--border-subtle);

  .create-box {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .create-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px 0;
    font-size: 13px;
    color: var(--text-secondary);
    background: transparent;
    border: 1px dashed var(--border-subtle);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      color: var(--color-primary);
      border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
      background: color-mix(in srgb, var(--color-primary) 6%, transparent);
    }
  }
}
</style>
