/**
 * 调色板工具 - 状态与数据层（Pinia store）
 *
 * 职责：
 * - 维护当前基准色（HSV）、配色方案类型、工作区色块列表。
 * - 配色方案生成、对比度、色盲模拟均为纯计算（见 colorMath.ts），本 store 只管状态。
 * - 持久化：色板存 color_palette 表，快速收藏色存 color_favorite 表，
 *   复用项目既有 new-sql IPC（启动已 initNewSqlite，表自动创建/加列）。
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  COLOR_FAVORITE_TABLE,
  COLOR_PALETTE_TABLE,
  type ColorFavorite,
  type HarmonyType,
  type HSV,
  type SavedPalette,
} from './types'
import { generateHarmony, hexToHsv, hsvToHexa, parseAlpha, toShortHex } from './colorMath'

// 复用项目既有 new-sql IPC 封装（与 useAccounting 一致）
function ipc<T = any>(channel: string, payload: any): Promise<T> {
  return window.ipcRenderer.handlePromise(channel, payload) as Promise<T>
}

/** 当前时间字符串 YYYY-MM-DD HH:mm:ss */
function nowStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export default defineStore('colorPalette', () => {
  // ============ 状态 ============
  const baseHsv = ref<HSV>({ h: 210, s: 80, v: 60 })
  /** 基准色透明度：0-100（百分比），默认 100 = 完全不透明 */
  const baseAlpha = ref(100)
  const harmonyType = ref<HarmonyType>('complementary')
  /** 工作区色块（HEX 字符串数组，支持 8 位 #RRGGBBAA），可手动增删、用于导出 */
  const swatches = ref<string[]>([])
  const savedPalettes = ref<SavedPalette[]>([])
  const favorites = ref<ColorFavorite[]>([])
  const loading = ref(false)

  // ============ 派生 ============
  /** 基准色 HEX：含透明度（8 位），不透明时缩写为 6 位 */
  const baseHex = computed(() => toShortHex(hsvToHexa(baseHsv.value, baseAlpha.value / 100)))
  const harmonyColors = computed(() =>
    generateHarmony(baseHsv.value, harmonyType.value).map((h) =>
      toShortHex(hsvToHexa(h, baseAlpha.value / 100)),
    ),
  )

  // ============ 表结构初始化（幂等） ============
  let schemaReady: Promise<void> | null = null
  function ensureSchema(): Promise<void> {
    if (!schemaReady) {
      schemaReady = (async () => {
        await ipc('new-sql:execute', {
          sql: `CREATE TABLE IF NOT EXISTS ${COLOR_PALETTE_TABLE} (
            key TEXT PRIMARY KEY,
            name TEXT,
            colors TEXT,
            created_at TEXT,
            updated_at TEXT
          )`,
        })
        await ipc('new-sql:execute', {
          sql: `CREATE TABLE IF NOT EXISTS ${COLOR_FAVORITE_TABLE} (
            key TEXT PRIMARY KEY,
            hex TEXT,
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
    loadSaved()
    loadFavorites()
  }

  // ============ 基准色操作 ============
  function setBaseHsv(hsv: HSV) {
    baseHsv.value = { ...hsv }
  }
  function setBaseFromHex(hex: string) {
    baseHsv.value = hexToHsv(hex)
    baseAlpha.value = Math.round(parseAlpha(hex) * 100)
  }
  /** 设置基准色透明度（0-100） */
  function setBaseAlpha(a: number) {
    baseAlpha.value = Math.min(100, Math.max(0, Math.round(a)))
  }

  /** 随机基准色：随机色相 + 较柔和的饱和度/明度，便于直接得到好看的颜色 */
  function randomizeBase() {
    setBaseHsv({
      h: Math.random() * 360,
      s: 45 + Math.random() * 45, // 45~90
      v: 50 + Math.random() * 35, // 50~85
    })
  }

  /** 随机填充 N 个柔和色到工作区（默认 5） */
  function addRandomSwatches(n = 5) {
    for (let i = 0; i < n; i++) {
      const hsv = {
        h: Math.random() * 360,
        s: 45 + Math.random() * 45,
        v: 50 + Math.random() * 35,
      }
      addSwatch(hsvToHexa(hsv, baseAlpha.value / 100))
    }
  }

  // ============ 工作区色块 ============
  function addSwatch(hex?: string) {
    const c = (hex || baseHex.value).toLowerCase()
    if (!swatches.value.includes(c)) swatches.value = [...swatches.value, c]
  }
  function removeSwatch(index: number) {
    swatches.value = swatches.value.filter((_, i) => i !== index)
  }
  function clearSwatches() {
    swatches.value = []
  }

  // ============ 已保存色板（color_palette 表） ============
  async function loadSaved() {
    try {
      await ensureSchema()
      const res = await ipc<{ success: boolean; data?: any[] }>('new-sql:query', {
        tableName: COLOR_PALETTE_TABLE,
        conditions: {},
        orderBy: 'updated_at',
        orderByDesc: true,
      })
      savedPalettes.value = (res?.data || []).map((r: any) => ({
        key: r.key,
        name: r.name,
        colors: r.colors,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }))
    } catch (e) {
      console.error('[colorPalette] loadSaved failed', e)
    }
  }

  /** 保存/覆盖色板，以 name 作为唯一键 */
  async function savePalette(name: string, colors: string[]) {
    const key = name.trim()
    if (!key) return
    const cur = nowStr()
    await ensureSchema()
    await ipc('new-sql:upsert', {
      tableName: COLOR_PALETTE_TABLE,
      data: {
        key,
        name: key,
        colors: JSON.stringify(colors),
        created_at: cur,
        updated_at: cur,
      },
      config: { primaryKey: 'key', primaryKeyType: 'TEXT' },
    })
    await loadSaved()
  }

  async function deletePalette(key: string) {
    await ipc('new-sql:delete', { tableName: COLOR_PALETTE_TABLE, condition: { key } })
    await loadSaved()
  }

  // ============ 快速收藏（color_favorite 表） ============
  async function loadFavorites() {
    try {
      await ensureSchema()
      const res = await ipc<{ success: boolean; data?: any[] }>('new-sql:query', {
        tableName: COLOR_FAVORITE_TABLE,
        conditions: {},
        orderBy: 'created_at',
        orderByDesc: true,
      })
      favorites.value = (res?.data || []).map((r: any) => ({
        key: r.key,
        hex: r.hex,
        created_at: r.created_at,
      }))
    } catch (e) {
      console.error('[colorPalette] loadFavorites failed', e)
    }
  }

  async function addFavorite(hex: string) {
    const c = hex.toLowerCase()
    if (favorites.value.some((f) => f.hex === c)) return
    const key =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `fav_${Date.now()}_${Math.random().toString(16).slice(2)}`
    await ensureSchema()
    await ipc('new-sql:insert', {
      tableName: COLOR_FAVORITE_TABLE,
      data: { key, hex: c, created_at: nowStr() },
      config: { primaryKey: 'key', primaryKeyType: 'TEXT' },
    })
    await loadFavorites()
  }

  async function removeFavorite(key: string) {
    await ipc('new-sql:delete', { tableName: COLOR_FAVORITE_TABLE, condition: { key } })
    await loadFavorites()
  }

  return {
    // 状态
    baseHsv,
    baseAlpha,
    harmonyType,
    swatches,
    savedPalettes,
    favorites,
    loading,
    // 派生
    baseHex,
    harmonyColors,
    // 方法
    init,
    setBaseHsv,
    setBaseFromHex,
    setBaseAlpha,
    randomizeBase,
    addRandomSwatches,
    addSwatch,
    removeSwatch,
    clearSwatches,
    loadSaved,
    savePalette,
    deletePalette,
    loadFavorites,
    addFavorite,
    removeFavorite,
  }
})
