/**
 * 安全保护（密保）密钥模块
 * ------------------------------------------------------------------
 * 与 2FA / 应用锁共用同一套密钥安全架构（vault/crypto.ts：AES-256-GCM + PBKDF2），
 * 但密钥来源采用「设备绑定主密钥」而非用户口令：
 *   - 密保的密码与问题答案必须能脱离密码独立解密（用于「忘记密码 → 回答密保问题重置」），
 *     因此不能使用「用户口令派生密钥」模型（否则验证答案需先知道密码，形成死锁）。
 *   - 故本模块用 deviceKey.getDeviceMasterKey() 作为保险库密钥；明文仅驻留主进程内存，
 *     加密信封存于 basic_info(safetyVault)，绝不进 SQLite 业务表。
 *
 * 提供 IPC（全部异步 handle，明文不落渲染端存储）：
 *   safety:get-state            状态快照 { hasPassword, hasQuestions }
 *   safety:set-password        设置/修改密码（保留既有问题）
 *   safety:set-questions       设置密保问题（保留既有密码）
 *   safety:verify-password     校验密码
 *   safety:unlock-questions    校验密码后返回明文问题+答案（供编辑）
 *   safety:get-recovery-questions  返回仅含问题（无答案），供「忘记密码」流程
 *   safety:verify-answer       校验指定序号密保答案
 *
 * 迁移说明：旧实现用 legacy crypto.ts 的 RSA + 硬编码口令，密文散布在 electron-store
 * 的 password / pwdQuestionList。本项目采用「强制重新录入」，本模块不读取旧密文，
 * 旧键由 appLock 初始化时的迁移清理逻辑删除。
 */
import { ipcMain } from "electron";
import { query, upsert, del } from "./newSql.ts";
import { tableName } from "./store.ts";
import { encryptVault, decryptVault, type VaultEnvelope } from "./vault/crypto.ts";
import { getDeviceMasterKey } from "./vault/deviceKey.ts";

/** 保险库在 basic_info 中的存储键 */
const VAULT_KEY = "safetyVault";

/** 保险库明文结构（仅驻留主进程内存） */
interface SafetyData {
  /** 防护密码（明文，内存态；未设置时为 null） */
  password: string | null;
  /** 密保问题 + 答案（明文，内存态） */
  questions: { question: string; answer: string }[];
}

/** 内存态保险库（避免每次都解密；仅在读写时刷新） */
let memoryVault: SafetyData | null = null;

/**
 * 从 basic_info 读取并解密保险库；不存在或损坏时返回空结构（触发重新录入）
 *
 * @returns {Promise<SafetyData>} 解密后的明文结构
 */
async function readVault(): Promise<SafetyData> {
  try {
    const data = await query({ tableName, conditions: { key: VAULT_KEY } });
    if (!data || data.length === 0) return { password: null, questions: [] };
    const env = JSON.parse(data[0].value) as VaultEnvelope;
    const decrypted = decryptVault<SafetyData>(env, getDeviceMasterKey());
    return decrypted[0] || { password: null, questions: [] };
  } catch (err) {
    // 损坏/无法解密：安全降级为空（让用户重新录入），绝不抛异常卡死主进程
    console.error("[safetyProtection] 读取保险库失败，按空处理:", err);
    return { password: null, questions: [] };
  }
}

/**
 * 加密并写回保险库（同步刷新内存态）
 *
 * @param {SafetyData} data - 待持久化的明文结构
 * @returns {Promise<void>}
 */
async function writeVault(data: SafetyData): Promise<void> {
  const env = encryptVault<SafetyData>([data], getDeviceMasterKey());
  await upsert({
    tableName,
    data: { key: VAULT_KEY, value: JSON.stringify(env) },
    config: { primaryKey: "key" },
  });
  memoryVault = data;
}

/**
 * 初始化安全保护模块：注册全部 IPC 通道
 *
 * @returns {void}
 */
export function initSafetyProtection(): void {
  // 状态快照：是否已设密码、是否已有密保问题
  ipcMain.handle("safety:get-state", async () => {
    const v = await readVault();
    return { ok: true, hasPassword: !!v.password, hasQuestions: (v.questions?.length ?? 0) > 0 };
  });

  // 设置/修改密码（保留既有问题）
  ipcMain.handle("safety:set-password", async (_e, params: { text: string }) => {
    try {
      const text = params?.text;
      if (!text || typeof text !== "string") return { ok: false, error: "密码不能为空" };
      const v = await readVault();
      v.password = text;
      await writeVault(v);
      return { ok: true };
    } catch (err: any) {
      console.error("[safetyProtection] 设置密码失败:", err);
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // 设置密保问题（保留既有密码）
  ipcMain.handle("safety:set-questions", async (_e, params: { questions: { question: string; answer: string }[] }) => {
    try {
      const list = Array.isArray(params?.questions) ? params.questions : [];
      const cleaned = list
        .map((q) => ({ question: (q.question || "").trim(), answer: (q.answer || "").trim() }))
        .filter((q) => q.question && q.answer);
      if (cleaned.length < 3) return { ok: false, error: "至少需要 3 个有效密保问题" };
      const v = await readVault();
      v.questions = cleaned;
      await writeVault(v);
      return { ok: true };
    } catch (err: any) {
      console.error("[safetyProtection] 设置密保问题失败:", err);
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // 校验密码
  ipcMain.handle("safety:verify-password", async (_e, params: { text: string }) => {
    const v = await readVault();
    const matched = !!v.password && v.password === (params?.text || "");
    return { matched };
  });

  // 校验密码后返回明文问题 + 答案（供编辑查看）
  ipcMain.handle("safety:unlock-questions", async (_e, params: { text: string }) => {
    const v = await readVault();
    if (!v.password || v.password !== (params?.text || "")) {
      return { ok: false, error: "密码校验失败" };
    }
    return { ok: true, questions: v.questions || [] };
  });

  // 返回仅含问题（无答案），供「忘记密码」恢复流程
  ipcMain.handle("safety:get-recovery-questions", async () => {
    const v = await readVault();
    return { ok: true, questions: (v.questions || []).map((q) => ({ question: q.question })) };
  });

  // 校验指定序号密保答案
  ipcMain.handle("safety:verify-answer", async (_e, params: { index: number; text: string }) => {
    const v = await readVault();
    const idx = params?.index ?? -1;
    const item = v.questions?.[idx];
    const matched = !!item && item.answer === (params?.text || "");
    return { matched };
  });
}
