import { parentPort } from "worker_threads";
import path from "path";
import fs from "fs";
import colors from "colors";

// 控制并发目录扫描数量
const MAX_CONCURRENT_SCANS = 10;
let activeScans = 0;
const scanQueue = [];

// 排除不需要扫描的目录
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "Library",
  "System",
  "Windows",
  "$Recycle.Bin",
]);

async function processScanQueue() {
  while (scanQueue.length > 0 && activeScans < MAX_CONCURRENT_SCANS) {
    const { dirPath, extensions, callback } = scanQueue.shift();
    activeScans++;
    try {
      const results = await scanDirectory(dirPath, extensions);
      // console.log(colors.bgMagenta(results), "results...");
      callback(null, results);
    } catch (error) {
      callback(error);
    } finally {
      activeScans--;
      processScanQueue();
    }
  }
}

async function scanDirectory(directory, extensions) {
  let results = [];
  try {
    const items = await fs.promises.readdir(directory, { withFileTypes: true });

    // 进度反馈
    parentPort.postMessage({
      type: "progress",
      data: { currentDir: directory, totalFound: results.length },
    });

    for (const item of items) {
      const fullPath = path.join(directory, item.name);
      const baseName = path.basename(fullPath);
      // console.log('isFile', item.isFile(), 'isDirectory()', item.isDirectory(), colors.bgBlue(item))

      if (item.isDirectory()) {
        if (EXCLUDED_DIRS.has(baseName)) continue;

        // 使用队列控制并发
        await new Promise((resolve) => {
          scanQueue.push({
            dirPath: fullPath,
            extensions,
            callback: (err, dirResults) => {
              // console.log(colors.bgYellow(dirResults), "资产扫描完成...");
              if (!err && dirResults) {
                results = results.concat(dirResults);
              }
              resolve();
            },
          });
          processScanQueue();
        });
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        // console.log(colors.bgRed(ext), extensions, extensions.includes(ext));
        if (extensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`扫描目录 ${directory} 时出错:`, error);
  }
  console.log(colors.bgCyan(results), "results...");
  return results;
}

parentPort.on("message", async (message) => {
  if (message.type === "start-scan") {
    const { startPath, extensions } = message.data;
    try {
      const results = await scanDirectory(startPath, extensions);
      // console.log(colors.bgCyan(results), "results...");
      parentPort.postMessage({
        type: "complete",
        data: results,
      });
    } catch (error) {
      parentPort.postMessage({
        type: "error",
        data: error.message,
      });
    }
  }
});
