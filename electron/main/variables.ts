import { fileURLToPath } from "node:url";
import path from "node:path";
import colors from "colors";

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
export let appLogoIco = path.join(process.env.VITE_PUBLIC, "favicon.ico");

// 预加载文件
export const preload = path.join(__dirname, "../preload/index.mjs");

// worker.js文件路径：将其放在public目录下
export const systemInfoWorkerPath = path.join(appRoot, VITE_DEV_SERVER_URL ? "./public/worker/systemInfo.cjs" : "./dist/worker/systemInfo.cjs");

// 扫描进程worker
export const scanWorkerPath = path.join(vitePublic, "worker.mjs");

// 启动文件
export const indexHtml = path.join(RENDERER_DIST, "index.html");

console.log(colors.bgGreen("----------------------"));
console.log(colors.bgGreen("variables.ts"));
console.log(colors.bgGreen("----------------------"));
