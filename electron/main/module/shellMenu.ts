/**
 * 资源管理器右键菜单（Windows 专属）
 * ------------------------------------------------------------------
 * 在文件右键菜单写入「通过渐离App打开」菜单，支持多类动作（按扩展名限定显示）：
 *   - 加密到保险箱   → "<exe>" --vault-encrypt "%1"        （所有文件）
 *   - 解密(.jlv)     → "<exe>" --vault-decrypt "%1"         （仅 .jlv）
 *   - 安全删除       → "<exe>" --vault-secure-delete "%1"   （所有文件）
 *   - 用渐离阅读     → "<exe>" --open-reader "%1"           （仅 .epub/.pdf/.txt，并注册打开方式 ProgID）
 *   - PDF 压缩/拆分/合并/提取附件/转图片 → "<exe>" --pdf-* "%1"（仅 .pdf）
 *   - 批量重命名     → "<exe>" --batch-rename "%1"          （所有文件）
 *
 * 设计要点：
 * - 每条命令写注册到 `HKCU\Software\Classes\<ext>\shell\JianliApp.<id>`（ext='*' 表示所有文件），
 *   无需管理员权限；按 `exts` 限定扩展名，菜单更干净。
 * - 「用渐离阅读」额外注册 ProgID `JianliApp.<ext>` 并加入 `OpenWithProgids`，使其出现在
 *   「打开方式」列表；仅在用户手动「设为默认打开」时才改扩展名默认值（可撤销，不抢占系统默认）。
 * - 用 `reg` 命令（execFile，避免 shell 引号地狱）写入，幂等覆盖；
 * - dev 模式（!app.isPackaged）也会自动注册：命令额外传入仓库目录作为 electron 启动参数；
 * - 启动参数路由：解析 --vault-* / --open-reader / --pdf-* / --batch-rename 标志并聚合文件，经 flushPending 发给渲染端。
 * - 启用集合与默认打开集合持久化到 basic_info（shellMenuEnabled / shellMenuDefaultOpen）。
 *
 * ⚠️ 改动本文件后必须重启 Electron 才生效。
 */
import { execFileSync } from 'node:child_process';
import { Worker } from 'worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { myDb } from './newSql.ts';
import { shellMenuWorkerPath } from '../variables.ts';

/** 动作类型（与注册表子命令名称、渲染端 action 对齐） */
export type CliAction =
  | 'encrypt'
  | 'decrypt'
  | 'secure-delete'
  | 'open-reader'
  | 'pdf-compress'
  | 'pdf-split'
  | 'pdf-merge'
  | 'pdf-extract-attach'
  | 'pdf-to-image'
  | 'batch-rename';

/** 右键菜单子命令定义 */
export interface SubCommand {
  /** 注册表唯一 id（ProgID 风格，避免与其它软件冲突） */
  id: string;
  /** 菜单显示名 */
  name: string;
  /** 动作（解析启动参数与渲染端路由对齐） */
  action: CliAction;
  /** 启动标志（注册表命令传入，parseCliFiles 据此映射 action） */
  flag: string;
  /** 适用的文件扩展名；含 '*' 表示所有文件 */
  exts: string[];
}

export interface CliItem {
  action: CliAction;
  files: string[];
}

const HKLM_COMMANDSTORE = 'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\CommandStore\\shell';
const PARENT_NAME = '通过渐离App打开';
const SUB_COMMANDS: SubCommand[] = [
  { id: 'JianliApp.Encrypt', name: '加密到保险箱', action: 'encrypt', flag: '--vault-encrypt', exts: ['*'] },
  { id: 'JianliApp.Decrypt', name: '解密(.jlv)', action: 'decrypt', flag: '--vault-decrypt', exts: ['.jlv'] },
  { id: 'JianliApp.SecureDelete', name: '安全删除', action: 'secure-delete', flag: '--vault-secure-delete', exts: ['*'] },
  { id: 'JianliApp.OpenReader', name: '用渐离阅读', action: 'open-reader', flag: '--open-reader', exts: ['.epub', '.pdf', '.txt'] },
  // PDF 工具箱（2026-09-11 重新启用）：注册表写入已改由 Worker 线程异步执行、不阻塞主线程，
  // 原先因拖慢启动而临时注释的 5 条 .pdf 命令现与其他右键命令一起正常注册（菜单显示「通过渐离App打开：PDF xxx」）。
  { id: 'JianliApp.PdfCompress', name: 'PDF 压缩', action: 'pdf-compress', flag: '--pdf-compress', exts: ['.pdf'] },
  { id: 'JianliApp.PdfSplit', name: 'PDF 拆分', action: 'pdf-split', flag: '--pdf-split', exts: ['.pdf'] },
  { id: 'JianliApp.PdfMerge', name: 'PDF 合并', action: 'pdf-merge', flag: '--pdf-merge', exts: ['.pdf'] },
  { id: 'JianliApp.PdfExtractAttach', name: 'PDF 提取附件', action: 'pdf-extract-attach', flag: '--pdf-extract-attach', exts: ['.pdf'] },
  { id: 'JianliApp.PdfToImage', name: 'PDF 转图片', action: 'pdf-to-image', flag: '--pdf-to-image', exts: ['.pdf'] },
  { id: 'JianliApp.BatchRename', name: '批量重命名', action: 'batch-rename', flag: '--batch-rename', exts: ['*'] },
];

// ============ 注册表操作规划（实际执行搬到 Worker 线程，避免阻塞主线程） ============
// 主线程只负责「规划」要执行的注册表操作（RegOp 列表），由 shellMenuWorker 在 worker_threads 里
// 用 execFile 异步执行；主线程事件循环全程不被冻结，彻底消除右键菜单注册导致的鼠标/窗口卡顿。

/** 一条注册表写入操作（纯数据，可序列化后发给 Worker 执行） */
export type RegOp = { cmd: 'reg' | 'powershell'; args: string[] };

/** 写入默认值（/ve） */
function regAddDefault(ops: RegOp[], key: string, value: string): void {
  ops.push({ cmd: 'reg', args: ['add', key, '/ve', '/t', 'REG_SZ', '/d', value, '/f'] });
}

/** 写入具名值（/v name） */
function regSet(ops: RegOp[], key: string, name: string, value: string): void {
  ops.push({ cmd: 'reg', args: ['add', key, '/v', name, '/t', 'REG_SZ', '/d', value, '/f'] });
}

/** 删除整棵键（含子键） */
function regDeleteTree(ops: RegOp[], key: string): void {
  ops.push({ cmd: 'reg', args: ['delete', key, '/f'] });
}

/** 业务 exe 路径（打包后为真实渐离App.exe） */
function exePath(): string {
  return process.execPath;
}

interface RegisterOptions {
  /** 是否已打包；未指定时从 app.isPackaged 读取 */
  packaged?: boolean;
  /** 开发模式下的仓库目录；未指定时从 app.getAppPath() 读取 */
  appDir?: string;
}

/** 构建单条命令字符串 */
function buildCommand(exe: string, flag: string, opts: RegisterOptions = {}): string {
  const packaged = opts.packaged ?? app.isPackaged;
  const appDir = opts.appDir ?? (packaged ? '' : app.getAppPath());
  const appArg = packaged ? '' : `"${appDir}" `;
  return `"${exe}" ${appArg}${flag} "%1"`;
}

/** 读取某键的值（name 为空表示默认值 /ve）；用于解析扩展名当前生效的 ProgID */
function regGetValue(key: string, name = ''): string | null {
  const args = ['query', key];
  if (name) args.push('/v', name);
  else args.push('/ve');
  try {
    const out = execFileSync('reg', args, {
      windowsHide: true,
      encoding: 'utf8',
    }).toString();
    const m = out.match(/REG_SZ\s+(.+)/);
    if (!m) return null;
    const val = m[1].trim();
    // reg 在「默认值未设置」时会输出本地化占位符（中文“(默认值未设置)”/英文“(value not set)”），
    // 这并非真实值，必须当作 null——否则会被误当成 ProgID 拼进注册表路径，产生
    // `HKCU\Software\Classes\(默认值未设置)\shell\...` 之类垃圾键。
    if (val === '(默认值未设置)' || val === '(value not set)' || val === '(未设置)') return null;
    return val;
  } catch {
    return null;
  }
}

/** 读取某键的默认值（用于「设为默认打开」撤销前判断当前是否本程序） */
function regGetDefault(key: string): string | null {
  return regGetValue(key, '');
}

// 启用集合 schema 版本：每当 SUB_COMMANDS 新增命令时 +1，用于一次性迁移旧存档。
// 1 = 初始仅 3 个保险箱命令；2 = 加入 open-reader / pdf-* / batch-rename 之后；
// 3 = 2026-09-11 重新启用 PDF 工具箱 5 条命令（此前临时注释，旧存档可能不含其 id，
//     故 +1 触发一次迁移让它们默认启用；迁移只重置「非传统命令」，3 个保险箱命令仍尊重用户旧开关）。
const SHELL_MENU_SCHEMA = 3;
/** 初始版本就存在的「传统」命令；其启用状态严格遵循用户旧存档。其余命令为后续新增，默认启用。 */
const LEGACY_IDS = new Set<string>([
  'JianliApp.Encrypt',
  'JianliApp.Decrypt',
  'JianliApp.SecureDelete',
]);

/**
 * 异步读取 basic_info 单行（node-sqlite3 的 db.get 是回调式，必须用 callback 收行，不能同步返回）。
 * 原实现用 myDb.db?.get?.(...) 同步取值：在 node-sqlite3 下 get 返回的是 Database 实例（链式调用），
 * 既类型报错（row.value 不存在于 Database）又运行时取不到行，导致 isShellMenuUpToDate 恒为 false、
 * 每次启动都重写注册表，并让启用集合持久化形同虚设。这里改为 Promise 包裹 callback，与 newSql 异步风格一致。
 */
function getBasicInfoRow(key: string): Promise<{ value: string } | undefined> {
  const db = myDb.db;
  if (!db) return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT value FROM basic_info WHERE key = ?',
      [key],
      (err: Error | null, row: any) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

/** 只读取出原始 shellMenuEnabled 数组（无则返回 null） */
async function readEnabledRaw(): Promise<string[] | null> {
  try {
    const row = await getBasicInfoRow('shellMenuEnabled');
    if (row && row.value) {
      const arr = JSON.parse(row.value);
      if (Array.isArray(arr)) return arr as string[];
    }
  } catch {}
  return null;
}
/** 读出当前存档的 schema 版本（缺省 0 = 升级前旧存档） */
async function readEnabledSchema(): Promise<number> {
  try {
    const row = await getBasicInfoRow('shellMenuSchema');
    if (row && row.value) {
      const n = Number(row.value);
      if (!Number.isNaN(n)) return n;
    }
  } catch {}
  return 0;
}
/** 直接写回 basic_info 键值（单行 INSERT OR REPLACE，不显式开事务）。
 *  目的：避免与启动期其它异步写操作在共享 sqlite 连接上嵌套 BEGIN，
 *  触发 "cannot start a transaction within a transaction"。单行语句会并入任何已开启的事务并随之提交。 */
function saveBasicInfoKV(key: string, value: string): void {
  const db = myDb.db;
  if (!db) return;
  db.run(
    'INSERT OR REPLACE INTO basic_info (key, value) VALUES (?, ?)',
    [key, value],
    (err) => {
      if (err) console.error('[shellMenu] saveBasicInfoKV failed:', key, err);
    }
  );
}

/** 持久化启用集合并打上当前 schema 版本（旧存档迁移后写回，使后续用户开关成为权威） */
function persistEnabledIds(ids: Iterable<string>): void {
  saveBasicInfoKV('shellMenuEnabled', JSON.stringify([...ids]));
  saveBasicInfoKV('shellMenuSchema', String(SHELL_MENU_SCHEMA));
}

// 启用集合（缓存；null 时按 basic_info 读取，缺省全部启用）
let enabledIds: Set<string> | null = null;
async function getEnabledIds(): Promise<Set<string>> {
  if (enabledIds) return enabledIds;
  const all = new Set(SUB_COMMANDS.map((s) => s.id));

  const schema = await readEnabledSchema();
  const raw = await readEnabledRaw();

  // 已迁移过的完整存档（schema 达标）：完全信任用户开关，含其手动关闭的新命令
  if (raw && raw.length && schema >= SHELL_MENU_SCHEMA) {
    enabledIds = new Set(raw.filter((id) => all.has(id)));
    return enabledIds;
  }

  // 缺省：全部启用
  const result = new Set(all);

  // 旧存档（schema 旧 / 缺失）：传统命令尊重旧开关，新增命令（open-reader/pdf-*/batch-rename）默认启用，
  // 并写回完整集合 + schema，防止升级后新增命令被漏注册导致右键菜单缺失（点击无反应）。
  if (raw && raw.length) {
    const persisted = new Set(raw);
    for (const id of LEGACY_IDS) {
      if (persisted.has(id)) result.add(id);
      else result.delete(id);
    }
    persistEnabledIds(result);
  }

  enabledIds = result;
  return enabledIds;
}
/** 异步读取「已设为默认打开」的扩展名集合 */
async function readDefaultOpen(): Promise<string[]> {
  try {
    const row = await getBasicInfoRow('shellMenuDefaultOpen');
    if (row && row.value) {
      const arr = JSON.parse(row.value);
      if (Array.isArray(arr)) return arr as string[];
    }
  } catch {}
  return [];
}

/**
 * 清理注册表残留。
 * - 不传 enabled（undefined）：删除全部（用于「反注册 / 卸载」场景）。
 * - 传入 enabled：删除「被用户禁用」的命令；
 *   启用的命令靠 registerCommandLeaf 的 idempotent `reg add /f` 覆盖，不删其正确键。
 * - **无论启用与否，始终清掉「历史双前缀」孤儿键**（早期版本误写 `JianliApp.JianliApp.x`）：
 *   该形态是纯历史 bug 残留，新版只写单前缀 `JianliApp.x`；若不清掉，两者并存会让
 *   资源管理器右键菜单出现「同名重复项」。
 * 这样把「每次启动全量 delete + 重建」降为「仅覆盖写」，省掉最贵的 tree 删除。
 */
function cleanupLegacy(ops: RegOp[], enabled?: Set<string>): void {
  if (process.platform !== 'win32') return;
  const shouldDelete = (id: string): boolean =>
    enabled === undefined ? true : !enabled.has(id);
  const targetsOf = (s: SubCommand): string[] => (s.exts.includes('*') ? ['*'] : s.exts);

  /**
   * 删除某命令在指定扩展名各 shell 父键下的动词键。
   * legacyOnly=true 时只删「历史双前缀」形态（早期版本误写 `JianliApp.JianliApp.x`）；
   * 否则同时删「正确单前缀」与「历史双前缀」两种残留（reg delete /f 删不存在的键静默失败、无副作用）。
   */
  const deleteVerb = (id: string, exts: string[], legacyOnly: boolean): void => {
    for (const ext of exts) {
      for (const parent of shellParentsFor(ext)) {
        if (!legacyOnly) regDeleteTree(ops, `${parent}\\${id}`);
        regDeleteTree(ops, `${parent}\\JianliApp.${id}`);
      }
    }
  };

  for (const s of SUB_COMMANDS) {
    const targets = targetsOf(s);
    if (shouldDelete(s.id)) {
      // 被禁用：单前缀与历史双前缀都删，并清 HKLM CommandStore 旧方案残留
      deleteVerb(s.id, targets, false);
      regDeleteTree(ops, `${HKLM_COMMANDSTORE}\\${s.id}`);
    } else {
      // 已启用：**必须**清掉历史双前缀孤儿键——新版只写单前缀，两者并存会让右键菜单出现重复项
      deleteVerb(s.id, targets, true);
    }
  }
  // 阅读器 ProgID / OpenWithProgids：仅当 open-reader 被禁用时才清理
  const reader = SUB_COMMANDS.find((s) => s.action === 'open-reader');
  if (reader && shouldDelete(reader.id)) {
    for (const ext of reader.exts) {
      regDeleteTree(ops, `HKCU\\Software\\Classes\\JianliApp.${ext}`);
      regDeleteTree(ops, `HKCU\\Software\\Classes\\${ext}\\OpenWithProgids`);
    }
  }
}

/** 解析扩展名当前生效的 ProgID：依次查 HKCU/HKLM 的 <ext> 默认值，以及现代/AppX 关联的 UserChoice.ProgId。
 *  经典静态动词写到 <ext>\shell 时，若默认 ProgID 是 AppX/现代处理程序，该动词会被系统隐藏，
 *  必须把动词写到 <ProgID>\shell 下才能显示；HKCU 可写且与 HKLM 合并，无需管理员。 */
function resolveProgId(ext: string): string | null {
  if (ext === '*') return null;
  let p = regGetValue(`HKCU\\Software\\Classes\\${ext}`);
  if (p) return p;
  p = regGetValue(`HKLM\\Software\\Classes\\${ext}`);
  if (p) return p;
  p = regGetValue(
    `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\${ext}\\UserChoice`,
    'ProgId'
  );
  return p;
}

/** 计算某扩展名应写入的「shell 父键」列表：经典 <ext>\shell 始终写入；若解析到 ProgID 则追加 <ProgID>\shell */
function shellParentsFor(ext: string): string[] {
  if (ext === '*') return [`HKCU\\Software\\Classes\\*\\shell`];
  const parents = [`HKCU\\Software\\Classes\\${ext}\\shell`];
  const progId = resolveProgId(ext);
  if (progId) parents.push(`HKCU\\Software\\Classes\\${progId}\\shell`);
  return parents;
}

/** 注册单条命令到目标扩展名（ext='*' 表示所有文件）；仅把操作推入 ops，由 Worker 执行 */
function registerCommandLeaf(ops: RegOp[], s: SubCommand, opts: RegisterOptions): void {
  if (process.platform !== 'win32') return;
  const exe = exePath();
  const icon = `"${exe}",0`;
  const targets = s.exts.includes('*') ? ['*'] : s.exts;
  for (const ext of targets) {
    for (const parent of shellParentsFor(ext)) {
      const base = `${parent}\\${s.id}`;
      regDeleteTree(ops, base);
      regAddDefault(ops, base, `${PARENT_NAME}：${s.name}`);
      regSet(ops, base, 'Icon', icon);
      regAddDefault(ops, `${base}\\command`, buildCommand(exe, s.flag, opts));
    }
  }
}

/** 注册「用渐离阅读」的打开方式 ProgID（仅出现在「打开方式」列表，不抢占系统默认） */
function registerDefaultOpenProgIds(ops: RegOp[], opts: RegisterOptions): void {
  if (process.platform !== 'win32') return;
  const reader = SUB_COMMANDS.find((s) => s.action === 'open-reader');
  if (!reader) return;
  const exe = exePath();
  for (const ext of reader.exts) {
    const progKey = `HKCU\\Software\\Classes\\JianliApp.${ext}`;
    // 幂等覆盖，无需先删
    regAddDefault(ops, progKey, '渐离App');
    regAddDefault(ops, `${progKey}\\shell\\open\\command`, buildCommand(exe, reader.flag, opts));
    // 加入「打开方式」推荐列表（不写扩展名默认值，避免抢占系统默认）
    regSet(ops, `HKCU\\Software\\Classes\\${ext}\\OpenWithProgids`, `JianliApp.${ext}`, '');
  }
}

/** 设 / 撤某扩展名的「默认打开」关联（可撤销，不破坏其它程序）；仅把操作推入 ops */
function setDefaultOpen(ops: RegOp[], ext: string, enabled: boolean): void {
  const reader = SUB_COMMANDS.find((s) => s.action === 'open-reader');
  if (!reader || !reader.exts.includes(ext)) return;
  const progId = `JianliApp.${ext}`;
  const extKey = `HKCU\\Software\\Classes\\${ext}`;
  if (enabled) {
    regAddDefault(ops, extKey, progId);
    regSet(ops, `${extKey}\\OpenWithProgids`, progId, '');
  } else if (regGetDefault(extKey) === progId) {
    ops.push({ cmd: 'reg', args: ['delete', extKey, '/ve', '/f'] });
  }
}

/**
 * 注册右键菜单：先清理历史，再按启用集合逐条注册（支持按扩展名限定），
 * 最后注册「用渐离阅读」的打开方式 ProgID；并按持久化的默认打开集合恢复双击默认。
 */
/** 通知 Explorer 刷新外壳关联缓存，否则新注册/取消的菜单项需重启资源管理器才生效（SHCNE_ASSOCCHANGED）；仅把操作推入 ops */
function notifyShellRefresh(ops: RegOp[]): void {
  if (process.platform !== 'win32') return;
  ops.push({
    cmd: 'powershell',
    args: [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Add-Type -MemberDefinition \'[DllImport("shell32.dll")] public static extern void SHChangeNotify(int wEventId,int uFlags,int dwItem1,int dwItem2);\' -Name SHN -Namespace Win32 -PassThru | ForEach-Object { $_.GetMethod("SHChangeNotify").Invoke($null, @(0x08000000,0,0,0)) }',
    ],
  });
}

/**
 * 把规划好的注册表操作交给 Worker 线程执行（不阻塞主线程）。
 * 注册表写入（reg/powershell，约上百次子进程调用）在 worker_threads 里异步跑，主线程事件循环
 * 全程不被冻结，彻底消除右键菜单注册导致的鼠标/窗口卡顿。每次启动都跑也无害。
 */
function runShellMenuWorker(ops: RegOp[]): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' || ops.length === 0) {
      resolve();
      return;
    }
    try {
      const worker = new Worker(shellMenuWorkerPath);
      worker.on('message', (msg: unknown) => {
        if (msg === 'done') {
          worker.terminate();
          resolve();
        }
      });
      worker.on('error', (err) => {
        console.error('[shellMenu] Worker 执行异常:', err);
        worker.terminate();
        resolve(); // 不阻断主流程
      });
      worker.postMessage(ops);
    } catch (e) {
      console.error('[shellMenu] 启动 Worker 失败，降级为主线程执行:', e);
      // 兜底：Worker 起不来时回退主线程（保留原行为）
      for (const op of ops) {
        try { execFileSync(op.cmd, op.args, { windowsHide: true, stdio: 'ignore' }); } catch {}
      }
      resolve();
    }
  });
}

export async function registerShellMenu(opts: RegisterOptions = {}): Promise<void> {
  const enabled = await getEnabledIds();
  const ops: RegOp[] = [];
  // 仅清理「被禁用 / 已移除」命令的残留；启用的命令走幂等覆盖，不再全量删除重建
  cleanupLegacy(ops, enabled);
  for (const s of SUB_COMMANDS) {
    if (!enabled.has(s.id)) continue;
    registerCommandLeaf(ops, s, opts);
  }
  registerDefaultOpenProgIds(ops, opts);
  for (const ext of await readDefaultOpen()) {
    setDefaultOpen(ops, ext, true);
  }
  notifyShellRefresh(ops);
  // 不再写「已注册」marker：注册表写入已由 Worker 线程异步执行，每次启动都跑也不阻塞主线程，
  // 因此无需 basic_info 的 shellMenuRegistered / shellMenuSchema 跳过逻辑。
  await runShellMenuWorker(ops);
}

/** 反注册（清理 HKCU 命令叶子、HKLM CommandStore、阅读器 ProgID 与默认值） */
export async function unregisterShellMenu(): Promise<void> {
  if (process.platform !== 'win32') return;
  const ops: RegOp[] = [];
  cleanupLegacy(ops);
  const reader = SUB_COMMANDS.find((s) => s.action === 'open-reader');
  if (reader) {
    for (const ext of [...reader.exts, ...(await readDefaultOpen())]) {
      const extKey = `HKCU\\Software\\Classes\\${ext}`;
      if (regGetDefault(extKey) === `JianliApp.${ext}`) {
        ops.push({ cmd: 'reg', args: ['delete', extKey, '/ve', '/f'] });
      }
    }
  }
}

/**
 * 以管理员身份重新注册（历史方案写入 HKLM 需要提权；现行方案注册到 HKCU 无需管理员，
 * 此处保留入口并直接调用 registerShellMenu，供设置页「重新注册」按钮复用）。
 */
export async function registerShellMenuElevated(): Promise<void> {
  if (process.platform !== 'win32') return;
  await registerShellMenu();
}

let shellMenuIpcReady = false;
/**
 * 注册右键菜单管理的 IPC（启用集合 / 默认打开 / 重新注册）。
 * 在 index.ts 应用就绪后调用一次。
 */
export function initShellMenu(): void {
  if (shellMenuIpcReady) return;
  shellMenuIpcReady = true;

  ipcMain.handle('shell-menu:get-state', async () => {
    const enabled = await getEnabledIds();
    const defaultOpen = await readDefaultOpen();
    return {
      commands: SUB_COMMANDS.map((s) => ({
        id: s.id,
        name: s.name,
        action: s.action,
        exts: s.exts,
        enabled: enabled.has(s.id),
      })),
      defaultOpen,
    };
  });

  ipcMain.on('shell-menu:set-enabled', (_e, ids: string[]) => {
    enabledIds = new Set(ids);
    persistEnabledIds(ids);
    void registerShellMenu().catch((e) => console.error('[shellMenu] set-enabled 重新注册失败:', e));
  });

  ipcMain.on('shell-menu:set-default-open', async (_e, payload: { ext: string; enabled: boolean }) => {
    if (!payload || !payload.ext) return;
    setDefaultOpen(payload.ext, !!payload.enabled);
    const cur = new Set(await readDefaultOpen());
    if (payload.enabled) cur.add(payload.ext);
    else cur.delete(payload.ext);
    saveBasicInfoKV('shellMenuDefaultOpen', JSON.stringify([...cur]));
  });

  ipcMain.on('shell-menu:reregister', () => {
    void registerShellMenu().catch((e) => console.error('[shellMenu] reregister 重新注册失败:', e));
  });
}

// ============ 启动参数解析与队列 ============

export interface ParseCliOptions {
  /** 当前 exe 路径，用于排除 argv 中的自身 */
  exePath?: string;
  /** 应用目录（dev 模式下注册表命令会传入），用于排除被误当文件的仓库目录 */
  appDir?: string;
}

/** 解析 argv：扫描启动标志，其后非选项 token 视为文件路径。
 *  显式排除 exe 路径与应用目录，防止 dev 模式把仓库目录（如 C:\cod\electron-vite-vue）当成待处理文件。
 */
export function parseCliFiles(argv: string[], opts: ParseCliOptions = {}): CliItem[] {
  const flagToAction: Record<string, CliAction> = {
    '--vault-encrypt': 'encrypt',
    '--vault-decrypt': 'decrypt',
    '--vault-secure-delete': 'secure-delete',
    '--open-reader': 'open-reader',
    '--pdf-compress': 'pdf-compress',
    '--pdf-split': 'pdf-split',
    '--pdf-merge': 'pdf-merge',
    '--pdf-extract-attach': 'pdf-extract-attach',
    '--pdf-to-image': 'pdf-to-image',
    '--batch-rename': 'batch-rename',
  };
  const items: CliItem[] = [];
  let cur: CliItem | null = null;

  const normalize = (p: string) =>
    p
      ?.replace(/\\?\"/g, '')
      .replace(/\\$/g, '')
      .toLowerCase();
  const exclude = new Set<string>();
  if (opts.exePath) exclude.add(normalize(opts.exePath));
  if (opts.appDir) exclude.add(normalize(opts.appDir));

  for (const raw of argv) {
    const a = raw.replace(/^"|"$/g, ''); // 去掉外层引号

    // 跳过 --vault-app-dir=... 等命名参数（值里可能含路径）
    if (a.startsWith('--vault-app-dir')) continue;

    if (flagToAction[a]) {
      cur = { action: flagToAction[a], files: [] };
      items.push(cur);
      continue;
    }

    if (!cur) continue; // 标志前的一切 token 都与本功能无关
    if (a.startsWith('-')) continue; // 其它 Electron/Node 选项
    if (exclude.has(normalize(a))) continue; // 排除 exe / appDir，防止误收集仓库目录

    cur.files.push(a);
  }

  // 过滤：只保留真实存在的文件（排除目录/不存在路径）。
  // 这一步是第二道保险，防止注册表/命令行解析异常把仓库目录等目录当成文件传下去。
  for (const it of items) {
    it.files = it.files.filter((f) => {
      try {
        const st = fs.statSync(path.normalize(f));
        return st.isFile();
      } catch {
        return false;
      }
    });
  }

  if (items.length) {
    console.log('[shellMenu] parsed cli items:', JSON.stringify(items), 'exclude:', [...exclude]);
  }

  return items.filter((i) => i.files.length > 0);
}

/** 跨实例聚合队列（多选文件会多次触发 second-instance，聚合成一批） */
let pending: CliItem[] = [];

/** 入队（首次启动读 process.argv，或 second-instance 携带的参数） */
export function queueCli(items: CliItem[]): void {
  if (items && items.length) pending.push(...items);
}

/** 把排队项逐条发给渲染端主窗口；发送后清空队列 */
export function flushPending(win: BrowserWindow | null): void {
  if (!win || pending.length === 0) return;
  const items = pending;
  pending = [];
  for (const it of items) {
    win.webContents.send('app:cli-open', it);
  }
}
