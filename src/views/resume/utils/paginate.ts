/**
 * 简历分页工具
 * ------------------------------------------------------------------
 * 把渲染 HTML（.rfs-flow 结构）按 A4 纸张高度切分为多张 .rfs-page，
 * 预览与导出共用同一套切页逻辑，保证所见即所得。
 *
 * 关键约束：
 *   1. 全部高度测量必须在已挂载文档中完成——节点移入未挂载容器后
 *      offsetHeight 变为 0，会导致装箱失真（所有内容挤进第一页）；
 *      因此采用「先测量 → 纯数据装箱 → 最后一次性移动 DOM」三段式。
 *   2. 调用方需保证测量期间无 CSS zoom 干扰（zoom 会传播进 iframe 文档）。
 *
 * 模块内切断（innerSplit 选项）：
 *   - 开启：超页元素递归向内拆分（容器按子元素拆、列表按条目拆、
 *     超页文本块按文本行估算拆分），消除整模块导致的页尾大空白
 *   - 关闭：仅整模块/条目容器粒度切页，模块内容保持完整（页尾可能留白）
 */

/** px per mm（96dpi） */
const PX_PER_MM = 96 / 25.4

/** A4 纵向高度 mm */
const A4_HEIGHT_MM = 297

/** 片段：一次放置的节点组（wrapTpl 非 null 表示需包进该容器克隆以保留样式） */
type Piece = { nodes: HTMLElement[]; h: number; wrapTpl: HTMLElement | null }

/** 分页选项 */
export interface PaginateOptions {
  /** 是否允许模块内切断（递归细粒度跨页），默认开启 */
  innerSplit?: boolean
}

/**
 * 对文档执行分页切分（原地修改 DOM）
 * @param doc 已加载渲染 HTML 的文档（iframe contentDocument）
 * @param options 分页选项
 * @returns 页数；文档结构不符时返回 0
 */
export function paginateDocument(doc: Document, options: PaginateOptions = {}): number {
  const innerSplit = options.innerSplit !== false
  const flow = doc.querySelector('.rfs-flow')
  if (!flow) return 0

  const padY = parseFloat(doc.body.dataset.padY || '13') * PX_PER_MM
  const innerH = A4_HEIGHT_MM * PX_PER_MM - padY * 2

  /** 超页叶子文本块按行拆分时的隐藏测量容器 */
  const measure = doc.createElement('div')
  measure.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden'
  flow.appendChild(measure)

  const pieces: Piece[] = []
  try {
    // ===== 第一步：递归片段化到视觉行级（全部测量在已挂载 flow 中完成） =====
    for (const mod of Array.from(flow.children) as HTMLElement[]) {
      // 跳过隐藏测量容器：splitLeafText 的行块克隆暂存在其中，若被当作模块递归
      // 会产生重复片段（同一节点被两次 appendChild 移动），导致文本内容整块丢失
      if (mod === measure) continue
      if (innerSplit) {
        pieces.push(...flattenToLines(doc, mod, null, measure))
      } else {
        // 关闭模块内切断：整模块一个片段（模块内容保持完整）
        const h = mod.offsetHeight
        if (h > 0) pieces.push({ nodes: [mod], h, wrapTpl: null })
      }
    }

    // 诊断：输出全部片段清单（高度/是否带容器包装/文本头部），用于核对内容是否在片段化阶段丢失
    console.debug(
      '[resume] 片段清单:',
      pieces.map((p, i) => `#${i} h${p.h}${p.wrapTpl ? 'W' : ''}|${(p.nodes[0]?.textContent || '').replace(/\s+/g, ' ').slice(0, 10)}`).join(' · ')
    )

    // ===== 第二步：纯数据装箱（贪心，页内容高 innerH） =====
    type PageData = { pieces: Piece[]; used: number }
    const pagesData: PageData[] = []
    let cur: PageData = { pieces: [], used: 0 }
    for (const p of pieces) {
      if (cur.used > 0 && cur.used + p.h > innerH) {
        pagesData.push(cur)
        cur = { pieces: [], used: 0 }
      }
      cur.pieces.push(p)
      cur.used += p.h
    }
    if (cur.pieces.length > 0) pagesData.push(cur)

    // 诊断：输出每页装箱结果（片段数/累计高度），用于核对片段是否全部进入页数据
    console.debug(
      '[resume] 装箱结果:',
      JSON.stringify(pagesData.map((pd) => ({ n: pd.pieces.length, used: Math.round(pd.used) })))
    )

    // ===== 第三步：一次性移动 DOM（移动时不再测量） =====
    const pages: HTMLElement[] = []
    for (const pd of pagesData) {
      const page = doc.createElement('div')
      page.className = 'rfs-page'
      const inner = doc.createElement('div')
      page.appendChild(inner)
      pages.push(page)
      // 连续同模板片段包进同一容器克隆（保留容器样式），模板变化时重建
      let curWrap: HTMLElement | null = null
      let curTpl: HTMLElement | null = null
      for (const pc of pd.pieces) {
        if (pc.wrapTpl) {
          if (!curWrap || curTpl !== pc.wrapTpl) {
            curWrap = pc.wrapTpl.cloneNode(false) as HTMLElement
            curTpl = pc.wrapTpl
            inner.appendChild(curWrap)
          }
          pc.nodes.forEach((n) => curWrap!.appendChild(n))
        } else {
          curWrap = null
          curTpl = null
          pc.nodes.forEach((n) => inner.appendChild(n))
        }
      }
    }

    // ===== 第四步：挂载复核再平衡（消除预测量与真实渲染的偏差） =====
    // 把每页挂到与纸张同宽的隐藏测量根中实测：
    //   - 溢出页：尾部块自动后移（消除内容被 overflow:hidden 截断丢失）
    //   - 未满页：下一页头部块自动上吸（消除页尾大空白）
    const measureRoot = doc.createElement('div')
    measureRoot.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;width:210mm'
    flow.appendChild(measureRoot)
    for (const page of pages) measureRoot.appendChild(page)

    for (let i = 0; i < pages.length; i++) {
      const inner = pages[i].firstElementChild as HTMLElement
      // 溢出校正：内容超高时尾部块依次后移（至少保留一块）
      let guard = 0
      while (inner.scrollHeight > innerH && inner.children.length > 1 && guard++ < 50) {
        const nextInner = pages[i + 1]?.firstElementChild as HTMLElement | undefined
        if (!nextInner) break
        nextInner.insertBefore(inner.lastElementChild as HTMLElement, nextInner.firstElementChild)
      }
      // 空白消除：下一页头部块放得下就上吸（循环直到放不下或下一页清空）
      guard = 0
      while (i + 1 < pages.length && guard++ < 100) {
        const nextInner = pages[i + 1].firstElementChild as HTMLElement
        const first = nextInner.firstElementChild as HTMLElement | null
        if (!first) {
          // 下一页已空：移除空页
          pages.splice(i + 1, 1)
          continue
        }
        if (inner.scrollHeight + first.offsetHeight <= innerH) {
          inner.appendChild(first)
        } else {
          break
        }
      }
    }
    // 清理再平衡后可能出现的空页
    const filled = pages.filter((p) => (p.firstElementChild as HTMLElement)?.children.length > 0)
    pages.length = 0
    pages.push(...filled)

    // 诊断：输出每页实际内容高度与内部块明细，便于核对分页填充效果
    const heights = filled.map((p) => {
      const inner = p.firstElementChild as HTMLElement
      const kids = Array.from(inner.children).map((c) => {
        const cls = String(c.className || c.tagName).slice(0, 24)
        return `${cls}|h${Math.round((c as HTMLElement).offsetHeight)}|${(c.textContent || '').slice(0, 10)}`
      })
      return { h: Math.round(inner.scrollHeight), kids }
    })
    console.debug('[resume] 分页：', JSON.stringify({ limit: Math.round(innerH), pages: heights }))

    flow.replaceWith(...pages)

    // 诊断：最终核对全部片段节点均已挂载到文档（未挂载 = 内容丢失直接证据）
    const detached = pieces.flatMap((p) => p.nodes).filter((n) => !n.isConnected)
    console.debug('[resume] 最终未挂载节点数:', detached.length)

    return pages.length
  } finally {
    measure.remove()
  }
}

/**
 * 判断是否为「不可再拆」的整行展示元素：
 * flex/grid 行（标题+日期等行内组合）、列表项（li，圆点标记需与内容同页）、
 * inline 元素——这些拆散会破坏语义，作为整行片段放置。
 */
function isAtomicRow(el: HTMLElement): boolean {
  const display = getComputedStyle(el).display
  return (
    display.startsWith('flex') ||
    display.startsWith('grid') ||
    display.startsWith('inline') ||
    display.startsWith('list')
  )
}

/**
 * 递归片段化到视觉行级：
 *   - flex 行 / 列表项 / inline 元素 → 整行片段（不拆散行内组合）
 *   - 纯文本叶子：矮块（≤48px≈2行）整块；高块按视觉行拆分（实测行高）
 *   - 块容器 → 逐子元素递归，跨页时用容器克隆包装保留样式
 * 切分粒度为视觉行，任意两行文本都可分布到不同页，页面精确填满。
 */
function flattenToLines(
  doc: Document,
  el: HTMLElement,
  wrapTpl: HTMLElement | null,
  measure: HTMLElement
): Piece[] {
  const h = el.offsetHeight
  // 空元素不产生片段
  if (h <= 0) return []
  // 整行元素（flex/grid/inline/列表项）不拆
  if (isAtomicRow(el)) return [{ nodes: [el], h, wrapTpl }]

  const children = Array.from(el.children) as HTMLElement[]

  // 纯文本叶子：矮块整块，高块按视觉行拆分
  if (children.length === 0) {
    if (h <= 48) return [{ nodes: [el], h, wrapTpl }]
    return splitLeafText(doc, el, wrapTpl, measure)
  }

  // 单子元素：穿透（保留当前容器作为包装模板）
  if (children.length === 1) {
    return flattenToLines(doc, children[0], wrapTpl ?? (el.cloneNode(false) as HTMLElement), measure)
  }

  // 多子块容器：逐子递归，每页用本容器克隆包装（保留容器自身的间距/样式）
  const tpl = el.cloneNode(false) as HTMLElement
  const out: Piece[] = []
  for (const c of children) {
    out.push(...flattenToLines(doc, c, tpl, measure))
  }
  return out
}

/**
 * 超页叶子文本块切分：先按 \n 分段，再按「平均字符宽估算的每行字符数」
 * 把长段切为多个视觉行块（每块克隆原样式并在隐藏测量容器中实测高度）。
 * 字符估算与实际换行可能有偏差，但每块高度为实测值，装箱后内容不丢失、
 * 仅切断位置与浏览器自然换行点略有差异。
 * @param el 超页叶子元素（纯文本块）
 * @param wrapTpl 容器克隆模板
 * @param measure 隐藏测量容器（与元素同宽）
 * @returns 行片段列表
 */
function splitLeafText(
  doc: Document,
  el: HTMLElement,
  wrapTpl: HTMLElement | null,
  measure: HTMLElement
): Piece[] {
  const text = el.textContent || ''
  if (!text.trim()) return [{ nodes: [el], h: el.offsetHeight, wrapTpl }]

  const width = el.clientWidth
  const probe = (t: string): number => {
    const d = el.cloneNode(false) as HTMLElement
    d.textContent = t
    measure.appendChild(d)
    const h = d.offsetHeight
    d.remove()
    return h
  }

  // 单行基准高 + 平均字符宽（样本含中英文，宽度含全局字间距）
  const lineH = probe('测试测')
  const sample = '测试字符宽度测量样本 Width Sample 123'
  const s = doc.createElement('span')
  s.textContent = sample
  measure.appendChild(s)
  const charW = s.offsetWidth / sample.length || 0
  s.remove()
  const charsPerLine = width > 0 && charW > 0 ? Math.max(1, Math.floor(width / charW)) : 40

  const out: Piece[] = []
  for (const para of text.split(/\r?\n/)) {
    // 空行：保留一个空块占位
    if (!para) {
      const d = el.cloneNode(false) as HTMLElement
      d.textContent = '\u00A0'
      measure.appendChild(d)
      out.push({ nodes: [d], h: d.offsetHeight, wrapTpl })
      d.remove()
      continue
    }
    // 长段按估算字符数切块
    for (let i = 0; i < para.length; i += charsPerLine) {
      const chunk = para.slice(i, i + charsPerLine)
      const d = el.cloneNode(false) as HTMLElement
      d.textContent = chunk
      measure.appendChild(d)
      out.push({ nodes: [d], h: d.offsetHeight, wrapTpl })
      // 测量完立即移出：防止克隆滞留 measure 被模块循环再次处理（内容丢失根因）
      d.remove()
    }
  }
  // 诊断：超页文本块拆分结果（估算行宽/切块数/各块实测高），用于核对拆分是否异常
  console.debug(
    '[resume][split] 文本块拆分:',
    JSON.stringify({
      head: text.slice(0, 14),
      原高: el.offsetHeight,
      宽: width,
      charW: +charW.toFixed(2),
      每行字符: charsPerLine,
      块: out.map((o) => ({ h: o.h, t: (o.nodes[0].textContent || '').slice(0, 8) })),
    })
  )
  return out
}

/**
 * 用离屏 iframe 加载渲染 HTML 并执行分页，返回切页后的完整 HTML
 * （导出专用：预览与导出共用切页逻辑，PDF 每页即一张 .rfs-page）
 * @param html 模板渲染的原始 HTML
 * @param options 分页选项（透传 paginateDocument）
 * @returns 切页后的完整 HTML 文档字符串
 */
export function buildPaginatedHtml(html: string, options: PaginateOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-same-origin')
    frame.style.cssText = 'position:fixed;left:-99999px;top:0;width:210mm;height:297mm;border:0;visibility:hidden'
    frame.srcdoc = html
    frame.onload = () => {
      try {
        const doc = frame.contentDocument
        if (!doc || !doc.body) throw new Error('离屏文档未就绪')
        paginateDocument(doc, options)
        // 导出恢复白底（移除预览专用的灰底类）
        doc.body.classList.remove('preview-mode')
        resolve(doc.documentElement.outerHTML)
      } catch (e) {
        reject(e)
      } finally {
        frame.remove()
      }
    }
    frame.onerror = () => reject(new Error('离屏 iframe 加载失败'))
    document.body.appendChild(frame)
  })
}
