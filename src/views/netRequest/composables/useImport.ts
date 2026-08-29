/**
 * 网络请求工作台 - 导入解析
 * ------------------------------------------------------------------
 * 支持将外部格式解析为可导入的集合节点 / 请求配置：
 * 1. cURL 命令文本          → 单个 RequestConfig
 * 2. Postman Collection v2.1 JSON → 集合节点树（含文件夹层级）
 * 3. Postman Environment JSON    → 环境变量对象
 * 4. OpenAPI 3.0 / Swagger 2.0 JSON → 集合节点树（按路径分组）
 *
 * YAML 格式不支持（需先在 Postman/编辑器中导出为 JSON）。
 */

import type { CollectionNode, Environment, FormDataRow, RequestConfig } from '../types'
import { createEmptyConfig } from './useRequest'
import { createKv, uid } from './useEnvironment'

/* ------------------------------------------------------------------ */
/* cURL 解析                                                           */
/* ------------------------------------------------------------------ */

/**
 * 按 shell 规则粗略分词（尊重单双引号，支持引号内空格）
 * @param input cURL 命令文本
 * @returns token 数组（引号已剥离）
 */
function tokenize(input: string): string[] {
  const tokens: string[] = []
  let cur = ''
  let quote: string | null = null
  for (const ch of input) {
    if (quote) {
      if (ch === quote) {
        quote = null
      } else {
        cur += ch
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === ' ' || ch === '\t' || ch === '\n') {
      if (cur) {
        tokens.push(cur)
        cur = ''
      }
    } else {
      cur += ch
    }
  }
  if (cur) tokens.push(cur)
  return tokens
}

/**
 * 解析 cURL 命令为请求配置
 * 支持：-X/--request、-H/--header、-d/--data/--data-raw/--data-binary、
 *       -F/--form（含 @file）、--url、-u/--user（Basic 认证）
 * @param text cURL 命令文本
 * @returns 解析后的请求配置
 * @throws {Error} 无法识别出 URL 时抛出中文错误
 */
export function parseCurl(text: string): RequestConfig {
  const config = createEmptyConfig()
  const tokens = tokenize(text.trim())
  const flagsWithArg = new Set([
    '-X', '--request', '-H', '--header', '-d', '--data', '--data-raw',
    '--data-ascii', '--data-binary', '--data-urlencode', '-F', '--form',
    '--url', '-u', '--user',
  ])
  let bodyList: string[] = []
  let formList: string[] = []
  let basicAuth = ''
  let hasUrl = false

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (i === 0 && /^curl(\.exe)?$/i.test(t)) continue
    if (flagsWithArg.has(t)) {
      const value = tokens[i + 1] || ''
      i++
      switch (t) {
        case '-X':
        case '--request':
          if (value) config.method = value.toUpperCase() as RequestConfig['method']
          break
        case '-H':
        case '--header': {
          const idx = value.indexOf(':')
          if (idx > 0) {
            config.headers.push(createKv(value.slice(0, idx).trim(), value.slice(idx + 1).trim()))
          }
          break
        }
        case '-d':
        case '--data':
        case '--data-raw':
        case '--data-ascii':
        case '--data-binary':
        case '--data-urlencode':
          if (value) bodyList.push(value)
          break
        case '-F':
        case '--form':
          if (value) formList.push(value)
          break
        case '--url':
          if (value) {
            config.url = value
            hasUrl = true
          }
          break
        case '-u':
        case '--user':
          basicAuth = value
          break
      }
    } else if (!t.startsWith('-') && !hasUrl && /^https?:\/\//i.test(t)) {
      config.url = t
      hasUrl = true
    }
  }

  if (!hasUrl) {
    throw new Error('未能从 cURL 命令中识别出 URL')
  }

  // 请求体：-F 优先按 form-data，其次 -d（JSON 内容自动识别 rawType）
  if (formList.length > 0) {
    config.bodyType = 'form-data'
    config.formData = formList.map((f) => {
      const idx = f.indexOf('=')
      const key = idx > 0 ? f.slice(0, idx) : f
      const value = idx > 0 ? f.slice(idx + 1) : ''
      const row: FormDataRow = {
        ...createKv(key, value.startsWith('@') ? '' : value),
        rowType: value.startsWith('@') ? 'file' : 'text',
        filePath: value.startsWith('@') ? value.slice(1) : '',
      }
      return row
    })
  } else if (bodyList.length > 0) {
    const body = bodyList.join('&')
    config.bodyType = 'raw'
    // 识别 content-type 决定 rawType；默认 JSON
    const ct = config.headers.find((h) => h.key.toLowerCase() === 'content-type')
    const isJson = (() => {
      try {
        JSON.parse(body)
        return true
      } catch {
        return false
      }
    })()
    config.rawType = ct && /xml/i.test(ct.value) ? 'xml' : isJson ? 'json' : 'text'
    config.rawBody = body
    // curl -d 默认方法为 POST
    if (config.method === 'GET') config.method = 'POST'
  }

  // Basic 认证
  if (basicAuth) {
    config.auth.type = 'basic'
    const idx = basicAuth.indexOf(':')
    config.auth.username = idx >= 0 ? basicAuth.slice(0, idx) : basicAuth
    config.auth.password = idx >= 0 ? basicAuth.slice(idx + 1) : ''
  }
  return config
}

/* ------------------------------------------------------------------ */
/* Postman 解析                                                        */
/* ------------------------------------------------------------------ */

/**
 * 将 Postman 的 url 字段统一转为字符串（v2.1 中可能是对象）
 * @param url url 字段（字符串或 { raw, query } 对象）
 * @returns url 字符串
 */
function postmanUrlToString(url: any): string {
  if (!url) return ''
  if (typeof url === 'string') return url
  if (typeof url.raw === 'string') return url.raw
  return ''
}

/**
 * 将 Postman request 对象转为 RequestConfig
 * @param req Postman request 描述（method/header/url/body）
 * @returns 请求配置
 */
function postmanRequestToConfig(req: any): RequestConfig {
  const config = createEmptyConfig()
  config.method = (req.method || 'GET').toUpperCase() as RequestConfig['method']
  config.url = postmanUrlToString(req.url)
  // header
  if (Array.isArray(req.header)) {
    config.headers = req.header.map((h: any) => ({
      id: uid(),
      key: h.key || '',
      value: h.value || '',
      enabled: !h.disabled,
    }))
    if (config.headers.length === 0) config.headers.push(createKv())
  }
  // query 参数（url.query）
  if (req.url && Array.isArray(req.url.query)) {
    config.params = req.url.query.map((q: any) => ({
      id: uid(),
      key: q.key || '',
      value: q.value || '',
      enabled: !q.disabled,
    }))
    if (config.params.length === 0) config.params.push(createKv())
  }
  // body
  const body = req.body
  if (body) {
    if (body.mode === 'raw') {
      config.bodyType = 'raw'
      const lang = body.options?.raw?.language || 'json'
      config.rawType = ['json', 'text', 'xml', 'html'].includes(lang) ? lang : 'text'
      config.rawBody = body.raw || ''
    } else if (body.mode === 'urlencoded') {
      config.bodyType = 'x-www-form-urlencoded'
      config.urlEncoded = (body.urlencoded || []).map((r: any) => ({
        id: uid(),
        key: r.key || '',
        value: r.value || '',
        enabled: !r.disabled,
      }))
      if (config.urlEncoded.length === 0) config.urlEncoded.push(createKv())
    } else if (body.mode === 'formdata') {
      config.bodyType = 'form-data'
      config.formData = (body.formdata || []).map((r: any) => ({
        id: uid(),
        key: r.key || '',
        value: r.type === 'file' ? '' : r.value || '',
        enabled: !r.disabled,
        rowType: r.type === 'file' ? 'file' : 'text',
        filePath: r.src || '',
      }))
    }
  }
  return config
}

/**
 * 递归转换 Postman item 列表为集合节点
 * @param items Postman item 数组
 * @returns 集合节点数组
 */
function postmanItemsToNodes(items: any[]): CollectionNode[] {
  const nodes: CollectionNode[] = []
  for (const item of items || []) {
    if (item.item) {
      // 文件夹
      nodes.push({
        id: 0,
        parentId: 0,
        nodeType: 'folder',
        name: item.name || '未命名文件夹',
        method: '',
        url: '',
        config: null,
        sort: nodes.length,
        updatedAt: 0,
        children: postmanItemsToNodes(item.item),
      })
    } else if (item.request) {
      const req = typeof item.request === 'string' ? { url: item.request, method: 'GET' } : item.request
      const cfg = postmanRequestToConfig(req)
      nodes.push({
        id: 0,
        parentId: 0,
        nodeType: 'request',
        name: item.name || cfg.url,
        method: cfg.method,
        url: cfg.url,
        config: cfg,
        sort: nodes.length,
        updatedAt: 0,
        children: [],
      })
    }
  }
  return nodes
}

/**
 * 解析 Postman 导出 JSON
 * 自动识别 Collection v2.1 与 Environment 两种格式
 * @param content JSON 文本
 * @returns { type: 'collection'|'environment', nodes?, environment? }
 * @throws {Error} 格式不符时抛出中文错误
 */
export function parsePostman(content: string): {
  type: 'collection' | 'environment'
  nodes?: CollectionNode[]
  environment?: Environment
} {
  let data: any
  try {
    data = JSON.parse(content)
  } catch {
    throw new Error('JSON 解析失败，请确认导出文件为 JSON 格式')
  }
  // Environment 格式：顶层有 values 数组
  if (Array.isArray(data.values)) {
    return {
      type: 'environment',
      environment: {
        id: 0,
        name: data.name || '导入的环境',
        vars: (data.values || []).map((v: any) => ({
          id: uid(),
          key: v.key || '',
          value: v.value || '',
          enabled: v.enabled !== false,
        })),
        isActive: false,
        updatedAt: 0,
      },
    }
  }
  // Collection 格式：顶层有 item 数组
  if (Array.isArray(data.item)) {
    return { type: 'collection', nodes: postmanItemsToNodes(data.item) }
  }
  throw new Error('无法识别的 Postman 导出格式（需 Collection v2.1 或 Environment JSON）')
}

/* ------------------------------------------------------------------ */
/* OpenAPI / Swagger 解析                                              */
/* ------------------------------------------------------------------ */

/**
 * 根据 JSON Schema 生成示例值（递归，优先 required 字段）
 * @param schema JSON Schema 片段
 * @returns 示例值
 */
function sampleFromSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return null
  if (schema.example !== undefined) return schema.example
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0]
  switch (schema.type) {
    case 'object': {
      const out: any = {}
      const props = schema.properties || {}
      const keys = schema.required?.length ? schema.required : Object.keys(props).slice(0, 10)
      keys.forEach((k: string) => {
        if (props[k]) out[k] = sampleFromSchema(props[k])
      })
      return out
    }
    case 'array':
      return [sampleFromSchema(schema.items)]
    case 'integer':
    case 'number':
      return 0
    case 'boolean':
      return false
    default:
      return ''
  }
}

/**
 * 解析 OpenAPI 3.0 / Swagger 2.0 JSON 为集合节点树
 * 每个接口路径生成一个文件夹，其下为各方法的请求
 * @param content JSON 文本
 * @returns { name, nodes }
 * @throws {Error} 无 paths 字段时抛出中文错误
 */
export function parseOpenApi(content: string): { name: string; nodes: CollectionNode[] } {
  let data: any
  try {
    data = JSON.parse(content)
  } catch {
    throw new Error('JSON 解析失败，请确认导出文件为 JSON 格式（YAML 请先转为 JSON）')
  }
  if (!data.paths || typeof data.paths !== 'object') {
    throw new Error('无法识别的 OpenAPI/Swagger 格式（缺少 paths 字段）')
  }
  const METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options']
  const nodes: CollectionNode[] = []
  Object.entries(data.paths).forEach(([path, pathItem]: [string, any]) => {
    const children: CollectionNode[] = []
    METHODS.forEach((m) => {
      const op = pathItem[m]
      if (!op) return
      const cfg = createEmptyConfig()
      cfg.method = m.toUpperCase() as RequestConfig['method']
      cfg.url = path
      const params = createKv()
      const headers = createKv()
      let hasParam = false
      let hasHeader = false
      // OpenAPI 3：parameters + requestBody；Swagger 2：parameters（in: body 为 body）
      for (const p of op.parameters || []) {
        if (p.in === 'query') {
          cfg.params.push({ id: uid(), key: p.name, value: '', enabled: true })
          hasParam = true
        } else if (p.in === 'header') {
          cfg.headers.push({ id: uid(), key: p.name, value: '', enabled: true })
          hasHeader = true
        } else if (p.in === 'body' && p.schema) {
          cfg.bodyType = 'raw'
          cfg.rawType = 'json'
          cfg.rawBody = JSON.stringify(sampleFromSchema(p.schema), null, 2)
        } else if (p.in === 'formData') {
          cfg.bodyType = 'x-www-form-urlencoded'
          cfg.urlEncoded.push({ id: uid(), key: p.name, value: '', enabled: true })
        }
      }
      if (op.requestBody?.content?.['application/json']?.schema) {
        cfg.bodyType = 'raw'
        cfg.rawType = 'json'
        cfg.rawBody = JSON.stringify(
          sampleFromSchema(op.requestBody.content['application/json'].schema),
          null,
          2
        )
      }
      if (!hasParam) cfg.params = [params]
      if (!hasHeader) cfg.headers = [headers]
      children.push({
        id: 0,
        parentId: 0,
        nodeType: 'request',
        name: op.summary || `${m.toUpperCase()} ${path}`,
        method: cfg.method,
        url: cfg.url,
        config: cfg,
        sort: children.length,
        updatedAt: 0,
        children: [],
      })
    })
    if (children.length) {
      nodes.push({
        id: 0,
        parentId: 0,
        nodeType: 'folder',
        name: path,
        method: '',
        url: '',
        config: null,
        sort: nodes.length,
        updatedAt: 0,
        children,
      })
    }
  })
  return { name: data.info?.title || 'OpenAPI 导入', nodes }
}
