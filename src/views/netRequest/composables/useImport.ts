/**
 * 网络请求工作台 - 导入解析
 * ------------------------------------------------------------------
 * 支持将外部格式解析为可导入的集合节点 / 请求配置：
 * 1. cURL 命令文本（bash / cmd 两种风格） → 单个 RequestConfig
 * 2. fetch 代码（浏览器 / Node.js）       → 单个 RequestConfig
 * 3. PowerShell（Invoke-RestMethod 等）   → 单个 RequestConfig
 * 4. Postman Collection v2.1 JSON → 集合节点树（含文件夹层级）
 * 5. Postman Environment JSON    → 环境变量对象
 * 6. OpenAPI 3.0 / Swagger 2.0 JSON → 集合节点树（按路径分组）
 *
 * YAML 格式不支持（需先在 Postman/编辑器中导出为 JSON）。
 */

import type { CollectionNode, Environment, FormDataRow, RequestConfig } from '../types'
import { createEmptyConfig } from './useRequest'
import { createKv, uid } from './useEnvironment'

/* ------------------------------------------------------------------ */
/* 代码片段解析（cURL / fetch / PowerShell）                            */
/* ------------------------------------------------------------------ */

/**
 * 按 shell 规则分词（尊重引号，支持引号内空格与转义引号）
 * @param input 命令文本（续行符需先合并为空格）
 * @param opts.singleQuote 是否将单引号视为引用符（bash 为 true，cmd 为 false）
 * @returns token 数组（引号已剥离）
 */
function tokenize(input: string, opts: { singleQuote: boolean }): string[] {
  const tokens: string[] = []
  let cur = ''
  let quote: string | null = null
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quote) {
      // 引号内转义：\" 或 \'（与当前引号相同时视为字面引号）
      if (ch === '\\' && input[i + 1] === quote) {
        cur += quote
        i++
      } else if (ch === quote) {
        quote = null
      } else {
        cur += ch
      }
    } else if (ch === '"' || (ch === "'" && opts.singleQuote)) {
      quote = ch
    } else if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
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
 * cURL token 流解析核心（bash / cmd 两种风格共用）
 * 支持：-X/--request、-H/--header、-d/--data/--data-raw/--data-binary、
 *       -F/--form（含 @file）、--url、-u/--user（Basic 认证）
 * @param tokens 分词后的 token 数组
 * @returns 解析后的请求配置
 * @throws {Error} 无法识别出 URL 时抛出中文错误
 */
function parseCurlTokens(tokens: string[]): RequestConfig {
  const config = createEmptyConfig()
  const flagsWithArg = new Set([
    '-X', '--request', '-H', '--header', '-d', '--data', '--data-raw',
    '--data-ascii', '--data-binary', '--data-urlencode', '-F', '--form',
    '--url', '-u', '--user', '-b', '--cookie',
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
        case '-b':
        case '--cookie':
          // Chromium「Copy as cURL」用 -b 传递 Cookie
          if (value) config.headers.push(createKv('Cookie', value))
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

/**
 * 解析 bash 风格 cURL（\ 续行，单/双引号，Chrome/Postman「Copy as cURL (bash)」）
 * @param text cURL 命令文本
 * @returns 解析后的请求配置
 * @throws {Error} 无法识别出 URL 时抛出中文错误
 */
export function parseCurl(text: string): RequestConfig {
  // 合并 \ 续行后再分词
  const flat = text.replace(/\\\s*\r?\n/g, ' ')
  return parseCurlTokens(tokenize(flat.trim(), { singleQuote: true }))
}

/**
 * 解析 Windows cmd 风格 cURL（Chrome/Edge「Copy as cURL (cmd)」）
 * Chromium 的 cmd 转义规则（escapeStringWin）：
 * - 参数用 ^" 包裹；\ → \\、" → \"；白名单外字符（{ } [ ] % \( 等）加 ^ 前缀
 * - % 后跟字母数字时编码为 %^；正文换行编码为 ^\n\n；行尾 ^ 为续行
 * 解码管线：正文换行 → 续行合并 → ^X 反转义 → 引号/CRT 参数反转义 → 清理杂质
 * @param text cURL 命令文本
 * @returns 解析后的请求配置
 * @throws {Error} 无法识别出 URL 时抛出中文错误
 */
export function parseCurlCmd(text: string): RequestConfig {
  // 1. 正文换行（编码为 ^ + 两个换行）需先于续行处理，避免被误当续行吞掉
  // 2. 行尾 ^ 为 cmd 续行符，合并为单行
  // 3. ^X 为 cmd 转义（^" ^{ ^} ^% ^` 等），还原为字面字符
  const flat = text
    .replace(/\^[ \t]*\r?\n\r?\n/g, '\n')
    .replace(/\^[ \t]*\r?\n/g, '')
    .replace(/\^([\s\S])/g, '$1')
  const tokens = tokenizeCmdDecoded(flat).map(cleanCmdToken)
  return parseCurlTokens(tokens)
}

/**
 * 对已做 cmd 反转义的文本做 CRT 级分词
 * Chromium 的 ^" 包裹在 cmd 层是字面引号，由 MS Crt 参数解析器再次分组：
 * - 引号切换「引内」状态，不写入 token
 * - 引内 \" 为转义引号（写入字面 "）、\\ 为转义反斜杠（写入字面 \）
 * - 引外空白分隔参数
 * @param input 已还原 ^X 转义后的命令文本
 * @returns token 数组
 */
function tokenizeCmdDecoded(input: string): string[] {
  const tokens: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    // 杂质序列：引内 \`" —— URL 闭合反引号前的转义反斜杠 + 内容引号
    // （复制链路在 \" 转义引号内插入反引号标记所致），视为字面引号
    // 注意 for 循环 continue 后仍会执行 i++，故此处只前进 2
    if (inQuote && ch === '\\' && input[i + 1] === '`' && input[i + 2] === '"') {
      cur += '"'
      i += 2
      continue
    }
    // Crt 转义：\" → "、\\ → \（不改变引内状态）
    if (ch === '\\' && (input[i + 1] === '"' || input[i + 1] === '\\')) {
      cur += input[i + 1]
      i++
      continue
    }
    if (ch === '"') {
      inQuote = !inQuote
      continue
    }
    if (!inQuote && /\s/.test(ch)) {
      if (cur) {
        tokens.push(cur)
        cur = ''
      }
      continue
    }
    cur += ch
  }
  if (cur) tokens.push(cur)
  return tokens
}

/**
 * 清理 cmd 格式解码后的杂质
 * - 新版 Chromium 会对 URL 中的 [ ] { } 额外加 \ 前缀，需去除
 * - 剥离成对包裹 URL 的反引号（复制链路/站点标记引入，非真实 URL 内容），
 *   以及闭合反引号前残留的转义反斜杠
 * @param str 解码后的 token
 * @returns 清理后的 token
 */
function cleanCmdToken(str: string): string {
  return str
    .replace(/\\([[\]{}])/g, '$1')
    .replace(/`(https?:\/\/[^`\s"']*?)\\?`/g, '$1')
}

/**
 * 读取 JS 字符串字面量（处理 \" \\ \n \t 等常见转义）
 * @param src 源文本
 * @param start 起始引号下标
 * @returns { value, end } 解出的字符串内容与结束引号后的下标
 */
function readJsString(src: string, start: number): { value: string; end: number } {
  const quote = src[start]
  let i = start + 1
  let out = ''
  while (i < src.length) {
    const ch = src[i]
    if (ch === '\\') {
      const next = src[i + 1] || ''
      if (next === quote) out += quote
      else if (next === 'n') out += '\n'
      else if (next === 't') out += '\t'
      else if (next === 'r') out += '\r'
      else out += next
      i += 2
      continue
    }
    if (ch === quote) return { value: out, end: i + 1 }
    out += ch
    i++
  }
  return { value: out, end: i }
}

/**
 * 从 start 处的左括号开始提取配平的括号/圆括号块
 * @param src 源文本
 * @param start 左括号下标
 * @param open 左括号字符（默认 {）
 * @param close 右括号字符（默认 }）
 * @returns 配平的文本块（含首尾括号），未配平返回 null
 */
function extractBalanced(src: string, start: number, open = '{', close = '}'): string | null {
  let depth = 0
  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  return null
}

/**
 * 解析 fetch 代码为请求配置（浏览器 fetch 与 Node.js fetch 语法一致，共用核心）
 * 支持：fetch('url', { method, headers, body })；body 兼容字符串字面量与 JSON.stringify(...)
 * @param text fetch 代码文本
 * @returns 解析后的请求配置
 * @throws {Error} 无法识别出 URL 时抛出中文错误
 */
function parseFetchCode(text: string): RequestConfig {
  const config = createEmptyConfig()
  const src = text.trim()

  // 1. 定位 fetch( 调用并取第一个参数（URL 字符串字面量）
  const parenIdx = src.search(/\bfetch\s*\(/)
  if (parenIdx < 0) throw new Error('未找到 fetch(...) 调用')
  let i = src.indexOf('(', parenIdx) + 1
  while (i < src.length && /\s/.test(src[i])) i++
  if (src[i] !== '"' && src[i] !== "'" && src[i] !== '`') {
    throw new Error('fetch 第一参数需为 URL 字符串字面量（暂不支持变量）')
  }
  const urlRead = readJsString(src, i)
  config.url = urlRead.value.trim()
  if (!config.url) throw new Error('未能从 fetch 代码中识别出 URL')

  // 2. 第二参数 options 对象（存在才解析）
  let j = urlRead.end
  while (j < src.length && /[\s,]/.test(src[j])) j++
  if (src[j] !== '{') return config
  const objStr = extractBalanced(src, j)
  if (!objStr) return config

  // 3. body（先摘除，避免其内容干扰 method/headers 识别）
  let probe = objStr
  const bMatch = objStr.match(/["']?body["']?\s*:\s*/)
  if (bMatch) {
    const bStart = (bMatch.index || 0) + bMatch[0].length
    let rawBody = ''
    if (objStr.startsWith('JSON.stringify', bStart)) {
      // JSON.stringify({...}) / JSON.stringify("...")：提取括号内参数再尝试格式化
      const parenStart = objStr.indexOf('(', bStart)
      const argStr = parenStart >= 0 ? extractBalanced(objStr, parenStart, '(', ')') : null
      rawBody = argStr ? argStr.slice(1, -1) : ''
      try {
        rawBody = JSON.stringify(JSON.parse(rawBody), null, 2)
      } catch {
        /* 非 JSON 保持原文 */
      }
    } else if (src[bStart] === '"' || src[bStart] === "'" || src[bStart] === '`') {
      rawBody = readJsString(objStr, bStart).value
    }
    if (rawBody) {
      config.bodyType = 'raw'
      const ct = config.headers.find((h) => h.key.toLowerCase() === 'content-type')
      let isJson = false
      try {
        JSON.parse(rawBody)
        isJson = true
      } catch {
        /* 非 JSON */
      }
      config.rawType = ct && /xml/i.test(ct.value) ? 'xml' : isJson ? 'json' : 'text'
      config.rawBody = rawBody
      // 有请求体时默认 POST
      if (config.method === 'GET') config.method = 'POST'
    }
    // 将 body 片段替换为空格，防止其内容被误识别为 method/headers
    probe = objStr.slice(0, bMatch.index) + ' '.repeat(rawBody.length + 8) + objStr.slice(bStart)
  }

  // 4. method
  const mMatch = probe.match(/["']?method["']?\s*:\s*["']([A-Za-z]+)["']/)
  if (mMatch) config.method = mMatch[1].toUpperCase() as RequestConfig['method']

  // 5. headers 对象块
  const hMatch = probe.match(/["']?headers["']?\s*:\s*\{/)
  if (hMatch) {
    const braceStart = probe.indexOf('{', (hMatch.index || 0) + hMatch[0].length - 1)
    const headersStr = braceStart >= 0 ? extractBalanced(probe, braceStart) : null
    if (headersStr) {
      const pairRe = /["']([^"']+)["']\s*:\s*(["'])([\s\S]*?)\2/g
      let pm: RegExpExecArray | null
      while ((pm = pairRe.exec(headersStr))) {
        config.headers.push(createKv(pm[1], pm[3]))
      }
    }
  }
  return config
}

/**
 * 解析浏览器 fetch 代码（Chrome/Edge DevTools「Copy as fetch」）
 * @param text fetch 代码文本
 * @returns 解析后的请求配置
 * @throws {Error} 无法识别出 URL 时抛出中文错误
 */
export function parseFetch(text: string): RequestConfig {
  return parseFetchCode(text)
}

/**
 * 解析 Node.js fetch 代码（node-fetch / undici，含 import/await 前置噪音）
 * @param text fetch 代码文本
 * @returns 解析后的请求配置
 * @throws {Error} 无法识别出 URL 时抛出中文错误
 */
export function parseFetchNode(text: string): RequestConfig {
  return parseFetchCode(text)
}

/**
 * 解析 PowerShell 请求代码（Invoke-RestMethod / Invoke-WebRequest）
 * 支持：-Uri/-Method/-ContentType/-Headers(@{...} 或 $var)/-Body（here-string、引号字符串、$var）
 * @param text PowerShell 代码文本
 * @returns 解析后的请求配置
 * @throws {Error} 无法识别出 Uri 时抛出中文错误
 */
export function parsePowerShell(text: string): RequestConfig {
  const config = createEmptyConfig()
  const src = text.trim()
  if (!/Invoke-(RestMethod|WebRequest)/i.test(src)) {
    throw new Error('未找到 Invoke-RestMethod / Invoke-WebRequest 调用')
  }

  // 1. URL
  const uri = src.match(/-Uri\s+(['"])([^'"]+?)\1/i)
  if (!uri) throw new Error('未能识别 -Uri 参数')
  config.url = uri[2]

  // 2. 方法
  const method = src.match(/-Method\s+([A-Za-z]+)/i)
  if (method) config.method = method[1].toUpperCase() as RequestConfig['method']

  // 3. ContentType → 请求头
  const ct = src.match(/-ContentType\s+(['"])([^'"]+?)\1/i)
  if (ct) config.headers.push(createKv('Content-Type', ct[2]))

  /**
   * 解析 PowerShell 哈希表块中的键值对为请求头行
   * @param block @{...} 内部文本
   */
  const parseHeadersBlock = (block: string): void => {
    const pairRe = /["']([^"']+)["']\s*=\s*["']([^"']*)["']/g
    let pm: RegExpExecArray | null
    while ((pm = pairRe.exec(block))) {
      config.headers.push(createKv(pm[1], pm[2]))
    }
  }

  // 4. Headers：内联 -Headers @{...} 优先，其次 -Headers $var 引用声明
  const inline = src.match(/-Headers\s+@\{/i)
  if (inline) {
    const braceIdx = (inline.index || 0) + inline[0].length - 1
    const block = extractBalanced(src, braceIdx)
    if (block) parseHeadersBlock(block.slice(1, -1))
  } else {
    const varRef = src.match(/-Headers\s+\$(\w+)/i)
    if (varRef) {
      const decl = src.match(new RegExp('\\$' + varRef[1] + '\\s*=\\s*@\\{'))
      if (decl) {
        const braceIdx = (decl.index || 0) + decl[0].length - 1
        const block = extractBalanced(src, braceIdx)
        if (block) parseHeadersBlock(block.slice(1, -1))
      }
    }
  }

  /**
   * 从文本中解析 Body 值（here-string / 单双引号字符串 / @{...} 哈希表转 JSON）
   * @param rest 从 Body 值起始位置开始的文本
   * @returns 解出的请求体（无法识别返回空串）
   */
  const parseBodyValue = (rest: string): string => {
    // here-string：@'...'@ 与 @"..."@
    if (rest.startsWith("@'")) {
      const end = rest.indexOf("'@", 2)
      return end > 0 ? rest.slice(2, end) : ''
    }
    if (rest.startsWith('@"')) {
      const end = rest.indexOf('"@', 2)
      return end > 0 ? rest.slice(2, end) : ''
    }
    // 单引号字符串（PowerShell 内不转义）
    if (rest[0] === "'") {
      const end = rest.indexOf("'", 1)
      return end > 0 ? rest.slice(1, end) : ''
    }
    // 双引号字符串（`` ` `` 转义 / "" 转义）
    if (rest[0] === '"') {
      const m = rest.match(/^"((?:[^"`]|`.)*)"/)
      return m ? m[1].replace(/`(.)/g, '$1').replace(/""/g, '"') : ''
    }
    // 哈希表 @{...} → 尝试转 JSON
    if (rest.startsWith('@{')) {
      const block = extractBalanced(rest, 0)
      if (block) {
        const inner = block.slice(1, -1)
        const pairRe = /["']?([^"'\s=]+)["']?\s*=\s*["']([^"']*)["']/g
        const obj: Record<string, string> = {}
        let pm: RegExpExecArray | null
        while ((pm = pairRe.exec(inner))) obj[pm[1]] = pm[2]
        return JSON.stringify(obj, null, 2)
      }
    }
    return ''
  }

  // 5. Body：-Body 内联值，其次 -Body $var 引用声明
  let rawBody = ''
  const bodyMatch = src.match(/-Body\s+/i)
  if (bodyMatch) {
    const bIdx = (bodyMatch.index || 0) + bodyMatch[0].length
    rawBody = parseBodyValue(src.slice(bIdx))
    if (!rawBody && src[bIdx] === '$') {
      const varName = src.slice(bIdx).match(/^\$(\w+)/)?.[1] || ''
      if (varName) {
        const decl = src.match(new RegExp('\\$' + varName + '\\s*=\\s*([\\s\\S]*?)(?=\\r?\\n\\$|\\r?\\nInvoke|$)'))
        if (decl) rawBody = parseBodyValue(decl[1].trim())
      }
    }
  }

  // 6. 请求体落配置（有 body 默认 POST，JSON 自动识别）
  if (rawBody) {
    config.bodyType = 'raw'
    const ctHeader = config.headers.find((h) => h.key.toLowerCase() === 'content-type')
    let isJson = false
    try {
      JSON.parse(rawBody)
      isJson = true
    } catch {
      /* 非 JSON */
    }
    config.rawType = ctHeader && /xml/i.test(ctHeader.value) ? 'xml' : isJson ? 'json' : 'text'
    config.rawBody = rawBody
    if (config.method === 'GET') config.method = 'POST'
  }
  return config
}

/** 代码片段类型（导入弹窗的 5 个子页签） */
export type CodeSnippetKind = 'curl-cmd' | 'curl-bash' | 'fetch' | 'fetch-node' | 'powershell'

/**
 * 按代码片段类型分发解析（导入弹窗统一入口）
 * @param kind 片段类型
 * @param text 代码文本
 * @returns 解析后的请求配置
 * @throws {Error} 解析失败时抛出对应中文错误
 */
export function parseCodeSnippet(kind: CodeSnippetKind, text: string): RequestConfig {
  switch (kind) {
    case 'curl-cmd':
      return parseCurlCmd(text)
    case 'curl-bash':
      return parseCurl(text)
    case 'fetch':
      return parseFetch(text)
    case 'fetch-node':
      return parseFetchNode(text)
    case 'powershell':
      return parsePowerShell(text)
  }
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
