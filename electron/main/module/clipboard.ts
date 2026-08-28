import { createTable } from "../utils/sql.ts";
import { myDb } from "./sql.ts";
import { clipboard, ipcMain } from "electron";
import moment from 'moment';
// 数据库操作统一迁移到 newSql（替代旧 sql.ts 的 queryByConditions/upsertData）
import { del as newSqlDel, execute as newSqlExecute } from "./newSql.ts";

export const tableName = "clipboard_history";

// 构建 WHERE 子句与参数（参数化，避免 SQL 注入）
function buildWhere(opts: { keyword?: string; startTime?: string; endTime?: string }) {
  const clauses: string[] = [];
  const params: any[] = [];
  if (opts.keyword) {
    clauses.push("text LIKE ?");
    params.push(`%${opts.keyword}%`);
  }
  if (opts.startTime) {
    clauses.push("create_time >= ?");
    params.push(opts.startTime);
  }
  if (opts.endTime) {
    clauses.push("create_time <= ?");
    params.push(opts.endTime);
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export function initClipboard() {
  // 初始化表结构（兼容旧库，保证列存在）
  createTable({
    db: myDb.db,
    tableName,
    callback: (err: Error) => {
      if (err) console.error("clipboard table init error:", err);
    },
    config: {},
  });

  registerClipboardIpc();
  startClipboardMonitor();
}

/**
 * 注册剪切板相关 IPC（全部基于 newSql.ts）。
 * 渲染端经 clipboardApi 调用，不再使用旧的 query-data / delete-data 透传。
 */
function registerClipboardIpc() {
  // 普通查询 + 高级查询（关键词 / 时间范围）+ 分页，统一参数化
  ipcMain.handle("clipboard:query", async (_e, { keyword, startTime, endTime, limit = 50, offset = 0 }) => {
    try {
      const { where, params } = buildWhere({ keyword, startTime, endTime });
      const sql = `SELECT * FROM ${tableName} ${where} ORDER BY create_time DESC LIMIT ? OFFSET ?`;
      const res = await newSqlExecute(sql, [...params, limit, offset]);
      return { success: true, data: res.rows || [] };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // 单条删除（按 id）
  ipcMain.handle("clipboard:delete", async (_e, { id }) => {
    try {
      const { changes } = await newSqlDel({ tableName, condition: { id } });
      return { success: true, changes };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // 批量删除（按 id 数组）
  ipcMain.handle("clipboard:delete-many", async (_e, { ids }) => {
    try {
      if (!Array.isArray(ids) || ids.length === 0) return { success: true, changes: 0 };
      const placeholders = ids.map(() => "?").join(",");
      const { changes } = await newSqlExecute(`DELETE FROM ${tableName} WHERE id IN (${placeholders})`, ids);
      return { success: true, changes };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // 清空全部（newSql.del 不允许空条件，故用 execute）
  ipcMain.handle("clipboard:clear", async () => {
    try {
      const { changes } = await newSqlExecute(`DELETE FROM ${tableName}`);
      return { success: true, changes };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // 按条件删除（高级查询-删除场景）：时间范围
  ipcMain.handle("clipboard:delete-by-condition", async (_e, { startTime, endTime }) => {
    try {
      const { where, params } = buildWhere({ startTime, endTime });
      const { changes } = await newSqlExecute(`DELETE FROM ${tableName} ${where}`, params);
      return { success: true, changes };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // 去重删除：相同 text 仅保留 id 最小的一条
  ipcMain.handle("clipboard:dedup", async () => {
    try {
      const { changes } = await newSqlExecute(
        `DELETE FROM ${tableName} WHERE id NOT IN (SELECT MIN(id) FROM ${tableName} GROUP BY text)`
      );
      return { success: true, changes };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}

// 进程内缓存上一条剪贴板文本，避免每秒都查库比对。
// 原重构版本每秒调用 newSqlQuery，而 newSql.query 内部每次都触发
// ensureTableExists（sqlite_master 查询 + 两次 PRAGMA table_info 自省），
// 即每秒凭空多 3 次 DB 往返，是监听卡顿的根因。
let lastClipboardText = "";

/**
 * 后台剪贴板监听：监测剪贴板变化并落库（newSql）。
 *
 * 性能对比原重构版本（消除卡顿）：
 * 1. 每秒仅读取轻量的 readText() 并比对进程内缓存，文本未变则直接返回，
 *    不再每秒执行 DB 查询（规避 newSql.query 每次 3 次 schema 自省）。
 * 2. 重型格式（html/image/rtf/bookmark/findText）延迟到确认文本变化后才读取，
 *    避免每秒无谓解码剪贴板图片等开销。
 * 3. 写入改用 newSql.execute 原生 INSERT（仍走 newSql），仅在真正新增时发生，
 *    规避 newSqlUpsert 的事务包裹 + ensureTableColumns 自省开销。
 */
function startClipboardMonitor() {
  // 启动时用最新一条文本预热缓存，避免重启后首次复制重复落库
  newSqlExecute(`SELECT text FROM ${tableName} ORDER BY create_time DESC LIMIT 1`)
    .then((res) => {
      lastClipboardText = (res.rows && res.rows[0]?.text) || "";
    })
    .catch((err) => console.error("clipboard seed last text error:", err));

  setInterval(async () => {
    const text = clipboard.readText();

    // 无内容或文本未变化：直接返回，零 DB 操作、零重型读取
    if (!text || !text.trim() || text === lastClipboardText) return;

    // 文本确为新内容，再读取重型格式并落库
    const html = clipboard.readHTML();
    const image = clipboard.readImage();
    const rtf = clipboard.readRTF();
    const bookmark = clipboard.readBookmark();
    const findText = clipboard.readFindText();

    try {
      await newSqlExecute(
        `INSERT INTO ${tableName} (text, html, image, rtf, bookmark, findText, create_time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          text,
          html,
          JSON.stringify(image),
          rtf,
          JSON.stringify(bookmark),
          findText,
          moment().format("YYYY-MM-DD HH:mm:ss"),
        ]
      );
      lastClipboardText = text;
    } catch (err) {
      console.error("clipboard insert error:", err);
    }
  }, 1000);
}
