import { ipcMain, app } from "electron";
import colors from 'colors'
import { getFonts2 } from 'font-list'
import { exec } from "node:child_process";
import path from 'path'
import { Worker } from "worker_threads";
import { defaultAppWorkerPath } from "../variables.ts";
import { win } from "./mainWindow.ts";

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
      });
  
      defaultAppWorker.on('exit', (code) => {
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

}


