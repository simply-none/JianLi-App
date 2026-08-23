const { ipcRenderer, contextBridge, clipboard } = require('electron')

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  // 新增handle方法
  handlePromise(onName: string, args: ObjectType) {
    return ipcRenderer.invoke(onName, args)
  },
  clipboard: {
    readText() {
      return clipboard.readText()
    },
    writeText(text: string) {
      clipboard.writeText(text)
    },
  },
  // TTS 语音合成 API
  tts: {
    // ============ 通用接口 ============
    /** 朗读文本（默认系统 TTS） */
    speak(text: string, options?: any) {
      return ipcRenderer.invoke('tts:speak', text, options)
    },
    /** 停止朗读 */
    stop() {
      return ipcRenderer.invoke('tts:stop')
    },
    /** 获取所有语音列表 */
    getVoices() {
      return ipcRenderer.invoke('tts:get-voices')
    },
    /** 检测所有 TTS 是否可用 */
    isAvailable() {
      return ipcRenderer.invoke('tts:is-available')
    },

    // ============ 系统 TTS ============
    system: {
      speak(text: string, options?: any) {
        return ipcRenderer.invoke('tts:system:speak', text, options)
      },
      stop() {
        return ipcRenderer.invoke('tts:system:stop')
      },
      getVoices() {
        return ipcRenderer.invoke('tts:system:get-voices')
      },
      isAvailable() {
        return ipcRenderer.invoke('tts:system:is-available')
      },
    },
  },
  // 电子书阅读 API
  ebook: {
    /**
     * 读取 txt 文件内容（自动检测并转换编码）
     *
     * @param filePath - 必填参数，txt 文件的绝对路径
     * @returns 成功返回 Promise<{ content: string; encoding: string; size: number }>；
     *          失败返回 Promise<{ error: string }>（error 为中文错误信息）
     */
    readTxt(filePath: string) {
      return ipcRenderer.invoke('ebook:read-txt', filePath)
    },
    /**
     * 以 base64 读取任意文件原始字节（PDF 等二进制格式用）
     *
     * @param filePath - 必填参数，文件绝对路径
     * @returns 成功返回 Promise<{ base64: string }>；失败返回 Promise<{ error: string }>
     */
    readFileBytes(filePath: string) {
      return ipcRenderer.invoke('ebook:read-file-bytes', filePath)
    },
    /**
     * 获取文件大小（字节数），供 PDF 区间加载构造 PDFDataRangeTransport 的 length 使用。
     *
     * @param filePath - 必填参数，文件绝对路径
     * @returns 成功返回 Promise<{ size: number }>；失败返回 Promise<{ error: string }>
     */
    getFileSize(filePath: string) {
      return ipcRenderer.invoke('ebook:get-file-size', filePath)
    },
    /**
     * 按 [start, end) 字节区间读取文件，返回 ArrayBuffer（无需 base64 往返）。
     * 供 PDF 区间/流式加载时 pdf.js 按需分块拉取，避免整文件载入内存。
     *
     * @param filePath - 必填参数，文件绝对路径
     * @param start - 区间起始字节（含）
     * @param end - 区间结束字节（不含）
     * @returns 成功返回 Promise<{ buffer: ArrayBuffer }>；失败返回 Promise<{ error: string }>
     */
    readFileRange(filePath: string, start: number, end: number) {
      return ipcRenderer.invoke('ebook:read-file-range', filePath, start, end)
    },
    /**
     * 计算文件原始内容 sha256（内容身份，用于换路径重新导入时复用标注/进度）
     *
     * @param filePath - 必填参数，文件绝对路径
     * @returns 成功返回 Promise<{ success: boolean; hash?: string; error?: string }>
     */
    computeFileHash(filePath: string) {
      return ipcRenderer.invoke('ebook:compute-file-hash', filePath)
    },
    /**
     * 获取指定电子书文件的阅读进度
     *
     * @param filePath - 必填参数，电子书文件的绝对路径
     * @returns 成功返回 Promise<{ success: boolean; data?: EbookProgress; error?: string }>；
     *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
     */
    getProgress(filePath: string, contentHash?: string) {
      return ipcRenderer.invoke('ebook:get-progress', filePath, contentHash)
    },
    /**
     * 保存电子书阅读进度
     *
     * @param data - 必填参数，阅读进度数据对象
     *   - filePath: 文件绝对路径
     *   - format: 文件格式（如 'epub'、'txt'）
     *   - cfi: epub.js 的 cfi 定位信息（仅 epub 格式有效）
     *   - percent: 阅读进度百分比，范围 0-100
     * @returns 成功返回 Promise<{ success: boolean; error?: string }>；
     *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
     */
    saveProgress(data: { filePath: string; format: string; name?: string; cfi: string; percent: number; contentHash?: string }) {
      return ipcRenderer.invoke('ebook:save-progress', data)
    },
    /**
     * 获取书架列表（按上次阅读时间倒序）
     *
     * @returns 成功返回 Promise<{ success: true; data: BookshelfRecord[] }>（无记录时 data 为空数组）；
     *          失败返回 Promise<{ success: false; error: string }>
     */
    getBookshelf() {
      return ipcRenderer.invoke('ebook:get-bookshelf')
    },
    /**
     * 添加或更新书架记录（upsert，保留首次添加时间）
     *
     * @param data - 必填参数，书架记录数据对象
     *   - filePath: 文件绝对路径
     *   - name: 文件名（含扩展名）
     *   - format: 文件格式（'txt' 或 'epub'）
     *   - percent: 阅读百分比 0-100
     * @returns 成功返回 Promise<{ success: boolean; error?: string }>；
     *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
     */
    addToBookshelf(data: { filePath: string; name: string; format: string; percent: number; contentHash?: string }) {
      return ipcRenderer.invoke('ebook:add-to-bookshelf', data)
    },
    /**
     * 按 file_path 删除书架记录
     *
     * @param filePath - 必填参数，电子书文件绝对路径
     * @returns 成功返回 Promise<{ success: boolean; error?: string }>；
     *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
     */
    removeFromBookshelf(filePath: string) {
      return ipcRenderer.invoke('ebook:remove-from-bookshelf', filePath)
    },
    /**
     * 一键清空书架：仅删除书架记录，不动分类 / 标注 / 进度 / 书签等其它内容
     */
    clearBookshelf() {
      return ipcRenderer.invoke('ebook:clear-bookshelf')
    },
    /**
     * 递归扫描文件夹，返回其中所有受支持的电子书文件（txt / epub / pdf）绝对路径列表
     *
     * @param folderPath - 必填参数，文件夹绝对路径
     * @returns 成功返回 Promise<{ success: boolean; data?: string[]; error?: string }>；
     *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
     */
    scanFolder(folderPath: string) {
      return ipcRenderer.invoke('ebook:scan-folder', folderPath)
    },
    /**
     * 获取全部分类（按创建时间升序）
     *
     * @returns 成功返回 Promise<{ success: true; data: { id, name }[] }>；
     *          失败返回 Promise<{ success: false; error: string }>
     */
    getCategories() {
      return ipcRenderer.invoke('ebook:get-categories')
    },
    /**
     * 新增分类（按名称去重，幂等）
     *
     * @param name - 必填参数，分类名称
     * @returns 成功返回 Promise<{ success: true; id: number; existed?: boolean }>；
     *          失败返回 Promise<{ success: false; error: string }>
     */
    addCategory(name: string, color?: string) {
      return ipcRenderer.invoke('ebook:add-category', name, color)
    },
    /**
     * 修改分类（名称 / 颜色）
     *
     * @param data - 必填参数，{ id: number, name?: string, color?: string | null }
     *               color 传 null/'' 表示清除颜色（传 undefined 表示不修改颜色）
     * @returns 成功返回 Promise<{ success: boolean; error?: string }>；
     *          失败返回 Promise<{ success: false; error: string }>
     */
    updateCategory(data: { id: number; name?: string; color?: string | null }) {
      return ipcRenderer.invoke('ebook:update-category', data)
    },
    /**
     * 删除分类（同时删除其下所有书-分类映射）
     *
     * @param id - 必填参数，分类 id
     * @returns 成功返回 Promise<{ success: boolean; error?: string }>；
     *          失败返回 Promise<{ success: false; error: string }>
     */
    deleteCategory(id: number) {
      return ipcRenderer.invoke('ebook:delete-category', id)
    },
    /**
     * 获取书与分类的映射
     *
     * @param bookPath - 可选参数，文件绝对路径；传入返回该书分类 id 数组，不传返回 { [book_path]: number[] }
     * @returns 成功返回 Promise<{ success: true; data: any }>；
     *          失败返回 Promise<{ success: false; error: string }>
     */
    getBookCategories(bookPath?: string) {
      return ipcRenderer.invoke('ebook:get-book-categories', bookPath)
    },
    /**
     * 替换某本书关联的分类集合（先清空旧映射，再批量写入）
     *
     * @param data - 必填参数，{ bookPath: 文件绝对路径, categoryIds: number[] }
     * @returns 成功返回 Promise<{ success: boolean; error?: string }>；
     *          失败返回 Promise<{ success: false; error: string }>
     */
    setBookCategories(data: { bookPath: string; categoryIds: number[] }) {
      return ipcRenderer.invoke('ebook:set-book-categories', data)
    },
    /**
     * 获取指定电子书文件的笔记与划线列表（按创建时间升序）
     *
     * @param filePath - 必填参数，电子书文件绝对路径
     * @returns 成功返回 Promise<{ success: true; data: AnnotationRecord[] }>（无记录时 data 为空数组）；
     *          失败返回 Promise<{ success: false; error: string }>
     */
    getAnnotations(filePath: string, contentHash?: string) {
      return ipcRenderer.invoke('ebook:get-annotations', filePath, contentHash)
    },
    /**
     * 新增一条笔记与划线记录
     *
     * @param data - 必填参数，笔记数据对象
     *   - filePath: 文件绝对路径
     *   - format: 文件格式（'txt' 或 'epub'）
     *   - anchor: 定位锚点（EPUB 用 cfiRange 字符串；TXT 用 "start-end" 字符偏移字符串）
     *   - text: 选中的原文摘录
     *   - note: 笔记内容，可空
     *   - color: 高亮颜色标识，默认 'yellow'
     * @returns 成功返回 Promise<{ success: true; id: number }>（id 为新记录自增主键）；
     *          失败返回 Promise<{ success: false; error: string }>
     */
    addAnnotation(data: { filePath: string; format: string; anchor: string; text: string; note?: string | null; color?: string; type?: string; contentHash?: string }) {
      return ipcRenderer.invoke('ebook:add-annotation', data)
    },
    /**
     * 按 id 更新笔记内容与高亮颜色（同时刷新 updated_at）
     *
     * @param data - 必填参数，更新数据对象
     *   - id: 笔记记录主键 id
     *   - note: 笔记内容，可空
     *   - color: 高亮颜色标识
     * @returns 成功返回 Promise<{ success: boolean; error?: string }>；
     *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
     */
    updateAnnotation(data: { id: number; note?: string | null; color?: string }) {
      return ipcRenderer.invoke('ebook:update-annotation', data)
    },
    /**
     * 按 id 删除笔记与划线记录
     *
     * @param id - 必填参数，笔记记录主键 id
     * @returns 成功返回 Promise<{ success: boolean; error?: string }>；
     *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
     */
    removeAnnotation(id: number) {
      return ipcRenderer.invoke('ebook:remove-annotation', id)
    },
    /**
     * 按 file_path 批量删除笔记与划线记录（scope: 'note' | 'highlight' | 'all'）
     *
     * @param data - 必填参数，{ filePath: 文件绝对路径, scope: 删除范围 }
     * @returns 成功返回 Promise<{ success: boolean; deleted?: number; error?: string }>；
     *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
     */
    removeAnnotations(data: { filePath: string; scope: 'note' | 'highlight' | 'all' }) {
      return ipcRenderer.invoke('ebook:remove-annotations', data)
    },
    /**
     * 批量统计每本书的笔记、划线与书签数量（供书架卡片显示徽标）
     *
     * @param filePaths - 必填参数，文件绝对路径数组
     * @param contentHashes - 可选参数，与 filePaths 对应的内容哈希数组；用于把同哈希、不同路径的共享数据一并计入
     * @returns 成功返回 Promise<{ success: true; data: { key, noteCount, highlightCount, bookmarkCount }[] }>；
     *          失败返回 Promise<{ success: false; error: string }>
     */
    getAnnotationCounts(filePaths: string[], contentHashes?: string[]) {
      return ipcRenderer.invoke('ebook:get-annotation-counts', filePaths, contentHashes)
    },
    /**
     * 导出笔记与划线为 Markdown 文件（弹出系统保存对话框）
     *
     * @param data - 必填参数，{ filePath?, title? }；filePath 为空表示导出全部书
     * @returns 成功返回 Promise<{ success: true; savedPath: string }>；
     *          取消/失败返回 Promise<{ success: false; error?: string }>
     */
    exportAnnotations(data: { filePath?: string; title?: string }) {
      return ipcRenderer.invoke('ebook:export-annotations', data)
    },
    /**
     * 获取指定电子书文件的书签列表（按阅读进度升序）
     *
     * @param filePath - 必填参数，电子书文件绝对路径
     * @returns 成功返回 Promise<{ success: true; data: BookmarkRecord[] }>（无记录时 data 为空数组）；
     *          失败返回 Promise<{ success: false; error: string }>
     */
    getBookmarks(filePath: string, contentHash?: string) {
      return ipcRenderer.invoke('ebook:get-bookmarks', filePath, contentHash)
    },
    /**
     * 新增一条书签记录
     *
     * @param data - 必填参数，书签数据对象
     *   - filePath: 文件绝对路径
     *   - format: 文件格式（'txt' 或 'epub'）
     *   - cfi: 定位锚点（epub.js 的 cfi 字符串）
     *   - label: 书签标签（章节名或进度描述），可空
     *   - percent: 阅读百分比 0-100
     * @returns 成功返回 Promise<{ success: true; id: number }>（id 为新记录自增主键）；
     *          失败返回 Promise<{ success: false; error: string }>
     */
    addBookmark(data: { filePath: string; format: string; cfi: string; label?: string | null; percent: number; contentHash?: string }) {
      return ipcRenderer.invoke('ebook:add-bookmark', data)
    },
    /**
     * 按数据库 id 删除书签记录
     *
     * @param id - 必填参数，书签记录主键 id
     * @returns 成功返回 Promise<{ success: boolean; error?: string }>；
     *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
     */
    removeBookmark(id: number) {
      return ipcRenderer.invoke('ebook:remove-bookmark', id)
    },
    /**
     * 保存书籍基本信息（标题/作者/封面），由渲染进程解析后回传，供书架列表秒出、无需每次重新解析
     *
     * @param data - 必填参数，{ filePath, name?, format?, title?, author?, cover? }
     * @returns 成功返回 Promise<{ success: boolean; error?: string }>；
     *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
     */
    saveBookMeta(data: { filePath: string; name?: string; format?: string; title?: string; author?: string; cover?: string; contentHash?: string }) {
      return ipcRenderer.invoke('ebook:save-book-meta', data)
    },
    /**
     * 保存一张阅读背景图（跨格式共享，按来源文件路径去重）
     *
     * @param imagePath - 必填参数，背景图来源文件的绝对路径（去重键）
     * @param dataUrl - 必填参数，背景图 data URL（平铺方式作为阅读区背景）
     * @returns 成功返回 Promise<{ success: boolean; id?: number; existed?: boolean; error?: string }>
     */
    addBgImage(imagePath: string, dataUrl: string) {
      return ipcRenderer.invoke('ebook:add-bg-image', imagePath, dataUrl)
    },
    /**
     * 获取全部已保存的阅读背景图（按加入时间倒序）
     *
     * @returns 成功返回 Promise<{ success: boolean; data?: { id: number; imagePath: string; dataUrl: string; createdAt: string }[]; error?: string }>
     */
    getBgImages() {
      return ipcRenderer.invoke('ebook:get-bg-images')
    },
    /**
     * 按 id 删除一张已保存的阅读背景图
     *
     * @param id - 必填参数，背景图记录主键 id
     * @returns 成功返回 Promise<{ success: boolean; error?: string }>
     */
    deleteBgImage(id: number) {
      return ipcRenderer.invoke('ebook:delete-bg-image', id)
    },
  },
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  once(...args: Parameters<typeof ipcRenderer.once>) {
    const [channel, listener] = args
    return ipcRenderer.once(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  sendSync(...args: Parameters<typeof ipcRenderer.sendSync>) {
    const [channel, ...omit] = args
    return ipcRenderer.sendSync(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
  removeAllListeners(...args: Parameters<typeof ipcRenderer.removeAllListeners>) {
    const [channel, ...omit] = args
    return ipcRenderer.removeAllListeners(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) {
      return parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) {
      return parent.removeChild(child)
    }
  },
}

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  const className = `loaders-css__square-spin`
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
  ev.data.payload === 'removeLoading' && removeLoading()
}

setTimeout(removeLoading, 3000)
