/**
 * 应用锁 / 隐私模式（老板键）模块
 *
 * 功能：
 * 1. 应用锁：锁定时主窗口显示锁屏遮罩（渲染端 AppLock.vue），所有小窗/贴纸窗临时隐藏，
 *    输入密码解锁后恢复。密码经 RSA 公钥加密落 basic_info（appLockPassword），明文不经过渲染端。
 * 2. 锁定触发（均需用户在设置页开启对应开关，默认不触发）：
 *    - 手动锁定：快捷键（register_shortcut 表 lock_app 动作）/ 设置页按钮 / 命令面板
 *    - 启动时锁定：应用启动后自动进入锁定态
 *    - 最小化恢复时锁定：主窗口 restore/show 回前台时自动锁定
 * 3. 隐私模式（老板键）：快捷键（privacy_hide 动作）一键隐藏全部窗口，再按恢复；
 *    锁定态下恢复时不还原小窗（保持锁定隐私）。
 *
 * 安全设计：
 * - 校验/解密全部在本模块完成，用异步 ipcMain.handle（避开 decrypt-pwd 同步通道阻塞渲染线程的坑）
 * - 复用 crypto.ts 的同一对 RSAKey（basic_info），密钥不落地渲染端
 */
import { ipcMain, BrowserWindow } from "electron";
import crypto from "node:crypto";
import { query, upsert, del } from "./newSql.ts";
import { tableName } from "./store.ts";
import { safePrivateDecrypt } from "./crypto.ts";
import { win } from "./mainWindow.ts";

/** 密码密文在 basic_info 中的存储键 */
const PASSWORD_KEY = "appLockPassword";
/** 启动时锁定配置键（bool，默认 false） */
const LOCK_ON_STARTUP_KEY = "appLockOnStartup";
/** 最小化恢复时锁定配置键（bool，默认 false） */
const LOCK_ON_RESTORE_KEY = "appLockOnRestore";
/** 应用启动保护期（ms）：保护期内 restore/show 不触发恢复锁定，避免与启动锁定重复 */
const STARTUP_GUARD_MS = 8000;
/** 模块初始化时间戳（启动保护期基准） */
let initializedAt = 0;

/** 当前是否处于锁定态（主进程权威，广播同步给渲染端） */
let isLocked = false;
/** 锁定时被隐藏的窗口列表（解锁时按原样恢复） */
let hiddenWindows: BrowserWindow[] = [];

/**
 * 从 basic_info 读取 RSA 密钥对（复用 crypto.ts 首次生成的密钥，绝不在此重新生成）
 *
 * @returns {Promise<{ publicKey: string; privateKey: string } | null>} 密钥对；读取失败返回 null
 */
async function getRSAKeyPair(): Promise<{ publicKey: string; privateKey: string } | null> {
  try {
    const data = await query({ tableName, conditions: { key: "RSAKey" } });
    if (!data || data.length === 0) return null;
    return JSON.parse(data[0].value);
  } catch (err) {
    console.error("[appLock] 读取 RSAKey 失败:", err);
    return null;
  }
}

/**
 * 读取 basic_info 布尔配置（appLockOnStartup / appLockOnRestore）
 *
 * @param {string} key - 配置键
 * @returns {Promise<boolean>} 配置值；缺失或解析失败返回 false（默认不触发）
 */
async function readBoolConfig(key: string): Promise<boolean> {
  try {
    const data = await query({ tableName, conditions: { key } });
    if (!data || data.length === 0) return false;
    const value = data[0].value;
    return value === true || value === "true" || value === 1 || value === "1";
  } catch {
    return false;
  }
}

/**
 * 读取存储的密码密文
 *
 * @returns {Promise<string|null>} 密文；未设置或读取失败返回 null
 */
async function getStoredPassword(): Promise<string | null> {
  try {
    const data = await query({ tableName, conditions: { key: PASSWORD_KEY } });
    if (!data || data.length === 0 || !data[0].value) return null;
    return data[0].value;
  } catch (err) {
    console.error("[appLock] 读取密码密文失败:", err);
    return null;
  }
}

/**
 * 校验密码（主进程解密比对，明文不出现在任何存储中）
 *
 * @param {string} text - 用户输入的明文密码
 * @returns {Promise<boolean>} 是否匹配；未设置密码返回 false
 */
async function verifyPassword(text: string): Promise<boolean> {
  const stored = await getStoredPassword();
  if (!stored) return false;
  const keyPair = await getRSAKeyPair();
  if (!keyPair) return false;
  // 必须走 crypto.ts 的 safePrivateDecrypt：私钥生成时带了 aes-256-cbc 口令加密，
  // 此处若自行调用 privateDecrypt 漏传 passphrase 会必然抛错（表现为正确密码也解锁失败）。
  // 该函数同时兼容历史密文外层 JSON 引号、并兜底异常不让其冒泡。
  const res = safePrivateDecrypt(stored, keyPair.privateKey);
  return res.ok && res.decrypted === text;
}

/**
 * 广播锁定态到所有窗口（渲染端 AppLock.vue 据此显隐遮罩）
 *
 * @returns {void}
 */
function broadcastLockState(): void {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) {
      w.webContents.send("app-lock:state-changed", { locked: isLocked });
    }
  });
}

/**
 * 立即锁定应用
 *
 * 流程：隐藏全部非主窗口（记录以便恢复）→ 置锁定态 → 广播 → 主窗口显示并聚焦。
 * 幂等：已锁定时重复调用直接返回。
 *
 * @returns {void}
 */
function lockAppNow(): void {
  if (isLocked) return;
  isLocked = true;
  try {
    // 隐藏全部非主窗口（小窗/贴纸/命令面板等），锁定期间不可见防窥
    const mainWin = win && !win.isDestroyed() ? win : null;
    hiddenWindows = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && w !== mainWin);
    hiddenWindows.forEach((w) => w.hide());

    // 主窗口回前台展示锁屏遮罩（isLocked 已置位，restore/show 事件不会重复触发锁定）
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.show();
      mainWin.focus();
    }
  } catch (err) {
    console.error("[appLock] 锁定流程异常:", err);
  }
  broadcastLockState();
}

/**
 * 解锁应用
 *
 * 流程：清除锁定态 → 广播 → 恢复锁定时隐藏的小窗（按原窗口对象 show，无需重建）。
 *
 * @returns {void}
 */
function unlockAppNow(): void {
  if (!isLocked) return;
  isLocked = false;
  try {
    hiddenWindows.forEach((w) => {
      if (!w.isDestroyed()) w.show();
    });
    hiddenWindows = [];
  } catch (err) {
    console.error("[appLock] 恢复小窗异常:", err);
  }
  broadcastLockState();
}

/**
 * 隐私模式（老板键）：一键隐藏全部窗口，再按恢复
 *
 * - 有任意可见窗口时：隐藏主窗口 + 全部小窗（记录列表）
 * - 全部隐藏时：显示主窗口；若处于锁定态则不恢复小窗（保持隐私锁定）
 *
 * @returns {void}
 */
function togglePrivacyHide(): void {
  try {
    const mainWin = win && !win.isDestroyed() ? win : null;
    const others = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && w !== mainWin);
    const anyVisible = (mainWin && mainWin.isVisible()) || others.some((w) => w.isVisible());

    if (anyVisible) {
      // 隐藏全部（与锁定分开记录，避免覆盖 locked 的 hiddenWindows）
      privacyHidden = [];
      if (mainWin && mainWin.isVisible()) {
        mainWin.hide();
        privacyHidden.push(mainWin);
      }
      others.forEach((w) => {
        if (w.isVisible()) {
          w.hide();
          privacyHidden.push(w);
        }
      });
    } else {
      // 恢复：主窗口回前台；锁定态下小窗保持隐藏（lockAppNow 的恢复逻辑接管）
      if (mainWin) {
        mainWin.show();
        mainWin.focus();
      }
      if (!isLocked) {
        privacyHidden.forEach((w) => {
          if (!w.isDestroyed()) w.show();
        });
      }
      privacyHidden = [];
    }
  } catch (err) {
    console.error("[appLock] 老板键切换异常:", err);
  }
}

/** 老板键隐藏的窗口列表（与锁定隐藏列表分开维护，互不干扰） */
let privacyHidden: BrowserWindow[] = [];

/**
 * 判断是否应触发「最小化恢复时锁定」
 *
 * 条件：未处于锁定态 + 开关已开启 + 已设置密码 + 已过启动保护期。
 *
 * @returns {Promise<boolean>} 是否应锁定
 */
async function shouldLockOnRestore(): Promise<boolean> {
  if (isLocked) return false;
  if (Date.now() - initializedAt < STARTUP_GUARD_MS) return false;
  if (!(await readBoolConfig(LOCK_ON_RESTORE_KEY))) return false;
  const stored = await getStoredPassword();
  return !!stored;
}

/**
 * 初始化应用锁模块：注册 IPC 通道 + 挂主窗口事件 + 启动锁定检查
 *
 * 注册的通道：
 * - app-lock:set-password 设置密码 / app-lock:verify 校验 / app-lock:clear-password 清除
 * - app-lock:unlock 解锁（校验通过即解锁）/ app-lock:lock 立即锁定 / app-lock:get-state 状态快照
 * - app-lock:config-changed 配置变更通知（重读开关）
 * - app-lock:state-changed 主→渲染广播锁定态
 *
 * @returns {void}
 */
export function initAppLock() {
  initializedAt = Date.now();

  // 设置密码（首次开启或修改）：主进程内加密落库，明文不经过渲染端存储
  ipcMain.handle("app-lock:set-password", async (_e, params: { text: string }) => {
    try {
      const { text } = params || ({} as any);
      if (!text || typeof text !== "string") return { ok: false, error: "密码不能为空" };
      const keyPair = await getRSAKeyPair();
      if (!keyPair) return { ok: false, error: "加密密钥未就绪，请稍后重试" };
      const encrypted = crypto.publicEncrypt(
        { key: keyPair.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
        Buffer.from(text)
      );
      await upsert({
        tableName,
        data: { key: PASSWORD_KEY, value: encrypted.toString("base64") },
        config: { primaryKey: "key" },
      });
      return { ok: true };
    } catch (err: any) {
      console.error("[appLock] 设置密码失败:", err);
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // 校验密码（设置页改密/关锁前验证，不改变锁定态）
  ipcMain.handle("app-lock:verify", async (_e, params: { text: string }) => {
    const matched = await verifyPassword(params?.text || "");
    return { matched };
  });

  // 清除密码（需先校验当前密码）：删除存储行并解除锁定
  ipcMain.handle("app-lock:clear-password", async (_e, params: { text: string }) => {
    const matched = await verifyPassword(params?.text || "");
    if (!matched) return { ok: false, matched, error: "密码错误" };
    try {
      await del({ tableName, condition: { key: PASSWORD_KEY } });
      unlockAppNow();
      return { ok: true, matched };
    } catch (err: any) {
      console.error("[appLock] 清除密码失败:", err);
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // 解锁（校验通过即解锁并广播）
  ipcMain.handle("app-lock:unlock", async (_e, params: { text: string }) => {
    const matched = await verifyPassword(params?.text || "");
    if (matched) unlockAppNow();
    return { matched };
  });

  // 立即锁定（设置页测试按钮 / 命令面板触发）
  ipcMain.handle("app-lock:lock", async () => {
    lockAppNow();
    return { ok: true };
  });

  // 状态快照（渲染端初始化用：锁定态 + 是否已设密码 + 两个开关）
  ipcMain.handle("app-lock:get-state", async () => {
    const stored = await getStoredPassword();
    return {
      locked: isLocked,
      hasPassword: !!stored,
      onStartup: await readBoolConfig(LOCK_ON_STARTUP_KEY),
      onRestore: await readBoolConfig(LOCK_ON_RESTORE_KEY),
    };
  });

  // 配置变更通知：渲染端改开关后调用，主进程无需额外处理（每次判定实时读库），
  // 仅记录日志便于排查
  ipcMain.on("app-lock:config-changed", () => {
    console.log("[appLock] 锁定配置已变更");
  });

  // 最小化恢复时锁定：主窗口从最小化恢复（restore）或重新显示（show）时判定
  if (win && !win.isDestroyed()) {
    const tryLockOnRestore = () => {
      shouldLockOnRestore()
        .then((should) => {
          if (should) lockAppNow();
        })
        .catch((err) => console.error("[appLock] 恢复锁定判定异常:", err));
    };
    win.on("restore", tryLockOnRestore);
    win.on("show", tryLockOnRestore);
  }

  // 启动时锁定：延迟数秒等待主窗口与渲染端就绪，开关开启且已设密码才触发
  setTimeout(async () => {
    try {
      const enabled = await readBoolConfig(LOCK_ON_STARTUP_KEY);
      if (!enabled) return;
      const stored = await getStoredPassword();
      if (!stored) return;
      lockAppNow();
    } catch (err) {
      console.error("[appLock] 启动锁定检查异常:", err);
    }
  }, 4000);
}

export { lockAppNow, togglePrivacyHide };
