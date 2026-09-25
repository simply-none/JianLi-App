import { fileURLToPath } from "node:url";
import path from "node:path";
import colors from "colors";
import { app } from "electron";

// 应用名称
export let appName = "渐离App";

// 当前文件所处目录
export const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 项目根目录
export const appRoot = path.join(__dirname, "../..");

process.env.APP_ROOT = appRoot;

// 主进程打包目录
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");

// 渲染进程打包目录
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

// 是否是开发模式
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// 不同模式下，public所处目录
export const vitePublic = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

process.env.VITE_PUBLIC = vitePublic;

// 应用PNG图标
export let appLogoPng = path.join(process.env.VITE_PUBLIC, "logo.png");

// 应用ICO图标
export let appLogoIco = path.join(process.env.VITE_PUBLIC, "logo.ico");

// 预加载文件
export const preload = path.join(__dirname, "../preload/index.mjs");

// worker.js文件路径：将其放在public目录下
export const systemInfoWorkerPath = path.join(appRoot, VITE_DEV_SERVER_URL ? "./public/worker/systemInfo.cjs" : "./dist/worker/systemInfo.cjs");
export const defaultAppWorkerPath = path.join(appRoot, VITE_DEV_SERVER_URL ? "./public/worker/defaultApp.cjs" : "./dist/worker/defaultApp.cjs");

// 右键菜单注册表写入 Worker：主线程规划好 RegOp 列表后发给它，在 worker 线程异步执行 reg/powershell，
// 不阻塞主线程（消除注册导致的鼠标/窗口卡顿）。dev 用 public/worker，打包后用 dist/worker。
export const shellMenuWorkerPath = path.join(appRoot, VITE_DEV_SERVER_URL ? "./public/worker/shellMenu.cjs" : "./dist/worker/shellMenu.cjs");

// Sherpa-Onnx TTS 合成 Worker（Kokoro / Piper 共用）：sherpa-onnx 的 OfflineTts.generate 是同步阻塞调用
// （长文本占 CPU 数百 ms~数秒），必须放 worker 线程执行，否则朗读时会冻结主进程。
// dev 用 public/worker，打包后经 vite publicDir 拷贝到 dist/worker。
export const sherpaTtsWorkerPath = path.join(appRoot, VITE_DEV_SERVER_URL ? "./public/worker/sherpa-tts.cjs" : "./dist/worker/sherpa-tts.cjs");

// 扫描进程worker
export const scanWorkerPath = path.join(vitePublic, "worker.mjs");

// 启动文件
export const indexHtml = path.join(RENDERER_DIST, "index.html");

// electron目录:getPath(name: 'home' | 'appData' | 'userData' | 'sessionData' | 'temp' | 'exe' | 'module' | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | 'recent' | 'logs' | 'crashDumps'): string;
export const logDir = app.getPath("logs");

console.log(colors.bgGreen("----------------------"));
console.log(colors.bgGreen("variables.ts"));
console.log(colors.bgGreen("----------------------"));
