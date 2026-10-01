/**
 * 沙箱自证脚本：categorizableNotes 重构
 * 1) 逐文件 compiler-sfc parse + compileScript + compileTemplate
 * 2) 图标名登记扫描：<LucideIcon name="X"> / icon: 'X' 与 LucideIcon.vue nameMap 比对
 * 3) 主题红线扫描：业务 style 中残留 --el-* 或硬编码 #hex（数据驱动色除外）
 */
const fs = require('fs')
const path = require('path')
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc')

const root = path.join(__dirname, '..')
const dir = path.join(root, 'src', 'views', 'categorizableNotes')

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name)
    return e.isDirectory() ? walk(p) : p.endsWith('.vue') ? [p] : []
  })
}

let failed = false

// ---------- 1) SFC 结构 / 语法 ----------
for (const file of walk(dir)) {
  const src = fs.readFileSync(file, 'utf8')
  const { descriptor, errors } = parse(src, { filename: file })
  if (errors.length) {
    failed = true
    console.log('[PARSE FAIL]', path.relative(root, file), errors.map((e) => e.message))
    continue
  }
  try {
    const script = compileScript(descriptor, { id: 'test' })
    const tpl = compileTemplate({
      id: 'test',
      filename: file,
      source: descriptor.template.content,
      compilerOptions: { bindingMetadata: script.bindings },
    })
    if (tpl.errors.length) {
      failed = true
      console.log('[TPL FAIL]', path.relative(root, file), tpl.errors.map((e) => e.message || e))
    } else {
      console.log('[SFC OK]', path.relative(root, file))
    }
  } catch (e) {
    failed = true
    console.log('[SCRIPT FAIL]', path.relative(root, file), e.message)
  }
}

// ---------- 2) 图标名登记扫描 ----------
const iconVue = fs.readFileSync(path.join(root, 'src', 'components', 'LucideIcon.vue'), 'utf8')
const nameMapMatch = iconVue.match(/nameMap\s*=\s*ref<Record<any, any>>\((\{[\s\S]*?\n\})\)/)
if (!nameMapMatch) {
  console.log('[ICON] 无法解析 nameMap，跳过比对')
} else {
  // 提取 nameMap 里的键（标识符列表），import 语句里出现过的名字才算登记
  const importLine = iconVue.match(/import \{([\s\S]*?)\} from '@lucide\/vue'/)
  const importNames = new Set(
    importLine ? importLine[1].split(',').map((s) => s.trim()).filter(Boolean) : []
  )
  const mapBody = nameMapMatch[1]
  const mapKeys = new Set(
    (mapBody.match(/^\s*([A-Za-z0-9_]+),/gm) || []).map((s) => s.replace(/[,\s]/g, ''))
  )
  // nameMap 中登记的名字 = mapKeys ∩ importNames（必须两者都有）
  const registered = new Set([...mapKeys].filter((k) => importNames.has(k)))

  const used = new Set()
  for (const file of walk(dir)) {
    const src = fs.readFileSync(file, 'utf8')
    for (const m of src.matchAll(/<LucideIcon[^>]*\sname="([^"]+)"/g)) used.add(m[1])
    for (const m of src.matchAll(/name:\s*'([^']+)'/g)) used.add(m[1])
  }
  const missing = [...used].filter((n) => !registered.has(n))
  if (missing.length) {
    failed = true
    console.log('[ICON MISS]', missing, '—— 会静默 fallback 成 CloudAlert')
  } else {
    console.log('[ICON OK]', '模块用到', used.size, '个图标，全部已登记:', [...used].join(', '))
  }
}

// ---------- 3) 主题红线：--el-* / 硬编码颜色 ----------
const hexAllow = /#([0-9a-fA-F]{3,8})\b/g
for (const file of walk(dir)) {
  const src = fs.readFileSync(file, 'utf8')
  const style = (src.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [])[1] || ''
  const elVars = style.match(/--el-(fill-color-|color-primary-light-|bg-color|text-color-)[a-z-]*/g)
  const hexes = [...style.matchAll(hexAllow)]
    .map((m) => m[0])
    .filter((h) => !/^#(fff|000)$/i.test(h))
  if (elVars || hexes.length) {
    failed = true
    console.log('[THEME FAIL]', path.relative(root, file), { elVars, hexes })
  } else {
    console.log('[THEME OK]', path.relative(root, file))
  }
}

process.exit(failed ? 1 : 0)
