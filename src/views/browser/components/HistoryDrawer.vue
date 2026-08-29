<template>
  <!-- 浏览历史抽屉：搜索 + 按日期分组列表 + 单条删除/清空 -->
  <el-drawer
    v-model="visible"
    title="历史记录"
    direction="rtl"
    size="380px"
    :append-to-body="true"
  >
    <div class="history-panel">
      <!-- 搜索 -->
      <el-input v-model="keyword" placeholder="搜索历史记录..." clearable @input="onSearch">
        <template #prefix>
          <LucideIcon name="Search" :size="14" />
        </template>
      </el-input>

      <!-- 分组列表 -->
      <div class="history-list">
        <template v-if="groups.length > 0">
          <div v-for="group in groups" :key="group.label" class="history-group">
            <div class="group-label">{{ group.label }}</div>
            <div
              v-for="item in group.items"
              :key="item.key"
              class="history-item"
              :title="item.key"
              @click="onOpen(item.key)"
            >
              <span class="item-icon">
                <LucideIcon name="Earth" :size="14" />
              </span>
              <span class="item-body">
                <span class="item-title">{{ item.title || item.key }}</span>
                <span class="item-sub">{{ item.key }}</span>
              </span>
              <span class="item-time">{{ shortTime(item.last_visit_time) }}</span>
              <span class="item-delete" title="删除此记录" @click.stop="onDelete(item.key)">
                <LucideIcon name="Trash2" :size="13" />
              </span>
            </div>
          </div>
        </template>
        <div v-else class="history-empty">
          <LucideIcon name="History" :size="36" color="var(--text-muted)" />
          <p>暂无历史记录</p>
        </div>
      </div>

      <!-- 底部清空 -->
      <div v-if="groups.length > 0" class="history-footer">
        <el-button size="small" type="danger" plain @click="onClearAll">
          <LucideIcon name="Trash2" :size="13" />
          <span style="margin-left: 4px">清空全部历史</span>
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - 历史记录抽屉
 * 职责：从 SQLite 拉取/搜索/删除/清空浏览历史，按「今天/昨天/更早」分组展示，
 * 点击条目在新标签页打开。
 */
import { computed, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import LucideIcon from "@/components/LucideIcon.vue";
import { fetchHistory, deleteHistory, clearHistory, type HistoryRecord } from "../api/browserApi";
import useBrowser from "@/store/useBrowser";

/** 抽屉显隐（v-model:visible） */
const visible = defineModel<boolean>("visible", { default: false });

const emit = defineEmits<{
  /** 请求打开某地址（父级负责创建新标签） */
  (e: "open-url", url: string): void;
}>();

const browserStore = useBrowser();

/** 搜索关键词 */
const keyword = ref("");
/** 历史记录列表 */
const records = ref<HistoryRecord[]>([]);

/** 刷新列表（可带关键词搜索） */
async function refresh() {
  records.value = await fetchHistory(200, keyword.value);
}

/** 防抖搜索 */
let timer: ReturnType<typeof setTimeout> | null = null;
function onSearch() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(refresh, 200);
}

/** 抽屉打开时拉取 */
watch(visible, (v) => {
  if (v) refresh();
});

/**
 * 日期分组：今天 / 昨天 / 更早（按 last_visit_time 前 10 位日期聚类）
 */
const groups = computed(() => {
  const today = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayStr = fmt(today);
  const yesterday = new Date(today.getTime() - 86400000);
  const yesterdayStr = fmt(yesterday);

  const map = new Map<string, HistoryRecord[]>();
  records.value.forEach((r) => {
    const day = (r.last_visit_time || "").slice(0, 10);
    const label = day === todayStr ? "今天" : day === yesterdayStr ? "昨天" : day || "更早";
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(r);
  });
  return [...map.entries()].map(([label, items]) => ({ label, items }));
});

/**
 * 时间转短格式（今日条目只显示时分）
 * @param time 必填，YYYY-MM-DD HH:mm:ss
 */
function shortTime(time: string): string {
  const today = new Date();
  const day = (time || "").slice(0, 10);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return day === todayStr ? (time || "").slice(11, 16) : day;
}

/**
 * 在新标签页打开
 * @param url 必填，地址
 */
function onOpen(url: string) {
  browserStore.createTab(url, "历史打开");
  emit("open-url", url);
}

/**
 * 删除单条
 * @param url 必填，地址
 */
async function onDelete(url: string) {
  await deleteHistory(url);
  await refresh();
}

/** 清空全部（二次确认） */
async function onClearAll() {
  try {
    await ElMessageBox.confirm("确定清空全部浏览历史吗？", "提示", {
      confirmButtonText: "清空",
      cancelButtonText: "取消",
      type: "warning",
    });
    await clearHistory();
    await refresh();
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="scss">
.history-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.history-group {
  margin-bottom: 8px;

  .group-label {
    font-size: 12px;
    color: var(--text-muted);
    padding: 6px 4px 4px;
  }
}

.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--bg-hover);

    .item-delete {
      opacity: 1;
    }
  }

  .item-icon {
    display: flex;
    align-items: center;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .item-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .item-title {
      font-size: 13px;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-sub {
      font-size: 12px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .item-time {
    font-size: 11px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .item-delete {
    display: flex;
    align-items: center;
    color: var(--text-muted);
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;

    &:hover {
      color: var(--color-danger, #f56c6c);
    }
  }
}

.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 60px 0;
  color: var(--text-muted);

  p {
    font-size: 13px;
    margin: 0;
  }
}

.history-footer {
  border-top: 1px solid var(--border-subtle);
  padding-top: 10px;
  display: flex;
  justify-content: center;
}
</style>
