<template>
  <div class="bookshelf-view">
    <!-- 书架顶部标题与数量 -->
    <div class="bookshelf-header">
      <h2 class="bookshelf-title">
        <LucideIcon name="LibraryBig" :size="18" />
        我的书架
      </h2>
      <div class="bookshelf-header-right">
        <el-button
          size="small"
          @click="emit('add-external')"
          title="打开外部电子书并加入书架"
        >
          <LucideIcon name="FolderPlus" :size="14" />
          添加书籍
        </el-button>
        <span class="book-count">共 {{ items.length }} 本书</span>
        <el-button
          v-if="items.length > 0"
          size="small"
          @click="emit('export-all')"
        >
          <LucideIcon name="Download" :size="14" />
          导出全部笔记
        </el-button>
      </div>
    </div>

    <!-- 空书架提示 -->
    <div v-if="items.length === 0" class="bookshelf-empty">
      <el-empty description="书架空空如也，打开一本电子书吧">
        <el-button type="primary" @click="emit('open-file')">
          <LucideIcon name="FolderOpen" :size="16" />
          打开文件
        </el-button>
        <el-button @click="emit('add-external')">
          <LucideIcon name="FolderPlus" :size="16" />
          仅加入书架
        </el-button>
      </el-empty>
    </div>

    <!-- 卡片网格：flex wrap 响应式布局，每行 3-4 张卡片 -->
    <div v-else class="bookshelf-grid">
      <div
        v-for="item in items"
        :key="item.path"
        class="book-card"
        :title="`打开《${item.name}》`"
        @click="emit('open', item)"
      >
        <!-- 卡片头部：格式徽标 + 删除按钮 -->
        <div class="book-card-header">
          <el-tag
            size="small"
            :type="item.format === 'epub' ? 'warning' : 'success'"
          >
            {{ item.format.toUpperCase() }}
          </el-tag>
          <!-- 删除按钮：阻止冒泡，避免触发卡片点击 -->
          <el-button
            class="delete-btn"
            size="small"
            circle
            title="从书架移除"
            @click.stop="emit('remove', item)"
          >
            <LucideIcon name="Trash2" :size="14" />
          </el-button>
        </div>

        <!-- 书名（截断显示，title 显示完整名） -->
        <div class="book-name" :title="item.name">
          {{ item.name }}
        </div>

        <!-- 进度条与百分比 -->
        <div class="book-progress">
          <el-progress
            :percentage="item.percent"
            :stroke-width="6"
            :show-text="false"
            :status="item.percent >= 100 ? 'success' : undefined"
          />
          <span class="progress-text">{{ item.percent }}%</span>
        </div>

        <!-- 上次阅读时间 -->
        <div class="book-meta">
          <LucideIcon name="Clock" :size="12" />
          <span>{{ formatTime(item.lastReadAt) }}</span>
        </div>

        <!-- 笔记/划线数量徽标 -->
        <div class="book-stats">
          <span class="stat-badge note">
            <LucideIcon name="NotebookPen" :size="12" />
            笔记 {{ annotationCountMap[item.path]?.noteCount || 0 }}
          </span>
          <span class="stat-badge highlight">
            <LucideIcon name="Pen" :size="12" />
            划线 {{ annotationCountMap[item.path]?.highlightCount || 0 }}
          </span>
        </div>

        <!-- 卡片操作按钮：笔记（查看/管理）、导出，阻止冒泡避免触发打开 -->
        <div class="book-actions">
          <el-button
            size="small"
            @click.stop="emit('open-annotations', item)"
          >
            <LucideIcon name="NotebookPen" :size="13" />
            笔记
          </el-button>
          <el-button
            size="small"
            @click.stop="emit('export', item)"
          >
            <LucideIcon name="Download" :size="13" />
            导出
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import moment from 'moment';
import LucideIcon from '@/components/LucideIcon.vue';
import type { BookshelfItem } from '@/store/useEbookReader';

const props = defineProps<{
  /** 书架列表 */
  items: BookshelfItem[];
  /** 每本书的笔记/划线数量映射（path -> { noteCount, highlightCount }） */
  annotationCountMap: Record<string, { noteCount: number; highlightCount: number }>;
}>();

const emit = defineEmits<{
  (e: 'open', item: BookshelfItem): void;
  (e: 'remove', item: BookshelfItem): void;
  (e: 'add-external'): void;
  (e: 'open-file'): void;
  (e: 'open-annotations', item: BookshelfItem): void;
  (e: 'export', item: BookshelfItem): void;
  (e: 'export-all'): void;
}>();

/**
 * 格式化书架条目的时间字段为可读字符串
 *
 * @param time - ISO 字符串时间，如 '2026-08-01T12:34:56.000Z'
 * @returns 'YYYY-MM-DD HH:mm' 格式字符串；输入为空或无效时返回 '--'
 */
function formatTime(time: string): string {
  if (!time) return '--';
  const m = moment(time);
  // moment 解析无效时 isValid 为 false
  if (!m.isValid()) return '--';
  return m.format('YYYY-MM-DD HH:mm');
}
</script>

<style scoped lang="scss">
/* 书架视图：垂直布局，内容区可滚动 */
.bookshelf-view {
  height: 100%;
  overflow: auto;
  padding: 20px 24px 32px;
  box-sizing: border-box;
  background: var(--bg-base);
}

/* 书架顶部标题与数量 */
.bookshelf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid transparent;
  background: linear-gradient(90deg, var(--color-primary), transparent) no-repeat left bottom / 100% 1px;

  .bookshelf-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);

    :deep(.lucide-icon-box) {
      color: var(--color-primary);
    }
  }

  .book-count {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .bookshelf-header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

/* 空书架提示 */
.bookshelf-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
}

/* 卡片网格：响应式 flex wrap，每行 3-4 张 */
.bookshelf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  width: 100%;
}

/* 单张书架卡片 */
.book-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--color-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  /* 卡片头部：格式徽标 + 删除按钮 */
  .book-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    .delete-btn {
      width: 26px;
      height: 26px;
      min-height: 26px;
      padding: 0;
      color: var(--text-muted);
      border: none;
      background: transparent;

      &:hover {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.08);
      }
    }
  }

  /* 书名：单行截断 */
  .book-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 进度条与百分比 */
  .book-progress {
    display: flex;
    align-items: center;
    gap: 8px;

    :deep(.el-progress) {
      flex: 1;
    }

    .progress-text {
      font-size: 12px;
      color: var(--text-secondary);
      min-width: 36px;
      text-align: right;
    }
  }

  /* 上次阅读时间 */
  .book-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-muted);

    :deep(.lucide-icon-box) {
      color: var(--text-muted);
    }
  }

  /* 笔记/划线数量徽标 */
  .book-stats {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;

    .stat-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      background: var(--bg-base);

      &.note {
        color: var(--color-primary);
      }
      &.highlight {
        color: var(--text-secondary);
      }
    }
  }

  /* 卡片操作按钮：笔记 / 导出 */
  .book-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }
}
</style>
