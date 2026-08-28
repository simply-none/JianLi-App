import AutoLaunch from 'auto-launch'
import { app } from 'electron'

const APP_NAME = app.getName()
const APP_PATH = app.getPath('exe')

export interface StartupResult {
  success: boolean
  method: string
  message?: string
}

// auto-launch 单例：跨平台处理开机自启动
// - Windows：在用户启动文件夹创建 .lnk 快捷方式
// - macOS：写入 LaunchAgent（isHidden 控制启动后是否隐藏）
// - Linux：xdg 自启动项
let autoLauncher: AutoLaunch | null = null

function getAutoLauncher(): AutoLaunch {
  if (!autoLauncher) {
    autoLauncher = new AutoLaunch({
      name: APP_NAME,
      path: APP_PATH,
      isHidden: true,
    })
  }
  return autoLauncher
}

/**
 * 设置开机自启动
 * @param isStartup true=开启 false=关闭
 */
export async function setAutoStartup(isStartup: boolean): Promise<StartupResult> {
  console.log(`[AutoStartup] 设置自启动: ${isStartup}`)
  const launcher = getAutoLauncher()
  try {
    if (isStartup) {
      await launcher.enable()
    } else {
      await launcher.disable()
    }
    // 回读校验是否生效
    const enabled = await launcher.isEnabled()
    const ok = isStartup ? enabled : !enabled
    return {
      success: ok,
      method: 'auto-launch',
      message: isStartup
        ? (ok ? '已开启开机自启动' : '开启失败，请检查权限')
        : (ok ? '已关闭开机自启动' : '关闭失败，请检查权限'),
    }
  } catch (err) {
    return {
      success: false,
      method: 'auto-launch',
      message: (err as Error)?.message ?? String(err),
    }
  }
}

/**
 * 查询当前是否已开启开机自启动
 */
export async function checkAutoStartupStatus(): Promise<boolean> {
  try {
    return await getAutoLauncher().isEnabled()
  } catch {
    return false
  }
}
