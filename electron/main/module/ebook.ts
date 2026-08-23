/**
 * 电子书模块
 * 提供电子书（epub、txt 等）的解析、阅读、进度保存等功能
 * 支持的格式：epub（通过 epubjs 解析）、txt（通过 iconv-lite 与 chardet 进行编码检测和转换）
 *
 * 本模块复用 newSql.ts 中的主数据库实例（db.sqlite），不新建独立数据库文件。
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import log from 'electron-log';
import chardet from 'chardet';
import iconv from 'iconv-lite';
import type { Database } from 'sqlite3';
import {
  myDb,
  query,
  insert,
  upsert,
  update,
  del,
  ensureTableExists
} from './newSql.ts';

/** 电子书阅读进度表名（复用主数据库 db.sqlite） */
const EBOOK_PROGRESS_TABLE = 'ebook_progress';

/** 电子书书架表名（存储打开过的电子书记录，便于快速打开） */
const EBOOK_BOOKSHELF_TABLE = 'ebook_bookshelf';

/** 电子书笔记与划线表名（存储高亮、摘录、笔记记录） */
const EBOOK_ANNOTATION_TABLE = 'ebook_annotation';

/** 电子书书签表名（存储用户手动添加的翻页书签，基于 epub cfi 或 txt 偏移定位） */
const EBOOK_BOOKMARK_TABLE = 'ebook_bookmark';

/** 电子书分类表名（用户自定义的分类，如「小说」「技术」），name 唯一 */
const EBOOK_CATEGORY_TABLE = 'ebook_category';

/** 电子书「书-分类」多对多映射表名（book_path 关联 category_id） */
const EBOOK_BOOK_CATEGORY_TABLE = 'ebook_book_category';

/** 电子书阅读背景图库表名（保存用户选择过的背景图，按来源文件路径去重，跨格式共享） */
const EBOOK_BG_IMAGE_TABLE = 'ebook_bg_image';

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
 * save-book-meta 入参结构（书籍基本信息，由渲染进程解析后回传）
 */
interface SaveBookMetaData {
  /** 文件绝对路径 */
  filePath: string;
  /** 文件名（含扩展名），UPDATE 未命中需新建行时兜底 */
  name?: string;
  /** 文件格式：'txt' / 'epub' / 'pdf'，新建行时兜底 */
  format?: string;
  /** 文件原始内容 sha256（内容身份） */
  contentHash?: string;
  /** 书籍标题（EPUB/PDF 元数据解析结果，无则空串） */
  title?: string;
  /** 作者（EPUB/PDF 元数据解析结果，无则空串） */
  author?: string;
  /** 封面图 data URL（JPEG/PNG base64，无则空串） */
  cover?: string;
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

/** 单本书的笔记/划线/书签数量统计（get-annotation-counts 返回项） */
interface AnnotationCountItem {
  /** 聚合键：有内容哈希时为 content_hash（多副本共用），否则为 file_path */
  key: string;
  /** 该聚合分组下的所有文件绝对路径（用于前端按 path 兜底索引，兼容书架行 content_hash 为空的情况） */
  paths: string[];
  /** 笔记数量（note 非空） */
  noteCount: number;
  /** 划线数量（note 为空） */
  highlightCount: number;
  /** 书签数量（按内容身份共用，与笔记/划线同源聚合） */
  bookmarkCount: number;
}

/**
 * 规范化编码名称并确保 iconv-lite 支持
 *
 * 将 chardet 返回的编码名映射到 iconv-lite 支持的编码名：
 * - chardet 可能返回 'GB2312'/'GBK'，iconv-lite 均支持，但统一归一到 'GB18030' 以兼容更广字符集
 * - 若 iconv-lite 不支持该编码则降级为 'UTF-8'
 *
 * @param detected - chardet 检测到的编码名，如 'UTF-8'、'GB18030'、'UTF-16LE'；可能为 null
 * @returns iconv-lite 一定支持的编码名；无法识别时返回 'UTF-8'
 */
function resolveEncoding(detected: string | null | undefined): string {
  // chardet 检测失败时默认 UTF-8
  if (!detected) {
    return 'UTF-8';
  }
  const upper = detected.toUpperCase();
  // 中文编码兜底：GB2312/GBK 统一用 GB18030 解码（向下兼容且覆盖更全）
  const candidates: string[] = [upper, detected];
  if (upper === 'GB2312' || upper === 'GBK') {
    candidates.push('GB18030');
  }
  for (const candidate of candidates) {
    if (iconv.encodingExists(candidate)) {
      return candidate;
    }
  }
  log.warn(`Unsupported encoding detected: ${detected}, fallback to UTF-8`);
  return 'UTF-8';
}

/**
 * 去除字符串首部的 BOM 字符（U+FEFF）
 *
 * UTF-8 带 BOM 文件解码后字符串首个字符为 U+FEFF，需手动去除。
 *
 * @param text - 已解码的字符串
 * @returns 去除 BOM 后的字符串；无 BOM 时原样返回
 */
function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/** 受支持的电子书文件后缀（文件夹导入与批量导入共用） */
const SUPPORTED_EBOOK_EXT = ['txt', 'epub', 'pdf'];

/**
 * 递归收集文件夹内所有受支持的电子书文件（txt / epub / pdf）绝对路径。
 * 为避免无意义扫描与符号链接环：
 * - 跳过以 '.' 开头的隐藏目录（如 .git、.vscode）
 * - 符号链接目录 isDirectory() 为 false，自然不会被递归进入，避免死循环
 * - 限制递归深度（depth），防止过深的目录结构造成栈溢出
 *
 * @param dir - 要扫描的目录绝对路径
 * @param out - 收集结果的数组（递归共享同一引用）
 * @param depth - 当前递归深度（从 0 开始）
 */
function collectEbookFiles(dir: string, out: string[], depth: number): void {
  if (depth > 20) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // 跳过隐藏目录（.git / .vscode 等），避免无意义扫描
      if (entry.name.startsWith('.')) continue;
      collectEbookFiles(full, out, depth + 1);
    } else if (entry.isFile()) {
      const ext = entry.name.split('.').pop()?.toLowerCase() || '';
      if (SUPPORTED_EBOOK_EXT.includes(ext)) {
        out.push(full);
      }
    }
  }
}

/**
 * 包装 sqlite3 的 db.run 为 Promise
 *
 * @param db - sqlite3 数据库实例
 * @param sql - SQL 语句
 * @param params - 绑定参数数组，默认为空数组
 * @returns 成功 resolve { lastID, changes }；失败 reject Error
 */
function dbRunAsync(
  db: Database,
  sql: string,
  params: any[] = []
): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

/**
 * 按内容身份关联同一本书的分散记录（换路径重新导入时复用标注/书签/进度）。
 *
 * 逻辑：
 * 仅给「当前路径自己」的遗留记录补上 content_hash（兼容升级前、尚未带哈希的数据）。
 * 注意：本函数刻意不做任何跨路径的「搬移 / 删除」操作——
 * 同一内容的多份副本（不同 file_path、相同 content_hash）是互相独立的「引用」，
 * 各自保留书架行；标注 / 书签 / 进度等共享数据以 content_hash 为身份键，
 * 由读取侧（get-annotations / get-bookmarks / get-progress）按哈希优先命中实现共用，
 * 删除某一份副本只删其书架引用行，不影响其它副本与共享数据。
 *
 * @param db - sqlite3 数据库实例
 * @param filePath - 当前打开文件的绝对路径
 * @param contentHash - 当前文件原始内容 sha256；为空时不处理
 */
async function ensureBookIdentity(
  db: Database,
  filePath: string,
  contentHash?: string
): Promise<void> {
  if (!contentHash) return;
  // 仅补全当前路径自身记录的 content_hash，便于后续按哈希优先读取；不触碰其它副本。
  for (const table of [
    EBOOK_ANNOTATION_TABLE,
    EBOOK_BOOKMARK_TABLE,
    EBOOK_PROGRESS_TABLE,
    EBOOK_BOOKSHELF_TABLE
  ]) {
    await dbRunAsync(
      db,
      `UPDATE ${table} SET content_hash = ? WHERE file_path = ? AND (content_hash IS NULL OR content_hash = '')`,
      [contentHash, filePath]
    );
  }
}

/**
 * 创建电子书阅读进度表（IF NOT EXISTS）
 *
 * 表结构：
 * - file_path TEXT PRIMARY KEY  文件绝对路径（主键）
 * - format    TEXT              文件格式（'txt' 或 'epub'）
 * - cfi       TEXT              EPUB 的 cfi 或 TXT 的字符位置
 * - percent   REAL              阅读百分比 0-100
 * - updated_at TEXT             更新时间（ISO 字符串）
 *
 * @returns 成功 resolve void；失败 reject Error（如数据库未初始化）
 */
async function createProgressTable(): Promise<void> {
  const db = myDb.db;
  if (!db) {
    throw new Error('数据库未初始化');
  }
  const sql = `CREATE TABLE IF NOT EXISTS ${EBOOK_PROGRESS_TABLE} (
    file_path TEXT PRIMARY KEY,
    format TEXT,
    cfi TEXT,
    percent REAL,
    updated_at TEXT,
    content_hash TEXT
  )`;
  await dbRunAsync(db, sql);
}

/**
 * 创建电子书书架表（IF NOT EXISTS）
 *
 * 表结构：
 * - file_path   TEXT PRIMARY KEY  文件绝对路径（主键）
 * - name        TEXT              文件名（含扩展名）
 * - format      TEXT              文件格式（'txt' 或 'epub'）
 * - percent     REAL              阅读百分比 0-100
 * - last_read_at TEXT             上次阅读时间（ISO 字符串）
 * - added_at    TEXT              首次添加时间（ISO 字符串）
 *
 * @returns 成功 resolve void；失败 reject Error（如数据库未初始化）
 */
async function createBookshelfTable(): Promise<void> {
  const db = myDb.db;
  if (!db) {
    throw new Error('数据库未初始化');
  }
  const sql = `CREATE TABLE IF NOT EXISTS ${EBOOK_BOOKSHELF_TABLE} (
    file_path TEXT PRIMARY KEY,
    name TEXT,
    format TEXT,
    percent REAL,
    last_read_at TEXT,
    added_at TEXT,
    title TEXT,
    author TEXT,
    cover TEXT,
    content_hash TEXT
  )`;
  await dbRunAsync(db, sql);
}

/**
 * 创建电子书笔记与划线表（IF NOT EXISTS）
 *
 * 表结构：
 * - id         INTEGER PRIMARY KEY AUTOINCREMENT  自增主键
 * - file_path  TEXT                               文件绝对路径
 * - format     TEXT                               文件格式（'txt' 或 'epub'）
 * - anchor     TEXT                               定位锚点（EPUB 用 cfiRange；TXT 用 "start-end" 字符偏移）
 * - text       TEXT                               选中的原文摘录
 * - note       TEXT                               笔记内容，可空
 * - color      TEXT                               高亮颜色标识，默认 'yellow'
 * - created_at TEXT                               创建时间（ISO 字符串）
 * - updated_at TEXT                               更新时间（ISO 字符串）
 *
 * @returns 成功 resolve void；失败 reject Error（如数据库未初始化）
 */
async function createAnnotationTable(): Promise<void> {
  const db = myDb.db;
  if (!db) {
    throw new Error('数据库未初始化');
  }
  const sql = `CREATE TABLE IF NOT EXISTS ${EBOOK_ANNOTATION_TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT,
    format TEXT,
    anchor TEXT,
    text TEXT,
    note TEXT,
    color TEXT DEFAULT 'yellow',
    type TEXT DEFAULT 'highlight',
    created_at TEXT,
    updated_at TEXT,
    content_hash TEXT
  )`;
  await dbRunAsync(db, sql);
}

/**
 * 创建电子书书签表（IF NOT EXISTS）
 *
 * 表结构：
 * - id         INTEGER PRIMARY KEY AUTOINCREMENT  自增主键
 * - file_path  TEXT                               文件绝对路径
 * - format     TEXT                               文件格式（'txt' 或 'epub'）
 * - cfi        TEXT                               定位锚点（EPUB 用 cfi；TXT 用字符偏移）
 * - label      TEXT                               书签标题，可空
 * - percent    REAL                               阅读百分比 0-100，用于排序
 * - created_at TEXT                               创建时间（ISO 字符串）
 *
 * @returns 成功 resolve void；失败 reject Error（如数据库未初始化）
 */
async function createBookmarkTable(): Promise<void> {
  const db = myDb.db;
  if (!db) {
    throw new Error('数据库未初始化');
  }
  const sql = `CREATE TABLE IF NOT EXISTS ${EBOOK_BOOKMARK_TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT,
    format TEXT,
    cfi TEXT,
    label TEXT,
    percent REAL,
    created_at TEXT,
    content_hash TEXT
  )`;
  await dbRunAsync(db, sql);
}

/**
 * 创建电子书分类表（IF NOT EXISTS）
 *
 * 表结构：
 * - id          INTEGER PRIMARY KEY AUTOINCREMENT  自增主键
 * - name        TEXT                               分类名称（唯一，如「小说」「技术」）
 * - created_at  TEXT                               创建时间（ISO 字符串）
 *
 * @returns 成功 resolve void；失败 reject Error（如数据库未初始化）
 */
async function createCategoryTable(): Promise<void> {
  const db = myDb.db;
  if (!db) {
    throw new Error('数据库未初始化');
  }
  const sql = `CREATE TABLE IF NOT EXISTS ${EBOOK_CATEGORY_TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    color TEXT,
    created_at TEXT
  )`;
  await dbRunAsync(db, sql);
}

/**
 * 创建电子书「书-分类」多对多映射表（IF NOT EXISTS）
 *
 * 表结构：
 * - book_path    TEXT  书架条目绝对路径（联合主键之一）
 * - category_id  INT   关联 ebook_category.id（联合主键之一）
 * 联合主键 (book_path, category_id) 保证一本书同一分类不重复关联。
 *
 * @returns 成功 resolve void；失败 reject Error（如数据库未初始化）
 */
async function createBookCategoryTable(): Promise<void> {
  const db = myDb.db;
  if (!db) {
    throw new Error('数据库未初始化');
  }
  const sql = `CREATE TABLE IF NOT EXISTS ${EBOOK_BOOK_CATEGORY_TABLE} (
    book_path TEXT,
    category_id INTEGER,
    PRIMARY KEY (book_path, category_id)
  )`;
  await dbRunAsync(db, sql);
}

/**
 * 创建电子书阅读背景图库表（IF NOT EXISTS）
 *
 * 表结构：
 * - id          INTEGER 自增主键
 * - image_path  TEXT    背景图来源文件的绝对路径（UNIQUE，用于按路径去重，跨格式共享）
 * - data_url    TEXT    背景图 data URL（平铺方式作为阅读区背景）
 * - created_at  TEXT    首次加入时间（ISO 字符串）
 * image_path 唯一约束保证同一张图（无论通过哪种格式的电子书选择）只保存一份。
 *
 * @returns 成功 resolve void；失败 reject Error（如数据库未初始化）
 */
async function createBgImageTable(): Promise<void> {
  const db = myDb.db;
  if (!db) {
    throw new Error('数据库未初始化');
  }
  const sql = `CREATE TABLE IF NOT EXISTS ${EBOOK_BG_IMAGE_TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_path TEXT UNIQUE,
    data_url TEXT,
    created_at TEXT
  )`;
  await dbRunAsync(db, sql);
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
export async function initEbook(): Promise<void> {
  log.info('Initializing ebook module...');

  // 1. 创建阅读进度表（复用主数据库 db.sqlite，不新建独立数据库文件）
  try {
    await createProgressTable();
  } catch (err) {
    log.error('Failed to create ebook_progress table:', err);
  }

  // 2. 创建书架表（与阅读进度表并列，独立 try/catch，互不影响）
  try {
    await createBookshelfTable();
  } catch (err) {
    log.error('Failed to create ebook_bookshelf table:', err);
  }

  // 3. 创建笔记与划线表（与上述表并列，独立 try/catch，互不影响）
  try {
    await createAnnotationTable();
  } catch (err) {
    log.error('Failed to create ebook_annotation table:', err);
  }

  // 3.1 创建书签表（与上述表并列，独立 try/catch，互不影响）
  try {
    await createBookmarkTable();
  } catch (err) {
    log.error('Failed to create ebook_bookmark table:', err);
  }

  // 3.2 创建分类表与「书-分类」映射表（与上述表并列，独立 try/catch，互不影响）
  try {
    await createCategoryTable();
  } catch (err) {
    log.error('Failed to create ebook_category table:', err);
  }
  try {
    await createBookCategoryTable();
  } catch (err) {
    log.error('Failed to create ebook_book_category table:', err);
  }

  // 3.3 创建阅读背景图库表（与上述表并列，独立 try/catch，互不影响）
  try {
    await createBgImageTable();
  } catch (err) {
    log.error('Failed to create ebook_bg_image table:', err);
  }

  // 4. 与 newSql.ts 保持一致：确保各表列完整，自动补齐旧库中缺失的列
  //    （例如老版本建表时还没有 type 列，这里会 ALTER TABLE ADD COLUMN 补齐，
  //      否则后续 INSERT/UPDATE 引用 type 会报 SQLITE_ERROR: no column named type）
  try {
    await ensureTableExists(
      EBOOK_PROGRESS_TABLE,
      ['format', 'cfi', 'percent', 'updated_at', 'content_hash'],
      'file_path'
    );
    await ensureTableExists(
      EBOOK_BOOKSHELF_TABLE,
      ['name', 'format', 'percent', 'last_read_at', 'added_at', 'title', 'author', 'cover', 'content_hash'],
      'file_path'
    );
    await ensureTableExists(
      EBOOK_ANNOTATION_TABLE,
      ['file_path', 'format', 'anchor', 'text', 'note', 'color', 'type', 'created_at', 'updated_at', 'content_hash'],
      'id'
    );
    await ensureTableExists(
      EBOOK_BOOKMARK_TABLE,
      ['file_path', 'format', 'cfi', 'label', 'percent', 'created_at', 'content_hash'],
      'id'
    );
    await ensureTableExists(
      EBOOK_CATEGORY_TABLE,
      ['name', 'color', 'created_at'],
      'id'
    );
    await ensureTableExists(
      EBOOK_BOOK_CATEGORY_TABLE,
      ['category_id'],
      'book_path'
    );
    await ensureTableExists(
      EBOOK_BG_IMAGE_TABLE,
      ['data_url', 'created_at'],
      'id'
    );
  } catch (err) {
    log.error('Failed to ensure ebook tables columns:', err);
  }

  // ============ ebook:read-txt 读取 txt 文件 ============
  /**
   * 读取 txt 文件并自动检测编码转换为 UTF-8
   *
   * @param _event - IPC 事件对象（未使用）
   * @param filePath - 必填参数，txt 文件的绝对路径
   * @returns 成功返回 ReadTxtSuccess（含 content/encoding/size）；
   *          失败返回 ReadTxtError（含 error 中文错误信息）
   */
  ipcMain.handle(
    'ebook:read-txt',
    async (_event, filePath: string): Promise<ReadTxtSuccess | ReadTxtError> => {
      try {
        if (!filePath || typeof filePath !== 'string') {
          return { error: '文件路径不能为空' };
        }
        // 以 Buffer 形式读取原始字节，便于编码检测
        const buffer: Buffer = fs.readFileSync(filePath);
        const size = buffer.length;
        // chardet 检测编码
        const detected = chardet.detect(buffer);
        const encoding = resolveEncoding(detected);
        // iconv-lite 按检测到的编码解码为 UTF-8 字符串
        let content: string;
        // 用 encodingExists 做类型收窄，确保 encoding 为 iconv 支持的编码
        if (iconv.encodingExists(encoding)) {
          content = iconv.decode(buffer, encoding);
        } else {
          content = iconv.decode(buffer, 'UTF-8');
        }
        // 去除可能存在的 BOM 字符（U+FEFF）
        content = stripBom(content);
        log.info(
          `Read txt file: ${filePath}, size=${size}, encoding=${encoding}`
        );
        return { content, encoding, size };
      } catch (err: any) {
        log.error('Failed to read txt file:', err);
        return {
          error: `读取 txt 文件失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:read-file-bytes 读取任意文件二进制（base64） ============
  /**
   * 以 base64 形式读取文件原始字节（用于 PDF 等需二进制数据的格式）。
   * 渲染进程无 Node fs 权限，由主进程读取后返回 base64 字符串，避免 IPC 传输 Buffer 的兼容性问题。
   *
   * @param _event - IPC 事件对象（未使用）
   * @param filePath - 必填参数，文件绝对路径
   * @returns 成功返回 { base64 }；失败返回 { error }
   */
  ipcMain.handle(
    'ebook:read-file-bytes',
    async (
      _event,
      filePath: string
    ): Promise<{ base64?: string; error?: string }> => {
      try {
        if (!filePath || typeof filePath !== 'string') {
          return { error: '文件路径不能为空' };
        }
        const buffer: Buffer = fs.readFileSync(filePath);
        return { base64: buffer.toString('base64') };
      } catch (err: any) {
        log.error('Failed to read file bytes:', err);
        return { error: `读取文件失败：${err?.message || String(err)}` };
      }
    }
  );

  // ============ ebook:get-file-size 获取文件大小（区间加载 PDF 需要 length） ============
  ipcMain.handle(
    'ebook:get-file-size',
    async (_event, filePath: string): Promise<{ size?: number; error?: string }> => {
      try {
        if (!filePath || typeof filePath !== 'string') {
          return { error: '文件路径不能为空' };
        }
        const st = fs.statSync(filePath);
        return { size: st.size };
      } catch (err: any) {
        log.error('Failed to get file size:', err);
        return { error: `获取文件大小失败：${err?.message || String(err)}` };
      }
    }
  );

  // ============ ebook:read-file-range 按字节区间读取文件（PDF 区间/流式加载，避免整文件载入） ============
  /**
   * 按 [start, end) 字节区间读取文件，返回 ArrayBuffer（结构化克隆传回渲染进程，无需 base64 往返）。
   * 渲染进程的 pdf.js 通过 PDFDataRangeTransport 的 requestDataRange 回调按需调用本接口，
   * 只拉取当前需要的字节（xref、指定页等），不把整文件读入内存，从源头解决大文件初始化慢。
   *
   * @param _event - IPC 事件对象（未使用）
   * @param filePath - 必填参数，文件绝对路径
   * @param start - 区间起始字节（含）
   * @param end - 区间结束字节（不含）
   * @returns 成功返回 { buffer: ArrayBuffer }；失败返回 { error: string }
   */
  ipcMain.handle(
    'ebook:read-file-range',
    async (
      _event,
      filePath: string,
      start: number,
      end: number
    ): Promise<{ buffer?: ArrayBuffer; error?: string }> => {
      try {
        if (!filePath || typeof filePath !== 'string') {
          return { error: '文件路径不能为空' };
        }
        const st = fs.statSync(filePath);
        const size = st.size;
        const s = Math.max(0, Math.floor(start));
        const e = Math.min(size, Math.floor(end));
        if (s > e) return { error: '读取区间非法' };
        const fd = fs.openSync(filePath, 'r');
        try {
          const len = e - s;
          const buf = Buffer.alloc(len);
          fs.readSync(fd, buf, 0, len, s);
          // 仅返回真实数据区间对应的 ArrayBuffer（避免把整块 Buffer 的额外 backing 传回）
          const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
          return { buffer: ab };
        } finally {
          fs.closeSync(fd);
        }
      } catch (err: any) {
        log.error('Failed to read file range:', err);
        return { error: `读取文件区间失败：${err?.message || String(err)}` };
      }
    }
  );

  // ============ ebook:compute-file-hash 计算文件内容哈希 ============
  /**
   * 对文件原始字节计算 sha256（内容身份，用于换路径重新导入时复用标注/进度）。
   *
   * 三格式统一、开销极低（即使几十 MB 也在毫秒级）。哈希基于「原始字节」，
   * 因此仅当两份文件字节完全一致时才视为同一本。
   *
   * @param _event - IPC 事件对象（未使用）
   * @param filePath - 必填参数，文件绝对路径
   * @returns 成功返回 { success: true, hash: string }；失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:compute-file-hash',
    async (
      _event,
      filePath: string
    ): Promise<{ success: boolean; hash?: string; error?: string }> => {
      try {
        if (!filePath || typeof filePath !== 'string') {
          return { success: false, error: '文件路径不能为空' };
        }
        const buf = fs.readFileSync(filePath);
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        return { success: true, hash };
      } catch (err: any) {
        log.error('Failed to compute ebook file hash:', err);
        return {
          success: false,
          error: `计算文件哈希失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:get-progress 获取阅读进度 ============
  /**
   * 按内容身份（content_hash）或 file_path 查询阅读进度。
   * 优先按 content_hash 命中（换路径重新导入时复用），未命中则回退 file_path（兼容旧数据）。
   *
   * @param _event - IPC 事件对象（未使用）
   * @param filePath - 必填参数，电子书文件绝对路径
   * @param contentHash - 可选参数，文件原始内容 sha256
   * @returns 成功返回 { success: true, data: ProgressRecord | null }（无记录时 data 为 null）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:get-progress',
    async (
      _event,
      filePath: string,
      contentHash?: string
    ): Promise<{
      success: boolean;
      data?: ProgressRecord | null;
      error?: string;
    }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!filePath || typeof filePath !== 'string') {
          return { success: false, error: '文件路径不能为空' };
        }
        // 优先按内容身份查询，命中直接返回；否则回退 file_path
        if (contentHash) {
          const byHash = await query({
            tableName: EBOOK_PROGRESS_TABLE,
            columns: ['file_path', 'format', 'cfi', 'percent', 'updated_at'],
            conditions: { content_hash: contentHash }
          });
          if (byHash.length) {
            return { success: true, data: (byHash[0] as ProgressRecord) ?? null };
          }
        }
        const rows = await query({
          tableName: EBOOK_PROGRESS_TABLE,
          columns: ['file_path', 'format', 'cfi', 'percent', 'updated_at'],
          conditions: { file_path: filePath }
        });
        return { success: true, data: (rows[0] as ProgressRecord) ?? null };
      } catch (err: any) {
        log.error('Failed to get ebook progress:', err);
        return {
          success: false,
          error: `获取阅读进度失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:save-progress 保存阅读进度 ============
  /**
   * 保存阅读进度（upsert：使用 INSERT OR REPLACE，存在则替换，不存在则插入）
   *
   * @param _event - IPC 事件对象（未使用）
   * @param data - 必填参数，阅读进度数据 { filePath, format, cfi, percent }
   * @returns 成功返回 { success: true }；失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:save-progress',
    async (
      _event,
      data: SaveProgressData
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!data || !data.filePath) {
          return { success: false, error: '文件路径不能为空' };
        }
        const updatedAt = new Date().toISOString();
        const percent = Number(data.percent) || 0;
        const contentHash = data.contentHash ?? '';
        await upsert({
          tableName: EBOOK_PROGRESS_TABLE,
          data: {
            file_path: data.filePath,
            format: data.format ?? '',
            cfi: data.cfi ?? '',
            percent,
            updated_at: updatedAt,
            content_hash: contentHash
          },
          config: { primaryKey: 'file_path' }
        });
        // 阅读进度按内容身份共用：同一内容（content_hash）的多份副本共享同一阅读位置。
        // 当前副本已 upsert 自身进度行；再把同哈希的「其它副本」进度行同步为相同值，
        // 使任一副本续读都会反映到所有副本（避免改动进度表主键带来的迁移风险）。
        if (contentHash) {
          await dbRunAsync(
            db,
            `UPDATE ${EBOOK_PROGRESS_TABLE} SET cfi = ?, percent = ?, updated_at = ?, format = ?, content_hash = ? WHERE content_hash = ? AND file_path != ?`,
            [data.cfi ?? '', percent, updatedAt, data.format ?? '', contentHash, contentHash, data.filePath]
          );
        }
        // 同步更新书架进度：书架 percent 与 ebook_progress 必须同源，否则会出现
        // 「书架显示进度 ≠ 实际阅读进度」并反过来覆盖真实进度的情况。
        // 保留原 added_at，仅在首次加入时写入，last_read_at 始终刷新为当前时间。
        const existing = await query({
          tableName: EBOOK_BOOKSHELF_TABLE,
          columns: ['added_at', 'name', 'format'],
          conditions: { file_path: data.filePath }
        });
        const existingRow = existing[0] as
          | { added_at: string; name?: string; format?: string }
          | undefined;
        await upsert({
          tableName: EBOOK_BOOKSHELF_TABLE,
          data: {
            file_path: data.filePath,
            name: existingRow?.name ?? (data as any).name ?? '',
            format: existingRow?.format ?? (data.format ?? ''),
            percent,
            last_read_at: updatedAt,
            added_at: existingRow?.added_at ?? updatedAt,
            content_hash: contentHash
          },
          config: { primaryKey: 'file_path' }
        });
        return { success: true };
      } catch (err: any) {
        log.error('Failed to save ebook progress:', err);
        return {
          success: false,
          error: `保存阅读进度失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:get-bookshelf 获取书架列表 ============
  /**
   * 查询全部书架记录，按 last_read_at 倒序返回
   *
   * @param _event - IPC 事件对象（未使用）
   * @returns 成功返回 { success: true, data: BookshelfRecord[] }（无记录时 data 为空数组）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:get-bookshelf',
    async (): Promise<{
      success: boolean;
      data?: BookshelfRecord[];
      error?: string;
    }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        const rows = await query({
          tableName: EBOOK_BOOKSHELF_TABLE,
          // 注意：必须包含 content_hash，否则前端无法按内容身份（content_hash）命中共享的
          // 笔记/划线/书签计数，导致副本书籍的书架徽标始终显示 0。
          columns: ['file_path', 'name', 'format', 'percent', 'last_read_at', 'added_at', 'title', 'author', 'cover', 'content_hash'],
          orderBy: 'last_read_at',
          orderByDesc: true
        });
        return { success: true, data: rows as BookshelfRecord[] };
      } catch (err: any) {
        log.error('Failed to get ebook bookshelf:', err);
        return {
          success: false,
          error: `获取书架列表失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:scan-folder 递归扫描文件夹内的电子书文件 ============
  /**
   * 递归扫描指定文件夹，返回其中所有受支持电子书文件（txt / epub / pdf）的绝对路径列表。
   * 用于「文件夹导入」：渲染进程选中文件夹后，由主进程枚举其下全部电子书再批量加入书架。
   *
   * @param _event - IPC 事件对象（未使用）
   * @param folderPath - 必填参数，文件夹绝对路径
   * @returns 成功返回 { success: true, data: string[] }（无匹配时 data 为空数组）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:scan-folder',
    async (
      _event,
      folderPath: string
    ): Promise<{ success: boolean; data?: string[]; error?: string }> => {
      try {
        if (!folderPath || typeof folderPath !== 'string') {
          return { success: false, error: '文件夹路径不能为空' };
        }
        let stat;
        try {
          stat = fs.statSync(folderPath);
        } catch {
          return { success: false, error: '文件夹不存在或无法访问' };
        }
        if (!stat.isDirectory()) {
          return { success: false, error: '所选路径不是文件夹' };
        }
        const files: string[] = [];
        collectEbookFiles(folderPath, files, 0);
        return { success: true, data: files };
      } catch (err: any) {
        log.error('Failed to scan ebook folder:', err);
        return {
          success: false,
          error: `扫描文件夹失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:add-to-bookshelf 添加/更新书架记录 ============
  /**
   * 添加或更新书架记录（upsert）
   *
   * 实现策略：先查原记录的 added_at，存在则保留原值，不存在则用当前时间；
   * 然后用 INSERT OR REPLACE 写入（保证 last_read_at 总是更新为当前时间）。
   *
   * @param _event - IPC 事件对象（未使用）
   * @param data - 必填参数，书架记录数据 { filePath, name, format, percent }
   * @returns 成功返回 { success: true }；失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:add-to-bookshelf',
    async (
      _event,
      data: AddBookshelfData
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!data || !data.filePath) {
          return { success: false, error: '文件路径不能为空' };
        }
        const now = new Date().toISOString();
        // 仅需补全当前副本自身记录的 content_hash（兼容旧数据）；不搬移、不删除其它同哈希副本。
        // 多副本以各自 file_path 为独立书架引用，共享数据由读取侧按 content_hash 优先命中实现。
        await ensureBookIdentity(db, data.filePath, data.contentHash);
        // 查询原记录以保留首次添加时间 added_at
        const existing = await query({
          tableName: EBOOK_BOOKSHELF_TABLE,
          columns: ['added_at'],
          conditions: { file_path: data.filePath }
        });
        const addedAt = (existing[0] as { added_at: string } | undefined)?.added_at ?? now;
        // upsert：主键冲突时整体替换，added_at 保留原值
        await upsert({
          tableName: EBOOK_BOOKSHELF_TABLE,
          data: {
            file_path: data.filePath,
            name: data.name ?? '',
            format: data.format ?? '',
            percent: Number(data.percent) || 0,
            last_read_at: now,
            added_at: addedAt,
            content_hash: data.contentHash ?? ''
          },
          config: { primaryKey: 'file_path' }
        });
        return { success: true };
      } catch (err: any) {
        log.error('Failed to add to ebook bookshelf:', err);
        return {
          success: false,
          error: `添加书架记录失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:remove-from-bookshelf 删除书架记录 ============
  /**
   * 按 file_path 删除书架记录
   *
   * @param _event - IPC 事件对象（未使用）
   * @param filePath - 必填参数，电子书文件绝对路径
   * @returns 成功返回 { success: true }；失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:remove-from-bookshelf',
    async (
      _event,
      filePath: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!filePath || typeof filePath !== 'string') {
          return { success: false, error: '文件路径不能为空' };
        }
        await del({
          tableName: EBOOK_BOOKSHELF_TABLE,
          condition: { file_path: filePath }
        });
        // 一并删除该书的所有「书-分类」映射，避免遗留脏数据
        await del({
          tableName: EBOOK_BOOK_CATEGORY_TABLE,
          condition: { book_path: filePath }
        });
        return { success: true };
      } catch (err: any) {
        log.error('Failed to remove from ebook bookshelf:', err);
        return {
          success: false,
          error: `删除书架记录失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:clear-bookshelf 清空书架（仅删书架记录） ============
  /**
   * 一键清空书架：仅删除 ebook_bookshelf 表中的全部书架记录。
   * 注意：不删除分类、标注、阅读进度、书签等其它内容，仅把书从书架移除。
   *
   * @returns 成功返回 { success: true }；失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:clear-bookshelf',
    async (_event): Promise<{ success: boolean; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        // 仅清空书架表：保留分类映射 / 标注 / 进度 / 书签等其它数据
        await dbRunAsync(db, `DELETE FROM ${EBOOK_BOOKSHELF_TABLE}`);
        return { success: true };
      } catch (err: any) {
        log.error('Failed to clear ebook bookshelf:', err);
        return {
          success: false,
          error: `清空书架失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:get-categories 获取全部分类 ============
  /**
   * 查询全部分类（按创建时间升序，保证展示顺序稳定）
   *
   * @param _event - IPC 事件对象（未使用）
   * @returns 成功返回 { success: true, data: { id, name, color }[] }（无记录时 data 为空数组）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:get-categories',
    async (): Promise<{ success: boolean; data?: { id: number; name: string; color?: string }[]; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        const rows = await query({
          tableName: EBOOK_CATEGORY_TABLE,
          columns: ['id', 'name', 'color'],
          orderBy: 'created_at',
          orderByDesc: false
        });
        return { success: true, data: rows as { id: number; name: string; color?: string }[] };
      } catch (err: any) {
        log.error('Failed to get ebook categories:', err);
        return {
          success: false,
          error: `获取分类列表失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:add-category 新增分类 ============
  /**
   * 新增分类（按名称去重：若同名分类已存在，直接返回其 id，幂等）
   *
   * @param _event - IPC 事件对象（未使用）
   * @param name - 必填参数，分类名称（会自动 trim；为空返回错误）
   * @param color - 可选参数，分类颜色（十六进制色值，如 '#409eff'；为空则不设置）
   * @returns 成功返回 { success: true, id: number, existed?: boolean }；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:add-category',
    async (
      _event,
      name: string,
      color?: string
    ): Promise<{ success: boolean; id?: number; existed?: boolean; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        const trimmed = (name || '').trim();
        if (!trimmed) {
          return { success: false, error: '分类名称不能为空' };
        }
        // 同名分类已存在则幂等返回，避免重复
        const existing = await query({
          tableName: EBOOK_CATEGORY_TABLE,
          columns: ['id', 'name'],
          conditions: { name: trimmed }
        });
        if (existing.length > 0) {
          return { success: true, id: (existing[0] as { id: number }).id, existed: true };
        }
        const res = await insert({
          tableName: EBOOK_CATEGORY_TABLE,
          data: { name: trimmed, color: color || null, created_at: new Date().toISOString() }
        });
        return { success: true, id: res.lastID };
      } catch (err: any) {
        log.error('Failed to add ebook category:', err);
        return {
          success: false,
          error: `添加分类失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:delete-category 删除分类 ============
  /**
   * 删除分类（同时删除所有「书-分类」映射行）
   *
   * @param _event - IPC 事件对象（未使用）
   * @param id - 必填参数，分类 id
   * @returns 成功返回 { success: true }；失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:delete-category',
    async (
      _event,
      id: number
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (typeof id !== 'number') {
          return { success: false, error: '分类 id 无效' };
        }
        // 先删除该分类下的所有映射，再删除分类本身
        await del({
          tableName: EBOOK_BOOK_CATEGORY_TABLE,
          condition: { category_id: id }
        });
        await del({
          tableName: EBOOK_CATEGORY_TABLE,
          condition: { id }
        });
        return { success: true };
      } catch (err: any) {
        log.error('Failed to delete ebook category:', err);
        return {
          success: false,
          error: `删除分类失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:update-category 修改分类（名称 / 颜色） ============
  /**
   * 修改分类的名称与/或颜色（按 id 更新，仅更新传入的字段）
   *
   * @param _event - IPC 事件对象（未使用）
   * @param data - 必填参数，{ id: number, name?: string, color?: string }
   *               name 为空表示不修改名称；color 传 null/'' 表示清除颜色
   * @returns 成功返回 { success: true }；失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:update-category',
    async (
      _event,
      data: { id: number; name?: string; color?: string }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!data || typeof data.id !== 'number') {
          return { success: false, error: '分类 id 无效' };
        }
        // 仅组装传入的非空字段，避免覆盖未提供的列
        const setData: { name?: string; color?: string | null } = {};
        if (typeof data.name === 'string' && data.name.trim()) {
          setData.name = data.name.trim();
        }
        if (data.color !== undefined) {
          // 传 null 或空字符串表示清除颜色
          setData.color = data.color || null;
        }
        if (Object.keys(setData).length === 0) {
          // 无任何可更新字段，视为成功（幂等）
          return { success: true };
        }
        await update({
          tableName: EBOOK_CATEGORY_TABLE,
          data: setData,
          condition: { id: data.id }
        });
        return { success: true };
      } catch (err: any) {
        log.error('Failed to update ebook category:', err);
        return {
          success: false,
          error: `修改分类失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:get-bg-images 获取背景图库 ============
  /**
   * 查询全部已保存的阅读背景图（按加入时间倒序，最新在最前，便于切换展示）
   *
   * @param _event - IPC 事件对象（未使用）
   * @returns 成功返回 { success: true, data: { id, imagePath, dataUrl, createdAt }[] }（无记录时 data 为空数组）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:get-bg-images',
    async (): Promise<{
      success: boolean;
      data?: { id: number; imagePath: string; dataUrl: string; createdAt: string }[];
      error?: string;
    }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        const rows = await query({
          tableName: EBOOK_BG_IMAGE_TABLE,
          columns: ['id', 'image_path', 'data_url', 'created_at'],
          orderBy: 'created_at',
          orderByDesc: true
        });
        const data = (rows as any[]).map((r) => ({
          id: r.id,
          imagePath: r.image_path,
          dataUrl: r.data_url,
          createdAt: r.created_at
        }));
        return { success: true, data };
      } catch (err: any) {
        log.error('Failed to get ebook bg images:', err);
        return {
          success: false,
          error: `获取背景图库失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:add-bg-image 新增/更新背景图（按来源文件路径去重） ============
  /**
   * 保存一张阅读背景图（跨格式共享，按来源文件路径去重）
   * - 若 image_path 已存在：更新其 data_url（同一文件重新选择时可刷新），幂等返回 existed: true
   * - 若不存在：新增一条记录
   *
   * @param _event - IPC 事件对象（未使用）
   * @param imagePath - 必填参数，背景图来源文件的绝对路径（去重键）
   * @param dataUrl - 必填参数，背景图 data URL（平铺方式作为阅读区背景）
   * @returns 成功返回 { success: true, id: number, existed?: boolean }；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:add-bg-image',
    async (
      _event,
      imagePath: string,
      dataUrl: string
    ): Promise<{ success: boolean; id?: number; existed?: boolean; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!imagePath || typeof imagePath !== 'string') {
          return { success: false, error: '背景图来源路径无效' };
        }
        if (!dataUrl || typeof dataUrl !== 'string') {
          return { success: false, error: '背景图数据无效' };
        }
        // 按来源文件路径去重：已存在则刷新 data_url，避免重复入库
        const existing = await query({
          tableName: EBOOK_BG_IMAGE_TABLE,
          columns: ['id'],
          conditions: { image_path: imagePath }
        });
        if (existing.length > 0) {
          const id = (existing[0] as { id: number }).id;
          await update({
            tableName: EBOOK_BG_IMAGE_TABLE,
            data: { data_url: dataUrl },
            condition: { id }
          });
          return { success: true, id, existed: true };
        }
        const res = await insert({
          tableName: EBOOK_BG_IMAGE_TABLE,
          data: { image_path: imagePath, data_url: dataUrl, created_at: new Date().toISOString() }
        });
        return { success: true, id: res.lastID };
      } catch (err: any) {
        log.error('Failed to add ebook bg image:', err);
        return {
          success: false,
          error: `保存背景图失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:delete-bg-image 删除背景图 ============
  /**
   * 按 id 删除一张已保存的阅读背景图
   *
   * @param _event - IPC 事件对象（未使用）
   * @param id - 必填参数，背景图记录 id
   * @returns 成功返回 { success: true }；失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:delete-bg-image',
    async (
      _event,
      id: number
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (typeof id !== 'number') {
          return { success: false, error: '背景图 id 无效' };
        }
        await del({
          tableName: EBOOK_BG_IMAGE_TABLE,
          condition: { id }
        });
        return { success: true };
      } catch (err: any) {
        log.error('Failed to delete ebook bg image:', err);
        return {
          success: false,
          error: `删除背景图失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:get-book-categories 获取书与分类的映射 ============
  /**
   * 获取「书-分类」映射。
   * - 传入 bookPath：返回该书关联的分类 id 数组（用于单本编辑）。
   * - 不传 bookPath：返回全部映射 { [book_path]: number[] }（用于书架列表批量合并）。
   *
   * @param _event - IPC 事件对象（未使用）
   * @param bookPath - 可选参数，电子书文件绝对路径
   * @returns 成功返回 { success: true, data }（data 形态见上文）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:get-book-categories',
    async (
      _event,
      bookPath?: string
    ): Promise<{ success: boolean; data?: any; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (bookPath) {
          const rows = await query({
            tableName: EBOOK_BOOK_CATEGORY_TABLE,
            columns: ['category_id'],
            conditions: { book_path: bookPath }
          });
          return { success: true, data: (rows as { category_id: number }[]).map((r) => r.category_id) };
        }
        const rows = await query({
          tableName: EBOOK_BOOK_CATEGORY_TABLE,
          columns: ['book_path', 'category_id']
        });
        const map: Record<string, number[]> = {};
        (rows as { book_path: string; category_id: number }[]).forEach((r) => {
          (map[r.book_path] = map[r.book_path] || []).push(r.category_id);
        });
        return { success: true, data: map };
      } catch (err: any) {
        log.error('Failed to get ebook book categories:', err);
        return {
          success: false,
          error: `获取书籍分类失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:set-book-categories 设置某本书的分类 ============
  /**
   * 替换某本书关联的分类集合（先清空旧映射，再批量写入新映射）。
   *
   * @param _event - IPC 事件对象（未使用）
   * @param data - 必填参数，{ bookPath: 文件绝对路径, categoryIds: number[] }
   * @returns 成功返回 { success: true }；失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:set-book-categories',
    async (
      _event,
      data: { bookPath: string; categoryIds: number[] }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!data || !data.bookPath || !Array.isArray(data.categoryIds)) {
          return { success: false, error: '参数无效' };
        }
        // 先清空该书旧映射
        await del({
          tableName: EBOOK_BOOK_CATEGORY_TABLE,
          condition: { book_path: data.bookPath }
        });
        // 再批量写入新映射（去重后的分类 id）
        const ids = Array.from(new Set(data.categoryIds)).filter(
          (id) => typeof id === 'number'
        );
        if (ids.length > 0) {
          await insert({
            tableName: EBOOK_BOOK_CATEGORY_TABLE,
            data: ids.map((categoryId) => ({ book_path: data.bookPath, category_id: categoryId }))
          });
        }
        return { success: true };
      } catch (err: any) {
        log.error('Failed to set ebook book categories:', err);
        return {
          success: false,
          error: `设置书籍分类失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:save-book-meta 保存书籍基本信息（标题/作者/封面） ============
  /**
   * 保存书籍基本信息（标题/作者/封面），供书架列表秒出、无需每次重新解析。
   *
   * 实现策略：书架行通常已由 add-to-bookshelf 创建；先 UPDATE 元数据三列，
   * 若 UPDATE 未命中（changes === 0，书架尚无该记录），则以最小信息 INSERT 一行兜底，
   * 保证下次进入书架即可读到元数据。
   *
   * @param _event - IPC 事件对象（未使用）
   * @param data - 必填参数，{ filePath, name?, format?, title?, author?, cover? }
   * @returns 成功返回 { success: true }；失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:save-book-meta',
    async (
      _event,
      data: SaveBookMetaData
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!data || !data.filePath) {
          return { success: false, error: '文件路径不能为空' };
        }
        const title = data.title ?? '';
        const author = data.author ?? '';
        const cover = data.cover ?? '';
        const contentHash = data.contentHash ?? '';
        // 优先 UPDATE 已有书架行的元数据列（保留 percent / added_at / last_read_at）
        const upd = await dbRunAsync(
          db,
          `UPDATE ${EBOOK_BOOKSHELF_TABLE} SET title = ?, author = ?, cover = ?, content_hash = ? WHERE file_path = ?`,
          [title, author, cover, contentHash, data.filePath]
        );
        // UPDATE 未命中（书架尚无该记录）时，以最小信息插入一行兜底
        if (upd.changes === 0) {
          const now = new Date().toISOString();
          await upsert({
            tableName: EBOOK_BOOKSHELF_TABLE,
            data: {
              file_path: data.filePath,
              name: data.name ?? '',
              format: data.format ?? '',
              percent: 0,
              last_read_at: now,
              added_at: now,
              title,
              author,
              cover,
              content_hash: contentHash
            },
            config: { primaryKey: 'file_path' }
          });
        }
        return { success: true };
      } catch (err: any) {
        log.error('Failed to save ebook book meta:', err);
        return {
          success: false,
          error: `保存书籍基本信息失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:get-annotations 获取笔记与划线列表 ============
  /**
   * 按内容身份（content_hash）或 file_path 查询笔记与划线记录，按 created_at 升序返回。
   * 优先按 content_hash 命中（换路径重新导入时复用），未命中则回退 file_path（兼容旧数据）。
   *
   * @param _event - IPC 事件对象（未使用）
   * @param filePath - 必填参数，电子书文件绝对路径
   * @param contentHash - 可选参数，文件原始内容 sha256
   * @returns 成功返回 { success: true, data: AnnotationRecord[] }（无记录时 data 为空数组）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:get-annotations',
    async (
      _event,
      filePath: string,
      contentHash?: string
    ): Promise<{
      success: boolean;
      data?: AnnotationRecord[];
      error?: string;
    }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!filePath || typeof filePath !== 'string') {
          return { success: false, error: '文件路径不能为空' };
        }
        // 优先按内容身份查询，命中直接返回；否则回退 file_path
        if (contentHash) {
          const byHash = await query({
            tableName: EBOOK_ANNOTATION_TABLE,
            columns: ['id', 'file_path', 'format', 'anchor', 'text', 'note', 'color', 'type', 'created_at', 'updated_at'],
            conditions: { content_hash: contentHash },
            orderBy: 'created_at',
            orderByDesc: false
          });
          if (byHash.length) {
            return { success: true, data: byHash as AnnotationRecord[] };
          }
        }
        const rows = await query({
          tableName: EBOOK_ANNOTATION_TABLE,
          columns: ['id', 'file_path', 'format', 'anchor', 'text', 'note', 'color', 'type', 'created_at', 'updated_at'],
          conditions: { file_path: filePath },
          orderBy: 'created_at',
          orderByDesc: false
        });
        return { success: true, data: rows as AnnotationRecord[] };
      } catch (err: any) {
        log.error('Failed to get ebook annotations:', err);
        return {
          success: false,
          error: `获取笔记列表失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:add-annotation 新增笔记与划线 ============
  /**
   * 新增一条笔记与划线记录
   *
   * @param _event - IPC 事件对象（未使用）
   * @param data - 必填参数，笔记数据 { filePath, format, anchor, text, note, color, type }
   * @returns 成功返回 { success: true, id: number }（id 为新记录自增主键）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:add-annotation',
    async (
      _event,
      data: AddAnnotationData
    ): Promise<{ success: boolean; id?: number; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!data || !data.filePath) {
          return { success: false, error: '文件路径不能为空' };
        }
        const now = new Date().toISOString();
        const result = await insert({
          tableName: EBOOK_ANNOTATION_TABLE,
          data: {
            file_path: data.filePath,
            format: data.format ?? '',
            anchor: data.anchor ?? '',
            text: data.text ?? '',
            note: data.note ?? null,
            color: data.color ?? 'yellow',
            type: data.type ?? 'highlight',
            created_at: now,
            updated_at: now,
            content_hash: data.contentHash ?? ''
          }
        });
        return { success: true, id: result.lastID };
      } catch (err: any) {
        log.error('Failed to add ebook annotation:', err);
        return {
          success: false,
          error: `添加笔记失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:update-annotation 更新笔记与划线 ============
  /**
   * 按 id 更新笔记内容、高亮颜色与类型，同时刷新 updated_at
   *
   * @param _event - IPC 事件对象（未使用）
   * @param data - 必填参数，更新数据 { id, note, color, type }
   * @returns 成功返回 { success: true }；失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:update-annotation',
    async (
      _event,
      data: UpdateAnnotationData
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!data || typeof data.id !== 'number') {
          return { success: false, error: '笔记 id 不能为空' };
        }
        const updatedAt = new Date().toISOString();
        await update({
          tableName: EBOOK_ANNOTATION_TABLE,
          data: {
            note: data.note ?? null,
            color: data.color ?? 'yellow',
            type: data.type ?? 'highlight',
            updated_at: updatedAt
          },
          condition: { id: data.id }
        });
        return { success: true };
      } catch (err: any) {
        log.error('Failed to update ebook annotation:', err);
        return {
          success: false,
          error: `更新笔记失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:remove-annotation 删除笔记与划线 ============
  /**
   * 按 id 删除笔记与划线记录
   *
   * @param _event - IPC 事件对象（未使用）
   * @param id - 必填参数，笔记记录主键 id
   * @returns 成功返回 { success: true }；失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:remove-annotation',
    async (
      _event,
      id: number
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (typeof id !== 'number') {
          return { success: false, error: '笔记 id 不能为空' };
        }
        await del({
          tableName: EBOOK_ANNOTATION_TABLE,
          condition: { id }
        });
        return { success: true };
      } catch (err: any) {
        log.error('Failed to remove ebook annotation:', err);
        return {
          success: false,
          error: `删除笔记失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:remove-annotations 批量删除笔记与划线 ============
  /**
   * 批量删除笔记与划线记录，支持按范围（note / highlight / all）过滤。
   * 优先按 content_hash 命中（多副本共用同一内容的标注，从任一份副本删除都能覆盖全部）；
   * 未提供 contentHash 时回退 file_path（兼容旧调用）。
   *
   * scope 含义：
   * - 'note'      仅删除「笔记」（note 非空且去除首尾空白后不为空）
   * - 'highlight' 仅删除「划线」（note 为空或去除首尾空白后为空）
   * - 'all'       删除该书全部笔记与划线
   *
   * @param _event - IPC 事件对象（未使用）
   * @param data - 必填参数，{ filePath, scope, contentHash? }
   * @returns 成功返回 { success: true, deleted: number }（deleted 为实际删除行数）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:remove-annotations',
    async (
      _event,
      data: { filePath: string; scope: 'note' | 'highlight' | 'all'; contentHash?: string }
    ): Promise<{ success: boolean; deleted?: number; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!data || !data.filePath || typeof data.filePath !== 'string') {
          return { success: false, error: '文件路径不能为空' };
        }
        const scope = data.scope || 'all';
        // 共享数据以 content_hash 为身份键：优先按哈希删除，回退 file_path
        const keyCol = data.contentHash ? 'content_hash' : 'file_path';
        const keyVal = data.contentHash ? data.contentHash : data.filePath;
        let sql: string;
        switch (scope) {
          case 'note':
            sql = `DELETE FROM ${EBOOK_ANNOTATION_TABLE} WHERE ${keyCol} = ? AND note IS NOT NULL AND TRIM(note) != ''`;
            break;
          case 'highlight':
            sql = `DELETE FROM ${EBOOK_ANNOTATION_TABLE} WHERE ${keyCol} = ? AND (note IS NULL OR TRIM(note) = '')`;
            break;
          case 'all':
          default:
            sql = `DELETE FROM ${EBOOK_ANNOTATION_TABLE} WHERE ${keyCol} = ?`;
            break;
        }
        const result = await dbRunAsync(db, sql, [keyVal]);
        return { success: true, deleted: result.changes };
      } catch (err: any) {
        log.error('Failed to remove ebook annotations:', err);
        return {
          success: false,
          error: `删除笔记失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:get-annotation-counts 批量统计笔记与划线数量 ============
  /**
   * 批量统计每本书的笔记数（note 非空）、划线数（note 为空）与书签数。
   * 按内容身份（content_hash）聚合：同一内容的多份副本共享标注与书签，会汇总到同一分组；
   * 未带哈希的遗留数据回退按 file_path 聚合。返回项以 content_hash（或 file_path）为 key。
   *
   * @param _event - IPC 事件对象（未使用）
   * @param filePaths - 必填参数，文件绝对路径数组
   * @param contentHashes - 可选参数，与 filePaths 对应的内容哈希数组；用于把其它路径下的共享标注/书签一并计入
   * @returns 成功返回 { success: true, data: AnnotationCountItem[] }；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:get-annotation-counts',
    async (
      _event,
      filePaths: string[],
      contentHashes?: string[]
    ): Promise<{
      success: boolean;
      data?: AnnotationCountItem[];
      error?: string;
    }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!Array.isArray(filePaths) || filePaths.length === 0) {
          return { success: true, data: [] };
        }
        const conditions: string[] = [];
        const params: string[] = [];
        const pathPlaceholders = filePaths.map(() => '?').join(', ');
        conditions.push(`file_path IN (${pathPlaceholders})`);
        params.push(...filePaths);
        // 内容哈希：把同哈希、不同路径的共享标注一并拉入统计
        if (Array.isArray(contentHashes) && contentHashes.length > 0) {
          const hashPlaceholders = contentHashes.map(() => '?').join(', ');
          conditions.push(`(content_hash IN (${hashPlaceholders}) AND content_hash != '')`);
          params.push(...contentHashes);
        }
        // 聚合键：有哈希按哈希（多副本共用），否则按 file_path（兼容遗留数据）
        // 同时收集该分组下的所有 file_path，供前端按路径兜底索引（修复书架行 content_hash 为空时徽标读 0）
        const sql = `SELECT
            CASE WHEN content_hash IS NOT NULL AND content_hash != '' THEN content_hash ELSE file_path END AS grp_key,
            GROUP_CONCAT(DISTINCT file_path) AS paths,
            SUM(CASE WHEN note IS NOT NULL AND TRIM(note) != '' THEN 1 ELSE 0 END) AS note_count,
            SUM(CASE WHEN note IS NULL OR TRIM(note) = '' THEN 1 ELSE 0 END) AS highlight_count
          FROM ${EBOOK_ANNOTATION_TABLE}
          WHERE ${conditions.join(' OR ')}
          GROUP BY grp_key`;
        const rows = await new Promise<any[]>((resolve, reject) => {
          db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        // 书签数量：与标注使用同一 WHERE 条件与聚合键，按内容身份共用
        const bmSql = `SELECT
            CASE WHEN content_hash IS NOT NULL AND content_hash != '' THEN content_hash ELSE file_path END AS grp_key,
            GROUP_CONCAT(DISTINCT file_path) AS paths,
            COUNT(*) AS bm_count
          FROM ${EBOOK_BOOKMARK_TABLE}
          WHERE ${conditions.join(' OR ')}
          GROUP BY grp_key`;
        const bmRows = await new Promise<any[]>((resolve, reject) => {
          db.all(bmSql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        const bmMap: Record<string, { count: number; paths: string[] }> = {};
        bmRows.forEach((r) => {
          bmMap[r.grp_key] = {
            count: r.bm_count || 0,
            paths: r.paths ? String(r.paths).split(',') : []
          };
        });
        const data: AnnotationCountItem[] = rows.map((row) => ({
          key: row.grp_key,
          paths: row.paths ? String(row.paths).split(',') : [],
          noteCount: row.note_count || 0,
          highlightCount: row.highlight_count || 0,
          bookmarkCount: bmMap[row.grp_key]?.count || 0
        }));
        // 仅有书签但没有标注的书也需要出现在结果中，否则书签徽标不会显示
        bmRows.forEach((r) => {
          if (!rows.some((row) => row.grp_key === r.grp_key)) {
            data.push({
              key: r.grp_key,
              paths: r.paths ? String(r.paths).split(',') : [],
              noteCount: 0,
              highlightCount: 0,
              bookmarkCount: r.bm_count || 0
            });
          }
        });
        return { success: true, data };
      } catch (err: any) {
        log.error('Failed to get annotation counts:', err);
        return {
          success: false,
          error: `统计笔记数量失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:export-annotations 导出笔记与划线为 Markdown ============
  /**
   * 导出笔记与划线为 Markdown 文件（弹出系统保存对话框）
   *
   * @param _event - IPC 事件对象（未使用）
   * @param data - 入参 { filePath?, title?, contentHash? }；filePath 为空表示导出全部书。
   *             提供 contentHash 时按内容身份查询（多副本共用标注，从任一份副本导出即可覆盖全部）。
   * @returns 成功返回 { success: true, savedPath: string }；
   *          取消/失败返回 { success: false, error?: string }（取消时 error 为 '已取消导出'）
   */
  ipcMain.handle(
    'ebook:export-annotations',
    async (
      _event,
      data: ExportAnnotationsData
    ): Promise<{ success: boolean; savedPath?: string; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        const filePath = data?.filePath || '';
        const contentHash = data?.contentHash || '';
        // 书名：优先用前端传入的清洗书名（不含扩展名），否则从路径推导；空表示导出全部书
        const title =
          data?.title ||
          (filePath ? path.basename(filePath, path.extname(filePath)) : '全部电子书笔记与划线');

        // 查询记录：优先按 content_hash（覆盖多副本共用数据），回退 file_path，空则取全部
        let rows: AnnotationRecord[];
        // 含 content_hash 以便「导出全部」时按内容身份合并副本
        const columns = ['id', 'file_path', 'format', 'anchor', 'text', 'note', 'color', 'type', 'created_at', 'updated_at', 'content_hash'];
        if (contentHash) {
          rows = await query({
            tableName: EBOOK_ANNOTATION_TABLE,
            columns,
            conditions: { content_hash: contentHash },
            orderBy: 'created_at',
            orderByDesc: false
          });
        } else if (filePath) {
          rows = await query({
            tableName: EBOOK_ANNOTATION_TABLE,
            columns,
            conditions: { file_path: filePath },
            orderBy: 'created_at',
            orderByDesc: false
          });
        } else {
          rows = await query({
            tableName: EBOOK_ANNOTATION_TABLE,
            columns,
            orderBy: 'created_at',
            orderByDesc: false
          });
        }

        // 生成 Markdown 内容（单本按 hash 身份输出；全部按 content_hash 合并副本）
        const markdown = buildAnnotationsMarkdown(title, contentHash, filePath, rows);

        // 弹出保存对话框（默认文件名带时间前缀，便于区分多次导出）
        const defaultName = `${timePrefix()}_${sanitizeFileName(title)}.md`;
        const win = BrowserWindow.getFocusedWindow();
        const saveResult = await (win
          ? dialog.showSaveDialog(win, {
              title: '导出笔记与划线',
              defaultPath: defaultName,
              filters: [{ name: 'Markdown', extensions: ['md'] }]
            })
          : dialog.showSaveDialog({
              title: '导出笔记与划线',
              defaultPath: defaultName,
              filters: [{ name: 'Markdown', extensions: ['md'] }]
            }));
        if (saveResult.canceled || !saveResult.filePath) {
          return { success: false, error: '已取消导出' };
        }

        fs.writeFileSync(saveResult.filePath, markdown, 'utf-8');
        return { success: true, savedPath: saveResult.filePath };
      } catch (err: any) {
        log.error('Failed to export annotations:', err);
        return {
          success: false,
          error: `导出笔记失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:get-bookmarks 获取书签列表 ============
  /**
   * 按内容身份（content_hash）或 file_path 查询书签记录，按 percent 升序（阅读顺序）返回。
   * 优先按 content_hash 命中（换路径重新导入时复用），未命中则回退 file_path（兼容旧数据）。
   *
   * @param _event - IPC 事件对象（未使用）
   * @param filePath - 必填参数，电子书文件绝对路径
   * @param contentHash - 可选参数，文件原始内容 sha256
   * @returns 成功返回 { success: true, data: BookmarkRecord[] }（无记录时 data 为空数组）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:get-bookmarks',
    async (
      _event,
      filePath: string,
      contentHash?: string
    ): Promise<{
      success: boolean;
      data?: BookmarkRecord[];
      error?: string;
    }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!filePath || typeof filePath !== 'string') {
          return { success: false, error: '文件路径不能为空' };
        }
        // 优先按内容身份查询，命中直接返回；否则回退 file_path
        if (contentHash) {
          const byHash = await query({
            tableName: EBOOK_BOOKMARK_TABLE,
            columns: ['id', 'file_path', 'format', 'cfi', 'label', 'percent', 'created_at'],
            conditions: { content_hash: contentHash },
            orderBy: 'percent',
            orderByDesc: false
          });
          if (byHash.length) {
            return { success: true, data: byHash as BookmarkRecord[] };
          }
        }
        const rows = await query({
          tableName: EBOOK_BOOKMARK_TABLE,
          columns: ['id', 'file_path', 'format', 'cfi', 'label', 'percent', 'created_at'],
          conditions: { file_path: filePath },
          orderBy: 'percent',
          orderByDesc: false
        });
        return { success: true, data: rows as BookmarkRecord[] };
      } catch (err: any) {
        log.error('Failed to get ebook bookmarks:', err);
        return {
          success: false,
          error: `获取书签列表失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:add-bookmark 新增书签 ============
  /**
   * 新增一条书签记录
   *
   * @param _event - IPC 事件对象（未使用）
   * @param data - 必填参数，书签数据 { filePath, format, cfi, label, percent }
   * @returns 成功返回 { success: true, id: number }（id 为新记录自增主键）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:add-bookmark',
    async (
      _event,
      data: AddBookmarkData
    ): Promise<{ success: boolean; id?: number; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (!data || !data.filePath || !data.cfi) {
          return { success: false, error: '文件路径与定位锚点不能为空' };
        }
        const now = new Date().toISOString();
        const result = await insert({
          tableName: EBOOK_BOOKMARK_TABLE,
          data: {
            file_path: data.filePath,
            format: data.format ?? '',
            cfi: data.cfi,
            label: data.label ?? null,
            percent: Number(data.percent) || 0,
            created_at: now,
            content_hash: data.contentHash ?? ''
          }
        });
        return { success: true, id: result.lastID };
      } catch (err: any) {
        log.error('Failed to add ebook bookmark:', err);
        return {
          success: false,
          error: `添加书签失败：${err?.message || String(err)}`
        };
      }
    }
  );

  // ============ ebook:remove-bookmark 删除书签 ============
  /**
   * 按 id 删除书签记录
   *
   * @param _event - IPC 事件对象（未使用）
   * @param id - 必填参数，书签记录主键 id
   * @returns 成功返回 { success: true }；失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:remove-bookmark',
    async (
      _event,
      id: number
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const db = myDb.db;
        if (!db) {
          return { success: false, error: '数据库未初始化' };
        }
        if (typeof id !== 'number') {
          return { success: false, error: '书签 id 不能为空' };
        }
        await del({
          tableName: EBOOK_BOOKMARK_TABLE,
          condition: { id }
        });
        return { success: true };
      } catch (err: any) {
        log.error('Failed to remove ebook bookmark:', err);
        return {
          success: false,
          error: `删除书签失败：${err?.message || String(err)}`
        };
      }
    }
  );

  log.info('Ebook module initialized successfully');
}

/**
 * 生成笔记与划线导出用的 Markdown 文本（按内容身份 hash 组织）
 *
 * @param bookName - 清洗后的书名（不含扩展名），作为一级/二级标题主体
 * @param contentHash - 文件原始内容 sha256（内容身份），参与标题与「书籍引用」分区
 * @param filePath - 单本导出时传文件路径（非空表示单本排版）；空串表示导出全部书（按 hash 分组）
 * @param records - 笔记与划线记录数组
 * @returns Markdown 字符串
 */
function buildAnnotationsMarkdown(
  bookName: string,
  contentHash: string,
  filePath: string,
  records: AnnotationRecord[]
): string {
  const lines: string[] = [];
  if (filePath) {
    // 单本：以内容身份（hash）为一级标题，文件名/路径为二级分区
    appendBookSection(lines, 1, bookName, contentHash, [filePath], records);
  } else {
    // 全部：按内容哈希（content_hash）分组，多副本合并到同一身份；
    // 无哈希的遗留数据按 file_path 分组，避免不同书被错误合并。
    const groups = new Map<string, AnnotationRecord[]>();
    for (const r of records) {
      const key = r.content_hash && r.content_hash.trim() ? `H:${r.content_hash}` : `P:${r.file_path}`;
      const list = groups.get(key) || [];
      list.push(r);
      groups.set(key, list);
    }
    for (const [, list] of groups) {
      const hash = list[0]?.content_hash || '';
      const fps = list.map((r) => r.file_path);
      const name = (list[0]?.file_path && path.basename(list[0].file_path, path.extname(list[0].file_path))) || bookName || '电子书';
      appendBookSection(lines, 2, name, hash, fps, list);
    }
  }
  return lines.join('\n');
}

/**
 * 输出单本书（或某内容身份）的完整分区：
 *   #/## 书籍名称 hash
 *   ##/### 书籍引用及其文件名、路径
 *   ##/### 标注划线
 *     ###/#### 笔记
 *     ###/#### 划线
 *
 * @param lines - 累积输出的行数组
 * @param level - 该书标题的 Markdown 标题层级（单本为 1，全部导出时为 2）
 * @param bookName - 清洗后的书名（不含扩展名）
 * @param contentHash - 文件原始内容 sha256（内容身份），可空
 * @param filePaths - 该书对应的文件绝对路径（多副本时含多个）
 * @param records - 该书的标注/划线记录
 */
function appendBookSection(
  lines: string[],
  level: number,
  bookName: string,
  contentHash: string,
  filePaths: string[],
  records: AnnotationRecord[]
): void {
  const h1 = '#'.repeat(level);
  const h2 = '#'.repeat(level + 1);
  const h3 = '#'.repeat(level + 2);

  // 一级/二级标题：书籍名称 + 内容哈希（身份标识）
  lines.push(`${h1} 《${bookName}》${contentHash ? ' ' + contentHash : ''}`);
  lines.push('');
  lines.push(`> 导出时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  // 书籍引用（内容哈希身份）及其文件名、路径
  lines.push(`${h2} 书籍引用及其文件名、路径`);
  lines.push('');
  if (contentHash) {
    lines.push(`- 书籍引用（内容哈希）：${contentHash}`);
  }
  const uniquePaths = Array.from(new Set(filePaths.filter(Boolean)));
  if (uniquePaths.length === 0) {
    lines.push('- 文件名：未知');
    lines.push('- 路径：未知');
  } else {
    uniquePaths.forEach((fp, i) => {
      lines.push(`- 文件名：${path.basename(fp)}`);
      lines.push(`- 路径：${fp}`);
      // 多副本时各组之间空一行分隔
      if (uniquePaths.length > 1 && i < uniquePaths.length - 1) lines.push('');
    });
  }
  lines.push('');

  // 标注划线
  lines.push(`${h2} 标注划线`);
  lines.push('');
  appendAnnotationSection(lines, h3, records);
}

/**
 * 输出一组记录的「笔记」与「划线」两个分区（标题层级由 headingLevel 决定）
 *
 * @param lines - 累积输出的行数组
 * @param headingLevel - 笔记/划线分区的 Markdown 标题前缀（如 '###' 或 '####'）
 * @param records - 该组（单本或某一本书）的记录
 * @returns 无返回值
 */
function appendAnnotationSection(lines: string[], headingLevel: string, records: AnnotationRecord[]): void {
  const notes = records.filter((r) => (r.note || '').trim().length > 0);
  const highlights = records.filter((r) => !(r.note || '').trim());

  lines.push(`${headingLevel} 笔记`);
  lines.push('');
  if (notes.length === 0) {
    lines.push('（无）');
  } else {
    notes.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.text.replace(/\s+/g, ' ')}`);
      const noteLines = (r.note || '').split('\n');
      noteLines.forEach((nl) => lines.push(`   > ${nl}`));
      lines.push('');
    });
  }

  lines.push(`${headingLevel} 划线`);
  lines.push('');
  if (highlights.length === 0) {
    lines.push('（无）');
  } else {
    highlights.forEach((r) => lines.push(`- ${r.text.replace(/\s+/g, ' ')}`));
  }
  lines.push('');
}

/**
 * 清理文件名中的非法字符，避免保存对话框默认名非法
 *
 * @param name - 原始文件名
 * @returns 清理后的合法文件名
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || '笔记导出';
}

/**
 * 生成导出文件名的「时间前缀」（YYYYMMDD_HHmmss，紧凑且文件名安全）
 *
 * @returns 如 20260815_202530
 */
function timePrefix(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export type {
  EbookProgress,
  ReadTxtSuccess,
  ReadTxtError,
  SaveProgressData,
  ProgressRecord,
  BookshelfRecord,
  AddBookshelfData,
  AnnotationRecord,
  AddAnnotationData,
  UpdateAnnotationData,
  ExportAnnotationsData,
  BookmarkRecord,
  AddBookmarkData
};
