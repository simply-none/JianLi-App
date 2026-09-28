import { createTable } from "../utils/sql.ts";
import { myDb } from "./newSql.ts";
import { clipboard, ipcMain, nativeImage } from "electron";
import { exec } from "child_process";
import moment from 'moment';
// 数据库操作统一迁移到 newSql（替代旧 sql.ts 的 queryByConditions/upsertData）
import { del as newSqlDel, execute as newSqlExecute } from "./newSql.ts";

export const tableName = "clipboard_history";

// 图片 dataURL 体积上限：超过则不入库，避免 SQLite 被大图撑爆
const MAX_IMAGE_DATAURL_LENGTH = 2 * 1024 * 1024;
// 图片去重指纹取样长度（比较完整 dataURL 开销过大，取长度 + 头部片段足够区分）
const IMAGE_FINGERPRINT_SAMPLE = 200;
// 单条文本入库长度上限：拦在写库之前，避免超大文本（实测出现过 7.3MB 单条）
// 既撑大表，又让 SCAN 成本线性上涨。超限只截断入库，不丢整条记录。
const MAX_TEXT_LENGTH = 512 * 1024;
// 监听轮询间隔（ms）。1s 太激进：每分钟 60 次同步系统剪贴板调用，
// 每次都要阻塞主进程事件循环，鼠标快速移动时的卡顿瞬间就出在这里。
const POLL_INTERVAL = 1500;

/** 内容类型筛选：与渲染端工具栏的筛选项一一对应 */
export type ClipboardKind = 'all' | 'text' | 'image' | 'link';

// 构建 WHERE 子句与参数（参数化，避免 SQL 注入）
function buildWhere(opts: { keyword?: string; startTime?: string; endTime?: string; kind?: ClipboardKind }) {
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
  // 类型筛选：文本（有文本无图片）/ 图片（有图片）/ 链接（文本以协议开头）
  if (opts.kind && opts.kind !== 'all') {
    if (opts.kind === 'text') {
      clauses.push("(text IS NOT NULL AND text <> '' AND (image IS NULL OR image = ''))");
    } else if (opts.kind === 'image') {
      clauses.push("(image IS NOT NULL AND image <> '')");
    } else if (opts.kind === 'link') {
      clauses.push("(text LIKE 'http://%' OR text LIKE 'https://%')");
    }
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

/** 兼容旧库：补齐后续版本新增的列（列已存在时 sqlite 报 duplicate column name，忽略即可） */
async function ensureClipboardColumns() {
  const columns = [
    { name: 'use_count', def: 'INTEGER DEFAULT 1' },
    { name: 'last_used', def: 'TEXT' },
  ];
  for (const col of columns) {
    try {
      await newSqlExecute(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.def}`);
    } catch (err) {
      // 列已存在，忽略
    }
  }
}

/**
 * 补齐索引（幂等，每次启动执行，失败仅记录不影响启动）。
 *
 * 性能背景（2026-09-28 修复）：本表长期只靠 `uq_clipboard_history_id` 主键索引，
 * 而列表查询 / 启动预热都按 `create_time DESC, id DESC` 排序，去重也按 `text` 过滤，
 * 全无可用索引 ⇒ 每次都是 `SCAN` + `USE TEMP B-TREE FOR ORDER BY`。
 * 库涨到 120MB+ / 2.6 万行后，单次列表查询实测 **444ms**、去重查找 **445ms**；
 * 建立 `idx_clipboard_create_time` 后同一查询降到 **15ms**（约 30 倍）。
 */
async function ensureClipboardIndexes() {
  const indexes = [
    // 列表分页 + 启动预热（ORDER BY create_time DESC, id DESC）
    `CREATE INDEX IF NOT EXISTS idx_clipboard_create_time ON ${tableName}(create_time DESC, id DESC)`,
    // 类型筛选（kind = text / image）
    `CREATE INDEX IF NOT EXISTS idx_clipboard_image ON ${tableName}(image)`,
  ];
  for (const sql of indexes) {
    try {
      await newSqlExecute(sql);
    } catch (err) {
      console.error("clipboard ensure index error:", err);
    }
  }
}

/**
 * 清洗历史脏数据：早期版本把 NativeImage 直接 JSON 序列化后入库（实为 {} 之类的无效值），
 * 会被类型筛选与卡片图片分支误判为图片，这里统一清空。
 */
async function cleanLegacyImageData() {
  try {
    await newSqlExecute(
      `UPDATE ${tableName} SET image = '' WHERE image IS NOT NULL AND image <> '' AND image NOT LIKE 'data:image%'`
    );
  } catch (err) {
    console.error("clipboard clean legacy image error:", err);
  }
}

export async function initClipboard() {
  // 初始化表结构（兼容旧库，保证列存在）
  createTable({
    db: myDb.db,
    tableName,
    config: {},
    callback: (err: Error) => {
      if (err) console.error("clipboard table init error:", err);
    },
  });

  await ensureClipboardColumns();
  await ensureClipboardIndexes();
  await cleanLegacyImageData();
  registerClipboardIpc();
  startClipboardMonitor();
}

/**
 * 注册剪切板相关 IPC（全部基于 newSql.ts）。
 * 渲染端经 clipboardApi 调用，不再使用旧的 query-data / delete-data 透传。
 */
function registerClipboardIpc() {
  // 普通查询 + 高级查询（关键词 / 时间范围 / 类型）+ 分页，统一参数化
  ipcMain.handle(
    "clipboard:query",
    async (_e, { keyword, startTime, endTime, kind, limit = 50, offset = 0 }) => {
      try {
        const { where, params } = buildWhere({ keyword, startTime, endTime, kind });
        // 只取渲染端真正消费的列。
        // 原为 `SELECT *`，会把 rtf / bookmark / findText 这几个富文本大字段
        // 一并搬给渲染进程，再经 IPC 结构化克隆 —— 纯属浪费（前端从未读取它们）。
        // text 与 image 是卡片预览必需的，保留原值。
        const sql = `SELECT id, text, html, image, create_time, use_count, last_used FROM ${tableName} ${where} ORDER BY create_time DESC, id DESC LIMIT ? OFFSET ?`;
        const res = await newSqlExecute(sql, [...params, limit, offset]);
        return { success: true, data: res.rows || [] };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  );

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

  /**
   * 写回系统剪贴板并累加使用次数。
   * mode='text' 只写纯文本（去格式）；mode='raw' 保留 html / 图片原格式。
   */
  ipcMain.handle("clipboard:write", async (_e, { id, mode = 'raw' }) => {
    try {
      const res = await newSqlExecute(
        `SELECT id, text, html, image FROM ${tableName} WHERE id = ? LIMIT 1`,
        [id]
      );
      const row = res.rows && res.rows[0];
      if (!row) return { success: false, error: '记录不存在' };

      if (mode === 'text') {
        // 纯文本模式：只写 text，丢弃富文本与图片
        clipboard.writeText(row.text || '');
      } else if (row.image) {
        // 图片条目：写回图片（text 可能为空）
        clipboard.writeImage(nativeImage.createFromDataURL(row.image));
      } else if (row.html) {
        clipboard.write({ text: row.text || '', html: row.html });
      } else {
        clipboard.writeText(row.text || '');
      }

      // 复制即使用：累加次数并刷新最近使用时间
      const now = moment().format("YYYY-MM-DD HH:mm:ss");
      await newSqlExecute(
        `UPDATE ${tableName} SET use_count = COALESCE(use_count, 0) + 1, last_used = ? WHERE id = ?`,
        [now, id]
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /**
   * 模拟 Ctrl+V 粘贴到当前前台应用（快速面板用）。
   * 依赖 Windows 的 WScript.Shell SendKeys；非 Windows 或失败时返回失败，
   * 调用方已把内容写进剪贴板，用户手动粘贴不受影响。
   */
  ipcMain.handle("clipboard:simulate-paste", async () => {
    if (process.platform !== "win32") {
      return { success: false, error: "当前平台不支持自动粘贴" };
    }
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      // 等待小窗隐藏、焦点回到目标应用后再发送按键
      setTimeout(() => {
        exec(
          `powershell -NoProfile -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^v')"`,
          (err) => resolve(err ? { success: false, error: String(err) } : { success: true })
        );
      }, 150);
    });
  });
}

// 进程内缓存上一条剪贴板文本，避免每秒都查库比对。
// 原重构版本每秒调用 newSqlQuery，而 newSql.query 内部每次都触发
// ensureTableExists（sqlite_master 查询 + 两次 PRAGMA table_info 自省），
// 即每秒凭空多 3 次 DB 往返，是监听卡顿的根因。
let lastClipboardText = "";
// 图片指纹缓存（长度 + 头部片段），避免每次都对整张图做 PNG 编码与全量比较
let lastImageFingerprint = "";
// 廉价图片指纹缓存（尺寸 + 位图字节数），**不做 PNG 编码**即可判断图片是否变了
let lastImageCheapKey = "";

/**
 * ⚠️ 这里**没有**使用 `clipboard.getChangeCount()` 作为守卫。
 *
 * 曾尝试过，但经二进制符号核查确认：Electron 36.9.5 的 `clipboard` 模块**不提供**
 * 该 API（`electron.exe` 里 `ChangeCount` 仅以 Chromium 媒体指标名出现，与剪贴板无关），
 * `electron.d.ts` 也没有声明。任何调用都会取到 `undefined` ⇒ 守卫恒失效，
 * 反而让人误以为已经优化过。**不要重新引入这个思路。**
 *
 * 真正可靠的守卫见下方 `cheapImageKey()`：只用「尺寸 + 位图字节数」判断，
 * 完全不触发 PNG 编码。**同样不要用 `readBuffer('image/png')`** —— 原因见其注释。
 */

/** 计算图片指纹：长度 + 头部取样，足以区分不同截图且开销极低 */
function imageFingerprint(dataUrl: string): string {
  return `${dataUrl.length}:${dataUrl.slice(0, IMAGE_FINGERPRINT_SAMPLE)}`;
}

/**
 * 廉价图片指纹：**不做 PNG 编码**。
 *
 * ⚠️ 关键取舍（2026-09-28 修正）：**不要用 `readBuffer('image/png')`**。
 * Windows 剪贴板里的图片通常以 DIB/Bitmap 形式存放，并非 PNG。当剪贴板没有
 * 原生 PNG 数据时，Electron 的 `readBuffer('image/png')` 会在内部**临时编码成 PNG**
 * 再返回 —— 等于把「省掉的编码」又加回来了，守卫形同虚设。
 *
 * 改用「尺寸 + 位图字节数」组合，两者都**不涉及 PNG 编码**：
 *  - `getSize()` 只读头部尺寸元数据；
 *  - `toBitmap()` 拿的是 BGRA 原始像素缓冲（无压缩、无编码，纯内存拷贝）。
 *
 * 指纹 = `宽x高:位图字节数`。同一张图重复读必然一致；换图（哪怕尺寸相同）
 * 只要像素缓冲长度不同或尺寸不同就能区分。相比之下只用尺寸太弱（同尺寸的不同
 * 截图会碰撞 → 漏记录），这个组合在「不编码」的前提下已足够强。
 *
 * 极端情况：两张尺寸相同、且像素长度也相同的不同图片会碰撞 → 漏记一条。
 * 这个概率远低于「同尺寸截图」的必然碰撞，且代价只是少存一条历史，可接受。
 */
function cheapImageKey(): string {
  try {
    const img = clipboard.readImage();
    if (img.isEmpty()) return "";
    const { width, height } = img.getSize();
    if (!width || !height) return "";
    // toBitmap 返回 BGRA 原始像素，纯内存拷贝，不做任何编码压缩
    const bmp = img.toBitmap();
    const bytes = bmp ? bmp.length : 0;
    return `${width}x${height}:${bytes}`;
  } catch {
    return "";
  }
}

/** 带 use_count / last_used 的落库：相同纯文本合并为一条并置顶，图片每次都新增 */
async function saveClipboardItem(payload: {
  text: string;
  html: string;
  image: string;
  rtf: string;
  bookmark: string;
  findText: string;
  now: string;
}) {
  const { text, html, image, rtf, bookmark, findText, now } = payload;

  // 超长文本截断（改在写库前拦，避免 7MB 级记录进表放大后续所有 SCAN 成本）
  const safeText = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;

  // 图片条目不做合并（每次截图都是独立内容），直接新增
  if (image) {
    await newSqlExecute(
      `INSERT INTO ${tableName} (text, html, image, rtf, bookmark, findText, create_time, use_count, last_used) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [safeText, html, image, rtf, bookmark, findText, now, now]
    );
    return;
  }

  // 纯文本/富文本：已存在相同文本则合并（次数 +1、时间刷新到置顶），否则新增。
  // 注：这里对 TEXT 列的等值匹配无法走索引（SQLite 无前缀索引，且长文本做索引不划算），
  // 成本随行数线性上涨，故加 LIMIT 之外再做一道长度短路：超长文本不做合并查找，直接新增。
  if (safeText.length <= 8192) {
    const exist = await newSqlExecute(
      `SELECT id FROM ${tableName} WHERE text = ? AND (image IS NULL OR image = '') LIMIT 1`,
      [safeText]
    );
    const existId = exist.rows && exist.rows[0]?.id;
    if (existId) {
      await newSqlExecute(
        `UPDATE ${tableName} SET use_count = COALESCE(use_count, 0) + 1, last_used = ?, create_time = ? WHERE id = ?`,
        [now, now, existId]
      );
      return;
    }
  }

  await newSqlExecute(
    `INSERT INTO ${tableName} (text, html, image, rtf, bookmark, findText, create_time, use_count, last_used) VALUES (?, ?, '', ?, ?, ?, ?, 1, ?)`,
    [safeText, html, rtf, bookmark, findText, now, now]
  );
}

/**
 * 后台剪贴板监听：监测剪贴板变化并落库（newSql）。
 *
 * 性能红线（2026-09-28 修复，**四层守卫，顺序不可调整**）：
 *
 *   ┌─ 1. readText() 文本未变 ─────────────────────────── 最便宜
 *   ├─ 2. availableFormats() 无 image/* ───────────────── 便宜
 *   ├─ 3. cheapImageKey() 尺寸+位图长度，**不编码** ────── 便宜 ← 关键！
 *   └─ 4. toDataURL()（PNG 编码）仅新图片才做 ──────────── 昂贵
 *
 * **第 3 层的存在是这个函数的全部要点。** 它必须在第 4 层之前拦掉「图片没变」的情况。
 *
 * 三次修正的历史（都不要再犯）：
 *  - v1：把指纹比对放在 `toDataURL()` **之后** ⇒ 每轮白编码一次；
 *  - v2：加 `getChangeCount()` 序列号守卫，但 **Electron 36 没有这个 API**
 *    （`electron.d.ts` 未声明，`electron.exe` 里也搜不到剪贴板相关的 ChangeCount）
 *    ⇒ 守卫恒失效，问题原样保留；
 *  - v3：用 `readBuffer('image/png')` 做廉价指纹，但 **Windows 剪贴板里图片通常是
 *    DIB/Bitmap 而非 PNG**，没有原生 PNG 数据时 `readBuffer` 会**内部临时编码** ⇒
 *    又把编码加回来了；
 *  - v4（现行）：`getSize()` + `toBitmap().length`，两者都不触发任何编码。
 *
 * 用户可复现的症状正好对应这条链：**剪贴板最近一条是文本时不卡（走不到第 3 层），
 * 是图片时卡（每轮一路走到第 4 层）**。
 *
 * 序列号守卫实测无效已移除；`readBuffer('image/png')` 亦被否决。**两者都不要重新引入**，
 * 原因见上方 `cheapImageKey()` 的注释。
 */
function startClipboardMonitor() {
  // 启动时用最新一条文本预热缓存，避免重启后首次复制重复落库
  newSqlExecute(`SELECT text, image FROM ${tableName} ORDER BY create_time DESC LIMIT 1`)
    .then((res) => {
      const row = res.rows && res.rows[0];
      lastClipboardText = row?.text || "";
      if (row?.image) {
        lastImageFingerprint = imageFingerprint(row.image);
        // 库里的 dataURL 无法反推原始 PNG 字节，故廉价指纹留空：
        // 首次轮询会多编码一次（可接受的一次性代价），之后即靠廉价指纹命中。
        lastImageCheapKey = "";
      } else {
        lastImageFingerprint = "";
        lastImageCheapKey = "";
      }
    })
    .catch((err) => console.error("clipboard seed last text error:", err));

  setInterval(async () => {
    const text = clipboard.readText();
    const hasText = !!text && !!text.trim();

    // ── 文本未变化：再判断图片 ──
    if (!hasText || text === lastClipboardText) {
      // 第 2 层：格式守卫（避免对纯文本剪贴板做任何图片读取）
      const formats = clipboard.availableFormats();
      const hasImageFormat = formats.some((f: string) => f.toLowerCase().startsWith("image/"));
      if (!hasImageFormat) {
        // 剪贴板是纯文本：清空图片缓存，避免「文本 → 图片 → 文本」来回切时误判
        lastImageCheapKey = "";
        lastImageFingerprint = "";
        return;
      }

      // 第 3 层（关键）：廉价指纹 —— 只读尺寸 + 位图长度，**不做 PNG 编码**
      const cheapKey = cheapImageKey();
      if (cheapKey && cheapKey === lastImageCheapKey) return; // 图片没变 → 零编码返回

      // 第 4 层：确认是新图片，才付编码代价
      const img = clipboard.readImage();
      if (img.isEmpty()) return;
      const dataUrl = img.toDataURL();
      const fingerprint = imageFingerprint(dataUrl);

      // 廉价指纹可能因 readBuffer 失败而为空，此时回落到昂贵指纹兜底去重
      if (!cheapKey && fingerprint === lastImageFingerprint) return;

      const now = moment().format("YYYY-MM-DD HH:mm:ss");
      try {
        // 超过体积上限的图片不入库，仅记录一条占位说明
        if (dataUrl.length > MAX_IMAGE_DATAURL_LENGTH) {
          await saveClipboardItem({
            text: "[图片过大，未保存]",
            html: "",
            image: "",
            rtf: "",
            bookmark: "",
            findText: "",
            now,
          });
        } else {
          await saveClipboardItem({
            text: "",
            html: "",
            image: dataUrl,
            rtf: "",
            bookmark: "",
            findText: "",
            now,
          });
        }
        lastImageFingerprint = fingerprint;
        // 只有成功落库/记账后才刷新廉价指纹，失败则下轮重试
        lastImageCheapKey = cheapKey;
      } catch (err) {
        console.error("clipboard image insert error:", err);
      }
      return;
    }

    // 文本确为新内容，再读取重型格式并落库
    const html = clipboard.readHTML();
    const rtf = clipboard.readRTF();
    const bookmark = JSON.stringify(clipboard.readBookmark());
    const findText = clipboard.readFindText();

    try {
      const now = moment().format("YYYY-MM-DD HH:mm:ss");
      await saveClipboardItem({ text, html, image: "", rtf, bookmark, findText, now });
      lastClipboardText = text;
      // 剪贴板已换成文本，图片缓存作废
      lastImageCheapKey = "";
      lastImageFingerprint = "";
    } catch (err) {
      console.error("clipboard insert error:", err);
    }
  }, POLL_INTERVAL);
}
