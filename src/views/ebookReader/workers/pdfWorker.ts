/**
 * PDF Worker 入口。
 *
 * 通过 `GlobalWorkerOptions.workerPort` 注入此 worker，使其在「官方 pdf.js worker」
 * 启动前先打好 Uint8Array 的 toHex / fromBase64 等原生方法 polyfill，
 * 兼容 Electron 36（Chromium 134）缺失这些原生方法的环境。
 */
import './pdfPolyfill';
import 'pdfjs-dist/build/pdf.worker.min.mjs';
