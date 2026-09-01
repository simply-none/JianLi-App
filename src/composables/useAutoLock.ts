/**
 * 自动锁定组合式函数（共享）
 * ------------------------------------------------------------------
 * 对标 1Password / Bitwarden 的「失焦 + 空闲」自动锁定策略：
 * - 窗口失焦（window blur）或页面隐藏（visibilitychange -> hidden）即触发锁定；
 * - 无操作达到 idleMinutes 分钟后触发锁定（按用户活动时间重置计时）。
 * 仅当保险库处于「已解锁」状态时启用；锁定回调由调用方提供（清空内存）。
 *
 * 注：本文件原为 passwordVault 私有，现提升为共享 composable，供 fileVault 等
 *     安全模块复用，避免重复实现。
 */
import { onUnmounted, unref, type Ref } from 'vue';

/**
 * 原生对话框（文件/文件夹选择器）进行中会临时挂起自动锁定。
 * 这类系统对话框会让渲染窗口失焦/隐藏，若按正常规则会误触发锁定，
 * 因此在打开前 +1、关闭后 -1，期间任何 blur/visibility 锁定都被忽略。
 * 这是模块级计数，fileVault 等安全模块页面同时只存在一个实例，共享即可。
 */
let _nativeDialogs = 0;
export function suspendAutoLockForNative() {
  _nativeDialogs++;
}
export function resumeAutoLockForNative() {
  _nativeDialogs = Math.max(0, _nativeDialogs - 1);
}

export interface AutoLockOptions {
  /** 空闲多少分钟触发锁定（默认 5，可为 ref） */
  idleMinutes?: number | Ref<number>;
  /** 锁定触发回调（清空内存保险库） */
  onLock: () => void;
}

export function useAutoLock(options: AutoLockOptions) {
  let lastActivity = Date.now();
  let tickTimer: number | null = null;
  let enabled = false;
  let paused = false;
  /** 启动时刻；解锁弹窗关闭会带来一次短暂失焦，需忽略启动后极短时间内的失焦/隐藏 */
  let startedAt = 0;
  const GRACE_MS = 500;

  function markActivity() {
    lastActivity = Date.now();
  }

  function checkIdle() {
    if (!enabled || paused) return;
    const ms = (unref(options.idleMinutes) ?? 5) * 60_000;
    if (Date.now() - lastActivity >= ms) {
      triggerLock();
    }
  }

  function triggerLock() {
    if (!enabled || paused) return;
    if (_nativeDialogs > 0) return; // 原生对话框进行中，忽略失焦/隐藏误触发
    enabled = false; // 防止重复触发
    options.onLock();
  }

  function onBlur() {
    if (Date.now() - startedAt < GRACE_MS) return;
    triggerLock();
  }

  function onVisibility() {
    if (document.hidden && Date.now() - startedAt >= GRACE_MS) triggerLock();
  }

  /** 启动自动锁定监听（保险库解锁后调用） */
  function start() {
    if (enabled) return;
    enabled = true;
    paused = false;
    lastActivity = Date.now();
    startedAt = Date.now();
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
