import {
  desktopCapturer,
  screen,
  clipboard,
  ipcMain,
  dialog,
  nativeImage,
  app,
  globalShortcut,
  BrowserWindow,
} from "electron";
import type { DesktopCapturerSource } from "electron";
import path from "node:path";
import fs from "node:fs";
import moment from "moment";
import { win } from "./mainWindow.ts";
import { store } from "./store.ts";
import {
  VITE_DEV_SERVER_URL,
  indexHtml,
  preload,
} from "../variables.ts";

/**
 * 截图模块（路由页直接唤起 + 选框层内置标注，Snipaste 风格）
 * --------------------------------------------------------------------------
 * 设计目标：可截到应用本身，且箭头/文字/马赛克直接在「选区内部」完成；
 *           去掉中间小浮窗，路由页按钮 / 全局快捷键直接唤起选框层。
 *   1. 路由页点「截图」或按用户在截图页自行配置的全局快捷键（统一入口，区域模式）
 *   2. 主进程先临时最小化主窗 → 等 DWM 合成 → 按光标所在显示器捕获整屏
 *      （此时桌面上无本应用任何可见窗口，WGC 不会合成出黑屏/应用自身）→ 暂存
 *   3. 恢复主窗，打开全屏选框层（隐藏），把已暂存的整屏冻结为半透明背景
 *   4. 选区阶段（Snipaste 风格）：
 *      —— 拖拽鼠标 → 框选区域
 *      —— 单击空白处（按下与弹起距离很近）→ 截取整屏
 *   5. 确认选区（Enter/双击/完成选区/单击全屏）后，主进程从整屏裁剪出选区，回传选框层
 *   6. 选框层进入「标注阶段」：选区内部冻结成截图，叠加标注画布与工具栏
 *      —— 直接在选区里画 箭头/文字/马赛克（含撤回）；可「重选」回到选区阶段
 *   7. 确认（Enter/复制/保存）后合成最终 PNG → 主进程复制/保存 → 回传路由页 → 关闭选框层
 *
 * 渲染进程（路由页 /screenshot）通过 window.ipcRenderer 调用：
 *   handlePromise("screenshot:start", {})                   —— 打开选框层（统一入口，区域模式）
 *   handlePromise("screenshot:save", { dataUrl })           —— 保存结果到文件
 *   handlePromise("screenshot:copy", { dataUrl })           —— 复制结果到剪贴板
 *   handlePromise("screenshot:get-displays", {})            —— 显示器信息
 *   on("screenshot:result", ({ dataUrl, width, height }))   —— 主进程回传截图结果
 * 选框层（路由 /#/screenshotSelect）通信：
 *   send("screenshot:select-ready")                          —— 层就绪（主进程据此捕获整屏）
 *   send("screenshot:select-rect", { rect })                 —— 选区（CSS 像素，相对选框层窗口）
 *   send("screenshot:select-cancel")                         —— 取消（关闭选框层）
 *   send("screenshot:capture-region", { dataUrl, action })   —— action: copy | save（含标注的最终图）
 *   on("screenshot:captured", { dataUrl, width, height, mode, rect, kind }) —— 主进程回传
 *       kind="full"：整屏冻结图（进入选区阶段）  kind="crop"：裁剪后的选区图（进入标注阶段）
 *   on("screenshot:select-error", { message })               —— 捕获失败（如未授权）
 */

/** 全局快捷键：默认不设置，由用户在截图页自行配置（初装无默认值） */

export interface DisplayInfo {
  id: number;
  label: string;
  isPrimary: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  workAreaSize: { width: number; height: number };
  scaleFactor: number;
}

/** 选框层窗口，以及选框阶段暂存的整屏图像 */
let selectWin: BrowserWindow | null = null;
let selectImage: ReturnType<typeof nativeImage.createEmpty> | null = null;
let selectScale = 1; // 整屏图像像素 / 屏幕 CSS 像素 (≈ 显示器 scaleFactor)
let selectMode: "region" | "full" | null = null;
// 捕获整屏时所用的显示器（用于 full 模式预选整屏的 rect），在创建选框层之前确定
let selectCaptureDisplay: ReturnType<typeof getTargetDisplay> | null = null;
let currentAccel: string | null = null; // 当前已注册的全局快捷键（null = 未设置）

/** 把 CSS 像素选区换算为图片像素裁剪矩形 */
function toCropRect(rect: { x: number; y: number; w: number; h: number }, scale: number) {
  const x = Math.min(rect.x, rect.x + rect.w);
  const y = Math.min(rect.y, rect.y + rect.h);
  const w = Math.abs(rect.w);
  const h = Math.abs(rect.h);
  return {
    x: Math.max(0, Math.round(x * scale)),
    y: Math.max(0, Math.round(y * scale)),
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/** 取光标所在显示器（多屏时截对应的那一块），回退到主屏 */
function getTargetDisplay() {
  const point = screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(point);
}

/** 把全屏画面里「某显示器」对应的源匹配出来 */
function pickScreenSource(
  sources: DesktopCapturerSource[],
  displayId: number
): DesktopCapturerSource | undefined {
  return (
    sources.find((s) => String(s.id).endsWith(`:${displayId}`)) ||
    sources.find((s) => s.id.startsWith("screen")) ||
    sources[0]
  );
}

/** 抽样判断截图是否整体接近黑色（排查透明窗口被桌面复制合成成黑屏的情况） */
function isLikelyBlack(image: ReturnType<typeof nativeImage.createEmpty>): boolean {
  try {
    const bmp = image.getBitmap();
    if (!bmp || bmp.length < 4) return false;
    const w = image.getSize().width;
    const h = image.getSize().height;
    const stride = 4;
    const pts = [
      [Math.floor(w / 2), Math.floor(h / 2)],
      [Math.floor(w * 0.25), Math.floor(h * 0.25)],
      [Math.floor(w * 0.75), Math.floor(h * 0.75)],
      [Math.floor(w * 0.25), Math.floor(h * 0.75)],
      [Math.floor(w * 0.75), Math.floor(h * 0.25)],
    ];
    for (const [px, py] of pts) {
      const i = (py * w + px) * stride;
      if (bmp[i] + bmp[i + 1] + bmp[i + 2] > 24) return false; // 任一采样点非黑即正常
    }
    return true;
  } catch {
    return false;
  }
}

/** 捕获指定显示器的整屏图像（nativeImage） */
async function captureFullDisplay(display = getTargetDisplay()): Promise<ReturnType<typeof nativeImage.createEmpty>> {
  const scale = display.scaleFactor || 1;
  const thumbSize = {
    width: Math.round(display.size.width * scale),
    height: Math.round(display.size.height * scale),
  };
  const tryOnce = async () => {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: thumbSize,
    });
    const source = pickScreenSource(sources, display.id);
    if (!source || source.thumbnail.isEmpty()) {
      throw new Error("未能捕获屏幕，请确认已授予「屏幕录制」权限");
    }
    return source.thumbnail;
  };
  let img = await tryOnce();
  // 若截到的是全黑（透明窗口被合成成黑屏），等一帧后再捕一次（此时选框层应已隐藏）
  if (isLikelyBlack(img)) {
    await new Promise((r) => setTimeout(r, 60));
    img = await tryOnce();
  }
  return img;
}

/** 关闭选框层并清理暂存 */
function closeSelect() {
  try {
    if (selectWin && !selectWin.isDestroyed()) selectWin.destroy();
  } catch {
    /* noop */
  }
  selectWin = null;
  selectImage = null;
  selectMode = null;
  selectCaptureDisplay = null;
}

/** 以路由形式加载子窗口（Vue 组件），与 windowMode 内部待办小窗一致：
 *  开发模式走 VITE_DEV_SERVER_URL + "#route"，生产模式走 index.html 的 hash 路由 */
function loadRoute(win: BrowserWindow, route: string) {
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(`${VITE_DEV_SERVER_URL}#${route}`);
  } else {
    win.loadFile(indexHtml, { hash: route });
  }
}

/** 打开全屏透明选框层（应用可见，不隐藏主窗）。mode 决定区域/全屏模式 */
function openSelectLayer(mode: "region" | "full") {
  selectMode = mode;
  const display = getTargetDisplay();
  selectWin = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.size.width,
    height: display.size.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false, // 先隐藏：等 screenshot:select-ready 发来冻结图后再显示，体验更流畅
    backgroundColor: "#00000000", // 显式透明背景
    webPreferences: {
      preload,
      devTools: true,
      webSecurity: false,
    },
  });
  selectWin.setAlwaysOnTop(true, "screen-saver");
  selectWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // 以路由形式加载（Vue 组件）：#/screenshotSelect
  loadRoute(selectWin, "screenshotSelect");

  selectWin.on("closed", () => {
    if (selectWin && selectWin.isDestroyed()) {
      selectWin = null;
      selectMode = null;
    }
  });
}

/** 统一唤起选框层（带重复打开守卫） */
async function launchSelect(mode: "region" | "full") {
  if (selectWin && !selectWin.isDestroyed()) {
    selectWin.focus();
    return;
  }
  // 捕获整屏前不再显隐主窗口（v18 需求）：
  // - 应用本身未显示（最小化/隐藏）→ 无需「先显示再隐藏」，直接截；
  // - 应用本身已显示 → 也无需隐藏，直接截（截图包含桌面当前内容，符合常规截图工具行为）。
  // 注：早期 v9.3 为规避 Windows WGC 把本进程前景窗口合成成黑屏，曾在捕获前最小化主窗；
  // 现改为直接捕获。若个别机器上「从应用内触发截图」出现纯黑，再针对性处理（如仅对前景窗口降级）。
  try {
    selectCaptureDisplay = getTargetDisplay();
    selectImage = await captureFullDisplay(selectCaptureDisplay);
    selectScale = selectCaptureDisplay.scaleFactor || 1;
  } catch (e) {
    selectImage = null;
    selectCaptureDisplay = null;
  }
  openSelectLayer(mode);
}

/** 把整屏图 / 裁剪图回传选框层（进入对应阶段） */
function sendCapturedToSelect(
  image: ReturnType<typeof nativeImage.createEmpty>,
  mode: "region" | "full",
  rect: { x: number; y: number; w: number; h: number },
  kind: "full" | "crop"
) {
  const dataUrl = image.toDataURL();
  const size = image.getSize();
  selectWin?.webContents.send("screenshot:captured", {
    dataUrl,
    width: size.width,
    height: size.height,
    mode,
    rect,
    kind,
  });
}

/**
 * 接收选框层合成好的最终图（含标注），按 action 复制/保存并回传路由页
 * @param dataUrl 选框层用 canvas 合成的最终 PNG（已裁剪到选区并叠加箭头/文字/马赛克）
 */
async function finalizeCapture(dataUrl: string, action: "copy" | "save") {
  try {
    const image = nativeImage.createFromDataURL(dataUrl);
    const size = image.getSize();

    if (action === "save") {
      const defaultName = `screenshot-${moment().format("YYYYMMDD-HHmmss")}.png`;
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: "保存截图",
        defaultPath: path.join(app.getPath("pictures"), defaultName),
        filters: [{ name: "PNG 图片", extensions: ["png"] }],
      });
      if (!canceled && filePath) {
        fs.writeFileSync(filePath, image.toPNG());
      }
    } else {
      // 默认：复制到剪贴板
      clipboard.writeImage(image);
    }

    // 回传结果给主窗口的截图页预览
    win?.webContents.send("screenshot:result", {
      dataUrl,
      width: size.width,
      height: size.height,
      action,
    });
  } catch (e: any) {
    win?.webContents.send("screenshot:result", {
      dataUrl: "",
      width: 0,
      height: 0,
      error: e?.message || String(e),
    });
  } finally {
    // 无论成败都关闭选框层
    closeSelect();
  }
}

/**
 * 全局快捷键（用户可在截图页自行配置；初装不设置默认值）
 * —— 仅当用户保存过某个组合时才注册，未配置则完全不占用任何快捷键
 */
const SHORTCUT_STORE_KEY = "screenshotShortcut";

/** 持久化快捷键到共享配置（null = 清除） */
function persistShortcut(accel: string | null) {
  try {
    if (accel) store.set(SHORTCUT_STORE_KEY, accel);
    else store.delete(SHORTCUT_STORE_KEY);
  } catch {
    /* noop */
  }
}

/** 读取已保存的快捷键组合（无配置返回 null） */
function readPersistedShortcut(): string | null {
  try {
    const v = store.get(SHORTCUT_STORE_KEY);
    return typeof v === "string" && v ? v : null;
  } catch {
    return null;
  }
}

/**
 * 应用快捷键：先尝试注册新组合（注册成功再卸载旧组合，避免替换失败时空窗）。
 * @returns ok 是否成功，失败给出原因（如被占用 / 组合无效）
 */
function applyShortcut(accel: string | null): { ok: boolean; error?: string } {
  if (!accel) {
    if (currentAccel) {
      try {
        globalShortcut.unregister(currentAccel);
      } catch {
        /* noop */
      }
    }
    currentAccel = null;
    return { ok: true };
  }
  try {
    const ok = globalShortcut.register(accel, () => {
      // 直接唤起选框层（区域模式）；路由页不是必须打开也能用
      launchSelect("region");
    });
    if (!ok) {
      return { ok: false, error: "快捷键已被系统或其他程序占用，或组合无效" };
    }
    // 注册成功，再卸载旧组合
    if (currentAccel && currentAccel !== accel) {
      try {
        globalShortcut.unregister(currentAccel);
      } catch {
        /* noop */
      }
    }
    currentAccel = accel;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/** 应用启动时根据已保存的配置注册快捷键（无配置则不注册任何快捷键） */
function initShortcutFromConfig() {
  const accel = readPersistedShortcut();
  if (accel) applyShortcut(accel);
  // 退出时释放，避免快捷键被占用无法释放
  app.on("will-quit", () => {
    try {
      globalShortcut.unregisterAll();
    } catch {
      /* noop */
    }
    currentAccel = null;
  });
}

export function initScreenshot() {
  // 统一入口：打开选框层（区域模式）。框选 / 单击全屏在选框层内判定（Snipaste 风格）
  ipcMain.handle("screenshot:start", async () => {
    launchSelect("region");
    return { success: true, shortcut: currentAccel };
  });

  // 选框层就绪信号：复用「唤起时已捕获并暂存」的整屏图（主窗已最小化后截取，内容纯净）；
  // 若暂存为空（兜底）则实时再捕一次。
  ipcMain.on("screenshot:select-ready", () => {
    if (!selectWin) return;
    const sendFrozen = (img: ReturnType<typeof nativeImage.createEmpty>) => {
      const disp = selectCaptureDisplay || getTargetDisplay();
      const rect =
        selectMode === "full"
          ? { x: 0, y: 0, w: disp.size.width, h: disp.size.height }
          : { x: 0, y: 0, w: 0, h: 0 };
      sendCapturedToSelect(img, selectMode || "region", rect, "full");
      // 图已就绪再显示选框层（窗口仍隐藏，绝不会进入截图）
      if (!selectWin!.isDestroyed() && !selectWin!.isVisible()) {
        selectWin!.show();
        selectWin!.focus();
      }
    };
    if (selectImage) {
      sendFrozen(selectImage);
      return;
    }
    // 兜底：暂存为空时实时捕获（理论上不会走到这里）
    (async () => {
      try {
        const display = getTargetDisplay();
        const img = await captureFullDisplay(display);
        selectScale = display.scaleFactor || 1;
        selectImage = img; // 暂存，供后续裁剪
        sendFrozen(img);
      } catch (e: any) {
        selectImage = null;
        selectWin?.webContents?.send("screenshot:select-error", e?.message || String(e));
      }
    })();
  });

  // 选框层回传选区：从暂存整屏裁剪，回传选框层进入标注阶段
  ipcMain.on(
    "screenshot:select-rect",
    (_e, payload: { rect: { x: number; y: number; w: number; h: number } }) => {
      (async () => {
        try {
          if (!selectImage) {
            // 暂存失败则实时再捕一次
            selectImage = await captureFullDisplay();
            selectScale = getTargetDisplay().scaleFactor || 1;
          }
          const crop = toCropRect(payload.rect, selectScale);
          const cropped = selectImage.crop(crop);
          selectImage = null;
          sendCapturedToSelect(cropped, "region", payload.rect, "crop");
        } catch (e: any) {
          selectImage = null;
          selectWin?.webContents?.send("screenshot:select-error", e?.message || String(e));
        }
      })();
    }
  );

  // 选框层取消：关闭选框层（无中间浮窗需恢复）
  ipcMain.on("screenshot:select-cancel", () => {
    closeSelect();
  });

  // 选框层合成图（含标注）复制/保存，并回传路由页
  ipcMain.on(
    "screenshot:capture-region",
    (_e, payload: { dataUrl: string; action?: "copy" | "save" }) => {
      finalizeCapture(payload.dataUrl, payload.action === "save" ? "save" : "copy");
    }
  );

  // 保存到本地文件（路由页手动保存结果）
  ipcMain.handle(
    "screenshot:save",
    async (_e, payload: { dataUrl: string; defaultName?: string }) => {
      try {
        const image = nativeImage.createFromDataURL(payload.dataUrl);
        const defaultName =
          payload.defaultName ||
          `screenshot-${moment().format("YYYYMMDD-HHmmss")}.png`;
        const { canceled, filePath } = await dialog.showSaveDialog({
          title: "保存截图",
          defaultPath: path.join(app.getPath("pictures"), defaultName),
          filters: [{ name: "PNG 图片", extensions: ["png"] }],
        });
        if (canceled || !filePath) {
          return { success: false, canceled: true };
        }
        fs.writeFileSync(filePath, image.toPNG());
        return { success: true, filePath };
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) };
      }
    }
  );

  // 复制到系统剪贴板（路由页手动复制结果）
  ipcMain.handle("screenshot:copy", async (_e, payload: { dataUrl: string }) => {
    try {
      const image = nativeImage.createFromDataURL(payload.dataUrl);
      clipboard.writeImage(image);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  });

  // 获取多显示器信息
  ipcMain.handle("screenshot:get-displays", async () => {
    try {
      const displays = screen.getAllDisplays().map<DisplayInfo>((d) => ({
        id: d.id,
        label: d.label || `显示器 ${d.id}`,
        isPrimary: screen.getPrimaryDisplay().id === d.id,
        bounds: {
          x: d.bounds.x,
          y: d.bounds.y,
          width: d.bounds.width,
          height: d.bounds.height,
        },
        workAreaSize: {
          width: d.workAreaSize.width,
          height: d.workAreaSize.height,
        },
        scaleFactor: d.scaleFactor,
      }));
      return { success: true, data: displays };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  });

  // 全局快捷键：初装不设置默认值，仅当用户在截图页配置后才注册
  initShortcutFromConfig();

  // 读取当前已配置的快捷键（截图页初始化时调用）
  ipcMain.handle("screenshot:get-shortcut", async () => {
    return { accel: currentAccel, stored: readPersistedShortcut() };
  });

  // 设置 / 替换全局快捷键（截图页录制后保存）
  ipcMain.handle(
    "screenshot:set-shortcut",
    async (_e, payload: { accel?: string }) => {
      const accel =
        typeof payload?.accel === "string" ? payload.accel.trim() : "";
      if (!accel) return { ok: false, error: "快捷键为空" };
      const res = applyShortcut(accel);
      if (res.ok) persistShortcut(accel);
      return res;
    }
  );

  // 清除全局快捷键（截图页点击「清除」）
  ipcMain.handle("screenshot:clear-shortcut", async () => {
    const res = applyShortcut(null);
    if (res.ok) persistShortcut(null);
    return res;
  });
}
