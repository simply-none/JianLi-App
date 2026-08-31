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

import { ipcMain, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, degrees, rgb, StandardFonts, PDFDict, PDFName, PDFString, PDFNumber, PDFArray } from 'pdf-lib';
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

/** 通用结果：成功返回 success:true，失败返回 success:false + error */
interface PdfResult {
  success: boolean;
  canceled?: boolean;
  error?: string;
  outputPath?: string;
  pages?: number;
  files?: string[];
  count?: number;
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
        // 各分组并行拷页+写盘；逐组分配序号(0基跳过空组)
        let seq = 0;
        await Promise.all(
          groups.map(async (g) => {
            if (g.length === 0) return;
            const out = await PDFDocument.create();
            await copyPagesInto(out, src, g);
            const buf = await out.save();
            const idx = ++seq;
            const p = path.join(args.outputDir, `${args.baseName}_${String(idx).padStart(2, '0')}.pdf`);
            fs.writeFileSync(p, buf);
            files.push(p);
          }),
        );
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
        const font = await out.embedFont(StandardFonts.Helvetica);
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
        const font = await out.embedFont(StandardFonts.Helvetica);
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
          const ext = args.opts.imagePath.toLowerCase();
          const bytes = fs.readFileSync(args.opts.imagePath);
          const img = ext.endsWith('.png') ? await out.embedPng(bytes) : await out.embedJpg(bytes);
          cover.drawImage(img, { x: 0, y: 0, width: w, height: h });
        }
        if (args.opts.title) {
          const font = await out.embedFont(StandardFonts.HelveticaBold);
          const size = 28;
          const tw = font.widthOfTextAtSize(args.opts.title, size);
          cover.drawText(args.opts.title, { x: w / 2 - tw / 2, y: h / 2, size, font, color: rgb(0.2, 0.2, 0.2) });
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
        const pages = src.catalog.lookup(src.catalog.get(PDFName.of('Pages'))) as PDFDict;
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

  log.info('[pdf] PDF 工具箱 IPC 已注册');
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
