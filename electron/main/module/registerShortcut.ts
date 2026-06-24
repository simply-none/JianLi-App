import { createTable, queryByConditions, upsertData } from "../utils/sql.ts";
import { win, hideApp, focusAppToTop } from "./mainWindow.ts";
import moment from "moment";
import { myDb } from "./sql.ts";
import { clipboard, ipcMain, globalShortcut } from "electron";
import colors from "colors";
import { getPomodoroStatus, setPomodoroToWork } from "./store.ts";

export const tableName = "register_shortcut";

function openMatchPage(url: string) {
  win.show();
  win.webContents.send("open-match-page", url);
}

async function showApp() {
  if (win.isVisible()) {
    const status = await getPomodoroStatus();
    if (status.isResting) {
      await setPomodoroToWork(true);
      win.webContents.send("pomodoro-force-switch", {
        from: "rest",
        to: "work",
        time: Date.now(),
      });
    }
    hideApp();
  } else {
    win.show();
  }
} 

export function initRegisterShortcut() {
  createTable({
    db: myDb.db,
    tableName: tableName,
    config: {
      primaryKey: "key",
    },
    callback: async (err, res) => {
      if (!err) {
        await queryByConditions({
          db: myDb.db,
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
    else if (item.type == 'show_app') {
      showApp();
    }
    console.log("Electron loves global shortcuts!");
  });
}
