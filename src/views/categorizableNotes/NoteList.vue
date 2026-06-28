<template>
  <el-scrollbar ref="scrollbarRef" class="note-list" @scroll="handleScroll">
    <div v-if="notes.length === 0" class="empty-state">
      <el-empty description="暂无笔记，点击右上角新建笔记开始吧" />
    </div>
    <div v-else class="note-grid">
      <div
        v-for="note in notes"
        :key="note.key"
        class="note-card"
        @click="$emit('view', note)"
      >
        <div class="note-card-header">
          <h3 class="note-title">{{ getTitle(note) }}</h3>
          <el-dropdown trigger="click" @click.stop>
            <LucideIcon name="EllipsisVertical" class="more-icon" @click.stop />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click.stop="$emit('edit', note)">
                  <LucideIcon name="Pencil" />
                  编辑
                </el-dropdown-item>
                <el-dropdown-item divided @click.stop="handleDelete(note)">
                  <LucideIcon name="Trash2" />
                  删除
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <p class="note-excerpt">{{ note.excerpt || '无内容' }}</p>
        <div class="note-tags" v-if="getNoteTags(note).length > 0">
          <span
            v-for="tag in getNoteTags(note)"
            :key="tag.key"
            class="note-tag"
            :style="{ backgroundColor: tag.color + '20', color: tag.color }"
          >
            {{ tag.name }}
          </span>
        </div>
        <div class="note-footer">
          <span class="note-time">{{ formatTime(note.updateTime || note.createTime) }}</span>
        </div>
      </div>
    </div>
    <div v-if="loading && notes.length > 0" class="loading-state">
      <el-loading text="加载中..." />
    </div>
  </el-scrollbar>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import moment from 'moment';

const scrollbarRef = ref(null);

const props = defineProps({
  notes: {
    type: Array,
    default: () => []
  },
  tags: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  hasMore: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['view', 'edit', 'delete', 'load-more']);

function handleScroll() {
  const scrollbar = scrollbarRef.value;
  if (!scrollbar) return;
  
  const wrap = scrollbar.wrapRef;
  if (!wrap) return;
  
  const { scrollTop, scrollHeight, clientHeight } = wrap;
  const distance = 100;
  
  if (scrollTop + clientHeight + distance >= scrollHeight) {
    if (!props.loading && props.hasMore) {
      emit('load-more');
    }
  }
}

function getTitle(note) {
  if (!note.mdText) return '无标题';
  const lines = note.mdText.split('\n').filter(l => l.trim());
  const firstLine = lines[0] || '';
  return firstLine.replace(/^#+\s*/, '').substring(0, 50);
}

function getNoteTags(note) {
  if (!note.tags) return [];
  let tagKeys = [];
  try {
    tagKeys = JSON.parse(note.tags);
  } catch {
    tagKeys = note.tags ? [note.tags] : [];
  }
  return props.tags.filter(t => tagKeys.includes(t.key));
}

function formatTime(time) {
  if (!time) return '--';
  const now = moment();
  const noteTime = moment(time);
  const diffDays = now.diff(noteTime, 'days');
  
  if (diffDays === 0) {
    return noteTime.format('HH:mm');
  } else if (diffDays === 1) {
    return '昨天';
  } else if (diffDays < 7) {
    return diffDays + '天前';
  } else {
    return noteTime.format('YYYY-MM-DD');
  }
}

async function handleDelete(note) {
  try {
    await ElMessageBox.confirm('确定要删除这篇笔记吗？', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    });
    
    const result = await window.ipcRenderer.handlePromise('delete-data', {
      tableName: 'note_book',
      condition: {
        key: note.key
      }
    });
    
    if (result.success) {
      ElMessage.success('删除成功');
      emit('delete', note);
    } else {
      ElMessage.error('删除失败');
    }
  } catch {
  }
}
</script>

<style scoped lang="scss">
.note-list {
  width: 100%;
  height: 100%;
  padding: 8px;
  box-sizing: border-box;
}

.loading-state {
  text-align: center;
  padding: 16px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.note-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.note-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
    transform: translateY(-2px);
  }
}

.note-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;

  .note-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.4;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .more-icon {
    font-size: 18px;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    flex-shrink: 0;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
  }
}

.note-excerpt {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  flex: 1;
}

.note-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  .note-tag {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 10px;
    line-height: 1.5;
  }
}

.note-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);

  .note-time {
    font-size: 12px;
    color: var(--text-muted);
  }
}
</style>