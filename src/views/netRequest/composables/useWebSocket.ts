/**
 * 网络请求工作台 - WebSocket 调试
 * ------------------------------------------------------------------
 * 管理单条 WebSocket 连接的生命周期与消息时间线：
 * 连接 / 断开 / 发送 / 收发消息展示 / 清空。
 * 连接由主进程维护（net-request:ws-*），事件经 net-request:ws-event 推送。
 */

import { onBeforeUnmount, ref } from 'vue'
import type { WsMessageItem } from '../types'
import { uid } from './useEnvironment'

/** 连接地址（ws:// 或 wss://） */
const wsUrl = ref('')

/** 连接状态：closed=未连接，connecting=连接中，open=已连接 */
const wsStatus = ref<'closed' | 'connecting' | 'open'>('closed')

/** 消息时间线（收/发/状态混排，最新在后） */
const wsMessages = ref<WsMessageItem[]>([])

/** 本次连接标识（主进程实例表 key） */
let connectionId = ''

/** 事件监听是否已挂载（避免重复注册） */
let listenerBound = false

/**
 * 挂载主进程 ws 事件监听（模块级一次性）
 */
function bindListener(): void {
  if (listenerBound) return
  listenerBound = true
  window.ipcRenderer.on('net-request:ws-event', (event: any, payload: any) => {
    if (!connectionId || payload.id !== connectionId) return
    if (payload.type === 'open') {
      wsStatus.value = 'open'
      wsMessages.value.push({ id: uid(), direction: 'sys', data: '已连接', time: payload.time })
    } else if (payload.type === 'message') {
      wsMessages.value.push({ id: uid(), direction: 'in', data: payload.data, time: payload.time })
    } else if (payload.type === 'send') {
      wsMessages.value.push({ id: uid(), direction: 'out', data: payload.data, time: payload.time })
    } else if (payload.type === 'close') {
      wsStatus.value = 'closed'
      wsMessages.value.push({ id: uid(), direction: 'sys', data: `连接已关闭 ${payload.data || ''}`, time: payload.time })
    } else if (payload.type === 'error') {
      wsMessages.value.push({ id: uid(), direction: 'sys', data: payload.data || '连接错误', time: payload.time })
    }
  })
}

/**
 * 建立 WebSocket 连接
 * @returns 失败返回错误信息，成功/连接中返回 null
 */
export async function connectWs(): Promise<string | null> {
  if (!wsUrl.value.trim()) return '请输入 ws:// 或 wss:// 地址'
  bindListener()
  connectionId = uid()
  wsStatus.value = 'connecting'
  wsMessages.value.push({
    id: uid(),
    direction: 'sys',
    data: `正在连接 ${wsUrl.value}`,
    time: Date.now(),
  })
  const res = await window.ipcRenderer.handlePromise('net-request:ws-open', {
    id: connectionId,
    url: wsUrl.value.trim(),
  })
  if (!res || !res.success) {
    wsStatus.value = 'closed'
    const msg = res?.message || '连接失败'
    wsMessages.value.push({ id: uid(), direction: 'sys', data: msg, time: Date.now() })
    return msg
  }
  return null
}

/**
 * 发送文本消息
 * @param data 文本内容
 * @returns 失败返回错误信息，成功返回 null
 */
export async function sendWsMessage(data: string): Promise<string | null> {
  if (!data) return '消息内容不能为空'
  const res = await window.ipcRenderer.handlePromise('net-request:ws-send', {
    id: connectionId,
    data,
  })
  if (!res || !res.success) {
    return res?.message || '发送失败'
  }
  return null
}

/**
 * 断开连接
 */
export async function disconnectWs(): Promise<void> {
  if (!connectionId) return
  await window.ipcRenderer.handlePromise('net-request:ws-close', { id: connectionId })
}

/**
 * 清空消息时间线
 */
export function clearWsMessages(): void {
  wsMessages.value = []
}

/**
 * 导出 WebSocket 相关状态（供 WsPanel 使用）
 * @returns { wsUrl, wsStatus, wsMessages }
 */
export function useWsState() {
  return { wsUrl, wsStatus, wsMessages }
}

/**
 * 组件卸载时自动断开连接（在页面组件中调用）
 */
export function useWsAutoClose(): void {
  onBeforeUnmount(() => {
    disconnectWs()
  })
}
