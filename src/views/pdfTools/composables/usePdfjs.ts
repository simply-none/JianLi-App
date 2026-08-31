/**
 * PDF.js 封装（渲染端）：复用电子书阅读器已有的 worker + polyfill 基建生成页面缩略图。
 * - 缩略图/栅格化需要 pdf.js 渲染能力；pdf-lib 只负责二进制操作，不做渲染。
 * - worker 经 GlobalWorkerOptions.workerPort 注入，配合 pdfPolyfill 适配低版本 Chromium。
 */
import * as pdfjsLib from 'pdfjs-dist';
// 主线程 realm 补 polyfill（getOrInsertComputed 等），与 worker realm 内补丁对应
import '@/views/ebookReader/workers/pdfPolyfill';

let workerPort: Worker | null = null;

/** 确保 pdf.js worker 仅创建一次（复用电子书阅读器的 worker wrapper） */
function ensureWorker(): void {
  if (pdfjsLib.GlobalWorkerOptions.workerPort) return;
  // 相对路径指向电子书阅读器的 worker wrapper（已内含 polyfill + 官方 worker）
  workerPort = new Worker(new URL('../../ebookReader/workers/pdfWorker.ts', import.meta.url), {
    type: 'module',
  });
  pdfjsLib.GlobalWorkerOptions.workerPort = workerPort;
}

/** 从 base64 解码为 Uint8Array */
function base64ToBytes(base64: string): Uint8Array {
  const b = base64.includes(',') ? base64.split(',')[1] : base64;
  const bin = atob(b);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * 加载 PDF 文档（传入 base64 或 Uint8Array）
 * @returns pdf.js 文档对象（类型用 any 以规避 pdf.js v6 版本间结构差异）
 */
export async function loadPdf(data: string | Uint8Array): Promise<any> {
  ensureWorker();
  const bytes = typeof data === 'string' ? base64ToBytes(data) : data;
  return pdfjsLib.getDocument({ data: bytes }).promise;
}

/**
 * 渲染单页为图片 dataURL（用于缩略图或导出）
 * @param page pdf.js 页面对象
 * @param targetWidth 目标宽度（px），按比例缩放
 * @param format 'image/png' | 'image/jpeg'
 */
export async function renderPageToImage(
  page: any,
  targetWidth: number,
  format: 'image/png' | 'image/jpeg' = 'image/png',
): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  const scale = targetWidth / base.width;
  const viewport = page.getViewport({ scale });
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
  }).promise;
  return canvas.toDataURL(format, format === 'image/jpeg' ? 0.92 : undefined);
}

export { pdfjsLib };

/**
 * 空白页检测（渲染端，基于 pdf.js 栅格化）
 * 将每页渲染为低分辨率位图，统计接近白色的像素占比；超过阈值视为空白页。
 * @param doc pdf.js 文档对象
 * @param threshold 非白像素占比阈值(0~1)，低于该值判定为空白；默认 0.012
 * @returns 空白页的 0 基页码数组
 */
export async function findBlankPages(doc: any, threshold = 0.012): Promise<number[]> {
  const total = doc.numPages as number;
  const blank: number[] = [];
  for (let i = 1; i <= total; i++) {
    try {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let dark = 0;
      const px = data.length / 4;
      // 每 4 个分量取一个采样即可，亚采样提升速度
      for (let p = 0; p < data.length; p += 16) {
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        // 非白（与纯白差异显著）即计入
        if (r < 248 || g < 248 || b < 248) dark++;
      }
      const ratio = dark / (px / 4);
      if (ratio < threshold) blank.push(i - 1);
    } catch (e) {
      console.warn('[pdf] blank-detect page', i, 'failed', e);
    }
  }
  return blank;
}

/**
 * 读取本地文件为 base64（渲染端，仅用于把附件/封面字节传给主进程 IPC）
 * @param file 来自 <input type=file> 的 File
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
