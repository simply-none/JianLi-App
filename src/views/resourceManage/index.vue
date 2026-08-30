<template>
  <layout-vue>
    <template #main>
      <div class="resource-page">
        <!-- 上传区 -->
        <ResourceUploadCard @file-saved="onFileSaved" />

        <!-- 工具栏 -->
        <ResourceToolbar
          v-model:keyword="keyword"
          v-model:filter-types="filterTypes"
          v-model:sort-by="sortBy"
          v-model:order="order"
          v-model:view-mode="viewMode"
          v-model:batch-mode="batchMode"
          :selected-count="selectedKeys.size"
          :total-count="displayItems.length"
          :refreshing="loading"
          @select-all="selectAll"
          @clear-selection="clearSelection"
          @batch-delete="onBatchDelete"
          @refresh="load"
        />

        <!-- 统计条 -->
        <ResourceStatsBar :stats="stats" />

        <!-- 资源列表 -->
        <div class="section">
          <h2 class="section-title">
            <LucideIcon name="FolderOpen" />
            文件列表
          </h2>
          <div class="file-area" v-loading="loading">
            <!-- 网格视图 -->
            <ResourceGrid
              v-if="viewMode === 'grid' && displayItems.length > 0"
              :items="displayItems"
              :batch-mode="batchMode"
              :selected-keys="selectedKeys"
              @preview="onPreview"
              @open-location="onOpenLocation"
              @star="onStar"
              @delete="onDeleteSingle"
              @toggle-select="toggleSelect"
            />
            <!-- 列表视图 -->
            <ResourceList
              v-else-if="viewMode === 'list' && displayItems.length > 0"
              :items="displayItems"
              :batch-mode="batchMode"
              :selected-keys="selectedKeys"
              @preview="onPreview"
              @open-location="onOpenLocation"
              @delete="onDeleteSingle"
              @toggle-select="toggleSelect"
            />
            <!-- 空状态：无任何资源 -->
            <div v-else-if="items.length === 0" class="empty-state">
              <el-empty description="暂无资源，先上传文件吧">
                <LucideIcon name="SearchX" :size="48" />
              </el-empty>
            </div>
            <!-- 空状态：筛选无结果 -->
            <div v-else class="empty-state">
              <el-empty description="无匹配结果">
                <el-button type="primary" plain @click="clearFilters">清除筛选</el-button>
              </el-empty>
            </div>
          </div>
        </div>

        <!-- 预览弹窗 -->
        <ResourcePreviewDialog
          :visible="preview.visible.value"
          :current-item="preview.currentItem.value"
          :preview-type="preview.previewType.value"
          :text-content="preview.textContent.value"
          :text-truncated="preview.textTruncated.value"
          :text-loading="preview.textLoading.value"
          :zoom="preview.imageZoom.value"
          :rotate="preview.imageRotate.value"
          :nav-index="preview.navIndex.value"
          :nav-total="preview.navListLength.value"
          @close="preview.close()"
          @prev="preview.prev()"
          @next="preview.next()"
          @zoom-in="preview.zoomIn()"
          @zoom-out="preview.zoomOut()"
          @rotate="preview.rotate()"
          @open-location="onOpenLocation"
        />

        <!-- 删除确认弹窗（含「同时删除物理文件」勾选项） -->
        <el-dialog v-model="deleteDialogVisible" title="删除确认" width="420px">
          <div class="delete-confirm">
            <div class="delete-text">
              <template v-if="pendingDeleteItems.length === 1">
                确定要删除文件「{{ pendingDeleteItems[0]?.name }}」吗？
              </template>
              <template v-else>确定要删除选中的 {{ pendingDeleteItems.length }} 个文件吗？</template>
            </div>
            <el-checkbox v-model="deletePhysicalChecked">同时删除磁盘上的物理文件</el-checkbox>
            <div class="delete-tip">未勾选时仅删除资源记录，物理文件仍保留在磁盘上。</div>
          </div>
          <template #footer>
            <el-button @click="deleteDialogVisible = false">取消</el-button>
            <el-button type="danger" :loading="deleting" @click="confirmDelete">删除</el-button>
          </template>
        </el-dialog>
      </div>
    </template>
  </layout-vue>
</template>

<script setup lang="ts">
/**
 * 资源管理页面（重构版）
 * ------------------------------------------------------------------
 * 架构：index.vue 仅做组件编排与事件转发，业务逻辑下沉到
 * composables（useResourceList / useResourcePreview）与 api（resourceApi）。
 * 数据存储：SQLite resource 表（首次启动自动迁移旧 imageResource 数据）。
 */
import { onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';
import LayoutVue from '@/components/layout.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import ResourceToolbar from './components/ResourceToolbar.vue';
import ResourceStatsBar from './components/ResourceStatsBar.vue';
import ResourceUploadCard from './components/ResourceUploadCard.vue';
import ResourceGrid from './components/ResourceGrid.vue';
import ResourceList from './components/ResourceList.vue';
import ResourcePreviewDialog from './components/ResourcePreviewDialog.vue';
import { useResourceList } from './composables/useResourceList';
import { useResourcePreview } from './composables/useResourcePreview';
import type { ResourceItem } from './types';
import { send } from '@/utils/common';
import useCacheSetStore from '@/store/useCacheSet';

// ------------------------------------------------------------------
// 状态接入
// ------------------------------------------------------------------

const {
  items,
  loading,
  keyword,
  filterTypes,
  sortBy,
  order,
  viewMode,
  batchMode,
  selectedKeys,
  displayItems,
  stats,
  load,
  removeItems,
  handleFileSaved,
  starItem,
  toggleSelect,
  selectAll,
  clearSelection,
} = useResourceList();

const preview = useResourcePreview();

/** 文件缓存目录（物理文件删除白名单） */
const { fileCachePathC } = storeToRefs(useCacheSetStore());

// ------------------------------------------------------------------
// 生命周期
// ------------------------------------------------------------------

onMounted(() => {
  load();
});

// ------------------------------------------------------------------
// 上传与去重
// ------------------------------------------------------------------

/**
 * 单文件上传完成：去重入库（重复文件已在 composable 内清理物理文件）
 *
 * @param {Object} payload - 上传结果（path/name/size）
 * @returns {void} 无返回值
 */
async function onFileSaved(payload: { path: string; name: string; size: number }) {
  const result = await handleFileSaved(payload, fileCachePathC.value || '');
  if (result === 'duplicate') {
    ElMessage.info(`「${payload.name}」已存在同名同大小文件，已跳过`);
  }
}

// ------------------------------------------------------------------
// 卡片 / 行操作
// ------------------------------------------------------------------

/**
 * 打开预览（基于当前展示列表做上一个/下一个导航）
 *
 * @param {ResourceItem} item - 待预览资源
 * @returns {void} 无返回值
 */
function onPreview(item: ResourceItem) {
  preview.open(item, displayItems.value);
}

/**
 * 在系统资源管理器中打开文件位置
 *
 * @param {ResourceItem} item - 目标资源
 * @returns {void} 无返回值
 */
function onOpenLocation(item: ResourceItem) {
  if (!item?.path) return;
  send('open-file-in-assets-manager', { path: item.path });
}

/**
 * 切换收藏状态
 *
 * @param {ResourceItem} item - 目标资源
 * @returns {void} 无返回值
 */
function onStar(item: ResourceItem) {
  starItem(item);
}

// ------------------------------------------------------------------
// 删除流程（单个 / 批量，含「同时删除物理文件」选项）
// ------------------------------------------------------------------

/** 删除确认弹窗可见性 */
const deleteDialogVisible = ref(false);
/** 待删除资源（单个或批量） */
const pendingDeleteItems = ref<ResourceItem[]>([]);
/** 是否同时删除物理文件（勾选项，默认不勾选） */
const deletePhysicalChecked = ref(false);
/** 删除执行中 */
const deleting = ref(false);

/**
 * 发起单个资源删除（打开确认弹窗）
 *
 * @param {ResourceItem} item - 目标资源
 * @returns {void} 无返回值
 */
function onDeleteSingle(item: ResourceItem) {
  pendingDeleteItems.value = [item];
  deletePhysicalChecked.value = false;
  deleteDialogVisible.value = true;
}

/**
 * 发起批量删除（打开确认弹窗）
 *
 * @returns {void} 无返回值
 */
function onBatchDelete() {
  if (selectedKeys.value.size === 0) return;
  const keySet = selectedKeys.value;
  pendingDeleteItems.value = displayItems.value.filter((it) => keySet.has(it.key));
  deletePhysicalChecked.value = false;
  deleteDialogVisible.value = true;
}

/**
 * 确认删除：删记录（+ 可选删物理文件），失败时提示
 *
 * @returns {Promise<void>} 无返回值
 */
async function confirmDelete() {
  deleting.value = true;
  try {
    const keys = pendingDeleteItems.value.map((it) => it.key);
    const { removed, physicalFailed } = await removeItems(
      keys,
      deletePhysicalChecked.value,
      fileCachePathC.value || '',
    );
    if (physicalFailed > 0) {
      ElMessage.warning(`已删除 ${removed} 条记录，其中 ${physicalFailed} 个物理文件删除失败`);
    } else {
      ElMessage.success(`已删除 ${removed} 个资源`);
    }
    // 预览中的文件被删除时关闭预览
    if (preview.currentItem.value && keys.includes(preview.currentItem.value.key)) {
      preview.close();
    }
  } finally {
    deleting.value = false;
    deleteDialogVisible.value = false;
    pendingDeleteItems.value = [];
    batchMode.value = false;
  }
}

/**
 * 清除搜索与类型筛选
 *
 * @returns {void} 无返回值
 */
function clearFilters() {
  keyword.value = '';
  filterTypes.value = [];
}
</script>

<style scoped lang="scss">
:deep(.main) {
  padding: 0 !important;
}

.resource-page {
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;

  .section {
    margin-bottom: 28px;

    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 14px;
      padding-bottom: 10px;
      background: linear-gradient(90deg, var(--color-primary), transparent) no-repeat left bottom / 100% 1px;

      .el-icon {
        color: var(--color-primary);
      }
    }
  }

  .file-area {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 16px;
    min-height: 160px;
  }

  .empty-state {
    padding: 24px 0;
  }

  .delete-confirm {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .delete-text {
      font-size: 0.88rem;
      color: var(--text-primary);
      word-break: break-all;
    }

    .delete-tip {
      font-size: 0.76rem;
      color: var(--text-muted);
    }
  }
}
</style>
