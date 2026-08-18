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
  shell,
} from "electron";
import type { DesktopCapturerSource } from "electron";
import path from "node:path";
import fs from "node:fs";
import moment from "moment";
import { win } from "./mainWindow.ts";
import { store } from "./store.ts";
import { insert, del, query } from "./newSql.ts";
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
 *   handlePromise("screenshot:save", { dataUrl })           —— 弹窗保存到文件（并落库 screenshots 表）
 *   handlePromise("screenshot:copy", { dataUrl })           —— 复制到剪贴板（并落库 screenshots 表）
 *   handlePromise("screenshot:get-displays", {})            —— 显示器信息
 *   handlePromise("screenshot:open-path", { path })         —— 系统默认程序打开截图文件
 *   handlePromise("screenshot:delete-screenshot", { id, path }) —— 删除记录（文件 + DB 行）
 *   handlePromise("screenshot:capture-sources", {})           —— 捕获所有屏幕 + 打开的应用窗口缩略图（右侧面板用）
 *   handlePromise("screenshot:persist", { dataUrl, action })  —— 直接写入缓存目录 + 落库（无弹窗），action: copy|save
 *   on("screenshot:result", ({ dataUrl, width, height, savedPath })) —— 主进程回传截图结果
 *   截图历史：复制 / 保存 都会写入 <用户缓存目录>/screenshots 并插入 screenshots 表，
 *            截图工具页左侧栏通过 new-sql:query 分页读取（LIMIT 20, created_at DESC）。
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
    const bmp: any = image.getBitmap();
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
    width: display.bounds.width,
    height: display.bounds.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    // 允许全屏：确保窗口可覆盖整块显示器（含任务栏区域），
    // 否则 Windows 下 frameless 窗口可能被任务栏占位挤到工作区高度。
    fullscreenable: true,
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
  // 关键修复：显式把窗口边界设为「完整显示器矩形」，强制覆盖整个屏幕（含任务栏）。
  // Windows 下仅按 display.size 传构造参数时，非全屏的 frameless 窗口可能被任务栏
  // 占位「挤」到工作区高度，导致 window.innerHeight 少了任务栏那一截 ——
  // 表现为冻结背景 / 全屏截图「没有占满整个屏幕，去掉了任务栏的高度」。
  // 这里的 setBounds 能确保窗口真正铺满整屏，使后续 image.innerWidth/innerHeight 即整屏尺寸。
  selectWin.setBounds({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
  });

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
/**
 * 持久化一张截图：写入磁盘（cache/screenshots，未配置 destPath 时）并插入 screenshots 表。
 * —— 复制 / 保存 两种动作都会落库，便于截图工具页左侧历史栏读取。
 * @param dataUrl 最终 PNG 的 dataURL
 * @param action  copy | save（仅用于记录）
 * @param destPath 已存在的目标文件路径（如路由页「保存到文件」弹窗所选路径）；
 *                 不传则自动写入 <用户缓存目录>/screenshots/<时间戳>.png
 * @returns 实际落盘的文件路径（失败返回 null）
 */
/**
 * 解析截图保存目录：
 * 1. 优先读取 basic_info 表 key=fileCachePath 的配置（用户自定义缓存目录）；
 *    该 value 经 set-store 写入时已 JSON.stringify，读取时尝试 JSON.parse，解析失败则按原字符串使用。
 * 2. 若该值为空 / 不存在，则回退到 app.getPath("pictures")。
 * 3. 最终在其下建立 screenshots 子目录并返回。
 */
async function resolveShotDir(): Promise<string> {
  let base = "";
  try {
    const rows = await query({
      tableName: "basic_info",
      conditions: { key: "fileCachePath" },
      columns: ["key", "value"],
    });
    if (rows && rows.length > 0) {
      const raw = rows[0].value;
      if (raw !== undefined && raw !== null) {
        let parsed: any = raw;
        // basic_info 的 value 经 set-store 写入时 JSON.stringify 过（字符串会带引号）
        if (typeof raw === "string" && raw.trim().startsWith('"')) {
          try {
            parsed = JSON.parse(raw);
          } catch {
            /* 解析失败则保留原始字符串 */
          }
        }
        base = typeof parsed === "string" ? parsed : String(raw);
      }
    }
  } catch {
    /* 查询异常则回退到 pictures */
  }

  if (!base || !base.trim()) {
    base = app.getPath("pictures");
  }

  const shotDir = path.join(base, "screenshots");
  try {
    fs.mkdirSync(shotDir, { recursive: true });
  } catch {
    /* 万一自定义目录不可写，再兜底到 pictures */
    const fallback = path.join(app.getPath("pictures"), "screenshots");
    try {
      fs.mkdirSync(fallback, { recursive: true });
    } catch {
      /* noop */
    }
    return fallback;
  }
  return shotDir;
}

async function persistScreenshot(
  dataUrl: string,
  action: "copy" | "save",
  destPath?: string
): Promise<{ filePath: string } | null> {
  try {
    const image = nativeImage.createFromDataURL(dataUrl);
    const size = image.getSize();

    let filePath = destPath;
    if (!filePath) {
      // 自动保存到截图目录（basic_info.fileCachePath 或 pictures 下的 screenshots）
      const shotDir = await resolveShotDir();
      // 文件名带上动作：screenshot-[action]-时间戳.png
      const defaultName = `screenshot-${action}-${moment().format(
        "YYYYMMDD-HHmmss"
      )}.png`;
      filePath = path.join(shotDir, defaultName);
      fs.writeFileSync(filePath, image.toPNG());
    }

    // 落库（路径 / 时间 / 动作 / 尺寸）
    await insert({
      tableName: "screenshots",
      data: {
        path: filePath,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        action,
        width: size.width,
        height: size.height,
      },
    });

    return { filePath };
  } catch (e: any) {
    console.error("截图持久化失败:", e);
    return null;
  }
}

/**
 * 接收选框层合成好的最终图（含标注），按 action 复制/保存并回传路由页。
 * —— 复制 / 保存 都写入 cache/screenshots 并落库；保存不再弹窗。
 * @param dataUrl 选框层用 canvas 合成的最终 PNG（已裁剪到选区并叠加箭头/文字/马赛克）
 */
async function finalizeCapture(dataUrl: string, action: "copy" | "save") {
  try {
    const image = nativeImage.createFromDataURL(dataUrl);
    const size = image.getSize();

    // 写入 cache/screenshots 并落库（保存不再弹窗）
    const rec = await persistScreenshot(dataUrl, action);

    if (action === "copy") {
      // 复制到剪贴板
      clipboard.writeImage(image);
    }

    // 回传结果给主窗口的截图页预览
    win?.webContents.send("screenshot:result", {
      dataUrl,
      width: size.width,
      height: size.height,
      action,
      savedPath: rec?.filePath || "",
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

  // 保存到本地文件（路由页手动保存结果，保留原弹窗行为并落库）
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
        // 落库（使用用户自选路径）
        await persistScreenshot(payload.dataUrl, "save", filePath);
        return { success: true, filePath };
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) };
      }
    }
  );

  // 复制到系统剪贴板（路由页手动复制结果，并落库）
  ipcMain.handle("screenshot:copy", async (_e, payload: { dataUrl: string }) => {
    try {
      const image = nativeImage.createFromDataURL(payload.dataUrl);
      clipboard.writeImage(image);
      // 落库（自动写入 cache/screenshots）
      await persistScreenshot(payload.dataUrl, "copy");
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  });

  // 复制文本（如吸管取到的色值）到系统剪贴板
  ipcMain.handle("screenshot:copy-text", async (_e, text: string) => {
    try {
      if (typeof text !== "string" || !text) return { success: false, error: "空内容" };
      clipboard.writeText(text);
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

  // 用系统默认程序打开历史截图文件
  ipcMain.handle(
    "screenshot:open-path",
    async (_e, payload: { path: string }) => {
      try {
        if (!payload?.path) return { success: false, error: "路径为空" };
        await shell.openPath(payload.path);
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) };
      }
    }
  );

  // 删除一条截图记录（同时删除磁盘文件 + DB 行）
  ipcMain.handle(
    "screenshot:delete-screenshot",
    async (_e, payload: { id?: number; path: string }) => {
      try {
        if (payload?.path) {
          try {
            fs.unlinkSync(payload.path);
          } catch {
            /* 文件可能已不存在，忽略 */
          }
        }
        if (payload?.id) {
          try {
            await del({ tableName: "screenshots", condition: { id: payload.id } });
          } catch {
            /* 忽略 */
          }
        }
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) };
      }
    }
  );

  // 捕获所有显示器 + 打开的应用窗口缩略图（右侧面板「显示器与窗口」用）
  // 返回列表：{ id, name, type:'screen'|'window', dataUrl, width, height }
  ipcMain.handle("screenshot:capture-sources", async () => {
    try {
      // 缩略图目标尺寸：取最大显示器的物理分辨率（封顶，避免内存过高）
      let tw = 0;
      let th = 0;
      try {
        const all = screen.getAllDisplays();
        for (const d of all) {
          tw = Math.max(tw, Math.round(d.bounds.width * d.scaleFactor));
          th = Math.max(th, Math.round(d.bounds.height * d.scaleFactor));
        }
      } catch {
        /* 忽略，使用默认尺寸 */
      }
      tw = Math.min(tw || 1920, 2560);
      th = Math.min(th || 1080, 1440);

      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: tw, height: th },
      });

      const list = sources
        .filter((s) => s.thumbnail && !s.thumbnail.isEmpty())
        .map((s) => {
          const size = s.thumbnail.getSize();
          return {
            id: s.id,
            name: s.name,
            type: /^screen/i.test(s.id) ? "screen" : "window",
            dataUrl: s.thumbnail.toDataURL(),
            width: size.width,
            height: size.height,
          };
        });
      return { success: true, data: list };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  });

  // 直接将某张图（来自右侧来源截图）写入缓存目录 + 落库（无弹窗）
  // action: save  —— 仅落库（同 persistScreenshot 的 save 行为）
  // action: copy  —— 落库 + 复制到剪贴板
  ipcMain.handle(
    "screenshot:persist",
    async (_e, payload: { dataUrl: string; action: "copy" | "save" }) => {
      try {
        if (!payload?.dataUrl) return { success: false, error: "数据为空" };
        const rec = await persistScreenshot(payload.dataUrl, payload.action);
        if (!rec) return { success: false, error: "持久化失败" };
        if (payload.action === "copy") {
          try {
            clipboard.writeImage(nativeImage.createFromDataURL(payload.dataUrl));
          } catch {
            /* 复制失败不影响落库结果 */
          }
        }
        return { success: true, filePath: rec.filePath };
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) };
      }
    }
  );
}
