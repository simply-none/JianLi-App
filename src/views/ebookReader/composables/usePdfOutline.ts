/**
 * PdfReader 目录/outline composable
 *
 * 与 usePdfRender / usePdfHighlight 共享同一个 ctx（见 pdfContext.ts）。本 composable 负责：
 *   - 文档加载完成后调用 pdf.js 的 getOutline() 提取书签式目录树（标题层级）
 *   - 把每条目的跳转目标（dest）解析为页码，并以 "page:N" 作为 TocItem.href 回传
 *   - 通过 ctx.emit('toc-loaded', ...) 回填给父组件外壳的目录抽屉
 *
 * 复用外壳 TocDrawer：其 items 字段为 TocItem（id/href/label/subitems），与 epub 共用同一组件。
 * PDF 没有 epub 的 landmarks（封面/正文等），故 landmarks 回传空数组即可。
 */
import { ref } from 'vue';
import type { PdfCtx } from './pdfContext';
import type { TocItem } from '../types';

/**
 * 解析 outline 条目 dest → 页码（1 起始）。
 * dest 可能是：字符串（命名目标，需 getDestination 解析）/ 已解析数组 / null。
 * 解析失败或无页码时返回 null（对应 TocItem.href 留空，点击不跳转）。
 */
async function resolveDestToPage(ctx: PdfCtx, dest: string | any[] | null): Promise<number | null> {
  if (!dest) return null;
  try {
    let explicit: any[] | null = null;
    if (typeof dest === 'string') {
      explicit = await ctx.pdfDoc.getDestination(dest);
    } else if (Array.isArray(dest)) {
      explicit = dest;
    }
    if (!explicit || !explicit.length) return null;
    const ref = explicit[0];
    if (!ref) return null;
    const pageIndex = await ctx.pdfDoc.getPageIndex(ref);
    return pageIndex + 1;
  } catch {
    return null;
  }
}

/** 递归把 pdf.js outline 转为 TocItem 树：链接统一为 "page:N"，无页码则空串 */
async function buildToc(ctx: PdfCtx, items: any[]): Promise<TocItem[]> {
  const out: TocItem[] = [];
  for (let i = 0; i < (items || []).length; i++) {
    const it = items[i];
    const page = await resolveDestToPage(ctx, it?.dest ?? null);
    const node: TocItem = {
      id: `${it?.title || 'item'}_${i}`,
      href: page ? `page:${page}` : '',
      label: it?.title || '(无标题)',
    };
    if (it?.items && it.items.length) {
      node.subitems = await buildToc(ctx, it.items);
    }
    out.push(node);
  }
  return out;
}

export function usePdfOutline(ctx: PdfCtx) {
  /** 当前目录树（供需要时读取） */
  const tocItems = ref<TocItem[]>([]);

  /**
   * 加载并解析 PDF 目录/outline。失败时不抛错，仅回传空列表（抽屉显示“暂无目录”）。
   */
  async function loadOutline(_filePath: string): Promise<void> {
    if (!ctx.pdfDoc) return;
    try {
      const outline = await ctx.pdfDoc.getOutline();
      tocItems.value = outline && outline.length ? await buildToc(ctx, outline) : [];
      ctx.emit('toc-loaded', tocItems.value);
      // PDF 无 landmarks（封面/正文等），回传空数组保持外壳逻辑一致
      ctx.emit('landmarks-loaded', []);
    } catch (err) {
      console.error('加载 PDF 目录失败', err);
      tocItems.value = [];
      ctx.emit('toc-loaded', []);
    }
  }

  return { tocItems, loadOutline };
}
