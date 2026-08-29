/**
 * 网络请求工作台 - 导出
 * ------------------------------------------------------------------
 * 把集合树 / 环境变量导出为主流工具可识别的格式（与 useImport 的导入闭环对称）：
 * 1. Postman Collection v2.1（集合 → Postman 可直接导入）
 * 2. OpenAPI 3.0（集合 → Swagger/Apifox 等工具）
 * 3. Postman Environment v2.1（环境变量 → Postman）
 */

import type { CollectionNode, Environment, FormDataRow, RequestConfig } from '../types'

/**
 * 键值行 → Postman header 数组（过滤禁用行与空键）
 * @param items 键值行
 * @returns Postman header 数组
 */
function toPostmanHeaders(items: RequestConfig['headers']): Array<{ key: string; value: string }> {
  return (items || [])
    .filter((i) => i.enabled && i.key.trim() !== '')
    .map((i) => ({ key: i.key, value: i.value }))
}

/**
 * 键值行 → Postman query 数组
 * @param items 键值行
 * @returns Postman query 数组
 */
function toPostmanQuery(items: RequestConfig['params']): Array<{ key: string; value: string }> {
  return (items || [])
    .filter((i) => i.enabled && i.key.trim() !== '')
    .map((i) => ({ key: i.key, value: i.value }))
}

/**
 * 请求配置 → Postman request 对象（v2.1）
 * @param config 请求配置
 * @returns Postman request 结构
 */
function toPostmanRequest(config: RequestConfig): Record<string, any> {
  const req: Record<string, any> = {
    method: config.method,
    header: toPostmanHeaders(config.headers),
    url: {
      raw: config.url,
      query: toPostmanQuery(config.params),
    },
  }
  // 请求体
  if (config.bodyType === 'raw' && config.rawBody) {
    req.body = {
      mode: 'raw',
      raw: config.rawBody,
      options: { raw: { language: config.rawType || 'text' } },
    }
  } else if (config.bodyType === 'x-www-form-urlencoded') {
    req.body = {
      mode: 'urlencoded',
      urlencoded: (config.urlEncoded || [])
        .filter((i) => i.enabled && i.key.trim() !== '')
        .map((i) => ({ key: i.key, value: i.value })),
    }
  } else if (config.bodyType === 'form-data') {
    req.body = {
      mode: 'formdata',
      formdata: (config.formData || [])
        .filter((r) => r.enabled && r.key.trim() !== '')
        .map((r: FormDataRow) =>
          r.rowType === 'file'
            ? { key: r.key, type: 'file', src: r.filePath || '' }
            : { key: r.key, value: r.value || '', type: 'text' }
        ),
    }
  } else if (config.bodyType === 'binary' && config.binaryFilePath) {
    req.body = { mode: 'file', file: { src: config.binaryFilePath } }
  }
  // 认证
  const auth = config.auth
  if (auth?.type === 'bearer' && auth.token) {
    req.auth = { type: 'bearer', bearer: [{ key: 'token', value: auth.token }] }
  } else if (auth?.type === 'basic') {
    req.auth = {
      type: 'basic',
      basic: [
        { key: 'username', value: auth.username },
        { key: 'password', value: auth.password },
      ],
    }
  } else if (auth?.type === 'api-key' && auth.apiKeyName) {
    req.auth = {
      type: 'apikey',
      apikey: [
        { key: 'key', value: auth.apiKeyName },
        { key: 'value', value: auth.apiKeyValue },
        { key: 'in', value: auth.apiKeyIn === 'query' ? 'query' : 'header' },
      ],
    }
  }
  return req
}

/**
 * 集合树节点 → Postman item（递归：文件夹 → 含子 item）
 * @param nodes 集合节点
 * @returns Postman item 数组
 */
function toPostmanItems(nodes: CollectionNode[]): any[] {
  return nodes.map((node) => {
    if (node.nodeType === 'folder') {
      return { name: node.name, item: toPostmanItems(node.children || []) }
    }
    return {
      name: node.name,
      request: node.config ? toPostmanRequest(node.config) : { method: node.method, url: node.url },
    }
  })
}

/**
 * 导出集合为 Postman Collection v2.1 JSON 字符串
 * @param tree 集合树
 * @returns 格式化 JSON 字符串
 */
export function buildPostmanCollection(tree: CollectionNode[]): string {
  const collection = {
    info: {
      name: 'NetRequest Collection',
      _postman_id: `nr-${Date.now()}`,
      description: '由渐离App网络请求工作台导出',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: toPostmanItems(tree),
  }
  return JSON.stringify(collection, null, 2)
}

/**
 * 集合树 → OpenAPI paths（递归收集请求节点）
 * @param nodes 集合节点
 * @param paths 累积的 paths 对象
 */
function toOpenApiPaths(nodes: CollectionNode[], paths: Record<string, any>): void {
  for (const node of nodes) {
    if (node.nodeType === 'folder') {
      toOpenApiPaths(node.children || [], paths)
      continue
    }
    const config = node.config
    if (!config) continue
    // URL 拆分：origin 作 server，路径作 key；无路径时退化为根
    let pathKey = '/'
    let origin = ''
    try {
      const u = new URL(config.url)
      origin = u.origin
      pathKey = u.pathname || '/'
    } catch {
      // 非法 URL：保留原始串
      pathKey = config.url || '/'
    }
    const params = (config.params || [])
      .filter((i) => i.enabled && i.key.trim() !== '')
      .map((i) => ({ name: i.key, in: 'query', schema: { type: 'string' }, example: i.value }))
    const headerParams = (config.headers || [])
      .filter((i) => i.enabled && i.key.trim() !== '')
      .map((i) => ({ name: i.key, in: 'header', schema: { type: 'string' }, example: i.value }))
    const op: Record<string, any> = {
      summary: node.name,
      tags: undefined,
      parameters: [...params, ...headerParams],
      responses: { '200': { description: '成功' } },
    }
    // 请求体
    if (config.bodyType === 'raw' && config.rawBody) {
      const lang = config.rawType || 'text'
      const mime = lang === 'json' ? 'application/json' : 'text/plain'
      let schemaBody: any = {}
      if (lang === 'json') {
        try {
          schemaBody = JSON.parse(config.rawBody)
        } catch {
          schemaBody = {}
        }
      }
      op.requestBody = {
        content: { [mime]: { schema: { type: 'object' }, example: schemaBody } },
      }
    } else if (config.bodyType === 'x-www-form-urlencoded') {
      const props: Record<string, any> = {}
      ;(config.urlEncoded || [])
        .filter((i) => i.enabled && i.key.trim() !== '')
        .forEach((i) => (props[i.key] = { type: 'string', example: i.value }))
      op.requestBody = {
        content: { 'application/x-www-form-urlencoded': { schema: { type: 'object', properties: props } } },
      }
    } else if (config.bodyType === 'form-data') {
      const props: Record<string, any> = {}
      ;(config.formData || [])
        .filter((r) => r.enabled && r.key.trim() !== '')
        .forEach((r) => (props[r.key] = { type: r.rowType === 'file' ? 'string' : 'string', format: r.rowType === 'file' ? 'binary' : undefined }))
      op.requestBody = {
        content: { 'multipart/form-data': { schema: { type: 'object', properties: props } } },
      }
    }
    paths[pathKey] = { ...(paths[pathKey] || {}), [config.method.toLowerCase()]: op }
    // 记录 server（首个出现的 origin）
    if (origin) {
      op.servers = [{ url: origin }]
    }
  }
}

/**
 * 导出集合为 OpenAPI 3.0 JSON 字符串
 * @param tree 集合树
 * @returns 格式化 JSON 字符串
 */
export function buildOpenApi(tree: CollectionNode[]): string {
  const paths: Record<string, any> = {}
  toOpenApiPaths(tree, paths)
  const doc = {
    openapi: '3.0.3',
    info: { title: 'NetRequest Collection', version: '1.0.0' },
    servers: [] as Array<{ url: string }>,
    paths,
  }
  // 删除空 tags 字段（toOpenApiPaths 里为了结构简洁预置了 undefined）
  Object.values(paths).forEach((ops: any) => {
    Object.values(ops).forEach((op: any) => {
      if (Array.isArray(op.parameters) && !op.parameters.length) delete op.parameters
      if (!op.servers?.length) delete op.servers
    })
  })
  return JSON.stringify(doc, null, 2)
}

/**
 * 导出环境变量为 Postman Environment v2.1 JSON 字符串
 * @param envs 环境数组（全部导出；单个环境传入单元素数组）
 * @returns 格式化 JSON 字符串
 */
export function buildPostmanEnvironments(envs: Environment[]): string {
  const list = envs.map((env) => ({
    name: env.name,
    _postman_variable_scope: 'environment',
    values: (env.vars || []).map((v) => ({
      key: v.key,
      value: v.value,
      enabled: v.enabled !== false,
    })),
  }))
  return JSON.stringify(list.length === 1 ? list[0] : list, null, 2)
}
