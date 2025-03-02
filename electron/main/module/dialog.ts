import { BrowserWindow, dialog } from "electron";
import fs from "fs";
import axios from "axios";
import moment from "moment";

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

function merge() {
  // 排序
  fileSliceList.sort((a, b) => {
    return a - b;
  });
  let fileName = fileSliceList[0].split(".temp.")[0];
  // 判断是否存在文件
  if (fs.existsSync(fileName)) {
    // 存在则重新命名
    fileName = fileName + "_copy_" + moment().format("YYYY-MM-DD_HH-mm-ss");
  }
  for (let i = 0; i < fileSliceList.length; i++) {
    const arr = fs.readFileSync(fileSliceList[i]);

    fs.writeFileSync(fileName, arr, { flag: "a+" });
  }
}
// 使用nodejs的fs同步模块保存文件 函数，保存成功返回ok，否则返回失败信息
export async function saveFile({
  filePath,
  content,
  chunkLength,
}: {
  filePath: string;
  content: any;
  chunkLength: number;
}) {
  try {
    const buffer = Buffer.from(content);
    // 获取res的类型 使用toString.call
    const type = Object.prototype.toString.call(buffer);
    console.log(type, "type");
    fs.writeFileSync(filePath, buffer);
    fileSliceList.push(filePath);
    if (fileSliceList.length == chunkLength) {
      // 合片
      await merge();
      // 删除缓存文件
      for (let i = 0; i < fileSliceList.length; i++) {
        fs.unlinkSync(fileSliceList[i]);
      }
      fileSliceList.length = 0;
    }
    return "ok";
  } catch (err) {
    console.log(err, "err");
    return err;
  }
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
