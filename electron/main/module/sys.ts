import { ipcMain, app } from "electron";
import colors from 'colors'
import { getFonts2 } from 'font-list'
import { exec } from "node:child_process";
import path from 'path'

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
  ipcMain.handle("get-default-file-path", async (event, { ext }: ObjectType) => {
    return new Promise((resolve) => {
      // 改进的注册表查询命令（兼容Win10/Win11）
      const cmd = `reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\${ext}\\UserChoiceLatest\\ProgId" /v ProgId`
      exec(cmd, (err, stdout) => {
        console.log(err, 'err')
        if (err) return resolve(null)

        const progId = stdout.match(/ProgId\s+REG_SZ\s+(.+)/)?.[1]
        console.log(colors.bgBlack(progId), 'progId')
        if (!progId) return resolve(null)

        // 二次查询获取执行命令
        exec(`reg query "HKEY_CLASSES_ROOT\\${progId}\\shell\\open\\command"`, (err, cmdStdout) => {
          console.log(cmdStdout, 'cmdStdout')
          const exePath = extractAppPath(cmdStdout)
          console.log(colors.bgBlue(exePath), 'exePath')
          resolve(exePath ? path.normalize(exePath.replace(/"/g, '')) : null)
        })
      })
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

function extractAppPath(registryString) {
  // 匹配双引号内的完整路径
  const pathMatch = registryString.match(/"([^"]+\.exe)"/i);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1].replace(/\\/g, '/'); // 统一路径分隔符
  }

  // 备用匹配：非贪婪匹配直到.exe
  const fallbackMatch = registryString.match(/([a-z]:[^"]+?\.exe)/i);
  return fallbackMatch ? fallbackMatch[1] : null;
}
