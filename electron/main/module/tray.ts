import { Tray, Menu } from "electron";
import { appLogoPng, appName } from "../variables.ts";
import { win, hideApp, exitApp } from "./mainWindow.ts";

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

export function initTray() {
  setTray();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "隐藏应用",
      click: () => {
        if (win) {
          // 纯隐藏：不再驱动番茄钟状态机，确保锁屏态下也能正常隐藏/切走
          hideApp();
        }
      },
    },
    {
      label: "打开应用",
      click: () => {
        if (win) {
          // 纯显示：恢复窗口（锁屏态下重新打开为普通显示、不顶级置顶，
          // 用户可自由切走；只有番茄钟状态机重新进入 lock 态才会再次顶级置顶）
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
