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

export function registerJlocalProtocol() {
  protocol.handle("jlocal", async (request) => {
    const reqUrl = decodeURIComponent(request.url);
    const filePath = reqUrl.slice("jlocal:///".length);
    
    try {
      const stats = fs.statSync(filePath)
      
      if (stats.isDirectory()) {
        return new Response('Directory not allowed', { status: 403 })
      }

      const ext = path.extname(filePath).toLowerCase()
      const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.flv', '.wmv', '.mkv', '.m4v', '.3gp', '.3g2', '.mpeg', '.mpg', '.mpe', '.mpv', '.m2v', '.m2ts', '.ts', '.vob', '.ogv', '.qt', '.f4v', '.f4p', '.f4a', '.f4b', '.rm', '.rmvb', '.asf', '.divx', '.xvid', '.amv', '.mts', '.mxf', '.roq', '.nsv', '.mng', '.yuv', '.gifv']
      const audioExts = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.wma', '.m4a', '.aiff', '.alac', '.dsf', '.dff', '.opus', '.vorbis', '.pcm', '.au', '.snd', '.mid', '.midi', '.rmi', '.m4b', '.m4p', '.mpc', '.ape', '.wv', '.tak', '.tta', '.shn', '.mp2', '.mp1', '.amr', '.awb', '.3ga', '.oga', '.spx', '.mka']

      if (videoExts.includes(ext) || audioExts.includes(ext)) {
        const rangeHeader = request.headers.get('range') || null
        return handleRangeRequest(filePath, rangeHeader, stats)
      }

      const contentType = getContentType(filePath)
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
