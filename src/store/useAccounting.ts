/**
 * 记账功能 - 共用信息层（Pinia store）
 *
 * 职责：
 * - 分类配置：持久化到 SQLite 表 accounting_categories（分类）+ accounting_keywords（关键字），
 *   首次启动若分类表为空则批量写入 DEFAULT_CATEGORIES 种子（含各分类关键词）。
 * - 记账记录：缓存于内存，来源 SQLite 表 accounting_records（自动建表/加列）。
 * - 增删改：落库后刷新本地缓存，并广播 sync-data-to-other-window 让另一窗口同步。
 * - 页面（完整页）与小窗口（accountingMini）共用同一 store，数据天然一致。
 */

import { computed, onMounted, ref } from 'vue'
import { defineStore } from 'pinia'
import { send } from '@/utils/common'
import {
  ACCOUNTING_TABLE,
  ACCOUNTING_CATEGORIES_TABLE,
  ACCOUNTING_KEYWORDS_TABLE,
  DEFAULT_CATEGORIES,
  type AccountingCategory,
  type AccountingRecord,
  type AccountingType,
} from '@/constants/accounting'

// 复用项目既有 new-sql IPC（启动已 initNewSqlite，表与列自动创建）
function ipc<T = any>(channel: string, payload: any): Promise<T> {
  return window.ipcRenderer.handlePromise(channel, payload) as Promise<T>
}

/** 当前时间字符串 YYYY-MM-DD HH:mm:ss */
function nowStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export default defineStore('accounting', () => {
  // ============ 状态 ============
  const categories = ref<AccountingCategory[]>([])
  const records = ref<AccountingRecord[]>([])
  const loading = ref(false)

  // ============ 分类派生 ============
  const expenseCategories = computed(() =>
    categories.value.filter((c) => c.type === 'expense'),
  )
  const incomeCategories = computed(() =>
    categories.value.filter((c) => c.type === 'income'),
  )

  // ============ 表结构初始化（幂等，仅执行一次） ============
  let schemaReady: Promise<void> | null = null
  function ensureSchema(): Promise<void> {
    if (!schemaReady) {
      schemaReady = (async () => {
        // 分类表：以分类 name 作为主键，与记账记录的分类字段天然关联
        await ipc('new-sql:execute', {
          sql: `CREATE TABLE IF NOT EXISTS ${ACCOUNTING_CATEGORIES_TABLE} (
            name TEXT PRIMARY KEY,
            type TEXT,
            icon TEXT,
            color TEXT,
            sort INTEGER,
            created_at TEXT
          )`,
        })
        // 关键字表：每条关键词一行，category_id 关联分类表 name
        await ipc('new-sql:execute', {
          sql: `CREATE TABLE IF NOT EXISTS ${ACCOUNTING_KEYWORDS_TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id TEXT,
            keyword TEXT,
            created_at TEXT
          )`,
        })
      })().catch((e) => {
        schemaReady = null
        throw e
      })
    }
    return schemaReady
  }

  // ============ 初始化 ============
  function init() {
    loadCategories()
    loadRecords()
    // 监听另一窗口的数据变更广播，主动刷新本窗口缓存
    window.ipcRenderer?.on('sync-data-to-other-window', (_e: any, arg: any) => {
      if (arg && arg.accountingDataChanged) {
        loadCategories()
        loadRecords()
      }
    })
  }

  // ============ 分类读写 ============
  /** 分类表为空时批量写入默认种子（分类 + 关键字） */
  async function seedIfEmpty() {
    const cnt = await ipc<{ success: boolean; data?: number }>('new-sql:count', {
      tableName: ACCOUNTING_CATEGORIES_TABLE,
    })
    if (cnt?.success && (cnt.data || 0) > 0) return

    const cur = nowStr()
    const catRows = DEFAULT_CATEGORIES.map((c, i) => ({
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
      sort: i,
      created_at: cur,
    }))
    await ipc('new-sql:insert', {
      tableName: ACCOUNTING_CATEGORIES_TABLE,
      data: catRows,
      config: { primaryKey: 'name' },
    })

    const kwRows = DEFAULT_CATEGORIES.flatMap((c) =>
      (c.keywords || []).map((kw) => ({
        category_id: c.name,
        keyword: kw,
        created_at: cur,
      })),
    )
    if (kwRows.length > 0) {
      await ipc('new-sql:insert', {
        tableName: ACCOUNTING_KEYWORDS_TABLE,
        data: kwRows,
        config: { primaryKey: 'id' },
      })
    }
  }

  /** 从数据库加载分类，并把关键字表数据按 category_id 关联到每个分类的 keywords 数组 */
  async function loadCategories() {
    try {
      await ensureSchema()
      await seedIfEmpty()

      const catRes = await ipc<{ success: boolean; data?: any[] }>('new-sql:query', {
        tableName: ACCOUNTING_CATEGORIES_TABLE,
        conditions: {},
        orderBy: 'sort',
        orderByDesc: false,
      })
      const kwRes = await ipc<{ success: boolean; data?: any[] }>('new-sql:query', {
        tableName: ACCOUNTING_KEYWORDS_TABLE,
        conditions: {},
      })

      const kwMap: Record<string, string[]> = {}
      ;(kwRes?.data || []).forEach((r: any) => {
        const cid = r.category_id
        if (!kwMap[cid]) kwMap[cid] = []
        if (r.keyword) kwMap[cid].push(r.keyword)
      })

      categories.value = (catRes?.data || []).map((r: any) => ({
        name: r.name,
        type: r.type,
        icon: r.icon,
        color: r.color,
        sort: typeof r.sort === 'number' ? r.sort : Number(r.sort) || 0,
        keywords: kwMap[r.name] || [],
      }))
    } catch (e) {
      console.error('加载记账分类失败', e)
      categories.value = []
    }
  }

  /** 计算某类型下新分类的排序序号（追加到末尾） */
  function nextSort(type: AccountingType): number {
    const same = categories.value.filter((c) => c.type === type)
    if (!same.length) return 0
    return Math.max(...same.map((c) => c.sort ?? 0)) + 1
  }

  /** 新增分类（同时写入其关键词） */
  async function addCategory(cat: AccountingCategory) {
    const cur = nowStr()
    await ensureSchema()
    await ipc('new-sql:insert', {
      tableName: ACCOUNTING_CATEGORIES_TABLE,
      data: {
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        sort: nextSort(cat.type),
        created_at: cur,
      },
      config: { primaryKey: 'name' },
    })
    if (cat.keywords && cat.keywords.length > 0) {
      await ipc('new-sql:insert', {
        tableName: ACCOUNTING_KEYWORDS_TABLE,
        data: cat.keywords.map((kw) => ({
          category_id: cat.name,
          keyword: kw,
          created_at: cur,
        })),
        config: { primaryKey: 'id' },
      })
    }
    await loadCategories()
    broadcastChange()
  }

  /** 更新分类（按 name 匹配；若 patch 含 keywords 则整体替换该分类的关键词） */
  async function updateCategory(name: string, patch: Partial<AccountingCategory>) {
    const data: Record<string, any> = {}
    if (patch.type !== undefined) data.type = patch.type
    if (patch.icon !== undefined) data.icon = patch.icon
    if (patch.color !== undefined) data.color = patch.color
    if (patch.name !== undefined) data.name = patch.name
    await ensureSchema()
    if (Object.keys(data).length > 0) {
      await ipc('new-sql:update', {
        tableName: ACCOUNTING_CATEGORIES_TABLE,
        data,
        condition: { name },
      })
    }
    // 改名时同步迁移关键字表的 category_id 关联（关键词内容不变）
    if (patch.name !== undefined && patch.name !== name) {
      await ipc('new-sql:update', {
        tableName: ACCOUNTING_KEYWORDS_TABLE,
        data: { category_id: patch.name },
        condition: { category_id: name },
      })
    }
    if (patch.keywords !== undefined) {
      // 先删后插，保证关键字与分类一致（用可能的改名后的 name 重新关联）
      const targetId = patch.name || name
      await ipc('new-sql:delete', {
        tableName: ACCOUNTING_KEYWORDS_TABLE,
        condition: { category_id: name },
      })
      if (patch.keywords.length > 0) {
        const cur = nowStr()
        await ipc('new-sql:insert', {
          tableName: ACCOUNTING_KEYWORDS_TABLE,
          data: patch.keywords.map((kw) => ({
            category_id: targetId,
            keyword: kw,
            created_at: cur,
          })),
          config: { primaryKey: 'id' },
        })
      }
    }
    await loadCategories()
    broadcastChange()
  }

  /** 删除分类（同时删除其关键字） */
  async function deleteCategory(name: string) {
    await ensureSchema()
    await ipc('new-sql:delete', {
      tableName: ACCOUNTING_CATEGORIES_TABLE,
      condition: { name },
    })
    await ipc('new-sql:delete', {
      tableName: ACCOUNTING_KEYWORDS_TABLE,
      condition: { category_id: name },
    })
    await loadCategories()
    broadcastChange()
  }

  // ============ 关键字读写（每条关键字独立落 accounting_keywords 表） ============
  /** 给某分类新增一个关键字 */
  async function addKeyword(categoryId: string, keyword: string) {
    await ensureSchema()
    const cur = nowStr()
    await ipc('new-sql:insert', {
      tableName: ACCOUNTING_KEYWORDS_TABLE,
      data: { category_id: categoryId, keyword, created_at: cur },
      config: { primaryKey: 'id' },
    })
    await loadCategories()
    broadcastChange()
  }

  /** 重命名某分类下的一个关键字（删除旧值后插入新值） */
  async function updateKeyword(categoryId: string, oldKeyword: string, newKeyword: string) {
    await ensureSchema()
    await ipc('new-sql:delete', {
      tableName: ACCOUNTING_KEYWORDS_TABLE,
      condition: { category_id: categoryId, keyword: oldKeyword },
    })
    if (newKeyword && newKeyword !== oldKeyword) {
      const cur = nowStr()
      await ipc('new-sql:insert', {
        tableName: ACCOUNTING_KEYWORDS_TABLE,
        data: { category_id: categoryId, keyword: newKeyword, created_at: cur },
        config: { primaryKey: 'id' },
      })
    }
    await loadCategories()
    broadcastChange()
  }

  /** 删除某分类下的一个关键字 */
  async function deleteKeyword(categoryId: string, keyword: string) {
    await ensureSchema()
    await ipc('new-sql:delete', {
      tableName: ACCOUNTING_KEYWORDS_TABLE,
      condition: { category_id: categoryId, keyword },
    })
    await loadCategories()
    broadcastChange()
  }

  /** 恢复默认分类：清空两表后重新播种 */
  async function resetCategories() {
    await ensureSchema()
    await ipc('new-sql:execute', { sql: `DELETE FROM ${ACCOUNTING_CATEGORIES_TABLE}` })
    await ipc('new-sql:execute', { sql: `DELETE FROM ${ACCOUNTING_KEYWORDS_TABLE}` })
    await seedIfEmpty()
    await loadCategories()
    broadcastChange()
  }

  // ============ 记录读写 ============
  async function loadRecords() {
    loading.value = true
    try {
      const res = await ipc('new-sql:query', {
        tableName: ACCOUNTING_TABLE,
        conditions: {},
        orderBy: 'record_date',
        orderByDesc: true,
      })
      const rows: any[] = res?.success ? res.data || [] : []
      records.value = rows
        .map((r) => ({
          id: r.id,
          type: r.type,
          amount: Number(r.amount) || 0,
          category: r.category || '',
          note: r.note || '',
          account: r.account || '',
          record_date: r.record_date || '',
          created_at: r.created_at || r.create_time || '',
        }))
        // 同一天内按 id 倒序（新录入在前）
        .sort((a, b) => {
          if (a.record_date !== b.record_date) return 0
          return (b.id || 0) - (a.id || 0)
        })
    } catch (e) {
      console.error('加载记账记录失败', e)
      records.value = []
    } finally {
      loading.value = false
    }
  }

  /** 新增一条记录（自动写入 created_at），返回新记录或 null */
  async function addRecord(payload: Omit<AccountingRecord, 'id' | 'created_at'>): Promise<AccountingRecord | null> {
    const cur = new Date()
    const createdAt = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')} ${String(cur.getHours()).padStart(2, '0')}:${String(cur.getMinutes()).padStart(2, '0')}:${String(cur.getSeconds()).padStart(2, '0')}`
    const data = { ...payload, created_at: createdAt }
    const res = await ipc('new-sql:insert', {
      tableName: ACCOUNTING_TABLE,
      data,
      config: { primaryKey: 'id' },
    })
    if (res?.success) {
      await loadRecords()
      broadcastChange()
      // 取最新一条作为返回值
      return records.value[0] || null
    }
    return null
  }

  /** 修改记录 */
  async function updateRecord(id: number, payload: Partial<AccountingRecord>): Promise<boolean> {
    const res = await ipc('new-sql:update', {
      tableName: ACCOUNTING_TABLE,
      data: payload,
      condition: { id },
    })
    if (res?.success) {
      await loadRecords()
      broadcastChange()
      return true
    }
    return false
  }

  /** 删除记录 */
  async function deleteRecord(id: number): Promise<boolean> {
    const res = await ipc('new-sql:delete', {
      tableName: ACCOUNTING_TABLE,
      condition: { id },
    })
    if (res?.success) {
      records.value = records.value.filter((r) => r.id !== id)
      broadcastChange()
      return true
    }
    return false
  }

  /** 广播数据变更，通知其它窗口同步刷新 */
  function broadcastChange() {
    try {
      send('sync-data-to-other-window', { accountingDataChanged: true })
    } catch {
      /* 忽略 */
    }
  }

  onMounted(() => {
    init()
  })

  return {
    // 状态
    categories,
    records,
    loading,
    // 派生
    expenseCategories,
    incomeCategories,
    // 分类方法
    loadCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    resetCategories,
    // 关键字方法
    addKeyword,
    updateKeyword,
    deleteKeyword,
    // 记录方法
    loadRecords,
    addRecord,
    updateRecord,
    deleteRecord,
  }
})
