/**
 * 电子书模块
 * 提供电子书（epub、txt 等）的解析、阅读、进度保存等功能
 * 支持的格式：epub（通过 epubjs 解析）、txt（通过 iconv-lite 与 chardet 进行编码检测和转换）
 *
 * 本模块复用 newSql.ts 中的主数据库实例（db.sqlite），不新建独立数据库文件。
 */
/**
 * 电子书阅读进度数据结构
 */
interface EbookProgress {
    /** 文件绝对路径 */
    filePath: string;
    /** 文件格式，如 'epub'、'txt' */
    format: string;
    /** epub.js 的 cfi 定位信息（仅 epub 格式有效） */
    cfi?: string;
    /** 阅读进度百分比，范围 0-100 */
    percent: number;
}
/**
 * read-txt 成功返回结构
 */
interface ReadTxtSuccess {
    /** 解码后的 UTF-8 文本内容 */
    content: string;
    /** 检测到的文件编码名称（如 'UTF-8'、'GB18030'、'UTF-16LE'） */
    encoding: string;
    /** 文件字节数 */
    size: number;
}
/**
 * read-txt 失败返回结构
 */
interface ReadTxtError {
    /** 中文错误信息 */
    error: string;
}
/**
 * save-progress 入参结构
 */
interface SaveProgressData {
    /** 文件绝对路径 */
    filePath: string;
    /** 文件格式，'txt' 或 'epub' */
    format: string;
    /** 电子书文件名（含扩展名），首次保存且书架尚无记录时用于补全书架条目 */
    name?: string;
    /** EPUB 的 cfi 或 TXT 的字符位置 */
    cfi: string;
    /** 阅读百分比 0-100 */
    percent: number;
    /** 文件原始内容 sha256（内容身份，用于换路径复用标注/进度） */
    contentHash?: string;
}
/**
 * 数据库中的阅读进度记录结构
 */
interface ProgressRecord {
    /** 文件绝对路径（主键） */
    file_path: string;
    /** 文件格式 */
    format: string;
    /** EPUB 的 cfi 或 TXT 的字符位置 */
    cfi: string;
    /** 阅读百分比 0-100 */
    percent: number;
    /** 更新时间（ISO 字符串） */
    updated_at: string;
    /** 文件原始内容 sha256（内容身份） */
    content_hash: string;
}
/**
 * 数据库中的书架记录结构（对应 ebook_bookshelf 表的每一行）
 */
interface BookshelfRecord {
    /** 文件绝对路径（主键） */
    file_path: string;
    /** 文件名（含扩展名） */
    name: string;
    /** 文件格式：'txt' 或 'epub' 或 'pdf' */
    format: string;
    /** 阅读百分比 0-100 */
    percent: number;
    /** 上次阅读时间（ISO 字符串） */
    last_read_at: string;
    /** 首次添加时间（ISO 字符串） */
    added_at: string;
    /** 书籍标题（从 EPUB/PDF 元数据解析，无则空串，回退文件名） */
    title: string;
    /** 作者（从 EPUB/PDF 元数据解析，无则空串） */
    author: string;
    /** 封面图 data URL（JPEG/PNG base64，无则空串） */
    cover: string;
    /** 文件原始内容 sha256（内容身份，用于换路径重新导入时复用标注/进度） */
    content_hash: string;
}
/**
 * add-to-bookshelf 入参结构
 */
interface AddBookshelfData {
    /** 文件绝对路径 */
    filePath: string;
    /** 文件名（含扩展名） */
    name: string;
    /** 文件格式：'txt' 或 'epub' */
    format: string;
    /** 阅读百分比 0-100 */
    percent: number;
    /** 文件原始内容 sha256（内容身份，用于换路径复用标注/进度） */
    contentHash?: string;
}
/**
 * 数据库中的笔记与划线记录结构（对应 ebook_annotation 表的每一行）
 */
interface AnnotationRecord {
    /** 自增主键 */
    id: number;
    /** 文件绝对路径 */
    file_path: string;
    /** 文件格式：'txt' 或 'epub' */
    format: string;
    /** 定位锚点（EPUB 用 cfiRange 字符串；TXT 用 "start-end" 字符偏移字符串如 "1520-1545"） */
    anchor: string;
    /** 选中的原文摘录 */
    text: string;
    /** 笔记内容，可空 */
    note: string | null;
    /** 高亮颜色标识，默认 'yellow' */
    color: string;
    /** 划线类型：'highlight'（高亮）、'underline'（下划线）等，默认 'highlight' */
    type: string;
    /** 创建时间（ISO 字符串） */
    created_at: string;
    /** 更新时间（ISO 字符串） */
    updated_at: string;
    /** 文件原始内容 sha256（内容身份） */
    content_hash: string;
}
/**
 * add-annotation 入参结构
 */
interface AddAnnotationData {
    /** 文件绝对路径 */
    filePath: string;
    /** 文件格式：'txt' 或 'epub' */
    format: string;
    /** 定位锚点（EPUB 用 cfiRange 字符串；TXT 用 "start-end" 字符偏移字符串） */
    anchor: string;
    /** 选中的原文摘录 */
    text: string;
    /** 笔记内容，可空 */
    note?: string | null;
    /** 高亮颜色标识，默认 'yellow' */
    color?: string;
    /** 划线类型：'highlight'（高亮）、'underline'（下划线）等，默认 'highlight' */
    type?: string;
    /** 文件原始内容 sha256（内容身份） */
    contentHash?: string;
}
/**
 * 数据库中的书签记录结构（对应 ebook_bookmark 表的每一行）
 */
interface BookmarkRecord {
    /** 自增主键 */
    id: number;
    /** 文件绝对路径 */
    file_path: string;
    /** 文件格式：'txt' 或 'epub' */
    format: string;
    /** 定位锚点（EPUB 用 cfi 字符串；TXT 用字符偏移字符串如 "1520"） */
    cfi: string;
    /** 书签标题（如当前章节名），可空 */
    label: string | null;
    /** 阅读百分比 0-100，用于排序 */
    percent: number;
    /** 创建时间（ISO 字符串） */
    created_at: string;
    /** 文件原始内容 sha256（内容身份） */
    content_hash: string;
}
/**
 * add-bookmark 入参结构
 */
interface AddBookmarkData {
    /** 文件绝对路径 */
    filePath: string;
    /** 文件格式：'txt' 或 'epub' */
    format: string;
    /** 定位锚点（EPUB 用 cfi；TXT 用字符偏移） */
    cfi: string;
    /** 书签标题，可空 */
    label?: string | null;
    /** 阅读百分比 0-100 */
    percent?: number;
    /** 文件原始内容 sha256（内容身份） */
    contentHash?: string;
}
/**
 * update-annotation 入参结构
 */
interface UpdateAnnotationData {
    /** 笔记记录主键 id */
    id: number;
    /** 笔记内容，可空 */
    note?: string | null;
    /** 高亮颜色标识 */
    color?: string;
    /** 划线类型：'highlight'（高亮）、'underline'（下划线）等 */
    type?: string;
}
/**
 * export-annotations 入参结构
 */
interface ExportAnnotationsData {
    /** 文件绝对路径；为空（不传或空串）表示导出全部书的笔记与划线 */
    filePath?: string;
    /** 导出标题（Markdown 一级标题 + 默认文件名），如《书名》或「全部笔记」 */
    title?: string;
    /** 文件原始内容 sha256（内容身份）；提供时按内容身份查询，覆盖多副本共用标注 */
    contentHash?: string;
}
/**
 * 电子书模块初始化
 * 注册所有 ebook 相关 IPC 监听：
 * - ebook:read-txt           读取 txt 文件内容（自动检测编码并转为 UTF-8）
 * - ebook:get-progress       获取指定文件的阅读进度
 * - ebook:save-progress      保存阅读进度（upsert）
 * - ebook:get-bookshelf      获取书架列表（按上次阅读时间倒序）
 * - ebook:add-to-bookshelf   添加或更新书架记录（upsert，保留首次添加时间）
 * - ebook:remove-from-bookshelf 按 file_path 删除书架记录
 * - ebook:get-annotations    获取指定文件的笔记与划线列表（按创建时间升序）
 * - ebook:add-annotation     新增笔记与划线记录（返回自增 id）
 * - ebook:update-annotation  更新笔记内容与高亮颜色（按 id）
 * - ebook:remove-annotation  删除指定 id 的笔记与划线记录
 *
 * 建表失败不会中断 handler 注册，handler 内部对数据库异常做容错处理。
 *
 * @returns 无返回值（Promise）
 * @throws 不会抛出异常，所有异常由 ipcMain.handle 内部捕获并通过返回值传递
 */
export declare function initEbook(): Promise<void>;
export type { EbookProgress, ReadTxtSuccess, ReadTxtError, SaveProgressData, ProgressRecord, BookshelfRecord, AddBookshelfData, AnnotationRecord, AddAnnotationData, UpdateAnnotationData, ExportAnnotationsData, BookmarkRecord, AddBookmarkData };
