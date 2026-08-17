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
        <el-button type="primary" :loading="capturing" @click="startCapture">
          <LucideIcon name="Webcam" :size="15" />
          截图
        </el-button>
      </div>
    </div>

    <div class="page-body">
      <!-- 左侧：结果与操作 -->
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

      <!-- 右侧：显示器信息 -->
      <aside class="display-panel">
        <div class="panel-title">
          <LucideIcon name="MonitorDot" :size="15" />
          <span>显示器信息（{{ displays.length }}）</span>
        </div>
        <el-scrollbar class="display-scroll">
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
import { ref, onMounted, onUnmounted } from "vue";
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
    ElMessage.success("已截取并打开保存对话框");
  } else {
    ElMessage.success("截图完成");
  }
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
  window.ipcRenderer.on("screenshot:result", onScreenshotResult);
});

onUnmounted(() => {
  window.ipcRenderer.off?.("screenshot:result", onScreenshotResult);
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

    .shortcut-box {
      display: inline-flex;
      align-items: center;
      gap: 8px;

      .shortcut-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-weight: 500;
        color: var(--text-secondary);
        cursor: pointer;
        user-select: none;

        &.listening {
          cursor: default;
        }

        .shortcut-label {
          margin: 0 2px;
        }

        .shortcut-clear {
          margin-left: 2px;
          font-size: 14px;
          line-height: 1;
          opacity: 0.6;

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
  grid-template-columns: 1fr 300px;
  gap: 16px;
}

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
</style>
