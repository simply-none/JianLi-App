import { BrowserWindow, ipcMain, app, globalShortcut } from "electron";
import {
  appLogoIco,
  preload,
  VITE_DEV_SERVER_URL,
  indexHtml,
  appName,
} from "../variables.ts";
import { destroyTray } from "./tray.ts";
import { setAutoStartup, checkAutoStartupStatus } from "./autoStartup.ts";
import { getStatefulCurrentState, restartStatefulRound } from "./newReminder.ts";

export let win: BrowserWindow | null;

// 强制锁屏态聚焦：顶级置顶（screen-saver 级 + 全屏）。
// 用于多状态提醒中 lockScreen=true 的状态进入时——默认操作（Alt+Tab /
// 点击其他窗口 / 最小化）无法切换到其他应用，实现「专注锁屏」。
// 唯一出口：show_app 全局快捷键 / 系统托盘「隐藏应用」调用 hideApp()
// （取消置顶 + 隐藏），从而在锁屏态也能释放钉死、切走。
export function focusAppToTop() {
  // 必须先 show + focus，让窗口进入可见生命周期，再设置置顶/全屏；
  // 否则若窗口此前被 hideApp() 完全隐藏，先 setAlwaysOnTop/setFullScreen 再 show
  // 会导致置顶/全屏属性在显示前被丢弃（表现为「状态切到锁屏态却没置顶」）。
  win?.show();
  win?.focus();
  // defer 设置置顶与全屏：确保窗口完成显示后再生效（electron 已知行为坑——
  // 刚 show 的同一 tick 内设置 screen-saver 级置顶/全屏常被忽略）。
  if (win) {
    setTimeout(() => {
      win?.setAlwaysOnTop(true, "screen-saver");
      win?.setFullScreen(true);
      win?.focus();
    }, 0);
  }
}

export async function isSetStartup(isStartup: boolean, hidden = false) {
  const result = await setAutoStartup(isStartup)
  console.log(`[isSetStartup] 设置结果: ${result.success} - ${result.message}`)
  return result
}

export function hideApp() {
  // 番茄钟联动：当前状态 lockScreen=1 时按 key 特殊处理（快捷键/托盘/IPC 全汇聚于此）
  const st = getStatefulCurrentState("pomodoro");
  if (st) {
    // 强制锁屏态：禁止通过快捷键/托盘隐藏应用，保持锁屏无法切走
    if (st.key === "lock" && st.lockScreen === 1) {
      return;
    }
    // 休息态(lockScreen=1)：隐藏应用的同时重新开始新的一轮轮次
    if (st.key === "rest" && st.lockScreen === 1) {
      win?.setAlwaysOnTop(false);
      win?.hide();
      restartStatefulRound("pomodoro");
      return;
    }
  }
  win?.setAlwaysOnTop(false);
  win?.hide();
}

// 主窗口当前是否对用户可见（未隐藏且未最小化）。
// 用于番茄钟「工作态隐藏主窗口」副作用的护栏：仅当窗口本就不可见时才隐藏，
// 避免用户在列表页/设置页操作时被状态切换突然藏掉整个界面。
export function isMainWindowVisible(): boolean {
  if (!win) return false;
  return win.isVisible() && !win.isMinimized();
}

/** 确保主窗口可见并置前（用于提醒触发后需要用户记录等场景）。
 *  与 focusAppToTop 不同，本函数不强制全屏，仅还原最小化/取消隐藏并聚焦。 */
export function showApp() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

export function exitApp() {
  globalShortcut.unregisterAll();
  destroyTray();
  app.removeAllListeners();
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length > 0) {
    for (let window of allWindows) {
      if (window && !window.isDestroyed()) {
        win.removeAllListeners();
        window.destroy();
        window = null;
      }
    }
  }
  app.exit();
}

function createWindow() {
  win = new BrowserWindow({
    title: appName,
    icon: appLogoIco,
    transparent: true,
    resizable: false,
    frame: false,
    fullscreenable: true,

    webPreferences: {
      preload,
      devTools: true,
      nodeIntegration: true,
      // 加载扩展必须启动该配置
      plugins: true,
      // 启用 webview 标签
      webviewTag: true,
      webSecurity: false,
    },
  });
}

function loadMainWindow() {
  createWindow();
  if (VITE_DEV_SERVER_URL) {
    // #298
    win.loadURL(VITE_DEV_SERVER_URL);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml);
    // 不在任务栏显示
    win.setSkipTaskbar(true);
  }
}

export function initMainWindow() {
  loadMainWindow();
  ipcMain.on("quit-app", (e, fullScreen: string) => {
    exitApp();
  });
  ipcMain.on("max", (e, fullScreen: boolean) => {
    win!.setFullScreen(fullScreen);
    e.returnValue = fullScreen;
  });
  ipcMain.on("set-startup", (e, isStartup: boolean) => {
    //注意：非开发环境
    if (!VITE_DEV_SERVER_URL) {
      if (process.platform === "darwin") {
        isSetStartup(isStartup);
      } else {
        isSetStartup(isStartup);
      }
    } else {
      // isSetStartup(isStartup);
    }
  });
  ipcMain.on("hide-app", (e) => {
    hideApp();
  });

  // //监听webview新建的窗口
  app.on('web-contents-created', (event, contents) => {
    if (contents.getType() === 'webview') {
      contents.setWindowOpenHandler(({ url }) => {
        contents.loadURL(url);
        return { action: "deny" };
      });
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    // if (webContents && webContents.id !== win.webContents.id) {
    //   return { action: "allow" };
    // }
    // if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
    // 主窗口必须保持全屏（应用基础布局要求），所以加载完成仍要 setFullScreen(true) + show + focus。
    // 注意：这里【不可】调用 focusAppToTop()——后者会额外 setAlwaysOnTop(true, "screen-saver")，
    // 即 screen-saver 级「顶级置顶锁屏」，会让 app 一启动就被钉死、切不走，且覆盖番茄钟
    // lockScreen 语义。强制锁屏置顶严格只由番茄钟 state.lockScreen === true 的状态进入路径
    // 触发（见 job.ts applyStateWindowBehavior）。此处仅全屏显示，不强制顶级置顶。
    win?.setFullScreen(true);
    win?.show();
    win?.focus();
  });
  win.on("close", (e) => {
    e.preventDefault(); //先阻止一下默认行为，不然直接关了，提示框只会闪一下
    win.webContents.send("before-close");
  });
}
