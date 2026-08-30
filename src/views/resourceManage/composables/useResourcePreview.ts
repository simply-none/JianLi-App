/**
 * 资源预览组合式函数：弹窗状态 / 内容加载 / 上下切换 / 图片缩放旋转
 *
 * 预览导航基于传入的展示列表（筛选排序后的列表），
 * 文本类型文件经 resource:read-text-file 通道读取（修复旧版死代码通道）。
 */
import { computed, ref, watch } from 'vue';
import type { ResourceItem } from '../types';
import { readTextFile } from '../api/resourceApi';
import { getFileType } from '../utils/fileType';

/**
 * 资源预览组合式函数
 *
 * @returns 预览状态与操作方法集合
 */
export function useResourcePreview() {
  /** 预览弹窗可见性 */
  const visible = ref(false);
  /** 当前预览的资源 */
  const currentItem = ref<ResourceItem | null>(null);
  /** 导航列表（展示列表的引用，用于上一个/下一个） */
  const navList = ref<ResourceItem[]>([]);
  /** 当前项在导航列表中的索引 */
  const navIndex = computed(() => {
    if (!currentItem.value) return -1;
    return navList.value.findIndex((it) => it.key === currentItem.value?.key);
  });
  /** 当前预览类型 */
  const previewType = computed(() => {
    if (!currentItem.value) return 'other';
    return getFileType(currentItem.value.name || currentItem.value.path);
  });
  /** 文本内容加载中 */
  const textLoading = ref(false);
  /** 文本内容 */
  const textContent = ref('');
  /** 文本是否被截断 */
  const textTruncated = ref(false);
  /** 图片缩放比例（1 = 原始） */
  const imageZoom = ref(1);
  /** 图片旋转角度（度） */
  const imageRotate = ref(0);

  /**
   * 加载当前项的预览数据（文本类型异步读内容，其他类型重置变换）
   *
   * @returns {Promise<void>} 无返回值
   */
  async function loadPreviewData(): Promise<void> {
    imageZoom.value = 1;
    imageRotate.value = 0;
    textContent.value = '';
    textTruncated.value = false;
    if (previewType.value !== 'text' || !currentItem.value) return;
    textLoading.value = true;
    try {
      const res = await readTextFile(currentItem.value.path);
      if (res) {
        textContent.value = res.content;
        textTruncated.value = res.truncated;
      } else {
        textContent.value = '读取文件失败';
      }
    } finally {
      textLoading.value = false;
    }
  }

  // 当前项变化时重新加载预览数据
  watch(currentItem, () => {
    loadPreviewData();
  });

  /**
   * 打开预览弹窗
   *
   * @param {ResourceItem} item - 待预览资源（必填）
   * @param {ResourceItem[]} list - 当前展示列表（用于上一个/下一个导航，必填）
   * @returns {void} 无返回值
   */
  function open(item: ResourceItem, list: ResourceItem[]): void {
    navList.value = list;
    currentItem.value = item;
    visible.value = true;
  }

  /**
   * 关闭预览弹窗
   *
   * @returns {void} 无返回值
   */
  function close(): void {
    visible.value = false;
    currentItem.value = null;
  }

  /**
   * 切换到上一个资源
   *
   * @returns {void} 无返回值
   */
  function prev(): void {
    if (navIndex.value > 0) {
      currentItem.value = navList.value[navIndex.value - 1];
    }
  }

  /**
   * 切换到下一个资源
   *
   * @returns {void} 无返回值
   */
  function next(): void {
    if (navIndex.value >= 0 && navIndex.value < navList.value.length - 1) {
      currentItem.value = navList.value[navIndex.value + 1];
    }
  }

  /**
   * 图片放大（上限 5 倍）
   *
   * @returns {void} 无返回值
   */
  function zoomIn(): void {
    imageZoom.value = Math.min(5, imageZoom.value + 0.25);
  }

  /**
   * 图片缩小（下限 0.25 倍）
   *
   * @returns {void} 无返回值
   */
  function zoomOut(): void {
    imageZoom.value = Math.max(0.25, imageZoom.value - 0.25);
  }

  /**
   * 图片旋转 90 度
   *
   * @returns {void} 无返回值
   */
  function rotate(): void {
    imageRotate.value = (imageRotate.value + 90) % 360;
  }

  return {
    // 状态
    visible,
    currentItem,
    previewType,
    navIndex,
    navListLength: computed(() => navList.value.length),
    textLoading,
    textContent,
    textTruncated,
    imageZoom,
    imageRotate,
    // 方法
    open,
    close,
    prev,
    next,
    zoomIn,
    zoomOut,
    rotate,
  };
}
