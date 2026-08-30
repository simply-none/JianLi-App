/**
 * 记账 store 子模块 - 周期性账单（房租 / 订阅等自动记账）
 *
 * 职责：
 * - 建表与读写 accounting_recurring（周期记账规则）
 * - 自动记账引擎：store 初始化与每 5 分钟检查一次，把 next_date <= 今天的账单
 *   按周期逐期生成 accounting_records（带 recurring_id），并推进 next_date
 * - 防重：dedupe 前查 + accounting_records 上 (recurring_id, record_date) 唯一索引兜底，
 *   保证主窗口 / accountingMini 小窗并发运行引擎也不会产生重复记录
 */
import { ref } from 'vue'
import {
  ACCOUNTING_TABLE,
  ACCOUNTING_RECURRING_TABLE,
  type AccountingRecurring,
} from '@/constants/accounting'
import { accountingIpc, nowStr, todayStr } from './base'
import { advanceOccurrence, nextOccurrenceFrom } from './recurringDate'

/** 周期账单子模块的依赖注入（由主 store 提供） */
interface RecurringDeps {
  /**
   * 引擎实际生成新记录后的回调（主 store：刷新记录缓存 + 广播 + 超支检查）
   *
   * @param affectedMonths - 本次生成记录涉及的月份集合（YYYY-MM）
   */
  onGenerated: (affectedMonths: Set<string>) => Promise<void>
}

/** 新增周期账单的入参（last_date / created_at 由模块内部维护；next_date 必填，亦可由 start_date 兜底） */
export type RecurringAddPayload = Omit<
  AccountingRecurring,
  'id' | 'last_date' | 'created_at'
> & {
  /** 首次执行日期（可选兜底；next_date 为空时按周期 + 执行日取最近的日期。允许填过去日期用于补账） */
  start_date?: string
}

/**
 * 创建周期账单子模块
 *
 * @param deps - 依赖注入
 * @returns 周期账单状态与操作方法
 */
export function createRecurringModule(deps: RecurringDeps) {
  // ============ 状态 ============
  /** 全部周期账单规则 */
  const items = ref<AccountingRecurring[]>([])

  // ============ 表结构（幂等） ============
  let schemaReady: Promise<void> | null = null
  /** 建周期账单表 + 记录表防重唯一索引，仅执行一次 */
  function ensureSchema(): Promise<void> {
    if (!schemaReady) {
      schemaReady = (async () => {
        await accountingIpc('new-sql:execute', {
          sql: `CREATE TABLE IF NOT EXISTS ${ACCOUNTING_RECURRING_TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            type TEXT,
            amount REAL,
            category TEXT,
            note TEXT,
            account TEXT,
            cycle TEXT,
            day TEXT,
            enabled INTEGER,
            next_date TEXT,
            last_date TEXT,
            created_at TEXT
          )`,
        })
        // 唯一索引防重：同一账单同一日期只允许一条自动记录。
        // accounting_records 可能尚未创建（全新环境），失败忽略，待有记录后下轮引擎再建。
        await accountingIpc('new-sql:execute', {
          sql: `CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_rec_recurring
            ON ${ACCOUNTING_TABLE}(recurring_id, record_date)`,
        }).catch(() => {})
      })().catch((e) => {
        schemaReady = null
        throw e
      })
    }
    return schemaReady
  }

  // ============ 读写 ============
  /** 从数据库加载全部周期账单（按下次执行日升序） */
  async function loadRecurring() {
    try {
      await ensureSchema()
      const res = await accountingIpc<{ success: boolean; data?: any[] }>('new-sql:query', {
        tableName: ACCOUNTING_RECURRING_TABLE,
        conditions: {},
        orderBy: 'next_date',
        orderByDesc: false,
      })
      items.value = (res?.data || []).map((r: any) => ({
        id: r.id,
        name: r.name || '',
        type: r.type === 'income' ? 'income' : 'expense',
        amount: Number(r.amount) || 0,
        category: r.category || '',
        note: r.note || '',
        account: r.account || '',
        cycle: r.cycle || 'monthly',
        day: String(r.day ?? ''),
        enabled: Number(r.enabled) ? 1 : 0,
        next_date: r.next_date || '',
        last_date: r.last_date || '',
        created_at: r.created_at || '',
      }))
    } catch (e) {
      console.error('加载周期账单失败', e)
      items.value = []
    }
  }

  /** 根据周期 + 执行日计算默认的下次执行日（从今天起算，含今天） */
  function defaultNextDate(cycle: AccountingRecurring['cycle'], day: string): string {
    return nextOccurrenceFrom(todayStr(), cycle, day)
  }

  /**
   * 新增周期账单
   *
   * @param payload - 账单内容（含可选 start_date 首次执行日）
   * @returns 是否成功
   */
  async function addRecurring(payload: RecurringAddPayload): Promise<boolean> {
    await ensureSchema()
    const { start_date, ...rest } = payload
    const data = {
      ...rest,
      enabled: rest.enabled ? 1 : 0,
      next_date: rest.next_date || start_date || defaultNextDate(rest.cycle, rest.day),
      created_at: nowStr(),
    }
    const res = await accountingIpc('new-sql:insert', {
      tableName: ACCOUNTING_RECURRING_TABLE,
      data,
      config: { primaryKey: 'id' },
    })
    await loadRecurring()
    if (res?.success) void runDueBills() // 立刻跑一轮，start_date 已过期能马上补账
    return !!res?.success
  }

  /**
   * 修改周期账单（patch 全量提交需要变更的字段）
   *
   * @param id - 账单 id
   * @param patch - 变更字段；含 next_date 时直接采用（编辑弹窗在周期/执行日变化时重算）
   * @returns 是否成功
   */
  async function updateRecurring(id: number, patch: Partial<AccountingRecurring>): Promise<boolean> {
    await ensureSchema()
    const data: Record<string, any> = { ...patch }
    if (data.enabled !== undefined) data.enabled = data.enabled ? 1 : 0
    if (Object.keys(data).length === 0) return true
    const res = await accountingIpc('new-sql:update', {
      tableName: ACCOUNTING_RECURRING_TABLE,
      data,
      condition: { id },
    })
    await loadRecurring()
    if (res?.success) void runDueBills()
    return !!res?.success
  }

  /**
   * 删除周期账单（已生成的历史记录保留，不联动删除）
   *
   * @param id - 账单 id
   * @returns 是否成功
   */
  async function deleteRecurring(id: number): Promise<boolean> {
    await ensureSchema()
    const res = await accountingIpc('new-sql:delete', {
      tableName: ACCOUNTING_RECURRING_TABLE,
      condition: { id },
    })
    await loadRecurring()
    return !!res?.success
  }

  /**
   * 启用 / 停用账单。重新启用时若 next_date 已过期，
   * 重置为「从今天起算」的下一期，避免一次性补出大量历史记录。
   *
   * @param bill - 目标账单
   * @returns 是否成功
   */
  async function toggleEnabled(bill: AccountingRecurring): Promise<boolean> {
    if (!bill.id) return false
    const enabled = bill.enabled ? 0 : 1
    const patch: Partial<AccountingRecurring> = { enabled }
    if (enabled && bill.next_date && bill.next_date < todayStr()) {
      patch.next_date = defaultNextDate(bill.cycle, bill.day)
    }
    return updateRecurring(bill.id, patch)
  }

  // ============ 自动记账引擎 ============
  /** 防止多轮引擎并发执行 */
  let engineRunning = false
  /** 引擎定时器句柄 */
  let engineTimer: ReturnType<typeof setInterval> | null = null

  /** 检查某账单某日期的记录是否已生成（防重第一道闸） */
  async function recordExists(recurringId: number, date: string): Promise<boolean> {
    const cnt = await accountingIpc<{ success: boolean; data?: number }>('new-sql:count', {
      tableName: ACCOUNTING_TABLE,
      condition: { recurring_id: recurringId, record_date: date },
    })
    return !!cnt?.success && (cnt.data || 0) > 0
  }

  /** 写入一条自动记账记录（唯一索引冲突等失败返回 false，不中断引擎） */
  async function insertBillRecord(bill: AccountingRecurring, date: string): Promise<boolean> {
    try {
      const res = await accountingIpc('new-sql:insert', {
        tableName: ACCOUNTING_TABLE,
        data: {
          type: bill.type,
          amount: bill.amount,
          category: bill.category,
          note: bill.note || bill.name,
          account: bill.account || '',
          record_date: date,
          recurring_id: bill.id,
        },
        config: { primaryKey: 'id' },
      })
      return !!res?.success
    } catch {
      // 多为唯一索引冲突（另一窗口已生成），视为已存在
      return false
    }
  }

  /**
   * 执行一轮到期检查：把所有启用中且 next_date <= 今天的账单逐期生成记录并推进 next_date
   *
   * @returns 本轮是否实际生成了新记录
   */
  async function runDueBills(): Promise<boolean> {
    if (engineRunning) return false
    engineRunning = true
    try {
      await loadRecurring()
      const today = todayStr()
      const affectedMonths = new Set<string>()
      let inserted = 0

      for (const bill of items.value) {
        if (!bill.enabled || !bill.id) continue
        if (!bill.next_date || bill.next_date > today) continue

        let cursor = bill.next_date
        let last = bill.last_date || ''
        // 上限 366 期：防止异常数据（如 1900 年的 next_date）导致死循环
        for (let guard = 0; cursor <= today && guard < 366; guard++) {
          if (await recordExists(bill.id, cursor)) {
            last = cursor
          } else if (await insertBillRecord(bill, cursor)) {
            inserted++
            last = cursor
            affectedMonths.add(cursor.slice(0, 7))
          }
          cursor = advanceOccurrence(cursor, bill.cycle, bill.day)
        }
        if (cursor !== bill.next_date) {
          await accountingIpc('new-sql:update', {
            tableName: ACCOUNTING_RECURRING_TABLE,
            data: { next_date: cursor, last_date: last },
            condition: { id: bill.id },
          })
        }
      }

      await loadRecurring()
      if (inserted > 0) await deps.onGenerated(affectedMonths)
      return inserted > 0
    } catch (e) {
      console.error('周期账单自动记账失败', e)
      return false
    } finally {
      engineRunning = false
    }
  }

  /**
   * 启动调度：初始化后立即跑一轮，此后每 5 分钟检查一次（跨天 / 长挂机场景覆盖）
   */
  function startScheduler() {
    if (engineTimer) return
    void runDueBills()
    engineTimer = setInterval(() => void runDueBills(), 5 * 60 * 1000)
  }

  return {
    items,
    loadRecurring,
    addRecurring,
    updateRecurring,
    deleteRecurring,
    toggleEnabled,
    defaultNextDate,
    runDueBills,
    startScheduler,
  }
}

export type RecurringModule = ReturnType<typeof createRecurringModule>
