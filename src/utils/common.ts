import { isProxy, isRef, toRaw, toValue, unref } from "vue"
import moment from 'moment';

// 数据表名称
export const pomodoroStatusTable = 'pomodoro_status'
export const basicInfoTable = 'basic_info'

function formatValue (value: any) {
  if (isRef(value)) {
    value = unref(value) 
  }
  if (isProxy(value)) {
    value = toRaw(value) 
  }
  return value
}

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
export function send(key: string, value: any, ops?: any) {
  window.ipcRenderer.send(key, value, ops)
}

// 发送异步数据，参数是key: string, ...args: any[]
export function sendMany(key: string, ...args: any[]) {
  window.ipcRenderer.send(key, ...args)
}

// 获取窗口配置，从 SQLite 的 basic_info 表中读取 window-mode:{windowName}
export function getWindowConfig(windowName: string): ObjectType {
  const key = `window-mode:${windowName}`;
  const config = getStore(key);
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    return config;
  }
  return {};
}

// sql
export const setSqlData = async ({
  tableName,
  data,
  config,
}: {
  tableName: string,
  data: Object,
  config?: Object,
}) => {
  const curTime = moment().format('YYYY-MM-DD HH:mm:ss')

  return window.ipcRenderer.handlePromise('set-data', {
    tableName: tableName,
    data: {
      ...formatValue(data),
      create_time: curTime,
    },
    config: config
  }).catch(err => {
    console.error(err, 'setSqlData error')
    return false
  })
}

export const getSqlData = async ({
  tableName,
  conditions,
}: {
  tableName: string,
  conditions: Object,
}) => {
  return window.ipcRenderer.handlePromise('query-data', {
    tableName: tableName,
    conditions: conditions,
  }).catch(err => {
    console.error(err, 'getSqlData error')
    return []
  })
}

export const deleteSqlData = async ({
  tableName,
  conditions,
}: {
  tableName: string,
  conditions: Object,
}) => {
  return window.ipcRenderer.handlePromise('delete-data', {
    tableName: tableName,
    condition: conditions,
  }).catch(err => {
    console.error(err, 'deleteSqlData error')
    return false
  })
}