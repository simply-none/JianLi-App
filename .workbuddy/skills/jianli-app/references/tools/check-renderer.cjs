#!/usr/bin/env node
/*
  渲染端改动自查脚本（配合 SKILL.md「使用方式」第 5 条的四板斧）。

  为什么需要它：
    沙箱里起不来 Electron GUI，改完 Vue 组件后能自动化的只有「结构 / 依赖 / 登记」这三类检查。
    其中 **图标名漏登记** 最容易漏 —— `LucideIcon.vue` 的模板是
    `nameMap[name] || nameMap['CloudAlert']`，名字没登记**不报错、不告警**，
    只是安静地显示成一个云朵感叹号，肉眼极难发现。本脚本专门盯这个。

  用法（在项目根目录下）：
    node .workbuddy/skills/jianli-app/references/tools/check-renderer.cjs                     # 默认查 src/views
    node .workbuddy/skills/jianli-app/references/tools/check-renderer.cjs src/views/mindmap    # 查指定目录
    node .workbuddy/skills/jianli-app/references/tools/check-renderer.cjs src/views/mindmap src/views/weather

  检查项：
    ① SFC 结构：@vue/compiler-sfc 的 parse + compileScript + compileTemplate
    ② 依赖解析：`@/xxx` 与 `./xxx` 能否落到真实文件（.ts/.vue/.scss/index.*）
    ③ 图标登记：`<LucideIcon name="X">` 与 `icon: 'X'` 用到的名字是否都在 LucideIcon.vue 的 nameMap 里

  退出码：0 = 全部通过；1 = 有问题（逐条打印）。

  ⚠️ 这只是「自证改动没有低级错误」，**不能替代实机验证** ——
     交互、视觉、主题适配必须在本地 `npm run dev` 里人工确认。
*/

const fs = require('fs')
const path = require('path')

/** 从脚本位置反推项目根：<root>/.workbuddy/skills/jianli-app/references/tools/check-renderer.cjs */
const APP_ROOT = path.resolve(__dirname, '../../../../..')
const MODULES = 'node_modules'

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const targets = args.length ? args : ['src/views']

/* ------------------------------------------------------------------ 工具 */

function requireFromApp(spec) {
  const candidates = [
    path.join(APP_ROOT, MODULES, spec),
    path.join(APP_ROOT, MODULES, spec, 'index.js'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return require(candidate)
  }
  try {
    return require(spec)
  } catch {
    return null
  }
}

/** 递归收集 .vue / .ts 文件 */
function collect(files, dir) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collect(files, full)
    else if (/\.(vue|ts)$/.test(entry.name)) files.push(full)
  }
  return files
}

const rel = (file) => path.relative(APP_ROOT, file).replace(/\\/g, '/')

/* ------------------------------------------------------------------ 主流程 */

const srcFiles = []
for (const target of targets) collect(srcFiles, path.join(APP_ROOT, target))
if (!srcFiles.length) {
  console.error(`没有找到任何 .vue / .ts 文件：${targets.join(', ')}`)
  process.exit(1)
}

const problems = []
const summary = []

/* ---------------- ① SFC 结构 ---------------- */

const compiler = requireFromApp('@vue/compiler-sfc')
if (!compiler) {
  problems.push('找不到 @vue/compiler-sfc，无法做结构校验')
} else {
  const vueFiles = srcFiles.filter((f) => f.endsWith('.vue'))
  for (const file of vueFiles) {
    const source = fs.readFileSync(file, 'utf8')
    const { descriptor, errors } = compiler.parse(source, { filename: file })
    if (errors.length) {
      problems.push(`${rel(file)}: SFC 解析错误 -> ${errors.map((e) => e.message).join('; ')}`)
      continue
    }
    try {
      if (descriptor.scriptSetup || descriptor.script) compiler.compileScript(descriptor, { id: 'check' })
    } catch (error) {
      problems.push(`${rel(file)}: <script setup> 编译失败 -> ${error.message}`)
    }
    if (descriptor.template) {
      const result = compiler.compileTemplate({
        source: descriptor.template.content,
        filename: file,
        id: 'check',
      })
      if (result.errors.length) {
        problems.push(
          `${rel(file)}: 模板编译失败 -> ${result.errors
            .map((e) => e.message || String(e))
            .join('; ')}`,
        )
      }
    }
  }
  summary.push(`① SFC 结构：${vueFiles.length} 个 .vue 通过`)
}

/* ---------------- ② 依赖解析 ---------------- */

const unresolved = []
for (const file of srcFiles) {
  const dir = path.dirname(file)
  const source = fs.readFileSync(file, 'utf8')
  const re = /(?:from|import)\s+['"]([^'"]+)['"]/g
  let match
  while ((match = re.exec(source))) {
    const spec = match[1]
    let base
    if (spec.startsWith('@/')) base = path.join(APP_ROOT, 'src', spec.slice(2))
    else if (spec.startsWith('.')) base = path.resolve(dir, spec)
    else continue // 包依赖，交给 TS / 打包器

    const candidates = [
      base,
      `${base}.ts`,
      `${base}.vue`,
      `${base}.scss`,
      path.join(base, 'index.ts'),
      path.join(base, 'index.vue'),
    ]
    if (!candidates.some((c) => fs.existsSync(c))) {
      unresolved.push(`${rel(file)} -> ${spec}`)
    }
  }
}
if (unresolved.length) problems.push(`未解析的 import（${unresolved.length} 处）：\n    ${unresolved.join('\n    ')}`)
summary.push(`② 依赖解析：${srcFiles.length} 个文件的相对 import 全部命中`)

/* ---------------- ③ 图标名登记 ---------------- */

const lucidePath = path.join(APP_ROOT, 'src/components/LucideIcon.vue')
if (!fs.existsSync(lucidePath)) {
  problems.push('找不到 src/components/LucideIcon.vue，跳过图标登记检查')
} else {
  const lucide = fs.readFileSync(lucidePath, 'utf8')

  const mapStart = lucide.indexOf('let nameMap')
  const mapBody = lucide.slice(mapStart, lucide.indexOf('})', mapStart))
  const registered = new Set()
  const reKey = /^\s{2}([A-Za-z][A-Za-z0-9_]*)\s*,?\s*$/gm
  let m
  while ((m = reKey.exec(mapBody))) registered.add(m[1])

  // 注意：LucideIcon.vue 里有两段 `from '@lucide/vue'` 的 import（第二段只补了 ArrowLeftRight），
  // 所以必须扫**全部** import 语句，只取第一段会把 ArrowLeftRight 误判成「没 import」。
  const imported = new Set()
  const reImpStatement = /import\s*\{([^}]*)\}\s*from\s*'@lucide\/vue'/g
  let imp
  while ((imp = reImpStatement.exec(lucide))) {
    const reName = /\b([A-Z][A-Za-z0-9_]*)\b/g
    let name
    while ((name = reName.exec(imp[1]))) imported.add(name[1])
  }

  const used = new Map() // 名字 -> 第一次出现的位置
  for (const file of srcFiles) {
    const source = fs.readFileSync(file, 'utf8')
    const patterns = [
      // 模板里直接写的图标名
      /<LucideIcon[^>]*\sname="([^"]+)"/g,
      // 配置表里的图标名（限定 PascalCase，否则会把 '🟨' / 'roundRect' 这类
      // 非图标字段也当成图标名报出来，噪音太大）
      /\bicon:\s*'([A-Z][A-Za-z0-9]*)'/g,
    ]
    for (const re of patterns) {
      let hit
      while ((hit = re.exec(source))) {
        if (!used.has(hit[1])) used.set(hit[1], rel(file))
      }
    }
  }

  const unregistered = [...used.keys()].filter((n) => !registered.has(n))
  const notImported = [...used.keys()].filter((n) => !imported.has(n))
  if (unregistered.length) {
    problems.push(
      `图标名未在 LucideIcon.vue 的 nameMap 登记（会静默 fallback 成 CloudAlert）：\n    ` +
        unregistered.map((n) => `${n}  ← ${used.get(n)}`).join('\n    '),
    )
  }
  if (notImported.length) {
    problems.push(
      `图标名没在 LucideIcon.vue 里 import（只加 nameMap 不够）：${notImported.join(', ')}`,
    )
  }
  summary.push(`③ 图标登记：用到 ${used.size} 个图标名，nameMap 已登记 ${registered.size} 个`)
}

/* ------------------------------------------------------------------ 输出 */

console.log(summary.join('\n'))
console.log('')
if (problems.length) {
  console.log('❌ 发现问题：')
  problems.forEach((p) => console.log(`  · ${p}`))
  console.log('\n提示：交互 / 视觉 / 主题适配仍需本地 `npm run dev` 实机确认。')
  process.exit(1)
}
console.log('✅ 结构 / 依赖 / 图标登记 三项全部通过（仍不代表实机行为正确）')
