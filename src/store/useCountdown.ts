/**
 * 倒计时 Pinia store。
 * 仅持有渲染端状态与动作，所有落库经 countdownApi（IPC）。禁 import electron/*。
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { CountdownRow, CountdownInput } from "@/views/countdown/types";
import * as api from "@/views/countdown/api/countdownApi";

/**
 * 进程级单例：监听主进程「倒计时结束」推送，自动刷新列表。
 * 放在 store 模块级（而非页面 onMounted/onUnmounted），原因：
 *  - preload 的 on 内部包了一层箭头函数，导致 off(channel, fn) 永远对不上内部 wrapper、
 *    removeListener 又未暴露，页面 onUnmounted 注销会抛 TypeError 或泄漏监听；
 *  - countdown-finished 同时被 App.vue 永久监听（用于弹通知），不能用 removeAllListeners 否则误杀通知。
 * ES Module 单例保证本模块只被求值一次，故天然只注册一遍，进程级常驻即可。
 */
let finishedListenerRegistered = false;
function ensureFinishedListener() {
  if (finishedListenerRegistered) return;
  finishedListenerRegistered = true;
  window.ipcRenderer.on("countdown-finished", () => {
    try {
      useCountdown().load();
    } catch {
      /* pinia 未就绪时忽略 */
    }
  });
}

export const useCountdown = defineStore("countdown", () => {
  // 首个 store 被使用时（pinia 已就绪）注册一次进程级监听
  ensureFinishedListener();

  const rows = ref<CountdownRow[]>([]);
  const activeKey = ref<string>("");
  const loading = ref(false);

  /** 当前选中的倒计时（用于大计时器视图） */
  const active = computed<CountdownRow | null>(() => {
    return rows.value.find((r) => r.key === activeKey.value) || rows.value[0] || null;
  });

  /** 拉取全部 */
  async function load() {
    loading.value = true;
    try {
      rows.value = await api.listCountdowns();
      if (!activeKey.value && rows.value.length) {
        activeKey.value = rows.value[0].key;
      }
    } finally {
      loading.value = false;
    }
  }

  function setActive(key: string) {
    activeKey.value = key;
  }

  /** 新增 / 编辑 */
  async function save(input: CountdownInput) {
    await api.saveCountdown(input);
    await load();
  }

  /** 删除（本地先过滤，避免闪烁） */
  async function remove(key: string) {
    await api.deleteCountdown(key);
    rows.value = rows.value.filter((r) => r.key !== key);
    if (activeKey.value === key) {
      activeKey.value = rows.value[0]?.key || "";
    }
  }

  async function start(key: string, duration: number) {
    await api.startCountdown(key, duration);
    await load();
  }

  async function pause(key: string, remaining: number) {
    await api.pauseCountdown(key, remaining);
    await load();
  }

  async function reset(key: string, duration: number) {
    await api.resetCountdown(key, duration);
    await load();
  }

  return { rows, activeKey, loading, active, load, setActive, save, remove, start, pause, reset };
});
