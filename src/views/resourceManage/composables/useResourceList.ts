/**
 * 资源列表组合式函数：加载 / 筛选 / 排序 / 搜索 / 多选 / 增删 / 统计
 *
 * 数据源为 SQLite resource 表（经 resourceApi），一次全量加载后
 * 在前端做搜索、类型筛选与排序，避免每次交互都查库。
 */
import { computed, ref, watch } from 'vue';
import type { ResourceItem, ResourceStats, ResourceType, SortField, SortOrder, ViewMode } from '../types';
import {
  addResource,
  deletePhysicalFile,
  deleteResource,
  existsResource,
  listResources,
  toggleStar,
} from '../api/resourceApi';
import { getStore, setStore } from '@/utils/common';

/** 视图模式持久化键 */
const VIEW_MODE_KEY = 'resource:view-mode';

/**
 * 资源列表组合式函数
 *
 * @returns 列表状态与操作方法集合
 */
export function useResourceList() {
  /** 全量资源列表（来自数据库） */
  const items = ref<ResourceItem[]>([]);
  /** 是否加载中 */
  const loading = ref(false);
  /** 搜索关键词（原始输入） */
  const keyword = ref('');
  /** 类型筛选（空数组 = 全部） */
  const filterTypes = ref<ResourceType[]>([]);
  /** 排序字段 */
  const sortBy = ref<SortField>('created_at');
  /** 排序方向 */
  const order = ref<SortOrder>('desc');
  /** 视图模式（持久化） */
  const viewMode = ref<ViewMode>(getStore(VIEW_MODE_KEY) === 'list' ? 'list' : 'grid');
  /** 批量模式开关 */
  const batchMode = ref(false);
  /** 已选中的资源主键集合 */
  const selectedKeys = ref<Set<string>>(new Set());

  // 视图模式变更时持久化
  watch(viewMode, (mode) => {
    setStore(VIEW_MODE_KEY, mode);
  });

  /**
   * 展示列表：在全量数据上做搜索过滤 + 类型筛选 + 排序
   */
  const displayItems = computed<ResourceItem[]>(() => {
    const kw = keyword.value.trim().toLowerCase();
    const types = filterTypes.value;
    let list = items.value;
    if (kw) {
      list = list.filter((it) => (it.name || '').toLowerCase().includes(kw));
    }
    if (types.length > 0) {
      list = list.filter((it) => types.includes(it.type));
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortBy.value === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '', 'zh-CN');
      } else if (sortBy.value === 'size') {
        cmp = (a.size || 0) - (b.size || 0);
      } else {
        cmp = (a.created_at || '').localeCompare(b.created_at || '');
      }
      return order.value === 'asc' ? cmp : -cmp;
    });
    return sorted;
  });

  /**
   * 统计信息：总数 / 总大小 / 各类型数量
   */
  const stats = computed<ResourceStats>(() => {
    const typeCounts: Partial<Record<ResourceType, number>> = {};
    let totalSize = 0;
    for (const it of items.value) {
      totalSize += it.size || 0;
      typeCounts[it.type] = (typeCounts[it.type] || 0) + 1;
    }
    return { total: items.value.length, totalSize, typeCounts };
  });

  /**
   * 从数据库加载全量资源
   *
   * @returns {Promise<void>} 无返回值
   */
  async function load(): Promise<void> {
    loading.value = true;
    try {
      items.value = await listResources();
    } finally {
      loading.value = false;
    }
  }

  /**
   * 批量删除资源（删除数据库记录；物理文件删除由调用方决定）
   *
   * @param {string[]} keys - 待删除资源主键集合（必填）
   * @param {boolean} deletePhysical - 是否同时删除物理文件
   * @param {string} cacheDir - 物理文件删除白名单目录（缓存路径）
   * @returns {Promise<{ removed: number; physicalFailed: number }>} 移除条数与物理删除失败数
   */
  async function removeItems(
    keys: string[],
    deletePhysical: boolean,
    cacheDir: string,
  ): Promise<{ removed: number; physicalFailed: number }> {
    let removed = 0;
    let physicalFailed = 0;
    for (const key of keys) {
      const item = items.value.find((it) => it.key === key);
      if (deletePhysical && item?.path) {
        const ok = await deletePhysicalFile(item.path, cacheDir);
        if (!ok) physicalFailed++;
      }
      if (await deleteResource(key)) removed++;
    }
    // 本地同步移除，免重查
    const keySet = new Set(keys);
    items.value = items.value.filter((it) => !keySet.has(it.key));
    selectedKeys.value.clear();
    return { removed, physicalFailed };
  }

  /**
   * 上传完成后的入库处理：去重校验（同名同大小）→ 入库 → 刷新
   *
   * @param {Object} payload - 上传结果（path/name/size 必填）
   * @param {string} payload.path - 落盘绝对路径
   * @param {string} payload.name - 原始文件名
   * @param {number} payload.size - 文件大小（字节）
   * @param {string} cacheDir - 缓存目录（去重跳过时用于清理刚落盘的重复文件）
   * @returns {Promise<'added' | 'duplicate'>} added=已入库 duplicate=重复已跳过
   */
  async function handleFileSaved(
    payload: { path: string; name: string; size: number },
    cacheDir: string,
  ): Promise<'added' | 'duplicate'> {
    if (await existsResource(payload.name, payload.size)) {
      // 重复上传：清理刚落盘的文件并跳过入库
      await deletePhysicalFile(payload.path, cacheDir);
      return 'duplicate';
    }
    await addResource(payload);
    await load();
    return 'added';
  }

  /**
   * 切换收藏状态（本地状态与数据库同步更新）
   *
   * @param {ResourceItem} item - 目标资源（必填）
   * @returns {Promise<void>} 无返回值
   */
  async function starItem(item: ResourceItem): Promise<void> {
    const next: 0 | 1 = item.is_starred === 1 ? 0 : 1;
    item.is_starred = next;
    await toggleStar(item.key, next === 1);
  }

  /**
   * 是否已选中
   *
   * @param {string} key - 资源主键（必填）
   * @returns {boolean} true 表示已选中
   */
  function isSelected(key: string): boolean {
    return selectedKeys.value.has(key);
  }

  /**
   * 切换单个资源的选中状态
   *
   * @param {string} key - 资源主键（必填）
   * @returns {void} 无返回值
   */
  function toggleSelect(key: string): void {
    const set = new Set(selectedKeys.value);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    selectedKeys.value = set;
  }

  /**
   * 全选当前展示列表
   *
   * @returns {void} 无返回值
   */
  function selectAll(): void {
    selectedKeys.value = new Set(displayItems.value.map((it) => it.key));
  }

  /**
   * 清空选中
   *
   * @returns {void} 无返回值
   */
  function clearSelection(): void {
    selectedKeys.value = new Set();
  }

  return {
    // 状态
    items,
    loading,
    keyword,
    filterTypes,
    sortBy,
    order,
    viewMode,
    batchMode,
    selectedKeys,
    // 计算属性
    displayItems,
    stats,
    // 方法
    load,
    removeItems,
    handleFileSaved,
    starItem,
    isSelected,
    toggleSelect,
    selectAll,
    clearSelection,
  };
}
