import { createTable, queryByConditions, upsertData } from "../utils/sql.ts";
import { win, hideApp, focusAppToTop } from "./mainWindow.ts";
import moment from "moment";
import { myDb } from "./sql.ts";
import { clipboard, ipcMain, globalShortcut, BrowserWindow } from "electron";
import colors from "colors";
import { getPomodoroStatus, setPomodoroToWork } from "./store.ts";
import { createOtherWindow, hideOtherWindow } from "./newWindow.ts";

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
    // 发送给渲染进程确认，是否隐藏窗口
    // win.webContents.send("confirm-hide-app", true);
    hideApp();
  } else {
    win.show();
  }
} 

function toggleQuickNoteWindow() {
  const quickNoteWin = getQuickNoteWindow();
  if (quickNoteWin && quickNoteWin.isVisible()) {
    hideOtherWindow("quickNote");
  } else {
    queryByConditions({
      db: myDb.db,
      tableName: "basic_info",
      conditions: {
        whereStr: "key = 'window-mode:quickNote'",
      },
      callback: (err, data) => {
        if (err) {
          console.log(err, "err");
          createOtherWindow("quickNote", { mouseEvents: true });
          return;
        }
        let config = {};
        if (data && data.length > 0) {
          try {
            config = JSON.parse(data[0].value);
          } catch (e) {
            console.log(e, "parse error");
          }
        }
        createOtherWindow("quickNote", { ...config, mouseEvents: true });
      },
    });
  }
}

function getQuickNoteWindow() {
  const allWindows = BrowserWindow.getAllWindows();
  return allWindows.find((w) => {
    const url = w.webContents.getURL();
    return url.includes("quickNote") && url.includes("isSecondWindow=true");
  });
}

function toggleTodoWindow() {
  const todoWin = getTodoWindow();
  if (todoWin && todoWin.isVisible()) {
    hideOtherWindow("todoMiniWindow");
  } else {
    queryByConditions({
      db: myDb.db,
      tableName: "basic_info",
      conditions: {
        whereStr: "key = 'window-mode:todoMiniWindow'",
      },
      callback: (err, data) => {
        if (err) {
          console.log(err, "err");
          createOtherWindow("todoMiniWindow", { mouseEvents: true });
          return;
        }
        let config = {};
        if (data && data.length > 0) {
          try {
            config = JSON.parse(data[0].value);
          } catch (e) {
            console.log(e, "parse error");
          }
        }
        createOtherWindow("todoMiniWindow", { ...config, mouseEvents: true });
      },
    });
  }
}

function getTodoWindow() {
  const allWindows = BrowserWindow.getAllWindows();
  return allWindows.find((w) => {
    const url = w.webContents.getURL();
    return url.includes("todoMiniWindow") && url.includes("isSecondWindow=true");
  });
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
    if (item.type === "open_match_page") {
      openMatchPage(item.url);
    }
    else if (item.type == 'show_app') {
      showApp();
    }
    else if (item.type == 'open_quick_note') {
      toggleQuickNoteWindow();
    }
    else if (item.type == 'open_todo_window') {
      toggleTodoWindow();
    }
    console.log("Electron loves global shortcuts!");
  });
}
