/**
 * 纯逻辑层断言：useNotes.ts 数据层（真实 TS 源码 transpile 后加载）
 * - parseNoteTags / buildNoteRow 纯函数行为
 * - fetchNotePage 的 IPC 契约（tableName + 顶层 SqlStr）与 SQL 拼装（转义 / 组合 / 分页）
 * - upsertNote / deleteNote 的参数契约（config.primaryKey / condition.key）
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const root = path.join(__dirname, '..')
const modDir = path.join(root, 'src', 'views', 'categorizableNotes', 'composables')

function transpile(file) {
  const src = fs.readFileSync(file, 'utf8')
  return ts.transpileModule(src, {
    compilerOptions: { module: 'commonjs', target: 'es2020', esModuleInterop: true },
    fileName: file,
  }).outputText
}

// IPC mock：记录调用并返回 canned 结果
const ipcCalls = []
let canned = { success: true, data: [] }
global.window = {
  ipcRenderer: {
    handlePromise: async (channel, args) => {
      ipcCalls.push({ channel, args })
      return canned
    },
  },
}

const deps = {
  vue: require('vue'),
  uuid: require('uuid'),
  moment: require('moment'),
  '@/utils/common': {
    getStore: () => [],
    setStoreAsync: async () => true,
  },
  '@/utils/themeMode': {
    useThemeMode: () => ({ mode: { value: 'light' }, isDark: { value: false } }),
  },
  '@/utils/noteContent': (() => {
    const code = transpile(path.join(root, 'src', 'utils', 'noteContent.ts'))
    const m = { exports: {} }
    new Function('module', 'exports', code)(m, m.exports)
    return m.exports
  })(),
}

const useNotesCode = transpile(path.join(modDir, 'useNotes.ts'))
const module_ = { exports: {} }
// 拦截 useNotes 的依赖引用，映射到 stub / 真实转译模块
new Function('require', 'module', 'exports', useNotesCode)(
  (spec) => {
    if (deps[spec]) return deps[spec]
    return require(spec)
  },
  module_,
  module_.exports
)
const U = module_.exports

let pass = 0
let fail = 0
function assert(cond, msg) {
  if (cond) {
    pass++
    console.log('  ok -', msg)
  } else {
    fail++
    console.log('  FAIL -', msg)
  }
}

console.log('parseNoteTags:')
assert(JSON.stringify(U.parseNoteTags('["a","b"]')) === '["a","b"]', 'JSON 数组正常解析')
assert(JSON.stringify(U.parseNoteTags('"a"')) === '["a"]', '非数组 JSON 容错为单元素')
assert(JSON.stringify(U.parseNoteTags('not-json')) === '["not-json"]', '非法 JSON 容错为原文')
assert(JSON.stringify(U.parseNoteTags(undefined)) === '[]', 'undefined → 空数组')

console.log('buildNoteRow:')
const base = { key: 'k1', createTime: '2020-01-01 00:00:00' }
const row = U.buildNoteRow(base, '<p>hello</p>', '<p>hello</p>', ['t1'])
assert(row.key === 'k1', '保留既有 key')
assert(row.createTime === '2020-01-01 00:00:00', '编辑时保留原 createTime')
assert(row.excerpt === 'hello...', 'excerpt 去标签截断加省略号')
assert(row.tags === '["t1"]', 'tags 序列化为 JSON 字符串')
assert(typeof row.updateTime === 'string' && row.updateTime.length === 19, 'updateTime 刷新')
const row2 = U.buildNoteRow({}, 'x', 'x', [])
assert(row2.key && row2.key.length === 36, '新建时生成 uuid key')

console.log('fetchNotePage IPC 契约与 SQL:')
ipcCalls.length = 0
canned = { success: true, data: [{ key: 'n1', content: 'hi' }] }
U.fetchNotePage("it's", ['tagA'], 3).then(() => {
  const call = ipcCalls[0]
  assert(call.channel === 'new-sql:query', '走 new-sql:query 通道')
  assert(call.args.tableName === 'note_book', 'tableName = note_book')
  const sql = call.args.SqlStr
  assert(sql.includes("''"), '关键词单引号已转义')
  assert(sql.includes("tags LIKE '%tagA%'"), '标签筛选走 tags LIKE')
  assert(/WHERE \(mdText LIKE[\s\S]*AND \(tags/.test(sql) || /WHERE \([\s\S]*\) AND \(/.test(sql), '关键词与标签 AND 组合')
  assert(sql.includes('ORDER BY updateTime DESC LIMIT 20 OFFSET 40'), '分页 LIMIT/OFFSET 正确（第3页 offset=40）')
  assert(sql.startsWith('SELECT * FROM note_book'), 'SQL 以 SELECT * FROM note_book 开头')

  console.log('fetchTagCounts:')
  ipcCalls.length = 0
  canned = { success: true, data: [{ tags: '["a"]' }, { tags: '["a","b"]' }, { tags: null }] }
  U.fetchTagCounts().then((r) => {
    assert(ipcCalls[0].args.SqlStr === 'SELECT tags FROM note_book', '仅查 tags 列')
    assert(r.counts.a === 2 && r.counts.b === 1, '客户端聚合计数正确')
    assert(r.total === 3, '总数正确')

    console.log('upsertNote / deleteNote 契约:')
    ipcCalls.length = 0
    U.upsertNote({ key: 'k1' }).then(() => {
      assert(ipcCalls[0].channel === 'new-sql:upsert', '走 new-sql:upsert')
      assert(ipcCalls[0].args.config.primaryKey === 'key', 'config.primaryKey = key')
      assert(ipcCalls[0].args.tableName === 'note_book', 'tableName = note_book')
      U.deleteNote('k9').then(() => {
        assert(ipcCalls[1].channel === 'new-sql:delete', '走 new-sql:delete')
        assert(JSON.stringify(ipcCalls[1].args.condition) === '{"key":"k9"}', 'condition = {key}')
        console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
        process.exit(fail ? 1 : 0)
      })
    })
  })
})
