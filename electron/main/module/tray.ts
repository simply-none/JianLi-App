import { Tray, Menu } from "electron";
import { appLogoPng, appName } from "../variables.ts";

let tray = null;

function setTray() {
  tray = new Tray(appLogoPng);
  tray.setToolTip(appName);
  tray.setTitle(appName);
}

export function destroyTray() {
  if (tray) {
    tray.destroy();
  }
}

export function initTray({ win, hideApp, exitApp }) {
  setTray();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "隐藏应用",
      click: () => {
        if (win) {
          hideApp();
        }
      },
    },
    {
      label: "打开应用",
      click: () => {
        if (win) {
          win.show();
        }
      },
    },
    {
      label: "退出应用",
      click: () => {
        exitApp();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    // 这里仅仅打开应用界面，不调用 focusAppToTop()，不然屏幕无法点击
    win.show();
  });
}
