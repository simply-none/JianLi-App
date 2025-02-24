

// 从store中获取数据
export function getStore(key: string) {
  return window.ipcRenderer.sendSync('get-store', key)
}

// 设置store中的数据
export function setStore(key: 'multi-field' | string, value: any) {
  window.ipcRenderer.sendSync('set-store', key, value)
}

// 发送同步数据
export function sendSync(key: string, value: any) {
  return window.ipcRenderer.sendSync(key, value) 
}

// 发送异步数据
export function send(key: string, value: any) {
  window.ipcRenderer.send(key, value)
}