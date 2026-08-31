/**
 * 密码保险库模块（主进程入口）
 * ------------------------------------------------------------------
 * 与 2FA 验证器共用同一套密钥安全架构（AES-256-GCM + PBKDF2，见 ./vault/crypto.ts）：
 * - 维护「内存保险库」：解密后的条目明文（含 password / otpSecret），
 *   仅会话期驻留主进程内存；
 * - 提供 IPC：导入 / 新建 / 列出 / 取密 / 取码 / 复制 / 增删改 / 导出 / 锁定 / 关闭；
 * - 文件选择走原生 dialog（打开 / 保存）。
 *
 * 安全红线（对齐全局约定 + 2FA 实践）：
 * - 明文绝不写应用数据库（newSql / basic_info 只读写非机密的「上次路径」偏好）；
 * - get-secret / get-otp / copy 仅在用户主动操作时、于主进程内取用明文，
 *   明文不长期驻留渲染端；
 * - copy 写入系统剪贴板后定时清空（剪贴板保护，不写入剪贴板历史表）；
 * - lock 清空内存中的明文与口令（自动锁定 / 手动退出均走此路径）。
 *
 * ⚠️ 改动本文件后必须重启 Electron 才生效。
 */
import { ipcMain, dialog, clipboard } from 'electron';
import crypto from 'node:crypto';
import { query, upsert } from './newSql.ts';
import { tableName } from './store.ts';
import { readVaultFile, writeVaultFile } from './vault/crypto.ts';
import { generateTotpWithMeta } from './twoFactor/otp.ts';
import type { VaultEntry, VaultEntryMeta } from './passwordVault/types.ts';

/** basic_info 中记录“上次保险库路径”的键（非机密偏好） */
const LAST_PATH_KEY = 'passwordVaultPath';

/** 复制密码到剪贴板后，自动清空的时间（毫秒） */
const CLIPBOARD_CLEAR_MS = 30_000;

let vault: VaultEntry[] | null = null;
let vaultPath: string | null = null;
/** 仅会话期驻留内存，用于回写加密文件；lock 时清空 */
let vaultPass: string | null = null;
/** 剪贴板自动清空的定时器句柄 */
let clipboardClearTimer: NodeJS.Timeout | null = null;

/** 剔除敏感字段，生成返回给渲染端的脱敏元数据 */
function toMeta(e: VaultEntry): VaultEntryMeta {
  const { password, otpSecret, note, ...rest } = e;
  return { ...rest, hasOtp: !!otpSecret, hasNote: !!note };
}

async function getLastPath(): Promise<string | null> {
  try {
    const data = await query({ tableName, conditions: { key: LAST_PATH_KEY } });
    return data && data.length ? (data[0].value as string) : null;
  } catch {
    return null;
  }
}

async function setLastPath(path: string): Promise<void> {
  try {
    await upsert({ tableName, data: { key: LAST_PATH_KEY, value: path }, config: { primaryKey: 'key' } });
  } catch (err) {
    console.error('[passwordVault] 记录上次保险库路径失败:', err);
  }
}

/** 把内存保险库以当前口令加密回写文件（增删改后调用） */
function safeWriteBack(): { ok: boolean; error?: string } {
  if (!vault || !vaultPath || !vaultPass) return { ok: false, error: '保险库未就绪' };
  try {
    writeVaultFile(vaultPath, vault, vaultPass);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/** 复制文本到系统剪贴板，并安排定时清空（不写入剪贴板历史表） */
function copyToClipboard(text: string): { ok: boolean; error?: string } {
  try {
    clipboard.writeText(text);
    if (clipboardClearTimer) clearTimeout(clipboardClearTimer);
    clipboardClearTimer = setTimeout(() => {
      // 仅当剪贴板内容仍是我们写入的，才清空，避免误清用户后续复制的内容
      try {
        if (clipboard.readText() === text) clipboard.clear();
      } catch { /* 忽略清空失败 */ }
      clipboardClearTimer = null;
    }, CLIPBOARD_CLEAR_MS);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export function initPasswordVault() {
  // 选择现有保险库文件
  ipcMain.handle('password-vault:pick-open', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: '密码保险库', extensions: ['json', 'pw', 'txt'] }],
    });
    return r.canceled ? null : r.filePaths[0];
  });

  // 选择导出 / 保存路径
  ipcMain.handle('password-vault:pick-save', async (_e, defaultName = 'password-vault') => {
    const r = await dialog.showSaveDialog({
      defaultPath: `${defaultName}.json`,
      filters: [{ name: '密码保险库', extensions: ['json'] }],
    });
    return r.canceled ? null : r.filePath;
  });

  // 导入并解密保险库（解锁）
  ipcMain.handle(
    'password-vault:open-vault',
    async (_e, { filePath, passphrase }: { filePath: string; passphrase: string }) => {
      try {
        const entries = readVaultFile<VaultEntry>(filePath, passphrase);
        vault = entries;
        vaultPath = filePath;
        vaultPass = passphrase;
        await setLastPath(filePath);
        return { ok: true, entries: vault.map(toMeta) };
      } catch {
        return { ok: false, error: '解密失败：口令错误或文件损坏' };
      }
    },
  );

  // 新建保险库（可含初始条目）
  ipcMain.handle(
    'password-vault:create-vault',
    async (_e, { filePath, passphrase, entries = [] }: { filePath: string; passphrase: string; entries?: VaultEntry[] }) => {
      try {
        writeVaultFile(filePath, entries, passphrase);
        vault = entries;
        vaultPath = filePath;
        vaultPass = passphrase;
        await setLastPath(filePath);
        return { ok: true, entries: vault.map(toMeta) };
      } catch (err: any) {
        return { ok: false, error: err?.message || String(err) };
      }
    },
  );

  // 当前状态 + 条目列表（脱敏）
  ipcMain.handle('password-vault:list', async () => {
    return {
      ok: true,
      hasVault: !!vault,
      vaultPath,
      lastPath: await getLastPath(),
      entries: (vault || []).map(toMeta),
    };
  });

  // 取回某条目明文密码（仅用户主动“显示/复制”时调用，明文不长期留存渲染端）
  ipcMain.handle('password-vault:get-secret', async (_e, { key }: { key: string }) => {
    if (!vault) return { ok: false, error: '未导入保险库' };
    const e = vault.find((x) => x.key === key);
    if (!e) return { ok: false, error: '条目不存在' };
    return { ok: true, password: e.password, note: e.note };
  });

  // 取回某条目的 TOTP 码（若该条目配置了 otpSecret；密钥仅在主进程内使用）
  ipcMain.handle('password-vault:get-otp', async (_e, { key }: { key: string }) => {
    if (!vault) return { ok: false, error: '未导入保险库' };
    const e = vault.find((x) => x.key === key);
    if (!e || !e.otpSecret) return { ok: false, error: '该条目未配置 TOTP' };
    return { ok: true, ...generateTotpWithMeta(e.otpSecret, { algorithm: 'SHA1', digits: 6, period: 30 }) };
  });

  // 复制字段到剪贴板（password / username / otp），写后定时自动清空
  ipcMain.handle(
    'password-vault:copy',
    async (_e, { key, field }: { key: string; field: 'password' | 'username' | 'otp' }) => {
      if (!vault) return { ok: false, error: '未导入保险库' };
      const e = vault.find((x) => x.key === key);
      if (!e) return { ok: false, error: '条目不存在' };
      let text = '';
      if (field === 'username') text = e.username || '';
      else if (field === 'password') text = e.password || '';
      else if (field === 'otp') {
        if (!e.otpSecret) return { ok: false, error: '该条目未配置 TOTP' };
        text = generateTotpWithMeta(e.otpSecret, { algorithm: 'SHA1', digits: 6, period: 30 }).code;
      }
      const res = copyToClipboard(text);
      return { ok: res.ok, error: (res as any).error };
    },
  );

  // 新增条目（回写文件）
  ipcMain.handle(
    'password-vault:add-entry',
    async (_e, { input }: { input: Omit<VaultEntry, 'key' | 'createdAt' | 'updatedAt'> }) => {
      if (!vault) return { ok: false, error: '请先导入或新建保险库' };
      const now = new Date().toISOString();
      const entry: VaultEntry = { key: crypto.randomUUID(), createdAt: now, updatedAt: now, ...input };
      vault.push(entry);
      const wb = safeWriteBack();
      if (!wb.ok) return { ok: false, error: wb.error };
      return { ok: true, entry: toMeta(entry) };
    },
  );

  // 编辑条目（回写文件）
  ipcMain.handle(
    'password-vault:update-entry',
    async (_e, { key, patch }: { key: string; patch: Partial<VaultEntry> }) => {
      if (!vault) return { ok: false, error: '请先导入或新建保险库' };
      const idx = vault.findIndex((a) => a.key === key);
      if (idx === -1) return { ok: false, error: '条目不存在' };
      vault[idx] = { ...vault[idx], ...patch, key, updatedAt: new Date().toISOString() };
      const wb = safeWriteBack();
      if (!wb.ok) return { ok: false, error: wb.error };
      return { ok: true, entry: toMeta(vault[idx]) };
    },
  );

  // 删除条目（回写文件）
  ipcMain.handle('password-vault:delete-entry', async (_e, { key }: { key: string }) => {
    if (!vault) return { ok: false, error: '请先导入或新建保险库' };
    const before = vault.length;
    vault = vault.filter((a) => a.key !== key);
    if (vault.length === before) return { ok: false, error: '条目不存在' };
    const wb = safeWriteBack();
    if (!wb.ok) return { ok: false, error: wb.error };
    return { ok: true };
  });

  // 导出 / 另存为（可用不同口令加密到新路径，不改变当前保险库路径）
  ipcMain.handle(
    'password-vault:export',
    async (_e, { filePath, passphrase }: { filePath: string; passphrase?: string }) => {
      if (!vault) return { ok: false, error: '没有可导出的保险库' };
      try {
        writeVaultFile(filePath, vault, passphrase || vaultPass || '');
        if (passphrase) await setLastPath(filePath);
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message || String(err) };
      }
    },
  );

  // 锁定 / 退出：清空内存中的明文与口令（保留路径，便于重新解锁）
  ipcMain.handle('password-vault:lock', async () => {
    vault = null;
    vaultPass = null;
    return { ok: true };
  });
}
