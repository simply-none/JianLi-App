import { isProxy, isRef, toRaw, toValue, unref } from "vue"

// 从store中获取数据
export function getStore(key: string) {
  return window.ipcRenderer.sendSync('get-store', key)
}

// 设置store中的数据，其中value的值必须正确
export function setStore(key: 'multi-field' | string, value: any) {
  console.log(isRef(value), 'isRef(value)')
  if (isRef(value)) {
    value = unref(value) 
  }
  console.log(isProxy(value), 'isProxy(value)')
  if (isProxy(value)) {
    value = toRaw(value) 
  }
  console.log('设置store中的数据', key, value)

  window.ipcRenderer.sendSync('set-store', key, value)
}

// 发送同步数据
export function sendSync(key: string, value: any) {
  console.log('发送同步数据', key, value)
  return window.ipcRenderer.sendSync(key, value) 
}

// 发送异步数据
export function send(key: string, value: any) {
  window.ipcRenderer.send(key, value)
}