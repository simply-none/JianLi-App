import { createTable, queryByConditions, upsertData } from "../utils/sql.ts";
import { win, hideApp, focusAppToTop } from "./mainWindow.ts";
import moment from "moment";
import { db } from "./sql.ts";
import { clipboard, ipcMain, globalShortcut } from "electron";
import colors from "colors";

export const tableName = "register_shortcut";

// 打开匹配页面
function openMatchPage(url: string) {
  // 显示window
  win.show();
  // 聚焦到窗口
  win.webContents.send("open-match-page", url);
}

export function initRegisterShortcut() {
  createTable({
    db,
    tableName: tableName,
    config: {
      primaryKey: "key",
    },
    callback: async (err, res) => {
      if (!err) {
        await queryByConditions({
          db,
          tableName,
          conditions: {},
          callback: (err, res) => {
            if (err) {
              console.error(err);
              return;
            }
            // 判断是否是数组
            if (Array.isArray(res)) {
              res.forEach((item) => {
                globalShortcutFn(item);
              });
            }
          },
        });
      }
    },
  });

  ipcMain.on("register-shortcut", (event, shortcutOps) => {
    console.log(shortcutOps);
    globalShortcutFn(shortcutOps);
  });
}

function globalShortcutFn(item) {
  globalShortcut.register(item.shortcut, () => {
    // 判断快捷键类型：
    // 如果是打开匹配页面
    if (item.type === "open_match_page") {
      openMatchPage(item.url);
    }
    console.log("Electron loves global shortcuts!");
  });
}
