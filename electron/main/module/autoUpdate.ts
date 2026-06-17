import { ipcMain, shell, app } from "electron";
import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { win } from "./mainWindow.ts";

// GitHub 仓库信息
const GITHUB_OWNER = "simply-none";
const GITHUB_REPO = "JianLi-App";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

/**
 * 获取当前应用版本号
 */
function getAppVersion(): string {
  return app.getVersion();
}

/**
 * 比较两个版本号（支持 semver 风格，含 rc/beta 等后缀）
 * @returns  1 => a > b, -1 => a < b, 0 => 相等
 */
function compareVersion(a: string, b: string): number {
  // 去除前缀 v
  const clean = (v: string) => v.replace(/^v/i, "");
  const cleanA = clean(a);
  const cleanB = clean(b);

  // 拆分主版本和预发布标识
  const [mainA, preA = ""] = cleanA.split("-");
  const [mainB, preB = ""] = cleanB.split("-");

  const partsA = mainA.split(".").map(Number);
  const partsB = mainB.split(".").map(Number);

  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }

  // 主版本相同，比较预发布标识
  // 有预发布 < 无预发布（正式版）
  if (preA && !preB) return -1;
  if (!preA && preB) return 1;
  if (preA && preB) {
    return preA < preB ? -1 : preA > preB ? 1 : 0;
  }
  return 0;
}

/**
 * 通过 https 发起 GET 请求，自动跟随重定向
 */
function httpsGet(url: string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(
      url,
      {
        headers: {
          "User-Agent": "JianLi-App-Updater",
          ...headers,
        },
      },
      (res) => {
        // 跟随重定向
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpsGet(res.headers.location, headers).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(body);
          }
        });
        res.on("error", reject);
      }
    ).on("error", reject);
  });
}

/**
 * 下载文件到指定路径，支持进度回调
 */
function downloadFile(url: string, destPath: string, onProgress?: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(
      url,
      {
        headers: { "User-Agent": "JianLi-App-Updater" },
      },
      (res) => {
        // 跟随重定向
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          downloadFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`下载失败: HTTP ${res.statusCode}`));
          return;
        }

        const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
        let receivedBytes = 0;

        const fileStream = fs.createWriteStream(destPath);
        res.on("data", (chunk: Buffer) => {
          receivedBytes += chunk.length;
          if (totalBytes > 0 && onProgress) {
            onProgress(Math.round((receivedBytes / totalBytes) * 100));
          }
        });

        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close();
          resolve(destPath);
        });
        fileStream.on("error", (err) => {
          fs.unlink(destPath, () => {}); // 清理不完整的文件
          reject(err);
        });
      }
    ).on("error", reject);
  });
}

export function initAutoUpdate() {
  // 获取当前应用版本
  ipcMain.handle("get-app-version", async () => {
    return getAppVersion();
  });

  // 检查更新
  ipcMain.handle("check-for-update", async () => {
    try {
      const release = await httpsGet(GITHUB_API);
      console.log("检查更新:", release);
      const latestVersion = release.tag_name?.replace(/^v/i, "") || "";
      const currentVersion = getAppVersion();
      const hasUpdate = compareVersion(latestVersion, currentVersion) > 0;

      return {
        hasUpdate,
        currentVersion,
        latestVersion,
        releaseName: release.name || release.tag_name,
        releaseBody: release.body || "",
        releaseUrl: release.html_url,
        publishedAt: release.published_at,
        assets: (release.assets || []).map((asset: any) => ({
          name: asset.name,
          size: asset.size,
          downloadUrl: asset.browser_download_url,
          contentType: asset.content_type,
        })),
      };
    } catch (err: any) {
      console.error("检查更新失败:", err);
      throw new Error(`检查更新失败: ${err.message}`);
    }
  });

  // 下载更新
  ipcMain.handle("download-update", async (_event, { downloadUrl, fileName }: { downloadUrl: string; fileName: string }) => {
    try {
      const downloadDir = path.join(app.getPath("downloads"), "JianLi-App-Update");
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      const destPath = path.join(downloadDir, fileName);

      // 如果文件已存在则删除
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }

      const filePath = await downloadFile(downloadUrl, destPath, (percent) => {
        win.webContents.send("download-progress", percent);
      });

      return { success: true, filePath };
    } catch (err: any) {
      console.error("下载更新失败:", err);
      throw new Error(`下载更新失败: ${err.message}`);
    }
  });

  // 安装更新（打开安装包）
  ipcMain.handle("install-update", async (_event, { filePath }: { filePath: string }) => {
    try {
      await shell.openPath(filePath);
      return { success: true };
    } catch (err: any) {
      console.error("安装更新失败:", err);
      throw new Error(`安装更新失败: ${err.message}`);
    }
  });

  // 打开外部链接
  ipcMain.handle("open-external-url", async (_event, { url }: { url: string }) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (err: any) {
      console.error("打开外部链接失败:", err);
      throw new Error(`打开外部链接失败: ${err.message}`);
    }
  });
}
