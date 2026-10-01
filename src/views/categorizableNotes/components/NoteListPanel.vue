<template>
  <section class="note-list-panel">
    <!-- 搜索头 -->
    <div class="list-head">
      <div class="search-box">
        <LucideIcon name="Search" class="search-icon" />
        <input
          :value="keyword"
          class="search-input"
          placeholder="搜索笔记…"
          @input="onSearchInput"
        />
        <LucideIcon v-if="keyword" name="X" class="clear-icon" @click="emitSearch('')" />
      </div>
    </div>

    <!-- 列表主体 -->
    <el-scrollbar ref="scrollbarRef" class="list-scroll" @scroll="handleScroll">
      <!-- 空态：无任何笔记 -->
      <div v-if="notes.length === 0 && !loading && !keyword" class="empty-state">
        <LucideIcon name="StickyNotePlus" class="empty-icon" />
        <p class="empty-title">还没有笔记</p>
        <p class="empty-hint">点击左侧「新建笔记」开始记录吧</p>
      </div>

      <!-- 空态：搜索 / 筛选无结果 -->
      <div v-else-if="notes.length === 0 && !loading" class="empty-state">
        <LucideIcon name="SearchX" class="empty-icon" />
        <p class="empty-title">没有匹配的笔记</p>
        <p class="empty-hint">换个关键词，或清空标签筛选试试</p>
      </div>

      <template v-else>
        <div
          v-for="note in notes"
          :key="note.key"
          class="note-row"
          :class="{ active: note.key === selectedKey }"
          @click="$emit('select', note)"
        >
          <div class="row-top">
            <span class="row-title">{{ noteTitle(note) }}</span>
            <span class="row-time">{{ formatTime(note.updateTime || note.createTime) }}</span>
          </div>
          <p class="row-excerpt">{{ rowExcerpt(note) }}</p>
          <div class="row-bottom">
            <div class="row-tags">
              <span
                v-for="tag in rowTags(note).slice(0, 3)"
                :key="tag.key"
                class="row-tag"
                :style="{ backgroundColor: tagBg(tag.color), color: tag.color }"
                @click.stop="$emit('tag-click', tag.key)"
              >
                {{ tag.name }}
              </span>
              <span v-if="rowTags(note).length > 3" class="row-tag more">
                +{{ rowTags(note).length - 3 }}
              </span>
            </div>
            <div class="row-actions" @click.stop>
              <LucideIcon name="Pencil" class="row-act" title="编辑" @click="$emit('edit', note)" />
              <LucideIcon name="Trash2" class="row-act danger" title="删除" @click="$emit('delete', note)" />
            </div>
          </div>
        </div>

        <!-- 加载 / 到底提示 -->
        <div v-if="loading" class="list-tip">
          <div class="loading-spinner"></div>
          <span>加载中…</span>
        </div>
        <div v-else-if="!hasMore && notes.length > 0" class="list-tip muted">
          <span>已全部加载</span>
        </div>
      </template>
    </el-scrollbar>
  </section>
</template>

<script setup lang="ts">
/**
 * 中列笔记列表（原子组件）
 * - 顶部搜索框（本地 300ms 防抖后向父级发 search）
 * - 行式列表（标题 / 摘要 / 标签 / 相对时间），选中高亮，hover 快捷编辑与删除
 * - 滚动近底部触发 load-more（无限滚动，与旧版一致）
 */
import { ref } from 'vue'
import { ElScrollbar } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import moment from 'moment'
import { noteTitle, notePlainText } from '@/utils/noteContent'
import { parseNoteTags, type NoteRow, type NoteTag } from '../composables/useNotes'

const props = defineProps<{
  notes: NoteRow[]
  tags: NoteTag[]
  selectedKey: string
  loading: boolean
  hasMore: boolean
  keyword: string
}>()

const emit = defineEmits<{
  search: [keyword: string]
  select: [note: NoteRow]
  edit: [note: NoteRow]
  delete: [note: NoteRow]
  'load-more': []
  'tag-click': [tagKey: string]
}>()

const scrollbarRef = ref<InstanceType<typeof ElScrollbar> | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null

/** 搜索防抖：300ms 内连续输入只发一次 */
function onSearchInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => emitSearch(value), 300)
}

function emitSearch(value: string) {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = null
  emit('search', value)
}

function handleScroll() {
  const wrap = scrollbarRef.value?.wrapRef
  if (!wrap) return
  const { scrollTop, scrollHeight, clientHeight } = wrap
  if (scrollTop + clientHeight + 100 >= scrollHeight) {
    if (!props.loading && props.hasMore && props.notes.length > 0) emit('load-more')
  }
}

/** 标签 key → 标签对象（仅返回仍存在的标签） */
function rowTags(note: NoteRow): NoteTag[] {
  const keys = parseNoteTags(note.tags)
  return props.tags.filter((t) => keys.includes(t.key))
}

function rowExcerpt(note: NoteRow): string {
  return notePlainText(note) || '无内容'
}

/** 标签底色：标签自身色 15% 透明 tint（数据驱动色，仅此一处允许动态色值） */
function tagBg(color: string): string {
  return `color-mix(in srgb, ${color} 15%, transparent)`
}

function formatTime(time?: string): string {
  if (!time) return '--'
  const noteTime = moment(time)
  const diffDays = moment().diff(noteTime, 'days')
  if (diffDays === 0) return noteTime.format('HH:mm')
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`
  return noteTime.format('YYYY-MM-DD')
}
</script>

<style scoped lang="scss">
.note-list-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-base);
  border-right: 1px solid var(--border-subtle);
  box-sizing: border-box;
  min-width: 0;
}

.list-head {
  padding: 12px 12px 8px;

  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    height: 34px;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    transition: border-color 0.15s, box-shadow 0.15s;

    &:focus-within {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 15%, transparent);
    }

    .search-icon {
      font-size: 14px;
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      font-size: 13px;
      color: var(--text-primary);

      &::placeholder {
        color: var(--text-muted);
      }
    }

    .clear-icon {
      font-size: 14px;
      color: var(--text-muted);
      cursor: pointer;
      flex-shrink: 0;

      &:hover {
        color: var(--text-primary);
      }
    }
  }
}

.list-scroll {
  flex: 1;
  min-height: 0;
}

/* 空态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 60px 20px;
  text-align: center;

  .empty-icon {
    font-size: 40px;
    color: var(--text-muted);
    opacity: 0.5;
    margin-bottom: 6px;
  }

  .empty-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .empty-hint {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }
}

/* 行式列表 */
.note-row {
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-subtle);
  border-left: 2px solid transparent;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: var(--bg-hover);

    .row-actions {
      opacity: 1;
    }
  }

  &.active {
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    border-left-color: var(--color-primary);

    .row-title {
      color: var(--color-primary);
    }
  }

  .row-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;

    .row-title {
      flex: 1;
      min-width: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .row-time {
      flex-shrink: 0;
      font-size: 11px;
      color: var(--text-muted);
    }
  }

  .row-excerpt {
    margin: 4px 0 6px;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .row-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    .row-tags {
      display: flex;
      flex-wrap: nowrap;
      gap: 4px;
      overflow: hidden;

      .row-tag {
        font-size: 11px;
        padding: 1px 7px;
        border-radius: 9px;
        line-height: 1.5;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;

        &.more {
          background: var(--bg-hover);
          color: var(--text-muted);
          cursor: default;
        }
      }
    }

    .row-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      opacity: 0;
      transition: opacity 0.15s;
      flex-shrink: 0;

      .row-act {
        font-size: 14px;
        padding: 3px;
        border-radius: 4px;
        color: var(--text-muted);
        cursor: pointer;

        &:hover {
          background: var(--bg-hover);
          color: var(--color-primary);
        }

        &.danger:hover {
          color: var(--color-error);
        }
      }
    }
  }
}

/* 底部提示 */
.list-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  font-size: 12px;
  color: var(--text-muted);

  &.muted {
    opacity: 0.7;
  }

  .loading-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border-subtle);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
