/**
 * 小纸条 store（Pinia setup 风格）
 *
 * 职责：目标设备 / 收发记录 / 发送动作 的状态收敛；
 * 页面与组件只消费 store，不直接触碰 IPC（数据层在 views/noteSlip/api）。
 * 收到对端推送时由主进程经 preload 的 slip:received 事件驱动（bindEvents 订阅）。
 *
 * ⚠️ note_slip 不入同步白名单：收发记录是本机行为，同步会把两端记录互相灌入对方收件箱。
 */
import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { noteSlipApi } from "@/views/noteSlip/api/noteSlipApi";
import { SLIP_MAX_CHARS } from "@/views/noteSlip/types";
import type {
  NoteSlipItem,
  SlipPeer,
  SlipReceivedPayload,
  SlipSendResult,
  SlipTarget,
} from "@/views/noteSlip/types";

export const useNoteSlip = defineStore("noteSlip", () => {
  /** 扫描到的手机端设备 */
  const peers = ref<SlipPeer[]>([]);
  /** 已记忆的发送目标（electron-store 持久化，离线也显示） */
  const targets = ref<SlipTarget[]>([]);
  /** 当前选中目标 IP（空 = 用最近一次） */
  const selectedIp = ref("");
  /** 最近一次成功发送的目标 IP */
  const lastPeerIp = ref("");
  /** 收发记录（新→旧） */
  const items = ref<NoteSlipItem[]>([]);
  /** 编辑框内容 */
  const draft = ref("");
  /** 最近一次发送的错误提示（空 = 无错误） */
  const error = ref("");
  /** 最近一次发送成功的提示（空 = 无） */
  const okMessage = ref("");

  const scanning = ref(false);
  const sending = ref(false);
  const loading = ref(false);

  /** 未读条数（只统计收到的） */
  const unreadCount = computed(
    () => items.value.filter((i) => i.direction === "in" && !i.read).length,
  );
  /** 草稿是否可发送 */
  const canSend = computed(
    () => !!draft.value.trim() && draft.value.trim().length <= SLIP_MAX_CHARS && !sending.value,
  );
  /** 草稿超长提示 */
  const overflow = computed(() => draft.value.trim().length > SLIP_MAX_CHARS);
  /** 是否有可用目标（显式选择 或 有最近目标） */
  const hasTarget = computed(() => !!selectedIp.value || !!lastPeerIp.value);

  /** 拉取目标清单 + 最近目标 + 记录 */
  async function loadAll() {
    loading.value = true;
    try {
      const [t, lp, list] = await Promise.all([
        noteSlipApi.targets(),
        noteSlipApi.lastPeer(),
        noteSlipApi.list(),
      ]);
      if (t.success && t.data) targets.value = t.data;
      if (lp.success && typeof lp.data === "string") lastPeerIp.value = lp.data;
      if (list.success && list.data) items.value = list.data;
      // 无显式选择时，默认落到最近目标
      if (!selectedIp.value && lastPeerIp.value) selectedIp.value = lastPeerIp.value;
    } catch (e) {
      console.warn("[noteSlip] loadAll failed:", e);
    } finally {
      loading.value = false;
    }
  }

  /** 刷新记录 */
  async function loadList() {
    try {
      const res = await noteSlipApi.list();
      if (res.success && res.data) items.value = res.data;
    } catch (e) {
      console.warn("[noteSlip] loadList failed:", e);
    }
  }

  /** 扫描局域网手机端 */
  async function scan() {
    scanning.value = true;
    try {
      const res = await noteSlipApi.scan();
      if (res.success && res.data) {
        const merged = new Map<string, SlipPeer>();
        for (const p of res.data) merged.set(p.ip, p);
        peers.value = [...merged.values()];
        // 扫描到的手机顺手记入目标清单（主进程已做，这里刷新一下展示）
        const t = await noteSlipApi.targets();
        if (t.success && t.data) targets.value = t.data;
      }
    } catch (e) {
      console.warn("[noteSlip] scan failed:", e);
    } finally {
      scanning.value = false;
    }
  }

  /** 手动添加目标 IP（模拟器等广播不可达场景） */
  function addManual(ip: string) {
    const clean = ip.trim();
    if (!clean) return;
    if (!targets.value.some((t) => t.ip === clean)) {
      targets.value = [...targets.value, { ip: clean, name: "手动添加" }];
    }
    selectedIp.value = clean;
  }

  /** 选中目标 */
  function select(ip: string) {
    selectedIp.value = ip;
  }

  /** 发送草稿 */
  async function send(): Promise<boolean> {
    const text = draft.value.trim();
    if (!text || overflow.value) return false;
    sending.value = true;
    error.value = "";
    okMessage.value = "";
    try {
      const peerName = targets.value.find((t) => t.ip === selectedIp.value)?.name;
      const res = await noteSlipApi.send(text, selectedIp.value || undefined, peerName);
      if (res.success) {
        draft.value = "";
        if (res.data?.ip) {
          lastPeerIp.value = res.data.ip;
          selectedIp.value = res.data.ip;
        }
        okMessage.value = `已发送给 ${res.data?.name || res.data?.ip || "对端"}`;
        await loadAll();
        return true;
      }
      error.value = res.error || "发送失败";
      return false;
    } catch (e) {
      error.value = `发送失败：${String(e)}`;
      return false;
    } finally {
      sending.value = false;
    }
  }

  /** 把当前系统剪贴板文本发到最近目标（页面按钮入口） */
  async function sendClipboard(): Promise<boolean> {
    sending.value = true;
    error.value = "";
    okMessage.value = "";
    try {
      const res = await noteSlipApi.sendClipboard(selectedIp.value || undefined);
      if (res.success) {
        if (res.data?.ip) {
          lastPeerIp.value = res.data.ip;
          selectedIp.value = res.data.ip;
        }
        okMessage.value = `已发送剪贴板内容到 ${res.data?.name || res.data?.ip || "对端"}`;
        await loadAll();
        return true;
      }
      error.value = res.error || "发送失败";
      return false;
    } catch (e) {
      error.value = `发送失败：${String(e)}`;
      return false;
    } finally {
      sending.value = false;
    }
  }

  /** 标记已读 */
  async function markRead(key: string) {
    const item = items.value.find((i) => i.key === key);
    if (item) item.read = 1;
    try {
      await noteSlipApi.read(key);
    } catch (e) {
      console.warn("[noteSlip] markRead failed:", e);
    }
  }

  /** 删除单条 */
  async function remove(key: string) {
    items.value = items.value.filter((i) => i.key !== key);
    try {
      await noteSlipApi.remove(key);
    } catch (e) {
      console.warn("[noteSlip] remove failed:", e);
    }
  }

  /** 清空全部 */
  async function clear() {
    items.value = [];
    try {
      await noteSlipApi.clear();
    } catch (e) {
      console.warn("[noteSlip] clear failed:", e);
    }
  }

  // ---- 事件订阅（主进程 → 渲染端）----
  function onReceived(_e: unknown, _payload: SlipReceivedPayload) {
    loadList();
  }

  function bindEvents() {
    try {
      window.ipcRenderer.on("slip:received", onReceived as never);
    } catch (e) {
      console.warn("[noteSlip] bindEvents failed:", e);
    }
  }
  function unbindEvents() {
    try {
      window.ipcRenderer.off("slip:received", onReceived as never);
    } catch (e) {
      console.warn("[noteSlip] unbindEvents failed:", e);
    }
  }

  return {
    peers,
    targets,
    selectedIp,
    lastPeerIp,
    items,
    draft,
    error,
    okMessage,
    scanning,
    sending,
    loading,
    unreadCount,
    canSend,
    overflow,
    hasTarget,
    loadAll,
    loadList,
    scan,
    addManual,
    select,
    send,
    sendClipboard,
    markRead,
    remove,
    clear,
    bindEvents,
    unbindEvents,
  };
});
