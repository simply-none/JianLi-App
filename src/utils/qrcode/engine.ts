/**
 * 二维码生成引擎 —— 唯一接触 qr-code-styling 的文件。
 * ------------------------------------------------------------------
 * - 渲染端专用（依赖 DOM / Canvas）。
 * - 动态导入 qr-code-styling（UMD，无 ESM 入口，靠 Vite CJS interop），
 *   并通过 `.default ?? mod` 防御不同打包形态。
 * - 关键：data 在喂给库前必须 toUtf8Data 修正，否则中文乱码。
 *
 * Logo 合成说明：
 * qr-code-styling 原生仅支持「居中」Logo，无法满足「右下角 / 形状 / 投影」需求。
 * 因此本引擎统一**先渲染无 Logo 的二维码，再用 canvas 2D 把 Logo 二次合成**，
 * 支持 居中 / 右下角 定位、方形 / 圆角 / 圆形 裁切、以及边框投影。
 * 居中时先铺一块与背景同色的圆角底，模拟原生 hideBackgroundDots，保证可扫。
 */
import type { QrRenderResult, QrStyleOptions, QrGradient } from './types';
import { toUtf8Data } from './encoding';
import { getShapeOption } from './shapes';

let QRCodeStylingCtor: any = null;

async function loadQrStyling(): Promise<any> {
  if (QRCodeStylingCtor) return QRCodeStylingCtor;
  const mod: any = await import('qr-code-styling');
  QRCodeStylingCtor = mod.default ?? mod;
  if (typeof QRCodeStylingCtor !== 'function') {
    throw new Error('qr-code-styling 加载失败：未找到构造函数');
  }
  return QRCodeStylingCtor;
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Blob 转 DataURL 失败'));
    reader.readAsDataURL(blob);
  });
}

function toGradient(g?: QrGradient): any {
  if (!g || !g.colorStops || !g.colorStops.length) return undefined;
  return {
    type: g.gradientType ?? 'linear',
    rotation: g.rotation ?? 0,
    colorStops: g.colorStops,
  };
}

/** 圆角矩形路径（radius 自动收敛到宽高一半，避免负值/溢出） */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

interface LogoComposeOptions {
  shape: 'square' | 'rounded' | 'circle';
  sizeRatio: number; // logo 占二维码比例
  position: 'center' | 'bottom-right';
  shadow: boolean;
  bgColor: string; // 居中时底遮罩颜色
}

/**
 * 把 Logo 合成到已渲染的二维码 PNG 上，返回新 PNG Blob。
 * 居中：先铺一块与背景同色的圆角底遮住码点（模拟 hideBackgroundDots）；
 * 右下角：直接贴在右下留白处。
 * 形状：先用离屏画布把 Logo 裁成 方形/圆角/圆形，再整体贴图以获得正确的外部投影。
 */
async function composeLogo(
  qrDataUrl: string,
  logoDataUrl: string,
  opts: LogoComposeOptions,
  size: number,
): Promise<Blob | null> {
  try {
    const [qrImg, logoImg] = await Promise.all([
      loadImage(qrDataUrl),
      loadImage(logoDataUrl),
    ]);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1) 底图（二维码）
    ctx.drawImage(qrImg, 0, 0, size, size);

    // 2) Logo 尺寸与位置
    const logoSize = Math.round(size * clamp(opts.sizeRatio, 0.1, 0.4));
    const isCenter = opts.position === 'center';
    const pad = size * 0.06;
    const x = isCenter ? (size - logoSize) / 2 : size - logoSize - pad;
    const y = isCenter ? (size - logoSize) / 2 : size - logoSize - pad;
    const radius = opts.shape === 'circle' ? logoSize / 2 : logoSize * 0.16;

    // 居中时在 Logo 下方先铺同色圆角底，提升可扫性
    if (isCenter) {
      const bgPad = logoSize * 0.14;
      roundRectPath(
        ctx,
        x - bgPad,
        y - bgPad,
        logoSize + bgPad * 2,
        logoSize + bgPad * 2,
        opts.shape === 'circle' ? (logoSize + bgPad * 2) / 2 : logoSize * 0.2,
      );
      ctx.fillStyle = opts.bgColor || '#ffffff';
      ctx.fill();
    }

    // 3) 离屏画布：把 Logo 裁成目标形状
    const off = document.createElement('canvas');
    off.width = logoSize;
    off.height = logoSize;
    const octx = off.getContext('2d');
    if (!octx) return null;
    roundRectPath(octx, 0, 0, logoSize, logoSize, radius);
    octx.clip();
    octx.drawImage(logoImg, 0, 0, logoSize, logoSize);

    // 4) 贴 Logo（带投影）
    ctx.save();
    if (opts.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = Math.max(4, logoSize * 0.08);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.max(2, logoSize * 0.04);
    }
    ctx.drawImage(off, x, y);
    ctx.restore();

    // 5) 白色描边，增强与底图边界
    ctx.save();
    roundRectPath(ctx, x, y, logoSize, logoSize, radius);
    ctx.lineWidth = Math.max(1, logoSize * 0.02);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.stroke();
    ctx.restore();

    const out = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), 'image/png'),
    );
    return out;
  } catch {
    return null;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

export interface RenderQrOptions extends QrStyleOptions {
  /** 二维码内容（原始文本，未编码） */
  data: string;
  /** 像素尺寸，默认 320 */
  size?: number;
  /** 输出类型，默认 canvas（PNG） */
  type?: 'canvas' | 'svg';
}

/**
 * 生成二维码，返回 PNG dataURL（供保存 / 复制 / 渲染）。
 * @throws 当库未加载或图像生成失败时抛出
 */
export async function renderQr(options: RenderQrOptions): Promise<QrRenderResult> {
  const QRCodeStyling = await loadQrStyling();
  const size = options.size ?? 320;
  const style = options;

  // 形状联动：若设定了统一形状，则覆盖码点/码眼类型
  const shapeOpt = getShapeOption(style.shape);
  const dotsType = shapeOpt?.dot ?? style.dotsType ?? 'rounded';
  const cornersSquareType = shapeOpt?.cornerSquare ?? style.cornersSquareType ?? 'extra-rounded';
  const cornersDotType = shapeOpt?.cornerDot ?? style.cornersDotType ?? 'square';

  const config: any = {
    width: size,
    height: size,
    type: options.type ?? 'canvas',
    // 关键：中文等多字节字符 UTF-8 修正，否则扫码乱码
    data: toUtf8Data(options.data),
    margin: style.margin ?? 8,
    qrOptions: {
      errorCorrectionLevel: style.errorCorrectionLevel ?? 'M',
    },
    dotsOptions: {
      type: dotsType,
      ...(style.dotsGradient
        ? { gradient: toGradient(style.dotsGradient) }
        : { color: style.dotsColor ?? '#000000' }),
    },
    cornersSquareOptions: {
      type: cornersSquareType,
      ...(style.cornersSquareGradient
        ? { gradient: toGradient(style.cornersSquareGradient) }
        : { color: style.cornersSquareColor ?? style.dotsColor ?? '#000000' }),
    },
    cornersDotOptions: {
      type: cornersDotType,
      ...(style.cornersDotGradient
        ? { gradient: toGradient(style.cornersDotGradient) }
        : { color: style.cornersDotColor ?? style.dotsColor ?? '#000000' }),
    },
    backgroundOptions: style.backgroundGradient
      ? { gradient: toGradient(style.backgroundGradient) }
      : { color: style.background ?? '#ffffff' },
    // 注意：Logo 不走库原生（仅居中），统一在下方用 canvas 二次合成
  };

  const instance = new QRCodeStyling(config);
  let blob = (await instance.getRawData('png')) as Blob | null;
  if (!blob) throw new Error('二维码生成失败：未返回图像数据');

  // Logo 合成（支持 右下角 / 形状 / 投影）
  if (style.logo) {
    const qrDataUrl = await blobToDataURL(blob);
    const composed = await composeLogo(
      qrDataUrl,
      style.logo,
      {
        shape: style.logoShape ?? 'square',
        sizeRatio: style.logoSize ?? 0.25,
        position: style.logoPosition ?? 'center',
        shadow: style.logoShadow ?? false,
        bgColor: style.background ?? '#ffffff',
      },
      size,
    );
    if (composed) {
      return { dataUrl: await blobToDataURL(composed), raw: composed };
    }
    // 合成失败时退回原始（无 Logo）二维码，保证可用
    return { dataUrl: qrDataUrl, raw: blob };
  }

  const dataUrl = await blobToDataURL(blob);
  return { dataUrl, raw: blob };
}
