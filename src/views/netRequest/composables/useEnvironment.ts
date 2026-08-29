/**
 * 网络请求工作台 - 环境变量管理
 * ------------------------------------------------------------------
 * 维护多环境（dev/test/prod...）与当前激活环境，提供 {{变量名}} 占位符
 * 的全局替换能力（URL / Headers / Body 均生效）。
 * 数据持久化走 db.ts 的 net_request_env 表。
 */

import { computed, ref } from 'vue'
import type { Environment, EnvVar } from '../types'
import { activateEnv, deleteEnv, listEnvs, saveEnv } from '../db'

/** 全部环境列表（激活环境排最前） */
const envs = ref<Environment[]>([])

/** 是否已加载过（避免重复请求） */
let loaded = false

/** 当前激活环境（可能为空 = 不使用环境变量） */
const activeEnv = computed<Environment | null>(() => {
  return envs.value.find((e) => e.isActive) || null
})

/**
 * 生成前端唯一 id（键值行/变量行通用）
 * @returns 随机 id 字符串
 */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/**
 * 创建一个启用的键值对行
 * @param key 参数名
 * @param value 参数值
 * @returns 键值对行对象
 */
export function createKv(key = '', value = '') {
  return { id: uid(), key, value, enabled: true }
}

/**
 * 从数据库加载环境列表（进程内仅加载一次，后续操作后手动刷新）
 */
export async function loadEnvs(): Promise<void> {
  if (loaded) return
  envs.value = await listEnvs()
  loaded = true
}

/**
 * 强制重新加载环境列表（保存/删除/切换后调用）
 */
export async function refreshEnvs(): Promise<void> {
  envs.value = await listEnvs()
  loaded = true
}

/**
 * {{变量名}} 占位符替换：用当前激活环境的启用变量替换文本中的占位符
 * @param text 原始文本（可为任意内容：URL / Header 值 / Body）
 * @returns 替换后的文本（无激活环境或无命中时原样返回）
 */
export function replaceVars(text: string): string {
  if (!text || !activeEnv.value) return text
  return String(text).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key: string) => {
    const found = activeEnv.value!.vars.find(
      (v) => v.enabled && v.key.trim() === key.trim()
    )
    return found ? found.value : match
  })
}

/**
 * 读取当前激活环境的变量值
 * @param key 变量名
 * @returns 变量值（未命中返回空串）
 */
export function getEnvVar(key: string): string {
  const found = activeEnv.value?.vars.find((v) => v.enabled && v.key.trim() === key.trim())
  return found ? found.value : ''
}

/**
 * 写入变量到当前激活环境（变量不存在时追加；无激活环境时忽略）
 * 修改后自动落库
 * @param key 变量名
 * @param value 变量值
 */
export async function setEnvVar(key: string, value: string): Promise<void> {
  if (!activeEnv.value) return
  const env = activeEnv.value
  const found = env.vars.find((v) => v.key.trim() === key.trim())
  if (found) {
    found.value = value
  } else {
    const item: EnvVar = { id: uid(), key, value, enabled: true }
    env.vars.push(item)
  }
  await saveEnv(env)
  await refreshEnvs()
}

/**
 * 激活指定环境（幂等落库后刷新）
 * @param id 环境 id
 */
export async function setActiveEnv(id: number): Promise<void> {
  await activateEnv(id)
  await refreshEnvs()
}

/**
 * 保存环境（新增或更新），成功后刷新列表
 * @param env 环境对象
 * @returns 成功返回 true，失败返回 false
 */
export async function saveEnvironment(env: Environment): Promise<boolean> {
  try {
    await saveEnv(env)
    await refreshEnvs()
    return true
  } catch (err) {
    console.error('保存环境失败：', err)
    return false
  }
}

/**
 * 删除环境，成功后刷新列表
 * @param id 环境 id
 */
export async function removeEnvironment(id: number): Promise<void> {
  await deleteEnv(id)
  await refreshEnvs()
}

/**
 * 导出环境列表的只读引用（供组件渲染）
 * @returns 环境列表 ref
 */
export function useEnvList() {
  return envs
}
