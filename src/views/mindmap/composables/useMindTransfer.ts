/**
 * 思维导图 —— 导入 / 导出编排（工具条「导入」「导出」的唯一入口）。
 *
 * 导出：走项目统一的 `exportTextToCache` / `exportBufferToCache`（不弹系统保存框，
 *      写入缓存目录后用 `fileNotify` 给出可点击的路径），与二维码 / 报表等模块行为一致。
 *      文本类 → JSON / Markdown / OPML / FreeMind；二进制类 → PNG / XMind(base64)。
 *
 * 导入：用渲染端的 `<input type="file">` + FileReader 读盘 —— 项目里
 *      `QrDropZone` / `devToolbox` 都是这个模式。**零主进程改动**，
 *      因此不需要重启 Electron 就能生效。
 *
 * 导入一律**作为新文档载入**（`id` 置空）：
 *   覆盖当前文档是破坏性操作，而「新建一份」用户可以自己决定要不要保存 ——
 *   这也让「导入」天然变成一次安全的预览。
 *
 * 分流只按**文件扩展名**：后缀已经说明了一切，不再加一层「请选择格式」的二次确认。
 * 认不出后缀时按 Markdown 大纲试一次（最宽松、也是最常见的输入形态）。
 *
 * ⚠️ 导入前若当前文档有未保存改动，会先确认（`confirmDiscard`）；
 *    确认策略只在这里写一份 —— 导入只有这一条触发路径（没有快捷键），
 *    所以不需要像「删除」那样在 actions 里再集中一次。
 */

import { ElMessage, ElMessageBox } from 'element-plus'

import { exportBufferToCache, exportTextToCache } from '@/utils/exportToFile'
import { DEFAULT_DOC_NAME, MIND_DOC_VERSION } from '../constants'
import type { MindDocData } from '../types'
import {
  buildExchangeJson,
  freemindFileName,
  jsonFileName,
  markdownFileName,
  opmlFileName,
  parseExchangeJson,
  stripExt,
  xmindFileName,
} from '../utils/exchange'
import { freeMindToTree, treeToFreeMind } from '../utils/freemind'
import { markdownToTree, treeToMarkdown } from '../utils/markdown'
import { opmlToTree, treeToOpml } from '../utils/opml'
import { treeToXmind, xmindToTree } from '../utils/xmind'
import { useMindDoc } from './useMindDoc'
import { useMindExport } from './useMindExport'
import { useMindView } from './useMindView'

/** 文件选择框的 accept：把支持的后缀与 MIME 都列上，避免用户被默认过滤挡住 */
const IMPORT_ACCEPT = [
  '.json',
  '.md',
  '.markdown',
  '.txt',
  '.opml',
  '.mm',
  '.xmind',
  'application/json',
  'application/xml',
  'text/xml',
  'text/plain',
  'text/markdown',
].join(',')

/* -------------------------------------------------------------- 读盘 */

/** 弹出系统文件选择框；用户取消时 resolve(undefined)（取消不是错误，不提示） */
function pickFile(accept: string): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    document.body.appendChild(input)

    let settled = false
    const finish = (value: File | undefined) => {
      if (settled) return
      settled = true
      window.removeEventListener('focus', onFocus)
      input.remove()
      resolve(value)
    }

    input.onchange = () => finish(input.files?.[0] ?? undefined)

    // 用户点「取消」时 change 不会触发，靠「窗口重新获得焦点」兜底收尾。
    // 延迟 1.2s 是留给 FileReader 的：小文件是毫秒级，绝不会被这条兜底抢跑。
    const onFocus = () => {
      window.setTimeout(() => finish(undefined), 1200)
    }
    window.addEventListener('focus', onFocus, { once: true })

    input.click()
  })
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsText(file, 'utf-8')
  })
}

function readBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsArrayBuffer(file)
  })
}

/* ------------------------------------------------------------------ 主体 */

export function useMindTransfer() {
  const mind = useMindDoc()
  const view = useMindView()
  const raster = useMindExport()

  /* ------------------------------------------------------------ 导出 */

  /** 导出产物：文本走 exportTextToCache，二进制走 exportBufferToCache */
  function saveText(text: string, filename: string, title: string): boolean {
    const result = exportTextToCache(text, filename, { title })
    if (!result.success) ElMessage.error(result.message || '导出失败')
    return result.success
  }

  /** 导出为交换 JSON（含文档名、布局、备注、分支色 —— 可完整往返） */
  function exportJson(): boolean {
    const { name, data } = mind.doc.value
    return saveText(buildExchangeJson(name, data), jsonFileName(name), '导图已导出')
  }

  /** 导出为 Markdown 大纲（只含层级与文本，见 utils/markdown.ts 的三条约定） */
  function exportMarkdown(): boolean {
    const { name, data } = mind.doc.value
    return saveText(treeToMarkdown(data.root), markdownFileName(name), '大纲已导出')
  }

  /** 导出为 OPML 大纲（含 `_note` 备注） */
  function exportOpml(): boolean {
    const { name, data } = mind.doc.value
    return saveText(treeToOpml(data.root, name), opmlFileName(name), 'OPML 已导出')
  }

  /** 导出为 FreeMind `.mm`（含折叠态与备注） */
  function exportFreeMind(): boolean {
    const { name, data } = mind.doc.value
    return saveText(treeToFreeMind(data.root), freemindFileName(name), 'FreeMind 已导出')
  }

  /** 导出为 XMind `.xmind`（zip + content.json，异步） */
  async function exportXmind(): Promise<boolean> {
    const { name, data } = mind.doc.value
    try {
      const base64 = await treeToXmind(data.root, name)
      const result = exportBufferToCache(base64, xmindFileName(name), { title: 'XMind 已导出' })
      if (!result.success) ElMessage.error(result.message || '导出失败')
      return result.success
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : 'XMind 导出失败')
      return false
    }
  }

  /** 转交给 SVG / PNG 导出（同一份 SVG 两种产物） */
  const exportSvg = raster.exportSvg
  const exportPng = raster.exportPng

  /* ------------------------------------------------------------ 导入 */

  /** 当前有未保存改动时先确认；返回 false 表示用户放弃 */
  async function confirmDiscard(action: string): Promise<boolean> {
    if (!mind.dirty.value) return true
    try {
      await ElMessageBox.confirm(
        `当前导图有未保存的改动，${action}会载入新内容并丢弃这些改动。`,
        `${action}导图`,
        { type: 'warning', confirmButtonText: `仍然${action}`, cancelButtonText: '取消' },
      )
      return true
    } catch {
      return false
    }
  }

  /** 作为新文档载入（id 置空，另存为新记录，不覆盖已有文档） */
  function applyImported(name: string, data: MindDocData) {
    view.requestFit()
    mind.replaceDoc({ id: undefined, name, data })
    ElMessage.success('已导入为新文档，按 Ctrl + S 保存')
  }

  /** 统一的「确认 → 载入」收尾，避免每个格式各写一遍 */
  async function loadAsNewDoc(name: string, data: MindDocData): Promise<boolean> {
    if (!(await confirmDiscard('导入'))) return false
    applyImported(name, data)
    return true
  }

  /** 本应用导出的 `.mindmap.json` */
  async function applyJson(file: File): Promise<boolean> {
    const parsed = parseExchangeJson(await readText(file), mind.layout.value)
    if (!parsed) {
      ElMessage.error('无法识别为思维导图文件，请选择本应用导出的 JSON')
      return false
    }
    return loadAsNewDoc(parsed.name || stripExt(file.name) || DEFAULT_DOC_NAME, parsed.data)
  }

  /** Markdown 大纲（标题或缩进列表，见 utils/markdown.ts） */
  async function applyMarkdown(file: File): Promise<boolean> {
    const root = markdownToTree(await readText(file))
    if (!root) {
      ElMessage.warning('这份文件里没有解析出可用的大纲行')
      return false
    }
    return loadAsNewDoc(stripExt(file.name) || DEFAULT_DOC_NAME, {
      version: MIND_DOC_VERSION,
      layout: mind.layout.value,
      root,
    })
  }

  /** OPML 大纲 */
  async function applyOpml(file: File): Promise<boolean> {
    const parsed = opmlToTree(await readText(file), mind.layout.value)
    if (!parsed) {
      ElMessage.error('无法解析为 OPML 大纲（缺少 <body> 或 outline 节点）')
      return false
    }
    return loadAsNewDoc(parsed.name || stripExt(file.name) || DEFAULT_DOC_NAME, parsed.data)
  }

  /** FreeMind `.mm` */
  async function applyFreeMind(file: File): Promise<boolean> {
    const parsed = freeMindToTree(await readText(file), mind.layout.value)
    if (!parsed) {
      ElMessage.error('无法解析为 FreeMind 文件（缺少 <map> 或 node 节点）')
      return false
    }
    return loadAsNewDoc(stripExt(file.name) || DEFAULT_DOC_NAME, parsed.data)
  }

  /** XMind `.xmind`（二进制 zip；只支持新版 content.json） */
  async function applyXmind(file: File): Promise<boolean> {
    const parsed = await xmindToTree(await readBuffer(file), mind.layout.value)
    if (!parsed) {
      ElMessage.error('无法解析该 .xmind（仅支持新版 content.json，旧版 XMind 8 的 content.xml 暂不支持）')
      return false
    }
    return loadAsNewDoc(parsed.name || stripExt(file.name) || DEFAULT_DOC_NAME, parsed.data)
  }

  /** 导入入口：按扩展名分流，认不出的当 Markdown 大纲试一次 */
  async function importFile(): Promise<boolean> {
    const file = await pickFile(IMPORT_ACCEPT)
    if (!file) return false

    const lower = file.name.toLowerCase()
    if (lower.endsWith('.json')) return applyJson(file)
    if (lower.endsWith('.opml')) return applyOpml(file)
    if (lower.endsWith('.mm')) return applyFreeMind(file)
    if (lower.endsWith('.xmind')) return applyXmind(file)
    return applyMarkdown(file)
  }

  return {
    // 导入
    importFile,
    // 文本导出
    exportJson,
    exportMarkdown,
    exportOpml,
    exportFreeMind,
    // 二进制导出
    exportXmind,
    exportSvg,
    exportPng,
  }
}

/** 供工具条构造「导出」菜单项（顺序即菜单顺序） */
export const EXPORT_ITEMS = [
  { key: 'svg', label: 'SVG 矢量图' },
  { key: 'png', label: 'PNG 图片' },
  { key: 'json', label: 'JSON（完整数据）' },
  { key: 'markdown', label: 'Markdown 大纲' },
  { key: 'opml', label: 'OPML 大纲' },
  { key: 'freemind', label: 'FreeMind（.mm）' },
  { key: 'xmind', label: 'XMind（.xmind）' },
] as const

export type MindExportKey = (typeof EXPORT_ITEMS)[number]['key']
