import { app } from 'electron'
import { exec, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const APP_NAME = app.getName()
const APP_PATH = app.getPath('exe')

export interface StartupResult {
  success: boolean
  method: string
  message?: string
}

function setLoginItemSettings(isStartup: boolean): StartupResult {
  try {
    app.setLoginItemSettings({
      openAtLogin: isStartup,
      openAsHidden: true,
      path: APP_PATH,
      args: isStartup ? [] : undefined,
    })
    return {
      success: true,
      method: 'electron-api',
      message: 'Electron 内置 API 设置成功',
    }
  } catch (err) {
    return {
      success: false,
      method: 'electron-api',
      message: (err as Error).message,
    }
  }
}

function getStartupFolder(): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA
      ? path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
      : ''
  }
  return ''
}

function createShortcut(isStartup: boolean): StartupResult {
  if (process.platform !== 'win32') {
    return {
      success: false,
      method: 'shortcut',
      message: '仅支持 Windows 平台',
    }
  }

  const startupFolder = getStartupFolder()
  if (!startupFolder) {
    return {
      success: false,
      method: 'shortcut',
      message: '无法获取启动文件夹路径',
    }
  }

  const shortcutPath = path.join(startupFolder, `${APP_NAME}.lnk`)

  try {
    if (isStartup) {
      if (!fs.existsSync(startupFolder)) {
        fs.mkdirSync(startupFolder, { recursive: true })
      }

      const escapedAppPath = APP_PATH.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      const escapedShortcutPath = shortcutPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

      const powershellScript = `
        $WshShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut("${escapedShortcutPath}")
        $Shortcut.TargetPath = "${escapedAppPath}"
        $Shortcut.WorkingDirectory = "${path.dirname(APP_PATH).replace(/\\/g, '\\\\')}"
        $Shortcut.Save()
      `

      execSync(`powershell -Command "${powershellScript}"`, {
        timeout: 10000,
      })

      if (fs.existsSync(shortcutPath)) {
        return {
          success: true,
          method: 'shortcut',
          message: '启动文件夹快捷方式创建成功',
        }
      } else {
        return {
          success: false,
          method: 'shortcut',
          message: '快捷方式创建后不存在',
        }
      }
    } else {
      if (fs.existsSync(shortcutPath)) {
        fs.unlinkSync(shortcutPath)
        return {
          success: true,
          method: 'shortcut',
          message: '启动文件夹快捷方式已删除',
        }
      }
      return {
        success: true,
        method: 'shortcut',
        message: '快捷方式不存在，无需删除',
      }
    }
  } catch (err) {
    return {
      success: false,
      method: 'shortcut',
      message: (err as Error).message,
    }
  }
}

function createTaskScheduler(isStartup: boolean): StartupResult {
  if (process.platform !== 'win32') {
    return {
      success: false,
      method: 'task-scheduler',
      message: '仅支持 Windows 平台',
    }
  }

  const taskName = APP_NAME

  try {
    if (isStartup) {
      const escapedPath = APP_PATH.replace(/"/g, '\\"')
      const command = `schtasks /create /tn "${taskName}" /tr "\"${escapedPath}\"" /sc onstart /ru "${process.env.USERNAME}" /f`

      execSync(command, {
        timeout: 15000,
      })

      try {
        execSync(`schtasks /query /tn "${taskName}"`, { timeout: 5000 })
        return {
          success: true,
          method: 'task-scheduler',
          message: '任务计划程序创建成功',
        }
      } catch {
        return {
          success: false,
          method: 'task-scheduler',
          message: '任务创建后查询失败',
        }
      }
    } else {
      try {
        execSync(`schtasks /delete /tn "${taskName}" /f`, { timeout: 5000 })
        return {
          success: true,
          method: 'task-scheduler',
          message: '任务计划程序已删除',
        }
      } catch {
        return {
          success: true,
          method: 'task-scheduler',
          message: '任务不存在，无需删除',
        }
      }
    }
  } catch (err) {
    return {
      success: false,
      method: 'task-scheduler',
      message: (err as Error).message,
    }
  }
}

function cleanupOtherMethods(isStartup: boolean) {
  if (!isStartup) {
    createShortcut(false)
    createTaskScheduler(false)
  }
}

export function setAutoStartup(isStartup: boolean): StartupResult {
  console.log(`[AutoStartup] 设置自启动: ${isStartup}`)

  if (!isStartup) {
    cleanupOtherMethods(false)
    const result = setLoginItemSettings(false)
    console.log(`[AutoStartup] 结果: ${result.method} - ${result.message}`)
    return result
  }

  const methods = [setLoginItemSettings, createShortcut, createTaskScheduler]

  for (const method of methods) {
    const result = method(isStartup)
    console.log(`[AutoStartup] 尝试 ${result.method}: ${result.success ? '成功' : '失败'} - ${result.message}`)

    if (result.success) {
      cleanupOtherMethods(true)
      return result
    }
  }

  return {
    success: false,
    method: 'all-failed',
    message: '所有自启动方案均失败，请尝试手动添加',
  }
}

export function checkAutoStartupStatus(): boolean {
  if (process.platform === 'win32') {
    const startupFolder = getStartupFolder()
    const shortcutPath = path.join(startupFolder, `${APP_NAME}.lnk`)
    if (fs.existsSync(shortcutPath)) {
      return true
    }

    try {
      execSync(`schtasks /query /tn "${APP_NAME}"`, { timeout: 5000 })
      return true
    } catch {
      // 任务不存在
    }
  }

  try {
    const settings = app.getLoginItemSettings()
    return settings.openAtLogin
  } catch {
    return false
  }
}
