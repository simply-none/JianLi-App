/**
 * 验证码计时 composable
 * ------------------------------------------------------------------
 * 每秒更新各账户的剩余秒数；仅在「周期边界」跨越时才向主进程重新取码，
 * 避免无谓的 HMAC 计算与 IPC 往返。
 * 账户列表变化（增删）后，调用 refresh() 主动重新取码。
 */
import { ref, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import useTwoFactor from '../../../store/useTwoFactor';
import type { TwoFactorCode } from '../types';

export function useTwoFactorCodes() {
  const store = useTwoFactor();
  const { accounts } = storeToRefs(store);
  const codes = ref<Record<string, TwoFactorCode>>({});
  let timer: number | null = null;
  let lastIndex = -1;

  /** 向主进程取一次最新验证码 */
  async function refresh(): Promise<void> {
    const res = await store.getCodes();
    if (res?.ok) {
      const map: Record<string, TwoFactorCode> = {};
      res.codes.forEach((c) => (map[c.key] = c));
      codes.value = map;
    }
  }

  /** 每秒心跳：先计算剩余秒，再判断是否跨周期边界 */
  function tick(): void {
    const now = Date.now();
    const next: Record<string, TwoFactorCode> = { ...codes.value };
    for (const key in next) {
      const c = next[key];
      const remaining = c.period - Math.floor((now / 1000) % c.period);
      if (remaining !== c.remainingSeconds) {
        next[key] = { ...c, remainingSeconds: remaining };
      }
    }
    codes.value = next;

    // 以 30s 为基准检测秒级边界（period=60 的账户每 30s 重取一次，代价可忽略）
    const idx = Math.floor(now / 1000 / 30);
    if (idx !== lastIndex) {
      lastIndex = idx;
      refresh();
    }
  }

  function start(): void {
    stop();
    lastIndex = Math.floor(Date.now() / 1000 / 30);
    refresh();
    timer = window.setInterval(tick, 1000);
  }

  function stop(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  onUnmounted(stop);

  return { codes, start, stop, refresh };
}
