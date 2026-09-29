#!/usr/bin/env node
/**
 * 手动预热 Electron 二进制（断点续传 + 重试）
 *
 * 用途：`npm run dev` / `npm install` 首次会下载 ~116MB 的 Electron 官方 zip。
 *       国内直连 GitHub 实测约 372 KB/s（要 5 分钟以上），走 npmmirror 约 5.9 MB/s（约 20 秒）。
 *       本脚本用 curl 的 `-C -` 断点续传，中断后重跑即可接着下，不会从头再来。
 *
 * 用法：
 *   node scripts/fetch-electron.cjs              # 用 package.json 里声明的 electron 版本
 *   node scripts/fetch-electron.cjs 44.4.5       # 指定版本
 *   node scripts/fetch-electron.cjs 44.4.5 win32-x64
 *
 * 下完后把它交给 @electron/get 的缓存即可（脚本会打印目标路径），
 * 之后 npm install / npm run dev 会直接命中缓存、跳过长下载。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const MIRROR = process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/';
const projectRoot = path.resolve(__dirname, '..');

function readElectronVersion() {
  const pkgPath = path.join(projectRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const raw = (pkg.dependencies && pkg.dependencies.electron) || (pkg.devDependencies && pkg.devDependencies.electron) || '';
  return raw.replace(/^[\^~>=<\s]+/, '').trim();
}

const version = process.argv[2] || readElectronVersion();
const platform = process.argv[3] || `${process.platform}-${process.arch}`;
const fileName = `electron-v${version}-${platform}.zip`;
const url = `${MIRROR}${version}/${fileName}`;

// @electron/get 的缓存目录：%LOCALAPPDATA%\electron\Cache\<sha256(url)>
// 这里不自己算哈希，改为先下到 temp，再提示手动放置，避免猜错目录结构。
const cacheRoot = process.env.ELECTRON_CACHE
  || path.join(os.homedir(), 'AppData', 'Local', 'electron', 'Cache');
const tmpDir = path.join(os.tmpdir ? os.tmpdir() : '.', 'electron-prefetch');
fs.mkdirSync(tmpDir, { recursive: true });
const outFile = path.join(tmpDir, fileName);

console.log('Electron 版本 :', version);
console.log('平台         :', platform);
console.log('镜像         :', MIRROR);
console.log('下载地址     :', url);
console.log('保存到       :', outFile);
console.log('缓存根目录   :', cacheRoot);
console.log('');

if (!fs.existsSync(outFile)) {
  console.log('开始下载（支持断点续传，中断后重跑本脚本即可）...');
} else {
  const done = fs.statSync(outFile).size;
  console.log(`检测到已有部分文件 ${(done / 1048576).toFixed(1)}MB，继续续传...`);
}

try {
  execFileSync('curl', [
    '-L',            // 跟随重定向
    '-C', '-',       // 断点续传
    '--retry', '10', // 网络抖动重试
    '--retry-delay', '3',
    '--retry-all-errors',
    '-o', outFile,
    '--progress-bar',
    url,
  ], { stdio: 'inherit' });
} catch (e) {
  console.error('\n下载未完成（可重跑本脚本继续）：', e.message);
  process.exit(1);
}

const size = fs.statSync(outFile).size;
console.log(`\n完成：${(size / 1048576).toFixed(1)}MB -> ${outFile}`);
console.log('');
console.log('下一步：把该 zip 交给 @electron/get 缓存，让 npm install 直接命中。');
console.log('最省事的做法是让 Electron 自己走镜像下载（已配好用户级 ~/.npmrc）：');
console.log('    npm install');
console.log('如果仍慢，可直接把上面的 zip 解压到 node_modules/electron/dist/ 后创建 path.txt：');
console.log('    内容为 electron.exe（Windows）');
