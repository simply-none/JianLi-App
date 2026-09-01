import { ipcMain, app } from "electron";
import colors from 'colors'
import { getFonts2 } from 'font-list'
import { exec, spawn, ChildProcess } from "node:child_process";
import path from 'path'
import { Worker } from "worker_threads";
import { defaultAppWorkerPath } from "../variables.ts";
import { win } from "./mainWindow.ts";
import dns from 'node:dns';
import net from 'node:net';
import crypto from 'node:crypto';
import iconv from 'iconv-lite';

/**
 * 为子进程的 stdout/stderr 挂载 GBK 流式解码并推送数据
 * Windows 中文系统下 ping/tracert 输出为 GBK (CP936) 编码，直接 toString 会乱码；
 * 使用 iconv.decodeStream 保证跨 chunk 的多字节 GBK 字符不会被截断产生乱码。
 * @param child 子进程
 * @param onChunk 收到解码后文本片段的回调
 */
function wireGbkStream(child: ChildProcess, onChunk: (str: string) => void): void {
  for (const stream of [child.stdout, child.stderr]) {
    if (!stream) continue;
    const decoder = iconv.decodeStream('gbk');
    stream.pipe(decoder);
    decoder.on('data', (str: string) => onChunk(str));
  }
}

// 活动中的子进程 Map：taskId → ChildProcess，用于取消
const activeTasks = new Map<string, ChildProcess>();

export async function initSys() {
  let fonts: ObjectType = await getFonts2()
  fonts = fonts.map((item: ObjectType) => {
    return {
      label: item.familyName,
      value: item.familyName,
    }
  })

  // 获取表数据，参数为表名，以及查询条件
  ipcMain.handle("get-fonts", async (event) => {
    return new Promise((resolve) => {
      resolve(fonts)
    });
  });

  // 获取扩展对应的默认文件位置
  let defaultAppWorker;
  ipcMain.on("get-default-file-path", async (event, { ext }: ObjectType) => {
    return new Promise((resolve) => {

      if (defaultAppWorker) {
        defaultAppWorker.postMessage({ type: 'start', ext });
        return;
      }

      defaultAppWorker = new Worker(defaultAppWorkerPath, {
        workerData: { config: {
          ext,
        } }
      });
  
      // 发送消息给Worker
      defaultAppWorker.postMessage({ type: 'start', ext });
  
      // 处理Worker消息
      defaultAppWorker.on('message', (data) => {
        win.webContents.send('get-default-file-path', data)
      });
  
      defaultAppWorker.on('error', (error) => {
        console.error('Worker error:', error);
        defaultAppWorker = null;
      });
  
      defaultAppWorker.on('exit', (code) => {
        // worker 结束后必须重置引用，否则再次打开弹窗时仍向已终止的 worker postMessage 会静默失效
        defaultAppWorker = null;
        if (code !== 0) {
          console.log('Worker stopped with exit code:', code);
        }
      });
      
    })
  });

  // 打开文件通过默认程序
  ipcMain.handle("open-file-by-default-app", async (event, { filePath, defaultAppPath }: ObjectType) => {
    return new Promise((resolve) => {
      exec(`"${defaultAppPath}" "${filePath}"`, (err, stdout) => {
        console.log(err, 'err')
        if (err) return resolve(null)
        resolve(true)
      })
    })
  })

  // 获取所有安装的应用列表
  ipcMain.handle("get-installed-apps", async (event) => {
    return new Promise((resolve, reject) => {
      // 查询64位和32位注册表路径
      const command = `
      $paths = @(
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$result = @()

foreach ($path in $paths) {
    $apps = Get-ItemProperty $path | Where-Object { $_.DisplayName -ne $null -and $_.DisplayName -notmatch 'Microsoft Visual C\+\+'}
    
    foreach ($app in $apps) {
        $executablePath = $null
        $iconPath = $null
        
        # 尝试从不同字段获取执行路径
        if ($app.InstallLocation -and (Test-Path $app.InstallLocation)) {
            $exeFiles = Get-ChildItem $app.InstallLocation -Filter *.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($exeFiles) { 
                $executablePath = $exeFiles.FullName 
                $iconPath = $exeFiles.FullName
            }
        }
        
        # 从DisplayIcon提取路径
        if ($app.DisplayIcon -and $app.DisplayIcon -match '\.exe') {
            $executablePath = $app.DisplayIcon -replace '.*\\\\|".*$', ''
            $iconPath = $executablePath
        }
        
        # 特殊处理Microsoft Store应用
        if ($app.DisplayName -like '*Store*') {
            $executablePath = $null
            $iconPath = $null
        }
        
        $result += [PSCustomObject]@{
            Name = $app.DisplayName
            Publisher = $app.Publisher
            Version = $app.DisplayVersion
            InstallDate = $app.InstallDate
            InstallLocation = $app.InstallLocation
            ExecutablePath = $executablePath
            IconPath = $iconPath
            IsSystemComponent = [bool]($app.SystemComponent)
            IsRuntime = $app.DisplayName -match 'Microsoft Visual C\+\+'
        }
    }
}

$result | Where-Object { $_.Name -and -not $_.IsSystemComponent } | ConvertTo-Json -Depth 5

    `;

      exec(`powershell -Command "${command}"`,
        { maxBuffer: 1024 * 10000 },
        (error, stdout, stderr) => {
          if (error) return reject(error);
          if (stderr) return reject(new Error(stderr));
          console.log(stdout, 'stdout')
          try {
            let apps = JSON.parse(stdout.trim());
            console.log(apps, 'apps')

            apps = apps.filter(app => app.Name && !app.IsSystemComponent)
            resolve(apps)
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  })

  // ============ 开发工具箱扩展 IPC ============

  /**
   * 计算文本哈希（MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512 / HMAC-SHA256）
   */
  ipcMain.handle("sys:hash", async (_e, text: string, algorithm: string, key?: string) => {
    try {
      if (algorithm.startsWith('hmac') && key !== undefined) {
        const hmac = crypto.createHmac('sha256', key);
        hmac.update(text);
        return hmac.digest('hex');
      }
      const hash = crypto.createHash(algorithm);
      hash.update(text);
      return hash.digest('hex');
    } catch (err: any) {
      return { error: err.message || String(err) };
    }
  });

  /**
   * 取消正在执行的任务（ping / traceroute 等长连命令）
   */
  ipcMain.handle("sys:cancel-task", async (_e, taskId: string) => {
    const child = activeTasks.get(taskId);
    if (child) {
      try { child.kill('SIGTERM'); } catch {}
      activeTasks.delete(taskId);
      return { ok: true };
    }
    return { ok: false, error: 'task not found' };
  });

  /**
   * Ping 主机（Windows: ping -n count host），流式推送输出
   */
  ipcMain.handle("sys:ping", async (event, host: string, count = 4, taskId?: string) => {
    return new Promise((resolve) => {
      const taskKey = taskId || crypto.randomUUID();
      const child = spawn('ping', ['-n', String(count), host], { shell: false, windowsHide: true });
      activeTasks.set(taskKey, child);
      let output = '';

      // GBK 流式解码：实时推送 + 全量拼接（防止多字节字符跨 chunk 截断乱码）
      wireGbkStream(child, (str) => {
        output += str;
        win.webContents.send('sys:ping-data', { taskId: taskKey, data: str });
      });

      child.on('close', (code) => {
        activeTasks.delete(taskKey);
        resolve({ ok: code === 0, raw: output, exitCode: code });
      });
      child.on('error', (err) => {
        activeTasks.delete(taskKey);
        resolve({ ok: false, raw: output, error: err.message });
      });
    });
  });

  /**
   * Traceroute（Windows: tracert -d -h maxHop host），流式推送
   */
  ipcMain.handle("sys:traceroute", async (event, host: string, maxHop = 10, taskId?: string) => {
    return new Promise((resolve) => {
      const taskKey = taskId || crypto.randomUUID();
      const child = spawn('tracert', ['-d', '-h', String(maxHop), host], { shell: false, windowsHide: true });
      activeTasks.set(taskKey, child);
      let output = '';

      // GBK 流式解码：实时推送 + 全量拼接（防止多字节字符跨 chunk 截断乱码）
      wireGbkStream(child, (str) => {
        output += str;
        win.webContents.send('sys:traceroute-data', { taskId: taskKey, data: str });
      });

      child.on('close', (code) => {
        activeTasks.delete(taskKey);
        resolve({ ok: code === 0, raw: output, exitCode: code });
      });
      child.on('error', (err) => {
        activeTasks.delete(taskKey);
        resolve({ ok: false, raw: output, error: err.message });
      });
    });
  });

  /**
   * DNS 查询：A / AAAA / PTR / CNAME / NS / TXT / MX / SOA
   */
  ipcMain.handle("sys:dns-lookup", async (_e, host: string) => {
    const results: Record<string, any> = {};
    try {
      try { results.A = await dns.promises.resolve4(host); } catch {}
      try { results.AAAA = await dns.promises.resolve6(host); } catch {}
      try { results.CNAME = await dns.promises.resolveCname(host); } catch {}
      try { results.NS = await dns.promises.resolveNs(host); } catch {}
      try { results.TXT = await dns.promises.resolveTxt(host); } catch {}
      try { results.MX = await dns.promises.resolveMx(host); } catch {}
      try { results.SOA = await dns.promises.resolveSoa(host); } catch {}
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        try { results.PTR = await dns.promises.reverse(host); } catch {}
      }
      try { results.lookup = await dns.promises.lookup(host, { all: true }); } catch {}
      return { ok: true, results };
    } catch (err: any) {
      return { ok: false, error: err.message || String(err), results };
    }
  });

  /**
   * 端口检测：并发 net.createConnection
   */
  ipcMain.handle("sys:port-check", async (_e, host: string, ports: number[], timeout = 3000, concurrency = 50) => {
    const results: { port: number; status: string; duration: number; service?: string }[] = [];

    const chunks: number[][] = [];
    for (let i = 0; i < ports.length; i += concurrency) {
      chunks.push(ports.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(port => new Promise<void>((resolve) => {
        const start = Date.now();
        const socket = net.createConnection({ host, port, timeout });
        let settled = false;

        const finish = (status: string) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          results.push({ port, status, duration: Date.now() - start });
          resolve();
        };

        socket.on('connect', () => finish('open'));
        socket.on('timeout', () => finish('filtered'));
        socket.on('error', () => finish('closed'));
        socket.on('close', () => { if (!settled) finish('closed'); });
      })));
    }

    results.sort((a, b) => a.port - b.port);
    return { ok: true, total: ports.length, results };
  });

}


