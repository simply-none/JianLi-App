/**
 * 开发模式：手动注册 / 反注册「通过渐离App打开」资源管理器右键菜单。
 * ------------------------------------------------------------------
 * 主进程 registerShellMenu() 启动时会自动尝试 HKLM CommandStore 级联菜单；
 * 无权限时自动 fallback 为三个 HKCU 一级菜单。本脚本用于：
 *   - 立即注册（默认 HKCU 扁平，无需管理员）
 *   - --cascading（或 --elevated）以管理员注册 HKLM 级联菜单（弹 UAC）
 *   - --unregister 移除所有相关注册表项
 *
 * 用法（在仓库根目录用 node 运行）：
 *   node scripts/register-shell-menu-dev.cjs              # HKCU 扁平（无需管理员）
 *   node scripts/register-shell-menu-dev.cjs --cascading  # HKLM 级联（需 UAC）
 *   node scripts/register-shell-menu-dev.cjs --unregister # 清理
 */
const { execFileSync, execSync } = require('node:child_process');
const path = require('node:path');

const HKCU_ROOT = 'HKCU\\Software\\Classes\\*\\shell\\JianliApp';
const HKLM_COMMANDSTORE = 'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\CommandStore\\shell';
const PARENT_NAME = '通过渐离App打开';
const SUB_COMMANDS = [
  { id: 'JianliApp.Encrypt', name: '加密到保险箱', flag: '--vault-encrypt' },
  { id: 'JianliApp.Decrypt', name: '解密(.jlv)', flag: '--vault-decrypt' },
  { id: 'JianliApp.SecureDelete', name: '安全删除', flag: '--vault-secure-delete' },
];

const appDir = path.resolve(__dirname, '..');
const exe = path.join(appDir, 'node_modules', 'electron', 'dist', 'electron.exe');
const icon = `"${exe}",0`;

function reg(args) {
  execFileSync('reg', args, { windowsHide: true, stdio: 'ignore' });
}

function deleteTree(key) {
  try { reg(['delete', key, '/f']); } catch {}
}

function buildCommand(flag) {
  return `"${exe}" "${appDir}" ${flag} "%1"`;
}

function registerCascading() {
  for (const s of SUB_COMMANDS) {
    const storeKey = `${HKLM_COMMANDSTORE}\\${s.id}`;
    deleteTree(storeKey);
    reg(['add', storeKey, '/ve', '/t', 'REG_SZ', '/d', s.name, '/f']);
    reg(['add', storeKey, '/v', 'Icon', '/t', 'REG_SZ', '/d', icon, '/f']);
    reg(['add', `${storeKey}\\command`, '/ve', '/t', 'REG_SZ', '/d', buildCommand(s.flag), '/f']);
  }
  deleteTree(HKCU_ROOT);
  reg(['add', HKCU_ROOT, '/ve', '/t', 'REG_SZ', '/d', '', '/f']);
  reg(['add', HKCU_ROOT, '/v', 'MUIVerb', '/t', 'REG_SZ', '/d', PARENT_NAME, '/f']);
  reg(['add', HKCU_ROOT, '/v', 'Icon', '/t', 'REG_SZ', '/d', icon, '/f']);
  reg(['add', HKCU_ROOT, '/v', 'SubCommands', '/t', 'REG_SZ', '/d', SUB_COMMANDS.map((s) => s.id).join(';'), '/f']);
  console.log('已注册 HKLM CommandStore 级联右键菜单「通过渐离App打开」');
}

function registerFlat() {
  deleteTree(HKCU_ROOT);
  for (const s of SUB_COMMANDS) {
    const key = `${HKCU_ROOT}.${s.id}`;
    deleteTree(key);
    reg(['add', key, '/ve', '/t', 'REG_SZ', '/d', `${PARENT_NAME}：${s.name}`, '/f']);
    reg(['add', key, '/v', 'Icon', '/t', 'REG_SZ', '/d', icon, '/f']);
    reg(['add', `${key}\\command`, '/ve', '/t', 'REG_SZ', '/d', buildCommand(s.flag), '/f']);
  }
  console.log('已注册 HKCU 扁平右键菜单（无管理员权限，显示为三个独立一级项）');
}

function unregister() {
  deleteTree(HKCU_ROOT);
  for (const s of SUB_COMMANDS) {
    deleteTree(`${HKCU_ROOT}.${s.id}`);
    deleteTree(`${HKLM_COMMANDSTORE}\\${s.id}`);
  }
  console.log('已移除资源管理器右键菜单「通过渐离App打开」');
}

function elevatedRegister() {
  // electron 启动参数：先传 appDir 作为入口，再传 --register-shell-menu-elevated 与 appDir
  const args = `"${appDir}" --register-shell-menu-elevated "${appDir}"`;
  const ps = `Start-Process -FilePath '${exe.replace(/'/g, "''")}' -ArgumentList '${args}' -Verb runAs -WindowStyle Hidden -Wait`;
  try {
    execSync(ps, { windowsHide: true, stdio: 'ignore' });
    console.log('已请求管理员权限注册 HKLM 级联菜单');
  } catch (e) {
    console.log('管理员权限请求被取消或失败，可改用无管理员模式：node scripts/register-shell-menu-dev.cjs');
    process.exit(1);
  }
}

if (process.platform !== 'win32') {
  console.log('仅 Windows 支持资源管理器右键菜单');
  process.exit(0);
}

const argv = process.argv.slice(2);
if (argv.includes('--unregister')) {
  unregister();
} else if (argv.includes('--cascading') || argv.includes('--elevated')) {
  elevatedRegister();
} else {
  registerFlat();
}
