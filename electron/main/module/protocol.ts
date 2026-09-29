import { protocol, net } from "electron";
import path from 'path'
import fs from 'fs'
import colors from 'colors'

export function registerJlocalProtocolBefore() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'jlocal',
      privileges: {
        secure: true,
        supportFetchAPI: true,
        standard: true,
        bypassCSP: true,
        stream: true,
        // ★ corsEnabled 必须显式开（2026-09-29，Electron 44 升级后电子书打不开的根因）
        //
        // 现象（dev 模式点书即失败，控制台报）：
        //   Access to fetch at 'jlocal://c/Users/.../书.epub' from origin
        //   'http://localhost:5173' has been blocked by CORS policy:
        //   Cross origin requests are only supported for protocol schemes:
        //   chrome, chrome-extension, chrome-untrusted, data, http, https.
        //
        // 根因：这是 **Chromium 的 CORS** 在拒绝，不是文件/路径/协议 handler 的问题。
        // 渲染端在 dev 下跑在 `http://localhost:5173`，去 fetch `jlocal://` 属**跨源请求**；
        // 而 Chromium 只对「已声明 corsEnabled 的 scheme」放行跨源。
        // `Privileges.corsEnabled` 默认为 **false**（见 electron.d.ts），
        // 本文件原先没写 ⇒ jlocal 不在放行名单 ⇒ fetch 直接被 CORS 拦在合成请求之前，
        // 连 protocol.handle 都进不去（所以主进程日志里看不到 jlocal 报错）。
        //
        // 为什么升级前能用：Electron ≤36 对 registerSchemesAsPrivileged 注册的
        // privileged scheme 在跨源上更宽松；Electron 44（Chromium 152）收紧为严格 CORS 校验。
        // 注意 `webSecurity: false` **不能**替代它 —— 该开关管的是同源策略对页面自身资源的作用，
        // 而这里是 scheme 级别的 CORS 白名单，必须靠 privileges 声明。
        corsEnabled: true,
      },
    },
  ])
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.flv': 'video/x-flv',
    '.wmv': 'video/x-ms-wmv',
    '.mkv': 'video/x-matroska',
    '.m4v': 'video/x-m4v',
    '.3gp': 'video/3gpp',
    '.3g2': 'video/3gpp2',
    '.mpeg': 'video/mpeg',
    '.mpg': 'video/mpeg',
    '.mpe': 'video/mpeg',
    '.mpv': 'video/x-matroska',
    '.m2v': 'video/mpeg',
    '.m2ts': 'video/MP2T',
    '.ts': 'video/MP2T',
    '.vob': 'video/x-ms-vob',
    '.ogv': 'video/ogg',
    '.qt': 'video/quicktime',
    '.f4v': 'video/x-f4v',
    '.f4p': 'video/x-f4p',
    '.f4a': 'audio/mp4',
    '.f4b': 'audio/mp4',
    '.rm': 'application/vnd.rn-realmedia',
    '.rmvb': 'application/vnd.rn-realmedia-vbr',
    '.asf': 'video/x-ms-asf',
    '.divx': 'video/divx',
    '.xvid': 'video/x-xvid',
    '.amv': 'video/x-amv',
    '.mts': 'video/MP2T',
    '.mxf': 'application/mxf',
    '.roq': 'video/roq',
    '.nsv': 'video/x-nsv',
    '.mng': 'video/x-mng',
    '.yuv': 'video/yuv',
    '.gifv': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.wma': 'audio/x-ms-wma',
    '.m4a': 'audio/mp4',
    '.aiff': 'audio/aiff',
    '.alac': 'audio/x-alac',
    '.dsf': 'audio/x-dsf',
    '.dff': 'audio/x-dff',
    '.opus': 'audio/opus',
    '.vorbis': 'audio/vorbis',
    '.pcm': 'audio/L16',
    '.au': 'audio/basic',
    '.snd': 'audio/basic',
    '.mid': 'audio/midi',
    '.midi': 'audio/midi',
    '.rmi': 'audio/midi',
    '.m4b': 'audio/mp4',
    '.m4p': 'audio/mp4',
    '.mpc': 'audio/x-musepack',
    '.ape': 'audio/x-ape',
    '.wv': 'audio/x-wavpack',
    '.tak': 'audio/x-tak',
    '.tta': 'audio/x-tta',
    '.shn': 'audio/x-shorten',
    '.mp2': 'audio/mpeg',
    '.mp1': 'audio/mpeg',
    '.amr': 'audio/amr',
    '.awb': 'audio/amr-wb',
    '.3ga': 'audio/3gpp',
    '.oga': 'audio/ogg',
    '.spx': 'audio/ogg',
    '.mka': 'audio/x-matroska',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.psd': 'image/vnd.adobe.photoshop',
    '.ai': 'application/postscript',
    '.eps': 'application/postscript',
    '.raw': 'image/x-raw',
    '.svgz': 'image/svg+xml',
    '.avif': 'image/avif',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.indd': 'application/x-indesign',
    '.jfif': 'image/jpeg',
    '.jpe': 'image/jpeg',
    '.jpf': 'image/jpx',
    '.jpx': 'image/jpx',
    '.j2c': 'image/j2c',
    '.j2k': 'image/j2k',
    '.jp2': 'image/jp2',
    '.j2p': 'image/j2p',
    '.jxr': 'image/jxr',
    '.wbmp': 'image/vnd.wap.wbmp',
    '.xbm': 'image/x-xbitmap',
    '.pdf': 'application/pdf',
    // ★ .epub 此前缺失 → 落到 'application/octet-stream'（2026-09-29 补）
    // epub.js 靠 fetch/XHR 拿 ArrayBuffer 解析，MIME 不致命，但标对更规范，
    // 也避免个别浏览器/中间层对 octet-stream 另做处理。
    '.epub': 'application/epub+zip',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.js': 'application/javascript',
    '.html': 'text/html',
    '.css': 'text/css',
    '.vue': 'text/html',
    '.xml': 'application/xml',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.csv': 'text/csv',
    '.log': 'text/plain',
    '.ini': 'text/plain',
    '.conf': 'text/plain',
    '.cfg': 'text/plain',
    '.env': 'text/plain',
    '.bat': 'text/plain',
    '.cmd': 'text/plain',
    '.ps1': 'text/plain',
    '.sh': 'text/plain',
    '.bash': 'text/plain',
    '.zsh': 'text/plain',
    '.fish': 'text/plain',
    '.sql': 'text/plain',
    '.py': 'text/x-python',
    '.java': 'text/x-java-source',
    '.cpp': 'text/x-c++src',
    '.c': 'text/x-csrc',
    '.cxx': 'text/x-c++src',
    '.h': 'text/x-chdr',
    '.hpp': 'text/x-c++hdr',
    '.cs': 'text/x-csharp',
    '.go': 'text/x-go',
    '.rs': 'text/x-rust',
    '.swift': 'text/x-swift',
    '.kt': 'text/x-kotlin',
    '.rb': 'text/x-ruby',
    '.php': 'text/x-php',
    '.pl': 'text/x-perl',
    '.lua': 'text/x-lua',
    '.dart': 'text/x-dart',
    '.groovy': 'text/x-groovy',
    '.scala': 'text/x-scala',
    '.clj': 'text/x-clojure',
    '.cljs': 'text/x-clojurescript',
    '.edn': 'text/x-edn',
    '.hs': 'text/x-haskell',
    '.ml': 'text/x-ocaml',
    '.elm': 'text/x-elm',
    '.purs': 'text/x-purescript',
    '.nim': 'text/x-nim',
    '.zig': 'text/x-zig',
    '.crystal': 'text/x-crystal',
    '.d': 'text/x-d',
    '.r': 'text/x-r',
    '.matlab': 'text/x-matlab',
    '.m': 'text/x-matlab',
    '.v': 'text/x-vlang',
    '.svelte': 'text/html',
    '.astro': 'text/html',
    '.mdx': 'text/markdown',
    '.jsx': 'text/jsx',
    '.ejs': 'text/html',
    '.pug': 'text/html',
    '.haml': 'text/html',
    '.sass': 'text/x-sass',
    '.scss': 'text/x-scss',
    '.less': 'text/x-less',
    '.stylus': 'text/x-stylus',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'font/eot',
    '.sfnt': 'font/sfnt',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.bz2': 'application/x-bzip2',
    '.xz': 'application/x-xz',
    '.lz': 'application/x-lzma',
    '.lzma': 'application/x-lzma',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.odt': 'application/vnd.oasis.opendocument.text',
    '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
    '.odp': 'application/vnd.oasis.opendocument.presentation',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

function handleRangeRequest(filePath: string, rangeHeader: string | null, stats: fs.Stats): Response {
  const totalSize = stats.size
  let start = 0
  let end = totalSize - 1

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
    if (match) {
      start = parseInt(match[1], 10)
      if (match[2]) {
        end = parseInt(match[2], 10)
      }
    }
  }

  end = Math.min(end, totalSize - 1)
  const chunkSize = end - start + 1

  const stream = fs.createReadStream(filePath, { start, end })
  const contentType = getContentType(filePath)

  return new Response(stream as unknown as BodyInit, {
    status: rangeHeader ? 206 : 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': chunkSize.toString(),
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
    },
  })
}

/**
 * 从 jlocal:// 请求 URL 还原出真实磁盘路径。
 *
 * ★ 为什么不能再用 `decodeURIComponent(request.url).slice('jlocal:///'.length)` ★
 * （2026-09-29 修复「电子书点不开」的直接根因）
 *
 * `jlocal` 注册为 **standard scheme**（privileges.standard = true），Chromium 会
 * 按 `scheme://host/path` 规范化 URL。于是 Windows 盘符 `C:` 里的冒号被吃掉、
 * `C` 被当成 **host**：
 *
 *     渲染端拼出            jlocal:///C:/Users/风起/Downloads/书籍/书.epub
 *     Chromium 规范化后      jlocal://c/Users/风起/Downloads/书籍/书.epub
 *                           ↑ host="c"，三斜杠变成双斜杠，盘符冒号丢失
 *
 * 实测（Electron 44，三种拼法 `jlocal:///`、`jlocal://`、`jlocal:////` 结果**完全一致**）：
 *      rawUrl   = jlocal://c/Users/%E9%A3%8E%E8%B5%B7/.../probe.txt
 *      slice(10)= /Users/风起/.../probe.txt      ← 盘符没了，且以 / 开头
 *
 * ⇒ Windows 上这个路径非法，`fs.statSync` 抛错 → 返回 404 → 电子书打不开。
 * 这正是用户报错 URL 里出现 `jlocal://c/Users/...`（host=c）的原因。
 *
 * 正确还原方式：取 `URL.host` + `URL.pathname`，再把被拆出去的盘符拼回来：
 *     host="c" + pathname="/Users/..." → "c" + "/Users/..." → "/c/Users/..."
 *                                                          → "C:/Users/..."  ✓
 *
 * 兼容处理（两种输入形态都要吃下，缺一不可）：
 *   A. Chromium 规范化后的真实形态 `jlocal://c/Users/...` → host="c" 是单字母 → 拼成 `C:/...`
 *   B. 未被规范化的形态 `jlocal:///C:/Users/...` → host="" 且 pathname="/C:/Users/..."
 *      （纯 Node 的 `new URL()` 就长这样；真实 Electron 里若 handler 拿到原始 URL 亦同）
 *      → pathname 以 `/X:/` 开头时，去掉前导 `/` 得到 `C:/...`
 *   C. host 为空且 pathname 不是盘符形态 → 直接返回 pathname（原样相对/绝对路径）
 *   D. UNC 路径（`\\server\share`）→ host 是服务器名，按 `//host/path` 还原
 */
function resolveLocalPath(requestUrl: string): string {
  const u = new URL(requestUrl);
  const host = u.host || '';
  // pathname 仍是百分号编码，必须解码（中文目录名依赖这一步）
  const pathname = decodeURIComponent(u.pathname || '');

  // A. Windows 盘符被 Chromium 拆成 host：`jlocal://c/...` → c + /... → C:/...
  if (/^[a-zA-Z]$/.test(host)) {
    return `${host.toUpperCase()}:${pathname}`;
  }

  // B. 未被规范化的三斜杠形态：pathname = /C:/Users/... → 去掉前导 / → C:/Users/...
  //    注意只看「`/` + 单字母 + `:` + `/`」这一种，避免误伤 `/c/foo` 这类正常绝对路径。
  if (!host && /^\/[a-zA-Z]:\//.test(pathname)) {
    return pathname.slice(1);
  }

  if (!host) {
    // C. 无 host：POSIX 风格 /... 或已是完整路径，原样返回
    return pathname;
  }

  // D. 其余（如 UNC 的 server 名）：还原成 //host/path
  return `//${host}${pathname}`;
}

export function registerJlocalProtocol() {
  protocol.handle("jlocal", async (request) => {
    const filePath = resolveLocalPath(request.url);

    try {
      const stats = fs.statSync(filePath)

      if (stats.isDirectory()) {
        return new Response('Directory not allowed', { status: 403 })
      }

      const ext = path.extname(filePath).toLowerCase()
      const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.flv', '.wmv', '.mkv', '.m4v', '.3gp', '.3g2', '.mpeg', '.mpg', '.mpe', '.mpv', '.m2v', '.m2ts', '.ts', '.vob', '.ogv', '.qt', '.f4v', '.f4p', '.f4a', '.f4b', '.rm', '.rmvb', '.asf', '.divx', '.xvid', '.amv', '.mts', '.mxf', '.roq', '.nsv', '.mng', '.yuv', '.gifv']
      const audioExts = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.wma', '.m4a', '.aiff', '.alac', '.dsf', '.dff', '.opus', '.vorbis', '.pcm', '.au', '.snd', '.mid', '.midi', '.rmi', '.m4b', '.m4p', '.mpc', '.ape', '.wv', '.tak', '.tta', '.shn', '.mp2', '.mp1', '.amr', '.awb', '.3ga', '.oga', '.spx', '.mka']

      // ★ HEAD 只回元数据，不建读流（2026-09-29 补）
      // `src/views/ebookReader/utils/fileUtils.ts` 的 checkFileExists() 就是发 HEAD，
      // 而原实现无论什么 method 都 `fs.createReadStream` + 返回 body：
      // 对 HEAD 而言 body 会被丢弃，等于白白打开一个文件句柄（书越大越浪费）；
      // 且 `Response` 带 body 时若被 Chromium 判定与 HEAD 语义冲突，可能让步进逻辑异常。
      const isHead = request.method === 'HEAD'

      if (videoExts.includes(ext) || audioExts.includes(ext)) {
        const rangeHeader = request.headers.get('range') || null
        if (isHead) {
          return new Response(null, {
            status: 200,
            headers: {
              'Content-Type': getContentType(filePath),
              'Content-Length': stats.size.toString(),
              'Accept-Ranges': 'bytes',
            },
          })
        }
        return handleRangeRequest(filePath, rangeHeader, stats)
      }

      const contentType = getContentType(filePath)

      if (isHead) {
        return new Response(null, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': stats.size.toString(),
          },
        })
      }

      const stream = fs.createReadStream(filePath)

      return new Response(stream as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': stats.size.toString(),
        },
      })
    } catch (error) {
      console.error(colors.red('jlocal protocol error:'), error)
      return new Response('File not found', { status: 404 })
    }
  })
}
