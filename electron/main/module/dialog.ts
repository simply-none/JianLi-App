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
import { execSync } from "child_process";
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

export function getFilePath({
  openFile,
  openDirectory,
  multiSelections,
}: {
  openFile?: boolean;
  openDirectory?: boolean;
  multiSelections?: boolean;
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
  const result = dialog.showOpenDialogSync({
    title: "Select a file",
    properties: ["openFile", "openDirectory", "multiSelections"],
    filters: [
      { name: "Images", extensions: ["jpg", "png", "gif"] },
      { name: "Movies", extensions: ["mkv", "avi", "mp4"] },
      { name: "Custom File Type", extensions: ["as"] },
      { name: "All Files", extensions: ["*"] },
    ],
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
    // 是否递归复制
    recursive = true,
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
    fs.cp(
      source,
      target,
      {
        recursive,
        force,
        preserveTimestamps,
        filter: (src, dest) => {
          // src是源文件的路径，dest是目标文件的路径

          const endPaths = src.split(source);
          // 获取源路径下的子路径
          const srcPathArr = endPaths[endPaths.length - 1].split("\\");
          if (srcPathArr.length == 1 && srcPathArr[0] == "") return true;
          // 获取源路径下的子路径的最后一个元素（目录、文件名）
          const srcName = srcPathArr[srcPathArr.length - 1];
          // 分割文件的点，获取文件名称、文件后缀
          const srcNameArr = srcName.split(".");
          console.log(src, source, srcNameArr.length, "pathArr");

          // 分割文件，获取文件名称
          // 比如：test.txt => test, .txt
          // 比如：test.txt.png => test, .txt.png
          // 比如：test.txt.png.png => test, .txt.png.png

          // 获取文件名称
          const srcNameWithoutSuffix = srcNameArr.slice(0, 1).join(".");
          // 获取文件后缀
          const srcNameSuffix = srcNameArr.slice(1).join(".");
          console.log(srcNameWithoutSuffix, srcNameSuffix, "src");

          // 获取匹配的文件及其后缀，同时不能在忽略后缀中
          const isInclude =
            include && include.some((item) => srcPathArr.includes(item));
          if (
            isInclude &&
            ignoreSuffix &&
            !ignoreSuffix.includes(srcNameSuffix)
          ) {
            console.log("true");
            return true;
          }
          // 获取匹配的文件后缀
          if (includeSuffix && includeSuffix.includes(srcNameSuffix)) {
            console.log("true2");
            return true;
          }
          // 过滤掉匹配的文件
          if (ignore && ignore.includes(srcName)) {
            return false;
          }
          // 过滤掉匹配的文件后缀
          console.log(
            srcNameSuffix,
            ignoreSuffix.includes(srcNameSuffix),
            "srcNameSuffix"
          );
          if (ignoreSuffix && ignoreSuffix.includes(srcNameSuffix)) {
            console.log("false");
            return false;
          }

          // 如果存在include或includeSuffix，且都不匹配，则返回false
          if (
            (include && include.length) ||
            (includeSuffix && includeSuffix.length)
          ) {
            console.log("false2");
            return false;
          }
          console.log("true3");
          return true;
        },
      },
      (res) => {
        win.webContents.send("copy-folder", res);
        console.log(res, "res");
      }
    );
  } catch (err) {
    win.webContents.send("copy-folder", err);
    console.log(err, "res");
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

// 打开资源管理器文件
export function openFileInAssetsManager(path: string) {
  shell.openPath(path);
}

export function initFile() {
  // 监听获取文件路径
  ipcMain.on("get-file-list", (e, value: string) => {
    console.log(value, "e");
    let result = getFilePath({
      openDirectory: true,
    });
    e.returnValue = result;
  });

  // 监听文件保存
  ipcMain.on("save-file", async (e, fileSaveObj: FileSaveObjType) => {
    let result = await saveFile(fileSaveObj);
    console.log(result, "result");
    e.returnValue = result;
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