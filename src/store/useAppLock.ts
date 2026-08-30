/**
 * 应用锁 / 隐私模式 store
 *
 * 职责：
 * 1. 锁定运行时态（locked）：由主进程广播 app-lock:state-changed 驱动（主进程权威）
 * 2. 配置态：是否已设密码（hasPassword）、启动锁定（onStartup）、恢复锁定（onRestore），
 *    开关落 basic_info（setStore），变更后 send 通知主进程（app-lock:config-changed）
 * 3. 动作封装：锁定 / 解锁（密码校验在主进程完成，明文不落存储）
 */
import { defineStore } from "pinia";
import { ref } from "vue";
import { send, setStore } from "../utils/common";

export default defineStore("app-lock", () => {
  /** 是否处于锁定态（遮罩显隐的唯一依据，主进程广播驱动） */
  const locked = ref(false);
  /** 是否已设置应用锁密码 */
  const hasPassword = ref(false);
  /** 应用启动时自动锁定（开关，默认关） */
  const onStartup = ref(false);
  /** 最小化/隐藏恢复到前台时自动锁定（开关，默认关） */
  const onRestore = ref(false);

  /** 是否已初始化（防重复订阅广播） */
  let inited = false;

  /**
   * 初始化：订阅主进程锁定态广播 + 拉取状态快照
   *
   * @returns {Promise<void>}
   */
  async function init(): Promise<void> {
    if (inited) return;
    inited = true;
    // 锁定态由主进程权威下发（手动/快捷键/启动/恢复锁定统一走主进程）
    window.ipcRenderer.on("app-lock:state-changed", (_e: any, val: any) => {
      locked.value = !!val?.locked;
    });
    try {
      const state = await window.ipcRenderer.handlePromise("app-lock:get-state", {});
      locked.value = !!state?.locked;
      hasPassword.value = !!state?.hasPassword;
      onStartup.value = !!state?.onStartup;
      onRestore.value = !!state?.onRestore;
    } catch (err) {
      console.error("[appLock] 初始化状态快照失败:", err);
    }
  }

  /**
   * 设置/修改密码（主进程内加密落库，明文不经过渲染端存储）
   *
   * @param {string} text - 新密码明文（仅经 IPC 传输给主进程加密）
   * @returns {Promise<boolean>} 是否设置成功
   */
  async function setPassword(text: string): Promise<boolean> {
    const res = await window.ipcRenderer.handlePromise("app-lock:set-password", { text });
    if (res?.ok) hasPassword.value = true;
    return !!res?.ok;
  }

  /**
   * 校验密码（不改变锁定态，设置页改密/关锁前验证用）
   *
   * @param {string} text - 待校验的明文密码
   * @returns {Promise<boolean>} 是否匹配
   */
  async function verify(text: string): Promise<boolean> {
    const res = await window.ipcRenderer.handlePromise("app-lock:verify", { text });
    return !!res?.matched;
  }

  /**
   * 清除密码（需先校验当前密码）：关闭应用锁并解除锁定
   *
   * @param {string} text - 当前密码明文
   * @returns {Promise<boolean>} 是否清除成功（密码错误返回 false）
   */
  async function clearPassword(text: string): Promise<boolean> {
    const res = await window.ipcRenderer.handlePromise("app-lock:clear-password", { text });
    if (res?.ok) {
      hasPassword.value = false;
      onStartup.value = false;
      onRestore.value = false;
    }
    return !!res?.ok;
  }

  /**
   * 解锁（锁屏遮罩调用：校验通过主进程自动解锁并广播）
   *
   * @param {string} text - 输入的明文密码
   * @returns {Promise<boolean>} 是否匹配（不匹配时遮罩提示错误）
   */
  async function unlock(text: string): Promise<boolean> {
    const res = await window.ipcRenderer.handlePromise("app-lock:unlock", { text });
    return !!res?.matched;
  }

  /**
   * 立即锁定（设置页测试按钮 / 命令面板触发）
   *
   * @returns {Promise<void>}
   */
  async function lock(): Promise<void> {
    await window.ipcRenderer.handlePromise("app-lock:lock", {});
  }

  /**
   * 设置「启动时锁定」开关：落 basic_info + 通知主进程
   *
   * @param {boolean} value - 开关值
   * @returns {void}
   */
  function setOnStartup(value: boolean): void {
    onStartup.value = value;
    setStore("appLockOnStartup", value);
    send("app-lock:config-changed", {});
  }

  /**
   * 设置「最小化恢复时锁定」开关：落 basic_info + 通知主进程
   *
   * @param {boolean} value - 开关值
   * @returns {void}
   */
  function setOnRestore(value: boolean): void {
    onRestore.value = value;
    setStore("appLockOnRestore", value);
    send("app-lock:config-changed", {});
  }

  return {
    locked,
    hasPassword,
    onStartup,
    onRestore,
    init,
    setPassword,
    verify,
    clearPassword,
    unlock,
    lock,
    setOnStartup,
    setOnRestore,
  };
});
