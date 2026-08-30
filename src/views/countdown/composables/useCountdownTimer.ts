/**
 * 倒计时实时重算：维护一个全局 now（模块级单例），每 250ms 刷新一次。
 * 显示剩余 = end_time - now；窗口从隐藏恢复时立刻补一次 tick，避免节流后数值陈旧。
 * 组件卸载时引用计数归零才清定时器，多个组件共用同一时钟。
 */
import { ref, onUnmounted } from "vue";

const now = ref(Date.now());
let timer: number | null = null;
let refs = 0;
let visibilityBound = false;

function tick() {
  now.value = Date.now();
}

function bindVisibility() {
  if (visibilityBound) return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tick();
  });
}

export function useCountdownTimer() {
  refs++;
  if (!timer) {
    timer = window.setInterval(tick, 250);
    bindVisibility();
  }
  onUnmounted(() => {
    refs--;
    if (refs <= 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  });
  return { now };
}

/** 格式化剩余毫秒为 { d, h, m, s, ms, text } */
export function formatRemaining(ms: number) {
  const clamped = Math.max(0, ms);
  const totalSec = Math.floor(clamped / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const text = `${pad(d)}天 ${pad(h)}:${pad(m)}:${pad(s)}`;
  return { d, h, m, s, ms: clamped, text };
}
