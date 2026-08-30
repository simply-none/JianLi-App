/**
 * 记账功能 - 共用信息层（Pinia store）
 *
 * 职责：
 * - 分类配置：持久化到 SQLite 表 accounting_categories（分类）+ accounting_keywords（关键字），
 *   首次启动若分类表为空则批量写入 DEFAULT_CATEGORIES 种子（含各分类关键词）。
 * - 记账记录：缓存于内存，来源 SQLite 表 accounting_records（自动建表/加列）。
 * - 预算管理：月度分类预算 + 超支提醒（子模块 @/store/accounting/budget）。
 * - 周期性账单：房租/订阅等自动记账引擎（子模块 @/store/accounting/recurring）。
 * - 增删改：落库后刷新本地缓存，并广播 sync-data-to-other-window 让另一窗口同步。
 * - 页面（完整页）与小窗口（accountingMini）共用同一 store，数据天然一致。
 */
import { computed, onMounted, ref } from 'vue'
import { defineStore } from 'pinia'
import { send } from '@/utils/common'
import { sysNotify } from '@/utils/notify'
import {
  ACCOUNTING_TABLE,
  ACCOUNTING_CATEGORIES_TABLE,
  ACCOUNTING_KEYWORDS_TABLE,
  DEFAULT_CATEGORIES,
  type AccountingCategory,
  type AccountingRecord,
  type AccountingType,
} from '@/constants/accounting'
import { accountingIpc, nowStr } from './accounting/base'
import { createBudgetModule, type BudgetModule } from './accounting/budget'
import { createRecurringModule, type RecurringModule } from './accounting/recurring'

export default defineStore('accounting', () => {
  // ============ 状态 ============
  const categories = ref<AccountingCategory[]>([])
  const records = ref<AccountingRecord[]>([])
  const loading = ref(false)

  // ============ 子模块（预算 / 周期账单） ============
  const budget: BudgetModule = createBudgetModule({
    records: () => records.value,
  })
  const recurring: RecurringModule = createRecurringModule({
    onGenerated: async (affectedMonths) => {
      await loadRecords()
      broadcastChange()
      checkOverspend(affectedMonths)
    },
  })

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
        await accountingIpc('new-sql:execute', {
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
        await accountingIpc('new-sql:execute', {
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
    budget.loadBudgets()
    recurring.loadRecurring()
    // 周期账单自动记账引擎：立即跑一轮 + 每 5 分钟检查（覆盖跨天与长挂机）
    recurring.startScheduler()
    // 监听另一窗口的数据变更广播，主动刷新本窗口缓存
    window.ipcRenderer?.on('sync-data-to-other-window', (_e: any, arg: any) => {
      if (arg && arg.accountingDataChanged) {
        loadCategories()
        loadRecords()
        budget.loadBudgets()
        recurring.loadRecurring()
      }
    })
  }

  // ============ 分类读写 ============
  /** 分类表为空时批量写入默认种子（分类 + 关键字） */
  async function seedIfEmpty() {
    const cnt = await accountingIpc<{ success: boolean; data?: number }>('new-sql:count', {
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
    await accountingIpc('new-sql:insert', {
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
      await accountingIpc('new-sql:insert', {
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

      const catRes = await accountingIpc<{ success: boolean; data?: any[] }>('new-sql:query', {
        tableName: ACCOUNTING_CATEGORIES_TABLE,
        conditions: {},
        orderBy: 'sort',
        orderByDesc: false,
      })
      const kwRes = await accountingIpc<{ success: boolean; data?: any[] }>('new-sql:query', {
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
    await accountingIpc('new-sql:insert', {
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
      await accountingIpc('new-sql:insert', {
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
      await accountingIpc('new-sql:update', {
        tableName: ACCOUNTING_CATEGORIES_TABLE,
        data,
        condition: { name },
      })
    }
    // 改名时同步迁移关键字表的 category_id 关联（关键词内容不变）
    if (patch.name !== undefined && patch.name !== name) {
      await accountingIpc('new-sql:update', {
        tableName: ACCOUNTING_KEYWORDS_TABLE,
        data: { category_id: patch.name },
        condition: { category_id: name },
      })
    }
    if (patch.keywords !== undefined) {
      // 先删后插，保证关键字与分类一致（用可能的改名后的 name 重新关联）
      const targetId = patch.name || name
      await accountingIpc('new-sql:delete', {
        tableName: ACCOUNTING_KEYWORDS_TABLE,
        condition: { category_id: name },
      })
      if (patch.keywords.length > 0) {
        const cur = nowStr()
        await accountingIpc('new-sql:insert', {
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
    await accountingIpc('new-sql:delete', {
      tableName: ACCOUNTING_CATEGORIES_TABLE,
      condition: { name },
    })
    await accountingIpc('new-sql:delete', {
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
    await accountingIpc('new-sql:insert', {
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
    await accountingIpc('new-sql:delete', {
      tableName: ACCOUNTING_KEYWORDS_TABLE,
      condition: { category_id: categoryId, keyword: oldKeyword },
    })
    if (newKeyword && newKeyword !== oldKeyword) {
      const cur = nowStr()
      await accountingIpc('new-sql:insert', {
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
    await accountingIpc('new-sql:delete', {
      tableName: ACCOUNTING_KEYWORDS_TABLE,
      condition: { category_id: categoryId, keyword },
    })
    await loadCategories()
    broadcastChange()
  }

  /** 恢复默认分类：清空两表后重新播种 */
  async function resetCategories() {
    await ensureSchema()
    await accountingIpc('new-sql:execute', { sql: `DELETE FROM ${ACCOUNTING_CATEGORIES_TABLE}` })
    await accountingIpc('new-sql:execute', { sql: `DELETE FROM ${ACCOUNTING_KEYWORDS_TABLE}` })
    await seedIfEmpty()
    await loadCategories()
    broadcastChange()
  }

  // ============ 记录读写 ============
  async function loadRecords() {
    loading.value = true
    try {
      const res = await accountingIpc('new-sql:query', {
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
          recurring_id: r.recurring_id != null ? Number(r.recurring_id) : undefined,
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

  // ============ 超支提醒 ============
  /** 会话内已提醒过的超支项（month::category），每项只提醒一次防骚扰 */
  const overspendNotified = new Set<string>()

  /**
   * 检查指定月份的预算超支情况，对尚未提醒过的超支项发起系统通知
   *
   * @param months - 需要检查的月份集合（YYYY-MM）
   */
  function checkOverspend(months: Iterable<string>) {
    try {
      for (const m of months) {
        if (!/^\d{4}-\d{2}$/.test(m)) continue
        for (const s of budget.monthStatus(m)) {
          if (!s.over || s.budget <= 0) continue
          const key = `${m}::${s.category}`
          if (overspendNotified.has(key)) continue
          overspendNotified.add(key)
          const label = `${m.slice(0, 4)}年${Number(m.slice(5, 7))}月`
          sysNotify(
            '记账预算超支提醒',
            `${label}「${s.label}」已超支：已支出 ¥${s.spent.toFixed(2)} / 预算 ¥${s.budget.toFixed(2)}`,
            '',
            6,
          )
        }
      }
    } catch {
      /* 提醒失败不影响记账主流程 */
    }
  }

  /** 新增一条记录（自动写入 created_at），返回新记录或 null */
  async function addRecord(payload: Omit<AccountingRecord, 'id' | 'created_at'>): Promise<AccountingRecord | null> {
    const cur = new Date()
    const createdAt = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')} ${String(cur.getHours()).padStart(2, '0')}:${String(cur.getMinutes()).padStart(2, '0')}:${String(cur.getSeconds()).padStart(2, '0')}`
    const data = { ...payload, created_at: createdAt }
    const res = await accountingIpc('new-sql:insert', {
      tableName: ACCOUNTING_TABLE,
      data,
      config: { primaryKey: 'id' },
    })
    if (res?.success) {
      await loadRecords()
      broadcastChange()
      // 记账后即时做预算超支判定（记录日期所属月份）
      if (payload.record_date) checkOverspend([payload.record_date.slice(0, 7)])
      // 取最新一条作为返回值
      return records.value[0] || null
    }
    return null
  }

  /** 修改记录（可能改动日期/分类/金额，前后月份都纳入超支检查） */
  async function updateRecord(id: number, payload: Partial<AccountingRecord>): Promise<boolean> {
    const before = records.value.find((r) => r.id === id)
    const res = await accountingIpc('new-sql:update', {
      tableName: ACCOUNTING_TABLE,
      data: payload,
      condition: { id },
    })
    if (res?.success) {
      await loadRecords()
      broadcastChange()
      const months = new Set<string>()
      if (before?.record_date) months.add(before.record_date.slice(0, 7))
      if (payload.record_date) months.add(payload.record_date.slice(0, 7))
      checkOverspend(months)
      return true
    }
    return false
  }

  /** 删除记录 */
  async function deleteRecord(id: number): Promise<boolean> {
    const before = records.value.find((r) => r.id === id)
    const res = await accountingIpc('new-sql:delete', {
      tableName: ACCOUNTING_TABLE,
      condition: { id },
    })
    if (res?.success) {
      records.value = records.value.filter((r) => r.id !== id)
      broadcastChange()
      // 删除也可能使超支恢复，同月复检（超支项只提醒一次，不会重复打扰）
      if (before?.record_date) checkOverspend([before.record_date.slice(0, 7)])
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
    // 预算（子模块成员拍平暴露，保证 Pinia ref 解包）
    budgets: budget.budgets,
    loadBudgets: budget.loadBudgets,
    setBudget: budget.setBudget,
    removeBudget: budget.removeBudget,
    monthSpend: budget.monthSpend,
    monthStatus: budget.monthStatus,
    hasBudget: budget.hasBudget,
    // 周期账单（子模块成员拍平暴露）
    recurringItems: recurring.items,
    loadRecurring: recurring.loadRecurring,
    addRecurring: recurring.addRecurring,
    updateRecurring: recurring.updateRecurring,
    deleteRecurring: recurring.deleteRecurring,
    toggleRecurringEnabled: recurring.toggleEnabled,
    defaultRecurringNextDate: recurring.defaultNextDate,
    runDueBills: recurring.runDueBills,
  }
})
