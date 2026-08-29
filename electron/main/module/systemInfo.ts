/**
 * 系统信息监控模块（主进程）
 * 负责通过 Worker 线程采集系统实时/静态信息，并推送给渲染端
 * 注：原 api-test / spider-test 处理器已移除，接口测试能力由 netRequest 模块承接
 */
import { ipcMain } from "electron";
import colors from "colors";
import { win } from "./mainWindow.ts";
import { Worker } from "worker_threads";
import { systemInfoWorkerPath } from "../variables.ts";

/**
 * 初始化系统信息监控 IPC
 * 注册 'system-info' 与 'system-info-static' 两个通道
 * 无返回值；注册失败会向上抛出异常
 */
export function initSystemInfo() {
  // 实时监控 worker 实例
  let trafficWorker: Worker | null;

  /**
   * 实时系统信息通道
   * @param userConfig 监控配置（type: start/stop，及采样间隔等可选参数）
   */
  ipcMain.on("system-info", async (e, userConfig: ObjectType = { type: "start" }) => {
    console.log(userConfig.type, "系统信息监控配置");
    win.webContents.send("system-info", { type: "start-pre", data: systemInfoWorkerPath });

    // 重复启动前先终止旧 worker，避免资源泄漏
    if (trafficWorker) {
      trafficWorker.terminate();
    }

    // 默认采样配置：常规 1s / 突发持续 10s / 静默期 5s
    const defaultConfig = {
      samplingInterval: 1000,
      burstDuration: 10000,
      quietSamplingInterval: 5000,
    };

    const finalConfig = { ...defaultConfig, ...userConfig };

    trafficWorker = new Worker(systemInfoWorkerPath, {
      workerData: { config: finalConfig },
    });

    // 发送启停控制消息给 Worker
    trafficWorker.postMessage({ type: userConfig.type || "start" });

    // 转发 Worker 采集结果给渲染端
    trafficWorker.on("message", (data) => {
      if (win && !win.isDestroyed()) {
        console.log(Date.now(), data.type);
        win.webContents.send("system-info", data);
      }
    });

    trafficWorker.on("error", (error) => {
      console.error("Worker error:", error);
    });

    trafficWorker.on("exit", (code) => {
      if (code !== 0) {
        console.log("Worker stopped with exit code:", code);
      }
    });
  });

  // 静态信息 worker 实例
  let trafficWorkerStatic: Worker | null;

  /**
   * 静态系统信息通道
   * @param userConfig 采集配置（type: summary/extended）
   */
  ipcMain.on("system-info-static", async (e, userConfig: ObjectType = { type: "start" }) => {
    console.log(userConfig.type, "系统信息监控配置static");
    win.webContents.send("system-info-static", { type: "start-pre", data: systemInfoWorkerPath });

    if (trafficWorkerStatic) {
      trafficWorkerStatic.terminate();
    }

    const defaultConfig = {
      samplingInterval: 1000,
      burstDuration: 10000,
      quietSamplingInterval: 5000,
    };

    const finalConfig = { ...defaultConfig, ...userConfig };

    trafficWorkerStatic = new Worker(systemInfoWorkerPath, {
      workerData: { config: finalConfig },
    });

    trafficWorkerStatic.postMessage({ type: userConfig.type || "start" });

    trafficWorkerStatic.on("message", (data) => {
      if (win && !win.isDestroyed()) {
        console.log(colors.bgBlue(data.type), data.type);
        win.webContents.send("system-info-static", data);
      }
    });

    trafficWorkerStatic.on("error", (error) => {
      console.error("Worker error:", error);
    });

    trafficWorkerStatic.on("exit", (code) => {
      if (code !== 0) {
        console.log("Worker stopped with exit code:", code);
      }
    });
  });
}
