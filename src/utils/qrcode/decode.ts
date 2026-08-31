/**
 * 二维码识别引擎 —— 唯一接触 jsqr 的文件。
 * ------------------------------------------------------------------
 * - 渲染端专用（依赖 Canvas / ImageData）。
 * - 支持从 HTMLImageElement / HTMLCanvasElement / ImageData / dataURL / File 识别。
 * - 多尺度重试：jsQR 对小图 / 大图有时定位失败，依次按 1x / 2x / 3x / 4x 重绘后重试。
 * - jsQR 的 result.data 本身已是 UTF-8 解码后的字符串；必要时用 result.binaryData
 *   经 bytesToUtf8 一次性还原（与 engine 的 toUtf8Data 精确互逆），严禁二次解码。
 */
import type { QrDecodeResult, QrPayloadType } from './types';
import { bytesToUtf8 } from './encoding';
import { parsePayload } from './parse';

let jsQRCtor: any = null;

async function loadJsQR(): Promise<any> {
  if (jsQRCtor) return jsQRCtor;
  const mod: any = await import('jsqr');
  // jsqr 的 UMD 导出既是函数又带 .default，防御两种形态
  jsQRCtor = mod.default ?? mod;
  if (typeof jsQRCtor !== 'function') {
    throw new Error('jsqr 加载失败：未找到构造函数');
  }
  return jsQRCtor;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d')!.putImageData(imageData, 0, 0);
  return canvas;
}

async function toImageData(
  source: HTMLImageElement | HTMLCanvasElement | ImageData | string | File,
): Promise<ImageData> {
  if (source instanceof ImageData) return source;
  if (source instanceof HTMLCanvasElement) {
    const ctx = source.getContext('2d');
    if (!ctx) throw new Error('无法获取 Canvas 上下文');
    return ctx.getImageData(0, 0, source.width, source.height);
  }
  if (source instanceof HTMLImageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth || source.width;
    canvas.height = source.naturalHeight || source.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 Canvas 上下文');
    ctx.drawImage(source, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
  // string(dataURL) / File
  const src = typeof source === 'string' ? source : await fileToDataURL(source);
  const img = await loadImageElement(src);
  return toImageData(img);
}

function tryDecode(imageData: ImageData): { data: string; bytes: number[] } | null {
  const data = imageData.data as unknown as Uint8ClampedArray;
  const result = jsQRCtor(data, imageData.width, imageData.height);
  if (!result) return null;
  // binaryData = 原始字节；data = jsQR 已 UTF-8 解码的字符串（二者取其一）
  return { data: result.data ?? '', bytes: (result.binaryData as number[]) ?? [] };
}

function detectTypeLocal(text: string): QrPayloadType {
  const t = text.trim();
  if (t.startsWith('WIFI:')) return 'wifi';
  if (t.startsWith('BEGIN:VCARD')) return 'contact';
  if (t.startsWith('BEGIN:VEVENT')) return 'event';
  if (/^mailto:/i.test(t)) return 'email';
  if (/^SMSTO:/i.test(t) || /^smsto:/i.test(t)) return 'sms';
  if (/^tel:/i.test(t)) return 'tel';
  if (/^geo:/i.test(t)) return 'geo';
  if (/^https?:\/\//i.test(t) || /^[\w-]+:\/\//i.test(t)) return 'url';
  return 'text';
}

/**
 * 识别图片中的二维码。
 * @param source 图片来源：HTMLImageElement / HTMLCanvasElement / ImageData / dataURL 字符串 / File
 */
export async function decodeQr(
  source: HTMLImageElement | HTMLCanvasElement | ImageData | string | File,
): Promise<QrDecodeResult> {
  try {
    await loadJsQR();
    const original = await toImageData(source);

    // 多尺度重试：原图 + 2x / 3x / 4x 重绘提升模糊 / 小图定位成功率
    const scales = [1, 2, 3, 4];
    for (const scale of scales) {
      let target: ImageData = original;
      if (scale !== 1) {
        const w = Math.max(1, Math.floor(original.width * scale));
        const h = Math.max(1, Math.floor(original.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(imageDataToCanvas(original), 0, 0, w, h);
        target = ctx.getImageData(0, 0, w, h);
      }
      const raw = tryDecode(target);
      if (raw) {
        // 优先用 jsQR 已解码的字符串；异常时回退到原始字节手动 UTF-8 解码
        const data = raw.data && raw.data.length > 0 ? raw.data : bytesToUtf8(raw.bytes);
        return {
          ok: true,
          data,
          type: detectTypeLocal(data),
          payload: parsePayload(data),
        };
      }
    }
    return { ok: false, error: '未检测到二维码' };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}
