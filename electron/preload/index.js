const { ipcRenderer, contextBridge, clipboard } = require('electron');
// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
    // 新增handle方法
    handlePromise(onName, args) {
        return ipcRenderer.invoke(onName, args);
    },
    clipboard: {
        readText() {
            return clipboard.readText();
        },
        writeText(text) {
            clipboard.writeText(text);
        },
    },
    // TTS 语音合成 API
    tts: {
        // ============ 通用接口 ============
        /** 朗读文本（默认系统 TTS） */
        speak(text, options) {
            return ipcRenderer.invoke('tts:speak', text, options);
        },
        /** 停止朗读 */
        stop() {
            return ipcRenderer.invoke('tts:stop');
        },
        /** 获取所有语音列表 */
        getVoices() {
            return ipcRenderer.invoke('tts:get-voices');
        },
        /** 检测所有 TTS 是否可用 */
        isAvailable() {
            return ipcRenderer.invoke('tts:is-available');
        },
        // ============ 系统 TTS ============
        system: {
            speak(text, options) {
                return ipcRenderer.invoke('tts:system:speak', text, options);
            },
            stop() {
                return ipcRenderer.invoke('tts:system:stop');
            },
            getVoices() {
                return ipcRenderer.invoke('tts:system:get-voices');
            },
            isAvailable() {
                return ipcRenderer.invoke('tts:system:is-available');
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
        readTxt(filePath) {
            return ipcRenderer.invoke('ebook:read-txt', filePath);
        },
        /**
         * 以 base64 读取任意文件原始字节（PDF 等二进制格式用）
         *
         * @param filePath - 必填参数，文件绝对路径
         * @returns 成功返回 Promise<{ base64: string }>；失败返回 Promise<{ error: string }>
         */
        readFileBytes(filePath) {
            return ipcRenderer.invoke('ebook:read-file-bytes', filePath);
        },
        /**
         * 计算文件原始内容 sha256（内容身份，用于换路径重新导入时复用标注/进度）
         *
         * @param filePath - 必填参数，文件绝对路径
         * @returns 成功返回 Promise<{ success: boolean; hash?: string; error?: string }>
         */
        computeFileHash(filePath) {
            return ipcRenderer.invoke('ebook:compute-file-hash', filePath);
        },
        /**
         * 获取指定电子书文件的阅读进度
         *
         * @param filePath - 必填参数，电子书文件的绝对路径
         * @returns 成功返回 Promise<{ success: boolean; data?: EbookProgress; error?: string }>；
         *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
         */
        getProgress(filePath, contentHash) {
            return ipcRenderer.invoke('ebook:get-progress', filePath, contentHash);
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
        saveProgress(data) {
            return ipcRenderer.invoke('ebook:save-progress', data);
        },
        /**
         * 获取书架列表（按上次阅读时间倒序）
         *
         * @returns 成功返回 Promise<{ success: true; data: BookshelfRecord[] }>（无记录时 data 为空数组）；
         *          失败返回 Promise<{ success: false; error: string }>
         */
        getBookshelf() {
            return ipcRenderer.invoke('ebook:get-bookshelf');
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
        addToBookshelf(data) {
            return ipcRenderer.invoke('ebook:add-to-bookshelf', data);
        },
        /**
         * 按 file_path 删除书架记录
         *
         * @param filePath - 必填参数，电子书文件绝对路径
         * @returns 成功返回 Promise<{ success: boolean; error?: string }>；
         *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
         */
        removeFromBookshelf(filePath) {
            return ipcRenderer.invoke('ebook:remove-from-bookshelf', filePath);
        },
        /**
         * 获取指定电子书文件的笔记与划线列表（按创建时间升序）
         *
         * @param filePath - 必填参数，电子书文件绝对路径
         * @returns 成功返回 Promise<{ success: true; data: AnnotationRecord[] }>（无记录时 data 为空数组）；
         *          失败返回 Promise<{ success: false; error: string }>
         */
        getAnnotations(filePath, contentHash) {
            return ipcRenderer.invoke('ebook:get-annotations', filePath, contentHash);
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
        addAnnotation(data) {
            return ipcRenderer.invoke('ebook:add-annotation', data);
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
        updateAnnotation(data) {
            return ipcRenderer.invoke('ebook:update-annotation', data);
        },
        /**
         * 按 id 删除笔记与划线记录
         *
         * @param id - 必填参数，笔记记录主键 id
         * @returns 成功返回 Promise<{ success: boolean; error?: string }>；
         *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
         */
        removeAnnotation(id) {
            return ipcRenderer.invoke('ebook:remove-annotation', id);
        },
        /**
         * 按 file_path 批量删除笔记与划线记录（scope: 'note' | 'highlight' | 'all'）
         *
         * @param data - 必填参数，{ filePath: 文件绝对路径, scope: 删除范围 }
         * @returns 成功返回 Promise<{ success: boolean; deleted?: number; error?: string }>；
         *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
         */
        removeAnnotations(data) {
            return ipcRenderer.invoke('ebook:remove-annotations', data);
        },
        /**
         * 批量统计每本书的笔记、划线与书签数量（供书架卡片显示徽标）
         *
         * @param filePaths - 必填参数，文件绝对路径数组
         * @param contentHashes - 可选参数，与 filePaths 对应的内容哈希数组；用于把同哈希、不同路径的共享数据一并计入
         * @returns 成功返回 Promise<{ success: true; data: { key, noteCount, highlightCount, bookmarkCount }[] }>；
         *          失败返回 Promise<{ success: false; error: string }>
         */
        getAnnotationCounts(filePaths, contentHashes) {
            return ipcRenderer.invoke('ebook:get-annotation-counts', filePaths, contentHashes);
        },
        /**
         * 导出笔记与划线为 Markdown 文件（弹出系统保存对话框）
         *
         * @param data - 必填参数，{ filePath?, title? }；filePath 为空表示导出全部书
         * @returns 成功返回 Promise<{ success: true; savedPath: string }>；
         *          取消/失败返回 Promise<{ success: false; error?: string }>
         */
        exportAnnotations(data) {
            return ipcRenderer.invoke('ebook:export-annotations', data);
        },
        /**
         * 获取指定电子书文件的书签列表（按阅读进度升序）
         *
         * @param filePath - 必填参数，电子书文件绝对路径
         * @returns 成功返回 Promise<{ success: true; data: BookmarkRecord[] }>（无记录时 data 为空数组）；
         *          失败返回 Promise<{ success: false; error: string }>
         */
        getBookmarks(filePath, contentHash) {
            return ipcRenderer.invoke('ebook:get-bookmarks', filePath, contentHash);
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
        addBookmark(data) {
            return ipcRenderer.invoke('ebook:add-bookmark', data);
        },
        /**
         * 按数据库 id 删除书签记录
         *
         * @param id - 必填参数，书签记录主键 id
         * @returns 成功返回 Promise<{ success: boolean; error?: string }>；
         *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
         */
        removeBookmark(id) {
            return ipcRenderer.invoke('ebook:remove-bookmark', id);
        },
        /**
         * 保存书籍基本信息（标题/作者/封面），由渲染进程解析后回传，供书架列表秒出、无需每次重新解析
         *
         * @param data - 必填参数，{ filePath, name?, format?, title?, author?, cover? }
         * @returns 成功返回 Promise<{ success: boolean; error?: string }>；
         *          失败返回 Promise 中 success 为 false，并附带 error 错误信息
         */
        saveBookMeta(data) {
            return ipcRenderer.invoke('ebook:save-book-meta', data);
        },
    },
    on(...args) {
        const [channel, listener] = args;
        return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
    },
    once(...args) {
        const [channel, listener] = args;
        return ipcRenderer.once(channel, (event, ...args) => listener(event, ...args));
    },
    off(...args) {
        const [channel, ...omit] = args;
        return ipcRenderer.off(channel, ...omit);
    },
    send(...args) {
        const [channel, ...omit] = args;
        return ipcRenderer.send(channel, ...omit);
    },
    sendSync(...args) {
        const [channel, ...omit] = args;
        return ipcRenderer.sendSync(channel, ...omit);
    },
    invoke(...args) {
        const [channel, ...omit] = args;
        return ipcRenderer.invoke(channel, ...omit);
    },
    removeAllListeners(...args) {
        const [channel, ...omit] = args;
        return ipcRenderer.removeAllListeners(channel, ...omit);
    },
    // You can expose other APTs you need here.
    // ...
});
// --------- Preload scripts loading ---------
function domReady(condition = ['complete', 'interactive']) {
    return new Promise((resolve) => {
        if (condition.includes(document.readyState)) {
            resolve(true);
        }
        else {
            document.addEventListener('readystatechange', () => {
                if (condition.includes(document.readyState)) {
                    resolve(true);
                }
            });
        }
    });
}
const safeDOM = {
    append(parent, child) {
        if (!Array.from(parent.children).find(e => e === child)) {
            return parent.appendChild(child);
        }
    },
    remove(parent, child) {
        if (Array.from(parent.children).find(e => e === child)) {
            return parent.removeChild(child);
        }
    },
};
/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
    const className = `loaders-css__square-spin`;
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
    `;
    const oStyle = document.createElement('style');
    const oDiv = document.createElement('div');
    oStyle.id = 'app-loading-style';
    oStyle.innerHTML = styleContent;
    oDiv.className = 'app-loading-wrap';
    oDiv.innerHTML = `<div class="${className}"><div></div></div>`;
    return {
        appendLoading() {
            safeDOM.append(document.head, oStyle);
            safeDOM.append(document.body, oDiv);
        },
        removeLoading() {
            safeDOM.remove(document.head, oStyle);
            safeDOM.remove(document.body, oDiv);
        },
    };
}
// ----------------------------------------------------------------------
const { appendLoading, removeLoading } = useLoading();
domReady().then(appendLoading);
window.onmessage = (ev) => {
    ev.data.payload === 'removeLoading' && removeLoading();
};
setTimeout(removeLoading, 3000);
export {};
