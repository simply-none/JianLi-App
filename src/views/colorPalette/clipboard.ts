/**
 * 调色板工具 - 复制工具
 *
 * 统一封装剪贴板写入 + Element Plus 轻提示，组件内复制均走这里。
 */
import { ElMessage } from 'element-plus'

/** 复制文本到剪贴板，失败回退到 execCommand */
export async function copyText(text: string, tip = '已复制'): Promise<void> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    ElMessage.success(`${tip}：${text}`)
  } catch (e) {
    ElMessage.error('复制失败')
  }
}
