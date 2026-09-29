/**
 * 剪贴板兼容层（Electron 44 迁移）
 * ==================================================================
 * 【背景：为什么需要这个文件】
 * Electron 44 把主进程 `clipboard` 模块**整体重写为 W3C 异步 API**，
 * 旧的同步 API **一个不剩全部移除**（已逐个核对 `electron.d.ts`，0 命中）：
 *   readImage / writeImage / availableFormats / readBuffer / writeBuffer /
 *   readHTML / writeHTML / readRTF / writeRTF / readBookmark / writeBookmark /
 *   readFindText / writeFindText / hasImage
 *
 * 现存的 `Clipboard` 接口只剩 7 个成员（electron.d.ts L6985-L7029）：
 *   clear(): void
 *   has(mimetype): Promise<boolean>
 *   read(): Promise<ClipboardItem[]>
 *   readText(): Promise<string>
 *   write(data: ClipboardItem[]): Promise<void>
 *   writeText(text: string): Promise<void>
 *   readonly selection: Clipboard          // 仅 Linux
 *
 * 【设计意图】
 * 与其把 21 处调用点各自改成异步写法（散落各处、后续再变 API 要全局翻找），
 * 这里集中成一个薄适配层，让业务侧的改动**只是加一个 await、换一个函数名**：
 *
 *   旧写法                              新写法
 *   const t = clipboard.readText()      const t = await readClipboardText()
 *   clipboard.writeText(t)              await writeClipboardText(t)
 *   const i = clipboard.readImage()     const i = await readClipboardImage()
 *   clipboard.writeImage(img)           await writeClipboardImage(img)
 *   clipboard.availableFormats()        await readClipboardFormats()
 *   clipboard.readHTML() / readRTF()    await readClipboardHtml() / readClipboardRtf()
 *   clipboard.readBookmark()            await readClipboardBookmark()
 *   clipboard.readFindText()            —— 已移除，见下方说明
 *   clipboard.write({text, html})       await writeClipboardRich({ text, html })
 *
 * 业务代码因此保持「一个函数一次调用」的可读性，四层守卫链的结构也能原样保留。
 *
 * 【⚠️ findText 的处理】
 * `readFindText()` 是 macOS 专属的同步 API（对应「查找」面板的搜索框内容），
 * 在 Electron 44 已被移除；新 API 里**没有**直接等价物。本项目跑在 Windows，
 * 该列历史上几乎恒为空，故按约定「保留 DB 列、采集值置空」处理：
 * 不再读取，落库时写空字符串。
 *
 * 【⚠️ 图片写入的性能反转（重要）】
 * 旧 `writeImage(nativeImage)` 是同步、内部零拷贝的。新 API 只能用
 * `clipboard.write([new ClipboardItem({ 'image/png': Blob })])`，
 * **必须先把图编码成 PNG 字节**。故本层提供两条路径：
 *   - `writeClipboardImageFromPng(png)`：调用方**已有 PNG Buffer**时用（零重复编码）；
 *   - `writeClipboardImage(image)`：只有 NativeImage 时才调 `toPNG()`（多一次编码）。
 * 截图 / 二维码等路径本就是从 PNG dataURL 来的，走前者可省掉整次编码。
 */
import { clipboard, nativeImage, ClipboardItem, type NativeImage } from 'electron';

/**
 * ⚠️ 类型 / 运行时陷阱（★ 2026-09-29 二次修正，别再踩★）
 * ---------------------------------------------------------------
 * 本项目的 tsconfig 带 `"lib": ["ESNext", "DOM"]`，而 DOM 里也有一个同名的
 * `ClipboardItem` 类。**不能**直接用全局 `ClipboardItem`：
 *   ① 类型上会被解析成 **DOM 版本**，与 `clipboard.write()` 要求的
 *      `Electron.ClipboardItem` 不兼容（DOM 版 `getType()` 返回 `Promise<Blob>`，
 *      Electron 版还可返回 `ClipboardBookmark`）；
 *   ② **运行时它根本不存在**。`ClipboardItem` 是 **Web/浏览器**全局，不是 Node 全局 ——
 *      Node 18+ 并未内置它。**Electron 主进程也没有把它挂到 globalThis 上**。
 *
 * 【曾经的错误结论（导致线上崩溃，务必记住）】
 * 初版写了「运行时用 Node 全局 `ClipboardItem`（Node 18+ 内置，构造语义一致）」
 * 并直接裸用全局名，构建产物运行时报：
 *     ReferenceError: ClipboardItem is not defined
 *           at dist-electron/main/index-*.js
 * 「代码能编译过」是因为**类型空间有 DOM 的 `ClipboardItem`**，
 * 而运行时绑定根本不存在 —— 典型的「类型存在 ≠ 运行时有值」。
 *
 * 【正确来源（已在真实 Electron 44 主进程实测）】
 * 用 `require`/`import` 从 `'electron'` 模块取 —— 它是 Electron 的**真实运行时导出**：
 *     ✓ require('electron').ClipboardItem        → 'function'
 *     ✗ globalThis.ClipboardItem                 → 'undefined'   ← 全局没有
 *     ✗ globalThis.clipboard                      → 'undefined'   ← 全局也没有
 * 实测 `new (require('electron').ClipboardItem)({ 'text/plain': '...' })`
 * 写入后 `clipboard.readText()` 能原样读回；PNG 路径 `has('image/png')` 亦为 true。
 * （该导出在 `electron.d.ts` 里是 `namespace CrossProcessExports` 内的
 *   `class ClipboardItem extends Electron.ClipboardItem {}`，
 *   由 `declare module 'electron' { export = Electron.CrossProcessExports; }` 暴露。）
 *
 * 因此改成 **import 进来 + 断言成 Electron 的构造签名**：
 */
const ClipboardItemCtor = ClipboardItem as unknown as
  | (new (items: Record<string, Blob | string | Uint8Array>) => Electron.ClipboardItem)
  | undefined;

/**
 * 构造一个 Electron ClipboardItem；不可用时返回 null 让调用方安全降级。
 *
 * 加这层兜底的原因：初版就是「假定某处一定提供 ClipboardItem」，结果构建产物
 * 一跑就 `ReferenceError: ClipboardItem is not defined`，**直接把主进程打挂**
 * （模块顶层求值阶段抛错，整个应用起不来）。现在即便未来 Electron 又改了导出，
 * 最坏也只是「写图片/富文本降级失效」，而不是白屏启动失败。
 */
function makeClipboardItem(
  entries: Record<string, Blob | string | Uint8Array>,
): Electron.ClipboardItem | null {
  if (typeof ClipboardItemCtor !== 'function') {
    console.error('[clipboardCompat] electron 未导出 ClipboardItem，无法写入该格式');
    return null;
  }
  return new ClipboardItemCtor(entries);
}

/** 图片 MIME 常量：新 API 里图片统一以 `image/png` 为载体 */
const MIME_PNG = 'image/png';

/**
 * 把 Node Buffer / Uint8Array 归一化为 Blob 可接受的二进制视图。
 *
 * 为什么不能直接 `new Blob([buf])`：`Buffer` 的底层可能是 `SharedArrayBuffer`，
 * 而 TS 的 `BlobPart` 只接受 `ArrayBufferView<ArrayBuffer>`。这里复制到一块
 * **全新分配的 `ArrayBuffer`** 上，从根上保证类型是纯 `ArrayBuffer` 视图。
 *
 * ⚠️ TS 5.7+ 起 `Uint8Array` 是泛型 `Uint8Array<TArrayBuffer>`。两种常见写法都会踩坑：
 *   · `new Uint8Array(n)`          → 推断为 `Uint8Array<ArrayBufferLike>`，不满足 BlobPart；
 *   · `new Uint8Array<ArrayBuffer>(n)` → 该 TS 版本把参数当 `ArrayBuffer` 解析，报「number 不可赋给 ArrayBuffer」。
 * 稳妥做法：先 `new ArrayBuffer(n)`，再用 `new Uint8Array(buffer)` 包装 —— 类型自然收敛。
 *
 * @param data 必填，PNG 字节
 */
function toBlobPart(data: Buffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const src = ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : new Uint8Array(data);
  const out = new ArrayBuffer(src.byteLength);
  new Uint8Array(out).set(src);
  return new Uint8Array(out);
}

// ────────────────────────────── 读：文本 ──────────────────────────────

/**
 * 读剪贴板纯文本（替代旧 `clipboard.readText()`）
 * @returns 文本内容；读失败或无内容时返回空字符串
 */
export async function readClipboardText(): Promise<string> {
  try {
    return (await clipboard.readText()) || '';
  } catch {
    return '';
  }
}

// ────────────────────────────── 写：文本 ──────────────────────────────

/**
 * 写剪贴板纯文本（替代旧 `clipboard.writeText()`）
 * @param text 必填，要写入的文本
 */
export async function writeClipboardText(text: string): Promise<void> {
  await clipboard.writeText(text ?? '');
}

// ────────────────────────────── 富文本 ──────────────────────────────

/**
 * 写剪贴板富文本（替代旧 `clipboard.write({ text, html })`）
 *
 * 说明：新 API 里 HTML 也是 ClipboardItem 的一个 MIME 条目，与 text/plain 并列，
 * 因此 `{ text, html }` 会被拆成两个 MIME 一起原子提交。
 *
 * @param payload.text 必填，纯文本回退内容（粘贴到纯文本编辑器时用）
 * @param payload.html 可选，HTML 片段
 * @param payload.rtf  可选，RTF 内容
 */
export async function writeClipboardRich(payload: {
  text?: string;
  html?: string;
  rtf?: string;
}): Promise<void> {
  const entries: Record<string, Blob | string> = {};
  if (payload.text) entries['text/plain'] = payload.text;
  if (payload.html) entries['text/html'] = payload.html;
  if (payload.rtf) entries['text/rtf'] = payload.rtf;
  // 全是空内容时，退化为写空文本（与原 writeText('') 行为一致）
  if (!Object.keys(entries).length) {
    await clipboard.writeText('');
    return;
  }
  const item = makeClipboardItem(entries);
  if (!item) return;
  await clipboard.write([item]);
}

/**
 * 读剪贴板 HTML 片段（替代旧 `clipboard.readHTML()`）
 * @returns HTML 字符串；无内容或读取失败返回空字符串
 */
export async function readClipboardHtml(): Promise<string> {
  return readTextByMime('text/html');
}

/**
 * 读剪贴板 RTF 内容（替代旧 `clipboard.readRTF()`）
 * @returns RTF 字符串；无内容或读取失败返回空字符串
 */
export async function readClipboardRtf(): Promise<string> {
  return readTextByMime('text/rtf');
}

/**
 * 读剪贴板书签（替代旧 `clipboard.readBookmark()`）
 *
 * 说明：只有从浏览器复制「链接」时才有值，日常绝大多数复制都是空。
 * 旧 API 在无书签时返回 `{ title:'', url:'' }` 而不抛错，这里保持同样语义，
 * 避免调用方（clipboard.ts 会 JSON.stringify 后落库）出现行为漂移。
 *
 * @returns `{ title, url }`；无书签或读取失败时返回空字段对象
 */
export async function readClipboardBookmark(): Promise<{ title: string; url: string }> {
  const empty = { title: '', url: '' };
  try {
    const items = await clipboard.read();
    for (const item of items) {
      if (!item.types.includes(BOOKMARK_MIME)) continue;
      const bm = (await item.getType(BOOKMARK_MIME)) as Electron.ClipboardBookmark;
      if (bm && typeof bm === 'object') {
        return { title: bm.title || '', url: bm.url || '' };
      }
    }
  } catch {
    /* 无书签：按空处理 */
  }
  return empty;
}

// ────────────────────────────── 读：图片 ──────────────────────────────

/**
 * 读剪贴板图片（替代旧 `clipboard.readImage()`）
 *
 * ⚠️ 注意：旧 API 在「剪贴板没有图片」时返回**空 NativeImage**（`isEmpty() === true`），
 * 而不是抛错。本函数保持该语义，调用方原有的 `img.isEmpty()` 判断**无需改动**。
 *
 * 实现上先探测 `has('image/png')` 短路 —— 这比无条件走 `read()` 更便宜，
 * 也是四层守卫链里第 2 层「格式守卫」的高效等价物。
 *
 * @returns NativeImage；无图片或解析失败时返回空 NativeImage
 */
export async function readClipboardImage(): Promise<NativeImage> {
  try {
    if (!(await clipboard.has(MIME_PNG))) return nativeImage.createEmpty();
    const items = await clipboard.read();
    for (const item of items) {
      if (!item.types.includes(MIME_PNG)) continue;
      const blob = (await item.getType(MIME_PNG)) as Blob;
      const buf = Buffer.from(await blob.arrayBuffer());
      return nativeImage.createFromBuffer(buf);
    }
  } catch {
    /* 读取失败：按「无图片」处理 */
  }
  return nativeImage.createEmpty();
}

/**
 * 列出剪贴板当前可用格式（替代旧 `clipboard.availableFormats()`）
 *
 * 说明：新 API 无 `availableFormats`，等价物是把 `read()` 返回的所有
 * ClipboardItem 的 `types` 拍平去重。
 *
 * ⚠️ 相比旧的同步 `availableFormats()`，这里有一次 `read()` 的异步开销。
 * 在按住 1.5s 轮询的守卫链里，它仍是「不触发图片解码/编码」的廉价判断，
 * 故可作为第 2 层的等价替代。
 *
 * @returns MIME 类型数组；读取失败返回空数组
 */
export async function readClipboardFormats(): Promise<string[]> {
  try {
    const items = await clipboard.read();
    const set = new Set<string>();
    for (const item of items) {
      for (const t of item.types) set.add(t.toLowerCase());
    }
    return [...set];
  } catch {
    return [];
  }
}

// ────────────────────────────── 写：图片 ──────────────────────────────

/**
 * 写剪贴板图片 —— 已持有 PNG 字节时的零重复编码路径
 *
 * 截图 / 二维码等路径的数据源本就是 PNG（`canvas.toDataURL()` / qrcode 库输出），
 * 直接拿现成的 PNG Buffer 构造 ClipboardItem，**避免再走一次 `toPNG()` 编码**。
 *
 * @param png 必填，PNG 格式的字节缓冲（或任意可被 Blob 包裹的二进制）
 */
export async function writeClipboardImageFromPng(png: Buffer | Uint8Array): Promise<void> {
  // toBlobPart 归一化二进制，绕开 Buffer/SharedArrayBuffer 与 BlobPart 的类型冲突
  const item = makeClipboardItem({
    [MIME_PNG]: new Blob([toBlobPart(png)], { type: MIME_PNG }),
  });
  if (!item) return;
  await clipboard.write([item]);
}

/**
 * 写剪贴板图片 —— 手里只有 NativeImage 时的兜底路径
 *
 * ⚠️ 性能提示：新 API 的载体是 PNG 字节，故这里必须调一次 `toPNG()`（同步编码）。
 * 数 MB 的截图约 10–50ms，会短暂阻塞主进程事件循环。**能拿到 PNG 字节就优先用
 * `writeClipboardImageFromPng()`**，别走这条。
 *
 * @param image 必填，要写入的 NativeImage
 * @returns 成功与否；空图直接跳过（返回 false）不做无谓写入
 */
export async function writeClipboardImage(image: NativeImage): Promise<boolean> {
  if (!image || image.isEmpty()) return false;
  await writeClipboardImageFromPng(image.toPNG());
  return true;
}

// ────────────────────────────── 内部工具 ──────────────────────────────

/** 浏览器「复制的链接」对应的自定义 MIME（getType 时返回 ClipboardBookmark 对象） */
const BOOKMARK_MIME = 'electron application/bookmark';

/**
 * 按 MIME 类型读文本内容（HTML / RTF 共用）
 * @param mime 必填，目标 MIME
 * @returns 文本内容；不存在或读取失败返回空字符串
 */
async function readTextByMime(mime: string): Promise<string> {
  try {
    const items = await clipboard.read();
    for (const item of items) {
      if (!item.types.includes(mime)) continue;
      const blob = (await item.getType(mime)) as Blob;
      return await blob.text();
    }
  } catch {
    /* 无该格式：按空处理 */
  }
  return '';
}
