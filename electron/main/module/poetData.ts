import { ipcMain } from "electron";
import path from "node:path";
import { readFileList, readJsonFileContent } from "../utils/common.ts";

export function initPoetData() {
  ipcMain.on("poet-data", (e, fullScreen: boolean) => {
    // 获取诗词数据，用于首页展示
    let poetDataPathList = readFileList(
      path.join(process.env.VITE_PUBLIC, "/宋词/"),
      [".json"]
    );
    let randomFile =
      poetDataPathList[Math.floor(Math.random() * poetDataPathList.length)];
    let randomPoetData = readJsonFileContent(randomFile);
    e.returnValue = randomPoetData;
  });
}
