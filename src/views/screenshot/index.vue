<template>
  <div class="screenshot-page">
    <!-- 顶部标题与操作 -->
    <div class="page-header">
        <div class="header-text">
          <h2>截图工具</h2>
          <p>Snipaste 风格：拖拽框选区域，单击空白处即截取全屏；选区里可加 箭头 / 文字 / 马赛克；应用本身可见可截</p>
        </div>
      <div class="header-options">
        <div class="shortcut-box">
          <template v-if="!listening">
            <el-tag
              v-if="shortcut"
              size="small"
              effect="plain"
              class="shortcut-tag"
              title="点击重新录制"
              @click="openListen"
            >
              <LucideIcon name="Keyboard" :size="13" />
              <span class="shortcut-label">{{ displayAccel(shortcut) }}</span>
              <span class="shortcut-clear" title="清除快捷键" @click.stop="clearShortcut">×</span>
            </el-tag>
            <el-button v-else size="small" @click="openListen">
              <LucideIcon name="Keyboard" :size="13" />
              设置快捷键
            </el-button>
          </template>
          <template v-else>
            <el-tag size="small" type="warning" effect="plain" class="shortcut-tag listening">
              <LucideIcon name="Keyboard" :size="13" />
              {{ pendingAccel ? displayAccel(pendingAccel) : '请按下快捷键组合…' }}
            </el-tag>
            <template v-if="pendingAccel">
              <el-button size="small" type="primary" @click="confirmShortcut">保存</el-button>
              <el-button size="small" @click="openListen">重录</el-button>
            </template>
            <el-button v-else size="small" @click="closeListen">取消</el-button>
          </template>
        </div>
        <div class="sticker-menu">
          <el-badge :value="stickerOpenCount" :hidden="stickerOpenCount === 0" type="warning">
            <el-button @click.stop="toggleStickerPanel">
              <LucideIcon name="Layers" :size="15" />
              钉屏
            </el-button>
          </el-badge>
          <div v-if="stickerPanelOpen" class="sticker-dropdown" @click.stop>
            <div class="sticker-dropdown-head">
              <span>最近 5 个钉屏</span>
              <button class="link-btn" @click="closeAllStickers">全部关闭</button>
            </div>
            <div class="sticker-restore">
              <span class="sticker-restore-label">重启恢复</span>
              <el-select
                v-model="restoreLimit"
                size="small"
                class="sticker-restore-select"
                @change="onRestoreLimitChange"
              >
                <el-option label="不恢复" :value="0" />
                <el-option v-for="n in 20" :key="n" :label="n + ' 个'" :value="n" />
              </el-select>
            </div>
            <div v-if="!stickerRecent.length" class="sticker-empty">暂无钉屏记录</div>
            <div v-for="item in stickerRecent" :key="item.id" class="sticker-row">
              <img :src="stickerThumb(item)" class="sticker-mini" draggable="false" @error="onThumbError" />
              <div class="sticker-info">
                <div class="history-time sticker-time">{{ item.created_at }}</div>
                <span :class="['sticker-state', isStickerOpen(item.id) ? 'on' : 'off']">
                  {{ isStickerOpen(item.id) ? '展示中' : '已关闭' }}
                </span>
              </div>
              <el-button
                v-if="isStickerOpen(item.id)"
                size="small"
                type="danger"
                plain
                @click="closeSticker(item)"
              >关闭</el-button>
              <el-button v-else size="small" type="primary" plain @click="showSticker(item)">展示</el-button>
            </div>
          </div>
        </div>
        <el-button type="primary" :loading="capturing" @click="startCapture">
          <LucideIcon name="Webcam" :size="15" />
          截图
        </el-button>
      </div>
    </div>

    <div class="page-body">
      <!-- 左侧：截图历史（虚拟列表，触底加载） -->
      <section class="history-panel">
        <div class="panel-title">
          <LucideIcon name="History" :size="15" />
          <span>截图记录</span>
        </div>
        <!-- 按 action 分类筛选 -->
        <div class="history-filter">
          <button
            v-for="f in filterOptions"
            :key="f.value"
            :class="['filter-tab', { active: historyFilter === f.value }]"
            @click="setFilter(f.value)"
          >
            {{ f.label }}
            <span class="filter-count">{{ f.count }}</span>
          </button>
        </div>
        <div class="history-scroll" ref="viewportRef" @scroll="onHistoryScroll">
          <div class="history-spacer" :style="{ height: historyTotalH + 'px' }">
            <div
              v-for="v in visibleHistory"
              :key="(v.item.id ?? 'n') + '-' + v.index"
              class="history-item"
              :style="{
                transform: `translateY(${v.index * ITEM_HEIGHT}px)`,
                height: ITEM_HEIGHT + 'px',
              }"
            >
              <img
                :src="fileUrl(v.item.path)"
                class="history-thumb"
                draggable="false"
                @error="onThumbError"
              />
              <div class="history-meta">
                <div class="history-time">{{ v.item.created_at || '—' }}</div>
                <div class="history-sub">
                  <el-tag
                    size="small"
                    :type="v.item.action === 'copy' ? 'info' : v.item.action === 'sticker' ? 'warning' : 'success'"
                    effect="plain"
                  >
                    {{ v.item.action === 'copy' ? '复制' : v.item.action === 'sticker' ? '贴图' : '保存' }}
                  </el-tag>
                  <span class="history-size" v-if="v.item.width">
                    {{ v.item.width }}×{{ v.item.height }}
                  </span>
                </div>
              </div>
              <div class="history-ops">
                <el-button size="small" @click="openHistory(v.item)">打开</el-button>
                <el-button size="small" type="danger" plain @click="deleteHistory(v.item)">删除</el-button>
              </div>
            </div>
          </div>
          <div v-if="historyLoading" class="history-tip">加载中…</div>
          <div v-else-if="!historyHasMore && historyList.length" class="history-tip">没有更多了</div>
          <div v-if="!historyList.length && !historyLoading" class="history-tip history-empty">
            <LucideIcon name="ImageOff" :size="28" />
            <p>暂无截图记录</p>
          </div>
        </div>
      </section>

      <!-- 中间：结果与操作 -->
      <section class="result-panel">
        <div class="panel-title">
          <LucideIcon name="Image" :size="15" />
          <span>截图结果</span>
          <span v-if="imgWidth" class="dim-badge">{{ imgWidth }} × {{ imgHeight }}</span>
        </div>

        <div class="result-stage">
          <div v-if="!preview" class="result-empty">
            <LucideIcon name="Crop" :size="40" />
            <p v-if="shortcut">点击右上角「截图」按钮，或按 {{ displayAccel(shortcut) }} 即可开始</p>
            <p v-else>点击右上角「截图」即可开始（可在右上角「设置快捷键」配置全局唤起）</p>
            <p class="tip">提示：应用保持可见可截到本身 · 框选 / 全屏后直接在选区内加 箭头 / 文字 / 马赛克</p>
          </div>
          <img v-else :src="preview" class="result-img" alt="screenshot" draggable="false" />
        </div>

        <div class="action-bar" v-if="preview">
          <el-button type="primary" @click="copyImage" :disabled="copying">
            <LucideIcon name="ClipboardCopy" :size="14" />
            复制到剪贴板
          </el-button>
          <el-button @click="saveImage" :disabled="saving">
            <LucideIcon name="Download" :size="14" />
            保存到文件
          </el-button>
          <el-button @click="startCapture" :disabled="capturing">
            <LucideIcon name="RefreshCw" :size="14" />
            重新截图
          </el-button>
        </div>
      </section>

      <!-- 右侧：显示器与窗口截图 -->
      <aside class="display-panel">
        <div class="panel-title">
          <LucideIcon name="MonitorDot" :size="15" />
          <span>显示器与窗口</span>
          <el-button
            size="small"
            :loading="sourcesLoading"
            class="refresh-btn"
            @click="loadSources"
          >
            <LucideIcon name="RefreshCw" :size="13" />
            刷新
          </el-button>
        </div>
        <el-scrollbar class="display-scroll">
          <!-- 所有屏幕 / 打开应用的截图 -->
          <div v-if="sourcesLoading" class="source-tip">正在捕获截图…</div>
          <div v-else-if="!sources.length" class="source-tip source-empty">
            <LucideIcon name="ImageOff" :size="26" />
            <p>点击右上角「刷新」获取屏幕与应用截图</p>
          </div>
          <div
            v-for="s in sources"
            :key="s.id"
            class="source-card"
          >
            <div class="source-head">
              <el-tag
                size="small"
                :type="s.type === 'screen' ? 'primary' : 'info'"
                effect="plain"
              >
                {{ s.type === 'screen' ? '屏幕' : '窗口' }}
              </el-tag>
              <span class="source-name" :title="s.name">{{ s.name }}</span>
            </div>
            <img
              :src="s.dataUrl"
              class="source-thumb"
              draggable="false"
              @error="onSourceError"
            />
            <div class="source-ops">
              <el-button size="small" type="primary" @click="persistSource(s, 'copy')">
                <LucideIcon name="ClipboardCopy" :size="13" />
                复制
              </el-button>
              <el-button size="small" @click="persistSource(s, 'save')">
                <LucideIcon name="Download" :size="13" />
                保存
              </el-button>
            </div>
          </div>

          <!-- 显示器静态信息（保留） -->
          <div class="display-static-title">
            <LucideIcon name="Monitor" :size="13" />
            显示器信息（{{ displays.length }}）
          </div>
          <div
            v-for="d in displays"
            :key="d.id"
            class="display-card"
            :class="{ primary: d.isPrimary }"
          >
            <div class="display-head">
              <span class="display-label">{{ d.label }}</span>
              <el-tag v-if="d.isPrimary" size="small" type="primary" effect="dark">主屏</el-tag>
            </div>
            <div class="display-info">
              <span>分辨率 {{ d.bounds.width }}×{{ d.bounds.height }}</span>
              <span>缩放 {{ d.scaleFactor }}×</span>
              <span>工作区 {{ d.workAreaSize.width }}×{{ d.workAreaSize.height }}</span>
            </div>
          </div>
        </el-scrollbar>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { ElMessage } from "element-plus";
import LucideIcon from "@/components/LucideIcon.vue";

interface DisplayInfo {
  id: number;
  label: string;
  isPrimary: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  workAreaSize: { width: number; height: number };
  scaleFactor: number;
}

const displays = ref<DisplayInfo[]>([]);
const sources = ref<
  { id: string; name: string; type: "screen" | "window"; dataUrl: string; width: number; height: number }[]
>([]);
const sourcesLoading = ref(false);
const preview = ref<string>("");
const imgWidth = ref(0);
const imgHeight = ref(0);

const capturing = ref(false);
const saving = ref(false);
const copying = ref(false);

// 全局快捷键（用户自行配置，初装无默认值）
const shortcut = ref<string | null>(null);
const listening = ref(false);
const pendingAccel = ref<string | null>(null);

// 钉屏（浮动窗口）管理：右上角按钮 + 下拉面板
const stickerPanelOpen = ref(false);
const stickerRecent = ref<any[]>([]);
const stickerOpenIds = ref<number[]>([]);
const stickerOpenCount = computed(() => stickerOpenIds.value.length);
// 重启后自动恢复的钉屏数量上限（持久化在 settings 表，默认 1，范围 1~20）
const restoreLimit = ref(1);

/* ----------------------------- 截图历史（左侧栏） ----------------------------- */
const ITEM_HEIGHT = 96; // 每条记录固定高度（含间隔）
const HISTORY_PAGE = 20; // 每页条数
const historyList = ref<any[]>([]);
const historyLoading = ref(false);
const historyHasMore = ref(true);
const historyOffset = ref(0);
const historyScrollTop = ref(0);
const historyViewportH = ref(0);
const viewportRef = ref<HTMLElement | null>(null);
// 按 action 分类筛选："" = 全部；copy / save / sticker
const historyFilter = ref<string>("");
const historyCounts = ref<Record<string, number>>({});

const startIdx = computed(() =>
  Math.max(0, Math.floor(historyScrollTop.value / ITEM_HEIGHT) - 3)
);
const endIdx = computed(() =>
  Math.min(
    historyList.value.length,
    Math.ceil((historyScrollTop.value + historyViewportH.value) / ITEM_HEIGHT) + 3
  )
);
const visibleHistory = computed(() =>
  historyList.value
    .slice(startIdx.value, endIdx.value)
    .map((item, i) => ({ item, index: startIdx.value + i }))
);
const historyTotalH = computed(() => historyList.value.length * ITEM_HEIGHT);

/** 各分类筛选项（含数量），用于顶部「按 action 分类展示」 */
const filterOptions = computed(() => {
  const c = historyCounts.value || {};
  const total = (c.copy || 0) + (c.save || 0) + (c.sticker || 0);
  return [
    { value: "", label: "全部", count: total },
    { value: "copy", label: "复制", count: c.copy || 0 },
    { value: "save", label: "保存", count: c.save || 0 },
    { value: "sticker", label: "贴图", count: c.sticker || 0 },
  ];
});

/** 切换分类筛选 */
function setFilter(v: string) {
  if (historyFilter.value === v) return;
  historyFilter.value = v;
  loadHistory(true);
}

/** 统计各 action 的记录数（顶部 tab 角标用） */
function loadCounts() {
  window.ipcRenderer
    .handlePromise("new-sql:query", {
      tableName: "screenshots",
      SqlStr: "SELECT action, COUNT(*) as c FROM screenshots GROUP BY action",
    })
    .then((res: any) => {
      const map: Record<string, number> = {};
      (res?.data || []).forEach((r: any) => {
        map[r.action] = r.c;
      });
      historyCounts.value = map;
    })
    .catch(() => {});
}

/* ----------------------------- 钉屏（浮动钉屏窗口）管理 ----------------------------- */
/** 读取最近 5 条钉屏记录（DB 中 action='sticker'） */
function loadStickerRecent() {
  window.ipcRenderer
    .handlePromise("new-sql:query", {
      tableName: "screenshots",
      conditions: { action: "sticker" },
      columns: ["id", "path", "created_at", "width", "height"],
      orderBy: "created_at",
      orderByDesc: true,
      limit: 5,
    })
    .then((res: any) => {
      stickerRecent.value = res?.success ? res.data || [] : [];
    })
    .catch(() => {});
}

/** 读取当前已打开的钉屏浮动窗口对应的记录 id */
function loadStickerOpen() {
  window.ipcRenderer
    .handlePromise("sticker:list", {})
    .then((res: any) => {
      stickerOpenIds.value = res?.success ? res.data || [] : [];
    })
    .catch(() => {});
}

function toggleStickerPanel() {
  stickerPanelOpen.value = !stickerPanelOpen.value;
  if (stickerPanelOpen.value) {
    loadStickerRecent();
    loadStickerOpen();
    loadRestoreLimit();
  }
}

/** 读取「重启恢复钉屏数量」偏好（默认 1，限制 0~20，0 = 不恢复） */
function loadRestoreLimit() {
  window.ipcRenderer
    .handlePromise("new-sql:query", {
      tableName: "settings",
      conditions: { name: "sticker_restore_limit" },
    })
    .then((res: any) => {
      const rows = res?.success ? res.data || [] : [];
      if (rows.length) {
        const n = parseInt(rows[0].value, 10);
        if (!isNaN(n)) restoreLimit.value = Math.min(20, Math.max(0, n));
      }
    })
    .catch(() => {});
}

/** 修改重启恢复数量：写入 settings 表（key-value），先查后改/插，避免重复行 */
function onRestoreLimitChange(v: number) {
  // 0 合法：表示「不恢复」。注意不能用 Number(v) || 1，否则 0 会被误转为 1
  const n = Math.min(20, Math.max(0, Number(v) || 0));
  restoreLimit.value = n;
  window.ipcRenderer
    .handlePromise("new-sql:query", {
      tableName: "settings",
      conditions: { name: "sticker_restore_limit" },
    })
    .then((res: any) => {
      const rows = res?.success ? res.data || [] : [];
      const payload = { tableName: "settings", data: { name: "sticker_restore_limit", value: String(n) } };
      if (rows.length) {
        return window.ipcRenderer.handlePromise("new-sql:update", {
          tableName: "settings",
          data: { value: String(n) },
          condition: { name: "sticker_restore_limit" },
        });
      }
      return window.ipcRenderer.handlePromise("new-sql:insert", payload);
    })
    .catch(() => {});
}

function isStickerOpen(id: number) {
  return stickerOpenIds.value.includes(id);
}

function showSticker(item: any) {
  window.ipcRenderer
    .handlePromise("sticker:open", { recordId: item.id })
    .then(() => loadStickerOpen())
    .catch(() => {});
}

function closeSticker(item: any) {
  window.ipcRenderer
    .handlePromise("sticker:close-by-id", { recordId: item.id })
    .then(() => loadStickerOpen())
    .catch(() => {});
}

function closeAllStickers() {
  window.ipcRenderer
    .handlePromise("sticker:close-all", {})
    .then(() => {
      loadStickerOpen();
      loadStickerRecent();
    })
    .catch(() => {});
}

function stickerThumb(item: any) {
  return fileUrl(item.path);
}

/** 点击面板外部时收起下拉 */
function onDocClick(e: MouseEvent) {
  if (!stickerPanelOpen.value) return;
  const t = e.target as HTMLElement;
  if (t && t.closest && t.closest(".sticker-menu")) return;
  stickerPanelOpen.value = false;
}

/** 分页读取 screenshots 表（created_at 倒序；按 action 分类筛选） */
function loadHistory(reset = false) {
  if (historyLoading.value) return;
  if (reset) {
    historyList.value = [];
    historyOffset.value = 0;
    historyHasMore.value = true;
  }
  if (!historyHasMore.value) return;
  historyLoading.value = true;
  const conditions = historyFilter.value ? { action: historyFilter.value } : undefined;
  window.ipcRenderer
    .handlePromise("new-sql:query", {
      tableName: "screenshots",
      conditions,
      orderBy: "created_at",
      orderByDesc: true,
      limit: HISTORY_PAGE,
      offset: historyOffset.value,
    })
    .then((res: any) => {
      const rows: any[] = res?.success ? res.data || [] : [];
      historyList.value.push(...rows);
      historyOffset.value += rows.length;
      if (rows.length < HISTORY_PAGE) historyHasMore.value = false;
    })
    .catch(() => {})
    .finally(() => (historyLoading.value = false));
}

function onHistoryScroll(e: Event) {
  const el = e.target as HTMLElement;
  historyScrollTop.value = el.scrollTop;
  historyViewportH.value = el.clientHeight;
  if (
    historyHasMore.value &&
    !historyLoading.value &&
    el.scrollTop + el.clientHeight >= historyTotalH.value - ITEM_HEIGHT * 2
  ) {
    loadHistory();
  }
}

/** 把磁盘绝对路径转成渲染进程可加载的 file:// URL */
function fileUrl(p?: string): string {
  if (!p) return "";
  const fp = p.replace(/\\/g, "/");
  return "file:///" + encodeURI(fp);
}

function onThumbError(e: Event) {
  (e.target as HTMLImageElement).style.visibility = "hidden";
}

function openHistory(item: any) {
  if (!item?.path) return;
  window.ipcRenderer
    .handlePromise("screenshot:open-path", { path: item.path })
    .then((res: any) => {
      if (!res?.success) ElMessage.error("打开失败：" + (res?.error || ""));
    })
    .catch((err: any) => ElMessage.error("打开异常：" + (err?.message || err)));
}

function deleteHistory(item: any) {
  window.ipcRenderer
    .handlePromise("screenshot:delete-screenshot", { id: item.id, path: item.path })
    .then((res: any) => {
      if (res?.success) {
        ElMessage.success("已删除");
        loadHistory(true);
        loadCounts();
      } else {
        ElMessage.error("删除失败：" + (res?.error || ""));
      }
    })
    .catch((err: any) => ElMessage.error("删除异常：" + (err?.message || err)));
}

function refreshHistoryViewport() {
  historyViewportH.value = viewportRef.value?.clientHeight || 0;
}

/* ----------------------------- 快捷键相关 ----------------------------- */
/** 把 Electron accelerator 翻译成中文 / Mac 符号显示 */
function displayAccel(accel: string | null): string {
  if (!accel) return "";
  const isMac = /Mac/i.test(navigator.platform || navigator.userAgent || "");
  return accel
    .split("+")
    .map((p) => {
      switch (p) {
        case "CommandOrControl":
          return isMac ? "⌘" : "Ctrl";
        case "Command":
          return "⌘";
        case "Control":
          return "Ctrl";
        case "Alt":
          return isMac ? "⌥" : "Alt";
        case "Shift":
          return isMac ? "⇧" : "Shift";
        case "Space":
          return "Space";
        default:
          return p;
      }
    })
    .join("+");
}

/** 把 KeyboardEvent 映射为 Electron accelerator 键名 */
function mapKey(key: string): string | null {
  const map: Record<string, string> = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    " ": "Space",
    Escape: "Esc",
    Enter: "Enter",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
  };
  if (map[key]) return map[key];
  if (key.length === 1) return key.toUpperCase();
  // 功能键 / 组合键名称（F1..F12 等）Electron 直接接受
  return /^[A-Za-z0-9]$/.test(key) ? key.toUpperCase() : key;
}

/** 从 keydown 事件构造快捷键字符串（必须含修饰键，且按下的不是纯修饰键） */
function accelFromEvent(e: KeyboardEvent): string | null {
  const isModifier = ["Control", "Alt", "Shift", "Meta"].includes(e.key);
  const hasMod = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
  if (!hasMod || isModifier) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("CommandOrControl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const k = mapKey(e.key);
  if (!k) return null;
  parts.push(k);
  return parts.join("+");
}

function onListenKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    closeListen();
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  const accel = accelFromEvent(e);
  if (accel) pendingAccel.value = accel;
}

function openListen() {
  listening.value = true;
  pendingAccel.value = null;
  window.addEventListener("keydown", onListenKeydown, true);
}

function closeListen() {
  listening.value = false;
  pendingAccel.value = null;
  window.removeEventListener("keydown", onListenKeydown, true);
}

function confirmShortcut() {
  if (!pendingAccel.value) return;
  window.ipcRenderer
    .handlePromise("screenshot:set-shortcut", { accel: pendingAccel.value })
    .then((res: any) => {
      if (res?.ok) {
        shortcut.value = pendingAccel.value;
        ElMessage.success("快捷键已设置为 " + displayAccel(pendingAccel.value));
        closeListen();
      } else {
        ElMessage.error("设置失败：" + (res?.error || "该组合无效或已被占用"));
      }
    })
    .catch((err: any) => ElMessage.error("设置异常：" + (err?.message || err)));
}

function clearShortcut() {
  window.ipcRenderer
    .handlePromise("screenshot:clear-shortcut", {})
    .then((res: any) => {
      if (res?.ok) {
        shortcut.value = null;
        ElMessage.success("已清除快捷键，需手动点击「截图」唤起");
      } else {
        ElMessage.error("清除失败：" + (res?.error || ""));
      }
    })
    .catch((err: any) => ElMessage.error("清除异常：" + (err?.message || err)));
}

function loadShortcut() {
  window.ipcRenderer
    .handlePromise("screenshot:get-shortcut", {})
    .then((res: any) => {
      shortcut.value = res?.accel || res?.stored || null;
    })
    .catch(() => {});
}

function loadDisplays() {
  window.ipcRenderer
    .handlePromise("screenshot:get-displays", {})
    .then((res: any) => {
      if (res?.success) displays.value = res.data || [];
    })
    .catch(() => {});
}

/** 捕获所有屏幕 + 打开的应用窗口缩略图（右侧面板） */
function loadSources() {
  if (sourcesLoading.value) return;
  sourcesLoading.value = true;
  window.ipcRenderer
    .handlePromise("screenshot:capture-sources", {})
    .then((res: any) => {
      if (res?.success) {
        sources.value = res.data || [];
      } else {
        ElMessage.error("捕获屏幕/窗口失败：" + (res?.error || "未知错误"));
      }
    })
    .catch((err: any) => ElMessage.error("捕获异常：" + (err?.message || err)))
    .finally(() => (sourcesLoading.value = false));
}

/** 直接把某张来源截图写入缓存目录 + 落库（无弹窗）；action=copy 同时复制到剪贴板 */
function persistSource(s: any, action: "copy" | "save") {
  window.ipcRenderer
    .handlePromise("screenshot:persist", { dataUrl: s.dataUrl, action })
    .then((res: any) => {
      if (res?.success) {
        ElMessage.success(
          action === "copy" ? "已复制到剪贴板并保存" : "已保存到截图记录"
        );
        // 刷新左侧历史（新记录已落库）
        loadHistory(true);
        loadCounts();
      } else {
        ElMessage.error("保存失败：" + (res?.error || "未知错误"));
      }
    })
    .catch((err: any) => ElMessage.error("保存异常：" + (err?.message || err)));
}

function onSourceError(e: Event) {
  (e.target as HTMLImageElement).style.visibility = "hidden";
}

function launchCapture() {
  capturing.value = true;
  window.ipcRenderer
    .handlePromise("screenshot:start", {})
    .then((res: any) => {
      if (!res?.success) {
        ElMessage.error("启动截图失败：" + (res?.error || "未知错误"));
        if (/permission|权限|screen recording/i.test(res?.error || "")) {
          ElMessage.warning("macOS 需在「系统设置 → 隐私与安全性 → 屏幕录制」中授权本应用");
        }
      }
      // 选框层独立完成选区 + 标注，结果通过 screenshot:result 事件回传
    })
    .catch((err: any) => {
      ElMessage.error("启动截图异常：" + (err?.message || err));
    })
    .finally(() => {
      capturing.value = false;
    });
}

function startCapture() {
  launchCapture();
}

// 主进程回传截图结果
function onScreenshotResult(_e: any, payload: any) {
  if (payload?.error) {
    ElMessage.error("截图处理失败：" + payload.error);
    return;
  }
  preview.value = payload?.dataUrl || "";
  imgWidth.value = payload?.width || 0;
  imgHeight.value = payload?.height || 0;
  if (payload?.action === "copy") {
    ElMessage.success("已截取并复制到剪贴板");
  } else if (payload?.action === "save") {
    ElMessage.success("已截取并保存到缓存目录");
  } else if (payload?.action === "sticker") {
    ElMessage.success("已贴图到桌面（浮动窗口）+ 已保存记录");
    loadStickerRecent();
    loadStickerOpen();
  } else {
    ElMessage.success("截图完成");
  }
  // 刷新左侧历史（新记录已落库）
  loadHistory(true);
  loadCounts();
}

function copyImage() {
  if (!preview.value) return;
  copying.value = true;
  window.ipcRenderer
    .handlePromise("screenshot:copy", { dataUrl: preview.value })
    .then((res: any) => {
      if (res?.success) ElMessage.success("已复制到剪贴板");
      else ElMessage.error("复制失败：" + (res?.error || "未知错误"));
    })
    .catch((err: any) => ElMessage.error("复制异常：" + (err?.message || err)))
    .finally(() => (copying.value = false));
}

function saveImage() {
  if (!preview.value) return;
  saving.value = true;
  window.ipcRenderer
    .handlePromise("screenshot:save", { dataUrl: preview.value })
    .then((res: any) => {
      if (res?.canceled) return;
      if (res?.success) ElMessage.success("已保存：" + res.filePath);
      else ElMessage.error("保存失败：" + (res?.error || "未知错误"));
    })
    .catch((err: any) => ElMessage.error("保存异常：" + (err?.message || err)))
    .finally(() => (saving.value = false));
}

onMounted(() => {
  loadDisplays();
  loadShortcut();
  loadHistory();
  loadCounts();
  loadStickerOpen(); // 刷新右上角「钉屏」角标数量
  loadRestoreLimit(); // 读取「重启恢复钉屏数量」偏好（默认 1）
  // 关闭这个，有点卡，让其手动加载
  // loadSources(); // 右侧面板：捕获所有屏幕 + 打开的应用窗口
  nextTick(refreshHistoryViewport);
  window.addEventListener("resize", refreshHistoryViewport);
  window.ipcRenderer.on("screenshot:result", onScreenshotResult);
  document.addEventListener("click", onDocClick);
});

onUnmounted(() => {
  window.ipcRenderer.off?.("screenshot:result", onScreenshotResult);
  window.removeEventListener("resize", refreshHistoryViewport);
  document.removeEventListener("click", onDocClick);
  closeListen();
});
</script>

<style scoped lang="scss">
.screenshot-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;

  .header-text {
    flex: 1 1 auto;
    min-width: 0;

    h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
    }
    p {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--text-muted);
    }
  }

  .header-options {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 0 0 auto;
    flex-wrap: wrap;
    justify-content: flex-end;

    .shortcut-box {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
      height: 32px;

      .shortcut-tag {
        height: 32px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-weight: 500;
        color: var(--text-secondary);
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
        flex-shrink: 0;

        :deep(.el-tag__content) {
          display: inline-flex;
        }

        &.listening {
          cursor: default;
        }

        .shortcut-label {
          margin: 0 2px;
          white-space: nowrap;
        }

        .shortcut-clear {
          margin-left: 2px;
          font-size: 14px;
          line-height: 1;
          opacity: 0.6;
          white-space: nowrap;
          flex-shrink: 0;

          &:hover {
            opacity: 1;
            color: var(--el-color-danger, #f56c6c);
          }
        }
      }
    }

    .el-button + .el-button {
      margin-left: 0 !important;
    }
  }
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 10px;

  .dim-badge {
    margin-left: auto;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    background: var(--bg-active-btn);
    padding: 2px 8px;
    border-radius: 10px;
  }
}

.page-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 260px 1fr 300px;
  gap: 16px;
}

.history-panel,
.result-panel,
.display-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 左侧历史：虚拟列表 */
.history-panel {
  /* 按 action 分类筛选 tab */
  .history-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;

    .filter-tab {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      font-size: 12px;
      line-height: 1.4;
      color: var(--text-secondary);
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      border-radius: 999px;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;

      &:hover {
        border-color: var(--color-primary);
      }

      &.active {
        color: #fff;
        background: var(--color-primary);
        border-color: var(--color-primary);
      }

      .filter-count {
        font-size: 11px;
        opacity: 0.75;
        padding: 0 5px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.08);

        .filter-tab.active & {
          background: rgba(255, 255, 255, 0.25);
        }
      }
    }
  }

  .history-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    position: relative;

    .history-spacer {
      position: relative;
      width: 100%;
    }

    .history-item {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 4px;
      box-sizing: border-box;

      .history-thumb {
        width: 72px;
        height: 72px;
        object-fit: cover;
        border-radius: 6px;
        background: var(--bg-base);
        border: 1px solid var(--border-subtle);
        flex-shrink: 0;
      }

      .history-meta {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;

        .history-time {
          font-size: 13px;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .history-sub {
          display: flex;
          align-items: center;
          gap: 8px;

          .history-size {
            font-size: 12px;
            color: var(--text-muted);
          }
        }
      }

      .history-ops {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex-shrink: 0;

        .el-button {
          margin-left: 0 !important;
        }
      }
    }

    .history-tip {
      padding: 16px 4px;
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);

      &.history-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
    }
  }
}

.result-stage {
  flex: 1;
  min-height: 0;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-btn);
  background: var(--bg-base);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 12px;

  .result-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--text-muted);
    text-align: center;

    p {
      margin: 0;
      font-size: 13px;
    }
    .tip {
      font-size: 12px;
      color: var(--text-muted);
      opacity: 0.8;
    }
  }

  .result-img {
    max-width: 100%;
    display: block;
    border-radius: 6px;
    user-select: none;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  }
}

.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;

  .el-button + .el-button {
    margin-left: 0 !important;
  }
}

.display-scroll {
  flex: 1;
  min-height: 0;
}

.refresh-btn {
  margin-left: auto !important;
}

.source-tip {
  padding: 16px 4px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.source-card {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  padding: 10px;
  margin-bottom: 10px;
  background: var(--bg-base);

  .source-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .source-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .source-thumb {
    width: 100%;
    max-height: 180px;
    object-fit: contain;
    border-radius: 6px;
    background: #000;
    border: 1px solid var(--border-subtle);
    display: block;
    user-select: none;
  }

  .source-ops {
    display: flex;
    gap: 8px;
    margin-top: 8px;

    .el-button {
      flex: 1;
      margin-left: 0 !important;
    }
  }
}

.display-static-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin: 6px 0 10px;
}

.display-card {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  padding: 12px 14px;
  margin-bottom: 10px;
  background: var(--bg-base);

  &.primary {
    border-color: var(--color-primary);
  }

  .display-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .display-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }
  }

  .display-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--text-muted);
  }
}

/* 钉屏管理（右上角按钮 + 下拉面板） */
.sticker-menu {
  position: relative;
  flex: 0 0 auto;

  .sticker-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 50;
    width: 268px;
    max-height: 340px;
    overflow-y: auto;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
    padding: 10px;

    .sticker-dropdown-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 8px;

      .link-btn {
        border: none;
        background: none;
        color: var(--color-primary);
        font-size: 12px;
        cursor: pointer;
        padding: 0;
      }
    }

    .sticker-restore {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 0;
      margin-bottom: 4px;
      border-bottom: 1px solid var(--border-subtle);

      .sticker-restore-label {
        font-size: 13px;
        color: var(--text-secondary);
        white-space: nowrap;
      }

      .sticker-restore-select {
        width: 88px;
      }
    }

    .sticker-empty {
      font-size: 12px;
      color: var(--text-muted);
      text-align: center;
      padding: 16px 0;
    }

    .sticker-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      border-top: 1px solid var(--border-subtle);

      .sticker-mini {
        width: 44px;
        height: 44px;
        object-fit: cover;
        border-radius: 4px;
        background: var(--bg-base);
        border: 1px solid var(--border-subtle);
        flex-shrink: 0;
      }

      .sticker-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;

        .sticker-time {
          font-size: 12px;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sticker-state {
          font-size: 11px;

          &.on { color: var(--el-color-success, #67c23a); }
          &.off { color: var(--text-muted); }
        }
      }

      .el-button {
        margin-left: 0 !important;
        flex-shrink: 0;
      }
    }
  }
}
</style>
