import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * 安全保护（密保）store
 *
 * 安全设计（与 2FA / 应用锁统一）：
 * - 所有加解密、明文比对均在主进程完成（safetyProtection.ts），
 *   渲染端只持有「是否已设密码 / 是否已有密保」状态标志与按需取回的明文。
 * - 不再使用 legacy crypto.ts 的 RSA + 硬编码口令，也不再把密文写进 electron-store。
 * - 设备绑定主密钥（deviceKey）在主进程持有，渲染端永不接触密钥本身。
 */
export default defineStore("safety-protection", () => {
  /** 是否已设置防护密码 */
  const hasPassword = ref(false);
  /** 是否已有密保问题 */
  const hasQuestions = ref(false);

  /**
   * 初始化：拉取状态快照（是否已设密码 / 是否已有密保）
   *
   * @returns {Promise<void>}
   */
  async function init(): Promise<void> {
    try {
      const state = await window.ipcRenderer.handlePromise("safety:get-state", {});
      hasPassword.value = !!state?.hasPassword;
      hasQuestions.value = !!state?.hasQuestions;
    } catch (err) {
      console.error("[safety-protection] 初始化状态失败:", err);
    }
  }

  /** 重新拉取状态快照 */
  async function refresh(): Promise<void> {
    await init();
  }

  /**
   * 设置/修改防护密码（主进程加密落库，明文不经过渲染端存储）
   *
   * @param {string} text - 新密码明文（仅经 IPC 传给主进程加密）
   * @returns {Promise<boolean>} 是否成功
   */
  async function setPassword(text: string): Promise<boolean> {
    const res = await window.ipcRenderer.handlePromise("safety:set-password", { text });
    if (res?.ok) hasPassword.value = true;
    return !!res?.ok;
  }

  /**
   * 设置密保问题（主进程加密落库，明文不经过渲染端存储）
   *
   * @param {ObjectType[]} list - 问题列表 [{ question, answer }]
   * @returns {Promise<boolean>} 是否成功
   */
  async function setPwdQuestionList(list: ObjectType[]): Promise<boolean> {
    const questions = (list || []).map((item) => ({
      question: (item.question || "").trim(),
      answer: (item.answer || "").trim(),
    }));
    const res = await window.ipcRenderer.handlePromise("safety:set-questions", { questions });
    if (res?.ok) hasQuestions.value = true;
    return !!res?.ok;
  }

  /**
   * 校验防护密码（不改变任何状态）
   *
   * @param {string} text - 待校验明文密码
   * @returns {Promise<boolean>} 是否匹配；未设置密码时返回 false（无密文可比）
   */
  async function verifyPassword(text: string): Promise<boolean> {
    if (!hasPassword.value) return false;
    const res = await window.ipcRenderer.handlePromise("safety:verify-password", { text });
    return !!res?.matched;
  }

  /**
   * 校验密码后取回明文问题+答案（供编辑查看）
   *
   * @param {string} text - 防护密码（用于校验）
   * @returns {Promise<ObjectType[] | null>} 明文问题列表；校验失败返回 null
   */
  async function unlockQuestions(text: string): Promise<ObjectType[] | null> {
    const res = await window.ipcRenderer.handlePromise("safety:unlock-questions", { text });
    if (!res?.ok) return null;
    return (res.questions || []) as ObjectType[];
  }

  /**
   * 取回仅含问题的列表（无答案），供「忘记密码」恢复流程
   *
   * @returns {Promise<{ question: string }[]>}
   */
  async function getRecoveryQuestions(): Promise<{ question: string }[]> {
    const res = await window.ipcRenderer.handlePromise("safety:get-recovery-questions", {});
    return (res?.questions || []) as { question: string }[];
  }

  /**
   * 校验指定序号的密保答案（恢复流程）
   *
   * @param {number} index - 问题序号
   * @param {string} text - 用户填写的答案
   * @returns {Promise<boolean>} 是否匹配
   */
  async function verifyAnswer(index: number, text: string): Promise<boolean> {
    const res = await window.ipcRenderer.handlePromise("safety:verify-answer", { index, text });
    return !!res?.matched;
  }

  return {
    hasPassword,
    hasQuestions,
    init,
    refresh,
    setPassword,
    setPwdQuestionList,
    verifyPassword,
    unlockQuestions,
    getRecoveryQuestions,
    verifyAnswer,
  };
});
