import { ElNotification } from 'element-plus'

export function sysNotify(title = '', bodyMsg = '', clickMsg = '', duration = 10) {
  const NOTIFICATION_TITLE = title
  const NOTIFICATION_BODY = bodyMsg
  const CLICK_MESSAGE = clickMsg

  const notification = new window.Notification(NOTIFICATION_TITLE, { body: NOTIFICATION_BODY, requireInteraction: true })
  notification.onclick = () => {
    const output = document.getElementById('output')
    if (output) output.innerText = CLICK_MESSAGE
  }

  // 默认展示 10 秒后自动关闭；传入合法秒数则按传参展示（<=0 时回退到 10s）
  const seconds = Number(duration) > 0 ? Number(duration) : 10
  setTimeout(() => {
    notification.close()
  }, seconds * 1000)
}

export function appNotify(title = '', bodyMsg = '', duration = 3000) {
  ElNotification({
    title: title,
    message: bodyMsg,
    position: 'bottom-right',
    duration: duration || 3000,
  })

}