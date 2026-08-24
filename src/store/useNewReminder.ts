import { computed, onMounted, ref } from "vue";
import { defineStore } from "pinia";
import type { TipsReminder } from "@/views/newTips/types";

// 全新提醒系统的数据 store：所有提醒读写都走主进程 newReminder.ts（最终落库到 newSql 的 reminders 表）。
export default defineStore("new-reminder", () => {
  const reminders = ref<TipsReminder[]>([]);
  const remindersC = computed(() => reminders.value);

  // 从主进程读取全部提醒（替代旧 basic_info.reminders 字段）
  async function load() {
    try {
      const stored: TipsReminder[] = (await (window as any).ipcRenderer.invoke("get-tips")) || [];
      reminders.value = stored;
    } catch (e) {
      console.error("读取提醒表失败:", e);
    }
  }

  // 新增/编辑/切换启用：交给主进程落库 + 重排程
  async function saveReminder(item: TipsReminder) {
    const res = await (window as any).ipcRenderer.invoke("tips-save", JSON.parse(JSON.stringify(item)));
    // 主进程明确拒绝（如 states 异常）：回滚本地副本，避免 UI 假成功
    if (res && res.ok === false) {
      console.error("提醒保存失败：", res.error);
      // 重新从主进程拉取，恢复本地为该提醒的真实（旧）状态
      const fresh = (await (window as any).ipcRenderer.invoke("get-tips")) || [];
      reminders.value = fresh;
      throw new Error(res.error || "保存失败");
    }
    const itemCopy = JSON.parse(JSON.stringify(item));
    const idx = reminders.value.findIndex((i) => i.id === itemCopy.id);
    if (idx !== -1) reminders.value.splice(idx, 1, itemCopy);
    else reminders.value.push(itemCopy);
  }

  function updateReminder(item: TipsReminder) {
    return saveReminder(item);
  }

  function addReminder(item: TipsReminder) {
    return saveReminder(item);
  }

  function deleteReminder(id: string) {
    (window as any).ipcRenderer.send("tips-delete", id);
    reminders.value = reminders.value.filter((i) => i.id !== id);
  }

  function toggleReminder(id: string, enabled: number) {
    const item = reminders.value.find((i) => i.id === id);
    if (item) saveReminder({ ...item, enabled });
  }

  async function init() {
    await load();
    // 若主进程尚未播种（首次安装），触发一次保存以落库；主进程 seed 会在 initNewReminder 时补齐
    if (!reminders.value.some((r) => r.mode === "stateful")) {
      await load(); // 再读一次，确保拿到主进程 seed 的内置番茄钟
    }
    // 监听主进程回填的开始时间（realign 对齐后直写库并回发），保持本地配置新鲜
    (window as any).ipcRenderer.on("tips-starttime-updated", (_e: any, payload: { id: string; startTime: number }) => {
      const item = reminders.value.find((i) => i.id === payload.id);
      if (item && item.startTime !== payload.startTime) {
        item.startTime = payload.startTime;
      }
    });
  }

  onMounted(() => {
    init();
  });

  return {
    reminders,
    remindersC,
    load,
    saveReminder,
    updateReminder,
    addReminder,
    deleteReminder,
    toggleReminder,
    init,
  };
});
