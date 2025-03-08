import { BrowserWindow, ipcMain } from "electron";
import axios from "axios";
import colors from "colors";
import { win } from "./mainWindow.ts";

export function initApiTest() {
  ipcMain.on("api-test", (e, obj: any) => {
    console.log(obj);
    // 接口测试，发送接口请求
    axios({
      url: obj.url,
      method: obj.method,
      data: obj.data,
      headers: obj.headers,
      params: obj.params,
    }).then(res => {
      console.log(colors.bgBlue(JSON.stringify(res.data, null, 2)));
      win.webContents.send("api-test", res.data);
    }).catch(err => {
      console.log(err);
      win.webContents.send("api-test", err);
    })
  });
}
