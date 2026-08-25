import { BrowserWindow, dialog, shell, ipcMain } from "electron";
import fs from "fs";
import axios from "axios";
import moment from "moment";
import { win } from "./mainWindow.ts";
import path from "path";
import { Worker } from "worker_threads";
import { scanWorkerPath } from "../variables.ts";
import { globby } from 'globby'
import fastGlob from 'fast-glob'
import { execSync, exec } from "child_process";
import colors from 'colors';
// 扫描进程worker
let scanWorker;

interface FileSaveObjType {
  content: any;
  path: string;
  name: string;
  tempSplit: string;
  chunkLength: number;
  currentChunkIndex: number;
}

// 获取下述函数的参数类型
export type CopyFolderType = {
  source: string;
  target: string;
  ignore?: string[];
  include?: string[];
  ignoreSuffix?: string[];
  includeSuffix?: string[];
  preserveTimestamps?: boolean;
  force?: boolean;
  recursive?: boolean;
};

function getSelectType(type: String | String[]) {
  let filters = []
  // 选择文件的类型
  // 如果是图片
  if (type.includes("image")) {
    filters.push(
      { name: "图片", extensions: ["jpg", "png", "gif", "webp", "svg", "jpeg"] },
    )
  }
  // 如果是视频
  if (type.includes("video")) {
    filters.push(
      { name: "视频", extensions: ["mkv", "avi", "mp4"] },
    )
  }
  // 如果是音频
  if (type.includes("audio")) {
    filters.push(
      { name: "音频", extensions: ["mp3", "wav", "aac"] },
    )
  }
  // 如果是可执行文件
  if (type.includes("executable")) {
    filters.push(
      { name: "可执行文件", extensions: ["exe"] },
    )
  }
  // 如果是压缩文件
  if (type.includes("zip")) {
    filters.push(
      { name: "压缩文件", extensions: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"] },
    )
  }
  // 如果是文件
  if (type.includes("file")) {
    filters.push(
      { name: "所有文件", extensions: ["*"] },
    )
  }
  return filters
}

export function getFilePath({
  openFile,
  openDirectory,
  multiSelections,
  type,
}: {
  openFile?: boolean;
  openDirectory?: boolean;
  multiSelections?: boolean;
  type?: String | String[];
}) {
  const properties = [];
  if (openFile) {
    properties.push("openFile");
  }
  if (openDirectory) {
    properties.push("openDirectory");
  }
  if (multiSelections) {
    properties.push("multiSelections");
  }
  const filters = getSelectType(type || "file");

  const result = dialog.showOpenDialogSync({
    title: openDirectory ? "选择文件夹" : "选择文件",
    properties: properties,
    filters: filters,
  });
  return result;
}

const fileSliceList = [];

async function merge() {
  // 排序
  fileSliceList.sort((a, b) => {
    return a.currentChunkIndex - b.currentChunkIndex;
  });
  let path = fileSliceList[0].path;
  let name = fileSliceList[0].name;
  let fileName = path + name;
  // 判断是否存在文件
  if (fs.existsSync(path + name)) {
    // 存在则重新命名
    fileName = path + moment().format("_YYYY-MM-DD_HH-mm-ss_") + name;
  }
  for (let i = 0; i < fileSliceList.length; i++) {
    console.log(fileSliceList[i], `, ${i + 1}\n`);
    const arr = fs.readFileSync(
      fileSliceList[i].path +
        fileSliceList[i].tempSplit +
        fileSliceList[i].name +
        "." +
        fileSliceList[i].currentChunkIndex
    );
    fs.writeFileSync(fileName, arr, { flag: "a+" });
  }
  return fileName;
}
// 使用nodejs的fs同步模块保存文件 函数，保存成功返回ok，否则返回失败信息
export async function saveFile({
  path,
  name,
  tempSplit,
  content,
  chunkLength,
  currentChunkIndex,
}: FileSaveObjType) {
  try {
    let newPath = "";
    const buffer = Buffer.from(content);
    // 获取res的类型 使用toString.call
    const type = Object.prototype.toString.call(buffer);
    console.log(type, "type");
    fs.writeFileSync(path + tempSplit + name + "." + currentChunkIndex, buffer);
    fileSliceList.push({
      path,
      name,
      tempSplit,
      currentChunkIndex,
    });
    if (fileSliceList.length == chunkLength) {
      // 合片
      newPath = await merge();
      // 删除缓存文件
      for (let i = 0; i < fileSliceList.length; i++) {
        const oldPath =
          fileSliceList[i].path +
          fileSliceList[i].tempSplit +
          fileSliceList[i].name +
          "." +
          fileSliceList[i].currentChunkIndex;
        fs.unlinkSync(oldPath);
      }
      fileSliceList.length = 0;
    }
    return newPath;
  } catch (err) {
    console.log(err, "err");
    return "error" + err;
  }
}

// 使用fs.cp 进行整个文件夹的复制
export function copyFolder(
  {
    source,
    target,
    // 不想包含的文件名
    ignore,
    // 想包含的文件名
    include,
    // 不想包含的文件后缀名
    ignoreSuffix,
    // 想包含的文件后缀名
    includeSuffix,
    // 是否保留源文件的时间戳
    preserveTimestamps = true,
    // 是否覆盖现有文件或目录
    force = true,
  }: CopyFolderType,
  win: BrowserWindow
) {
  const isExist = fs.existsSync(target);
  if (isExist) {
    // 使用moment获取当前格式化时间YYYY-MM-DD_HH-mm-ss
    const time = moment().format("YYYY-MM-DD_HH-mm-ss");
    target = target + "_copy_" + time;
  }
  try {
    // 自写递归遍历 + 受控并发复制，替代 fs.cp 的串行复制，提升大目录吞吐（P2）
    runCopyFolder(source, target, {
      ignore,
      include,
      includeSuffix,
      ignoreSuffix,
      preserveTimestamps,
      force,
      win
    });
  } catch (err) {
    win.webContents.send("copy-folder", err);
    console.log(err, "res");
  }
}

/**
 * 递归遍历源目录，按统一过滤谓词筛选后并发复制文件到目标目录。
 * - 目录即时创建，文件入队后用受控并发池复制（默认 8 路），重叠 I/O 提升吞吐（P2）。
 * - 符号链接节点跳过（不复制、不跟随），避免指向祖先目录时无限递归（P3）。
 * - 过滤语义与原 fs.cp filter 完全一致，且跨平台（path 模块替代硬编码分隔符，P1）。
 */
async function runCopyFolder(
  source: string,
  target: string,
  opts: {
    ignore?: string[];
    include?: string[];
    includeSuffix?: string[];
    ignoreSuffix?: string[];
    preserveTimestamps?: boolean;
    force?: boolean;
    win: BrowserWindow;
  }
) {
  const {
    ignore,
    include,
    includeSuffix,
    ignoreSuffix,
    preserveTimestamps = true,
    force = true,
    win
  } = opts;

  // 统一过滤谓词：后缀取第一个点之后的全部；include 按相对路径任一段精确匹配（与原逻辑一致）
  const matchFilter = (absSrc: string, relParts: string[]) => {
    const srcName = path.basename(absSrc);
    const srcNameSuffix = srcName.split(".").slice(1).join(".");
    const isInclude = include && include.some((item) => relParts.includes(item));
    if (isInclude && ignoreSuffix && !ignoreSuffix.includes(srcNameSuffix)) return true;
    if (includeSuffix && includeSuffix.includes(srcNameSuffix)) return true;
    if (ignore && ignore.includes(srcName)) return false;
    if (ignoreSuffix && ignoreSuffix.includes(srcNameSuffix)) return false;
    if ((include && include.length) || (includeSuffix && includeSuffix.length)) return false;
    return true;
  };

  const fileJobs: { src: string; dest: string }[] = [];

  const walk = async (currentSrc: string, currentDest: string) => {
    const rel = path.relative(source, currentSrc);
    // 根目录本身始终放行；子节点用相对路径各段做过滤判断
    if (rel !== "") {
      const relParts = rel.split(/[\\/]/).filter(Boolean);
      if (!matchFilter(currentSrc, relParts)) return;
    }

    const entries = await fs.promises.readdir(currentSrc, { withFileTypes: true });
    await fs.promises.mkdir(currentDest, { recursive: true });

    for (const entry of entries) {
      const absSrc = path.join(currentSrc, entry.name);
      const absDest = path.join(currentDest, entry.name);
      // 符号链接环路防护：跳过软链接（文件/目录），既不复制也不跟随（P3）
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await walk(absSrc, absDest);
      } else if (entry.isFile()) {
        fileJobs.push({ src: absSrc, dest: absDest });
      }
    }
  };

  try {
    await walk(source, target);
  } catch (err) {
    win.webContents.send("copy-folder", err);
    console.log(err, "res");
    return;
  }

  const total = fileJobs.length;
  // 初始进度：total 已通过 walk 取得，current 从 0 开始；前端勾选「进度检测」时弹窗展示
  if (total > 0) {
    win.webContents.send("copy-folder-progress", { current: 0, total, currentPath: "" });
  }

  // 受控并发复制：重叠 I/O 提升大目录（海量小文件 / 网络盘 / SSD）吞吐
  const CONCURRENCY = 8;
  let cursor = 0;
  let processed = 0;
  let lastEmit = 0;
  const failed: string[] = [];

  // 节流上报进度：至少间隔 80ms 或已到收尾，避免海量文件时 IPC 刷屏
  const emitProgress = (currentPath: string) => {
    const now = Date.now();
    if (now - lastEmit >= 80 || processed >= total) {
      lastEmit = now;
      win.webContents.send("copy-folder-progress", { current: processed, total, currentPath });
    }
  };

  const worker = async () => {
    while (cursor < fileJobs.length) {
      const job = fileJobs[cursor++];
      try {
        if (!force && fs.existsSync(job.dest)) {
          // 不覆盖模式：目标已存在则跳过（仍计入进度）
        } else {
          await fs.promises.copyFile(job.src, job.dest);
          if (preserveTimestamps) {
            const st = await fs.promises.stat(job.src);
            await fs.promises.utimes(job.dest, st.atime, st.mtime);
          }
        }
      } catch (e) {
        failed.push(`${job.src}: ${(e as Error).message}`);
      }
      processed++;
      emitProgress(job.src);
    }
  };

  const poolSize = Math.min(CONCURRENCY, Math.max(1, fileJobs.length));
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  // 收尾强制上报一次完整进度，保证进度条走到 100%
  win.webContents.send("copy-folder-progress", { current: total, total, currentPath: "" });

  if (failed.length) {
    win.webContents.send(
      "copy-folder",
      `复制完成，但有 ${failed.length} 个文件失败:\n` + failed.slice(0, 20).join("\n")
    );
  } else {
    win.webContents.send("copy-folder", null);
  }
}

// 递归收集目录下的文件绝对路径（是否遍历子目录由 recursive 决定）
function collectFiles(dir: string, recursive: boolean): string[] {
  const result: string[] = [];
  const walk = (current: string) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (recursive) walk(full);
      } else if (entry.isFile()) {
        result.push(full);
      }
    }
  };
  walk(dir);
  return result;
}

// 递归收集目录（按关键字模糊匹配目录名）；recursive 决定是否深入子目录查找匹配文件夹
function collectDirs(dir: string, recursive: boolean, keyword: string): string[] {
  const result: string[] = [];
  const kw = keyword.toLowerCase();
  const walk = (current: string) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(current, entry.name);
      if (entry.name.toLowerCase().includes(kw)) result.push(full);
      if (recursive) walk(full);
    }
  };
  walk(dir);
  return result;
}

interface DeleteFilesType {
  folder: string;
  // 删除模式：整体删除 / 按后缀类型 / 模糊匹配文件名 / 模糊匹配文件夹
  mode: 'all' | 'suffix' | 'fuzzy' | 'folder';
  // 后缀类型模式：要删除的后缀列表，如 ['.log', '.tmp']
  suffixes?: string[];
  // 模糊匹配模式：文件名包含的关键字
  pattern?: string;
  // 是否遍历子目录
  recursive?: boolean;
  // 是否放入回收站（false=彻底删除）
  recycleBin?: boolean;
}

// 文件删除：整体 / 后缀类型 / 模糊文件名；支持遍历、回收站、可选真实进度
export async function deleteFiles(args: DeleteFilesType, win: BrowserWindow) {
  const { folder, mode, suffixes, pattern, recursive = false, recycleBin = true } = args;

  // 1. 收集待删除文件列表
  let targets: string[] = [];
  if (mode === 'all') {
    // 整体删除忽略遍历选项，整文件夹（含子目录）全部删除
    targets = collectFiles(folder, true);
  } else if (mode === 'suffix') {
    const norm = (suffixes || []).map((s) => (s.startsWith('.') ? s : '.' + s).toLowerCase());
    targets = collectFiles(folder, recursive).filter((f) => norm.includes(path.extname(f).toLowerCase()));
  } else if (mode === 'fuzzy') {
    const kw = (pattern || '').toLowerCase();
    targets = collectFiles(folder, recursive).filter((f) => path.basename(f).toLowerCase().includes(kw));
  } else if (mode === 'folder') {
    const kw = (pattern || '').toLowerCase();
    targets = collectDirs(folder, recursive, kw);
  }

  const total = targets.length;
  let processed = 0;
  let lastEmit = 0;
  const emitProgress = (currentPath: string) => {
    const now = Date.now();
    if (now - lastEmit >= 80 || processed === total) {
      lastEmit = now;
      win.webContents.send('delete-files-progress', { current: processed, total, currentPath });
    }
  };
  // 先发一条初始进度，扫描阶段即有反馈
  win.webContents.send('delete-files-progress', { current: 0, total, currentPath: '' });

  const failed: string[] = [];
  for (const file of targets) {
    try {
      // 命中文件夹可能已被上游匹配目录删除（父目录先删则子目录已不存在），跳过避免误报失败
      if (fs.existsSync(file)) {
        if (recycleBin) {
          // 移入回收站（Electron 跨平台 API：Trash / Recycle Bin），失败时 reject
          await shell.trashItem(file);
        } else {
          // recursive: true 对文件无效、对文件夹递归删除，统一处理
          fs.rmSync(file, { recursive: true, force: true });
        }
      }
    } catch (e) {
      failed.push(`${file}: ${(e as Error).message}`);
    }
    processed++;
    emitProgress(file);
  }

  // 整体删除：文件删完后清理（已空的）文件夹本身
  if (mode === 'all') {
    try {
      if (recycleBin) {
        await shell.trashItem(folder);
      } else {
        fs.rmSync(folder, { recursive: true, force: true });
      }
    } catch (e) {
      failed.push(`${folder}: ${(e as Error).message}`);
    }
  }

  // 收尾强制上报一次完整进度，保证进度条走到 100%
  win.webContents.send('delete-files-progress', { current: total, total, currentPath: '' });
  if (failed.length) {
    win.webContents.send(
      'delete-files',
      `删除完成，但有 ${failed.length} 个文件失败:\n` + failed.slice(0, 20).join('\n')
    );
  } else {
    win.webContents.send('delete-files', null);
  }
}

// 列出文件夹内容（批量重命名预览用）：返回文件名/路径/是否目录/扩展名/大小/时间
interface ListFolderItem {
  name: string;   // 文件名（含扩展名）
  path: string;   // 完整路径
  isDir: boolean; // 是否为目录
  ext: string;    // 扩展名（含点，目录为空串）
  size: number;   // 字节数（目录为 0）
  mtime: number;   // 修改时间（毫秒）
  ctime: number;   // 状态变更时间（毫秒，Windows 上接近创建时间）
  birthtime: number; // 创建时间（毫秒，部分平台/文件系统可能为 0）
}
export function listFolder(args: { dir: string; recursive?: boolean; includeDirs?: boolean }): ListFolderItem[] {
  const { dir, recursive = false, includeDirs = true } = args;
  const result: ListFolderItem[] = [];
  const walk = (current: string) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      // Dirent 不带时间戳，必须 stat 才能拿到真实的 mtime/ctime/birthtime；
      // 否则 entry.mtimeMs 等为 undefined，前端 formatDate 会得到 NaN
      let st;
      try {
        st = fs.statSync(full);
      } catch {
        // 无权限/损坏等异常项：给 0 兜底，不中断整个目录遍历
        st = { mtimeMs: 0, ctimeMs: 0, birthtimeMs: 0, size: 0 } as any;
      }
      if (entry.isDirectory()) {
        if (includeDirs) {
          result.push({ name: entry.name, path: full, isDir: true, ext: '', size: st.size, mtime: st.mtimeMs, ctime: st.ctimeMs, birthtime: st.birthtimeMs });
        }
        if (recursive) walk(full);
      } else if (entry.isFile()) {
        result.push({
          name: entry.name,
          path: full,
          isDir: false,
          ext: path.extname(entry.name),
          size: st.size,
          mtime: st.mtimeMs,
          ctime: st.ctimeMs,
          birthtime: st.birthtimeMs,
        });
      }
    }
  };
  walk(dir);
  // 排序：目录优先，再按名称（中文 locale 排序）
  result.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh');
  });
  return result;
}

// 批量重命名：前端已算好 oldPath/newPath，这里只负责 I/O + 进度上报
interface RenameItemType {
  oldPath: string;
  newPath: string;
}
type RenameStrategy = 'block' | 'auto' | 'skip';
interface RenameFilesType {
  items: RenameItemType[];
  strategy?: RenameStrategy; // 重名时的处理策略：block=拦截报错（默认） / auto=自动加序号 / skip=跳过
}

// 在目标已存在时，寻找一个空闲名（于扩展名前插入 (n)）
function findFreeName(target: string): string {
  const dir = target.replace(/[\\/][^\\/]*$/, '');
  const base = target.replace(/^.*[\\/]/, '');
  const dot = base.lastIndexOf('.');
  const nameOnly = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  let n = 2;
  let candidate = path.join(dir, `${nameOnly} (${n})${ext}`);
  while (fs.existsSync(candidate)) {
    n++;
    candidate = path.join(dir, `${nameOnly} (${n})${ext}`);
  }
  return candidate;
}

export async function renameFiles(args: RenameFilesType, win: BrowserWindow) {
  const items = args.items || [];
  const strategy: RenameStrategy = args.strategy || 'block';
  const total = items.length;
  let processed = 0;
  let lastEmit = 0;
  // 先发一条初始进度
  win.webContents.send('rename-files-progress', { current: 0, total, currentPath: '' });

  const failed: string[] = [];
  const renamed: RenameItemType[] = []; // 实际成功重命名的映射，供前端「撤销」
  for (const it of items) {
    try {
      // 源 === 目标：无变化，跳过（前端已过滤，这里再兜底一次）
      if (it.oldPath === it.newPath) {
        processed++;
        continue;
      }
      let target = it.newPath;
      // 目标已在磁盘上存在：按策略处理
      if (fs.existsSync(target)) {
        if (strategy === 'skip') {
          processed++;
          continue; // 跳过，不计入已重命名
        } else if (strategy === 'auto') {
          target = findFreeName(target);
        } else {
          throw new Error('目标已存在，可能发生覆盖');
        }
      }
      fs.renameSync(it.oldPath, target);
      renamed.push({ oldPath: it.oldPath, newPath: target });
    } catch (e) {
      failed.push(`${it.oldPath} -> ${it.newPath}: ${(e as Error).message}`);
    }
    processed++;
    const now = Date.now();
    if (now - lastEmit >= 80 || processed === total) {
      lastEmit = now;
      win.webContents.send('rename-files-progress', { current: processed, total, currentPath: it.newPath });
    }
  }

  // 收尾强制上报一次完整进度，保证进度条走到 100%
  win.webContents.send('rename-files-progress', { current: total, total, currentPath: '' });
  if (failed.length) {
    win.webContents.send(
      'rename-files',
      { error: `重命名完成，但有 ${failed.length} 个失败:\n` + failed.slice(0, 20).join('\n'), renamed }
    );
  } else {
    // 成功：返回实际重命名映射，供撤销
    win.webContents.send('rename-files', { renamed });
  }
}

// 撤销重命名：将上一次 newPath 还原回 oldPath（反向重命名）
export async function reverseRename(args: RenameFilesType, win: BrowserWindow) {
  const items = args.items || [];
  const total = items.length;
  let processed = 0;
  let lastEmit = 0;
  win.webContents.send('rename-files-progress', { current: 0, total, currentPath: '' });
  const failed: string[] = [];
  for (const it of items) {
    try {
      // it.newPath 是当前名，it.oldPath 是原名；仅当「新名存在且原名不存在」时才还原
      if (it.newPath !== it.oldPath && fs.existsSync(it.newPath) && !fs.existsSync(it.oldPath)) {
        fs.renameSync(it.newPath, it.oldPath);
      }
    } catch (e) {
      failed.push(`${it.newPath} -> ${it.oldPath}: ${(e as Error).message}`);
    }
    processed++;
    const now = Date.now();
    if (now - lastEmit >= 80 || processed === total) {
      lastEmit = now;
      win.webContents.send('rename-files-progress', { current: processed, total, currentPath: it.newPath });
    }
  }
  win.webContents.send('rename-files-progress', { current: total, total, currentPath: '' });
  if (failed.length) {
    win.webContents.send('rename-files-reversed', `撤销完成，但有 ${failed.length} 个失败:\n` + failed.slice(0, 20).join('\n'));
  } else {
    win.webContents.send('rename-files-reversed', null);
  }
}

// 导出数据到json
export function exportDataToJson(data: any, path: string) {
  try {
    // 格式化json数据并导出
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(path, jsonData);
    return "ok";
  } catch (err) {
    return err;
  }
}

export function openFileInAssetsManager(filePath: string) {
  const fullPath = filePath.replace(/\//g, '\\');
  if (process.platform === 'win32') {
    try {
      exec(`explorer.exe /select,"${fullPath}"`);
    } catch {
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf('\\'));
      shell.openPath(dirPath);
    }
  } else if (process.platform === 'darwin') {
    try {
      exec(`open -R "${fullPath}"`);
    } catch {
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
      shell.openPath(dirPath);
    }
  } else {
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    shell.openPath(dirPath);
  }
}

// 打开目录（直接打开文件夹，区别于 openFileInAssetsManager 的“选中文件”）
export function openFolderInExplorer(dirPath: string) {
  const normalized = dirPath.replace(/\//g, '\\');
  shell.openPath(normalized);
}

export function initFile() {
  // 监听获取文件路径
  ipcMain.on("get-file-list", (e, params: string | ObjectType) => {
    console.log(params, "e");
    if (typeof params === 'string') {
      let result = getFilePath({
        openDirectory: true,
      });
      e.returnValue = result;
    } else {
      let result = getFilePath({
        openDirectory: params.openDirectory,
        openFile: params.openFile,
        multiSelections: params.multiSelections,
        type: params.type,
      });
      e.returnValue = result;
    }
  });

  // 监听文件保存（改用 handle + invoke 异步通道，避免大文件分片经同步 IPC 阻塞渲染进程）
  ipcMain.handle("save-file", async (e, fileSaveObj: FileSaveObjType) => {
    const result = await saveFile(fileSaveObj);
    console.log(result, "result");
    return result;
  });

  // 监听文件夹复制
  ipcMain.on("copy-folder", async (e, copyArgs: CopyFolderType) => {
    copyFolder(copyArgs, win);
  });

  // 数据保存
  ipcMain.on("export-data-to-json", (e, { data, path }) => {
    e.returnValue = exportDataToJson(data, path);
  });

  ipcMain.on("open-file-in-assets-manager", (e, { path }) => {
    openFileInAssetsManager(path);
  });

  // 打开目标目录（文件转移成功后点击打开）
  ipcMain.on("open-folder", (e, dirPath: string) => {
    openFolderInExplorer(dirPath);
  });

  // 文件删除（整体 / 后缀类型 / 模糊文件名）
  ipcMain.on("delete-files", async (e, args: DeleteFilesType) => {
    deleteFiles(args, win);
  });

  // 列出文件夹内容（批量重命名预览用），同步返回
  ipcMain.on("list-folder", (e, args: { dir: string; recursive?: boolean; includeDirs?: boolean }) => {
    try {
      e.returnValue = listFolder(args);
    } catch (err) {
      console.error('[dialog] list-folder 失败:', err);
      e.returnValue = [];
    }
  });

  // 批量重命名：前端算好 oldPath/newPath，后端执行 + 进度上报
  ipcMain.on("rename-files", async (e, args: RenameFilesType) => {
    renameFiles(args, win);
  });

  // 撤销重命名：将上一次重命名的结果反向还原
  ipcMain.on("reverse-rename", async (e, args: RenameFilesType) => {
    reverseRename(args, win);
  });

  ipcMain.handle("save-debug-data", (e, { data, fileName }) => {
    try {
      const userDataPath = app.getPath('userData');
      const debugDir = path.join(userDataPath, 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const filePath = path.join(debugDir, `${fileName}_${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`);
      const jsonData = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, jsonData);
      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 资源扫描
  ipcMain.on("start-scan", async (event, { startPath, extensions, options }) => {
    console.log(startPath, "startPath, extensions");
    console.log(extensions, "startPath, extensions");
    searchAllDrives(startPath, extensions, options).then((files) => {
      win.webContents.send("start-scan", files);
    });
  });

  ipcMain.handle('cancel-scan', () => {
    if (scanWorker) {
        scanWorker.terminate();
        scanWorker = null;
        return true;
    }
    return false;
});
}

async function searchAllDrives(startPatha: string, extensions: string[], ops: ObjectType) {
  // 改成promise
  return new Promise(async (resolve, reject) => {
    let startPath = startPatha.replace(/\\/g, '/');
    console.log(startPath, extensions, "startPath, extensions");
    const results = fastGlob.sync([
      ...extensions.map(ext => fastGlob.convertPathToPattern(startPath) + `/**/*.${ext}`),
      // 过滤掉一些特定目录
      '!**/node_modules/**',
      '!**/bower_components/**',
      '!**/.git/**',
      '!**/.svn/**',
      '!**/.hg/**',
      '!**/CVS/**',
      '!**/dist/**',
      // 所有点开头的目录
      '!**/.*',
      // 过滤掉wiindows系统目录
      '!**/Windows/**',


    ], {
      unique: true,
      // absolute: true,
      // 大小写不敏感
      caseSensitiveMatch: !!ops?.caseSensitiveMatch,
      deep: Number(ops?.deep || 0) || Infinity,
      onlyDirectories: !!ops?.onlyDirectories || false,
      onlyFiles: !!ops?.onlyFiles,
      objectMode: true,
      // 目录标记：后缀/
      markDirectories: true,
    })

    resolve(results.flat());
  });
}