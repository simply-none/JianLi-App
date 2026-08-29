/**
 * 调试日志组合式函数
 * 提供日志记录、清空、落盘能力，供调试面板展示
 */
import { ref } from 'vue'
import type { DebugLog } from '../types'

/**
 * 创建调试日志控制器
 * @returns 日志列表与操作方法
 */
export function useDebugLog() {
  /** 日志列表（按时间正序追加） */
  const logs = ref<DebugLog[]>([])

  /**
   * 追加一条调试日志
   * @param message 日志内容
   * @param type 日志级别，默认 info
   */
  function addLog(message: string, type: DebugLog['type'] = 'info') {
    const time = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    logs.value.push({ time, type, message })
  }

  /** 清空全部日志 */
  function clearLogs() {
    logs.value = []
  }

  /**
   * 将当前调试数据落盘保存（通过主进程 save-debug-data 通道）
   * @param city 当前城市名（用于生成文件名）
   * @param extra 附加数据（天气原始数据、定位信息等）
   * @returns 保存成功返回文件路径，失败返回 null
   */
  async function saveToFile(city: string, extra: Record<string, unknown>): Promise<string | null> {
    try {
      const result = await window.ipcRenderer.invoke('save-debug-data', {
        data: { city, ...extra, logs: logs.value, timestamp: Date.now() },
        fileName: `weather_debug_${city}`.replace(/[\s/\\:*?"<>|]/g, '_'),
      })
      if (result?.success) {
        addLog(`调试数据已保存: ${result.filePath}`, 'success')
        return result.filePath as string
      }
      addLog(`保存失败: ${result?.error || '未知错误'}`, 'error')
      return null
    } catch (error) {
      addLog(`保存异常: ${(error as Error).message}`, 'error')
      return null
    }
  }

  return { logs, addLog, clearLogs, saveToFile }
}
