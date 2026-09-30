import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

/**
 * 预报区块的展示形态
 * - `list`：默认，横向滚动卡片 / 逐行列表（原实现）
 * - `chart`：ECharts 图表
 */
export type ForecastViewMode = 'list' | 'chart'

/** 逐小时 / 未来预报两个区块各自的形态 */
export interface ForecastViewState {
  hourly: ForecastViewMode
  daily: ForecastViewMode
}

/** localStorage 键名（与 weather_cache_ttl / weather-city-remember 同惯例） */
const STORAGE_KEY = 'weather-forecast-view'

/** 默认形态：列表（与改造前行为一致） */
const DEFAULT_STATE: ForecastViewState = { hourly: 'list', daily: 'list' }

/**
 * 读取已记住的展示形态
 *
 * 容错策略：localStorage 可能被用户手动改坏 / 被其他版本写入非法值，
 * 故逐字段校验，任何异常都回退默认值，绝不让脏数据导致页面渲染异常。
 * @returns 校验后的形态状态
 */
function loadState(): ForecastViewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw) as Partial<ForecastViewState> | null
    const pick = (v: unknown): ForecastViewMode => (v === 'chart' ? 'chart' : 'list')
    return { hourly: pick(parsed?.hourly), daily: pick(parsed?.daily) }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

/**
 * 持久化当前形态到 localStorage
 * @param v 待写入的形态状态
 */
function persist(v: ForecastViewState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
  } catch {
    /* 隐私模式 / 配额超限时静默失败，不影响功能 */
  }
}

/**
 * 预报区块「列表 / 图表」切换状态
 *
 * - 两个区块各自独立记忆（`hourly` / `daily` 互不影响）
 * - 状态持久化到 localStorage，下次进入天气页保持上次选择
 * - 模块级单例：同一页面内多处调用共享同一份状态
 */
const state = ref<ForecastViewState>(loadState())

// 兜底：任何对 state 的写入都落盘（含 `useForecastViewState().value = ...` 这类直接操作）
watch(state, persist, { deep: true })

/**
 * 获取某一区块的展示形态（可读写）
 *
 * ⚠️ 必须返回**绑定到模块级 `state` 的可写 computed**，不能返回 `ref(state.value[key])`。
 * 后者只是「取值拷贝」，会创建一个与 `state` 无关的游离 ref：
 * 组件里的修改不回流 `state` ⇒ 持久化 watch 永不触发（localStorage 零写入），
 * 且组件重挂载即丢回默认值（表现为「切到图表后重进页面又变成列表」）。
 *
 * @param key 区块标识（`hourly` = 逐小时预报，`daily` = 未来预报）
 * @returns 该区块形态的可写 computed（`<script setup>` 中可当普通变量读写）
 */
export function useForecastView(key: keyof ForecastViewState): ComputedRef<ForecastViewMode> {
  return computed<ForecastViewMode>({
    get: () => state.value[key],
    set: (v) => {
      if (state.value[key] === v) return
      // 整体替换而非改单字段：确保 watch 一定命中（与 { deep: true } 双保险）
      const next = { ...state.value, [key]: v }
      state.value = next
      // ⚠️ 同步落盘（不等 watch 的异步 flush）——
      // 否则「切到图表后立刻刷新 / 关页」时，异步 watch 可能来不及执行 ⇒ 状态丢失
      persist(next)
    },
  })
}

/**
 * 获取全部形态状态（仅供内部调试 / 需要整体读取的场景）
 * @returns 模块级单例状态 ref
 */
export function useForecastViewState(): Ref<ForecastViewState> {
  return state
}
