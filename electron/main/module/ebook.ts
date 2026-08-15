/**
 * 电子书模块
 * 提供电子书（epub、txt 等）的解析、阅读、进度保存等功能
 * 支持的格式：epub（通过 epubjs 解析）、txt（通过 iconv-lite 与 chardet 进行编码检测和转换）
 *
 * 本模块复用 newSql.ts 中的主数据库实例（db.sqlite），不新建独立数据库文件。
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs';
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
}

/**
 * 数据库中的书架记录结构（对应 ebook_bookshelf 表的每一行）
 */
interface BookshelfRecord {
  /** 文件绝对路径（主键） */
  file_path: string;
  /** 文件名（含扩展名） */
  name: string;
  /** 文件格式：'txt' 或 'epub' */
  format: string;
  /** 阅读百分比 0-100 */
  percent: number;
  /** 上次阅读时间（ISO 字符串） */
  last_read_at: string;
  /** 首次添加时间（ISO 字符串） */
  added_at: string;
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
}

/** 单本书的笔记/划线数量统计（get-annotation-counts 返回项） */
interface AnnotationCountItem {
  /** 文件绝对路径 */
  filePath: string;
  /** 笔记数量（note 非空） */
  noteCount: number;
  /** 划线数量（note 为空） */
  highlightCount: number;
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
    updated_at TEXT
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
    added_at TEXT
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
    updated_at TEXT
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

  // 4. 与 newSql.ts 保持一致：确保各表列完整，自动补齐旧库中缺失的列
  //    （例如老版本建表时还没有 type 列，这里会 ALTER TABLE ADD COLUMN 补齐，
  //      否则后续 INSERT/UPDATE 引用 type 会报 SQLITE_ERROR: no column named type）
  try {
    await ensureTableExists(
      EBOOK_PROGRESS_TABLE,
      ['format', 'cfi', 'percent', 'updated_at'],
      'file_path'
    );
    await ensureTableExists(
      EBOOK_BOOKSHELF_TABLE,
      ['name', 'format', 'percent', 'last_read_at', 'added_at'],
      'file_path'
    );
    await ensureTableExists(
      EBOOK_ANNOTATION_TABLE,
      ['file_path', 'format', 'anchor', 'text', 'note', 'color', 'type', 'created_at', 'updated_at'],
      'id'
    );
    await ensureTableExists(
      EBOOK_BOOKMARK_TABLE,
      ['file_path', 'format', 'cfi', 'label', 'percent', 'created_at'],
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

  // ============ ebook:get-progress 获取阅读进度 ============
  /**
   * 按 file_path 查询阅读进度
   *
   * @param _event - IPC 事件对象（未使用）
   * @param filePath - 必填参数，电子书文件绝对路径
   * @returns 成功返回 { success: true, data: ProgressRecord | null }（无记录时 data 为 null）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:get-progress',
    async (
      _event,
      filePath: string
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
        await upsert({
          tableName: EBOOK_PROGRESS_TABLE,
          data: {
            file_path: data.filePath,
            format: data.format ?? '',
            cfi: data.cfi ?? '',
            percent,
            updated_at: updatedAt
          },
          config: { primaryKey: 'file_path' }
        });
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
            added_at: existingRow?.added_at ?? updatedAt
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
          columns: ['file_path', 'name', 'format', 'percent', 'last_read_at', 'added_at'],
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
            added_at: addedAt
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

  // ============ ebook:get-annotations 获取笔记与划线列表 ============
  /**
   * 按 file_path 查询笔记与划线记录，按 created_at 升序返回
   *
   * @param _event - IPC 事件对象（未使用）
   * @param filePath - 必填参数，电子书文件绝对路径
   * @returns 成功返回 { success: true, data: AnnotationRecord[] }（无记录时 data 为空数组）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:get-annotations',
    async (
      _event,
      filePath: string
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
            updated_at: now
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
   * 按 file_path 批量删除笔记与划线记录，支持按范围（note / highlight / all）过滤
   *
   * scope 含义：
   * - 'note'      仅删除「笔记」（note 非空且去除首尾空白后不为空）
   * - 'highlight' 仅删除「划线」（note 为空或去除首尾空白后为空）
   * - 'all'       删除该书全部笔记与划线
   *
   * @param _event - IPC 事件对象（未使用）
   * @param data - 必填参数，{ filePath, scope }
   * @returns 成功返回 { success: true, deleted: number }（deleted 为实际删除行数）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:remove-annotations',
    async (
      _event,
      data: { filePath: string; scope: 'note' | 'highlight' | 'all' }
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
        let sql: string;
        switch (scope) {
          case 'note':
            sql = `DELETE FROM ${EBOOK_ANNOTATION_TABLE} WHERE file_path = ? AND note IS NOT NULL AND TRIM(note) != ''`;
            break;
          case 'highlight':
            sql = `DELETE FROM ${EBOOK_ANNOTATION_TABLE} WHERE file_path = ? AND (note IS NULL OR TRIM(note) = '')`;
            break;
          case 'all':
          default:
            sql = `DELETE FROM ${EBOOK_ANNOTATION_TABLE} WHERE file_path = ?`;
            break;
        }
        const result = await dbRunAsync(db, sql, [data.filePath]);
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
   * 按 filePaths 批量统计每本书的笔记数（note 非空）与划线数（note 为空）
   *
   * @param _event - IPC 事件对象（未使用）
   * @param filePaths - 必填参数，文件绝对路径数组（空数组返回空 data）
   * @returns 成功返回 { success: true, data: AnnotationCountItem[] }；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:get-annotation-counts',
    async (
      _event,
      filePaths: string[]
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
        const placeholders = filePaths.map(() => '?').join(', ');
        const sql = `SELECT file_path,
          SUM(CASE WHEN note IS NOT NULL AND TRIM(note) != '' THEN 1 ELSE 0 END) AS note_count,
          SUM(CASE WHEN note IS NULL OR TRIM(note) = '' THEN 1 ELSE 0 END) AS highlight_count
        FROM ${EBOOK_ANNOTATION_TABLE}
        WHERE file_path IN (${placeholders})
        GROUP BY file_path`;
        const rows = await new Promise<any[]>((resolve, reject) => {
          db.all(sql, filePaths, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        const data: AnnotationCountItem[] = rows.map((row) => ({
          filePath: row.file_path,
          noteCount: row.note_count || 0,
          highlightCount: row.highlight_count || 0
        }));
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
   * @param data - 入参 { filePath?, title? }；filePath 为空表示导出全部书
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
        const title = data?.title || (filePath ? '电子书笔记与划线' : '全部电子书笔记与划线');

        // 查询记录：单本按 file_path 过滤，全部则取所有
        let rows: AnnotationRecord[];
        if (filePath) {
          rows = await query({
            tableName: EBOOK_ANNOTATION_TABLE,
            columns: ['id', 'file_path', 'format', 'anchor', 'text', 'note', 'color', 'type', 'created_at', 'updated_at'],
            conditions: { file_path: filePath },
            orderBy: 'created_at',
            orderByDesc: false
          });
        } else {
          rows = await query({
            tableName: EBOOK_ANNOTATION_TABLE,
            columns: ['id', 'file_path', 'format', 'anchor', 'text', 'note', 'color', 'type', 'created_at', 'updated_at'],
            orderBy: 'created_at',
            orderByDesc: false
          });
        }

        // 生成 Markdown 内容
        const markdown = buildAnnotationsMarkdown(title, filePath, rows);

        // 弹出保存对话框
        const win = BrowserWindow.getFocusedWindow();
        const saveResult = await (win
          ? dialog.showSaveDialog(win, {
              title: '导出笔记与划线',
              defaultPath: `${sanitizeFileName(title)}.md`,
              filters: [{ name: 'Markdown', extensions: ['md'] }]
            })
          : dialog.showSaveDialog({
              title: '导出笔记与划线',
              defaultPath: `${sanitizeFileName(title)}.md`,
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
   * 按 file_path 查询书签记录，按 percent 升序（阅读顺序）返回
   *
   * @param _event - IPC 事件对象（未使用）
   * @param filePath - 必填参数，电子书文件绝对路径
   * @returns 成功返回 { success: true, data: BookmarkRecord[] }（无记录时 data 为空数组）；
   *          失败返回 { success: false, error: string }
   */
  ipcMain.handle(
    'ebook:get-bookmarks',
    async (
      _event,
      filePath: string
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
            created_at: now
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
 * 生成笔记与划线导出用的 Markdown 文本
 *
 * @param title - 一级标题（书名或「全部」）
 * @param filePath - 单本导出时传文件路径（用于区分单本/全部排版）；空串表示全部书
 * @param records - 笔记与划线记录数组
 * @returns Markdown 字符串
 */
function buildAnnotationsMarkdown(
  title: string,
  filePath: string,
  records: AnnotationRecord[]
): string {
  const lines: string[] = [];
  const totalNotes = records.filter((r) => (r.note || '').trim().length > 0).length;
  const totalHighlights = records.length - totalNotes;
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(
    `> 导出时间：${new Date().toLocaleString('zh-CN')} · 笔记 ${totalNotes} 条 · 划线 ${totalHighlights} 条`
  );
  lines.push('');

  if (filePath) {
    // 单本：直接输出笔记与划线两个分区
    appendAnnotationSection(lines, records);
  } else {
    // 全部：按 file_path 分组，每组一个小节
    const groups = new Map<string, AnnotationRecord[]>();
    for (const r of records) {
      const list = groups.get(r.file_path) || [];
      list.push(r);
      groups.set(r.file_path, list);
    }
    for (const [fp, list] of groups.entries()) {
      const bookName = path.basename(fp, path.extname(fp)) || fp;
      lines.push(`## 《${bookName}》`);
      lines.push('');
      appendAnnotationSection(lines, list);
    }
  }
  return lines.join('\n');
}

/**
 * 输出一组记录的「笔记」与「划线」两个三级分区
 *
 * @param lines - 累积输出的行数组
 * @param records - 该组（单本或某一本书）的记录
 * @returns 无返回值
 */
function appendAnnotationSection(lines: string[], records: AnnotationRecord[]): void {
  const notes = records.filter((r) => (r.note || '').trim().length > 0);
  const highlights = records.filter((r) => !(r.note || '').trim());

  lines.push('### 笔记');
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

  lines.push('### 划线');
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
