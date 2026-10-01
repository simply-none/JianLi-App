/**
 * 电子书模块共用图片工具。
 */

/**
 * 将图片 data URL 等比压缩为「最大宽 maxWidth」的 JPEG data URL。
 * 用于书籍封面入库：原始 EPUB 封面可能数 MB，直接以 dataURL 存 SQLite 会让
 * 书架行与每次 get-bookshelf 传输显著膨胀；统一压到 ≤240px 宽（与 PDF 封面方案一致）。
 *
 * @param dataUrl 原始图片 data URL
 * @param maxWidth 目标最大宽度（px），默认 240
 * @param quality JPEG 质量 0-1，默认 0.7
 * @returns 压缩后的 data URL；解码/绘制失败或已小于目标宽度时原样返回
 */
export async function compressDataUrlImage(
  dataUrl: string,
  maxWidth = 240,
  quality = 0.7
): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片解码失败'));
      image.src = dataUrl;
    });
    if (!img.width || !img.height) return dataUrl;
    const scale = Math.min(1, maxWidth / img.width);
    // 已小于目标宽度：不重编码，避免无谓的二次有损压缩
    if (scale >= 1) return dataUrl;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return dataUrl;
    ctx2d.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL('image/jpeg', quality);
    return out && out.startsWith('data:image') ? out : dataUrl;
  } catch {
    return dataUrl;
  }
}
