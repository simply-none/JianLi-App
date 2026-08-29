/**
 * 网络请求工作台 - 请求发送
 * ------------------------------------------------------------------
 * 职责：
 * 1. 将 RequestConfig 组装为主进程 net-request:send 需要的载荷
 *    （应用认证、环境变量 {{var}} 替换、行禁用过滤）
 * 2. 发送请求并接收完整响应元数据（状态码/耗时/大小/响应头/响应体）
 * 3. 执行前置脚本（可修改最终 URL/Headers、读写环境变量）
 *    与后置脚本（断言收集，结果展示在脚本页签）
 * 4. 提供「复制为 cURL」能力
 */

import { ref } from 'vue'
import type { KeyValueItem, RequestConfig, ResponseRecord, TestResult } from '../types'
import { getEnvVar, replaceVars, setEnvVar } from './useEnvironment'
import { createKv, uid } from './useEnvironment'

/** 是否正在请求中 */
const loading = ref(false)

/** 最近一次响应记录（null = 尚未发送） */
const response = ref<ResponseRecord | null>(null)

/** 最近一次后置脚本的断言结果 */
const testResults = ref<TestResult[]>([])

/** 最近一次请求使用的最终配置快照（复制 cURL / 保存历史用） */
let lastFinalConfig: RequestConfig | null = null

/**
 * 过滤出启用行的键值对列表
 * @param items 键值对行数组
 * @returns 启用行组成的数组
 */
function enabledItems(items: KeyValueItem[]): KeyValueItem[] {
  return (items || []).filter((i) => i.enabled && i.key.trim() !== '')
}

/**
 * 键值对行数组 → 键值对象（值均做 {{var}} 替换）
 * @param items 键值对行数组
 * @returns 键值对象
 */
function kvToObject(items: KeyValueItem[]): Record<string, string> {
  const out: Record<string, string> = {}
  enabledItems(items).forEach((i) => {
    out[replaceVars(i.key)] = replaceVars(i.value)
  })
  return out
}

/**
 * 应用认证配置：将 AuthTab 中的认证信息合并进 headers / params
 * @param config 请求配置
 * @param headers 已组装的请求头对象（就地追加）
 * @param params 已组装的查询参数对象（就地追加）
 */
function applyAuth(
  config: RequestConfig,
  headers: Record<string, string>,
  params: Record<string, string>
): void {
  const auth = config.auth
  if (!auth || auth.type === 'none') return
  if (auth.type === 'bearer' && auth.token) {
    headers['Authorization'] = `Bearer ${replaceVars(auth.token)}`
  } else if (auth.type === 'basic' && (auth.username || auth.password)) {
    const raw = `${replaceVars(auth.username)}:${replaceVars(auth.password)}`
    // btoa 对非 ASCII 会抛错，用 encode 转换兜底
    try {
      headers['Authorization'] = `Basic ${btoa(unescape(encodeURIComponent(raw)))}`
    } catch {
      headers['Authorization'] = `Basic ${btoa(raw)}`
    }
  } else if (auth.type === 'api-key' && auth.apiKeyName && auth.apiKeyValue) {
    if (auth.apiKeyIn === 'header') {
      headers[replaceVars(auth.apiKeyName)] = replaceVars(auth.apiKeyValue)
    } else {
      params[replaceVars(auth.apiKeyName)] = replaceVars(auth.apiKeyValue)
    }
  }
}

/**
 * 执行前置脚本
 * @param script 脚本文本（空脚本直接跳过）
 * @param request 可变请求对象 { url, method, headers, params }，脚本内修改即时生效
 * @returns 执行失败返回错误信息，成功返回 null
 */
async function runPreScript(
  script: string,
  request: { url: string; method: string; headers: Record<string, string>; params: Record<string, string> }
): Promise<string | null> {
  if (!script || !script.trim()) return null
  try {
    const fn = new Function(
      '$env',
      '$request',
      `"use strict";\n${script}`
    )
    fn(
      {
        get: getEnvVar,
        set: (k: string, v: string) => setEnvVar(k, v),
        replace: replaceVars,
      },
      request
    )
    return null
  } catch (err: any) {
    return `前置脚本执行失败：${err?.message || err}`
  }
}

/**
 * 执行后置脚本（断言）
 * @param script 脚本文本（空脚本直接跳过）
 * @param res 响应记录
 * @returns 断言结果数组（脚本抛错时返回一条失败项）
 */
async function runPostScript(script: string, res: ResponseRecord): Promise<TestResult[]> {
  if (!script || !script.trim()) return []
  const results: TestResult[] = []
  try {
    const fn = new Function(
      '$response',
      '$test',
      `"use strict";\n${script}`
    )
    fn(
      {
        status: res.status,
        headers: res.headers,
        body: res.body,
        time: res.time,
      },
      (name: string, passed: boolean, message = '') => {
        results.push({ name, passed: !!passed, message: passed ? '' : message })
      }
    )
  } catch (err: any) {
    results.push({ name: '脚本执行', passed: false, message: err?.message || String(err) })
  }
  return results
}

/**
 * 发送请求（完整流水线：前置脚本 → 组装载荷 → IPC 发送 → 后置脚本 → 写历史）
 * @param config 请求配置
 * @param onDone 请求完成回调（无论成功失败，用于写历史等副作用；失败时 meta.status=0）
 * @returns 响应记录（发送失败时 status=0 且 error 非空）
 */
export async function sendRequest(
  config: RequestConfig,
  onDone?: (res: ResponseRecord, config: RequestConfig) => void
): Promise<ResponseRecord | null> {
  if (loading.value) return null
  loading.value = true
  testResults.value = []
  try {
    // 1. 组装最终请求对象（认证 + 变量替换）
    const headers = kvToObject(config.headers)
    const params = kvToObject(config.params)
    applyAuth(config, headers, params)
    const request = {
      url: replaceVars(config.url),
      method: config.method,
      headers,
      params,
    }

    // 2. 前置脚本（可能修改 url/headers/params 或环境变量）
    const preErr = await runPreScript(config.scripts?.pre || '', request)
    if (preErr) {
      response.value = makeErrorResponse(request.url, preErr)
      return response.value
    }

    // 3. 组装主进程载荷
    const payload: any = {
      url: request.url,
      method: request.method,
      headers: request.headers,
      params: request.params,
      bodyType: config.bodyType || 'none',
      rawType: config.rawType,
      rawBody: replaceVars(config.rawBody || ''),
      urlEncoded: kvToObject(config.urlEncoded || []),
      formData: (config.formData || [])
        .filter((r) => r.enabled && r.key.trim() !== '')
        .map((r) => ({
          type: r.rowType,
          key: replaceVars(r.key),
          value: replaceVars(r.value || ''),
          filePath: r.filePath || '',
        })),
      binaryFilePath: config.binaryFilePath || '',
      timeout: config.settings?.timeout || 30000,
      followRedirects: config.settings?.followRedirects !== false,
      validateSsl: config.settings?.validateSsl !== false,
    }

    // 4. 发送
    const res = await window.ipcRenderer.handlePromise('net-request:send', payload)
    let record: ResponseRecord
    if (res && res.success) {
      record = {
        status: res.data.status,
        statusText: res.data.statusText,
        time: res.data.time,
        size: res.data.size,
        headers: res.data.headers || {},
        body: res.data.body,
        contentType: res.data.contentType || '',
        isJson: res.data.body !== null && typeof res.data.body === 'object',
        error: '',
        requestUrl: request.url,
        createdAt: Date.now(),
      }
    } else {
      record = makeErrorResponse(
        request.url,
        (res && res.error && res.error.message) || '请求失败',
        (res && res.error && res.error.code) || ''
      )
    }
    response.value = record
    lastFinalConfig = JSON.parse(JSON.stringify(config))

    // 5. 后置脚本断言
    testResults.value = await runPostScript(config.scripts?.post || '', record)

    // 6. 副作用回调（历史记录等）
    onDone?.(record, config)
    return record
  } finally {
    loading.value = false
  }
}

/**
 * 构造失败响应记录（网络错误 / 脚本错误统一形态）
 * @param url 请求地址
 * @param message 错误信息
 * @param code 错误码（如 ECONNREFUSED）
 * @returns 失败形态的响应记录
 */
function makeErrorResponse(url: string, message: string, code = ''): ResponseRecord {
  return {
    status: 0,
    statusText: code ? `${message} (${code})` : message,
    time: 0,
    size: 0,
    headers: {},
    body: message,
    contentType: '',
    isJson: false,
    error: message,
    requestUrl: url,
    createdAt: Date.now(),
  }
}

/**
 * 生成请求对应的 cURL 命令（基于最近一次实际发送的配置）
 * @returns cURL 字符串（尚未发送过时返回空串）
 */
export function copyAsCurl(config?: RequestConfig): string {
  const cfg = config || lastFinalConfig
  if (!cfg) return ''
  const headers = kvToObject(cfg.headers)
  const parts: string[] = [`curl -X ${cfg.method}`]
  Object.entries(headers).forEach(([k, v]) => {
    parts.push(`-H "${k}: ${v.replace(/"/g, '\\"')}"`)
  })
  if (cfg.bodyType === 'raw' && cfg.rawBody) {
    parts.push(`-d '${cfg.rawBody.replace(/'/g, "'\\''")}'`)
  } else if (cfg.bodyType === 'x-www-form-urlencoded') {
    const data = kvToObject(cfg.urlEncoded || [])
    const qs = Object.entries(data)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
    if (qs) parts.push(`-d '${qs}'`)
  } else if (cfg.bodyType === 'form-data') {
    enabledItems(cfg.formData || []).forEach((r: any) => {
      if (r.rowType === 'file' && r.filePath) {
        parts.push(`-F "${r.key}=@${r.filePath}"`)
      } else {
        parts.push(`-F "${r.key}=${r.value || ''}"`)
      }
    })
  }
  const url = replaceVars(cfg.url)
  parts.push(`"${url}"`)
  return parts.join(' ')
}

/**
 * 导出请求发送相关的响应式状态（供组件使用）
 * @returns { loading, response, testResults }
 */
export function useRequestState() {
  return { loading, response, testResults }
}

/**
 * 创建一份全新的空白请求配置
 * @returns 默认请求配置
 */
export function createEmptyConfig(): RequestConfig {
  return {
    method: 'GET',
    url: '',
    params: [createKv()],
    headers: [createKv()],
    bodyType: 'none',
    rawType: 'json',
    rawBody: '',
    formData: [],
    urlEncoded: [createKv()],
    binaryFilePath: '',
    auth: {
      type: 'none',
      token: '',
      username: '',
      password: '',
      apiKeyName: '',
      apiKeyValue: '',
      apiKeyIn: 'header',
    },
    settings: { timeout: 30000, followRedirects: true, validateSsl: true },
    scripts: { pre: '', post: '' },
  }
}
