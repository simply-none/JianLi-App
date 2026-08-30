/**
 * 记账 store 子模块 - 月度预算
 *
 * 职责：
 * - 建表与读写 accounting_budgets（主键 key = `${month}::${category}`）
 * - 按月统计各分类（及总预算）的实际支出，生成预算进度状态
 * - 供主 store 在记录增删改后做「超支判定 → 系统通知」，及 BudgetPanel 渲染
 *
 * 注意：预算只针对「支出」维度（含月度总预算），收入不设预算。
 */
import { ref } from 'vue'
import {
  ACCOUNTING_BUDGETS_TABLE,
  BUDGET_TOTAL_CATEGORY,
  type AccountingBudget,
  type AccountingRecord,
} from '@/constants/accounting'
import { accountingIpc, nowStr } from './base'

/** 单个预算条目的状态（供 UI 与超支提醒共用） */
export interface BudgetStatus {
  /** 分类名；BUDGET_TOTAL_CATEGORY 表示月度总预算 */
  category: string
  /** 展示名（总预算 → 「本月总预算」，其余为分类名） */
  label: string
  /** 预算金额（元） */
  budget: number
  /** 实际支出（元） */
  spent: number
  /** 支出占预算比例（预算为 0 时为 0） */
  ratio: number
  /** 是否超支（支出 >= 预算） */
  over: boolean
  /** 是否接近超支（比例 >= 0.8 且未超支） */
  near: boolean
}

/** 预算子模块的依赖注入（由主 store 提供） */
interface BudgetDeps {
  /** 记录数组（响应式），用于统计各分类当月支出 */
  records: () => AccountingRecord[]
}

/**
 * 创建预算子模块
 *
 * @param deps - 依赖注入
 * @returns 预算状态与操作方法
 */
export function createBudgetModule(deps: BudgetDeps) {
  // ============ 状态 ============
  /** 全部预算行（不分月份，按需过滤） */
  const budgets = ref<AccountingBudget[]>([])

  // ============ 表结构（幂等） ============
  let schemaReady: Promise<void> | null = null
  /** 建预算表（key 复合主键：月份::分类），仅执行一次 */
  function ensureSchema(): Promise<void> {
    if (!schemaReady) {
      schemaReady = (async () => {
        await accountingIpc('new-sql:execute', {
          sql: `CREATE TABLE IF NOT EXISTS ${ACCOUNTING_BUDGETS_TABLE} (
            key TEXT PRIMARY KEY,
            month TEXT,
            category TEXT,
            amount REAL,
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

  // ============ 读写 ============
  /** 从数据库加载全部预算 */
  async function loadBudgets() {
    try {
      await ensureSchema()
      const res = await accountingIpc<{ success: boolean; data?: any[] }>('new-sql:query', {
        tableName: ACCOUNTING_BUDGETS_TABLE,
        conditions: {},
        orderBy: 'month',
        orderByDesc: true,
      })
      budgets.value = (res?.data || []).map((r: any) => ({
        key: r.key,
        month: r.month || '',
        category: r.category || '',
        amount: Number(r.amount) || 0,
        created_at: r.created_at || '',
      }))
    } catch (e) {
      console.error('加载记账预算失败', e)
      budgets.value = []
    }
  }

  /** 组装预算主键 */
  function budgetKey(month: string, category: string): string {
    return `${month}::${category}`
  }

  /**
   * 设置（新增或修改）某月某分类的预算金额
   *
   * @param month - 月份 YYYY-MM
   * @param category - 分类名或 BUDGET_TOTAL_CATEGORY
   * @param amount - 预算金额（元）；<=0 视为删除该预算
   * @returns 是否成功
   */
  async function setBudget(month: string, category: string, amount: number): Promise<boolean> {
    if (!month || !category) return false
    await ensureSchema()
    if (amount <= 0) {
      await removeBudget(month, category)
      return true
    }
    const res = await accountingIpc('new-sql:upsert', {
      tableName: ACCOUNTING_BUDGETS_TABLE,
      data: {
        key: budgetKey(month, category),
        month,
        category,
        amount,
        created_at: nowStr(),
      },
      config: { primaryKey: 'key' },
    })
    await loadBudgets()
    return !!res?.success
  }

  /**
   * 删除某月某分类的预算
   *
   * @param month - 月份 YYYY-MM
   * @param category - 分类名或 BUDGET_TOTAL_CATEGORY
   * @returns 是否成功
   */
  async function removeBudget(month: string, category: string): Promise<boolean> {
    await ensureSchema()
    const res = await accountingIpc('new-sql:delete', {
      tableName: ACCOUNTING_BUDGETS_TABLE,
      condition: { key: budgetKey(month, category) },
    })
    await loadBudgets()
    return !!res?.success
  }

  // ============ 统计与状态 ============
  /**
   * 统计某月（某分类）的实际支出
   *
   * @param month - 月份 YYYY-MM
   * @param category - 分类名；缺省统计全部支出（对应总预算口径）
   * @returns 支出金额（元）
   */
  function monthSpend(month: string, category?: string): number {
    let sum = 0
    for (const r of deps.records()) {
      if (r.type !== 'expense') continue
      if (!(r.record_date || '').startsWith(month + '-')) continue
      if (category && r.category !== category) continue
      sum += Number(r.amount) || 0
    }
    return sum
  }

  /**
   * 生成某月的全部预算状态（供进度条渲染与超支判定）
   *
   * @param month - 月份 YYYY-MM
   * @returns 预算状态数组（总预算在首位，其后按支出降序）
   */
  function monthStatus(month: string): BudgetStatus[] {
    const rows = budgets.value.filter((b) => b.month === month)
    const list: BudgetStatus[] = rows.map((b) => {
      const spent =
        b.category === BUDGET_TOTAL_CATEGORY ? monthSpend(month) : monthSpend(month, b.category)
      return buildStatus(b.category, b.amount, spent)
    })
    // 总预算排最前，其余按占比降序（超支的浮到最上面）
    return list.sort((a, b) => {
      if (a.category === BUDGET_TOTAL_CATEGORY) return -1
      if (b.category === BUDGET_TOTAL_CATEGORY) return 1
      return b.ratio - a.ratio
    })
  }

  /** 由分类/预算/支出组装状态对象 */
  function buildStatus(category: string, budget: number, spent: number): BudgetStatus {
    const ratio = budget > 0 ? spent / budget : 0
    return {
      category,
      label: category === BUDGET_TOTAL_CATEGORY ? '本月总预算' : category,
      budget,
      spent: Number(spent.toFixed(2)),
      ratio,
      over: budget > 0 && spent >= budget,
      near: budget > 0 && spent < budget && ratio >= 0.8,
    }
  }

  /** 某月某分类是否已设预算 */
  function hasBudget(month: string, category: string): boolean {
    return budgets.value.some((b) => b.month === month && b.category === category)
  }

  return {
    budgets,
    loadBudgets,
    setBudget,
    removeBudget,
    monthSpend,
    monthStatus,
    hasBudget,
  }
}

export type BudgetModule = ReturnType<typeof createBudgetModule>
