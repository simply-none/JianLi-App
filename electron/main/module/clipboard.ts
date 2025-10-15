import { createTable, queryByConditions, upsertData } from "../utils/sql.ts";
import { win, hideApp, focusAppToTop } from "./mainWindow.ts";
import moment from 'moment';
import { myDb } from "./sql.ts";
import { clipboard, ipcMain } from "electron";
import colors from "colors";

export const tableName = "clipboard_history";

export function initClipboard() {
  createTable({
    db: myDb.db,
    tableName: tableName,
    callback: (err, res) => {
      if (!err) {
        // 监听剪贴板变化
        setInterval(async () => {
          const text = clipboard.readText();
          const html = clipboard.readHTML();
          const image = clipboard.readImage();
          const rtf = clipboard.readRTF();
          const bookmark = clipboard.readBookmark();
          const findText = clipboard.readFindText();

          let lastClipboardData: ObjectType = {};

          await queryByConditions({
            db: myDb.db,
            tableName,
            conditions: {
              orderBy: "create_time",
              orderByDesc: true,
              limit: 1,
            },
            callback: (err, res) => {
              if (err) {
                console.error(err);
                return;
              }
              lastClipboardData = res[0] || {};

              // 判断是否是新数据
              if (text === lastClipboardData.text || !text.trim()) {
                return;
              }

              upsertData({
                db: myDb.db,
                tableName,
                data: {
                  text,
                  html,
                  image: JSON.stringify(image),
                  rtf,
                  bookmark: JSON.stringify(bookmark),
                  findText,
                  create_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                },
                config: {},
                callback: (err, res) => {
                  if (err) {
                    console.error(err);
                    return;
                  }
                },
              });
            },
          });
        }, 1000);
      }
    },
    config: {},
  });
}
