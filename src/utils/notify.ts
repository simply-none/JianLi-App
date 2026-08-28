import { ElNotification } from 'element-plus'

/**
 * @param onClick 可选的点击回调（新增参数，放在最后，既有调用不受影响）。
 *                业务方可借此实现「点通知 → 打开某个窗口」，例如点打卡提醒唤出打卡小窗。
 */
export function sysNotify(title = '', bodyMsg = '', clickMsg = '', duration = 3, onClick?: () => void) {
  const NOTIFICATION_TITLE = title
  const NOTIFICATION_BODY = bodyMsg
  const CLICK_MESSAGE = clickMsg

  const notification = new window.Notification(NOTIFICATION_TITLE, { body: NOTIFICATION_BODY, requireInteraction: true })
  notification.onclick = () => {
    const output = document.getElementById('output')
    if (output) output.innerText = CLICK_MESSAGE
    onClick?.()
  }

  // 默认展示 3 秒后自动关闭；传入合法秒数则按传参展示（<=0 时回退到 10s）
  const seconds = Number(duration) > 0 ? Number(duration) : 3
  setTimeout(() => {
    notification.close()
  }, seconds * 1000)
}

/** @param onClick 可选的点击回调（新增参数，放在最后，既有调用不受影响） */
export function appNotify(title = '', bodyMsg = '', duration = 3000, onClick?: () => void) {
  ElNotification({
    title: title,
    message: bodyMsg,
    position: 'bottom-right',
    duration: duration || 3000,
    onClick,
  })
}