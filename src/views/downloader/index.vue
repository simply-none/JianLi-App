<template>
  <div class="downloader-page">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button type="primary" @click="showNewTask = true">
          <LucideIcon name="Plus" :size="15" style="margin-right: 4px" />
          新建下载
        </el-button>
        <el-input
          v-model="keyword"
          placeholder="搜索文件名 / 链接"
          clearable
          class="search-input"
        >
          <template #prefix>
            <LucideIcon name="Search" :size="14" />
          </template>
        </el-input>
      </div>
      <div class="toolbar-right">
        <span class="total-speed" title="当前总速度">
          <LucideIcon name="Gauge" :size="14" />
          {{ formatSpeed(totalSpeed) }}
        </span>
        <button class="tool-btn" title="下载设置" @click="showSettings = true">
          <LucideIcon name="Settings" :size="16" />
        </button>
      </div>
    </div>

    <!-- 主体：分类侧栏 + 任务列表 -->
    <div class="main-area">
      <CategorySide v-model="activeCategory" :tasks="tasks" />
      <div class="task-list">
        <template v-if="filteredTasks.length > 0">
          <TaskItem v-for="task in filteredTasks" :key="task.id" :task="task" />
        </template>
        <div v-else class="empty-tip">
          <LucideIcon name="Download" :size="40" />
          <p>暂无下载任务</p>
          <p class="empty-sub">粘贴直链新建下载，或在浏览器下载文件时自动接管</p>
        </div>
      </div>
    </div>

    <!-- 新建下载弹窗 -->
    <NewTaskDialog ref="newTaskDialogRef" v-model="showNewTask" />
    <!-- 下载设置弹窗 -->
    <DownloaderSettings v-model="showSettings" />
  </div>
</template>

<script setup lang="ts">
/**
 * 系统级下载器主页面（类 IDM）
 * 布局：顶部工具栏（新建/搜索/总速度/设置） + 左侧分类 + 右侧任务列表。
 * 数据由主进程 download:updated 推送驱动（useDownloader 单例订阅）；
 * 剪贴板监视命中下载直链时自动弹出新建任务窗（可由设置关闭）。
 */
import { ref, computed, onMounted, onUnmounted } from "vue";
import LucideIcon from "@/components/LucideIcon.vue";
import { useDownloader } from "./composables/useDownloader";
import { formatSpeed } from "./utils/format";
import CategorySide from "./components/CategorySide.vue";
import TaskItem from "./components/TaskItem.vue";
import NewTaskDialog from "./components/NewTaskDialog.vue";
import DownloaderSettings from "./components/DownloaderSettings.vue";

const {
  tasks,
  totalSpeed,
  onClipboardDetected,
} = useDownloader();

/** 当前分类（'all' 或分类 key） */
const activeCategory = ref("all");
/** 搜索关键词 */
const keyword = ref("");
/** 新建任务弹窗 */
const showNewTask = ref(false);
/** 设置弹窗 */
const showSettings = ref(false);
/** 新建弹窗组件引用（用于剪贴板预填） */
const newTaskDialogRef = ref<InstanceType<typeof NewTaskDialog> | null>(null);

/** 按分类 + 关键词过滤后的任务列表 */
const filteredTasks = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return tasks.value.filter((t) => {
    if (activeCategory.value !== "all" && t.category !== activeCategory.value) return false;
    if (kw && !t.filename.toLowerCase().includes(kw) && !t.url.toLowerCase().includes(kw)) return false;
    return true;
  });
});

/** 剪贴板回调取消函数 */
let offClipboard: (() => void) | null = null;

onMounted(() => {
  // 剪贴板发现直链：预填并弹出新建窗
  offClipboard = onClipboardDetected((url) => {
    newTaskDialogRef.value?.setPrefill(url);
    showNewTask.value = true;
  });
});

onUnmounted(() => {
  offClipboard?.();
  offClipboard = null;
});
</script>

<style scoped lang="scss">
.downloader-page {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  overflow: hidden;
}

/* ========== 工具栏 ========== */
.toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .search-input { width: 220px; }
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 10px;

    .total-speed {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--color-primary-solid);
    }

    .tool-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      padding: 0;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-btn);
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
        border-color: var(--color-primary);
      }
    }
  }
}

/* ========== 主体 ========== */
.main-area {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
}

.task-list {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding: 2px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 2px;
  }
}

.empty-tip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 0.9rem;

  .empty-sub { font-size: 0.78rem; opacity: 0.7; }
}
</style>
