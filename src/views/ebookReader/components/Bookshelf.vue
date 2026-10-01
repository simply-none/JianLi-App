<template>
  <div class="bookshelf-view" :class="{ 'list-mode': viewMode === 'list' }" @scroll="onScroll">
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
        <el-button
          size="small"
          @click="emit('add-folder')"
          title="导入整个文件夹（含子目录）的电子书到书架"
        >
          <LucideIcon name="Folders" :size="14" />
          导入文件夹
        </el-button>
        <!-- 展示模式切换：卡片网格 / 虚拟表格列表（选择记忆到 localStorage） -->
        <el-button-group class="view-mode-switch">
          <el-button
            size="small"
            :type="viewMode === 'card' ? 'primary' : undefined"
            title="卡片模式"
            @click="setViewMode('card')"
          >
            <LucideIcon name="LayoutDashboard" :size="14" />
          </el-button>
          <el-button
            size="small"
            :type="viewMode === 'list' ? 'primary' : undefined"
            title="列表模式"
            @click="setViewMode('list')"
          >
            <LucideIcon name="List" :size="14" />
          </el-button>
        </el-button-group>
        <span class="book-count">共 {{ items.length }} 本书</span>
        <el-button
          v-if="items.length > 0"
          size="small"
          @click="emit('export-all')"
        >
          <LucideIcon name="Download" :size="14" />
          导出全部笔记
        </el-button>
        <el-popconfirm
          v-if="items.length > 0"
          title="确认清空书架上的全部书籍？仅移除书架，不影响标注 / 进度 / 书签。"
          confirm-button-text="清空"
          cancel-button-text="取消"
          @confirm="emit('clear-all')"
        >
          <template #reference>
            <el-button size="small" type="danger">
              <LucideIcon name="Trash2" :size="14" />
              移除全部
            </el-button>
          </template>
        </el-popconfirm>
      </div>
    </div>

    <!-- 分类筛选栏：分类 chips + 名称搜索 + 管理分类 -->
    <div class="bookshelf-filter">
      <div class="cat-chips">
        <span
          class="cat-chip"
          :class="{ active: selectedCategory === null }"
          role="button"
          tabindex="0"
          @click="emit('update:selected-category', null)"
          @keydown.enter.prevent="emit('update:selected-category', null)"
          @keydown.space.prevent="emit('update:selected-category', null)"
        >全部</span>
        <span
          v-for="cat in categories"
          :key="cat.id"
          class="cat-chip"
          :class="{ active: selectedCategory === cat.id }"
          role="button"
          tabindex="0"
          @click="emit('update:selected-category', cat.id)"
          @keydown.enter.prevent="emit('update:selected-category', cat.id)"
          @keydown.space.prevent="emit('update:selected-category', cat.id)"
          @dragover.prevent
          @drop="onDropToCategory(cat.id, $event)"
          :title="`点击筛选；拖动书籍到此可加入该分类`"
        ><span class="cat-dot" :style="{ background: cat.color || 'var(--color-primary)' }"></span>{{ cat.name }}</span>
      </div>
      <div class="quick-filters">
        <!-- 格式筛选（多选切换，持久化） -->
        <button
          v-for="f in FORMAT_OPTIONS"
          :key="f.value"
          class="fmt-chip"
          :class="{ active: formatFilter.includes(f.value) }"
          type="button"
          :title="formatFilter.includes(f.value) ? '取消该格式筛选' : '只看该格式'"
          @click="toggleFormat(f.value)"
        >{{ f.label }}</button>
        <!-- 阅读状态筛选 -->
        <el-select v-model="readStatusFilter" size="small" class="status-select">
          <el-option label="全部状态" value="all" />
          <el-option label="未读" value="unread" />
          <el-option label="在读" value="reading" />
          <el-option label="已读完" value="finished" />
        </el-select>
        <!-- 卡片模式排序（列表模式用列头排序） -->
        <el-select v-if="viewMode === 'card'" v-model="cardSortKey" size="small" class="sort-select">
          <el-option label="默认排序" value="" />
          <el-option label="最近阅读" value="lastReadAt" />
          <el-option label="添加时间" value="addedAt" />
          <el-option label="书名" value="title" />
          <el-option label="进度" value="percent" />
        </el-select>
      </div>
      <div class="filter-right">
        <el-input
          :model-value="searchKeyword"
          size="small"
          placeholder="搜索书名 / 文件名 / 作者"
          clearable
          @update:model-value="onKeywordInput"
        >
          <template #prefix>
            <LucideIcon name="Search" :size="13" />
          </template>
        </el-input>
        <el-button size="small" @click="manageVisible = true">
          <LucideIcon name="Tags" :size="13" />
          管理分类
        </el-button>
      </div>
    </div>

    <!-- 分类管理弹窗：新增 / 删除 / 改名 / 改色 -->
    <app-dialog v-model="manageVisible" title="管理分类" width="440px" append-to-body>
      <div class="cat-manage">
        <div class="cat-add">
          <el-color-picker v-model="newCatColor" size="small" />
          <el-input
            v-model="newCatName"
            size="small"
            placeholder="输入新分类名称"
            @keyup.enter="onAddCategory"
          />
          <el-button type="primary" size="small" @click="onAddCategory">添加</el-button>
        </div>
        <div class="cat-list">
          <div v-for="cat in categories" :key="cat.id" class="cat-row">
            <el-color-picker
              v-if="catEditCache[cat.id]"
              v-model="catEditCache[cat.id].color"
              size="small"
              @change="onUpdateCategory(cat.id)"
            />
            <el-input
              v-if="catEditCache[cat.id]"
              v-model="catEditCache[cat.id].name"
              size="small"
              class="cat-edit-name"
              placeholder="分类名称"
              @blur="onUpdateCategory(cat.id)"
              @keyup.enter="onUpdateCategory(cat.id)"
            />
            <el-button size="small" text type="danger" @click="onDeleteCategory(cat.id)">
              <LucideIcon name="Trash2" :size="13" />
              删除
            </el-button>
          </div>
          <div v-if="categories.length === 0" class="cat-empty">暂无分类，先添加一个吧</div>
        </div>
      </div>
    </app-dialog>

    <!-- 书籍分类弹窗：支持搜索、可滚动的多选（分类过多时也能有效展示） -->
    <app-dialog
      v-model="catDialogVisible"
      title="设置分类"
      width="380px"
      append-to-body
    >
      <div class="cat-dialog">
        <el-input
          v-model="catSearch"
          size="small"
          placeholder="搜索分类"
          clearable
          class="cat-dialog-search"
        >
          <template #prefix>
            <LucideIcon name="Search" :size="13" />
          </template>
        </el-input>
        <div class="cat-dialog-list">
          <el-checkbox-group v-model="popoverSelected" class="cat-dialog-group">
            <label
              v-for="cat in filteredCategories"
              :key="cat.id"
              class="cat-dialog-item"
            >
              <el-checkbox :value="cat.id" />
              <span class="cat-dot" :style="{ background: cat.color || 'var(--color-primary)' }"></span>
              <span class="cat-dialog-name">{{ cat.name }}</span>
            </label>
          </el-checkbox-group>
          <div v-if="filteredCategories.length === 0" class="cat-empty">无匹配分类</div>
        </div>
      </div>
      <template #footer>
        <el-button size="small" @click="catDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="saveBookCats">保存</el-button>
      </template>
    </app-dialog>

    <!-- 书籍元数据编辑弹窗：手动改 书名 / 作者 / 封面（TXT 书尤其有用） -->
    <app-dialog
      v-model="metaDialog.visible"
      title="编辑书籍信息"
      width="420px"
      append-to-body
    >
      <div class="meta-dialog">
        <div class="meta-row">
          <span class="meta-label">书名</span>
          <el-input v-model="metaDialog.title" size="small" placeholder="书籍标题（空则回退文件名）" />
        </div>
        <div class="meta-row">
          <span class="meta-label">作者</span>
          <el-input v-model="metaDialog.author" size="small" placeholder="作者（可空）" />
        </div>
        <div class="meta-row">
          <span class="meta-label">封面</span>
          <div class="meta-cover">
            <input
              ref="coverInputRef"
              type="file"
              accept="image/*"
              style="display: none"
              @change="onPickCover"
            />
            <div v-if="metaDialog.cover" class="meta-cover-preview" :style="{ backgroundImage: `url(${metaDialog.cover})` }"></div>
            <div v-else class="meta-cover-preview empty">无封面</div>
            <el-button size="small" @click="coverInputRef?.click()">选择图片</el-button>
            <el-button size="small" text type="danger" v-if="metaDialog.cover" @click="metaDialog.cover = ''">清除</el-button>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button size="small" @click="metaDialog.visible = false">取消</el-button>
        <el-button size="small" type="primary" @click="saveMetaDialog">保存</el-button>
      </template>
    </app-dialog>

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
        <el-button @click="emit('add-folder')">
          <LucideIcon name="Folders" :size="16" />
          导入文件夹
        </el-button>
      </el-empty>
    </div>
    <!-- 筛选无结果（书架非空但被筛选清空） -->
    <div v-else-if="localFiltered.length === 0" class="bookshelf-empty">
      <el-empty description="没有符合条件的书籍（试试放宽筛选条件）" />
    </div>

    <!-- 列表模式：虚拟表格（字段与卡片一致；左键打开、右键菜单做笔记/导出/分类/移除/编辑信息） -->
    <BookshelfTable
      v-else-if="viewMode === 'list'"
      class="bookshelf-table-fill"
      :items="localFiltered"
      :annotation-count-map="annotationCountMap"
      :categories="categories"
      @open="emit('open', $event)"
      @remove="emit('remove', $event)"
      @open-annotations="emit('open-annotations', $event)"
      @export="emit('export', $event)"
      @request-set-categories="openCatDialog"
      @request-edit-meta="openMetaDialog"
    />

    <!-- 卡片网格：flex wrap 响应式布局，每行 3-4 张卡片（可拖拽到分类 chip 加入分类） -->
    <div v-else class="bookshelf-grid">
      <div
        v-for="item in visibleItems"
        :key="item.path"
        class="book-card"
        :title="`打开《${item.title || item.name}》`"
        draggable="true"
        @dragstart="onCardDragStart(item, $event)"
        @click="emit('open', item)"
      >
        <!-- 封面：有封面图则显示，否则占位（格式首字母） -->
        <div class="book-cover">
          <img v-if="item.cover" :src="item.cover" :alt="item.title || item.name" class="book-cover-img" />
          <div v-else class="book-cover-fallback">
            {{ (item.format || '?').toUpperCase().charAt(0) }}
          </div>
        </div>

        <!-- 卡片头部：格式徽标 + 删除按钮 -->
        <div class="book-card-header">
          <el-tag
            size="small"
            :type="item.format === 'epub' ? 'warning' : item.format === 'pdf' ? 'danger' : item.format === 'cbz' ? 'info' : 'success'"
          >
            {{ item.format.toUpperCase() }}
          </el-tag>
          <!-- 删除按钮：阻止冒泡，避免触发卡片点击 -->
          <el-button
            class="delete-btn"
            size="small"
            circle
            title="从书架移除"
            aria-label="从书架移除该书"
            @click.stop="emit('remove', item)"
          >
            <LucideIcon name="Trash2" :size="14" />
          </el-button>
        </div>

        <!-- 书名（截断显示；hover 展示文件名与完整路径） -->
        <el-tooltip placement="top" :show-after="300" effect="dark">
          <template #content>
            <div style="max-width: 320px; line-height: 1.7; font-size: 12px;">
              <div style="margin-bottom: 4px;">
                <span style="color: #c0c4cc; margin-right: 8px;">文件名</span><b style="color: #fff;">{{ item.name }}</b>
              </div>
              <div>
                <span style="color: #c0c4cc; margin-right: 8px;">路径</span><span style="word-break: break-all; color: #fff;">{{ item.path }}</span>
              </div>
            </div>
          </template>
          <div class="book-name">
            {{ item.title || item.name }}
          </div>
        </el-tooltip>

        <!-- 作者（有则显示） -->
        <div v-if="item.author" class="book-author" :title="item.author">
          {{ item.author }}
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

        <!-- 累计阅读时长（有统计才显示） -->
        <div v-if="(annotationCountMap[item.contentHash || item.path]?.readingSeconds || 0) > 0" class="book-meta">
          <LucideIcon name="Timer" :size="12" />
          <span>累计阅读 {{ formatReadingDuration(annotationCountMap[item.contentHash || item.path]?.readingSeconds || 0) }}</span>
        </div>

        <!-- 笔记/划线/书签数量徽标（按内容身份共用，副本与原书同步） -->
        <div class="book-stats">
          <span class="stat-badge note">
            <LucideIcon name="NotebookPen" :size="12" />
            笔记 {{ annotationCountMap[item.contentHash || item.path]?.noteCount || 0 }}
          </span>
          <span class="stat-badge highlight">
            <LucideIcon name="Pen" :size="12" />
            划线 {{ annotationCountMap[item.contentHash || item.path]?.highlightCount || 0 }}
          </span>
          <span class="stat-badge bookmark">
            <LucideIcon name="BookMarked" :size="12" />
            书签 {{ annotationCountMap[item.contentHash || item.path]?.bookmarkCount || 0 }}
          </span>
        </div>

        <!-- 分类标签与设置：标签展示该书所属分类；「分类」按钮打开弹窗多选（支持搜索、可滚动） -->
        <div class="book-cats" @click.stop>
          <el-button size="small" class="cat-edit-btn" @click.stop="openCatDialog(item)">
            <LucideIcon name="Tags" :size="12" />
            分类
          </el-button>
          <span
            v-for="cid in (item.categoryIds || [])"
            :key="cid"
            class="cat-tag"
            :style="catTagStyle(cid)"
          >{{ categoryName(cid) }}</span>
        </div>

        <!-- 卡片操作按钮：笔记（查看/管理）、导出、编辑信息，阻止冒泡避免触发打开 -->
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
          <el-button
            size="small"
            @click.stop="openMetaDialog(item)"
            title="编辑书名 / 作者 / 封面"
          >
            <LucideIcon name="SquarePen" :size="13" />
            信息
          </el-button>
        </div>
      </div>
    </div>
    <!-- 底部统计：卡片模式展示分批加载进度；列表模式由虚拟表格全量承载，仅展示总数 -->
    <div v-if="items.length > 0" class="bookshelf-footer">
      <span v-if="viewMode === 'list'">共 {{ localFiltered.length }} 本书（虚拟滚动，仅渲染可视行）</span>
      <span v-else-if="visibleCount < localFiltered.length">已加载 {{ visibleCount }} / {{ localFiltered.length }} 本，上滑加载更多</span>
      <span v-else>已展示全部 {{ localFiltered.length }} 本书</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import moment from 'moment';
import { ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import BookshelfTable from './BookshelfTable.vue';
import { formatReadingDuration } from '../utils/fileUtils';
import type { BookshelfItem } from '@/store/useEbookReader';

const props = defineProps<{
  /** 书架列表 */
  items: BookshelfItem[];
  /** 每本书的笔记/划线/书签数量 + 累计阅读秒数映射（key 为 content_hash 或 file_path） */
  annotationCountMap: Record<string, { noteCount: number; highlightCount: number; bookmarkCount: number; readingSeconds?: number }>;
  /** 全部分类列表 */
  categories: { id: number; name: string; color?: string }[];
  /** 当前选中的分类筛选（null 表示不过滤，展示全部） */
  selectedCategory: number | null;
  /** 名称搜索关键词（按书名 / 文件名匹配） */
  searchKeyword: string;
}>();

const emit = defineEmits<{
  (e: 'open', item: BookshelfItem): void;
  (e: 'remove', item: BookshelfItem): void;
  (e: 'add-external'): void;
  (e: 'add-folder'): void;
  (e: 'open-file'): void;
  (e: 'open-annotations', item: BookshelfItem): void;
  (e: 'export', item: BookshelfItem): void;
  (e: 'export-all'): void;
  /** 一键清空书架（仅移除书架，保留其它内容） */
  (e: 'clear-all'): void;
  /** 分类筛选切换（null=全部） */
  (e: 'update:selected-category', value: number | null): void;
  /** 名称搜索关键词变化 */
  (e: 'update:search-keyword', value: string): void;
  /** 新增分类 */
  (e: 'add-category', name: string, color?: string): void;
  /** 删除分类 */
  (e: 'delete-category', id: number): void;
  /** 修改分类（名称 / 颜色） */
  (e: 'update-category', payload: { id: number; name?: string; color?: string | null }): void;
  /** 设置某本书关联的分类集合 */
  (e: 'set-book-categories', payload: { bookPath: string; categoryIds: number[] }): void;
  /** 编辑书籍元数据（书名/作者/封面），由父组件落库并刷新书架 */
  (e: 'edit-meta', payload: { item: BookshelfItem; title: string; author: string; cover: string }): void;
}>();

// ============ 展示模式：卡片网格 / 列表（虚拟表格） ============

/** 书架展示模式类型 */
type ViewMode = 'card' | 'list';
/** 展示模式的持久化键名（localStorage，跨会话记忆用户选择） */
const VIEW_MODE_KEY = 'ebook-reader:bookshelf-view-mode';

/** 从 localStorage 读取上次选择的展示模式，非法值回退卡片模式 */
function readViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    return v === 'list' ? 'list' : 'card';
  } catch {
    // 隐私模式等场景下 localStorage 可能不可用，回退默认值
    return 'card';
  }
}

/** 当前展示模式 */
const viewMode = ref<ViewMode>(readViewMode());

/** 切换展示模式并持久化 */
function setViewMode(mode: ViewMode): void {
  if (viewMode.value === mode) return;
  viewMode.value = mode;
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // 写入失败不影响本次切换
  }
}

/** 分类管理弹窗显隐 */
const manageVisible = ref(false);
/** 新增分类输入框 */
const newCatName = ref('');
/** 新增分类时的颜色（el-color-picker 绑定，空串表示不设置颜色） */
const newCatColor = ref('');
/** 管理弹窗内分类编辑缓存：id -> { name, color }，打开时初始化，改名/改色即时上抛 */
const catEditCache = ref<Record<number, { name: string; color: string }>>({});
/** 当前弹层中正在编辑的书所勾选的分类 id 列表 */
const popoverSelected = ref<number[]>([]);

/** 书籍设置分类弹窗的显隐 */
const catDialogVisible = ref(false);
/** 当前正在设置分类的书籍 */
const catDialogItem = ref<BookshelfItem | null>(null);
/** 分类弹窗内搜索关键词 */
const catSearch = ref('');

/** 分类弹窗内按关键词过滤后的分类列表（按名称匹配，空关键词展示全部） */
const filteredCategories = computed(() => {
  const kw = catSearch.value.trim().toLowerCase();
  if (!kw) return props.categories;
  return props.categories.filter((c) => c.name.toLowerCase().includes(kw));
});

/** 打开分类管理弹窗时，用当前分类列表初始化编辑缓存（name/color 各一份副本） */
watch(manageVisible, (v) => {
  if (v) {
    const cache: Record<number, { name: string; color: string }> = {};
    props.categories.forEach((c) => {
      cache[c.id] = { name: c.name, color: c.color || '' };
    });
    catEditCache.value = cache;
  }
});

/**
 * 滚动触底分批渲染：避免书籍过多时一次性渲染全部卡片导致页面卡顿。
 * visibleItems 始终为 localFiltered（分类/关键词之外再叠加格式/状态/排序）的前 visibleCount 项，
 * 滚动到底部时 visibleCount 递增一个批次，直至展示全部。
 */
/** 每批渲染的书籍数量 */
const PAGE_SIZE = 60;
/** 当前已渲染的书籍数量（随滚动触底递增） */
const visibleCount = ref(PAGE_SIZE);
/** 实际渲染的列表（从完整筛选结果中切片，控制 DOM 数量） */
const visibleItems = computed(() => localFiltered.value.slice(0, visibleCount.value));

// ===== 快速筛选 / 排序（2026-10-01 增强，全部本地持久化）=====

/** 格式筛选选项 */
const FORMAT_OPTIONS = [
  { label: 'TXT', value: 'txt' },
  { label: 'EPUB', value: 'epub' },
  { label: 'PDF', value: 'pdf' },
] as const;

/** 阅读状态判定阈值（percent 0-100） */
function matchReadStatus(percent: number, status: string): boolean {
  if (status === 'unread') return percent <= 0;
  if (status === 'reading') return percent > 0 && percent < 100;
  if (status === 'finished') return percent >= 100;
  return true;
}

/** localStorage 安全读写 */
function readLocal(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

const FORMAT_KEY = 'ebook-reader:format-filter';
const STATUS_KEY = 'ebook-reader:read-status';
const SORT_KEY = 'ebook-reader:card-sort';

/** 格式筛选（空 = 不过滤） */
const formatFilter = ref<string[]>(readLocal(FORMAT_KEY, '') ? readLocal(FORMAT_KEY, '').split(',') : []);
/** 阅读状态筛选 */
const readStatusFilter = ref<'all' | 'unread' | 'reading' | 'finished'>(
  (readLocal(STATUS_KEY, 'all') as 'all' | 'unread' | 'reading' | 'finished') || 'all'
);
/** 卡片模式排序键（空 = 默认按上次阅读时间） */
const cardSortKey = ref(readLocal(SORT_KEY, ''));

function toggleFormat(value: string): void {
  const list = formatFilter.value.includes(value)
    ? formatFilter.value.filter((v) => v !== value)
    : [...formatFilter.value, value];
  formatFilter.value = list;
  writeLocal(FORMAT_KEY, list.join(','));
}

/**
 * 书架容器滚动事件：触底时递增可见数量，分批加载后续书籍。
 * 仅当还有未渲染的书籍、且滚动位置进入距离底部 threshold 像素内时触发。
 */
function onScroll(e: Event): void {
  const el = e.target as HTMLElement;
  const threshold = 120;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
    if (visibleCount.value < localFiltered.value.length) {
      visibleCount.value = Math.min(visibleCount.value + PAGE_SIZE, localFiltered.value.length);
    }
  }
}
watch([readStatusFilter, cardSortKey], () => {
  writeLocal(STATUS_KEY, readStatusFilter.value);
  writeLocal(SORT_KEY, cardSortKey.value);
});

/**
 * 组件内二次过滤：格式 + 阅读状态 + 卡片排序。
 * 父组件的 filteredItems 已做 分类 + 关键词 过滤，这里在其结果上叠加。
 */
const localFiltered = computed(() => {
  let list = props.items;
  if (formatFilter.value.length > 0) {
    list = list.filter((b) => formatFilter.value.includes(b.format));
  }
  if (readStatusFilter.value !== 'all') {
    list = list.filter((b) => matchReadStatus(b.percent || 0, readStatusFilter.value));
  }
  if (viewMode.value === 'card' && cardSortKey.value) {
    const key = cardSortKey.value as 'lastReadAt' | 'addedAt' | 'title' | 'percent';
    const sorted = [...list];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (key === 'title') {
        cmp = (a.title || a.name || '').localeCompare(b.title || b.name || '', 'zh-CN');
      } else if (key === 'percent') {
        cmp = (a.percent || 0) - (b.percent || 0);
      } else {
        cmp = String(a[key] || '').localeCompare(String(b[key] || ''));
      }
      return cmp;
    });
    // 排序类默认倒序（最近阅读/最新添加/进度在前），书名保持正序
    if (key !== 'title') sorted.reverse();
    list = sorted;
  }
  return list;
});

// 筛选结果变化（切换分类 / 搜索 / 格式 / 状态）时重置为初始批次，避免看到旧批次残留
watch(
  () => localFiltered.value,
  () => {
    visibleCount.value = PAGE_SIZE;
  }
);

/** 新增分类：trim 后向上抛出（含可选颜色），清空输入框与颜色 */
function onAddCategory(): void {
  const name = newCatName.value.trim();
  if (!name) return;
  emit('add-category', name, newCatColor.value || undefined);
  newCatName.value = '';
  newCatColor.value = '';
}

/** 删除分类：二次确认后向上抛出分类 id（误删会连带清空所有书的该分类归属，必须确认） */
async function onDeleteCategory(id: number): Promise<void> {
  const name = props.categories.find((c) => c.id === id)?.name || '该分类';
  try {
    await ElMessageBox.confirm(
      `确认删除分类「${name}」？该书分类下所有书籍的归属将一并移除。`,
      '删除分类',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
  } catch {
    return;
  }
  emit('delete-category', id);
}

/** 修改分类（改名 / 改色）：读取编辑缓存并向上抛出 */
function onUpdateCategory(id: number): void {
  const c = catEditCache.value[id];
  if (!c) return;
  emit('update-category', { id, name: c.name, color: c.color || null });
}

/** 按分类 id 取名称（用于卡片标签展示） */
function categoryName(id: number): string {
  return props.categories.find((c) => c.id === id)?.name ?? '';
}

/** 按分类 id 取颜色（用于卡片标签背景着色） */
function categoryColor(id: number): string {
  return props.categories.find((c) => c.id === id)?.color || '';
}

/** 卡片分类标签样式：有颜色则按颜色着色，否则回退主题色 */
function catTagStyle(id: number): Record<string, string> {
  const color = categoryColor(id);
  if (!color) return {};
  return {
    background: `${color}22`,
    color,
    border: `1px solid ${color}55`,
  };
}

/** 打开书籍设置分类弹窗：初始化勾选项与搜索词 */
function openCatDialog(item: BookshelfItem): void {
  catDialogItem.value = item;
  popoverSelected.value = [...(item.categoryIds || [])];
  catSearch.value = '';
  catDialogVisible.value = true;
}

/** 保存该书分类：向上抛出书路径与勾选的分类 id 列表，关闭弹窗 */
function saveBookCats(): void {
  if (!catDialogItem.value) return;
  emit('set-book-categories', { bookPath: catDialogItem.value.path, categoryIds: [...popoverSelected.value] });
  catDialogVisible.value = false;
}

// ===== 关键词搜索防抖（300ms）=====

/** 输入框本地值（立即回显），防抖后再向上抛 */
let keywordTimer: ReturnType<typeof setTimeout> | null = null;
function onKeywordInput(value: string): void {
  if (keywordTimer) clearTimeout(keywordTimer);
  keywordTimer = setTimeout(() => {
    keywordTimer = null;
    emit('update:search-keyword', value);
  }, 300);
}

// ===== 拖拽：卡片拖到分类 chip 加入分类（E2b）=====

/** 卡片开始拖拽：把书路径写入 dataTransfer（分类 chip 的 drop 消费） */
function onCardDragStart(item: BookshelfItem, e: DragEvent): void {
  try {
    e.dataTransfer?.setData('text/ebook-path', item.path);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
  } catch {
    /* ignore */
  }
}

/** 卡片拖到分类 chip 松手：把该书追加进该分类（已有则忽略） */
function onDropToCategory(categoryId: number, e: DragEvent): void {
  const path = e.dataTransfer?.getData('text/ebook-path') || '';
  if (!path) return;
  const item = props.items.find((b) => b.path === path);
  if (!item) return;
  const ids = item.categoryIds || [];
  if (ids.includes(categoryId)) return;
  emit('set-book-categories', { bookPath: path, categoryIds: [...ids, categoryId] });
}

// ===== 书籍元数据编辑（E1：手动改 书名/作者/封面）=====

const metaDialog = ref<{ visible: boolean; item: BookshelfItem | null; title: string; author: string; cover: string }>({
  visible: false,
  item: null,
  title: '',
  author: '',
  cover: '',
});
const coverInputRef = ref<HTMLInputElement | null>(null);

/** 打开编辑弹窗（卡片「信息」按钮 / 列表右键菜单） */
function openMetaDialog(item: BookshelfItem): void {
  metaDialog.value = {
    visible: true,
    item,
    title: item.title || '',
    author: item.author || '',
    cover: item.cover || '',
  };
}

/** 选择本地图片作为封面（转 dataURL 预览，保存时随元数据落库） */
function onPickCover(e: Event): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    metaDialog.value.cover = (reader.result as string) || '';
  };
  reader.readAsDataURL(file);
  input.value = '';
}

/** 保存元数据：向上抛出（父组件走 save-book-meta IPC 落库并刷新书架） */
function saveMetaDialog(): void {
  const item = metaDialog.value.item;
  if (!item) return;
  emit('edit-meta', {
    item,
    title: metaDialog.value.title.trim(),
    author: metaDialog.value.author.trim(),
    cover: metaDialog.value.cover,
  });
  metaDialog.value.visible = false;
}

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

/* 列表模式：整页不滚动，改由虚拟表格内部滚动，表格填充剩余高度 */
.bookshelf-view.list-mode {
  display: flex;
  flex-direction: column;
  overflow: hidden;

  /* 头部 / 筛选栏 / 底部统计不参与压缩，剩余空间全部留给表格 */
  .bookshelf-header,
  .bookshelf-filter,
  .bookshelf-footer {
    flex-shrink: 0;
  }

  .bookshelf-footer {
    padding: 10px 0 0;
  }
}

/* 虚拟表格占据 header / 筛选栏 / footer 之外的全部剩余高度（min-height:0 才能正确收缩） */
.bookshelf-table-fill {
  flex: 1;
  min-height: 0;
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

  /* 展示模式切换：纯图标按钮，收窄内边距 */
  .view-mode-switch {
    :deep(.el-button) {
      padding: 5px 9px;
    }
  }
}

/* 空书架提示 */
.bookshelf-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
}

/* 触底加载指示 */
.bookshelf-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 0 4px;
  font-size: 12px;
  color: var(--text-muted);
  user-select: none;
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

  /* 作者：单行截断，浅色 */
  .book-author {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 封面：固定比例缩略图，无封面时占位 */
  .book-cover {
    width: 100%;
    aspect-ratio: 3 / 4;
    border-radius: var(--radius-card);
    overflow: hidden;
    background: var(--bg-base);
    display: flex;
    align-items: center;
    justify-content: center;

    .book-cover-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .book-cover-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: 700;
      color: var(--text-secondary);
      background: var(--bg-base);
    }
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
      &.bookmark {
        color: #d9881e;
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

/* 分类筛选栏：左侧分类 chips，右侧搜索 + 管理分类 */
.bookshelf-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;

  .cat-chips {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .cat-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      padding: 4px 12px;
      border-radius: 14px;
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      cursor: pointer;
      user-select: none;
      transition: all 0.15s;

      &:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }

      /* 键盘可达性：Tab 聚焦时显示焦点环（chips 为可聚焦 span） */
      &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 1px;
      }

      &.active {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: #fff;
      }
    }

    /* 分类色点 */
    .cat-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
  }

  .filter-right {
    display: flex;
    align-items: center;
    gap: 8px;

    :deep(.el-input) {
      width: 210px;
    }
  }

  /* 快速筛选区：格式 chips + 状态/排序下拉（2026-10-01 增强） */
  .quick-filters {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .fmt-chip {
      padding: 3px 10px;
      font-size: 12px;
      border-radius: 12px;
      border: 1px solid var(--border-subtle);
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      user-select: none;
      transition: all 0.15s;

      &:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }

      &.active {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: #fff;
      }
    }

    .status-select,
    .sort-select {
      width: 100px;
    }
  }
}

/* 书籍元数据编辑弹窗 */
.meta-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;

  .meta-row {
    display: flex;
    align-items: center;
    gap: 10px;

    .meta-label {
      width: 42px;
      flex-shrink: 0;
      font-size: 13px;
      color: var(--text-secondary);
    }

    :deep(.el-input) {
      flex: 1;
    }
  }

  .meta-cover {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;

    .meta-cover-preview {
      width: 56px;
      height: 74px;
      border-radius: 6px;
      background-size: cover;
      background-position: center;
      border: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: var(--text-muted);

      &.empty {
        background: var(--bg-base);
      }
    }
  }
}

/* 分类管理弹窗 */
.cat-manage {
  .cat-add {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;

    :deep(.el-input) {
      flex: 1;
    }
  }

  .cat-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 320px;
    overflow: auto;

    .cat-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-card);
      background: var(--bg-card);

      .cat-edit-name {
        flex: 1;
        min-width: 0;
      }
    }

    .cat-empty {
      text-align: center;
      font-size: 13px;
      color: var(--text-muted);
      padding: 16px 0;
    }
  }
}

/* 书籍分类弹窗：搜索 + 可滚动多选列表 */
.cat-dialog {
  .cat-dialog-search {
    margin-bottom: 12px;
  }

  .cat-dialog-list {
    max-height: 320px;
    overflow: auto;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);

    .cat-dialog-group {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    .cat-dialog-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      cursor: pointer;
      border-bottom: 1px solid var(--border-subtle);

      &:last-child {
        border-bottom: none;
      }

      &:hover {
        background: var(--bg-base);
      }

      .cat-dialog-name {
        font-size: 13px;
        color: var(--text-primary);
      }
    }

    .cat-empty {
      text-align: center;
      font-size: 13px;
      color: var(--text-muted);
      padding: 16px 0;
    }
  }
}

/* 卡片内分类区：分类按钮 + 标签 */
.book-cats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;

  .cat-edit-btn {
    height: 24px;
    padding: 0 8px;
    color: var(--text-secondary);
  }

  .cat-tag {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(var(--color-primary-rgb, 64, 158, 255), 0.12);
    color: var(--color-primary);
  }
}
</style>
