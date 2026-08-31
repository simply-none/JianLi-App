/**
 * PDF 工具箱主进程模块
 * 提供本地离线的 PDF 文件级操作：合并 / 拆分 / 组织页面(重排·删除·旋转·提取) / 导出图片写入。
 * 所有写操作均“另存为”新文件，绝不覆盖原文件，保证用户数据安全。
 *
 * 设计要点：
 * - 渲染端禁止 import electron/*，故所有磁盘/二进制操作经本模块 IPC 完成。
 * - 二进制操作基于 pdf-lib（直接改 PDF 字节，无需 pdf.js 渲染）。
 * - 缩略图预览与图片栅格化在渲染端用 pdf.js 完成（见 src/views/pdfTools）。
 */

import { ipcMain, dialog, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFImage, degrees, rgb, StandardFonts, PDFDict, PDFName, PDFString, PDFNumber, PDFArray, decodePDFRawStream } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { PDFFont } from 'pdf-lib';
import log from 'electron-log';

/** 单页操作描述：index 为源文件 0 基页码；rotation 为旋转角度(0/90/180/270) */
export interface OrganizePage {
  index: number;
  rotation?: number;
}

/** 拆分模式 */
export type SplitMode =
  | { type: 'range'; ranges: Array<[number, number]> } // 页码区间(闭区间,0基)
  | { type: 'everyN'; n: number } // 每 N 页一份
  | { type: 'oddEven' }; // 奇数页/偶数页各一份

/** 附件条目（PDF 内嵌文件，供阅读器「附件」面板展示与下载） */
export interface PdfAttachmentItem {
  /** 附件文件名（如 说明.txt） */
  name: string;
  /** MIME 类型，取自嵌入文件流字典的 /Subtype，可能为空串 */
  mime: string;
  /** 原始字节数（解码后） */
  size: number;
  /** base64 内容；仅内部解析与导出时填充，列表查询（get-attachments）不返回字节 */
  data?: string;
}

/** 通用结果：成功返回 success:true，失败返回 success:false + error */
interface PdfResult {
  success: boolean;
  canceled?: boolean;
  error?: string;
  outputPath?: string;
  pages?: number;
  files?: string[];
  count?: number;
  /** 附件列表（pdf:get-attachments 返回） */
  attachments?: PdfAttachmentItem[];
}

/**
 * 弹出多文件选择对话框（仅 PDF）
 * @returns { files: string[] } 或 canceled
 */
function pickFiles(): Promise<{ success: boolean; canceled?: boolean; files?: string[]; error?: string }> {
  return new Promise((resolve) => {
    dialog
      .showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
      })
      .then((res) => {
        if (res.canceled || res.filePaths.length === 0) {
          resolve({ success: false, canceled: true });
          return;
        }
        resolve({ success: true, files: res.filePaths });
      })
      .catch((err) => resolve({ success: false, error: String(err) }));
  });
}

/** 文件名净化为安全基名（去掉扩展名、剔除非法字符） */
function safeBaseName(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  return base.replace(/[\\/:*?"<>|]/g, '_') || 'document';
}

/**
 * 解析一个可用的中文字体用于 pdf-lib 写字（页码 / 页眉页脚 / 水印 / 封面标题）。
 * pdf-lib 的标准 14 字体（Helvetica 等）使用 WinAnsi 编码，无法编码中文
 * （报错 WinAnsi cannot encode "测"），因此必须嵌入一个 TrueType 中文字体。
 * pdf-lib 1.17 自定义字体需先 doc.registerFontkit(fontkit)。
 * 优先使用系统自带单文件 TTF/OTF（跳过 .ttc 字体集合，pdf-lib 不支持直接嵌入），
 * 失败则返回 null，由调用方回退标准字体（仅拉丁字符可用）。
 */
async function resolveCjkFont(doc: PDFDocument): Promise<PDFFont | null> {
  try {
    doc.registerFontkit(fontkit);
  } catch {
    /* 已注册则忽略 */
  }
  const candidates: string[] = [
    path.join(process.env.WINDIR || 'C:\\WINDOWS', 'Fonts', 'simhei.ttf'),
    path.join(process.env.WINDIR || 'C:\\WINDOWS', 'Fonts', 'simkai.ttf'),
    path.join(process.env.WINDIR || 'C:\\WINDOWS', 'Fonts', 'simfang.ttf'),
    'C:\\WINDOWS\\Fonts\\SourceHanSansCN-Regular#1.otf',
    'C:\\WINDOWS\\Fonts\\NotoSansSC-VF.ttf',
    // macOS
    '/System/Library/Fonts/STHeiti Light.ttc',
    '/Library/Fonts/Arial Unicode.ttf',
    // Linux
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
  ].filter((p) => !p.toLowerCase().endsWith('.ttc'));
  for (const fp of candidates) {
    try {
      if (!fs.existsSync(fp)) continue;
      const bytes = fs.readFileSync(fp);
      return await doc.embedFont(bytes, { subset: true });
    } catch (e) {
      log.warn('[pdf] CJK font embed failed:', fp, String(e).split('\n')[0]);
    }
  }
  return null;
}

/** 把多个源 PDF 的指定页集合拷入目标文档 */
async function copyPagesInto(out: PDFDocument, src: PDFDocument, indices: number[]): Promise<void> {
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
}

/**
 * 初始化 PDF 工具箱 IPC 通道。
 * 通道前缀 pdf:* ，渲染端经 preload 的 ipcRenderer.pdf.* 调用。
 */
export function initPdf(): void {
  // ---- 文件选择 ----
  ipcMain.handle('pdf:pick-files', async () => pickFiles());

  ipcMain.handle('pdf:pick-dir', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (res.canceled || res.filePaths.length === 0) return { success: false, canceled: true };
    return { success: true, dir: res.filePaths[0] };
  });

  // ---- 选择单个图片文件（封面等），返回绝对路径 ----
  ipcMain.handle('pdf:pick-image', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif'] }],
    });
    if (res.canceled || res.filePaths.length === 0) return { success: false, canceled: true };
    return { success: true, path: res.filePaths[0] };
  });

  ipcMain.handle('pdf:pick-save', async (_e, defaultName: string) => {
    const res = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
    });
    if (res.canceled || !res.filePath) return { success: false, canceled: true };
    return { success: true, filePath: res.filePath };
  });

  // ---- 合并 ----
  ipcMain.handle(
    'pdf:merge',
    async (_e, args: { files: string[]; outputPath: string }): Promise<PdfResult> => {
      try {
        const out = await PDFDocument.create();
        let total = 0;
        for (const f of args.files) {
          const bytes = fs.readFileSync(f);
          const doc = await PDFDocument.load(bytes);
          const indices = doc.getPageIndices();
          await copyPagesInto(out, doc, indices);
          total += indices.length;
        }
        const buf = await out.save();
        fs.writeFileSync(args.outputPath, buf);
        log.info(`[pdf] merge -> ${args.outputPath} (${total} pages)`);
        return { success: true, outputPath: args.outputPath, pages: total };
      } catch (err) {
        log.error('[pdf] merge failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 组织页面：重排 / 删除 / 旋转 / 提取（统一用 pageMap 描述最终页序） ----
  ipcMain.handle(
    'pdf:organize',
    async (_e, args: { file: string; outputPath: string; pageMap: OrganizePage[] }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const out = await PDFDocument.create();
        for (const m of args.pageMap) {
          const [page] = await out.copyPages(src, [m.index]);
          if (m.rotation) page.setRotation(degrees(m.rotation));
          out.addPage(page);
        }
        const buf = await out.save();
        fs.writeFileSync(args.outputPath, buf);
        log.info(`[pdf] organize -> ${args.outputPath} (${args.pageMap.length} pages)`);
        return { success: true, outputPath: args.outputPath, pages: args.pageMap.length };
      } catch (err) {
        log.error('[pdf] organize failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 拆分 ----
  ipcMain.handle(
    'pdf:split',
    async (_e, args: { file: string; outputDir: string; baseName: string; mode: SplitMode }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const count = src.getPageCount();
        const groups: number[][] = [];
        if (args.mode.type === 'everyN') {
          const n = Math.max(1, args.mode.n);
          for (let i = 0; i < count; i += n) {
            groups.push(Array.from({ length: Math.min(n, count - i) }, (_, k) => i + k));
          }
        } else if (args.mode.type === 'range') {
          for (const [s, e] of args.mode.ranges) {
            if (e < s) continue;
            groups.push(Array.from({ length: e - s + 1 }, (_, k) => s + k).filter((i) => i < count));
          }
        } else if (args.mode.type === 'oddEven') {
          groups.push(Array.from({ length: count }, (_, i) => i).filter((i) => i % 2 === 0)); // 奇数页(1基)
          groups.push(Array.from({ length: count }, (_, i) => i).filter((i) => i % 2 === 1)); // 偶数页(1基)
        }
      const files: string[] = [];
      // 先确保输出目录存在（渲染端传入的可能是尚不存在的子目录，如「<源>-拆分-<时间>」）
      fs.mkdirSync(args.outputDir, { recursive: true });
      // 并行拷页+写盘；序号在「同步阶段」按分组顺序预分配，避免异步竞态导致文件名与内容错位
      let seq = 0;
      await Promise.all(
        groups.map((g) => {
          if (g.length === 0) return;
          const idx = ++seq; // 同步递增（在首个 await 之前），保证后缀序号与分组(内容)顺序一致
          return (async () => {
            const out = await PDFDocument.create();
            await copyPagesInto(out, src, g);
            const buf = await out.save();
            const p = path.join(args.outputDir, `${args.baseName}_${String(idx).padStart(2, '0')}.pdf`);
            fs.writeFileSync(p, buf);
            files.push(p);
          })();
        }),
      );
      // files 入序受并行完成先后影响，按文件名(数字)重排，保证返回列表顺序与序号一致
      files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        log.info(`[pdf] split -> ${files.length} files in ${args.outputDir}`);
        return { success: true, files };
      } catch (err) {
        log.error('[pdf] split failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 写入多个文件（渲染端栅格化后的图片等） ----
  ipcMain.handle(
    'pdf:write-files',
    async (_e, args: { dir: string; files: Array<{ name: string; base64: string }> }): Promise<PdfResult> => {
      try {
        fs.mkdirSync(args.dir, { recursive: true });
        let n = 0;
        for (const f of args.files) {
          const b64 = f.base64.includes(',') ? f.base64.split(',')[1] : f.base64;
          fs.writeFileSync(path.join(args.dir, f.name), Buffer.from(b64, 'base64'));
          n++;
        }
        return { success: true, count: n };
      } catch (err) {
        log.error('[pdf] write-files failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ============ 二期 / 三期 IPC ============

  /** 阿拉伯/罗马/字母 页码格式化 */
  const formatNum = (n: number, style: 'arabic' | 'roman' | 'letter'): string => {
    if (style === 'roman') return toRoman(n);
    if (style === 'letter') return toLetter(n);
    return String(n);
  };

  // ---- 插入页面（从另一文件在指定位置插入） ----
  ipcMain.handle(
    'pdf:insert',
    async (_e, args: { file: string; outputPath: string; insertFile: string; atIndex: number; insertIndices?: number[] }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const ins = await PDFDocument.load(fs.readFileSync(args.insertFile));
        const insCount = ins.getPageCount();
        const insIdx = args.insertIndices && args.insertIndices.length ? args.insertIndices : Array.from({ length: insCount }, (_, i) => i);
        const out = await PDFDocument.create();
        const total = src.getPageCount();
        for (let i = 0; i <= total; i++) {
          if (i === args.atIndex) {
            const pages = await out.copyPages(ins, insIdx);
            pages.forEach((p) => out.addPage(p));
          }
          if (i < total) {
            const [p] = await out.copyPages(src, [i]);
            out.addPage(p);
          }
        }
        const buf = await out.save();
        fs.writeFileSync(args.outputPath, buf);
        return { success: true, outputPath: args.outputPath, pages: out.getPageCount() };
      } catch (err) {
        log.error('[pdf] insert failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 替换页面（用另一文件指定范围替换源文件一段） ----
  ipcMain.handle(
    'pdf:replace',
    async (_e, args: { file: string; outputPath: string; replaceFile: string; targetStart: number; replaceIndices?: number[] }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const rep = await PDFDocument.load(fs.readFileSync(args.replaceFile));
        const repCount = rep.getPageCount();
        const repIdx = args.replaceIndices && args.replaceIndices.length ? args.replaceIndices : Array.from({ length: repCount }, (_, i) => i);
        const out = await PDFDocument.create();
        const total = src.getPageCount();
        const removed = new Set<number>();
        for (let k = 0; k < repIdx.length; k++) removed.add(args.targetStart + k);
        for (let i = 0; i < total; i++) {
          if (i === args.targetStart) {
            const pages = await out.copyPages(rep, repIdx);
            pages.forEach((p) => out.addPage(p));
          }
          if (!removed.has(i)) {
            const [p] = await out.copyPages(src, [i]);
            out.addPage(p);
          }
        }
        const buf = await out.save();
        fs.writeFileSync(args.outputPath, buf);
        return { success: true, outputPath: args.outputPath, pages: out.getPageCount() };
      } catch (err) {
        log.error('[pdf] replace failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 复制页面（在选中页后追加其副本） ----
  ipcMain.handle(
    'pdf:duplicate',
    async (_e, args: { file: string; outputPath: string; indices: number[] }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const out = await PDFDocument.create();
        const total = src.getPageCount();
        const set = new Set(args.indices);
        for (let i = 0; i < total; i++) {
          const [p] = await out.copyPages(src, [i]);
          out.addPage(p);
          if (set.has(i)) {
            const [d] = await out.copyPages(src, [i]);
            out.addPage(d);
          }
        }
        const buf = await out.save();
        fs.writeFileSync(args.outputPath, buf);
        return { success: true, outputPath: args.outputPath, pages: out.getPageCount() };
      } catch (err) {
        log.error('[pdf] duplicate failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 裁剪白边（按四边边距裁剪 CropBox，单位 pt） ----
  ipcMain.handle(
    'pdf:crop',
    async (_e, args: { file: string; outputPath: string; margins: { left: number; right: number; top: number; bottom: number } }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const out = await PDFDocument.create();
        const total = src.getPageCount();
        const m = args.margins;
        for (let i = 0; i < total; i++) {
          const [p] = await out.copyPages(src, [i]);
          const w = p.getWidth();
          const h = p.getHeight();
          const cw = Math.max(1, w - m.left - m.right);
          const ch = Math.max(1, h - m.top - m.bottom);
          p.setCropBox(m.left, m.bottom, cw, ch);
          out.addPage(p);
        }
        const buf = await out.save();
        fs.writeFileSync(args.outputPath, buf);
        return { success: true, outputPath: args.outputPath, pages: out.getPageCount() };
      } catch (err) {
        log.error('[pdf] crop failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 页码 / 页眉 / 页脚 ----
  ipcMain.handle(
    'pdf:decorate',
    async (_e, args: {
      file: string;
      outputPath: string;
      opts: {
        pageNumbers?: { position: 'bottom-center' | 'bottom-right' | 'top-center'; start: number; style: 'arabic' | 'roman' | 'letter'; prefix?: string; suffix?: string };
        header?: { text: string };
        footer?: { text: string; divider?: boolean };
      };
    }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const out = await PDFDocument.create();
        const font = (await resolveCjkFont(out)) || (await out.embedFont(StandardFonts.Helvetica));
        const total = src.getPageCount();
        for (let i = 0; i < total; i++) {
          const [p] = await out.copyPages(src, [i]);
          const w = p.getWidth();
          const h = p.getHeight();
          const o = args.opts;
          if (o.pageNumbers) {
            const pn = o.pageNumbers;
            const text = (pn.prefix || '') + formatNum(pn.start - 1 + (i + 1), pn.style) + (pn.suffix || '');
            const size = 10;
            const tw = font.widthOfTextAtSize(text, size);
            let x = w / 2 - tw / 2;
            let y = 18;
            if (pn.position === 'bottom-right') x = w - tw - 18;
            if (pn.position === 'top-center') {
              x = w / 2 - tw / 2;
              y = h - 18;
            }
            p.drawText(text, { x, y, size, font, color: rgb(0.4, 0.4, 0.4) });
          }
          if (o.footer) {
            const size = 9;
            const tw = font.widthOfTextAtSize(o.footer.text, size);
            p.drawText(o.footer.text, { x: w / 2 - tw / 2, y: 14, size, font, color: rgb(0.4, 0.4, 0.4) });
            if (o.footer.divider) p.drawLine({ start: { x: 18, y: 26 }, end: { x: w - 18, y: 26 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
          }
          if (o.header) {
            const size = 9;
            const tw = font.widthOfTextAtSize(o.header.text, size);
            p.drawText(o.header.text, { x: w / 2 - tw / 2, y: h - 16, size, font, color: rgb(0.4, 0.4, 0.4) });
          }
          out.addPage(p);
        }
        const buf = await out.save();
        fs.writeFileSync(args.outputPath, buf);
        return { success: true, outputPath: args.outputPath, pages: out.getPageCount() };
      } catch (err) {
        log.error('[pdf] decorate failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 水印（平铺文字，近似透明度用浅色模拟） ----
  ipcMain.handle(
    'pdf:watermark',
    async (_e, args: { file: string; outputPath: string; opts: { text: string; color: [number, number, number]; angle: number; fontSize: number } }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const out = await PDFDocument.create();
        const font = (await resolveCjkFont(out)) || (await out.embedFont(StandardFonts.Helvetica));
        const col = rgb(args.opts.color[0], args.opts.color[1], args.opts.color[2]);
        const total = src.getPageCount();
        const fs2 = args.opts.fontSize;
        const stepX = Math.max(140, fs2 * 7);
        const stepY = Math.max(100, fs2 * 5);
        for (let i = 0; i < total; i++) {
          const [p] = await out.copyPages(src, [i]);
          const w = p.getWidth();
          const h = p.getHeight();
          for (let y = stepY / 2; y < h; y += stepY) {
            for (let x = stepX / 2; x < w; x += stepX) {
              p.drawText(args.opts.text, { x, y, size: fs2, font, color: col, rotate: degrees(args.opts.angle) });
            }
          }
          out.addPage(p);
        }
        const buf = await out.save();
        fs.writeFileSync(args.outputPath, buf);
        return { success: true, outputPath: args.outputPath, pages: out.getPageCount() };
      } catch (err) {
        log.error('[pdf] watermark failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 图片格式识别与嵌入（pdf-lib 仅支持 PNG/JPEG，故这里兜底自动转换） ----
  /**
   * 按文件头魔数识别真实图片格式（与扩展名无关）。
   * 扩展名不可靠：很多图片被错误命名（如 WebP/JPEG 被存成 .png），
   * 直接喂给 pdf-lib 的 embedPng/embedJpg 会报 “The input is not a PNG file!” 之类错误。
   */
  function detectImageFormat(bytes: Uint8Array): 'png' | 'jpeg' | 'gif' | 'bmp' | 'webp' | 'ico' | 'unknown' {
    if (!bytes || bytes.length < 12) return 'unknown';
    const b0 = bytes[0], b1 = bytes[1], b2 = bytes[2], b3 = bytes[3];
    // PNG: 89 50 4E 47
    if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47) return 'png';
    // JPEG: FF D8 FF
    if (b0 === 0xff && b1 === 0xd8 && b2 === 0xff) return 'jpeg';
    // GIF: 47 49 46 38 (GIF8)
    if (b0 === 0x47 && b1 === 0x49 && b2 === 0x46 && b3 === 0x38) return 'gif';
    // BMP: 42 4D (BM)
    if (b0 === 0x42 && b1 === 0x4d) return 'bmp';
    // ICO: 00 00 01 00
    if (b0 === 0x00 && b1 === 0x00 && b2 === 0x01 && b3 === 0x00) return 'ico';
    // WEBP: 52 49 46 46 (RIFF) .... 57 45 42 50 (WEBP) @offset 8
    if (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';
    return 'unknown';
  }

  /**
   * 将图片字节嵌入 PDF 页面。
   * - 真实 PNG / JPEG：直接嵌入，不做任何重编码，保真。
   * - WebP / BMP / GIF / ICO / 其它可解析格式：借 Electron 自带 nativeImage 栅格化为 PNG 再嵌入。
   *   零额外依赖（本项目 clipboard/qrcode/screenshot 模块已在使用 nativeImage）。
   * @returns pdf-lib 图像对象，可直接用于 drawImage
   */
  async function embedImageFromBytes(out: PDFDocument, bytes: Uint8Array): Promise<PDFImage> {
    // 关键：fs.readFileSync 返回的是 Node 缓冲池里的视图（可能带非 0 byteOffset，
    // 底层 ArrayBuffer 比实际内容大）。pdf-lib 的 embedPng/embedJpg 内部用
    // new DataView(imageData.buffer) 从 buffer 起点读取，会读到池里无关的垃圾字节，
    // 导致解析失败（报 “The input is not a PNG file!” / “SOI not found in JPEG”）。
    // 该问题对小文件必现、大文件偶现，是间歇性 heisenbug。这里统一转成干净的 Uint8Array 副本。
    const clean = Uint8Array.from(bytes);
    const fmt = detectImageFormat(clean);
    if (fmt === 'png') return await out.embedPng(clean);
    if (fmt === 'jpeg') return await out.embedJpg(clean);
    // 其余格式：nativeImage 转 PNG 后再嵌入
    const ni = nativeImage.createFromBuffer(Buffer.from(clean));
    if (ni.isEmpty()) {
      throw new Error(
        fmt === 'unknown'
          ? '无法识别的图片格式，请使用 PNG / JPEG / WebP / BMP / GIF 图片'
          : `暂不支持的图片格式（${fmt}），请转换为 PNG 或 JPEG 后重试`,
      );
    }
    const png = ni.toPNG();
    if (!png || png.length === 0) throw new Error('图片转换失败（nativeImage 输出为空）');
    // nativeImage 输出的 Buffer 同样可能来自缓冲池，转干净副本再嵌入
    return await out.embedPng(Uint8Array.from(png));
  }

  // ---- 添加封面页（图片铺底 / 标题文字） ----
  ipcMain.handle(
    'pdf:add-cover',
    async (_e, args: { file: string; outputPath: string; opts: { title?: string; imagePath?: string; w?: number; h?: number } }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const out = await PDFDocument.create();
        const w = args.opts.w ?? 595.28;
        const h = args.opts.h ?? 841.89;
        const cover = out.addPage([w, h]);
        if (args.opts.imagePath) {
          // 按文件头魔数识别真实格式并嵌入（扩展名不可靠，见 detectImageFormat 注释）
          const bytes = fs.readFileSync(args.opts.imagePath);
          const img = await embedImageFromBytes(out, bytes);
          cover.drawImage(img, { x: 0, y: 0, width: w, height: h });
        }
        if (args.opts.title) {
          const titleFont = (await resolveCjkFont(out)) || (await out.embedFont(StandardFonts.HelveticaBold));
          const size = 28;
          const tw = titleFont.widthOfTextAtSize(args.opts.title, size);
          cover.drawText(args.opts.title, { x: w / 2 - tw / 2, y: h / 2, size, font: titleFont, color: rgb(0.2, 0.2, 0.2) });
        }
        const total = src.getPageCount();
        for (let i = 0; i < total; i++) {
          const [p] = await out.copyPages(src, [i]);
          out.addPage(p);
        }
        const buf = await out.save();
        fs.writeFileSync(args.outputPath, buf);
        return { success: true, outputPath: args.outputPath, pages: out.getPageCount() };
      } catch (err) {
        log.error('[pdf] add-cover failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 统一页面尺寸（等比缩放内容 + 重设页面框） ----
  ipcMain.handle(
    'pdf:resize',
    async (_e, args: { file: string; outputPath: string; size: { w: number; h: number } }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const out = await PDFDocument.create();
        const total = src.getPageCount();
        for (let i = 0; i < total; i++) {
          const [p] = await out.copyPages(src, [i]);
          const sw = p.getWidth();
          const sh = p.getHeight();
          p.scale(args.size.w / sw, args.size.h / sh);
          p.setSize(args.size.w, args.size.h);
          out.addPage(p);
        }
        const buf = await out.save();
        fs.writeFileSync(args.outputPath, buf);
        return { success: true, outputPath: args.outputPath, pages: out.getPageCount() };
      } catch (err) {
        log.error('[pdf] resize failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 展平标注（annotations → 内容层，不可逆） ----
  ipcMain.handle(
    'pdf:flatten',
    async (_e, args: { file: string; outputPath: string }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const out = await PDFDocument.create();
        const total = src.getPageCount();
        for (let i = 0; i < total; i++) {
          const [p] = await out.copyPages(src, [i]);
          try {
            p.flatten();
          } catch (e) {
            log.warn('[pdf] flatten page', i, 'failed', e);
          }
          out.addPage(p);
        }
        const buf = await out.save();
        fs.writeFileSync(args.outputPath, buf);
        return { success: true, outputPath: args.outputPath, pages: out.getPageCount() };
      } catch (err) {
        log.error('[pdf] flatten failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 压缩减体（best-effort：重新生成 + 对象流；深度图片重编码需额外引擎） ----
  ipcMain.handle(
    'pdf:compress',
    async (_e, args: { file: string; outputPath: string }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const buf = await src.save({ useObjectStreams: true });
        fs.writeFileSync(args.outputPath, buf);
        return { success: true, outputPath: args.outputPath, pages: src.getPageCount() };
      } catch (err) {
        log.error('[pdf] compress failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 密文遮盖（永久涂黑：整页或指定矩形） ----
  ipcMain.handle(
    'pdf:redact',
    async (_e, args: { file: string; outputPath: string; opts: { mode: 'whole' | 'rects'; pages?: number[]; rects?: number[][] } }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const out = await PDFDocument.create();
        const total = src.getPageCount();
        const target = new Set(args.opts.pages ?? []);
        for (let i = 0; i < total; i++) {
          const [p] = await out.copyPages(src, [i]);
          const w = p.getWidth();
          const h = p.getHeight();
          if (args.opts.mode === 'whole' && (target.size === 0 || target.has(i))) {
            p.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(0, 0, 0) });
          } else if (args.opts.mode === 'rects' && args.opts.rects) {
            for (const r of args.opts.rects) {
              const [xt, yt, ww, hh] = r; // 左上角坐标 + 宽高（pt）
              p.drawRectangle({ x: xt, y: h - (yt + hh), width: ww, height: hh, color: rgb(0, 0, 0) });
            }
          }
          out.addPage(p);
        }
        const buf = await out.save();
        fs.writeFileSync(args.outputPath, buf);
        return { success: true, outputPath: args.outputPath, pages: out.getPageCount() };
      } catch (err) {
        log.error('[pdf] redact failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 加密 / 解密：pdf-lib 不支持，需外部引擎（qpdf）；诚实提示，不伪造 ----
  ipcMain.handle('pdf:encrypt', async () => ({
    success: false,
    error: 'PDF 加密/解密依赖外部引擎 qpdf，当前应用未内置该能力。如需启用可后续集成 qpdf 二进制。',
  }));
  ipcMain.handle('pdf:decrypt', async () => ({
    success: false,
    error: 'PDF 加密/解密依赖外部引擎 qpdf，当前应用未内置该能力。如需启用可后续集成 qpdf 二进制。',
  }));

  // ---- 页面标签（pdf-lib 1.17 未暴露 setPageLabels，故走底层 /Labels 数字树） ----
  ipcMain.handle(
    'pdf:page-labels',
    async (_e, args: { file: string; outputPath: string; labels: Array<{ start: number; style: 'decimal' | 'upperRoman' | 'lowerRoman' | 'upperLetter' | 'lowerLetter'; prefix?: string; startNum?: number }> }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const styleMap: Record<string, string> = {
          decimal: 'D',
          upperRoman: 'R',
          lowerRoman: 'r',
          upperLetter: 'A',
          lowerLetter: 'a',
        };
        // 注意：lookup() 必须传「键名(PDFName)」，而不是 get() 的返回值(PDFRef)。
        // 早期写法 src.catalog.lookup(src.catalog.get(PDFName.of('Pages'))) 把引用喂给 lookup，
        // 解析结果恒为 undefined，导致下面 pages.set() 抛 "Cannot read properties of undefined (reading 'set')"。
        const pages = src.catalog.lookup(PDFName.of('Pages')) as PDFDict;
        if (!pages) throw new Error('未找到页面树 /Pages，无法设置页面标签');
        const nums = PDFArray.withContext(src.context);
        for (const l of args.labels) {
          nums.push(PDFNumber.of(l.start));
          const d = PDFDict.withContext(src.context);
          d.set(PDFName.of('S'), PDFName.of(styleMap[l.style] ?? 'D'));
          if (l.prefix) d.set(PDFName.of('P'), PDFString.of(l.prefix));
          if (l.startNum != null) d.set(PDFName.of('St'), PDFNumber.of(l.startNum));
          nums.push(d);
        }
        const labelsDict = PDFDict.withContext(src.context);
        labelsDict.set(PDFName.of('Nums'), nums);
        pages.set(PDFName.of('Labels'), labelsDict);
        const buf = await src.save();
        fs.writeFileSync(args.outputPath, buf);
        return { success: true, outputPath: args.outputPath, pages: src.getPageCount() };
      } catch (err) {
        log.error('[pdf] page-labels failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 嵌入附件（pdf-lib attach：data 可为 base64 / Uint8Array） ----
  ipcMain.handle(
    'pdf:attach',
    async (_e, args: { file: string; outputPath: string; data: string | Uint8Array; fileName: string; mime?: string }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const raw =
          typeof args.data === 'string'
            ? Buffer.from(args.data.includes(',') ? args.data.split(',')[1] : args.data, 'base64')
            : args.data;
        await src.attach(raw as any, args.fileName, { mimeType: args.mime });
        const buf = await src.save();
        fs.writeFileSync(args.outputPath, buf);
        return { success: true, outputPath: args.outputPath, pages: src.getPageCount() };
      } catch (err) {
        log.error('[pdf] attach failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 读取嵌入附件列表（供 PDF 阅读器「附件」面板展示） ----
  // 说明：pdf-lib 1.17 无公开的 getAttachments，故走底层 /Names /EmbeddedFiles 名称树解析。
  // 列表只回传元信息（不含字节内容），避免把可能很大的附件全量送过 IPC；下载另走 pdf:extract-attachment。
  ipcMain.handle(
    'pdf:get-attachments',
    async (_e, args: { file: string }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const items = readEmbeddedFiles(src);
        const attachments = items.map(({ name, mime, size }) => ({ name, mime, size }));
        return { success: true, attachments, count: attachments.length };
      } catch (err) {
        log.error('[pdf] get-attachments failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ---- 导出（另存）指定嵌入附件到磁盘（按列表索引定位，避免重名附件歧义） ----
  ipcMain.handle(
    'pdf:extract-attachment',
    async (_e, args: { file: string; index: number; outputPath: string }): Promise<PdfResult> => {
      try {
        const src = await PDFDocument.load(fs.readFileSync(args.file));
        const items = readEmbeddedFiles(src);
        const item = items[args.index];
        if (!item) return { success: false, error: '未找到指定附件（索引可能已失效）' };
        fs.writeFileSync(args.outputPath, Buffer.from(item.data || '', 'base64'));
        return { success: true, outputPath: args.outputPath, count: 1 };
      } catch (err) {
        log.error('[pdf] extract-attachment failed:', err);
        return { success: false, error: String(err) };
      }
    },
  );

  log.info('[pdf] PDF 工具箱 IPC 已注册');
}

/**
 * 解析 PDF 文档内嵌的附件文件（/Names /EmbeddedFiles 名称树）
 *
 * pdf-lib 1.17 未暴露 getAttachments，故直接遍历底层名称树，结构为：
 *   /Names → /EmbeddedFiles → （可能是 /Kids 多叉树）→ 叶子节点的 /Names 数组
 *   叶子 /Names 是扁平键值对：[名称1, 文件说明1, 名称2, 文件说明2, ...]
 *   文件说明(Filespec) → /EF → /F 指向真正的嵌入文件流（通常带 FlateDecode 过滤）
 *
 * @param src - 已加载的 PDFDocument
 * @returns 附件条目数组（顺序稳定，供列表展示与按索引导出）；无嵌入附件时返回空数组
 */
function readEmbeddedFiles(src: PDFDocument): PdfAttachmentItem[] {
  const ctx = src.context;
  // /Names 或 /EmbeddedFiles 缺失 => 该 PDF 没有嵌入附件，视为空列表而非错误
  const names = src.catalog.lookup(PDFName.of('Names')) as PDFDict | undefined;
  const efEntry = names && names.get(PDFName.of('EmbeddedFiles'));
  if (!efEntry) return [];

  // 递归收集所有含 /Names 的叶子节点（depth 上限防止循环引用导致死循环）
  const leaves: PDFDict[] = [];
  const walk = (node: any, depth: number): void => {
    if (!node || depth > 32) return;
    const dict = ctx.lookup(node) as PDFDict;
    if (!dict || typeof dict.get !== 'function') return;
    const kids = dict.get(PDFName.of('Kids'));
    if (kids) {
      const kidsArr = ctx.lookup(kids) as PDFArray;
      for (let i = 0; i < kidsArr.size(); i += 1) walk(kidsArr.get(i), depth + 1);
    } else if (dict.get(PDFName.of('Names'))) {
      leaves.push(dict);
    }
  };
  walk(efEntry, 0);

  const items: PdfAttachmentItem[] = [];
  for (const leaf of leaves) {
    const pairs = ctx.lookup(leaf.get(PDFName.of('Names'))) as PDFArray;
    for (let i = 0; i + 1 < pairs.size(); i += 2) {
      const name = unescapePdfText(pdfObjectText(ctx.lookup(pairs.get(i))));
      const filespec = ctx.lookup(pairs.get(i + 1)) as PDFDict;
      const efDict = ctx.lookup(filespec.get(PDFName.of('EF'))) as PDFDict;
      const streamRef = efDict && efDict.get(PDFName.of('F'));
      if (!streamRef) continue;
      const stream = ctx.lookup(streamRef) as any;
      // 嵌入文件流通常带 FlateDecode 过滤，必须按过滤器解码后才是原始字节
      const bytes = decodePDFRawStream(stream).decode();
      // MIME 取自嵌入文件流字典的 /Subtype（pdf-lib 会写入，如 text/plain）
      const streamDict = stream && stream.dict;
      const mime = unescapePdfText(
        pdfObjectText(streamDict ? ctx.lookup(streamDict.get(PDFName.of('Subtype'))) : null)
      );
      items.push({
        name: name || `附件${items.length + 1}`,
        mime,
        size: bytes.length,
        data: Buffer.from(bytes).toString('base64'),
      });
    }
  }
  return items;
}

/**
 * 取 PDF 字符串 / 名称对象的文本内容（兼容 PDFString 与 PDFName）
 * @param obj - 可能为 PDFString / PDFName / null 的对象
 * @returns 文本；无法识别时返回空串
 */
function pdfObjectText(obj: unknown): string {
  if (!obj) return '';
  const o = obj as { decodeText?: () => string; asString?: () => string };
  if (typeof o.decodeText === 'function') return o.decodeText();
  if (typeof o.asString === 'function') return o.asString().replace(/^\//, '');
  return '';
}

/**
 * 还原 PDF 名称中的 #XX 十六进制转义（如 text#2Fplain → text/plain）
 * @param s - 可能含 #XX 转义的文本
 * @returns 还原后的文本
 */
function unescapePdfText(s: string): string {
  return (s || '').replace(/#([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** 阿拉伯数字转罗马数字 */
function toRoman(n: number): string {
  if (n <= 0) return '0';
  const map: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let r = '';
  let v = n;
  for (const [val, sym] of map) {
    while (v >= val) {
      r += sym;
      v -= val;
    }
  }
  return r;
}

/** 数字转字母序号（1=A,26=Z,27=AA） */
function toLetter(n: number): string {
  let s = '';
  let v = n;
  while (v > 0) {
    const rem = (v - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    v = Math.floor((v - 1) / 26);
  }
  return s || 'A';
}
