<!--
  倒计时小窗（薄壳）：常驻浮动显示最临近结束的计时器。
  - 复用主页面的 useCountdown store（独立渲染进程，自行 load）。
  - 复用 CountdownDisplay 展示（不依赖圆环，样式随全局 displayStyle 切换）。
  - 透明 frameless 窗口，mouseEvents:true 已开启（捕获态，可点可拖）。
  - 双击标题栏循环皮肤（data-skin），写回 window-mode:countdownMiniWindow 与主窗口设置页同步。
  - 不监听 finished 弹通知（由主窗口 App.vue 守卫 isSecondWindow 处理），仅刷新本地 rows。
-->
<template>
  <div class="countdown-mini-window" :class="{ 'is-empty': !displayRow }">
    <div class="mini-header" @dblclick="cycleTheme">
      <span class="mini-title">倒计时</span>
      <span v-if="displayRow" class="mini-dot" :class="`dot--${displayRow.status}`" />
    </div>

    <div v-if="displayRow" class="mini-body">
      <div class="mini-name">{{ displayRow.name }}</div>
      <div class="mini-display">
        <CountdownDisplay :row="displayRow" />
      </div>
      <div class="mini-status">{{ statusLabel }}</div>

      <div class="mini-controls">
        <button
          v-if="displayRow.status === 'running'"
          class="mini-btn"
          type="button"
          @click="onPause"
        >
          暂停
        </button>
        <button
          v-else-if="displayRow.status === 'paused'"
          class="mini-btn"
          type="button"
          @click="onResume"
        >
          继续
        </button>
        <button class="mini-btn mini-btn--ghost" type="button" @click="onReset">重置</button>
      </div>
    </div>

    <div v-else class="mini-empty">暂无进行中的倒计时</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import CountdownDisplay from "@/views/countdown/components/CountdownDisplay.vue";
import { useCountdown } from "@/store/useCountdown";
import type { CountdownRow, CountdownStatus } from "@/views/countdown/types";

const store = useCountdown();

const STORE_KEY = "countdownMiniWindow";
const themes = [
  "coral",
  "mint",
  "sky",
  "lavender",
  "sakura",
  "amber",
  "white",
  "dark",
  "gray",
  "aurora",
];

/** 展示最临近结束的运行/暂停计时器；都不在跑则取第一条 */
const displayRow = computed<CountdownRow | null>(() => {
  const active = store.rows.filter((r) => r.status === "running" || r.status === "paused");
  if (active.length) {
    return active.slice().sort((a, b) => a.end_time - b.end_time)[0];
  }
  return store.rows[0] || null;
});

const statusMap: Record<CountdownStatus, string> = {
  running: "进行中",
  paused: "已暂停",
  finished: "已结束",
};
const statusLabel = computed(() => {
  const s = displayRow.value?.status;
  return s ? statusMap[s] : "";
});

function onPause() {
  const r = displayRow.value;
  if (r) store.pause(r.key, Math.max(0, r.end_time - Date.now()));
}
function onResume() {
  const r = displayRow.value;
  if (r) store.start(r.key, r.paused_remaining);
}
function onReset() {
  const r = displayRow.value;
  if (r) store.reset(r.key, r.duration);
}

// —— 皮肤：与 pomodoro 小窗一致，写回 window-mode:countdownMiniWindow ——
function applyTheme(theme: string) {
  if (theme === "white") {
    document.documentElement.removeAttribute("data-skin");
  } else {
    document.documentElement.setAttribute("data-skin", theme);
  }
}

function readConfig(): Record<string, any> {
  try {
    const raw = window.ipcRenderer.sendSync("get-store", `window-mode:${STORE_KEY}`);
    if (!raw) return {};
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
}

function loadConfig() {
  const cfg = readConfig();
  if (cfg.skin) applyTheme(cfg.skin);
}

function cycleTheme() {
  const current = document.documentElement.getAttribute("data-skin") || "white";
  const idx = themes.indexOf(current);
  const next = themes[(idx + 1) % themes.length];
  applyTheme(next);
  try {
    const cfg = readConfig();
    cfg.skin = next;
    window.ipcRenderer.sendSync("set-store", `window-mode:${STORE_KEY}`, cfg);
    // 同步给其它窗口（设置页/主窗口）刷新皮肤
    window.ipcRenderer.send("sync-data-to-other-window", {
      countdownMiniWindowConfig: { ...cfg },
    });
  } catch {
    /* 忽略写回失败 */
  }
}

onMounted(() => {
  store.load();
  loadConfig();
});
</script>

<style scoped lang="scss">
.countdown-mini-window {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  background: var(--skin-bg, rgba(255, 255, 255, 0.85));
  border-radius: 0.8em;
  backdrop-filter: blur(10px);
  border: 1px solid var(--skin-border, transparent);
  color: var(--skin-text, var(--text-primary));
  font-size: clamp(11px, 3.2vmin, 15px);
  overflow: hidden;
}

.mini-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  -webkit-app-region: drag;
  cursor: move;
  user-select: none;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--skin-border, var(--border-subtle));
}

.mini-title {
  font-size: 1.05em;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--skin-text, var(--text-primary));
}

.mini-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
  &--paused {
    background: var(--color-warning);
  }
  &--finished {
    background: var(--text-muted);
  }
}

.mini-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.mini-name {
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1em;
  font-weight: 600;
  color: var(--skin-text-secondary, var(--text-secondary));
  text-align: center;
}

.mini-display {
  width: 100%;
  padding: 6px 4px;
}

.mini-status {
  font-size: 0.85em;
  color: var(--skin-text-muted, var(--text-muted));
}

.mini-controls {
  display: flex;
  gap: 10px;
  -webkit-app-region: no-drag;
}

.mini-btn {
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  font-size: 0.9em;
  user-select: none;

  &:hover {
    filter: brightness(1.06);
  }

  &--ghost {
    background: var(--bg-hover);
    color: var(--skin-text, var(--text-primary));
    border-color: var(--skin-border, var(--border-subtle));
  }
}

.mini-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--skin-text-muted, var(--text-muted));
  -webkit-app-region: drag;
}
</style>
