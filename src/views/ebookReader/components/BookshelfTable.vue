<template>
  <!-- 书架列表模式：Element Plus 虚拟表格（ElTableV2），仅渲染可视区行，书籍上万也不卡顿 -->
  <div ref="rootRef" class="bookshelf-table">
    <el-table-v2
      :columns="columns"
      :data="displayRows"
      :width="tableWidth"
      :height="tableHeight"
      :row-height="52"
      :estimated-row-height="52"
      :cache="12"
      row-key="path"
      :scrollbar-always-on="true"
      :sort-state="sortState"
      :row-event-handlers="rowEventHandlers"
      @column-sort="onColumnSort"
    >
      <template #empty>
        <span class="tb-muted">暂无书籍</span>
      </template>
    </el-table-v2>

    <!-- 右键上下文菜单：打开 / 笔记 / 导出 / 设置分类 / 移除 -->
    <div
      v-if="menu.visible"
      class="ctx-menu"
      :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      @click.stop
    >
      <div class="ctx-item" @click="menuOpen">
        <LucideIcon name="BookOpenText" :size="14" />
        <span>打开阅读</span>
      </div>
      <div class="ctx-item" @click="menuAnnotations">
        <LucideIcon name="NotebookPen" :size="14" />
        <span>查看笔记</span>
      </div>
      <div class="ctx-item" @click="menuExport">
        <LucideIcon name="Download" :size="14" />
        <span>导出笔记</span>
      </div>
      <div class="ctx-item" @click="menuSetCategories">
        <LucideIcon name="Tags" :size="14" />
        <span>设置分类</span>
      </div>
      <div class="ctx-divider"></div>
      <div class="ctx-item danger" @click="menuRemove">
        <LucideIcon name="Trash2" :size="14" />
        <span>从书架移除</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, h } from 'vue';
import { ElTableV2, ElTag, ElProgress, ElTooltip, TableV2SortOrder } from 'element-plus';
import type { Column, SortState, ColumnSortParams } from 'element-plus';
import moment from 'moment';
import LucideIcon from '@/components/LucideIcon.vue';
import type { BookshelfItem } from '@/store/useEbookReader';

const props = defineProps<{
  /** 书架列表（已按分类 / 关键词筛选，由父组件传入） */
  items: BookshelfItem[];
  /** 每本书的笔记/划线/书签数量映射（key 为 content_hash 或 file_path） */
  annotationCountMap: Record<string, { noteCount: number; highlightCount: number; bookmarkCount: number }>;
  /** 全部分类列表（用于分类列的名称与颜色渲染） */
  categories: { id: number; name: string; color?: string }[];
}>();

const emit = defineEmits<{
  /** 打开该书进入阅读 */
  (e: 'open', item: BookshelfItem): void;
  /** 从书架移除该书 */
  (e: 'remove', item: BookshelfItem): void;
  /** 打开该书的笔记面板 */
  (e: 'open-annotations', item: BookshelfItem): void;
  /** 导出该书笔记 */
  (e: 'export', item: BookshelfItem): void;
  /** 请求为该书设置分类（由父组件复用已有的分类弹窗） */
  (e: 'request-set-categories', item: BookshelfItem): void;
}>();

/** 表格行数据：在书架条目上补齐用于排序/展示的派生字段 */
interface TableRow extends BookshelfItem {
  /** 展示用书名（title 优先，回退文件名），同时作为书名列排序键 */
  displayTitle: string;
  /** 笔记数（按内容身份取，副本与原书共用） */
  noteCount: number;
  /** 划线数 */
  highlightCount: number;
  /** 书签数 */
  bookmarkCount: number;
}

// ============ 容器尺寸测量（虚拟表格必须显式宽高） ============

const rootRef = ref<HTMLElement | null>(null);
const tableWidth = ref(900);
const tableHeight = ref(400);
let ro: ResizeObserver | null = null;

/** 测量容器尺寸，作为虚拟表格的 width / height */
function measure(): void {
  const el = rootRef.value;
  if (!el) return;
  tableWidth.value = Math.max(360, el.clientWidth);
  tableHeight.value = Math.max(200, el.clientHeight);
}

// ============ 行数据与排序 ============

/** 由 props.items 派生的表格行（补齐 displayTitle 与三个数量字段，供排序与渲染使用） */
const rows = computed<TableRow[]>(() =>
  props.items.map((item) => {
    // 数量按 contentHash 优先取（同内容副本共用标注），回退文件路径
    const counts = props.annotationCountMap[item.contentHash || item.path];
    return {
      ...item,
      displayTitle: item.title || item.name,
      noteCount: counts?.noteCount || 0,
      highlightCount: counts?.highlightCount || 0,
      bookmarkCount: counts?.bookmarkCount || 0,
    };
  })
);

/** 排序状态：受控排序（el-table-v2 约定，键为列 key，值为 'asc' / 'desc'；空对象表示不排序） */
const sortState = ref<SortState>({});

/** 按当前排序状态对 rows 派生出最终展示数据（不排序时保持父组件传入顺序） */
const displayRows = computed<TableRow[]>(() => {
  const entries = Object.entries(sortState.value);
  if (!entries.length) return rows.value;
  const [key, order] = entries[0];
  const copy = [...rows.value];
  copy.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[key];
    const bv = (b as unknown as Record<string, unknown>)[key];
    // null / undefined / 空串 永远排在末尾，与排序方向无关
    const aEmpty = av == null || av === '';
    const bEmpty = bv == null || bv === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    let cmp: number;
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv), 'zh-CN');
    }
    return order === 'asc' ? cmp : -cmp;
  });
  return copy;
});

/** 列头点击排序：升序 → 降序 → 取消 三者循环 */
function onColumnSort({ key }: ColumnSortParams<TableRow>): void {
  if (!key) return;
  const cur = sortState.value[key];
  if (!cur) {
    sortState.value = { [key]: TableV2SortOrder.ASC };
  } else if (cur === TableV2SortOrder.ASC) {
    sortState.value = { [key]: TableV2SortOrder.DESC };
  } else {
    // 已降序：再次点击取消排序（恢复原始顺序）
    sortState.value = {};
  }
}

// ============ 分类展示辅助 ============

/** 按分类 id 取名称 */
function categoryName(id: number): string {
  return props.categories.find((c) => c.id === id)?.name ?? '';
}

/** 分类标签样式：有颜色则按颜色着色，否则回退主题色（与卡片模式一致） */
function catTagStyle(id: number): Record<string, string> {
  const color = props.categories.find((c) => c.id === id)?.color || '';
  if (!color) return {};
  return {
    background: `${color}22`,
    color,
    border: `1px solid ${color}55`,
  };
}

/**
 * 格式化时间字段为可读字符串
 *
 * @param time - ISO 字符串时间
 * @returns 'YYYY-MM-DD HH:mm'；输入为空或无效时返回 '--'
 */
function formatTime(time: string): string {
  if (!time) return '--';
  const m = moment(time);
  if (!m.isValid()) return '--';
  return m.format('YYYY-MM-DD HH:mm');
}

/** 格式徽标的 el-tag 类型：epub 黄 / pdf 红 / 其它（txt）绿，与卡片模式一致 */
function formatTagType(format: string): 'warning' | 'danger' | 'success' {
  if (format === 'epub') return 'warning';
  if (format === 'pdf') return 'danger';
  return 'success';
}

// ============ 列定义 ============

/** 除「书名」列外的固定列宽之和；书名列动态填充剩余宽度 */
const FIXED_W = 52 + 76 + 120 + 150 + 150 + 76 + 76 + 76 + 170; // = 946

const columns = computed<Column<TableRow>[]>(() => {
  const titleW = Math.max(180, tableWidth.value - FIXED_W);
  return [
    // 封面：缩略图，无封面则用格式首字母占位
    {
      key: 'cover',
      dataKey: 'cover',
      title: '封面',
      width: 120,
      align: 'center',
      cellRenderer: ({ rowData }) =>
        h(
          'div',
          { class: 'tb-cover' },
          rowData.cover
            ? [h('img', { src: rowData.cover, class: 'tb-cover-img', alt: rowData.displayTitle })]
            : [h('span', { class: 'tb-cover-fb' }, (rowData.format || '?').toUpperCase().charAt(0))]
        ),
    },
    // 格式徽标
    {
      key: 'format',
      dataKey: 'format',
      title: '格式',
      width: 76,
      align: 'center',
      sortable: true,
      cellRenderer: ({ rowData }) =>
        h(ElTag, { size: 'small', type: formatTagType(rowData.format) }, () =>
          (rowData.format || '').toUpperCase()
        ),
    },
    // 书名：hover 展示文件名与完整路径（与卡片模式的 tooltip 一致）
    {
      key: 'displayTitle',
      dataKey: 'displayTitle',
      title: '书名',
      width: titleW,
      sortable: true,
      cellRenderer: ({ rowData }) =>
        h(
          ElTooltip,
          { placement: 'top', showAfter: 300, effect: 'dark' },
          {
            content: () =>
              h('div', { style: 'max-width:320px;line-height:1.7;font-size:12px;' }, [
                h('div', { style: 'margin-bottom:4px;' }, [
                  h('span', { style: 'color:#c0c4cc;margin-right:8px;' }, '文件名'),
                  h('b', { style: 'color:#fff;' }, rowData.name),
                ]),
                h('div', [
                  h('span', { style: 'color:#c0c4cc;margin-right:8px;' }, '路径'),
                  h('span', { style: 'word-break:break-all;color:#fff;' }, rowData.path),
                ]),
              ]),
            default: () => h('span', { class: 'tb-title' }, rowData.displayTitle),
          }
        ),
    },
    // 作者
    {
      key: 'author',
      dataKey: 'author',
      title: '作者',
      width: 120,
      sortable: true,
      cellRenderer: ({ rowData }) =>
        h('span', { class: 'tb-author', title: rowData.author || '' }, rowData.author || '--'),
    },
    // 阅读进度：进度条 + 百分比
    {
      key: 'percent',
      dataKey: 'percent',
      title: '阅读进度',
      width: 150,
      sortable: true,
      cellRenderer: ({ rowData }) =>
        h('div', { class: 'tb-progress' }, [
          h(ElProgress, {
            percentage: rowData.percent,
            strokeWidth: 6,
            showText: false,
            status: rowData.percent >= 100 ? 'success' : undefined,
          }),
          h('span', { class: 'tb-progress-text' }, `${rowData.percent}%`),
        ]),
    },
    // 上次阅读时间
    {
      key: 'lastReadAt',
      dataKey: 'lastReadAt',
      title: '上次阅读',
      width: 150,
      sortable: true,
      cellRenderer: ({ rowData }) => h('span', { class: 'tb-time' }, formatTime(rowData.lastReadAt)),
    },
    // 笔记 / 划线 / 书签 数量
    {
      key: 'noteCount',
      dataKey: 'noteCount',
      title: '笔记',
      width: 76,
      align: 'center',
      sortable: true,
      cellRenderer: ({ rowData }) => h('span', { class: 'tb-num note' }, String(rowData.noteCount)),
    },
    {
      key: 'highlightCount',
      dataKey: 'highlightCount',
      title: '划线',
      width: 76,
      align: 'center',
      sortable: true,
      cellRenderer: ({ rowData }) =>
        h('span', { class: 'tb-num highlight' }, String(rowData.highlightCount)),
    },
    {
      key: 'bookmarkCount',
      dataKey: 'bookmarkCount',
      title: '书签',
      width: 76,
      align: 'center',
      sortable: true,
      cellRenderer: ({ rowData }) =>
        h('span', { class: 'tb-num bookmark' }, String(rowData.bookmarkCount)),
    },
    // 分类标签（只读展示，设置分类走右键菜单）
    {
      key: 'categories',
      dataKey: 'categoryIds',
      title: '分类',
      width: 170,
      cellRenderer: ({ rowData }) => {
        const ids: number[] = rowData.categoryIds || [];
        if (!ids.length) return h('span', { class: 'tb-muted' }, '--');
        return h(
          'div',
          { class: 'tb-cats' },
          ids.map((cid: number) =>
            h('span', { class: 'tb-cat-tag', key: cid, style: catTagStyle(cid) }, categoryName(cid))
          )
        );
      },
    },
  ];
});

// ============ 行交互：左键打开 / 右键菜单 ============

/** 右键菜单状态：位置为视口坐标（position: fixed） */
const menu = ref<{ visible: boolean; x: number; y: number; row: TableRow | null }>({
  visible: false,
  x: 0,
  y: 0,
  row: null,
});

/** 行事件：左键点击打开阅读，右键弹出上下文菜单 */
const rowEventHandlers = {
  onClick: ({ rowData }: { rowData: TableRow }) => {
    if (!rowData?.path) return;
    emit('open', rowData);
  },
  onContextmenu: (params: { rowData?: TableRow; event?: Event }) => {
    const rowData = params?.rowData;
    const event = params?.event as MouseEvent | undefined;
    if (!rowData?.path || !event) return;
    event.preventDefault();
    event.stopPropagation();
    menu.value = { visible: true, x: event.clientX, y: event.clientY, row: rowData };
  },
};

function closeMenu(): void {
  menu.value.visible = false;
}

/** 从菜单行数据中还原原始书架条目（剔除派生字段，避免向上抛出多余属性） */
function pickItem(row: TableRow): BookshelfItem {
  const { displayTitle, noteCount, highlightCount, bookmarkCount, ...rest } = row;
  // 派生字段仅用于表格排序/展示，向上抛出时剔除
  void displayTitle;
  void noteCount;
  void highlightCount;
  void bookmarkCount;
  return rest as BookshelfItem;
}

function menuOpen(): void {
  if (menu.value.row) emit('open', pickItem(menu.value.row));
  closeMenu();
}
function menuAnnotations(): void {
  if (menu.value.row) emit('open-annotations', pickItem(menu.value.row));
  closeMenu();
}
function menuExport(): void {
  if (menu.value.row) emit('export', pickItem(menu.value.row));
  closeMenu();
}
function menuSetCategories(): void {
  if (menu.value.row) emit('request-set-categories', pickItem(menu.value.row));
  closeMenu();
}
function menuRemove(): void {
  if (menu.value.row) emit('remove', pickItem(menu.value.row));
  closeMenu();
}

/** 点击页面其它位置时关闭右键菜单 */
function onWindowClick(): void {
  if (menu.value.visible) closeMenu();
}

onMounted(() => {
  measure();
  ro = new ResizeObserver(measure);
  if (rootRef.value) ro.observe(rootRef.value);
  window.addEventListener('click', onWindowClick);
});

onUnmounted(() => {
  ro?.disconnect();
  ro = null;
  window.removeEventListener('click', onWindowClick);
});
</script>

<style scoped lang="scss">
/* 列表模式根容器：由父组件通过 flex 撑满剩余高度，内部由虚拟表格自行滚动 */
.bookshelf-table {
  width: 100%;
  height: 100%;
  min-height: 200px;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--bg-card);

  /* 行 hover 高亮 + 手型，提示可点击打开 */
  :deep(.el-table-v2__row) {
    cursor: pointer;

    &:hover {
      background: var(--bg-base);
    }
  }

  :deep(.el-table-v2__header-cell) {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }
}

/* 空值 / 占位文案 */
.tb-muted {
  font-size: 12px;
  color: var(--text-muted);
}

/* 书名：单行截断 */
.tb-title {
  display: block;
  width: 100%;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 作者：单行截断，浅色 */
.tb-author {
  display: block;
  width: 100%;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 进度条 + 百分比 */
.tb-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;

  :deep(.el-progress) {
    flex: 1;
    min-width: 0;
  }

  .tb-progress-text {
    font-size: 12px;
    color: var(--text-secondary);
    min-width: 36px;
    text-align: right;
  }
}

/* 时间 */
.tb-time {
  font-size: 12px;
  color: var(--text-muted);
}

/* 数量：与卡片模式徽标同色系 */
.tb-num {
  font-size: 12px;
  font-variant-numeric: tabular-nums;

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

/* 分类标签：横向排列，超出隐藏 */
.tb-cats {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  overflow: hidden;

  .tb-cat-tag {
    flex-shrink: 0;
    font-size: 11px;
    padding: 1px 7px;
    border-radius: 9px;
    white-space: nowrap;
    background: rgba(var(--color-primary-rgb, 64, 158, 255), 0.12);
    color: var(--color-primary);
  }
}

/* 右键上下文菜单 */
.ctx-menu {
  position: fixed;
  z-index: 9999;
  min-width: 148px;
  padding: 4px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);

  .ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.12s;

    &:hover {
      background: var(--bg-base, rgba(0, 0, 0, 0.05));
      color: var(--color-primary);
    }

    /* 危险操作（移除）：hover 变红 */
    &.danger:hover {
      background: rgba(239, 68, 68, 0.08);
      color: #ef4444;
    }
  }

  /* 分隔线：把危险操作与普通操作隔开 */
  .ctx-divider {
    height: 1px;
    margin: 4px 6px;
    background: var(--border-subtle, #e5e7eb);
  }
}
</style>

<style lang="scss"> 
/* 封面缩略图（列宽小，用 36x44 的迷你封面） */
.tb-cover {
  width: 34px;
  height: 42px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--bg-base);
  display: flex;
  align-items: center;
  justify-content: center;

  .tb-cover-img {
    width: 90px;
    height: 90px;
    object-fit: cover;
    display: block;
  }

  .tb-cover-fb {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-secondary);
  }
}
</style>
