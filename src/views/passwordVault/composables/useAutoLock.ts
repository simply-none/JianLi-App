/**
 * 自动锁定组合式函数
 * ------------------------------------------------------------------
 * 对标 1Password / Bitwarden 的「失焦 + 空闲」自动锁定策略：
 * - 窗口失焦（window blur）或页面隐藏（visibilitychange -> hidden）即触发锁定；
 * - 无操作达到 idleMinutes 分钟后触发锁定（按用户活动时间重置计时）。
 * 仅当保险库处于「已解锁」状态时启用；锁定回调由调用方提供（清空内存）。
 */
import { onUnmounted, unref, type Ref } from 'vue';

export interface AutoLockOptions {
  /** 空闲多少分钟触发锁定（默认 5，可为 ref） */
  idleMinutes?: number | Ref<number>;
  /** 锁定触发回调（清空内存保险库） */
  onLock: () => void;
}

export function useAutoLock(options: AutoLockOptions) {
  let idleMs = (unref(options.idleMinutes) ?? 5) * 60_000;
  let lastActivity = Date.now();
  let tickTimer: number | null = null;
  let enabled = false;
  let paused = false;

  function markActivity() {
    lastActivity = Date.now();
  }

  function checkIdle() {
    if (!enabled || paused) return;
    if (Date.now() - lastActivity >= idleMs) {
      triggerLock();
    }
  }

  function triggerLock() {
    if (!enabled || paused) return;
    enabled = false; // 防止重复触发
    options.onLock();
  }

  function onBlur() {
    triggerLock();
  }

  function onVisibility() {
    if (document.hidden) triggerLock();
  }

  /** 启动自动锁定监听（保险库解锁后调用） */
  function start() {
    if (enabled) return;
    enabled = true;
    paused = false;
    idleMs = (unref(options.idleMinutes) ?? 5) * 60_000;
    lastActivity = Date.now();
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('mousemove', markActivity);
    window.addEventListener('keydown', markActivity);
    window.addEventListener('click', markActivity);
    window.addEventListener('wheel', markActivity);
    tickTimer = window.setInterval(checkIdle, 10_000);
  }

  /** 停止监听（锁定 / 离开页面时调用） */
  function stop() {
    enabled = false;
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('mousemove', markActivity);
    window.removeEventListener('keydown', markActivity);
    window.removeEventListener('click', markActivity);
    window.removeEventListener('wheel', markActivity);
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  /** 暂停锁定（打开原生文件对话框前调用，避免误触发失焦锁定） */
  function pause() {
    paused = true;
  }

  /** 恢复锁定（原生文件对话框关闭后调用） */
  function resume() {
    paused = false;
    lastActivity = Date.now();
  }

  onUnmounted(stop);

  return { start, stop, pause, resume };
}
