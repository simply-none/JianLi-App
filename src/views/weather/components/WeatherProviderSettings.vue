<template>
  <el-drawer
    v-model="visible"
    title="天气数据源设置"
    direction="rtl"
    size="620px"
    @open="onOpen"
  >
    <div v-if="loading" class="loading">正在读取配置…</div>

    <div v-else class="settings-layout">
      <!-- 左侧：数据源列表（顺序即降级顺序） -->
      <div class="provider-list">
        <!-- 首选数据源：有值时优先请求它，失败再按下方优先级降级 -->
        <div class="preferred-block">
          <div class="list-title">首选数据源</div>
          <el-select
            v-model="draft.preferredProvider"
            size="small"
            class="preferred-select"
            placeholder="自动（按优先级）"
          >
            <el-option label="自动（按优先级降级）" :value="null" />
            <el-option
              v-for="p in orderedProviders"
              :key="p.id"
              :label="p.label"
              :value="p.id"
            />
          </el-select>
          <p class="list-desc">
            <template v-if="preferredHint">优先请求 {{ preferredHint }}；失败或不可用时按下方优先级降级</template>
            <template v-else>不指定，直接按下方优先级依次尝试</template>
          </p>
        </div>

        <div class="list-divider-block"></div>

        <div class="list-title">数据源优先级</div>
        <p class="list-desc">自上而下依次尝试，失败自动降级到下一个</p>

        <div
          v-for="(p, index) in orderedProviders"
          :key="p.id"
          class="provider-item"
          :class="{ active: activeId === p.id, disabled: !enabledOf(p.id) }"
          @click="activeId = p.id"
        >
          <div class="item-main">
            <span class="item-index">{{ index + 1 }}</span>
            <div class="item-info">
              <div class="item-name">
                {{ p.label }}
                <el-tag v-if="p.zeroConfig" size="small" type="success" effect="plain">免配置</el-tag>
                <el-tag v-else-if="p.configured" size="small" type="info" effect="plain">已配置</el-tag>
                <el-tag v-else size="small" type="warning" effect="plain">待配置</el-tag>
              </div>
              <div class="item-caps">支持 {{ p.capabilities.length }} 项字段</div>
            </div>
          </div>

          <div class="item-actions">
            <el-button
              size="small"
              text
              :disabled="index === 0"
              @click.stop="moveUp(index)"
            >
              <LucideIcon name="ArrowUp" :size="13" />
            </el-button>
            <el-button
              size="small"
              text
              :disabled="index === orderedProviders.length - 1"
              @click.stop="moveDown(index)"
            >
              <LucideIcon name="ArrowDown" :size="13" />
            </el-button>
            <el-switch
              :model-value="enabledOf(p.id)"
              size="small"
              @click.stop
              @update:model-value="(v: boolean) => setEnabled(p.id, v)"
            />
          </div>
        </div>

        <div class="list-divider"></div>

        <!-- 缓存与超时 -->
        <div class="global-settings">
          <div class="gs-row">
            <span class="gs-label">本地缓存时长</span>
            <el-select v-model="draft.cacheTtl" size="small" class="gs-control">
              <el-option
                v-for="opt in CACHE_TTL_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <div class="gs-row">
            <span class="gs-label">请求超时</span>
            <el-input-number
              v-model="draft.timeoutSec"
              :min="5"
              :max="60"
              :controls="false"
              size="small"
              class="gs-control"
            />
          </div>
        </div>
      </div>

      <!-- 右侧：选中数据源的配置表单 -->
      <div class="settings-body">
        <template v-if="activeSummary">
          <div class="body-head">
            <div class="head-name">{{ activeSummary.label }}</div>
            <el-button
              size="small"
              :loading="probing"
              @click="handleProbe"
            >
              测试连接
            </el-button>
          </div>

          <div v-if="probeResult" class="probe-result" :class="probeResult.ok ? 'ok' : 'fail'">
            <LucideIcon :name="probeResult.ok ? 'CircleCheck' : 'CircleX'" :size="14" :stroke-width="1.9" />
            <span>{{ probeResult.message }}</span>
          </div>

          <ProviderForm
            v-model="activeValues"
            :summary="activeSummary"
            :secret-status-map="config?.secretStatus || {}"
          />
        </template>

        <div v-else class="body-empty">请选择左侧数据源</div>
      </div>
    </div>

    <template #footer>
      <div class="footer">
        <span class="footer-tip">凭据将加密后存入本地数据库，仅本机可解密</span>
        <div class="footer-btns">
          <el-button size="small" @click="visible = false">取消</el-button>
          <el-button type="primary" size="small" :loading="saving" @click="handleSave">保存</el-button>
        </div>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import ProviderForm from './ProviderForm.vue'
import { fetchWeatherConfig, probeWeatherProvider, saveWeatherConfig } from '../api'
import { CACHE_TTL_OPTIONS } from '../constants'
import type {
  ProviderId,
  ProviderSummary,
  WeatherConfigForUi,
} from '../types'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved'): void
}>()

/** 双向绑定可见性 */
const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => (visible.value = v))
watch(visible, (v) => emit('update:modelValue', v))

/** 脱敏配置快照 */
const config = ref<WeatherConfigForUi | null>(null)
/** 加载中 */
const loading = ref(false)
/** 保存中 */
const saving = ref(false)
/** 当前选中的数据源 */
const activeId = ref<ProviderId | null>(null)

/** 各源配置草稿的类型别名（Partial<Record> 直索引会报 any，用显式 Map 类型） */
type EnabledMap = Partial<Record<ProviderId, boolean>>
type ValuesMap = Partial<Record<ProviderId, Record<string, string>>>

/* ---------- 草稿状态 ---------- */

const draft = reactive({
  /** 数据源顺序 */
  order: [] as ProviderId[],
  /** 首选数据源（null = 自动按优先级降级） */
  preferredProvider: null as ProviderId | null,
  /** 各源启用状态 */
  enabled: {} as EnabledMap,
  /** 各源表单值（含敏感字段的本次输入） */
  values: {} as ValuesMap,
  /** 缓存时长（ms） */
  cacheTtl: 30 * 60 * 1000,
  /** 超时（秒） */
  timeoutSec: 15,
})

/** 全部数据源快照 */
const allProviders = computed<ProviderSummary[]>(() => config.value?.availableProviders ?? [])

/** 按草稿顺序排列的数据源 */
const orderedProviders = computed<ProviderSummary[]>(() => {
  const map = new Map(allProviders.value.map((p) => [p.id, p]))
  const ordered: ProviderSummary[] = []
  for (const id of draft.order) {
    const p = map.get(id)
    if (p) ordered.push(p)
  }
  // 补齐草稿顺序中未出现的源
  for (const p of allProviders.value) {
    if (!draft.order.includes(p.id)) ordered.push(p)
  }
  return ordered
})

/** 当前选中源的快照 */
const activeSummary = computed(() =>
  orderedProviders.value.find((p) => p.id === activeId.value) ?? null
)

/**
 * 首选数据源的提示文案（含「会被忽略」的预警）
 *
 * 与主进程 resolveChain 的判定保持一致：首选源若未启用或凭据未填齐，
 * 链路会把首选忽略并完全按优先级执行 —— 这里必须提前告知用户，
 * 否则会出现「选了首选却没生效」的困惑。
 */
const preferredHint = computed<string>(() => {
  const id = draft.preferredProvider
  if (!id) return ''
  const p = orderedProviders.value.find((item) => item.id === id)
  if (!p) return ''
  if (!enabledOf(id)) return `${p.label}（当前已停用，将按优先级降级）`
  if (!p.zeroConfig && !p.configured) return `${p.label}（凭据未填齐，将按优先级降级）`
  return p.label
})

/** 当前选中源的表单值（与 draft 双向同步） */
const activeValues = computed<Record<string, string>>({
  get: () => (activeId.value ? draft.values[activeId.value] ?? {} : {}),
  set: (v) => {
    if (activeId.value) draft.values[activeId.value] = v
  },
})

/** 类型安全的启用状态读写（规避 Partial<Record> 的隐式 any 索引） */
function readEnabled(id: ProviderId): boolean {
  return draft.enabled[id] ?? false
}
function writeEnabled(id: ProviderId, v: boolean): void {
  draft.enabled[id] = v
}
/** 类型安全的表单值读写 */
function readValues(id: ProviderId): Record<string, string> {
  return draft.values[id] ?? {}
}
function writeValues(id: ProviderId, v: Record<string, string>): void {
  draft.values[id] = v
}

/* ---------- 打开时加载 ---------- */

async function onOpen() {
  loading.value = true
  activeId.value = null
  try {
    const cfg = await fetchWeatherConfig()
    config.value = cfg
    draft.order = [...cfg.providerOrder]
    draft.preferredProvider = cfg.preferredProvider ?? null
    draft.cacheTtl = cfg.cacheDuration
    draft.timeoutSec = Math.round(cfg.requestTimeout / 1000)

    draft.enabled = {}
    draft.values = {}
    for (const p of cfg.availableProviders) {
      draft.enabled[p.id] = cfg.providers[p.id]?.enabled ?? false
      // 非敏感选项直接回填；敏感字段留空（占位提示显示已保存状态）
      draft.values[p.id] = { ...(cfg.providers[p.id]?.options || {}) }
    }    activeId.value = cfg.providerOrder[0] ?? cfg.availableProviders[0]?.id ?? null
  } catch (err) {
    ElMessage.error(`读取配置失败：${(err as Error).message}`)
  } finally {
    loading.value = false
  }
}

/* ---------- 交互 ---------- */

/** 取某源启用状态 */
function enabledOf(id: ProviderId): boolean {
  return readEnabled(id)
}

/** 切换某源启用状态 */
function setEnabled(id: ProviderId, v: boolean): void {
  writeEnabled(id, v)
}

/** 上移一位 */
function moveUp(index: number): void {
  if (index <= 0) return
  const arr = [...draft.order]
  ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
  draft.order = arr
}

/** 下移一位 */
function moveDown(index: number): void {
  if (index >= draft.order.length - 1) return
  const arr = [...draft.order]
  ;[arr[index + 1], arr[index]] = [arr[index], arr[index + 1]]
  draft.order = arr
}

/** 测试连接结果 */
const probeResult = ref<{ ok: boolean; message: string } | null>(null)
const probing = ref(false)

/** 以当前草稿内容测试选中源的连通性 */
async function handleProbe() {
  const summary = activeSummary.value
  if (!summary) return
  probing.value = true
  probeResult.value = null
  try {
    const values = readValues(summary.id)
    // 构造 schema 中已知的 options（非敏感）与 credentials（敏感）
    const options: Record<string, string> = {}
    const credentials: Record<string, string> = {}
    for (const field of summary.configSchema) {
      const v = values[field.key]
      if (v === undefined || v === '') continue
      if (field.secret) credentials[field.key] = v
      else options[field.key] = v
    }
    probeResult.value = await probeWeatherProvider(summary.id, {
      options,
      credentials,
      timeout: draft.timeoutSec * 1000,
    })
  } finally {
    probing.value = false
  }
}

/* ---------- 保存 ---------- */

async function handleSave() {
  saving.value = true
  try {
    const providers: Record<string, any> = {}
    for (const p of orderedProviders.value) {
      const values = readValues(p.id)
      const options: Record<string, string> = {}
      const credentials: Record<string, string> = {}
      for (const field of p.configSchema) {
        const v = values[field.key]
        if (v === undefined) continue
        if (field.secret) credentials[field.key] = v
        else options[field.key] = v
      }
      providers[p.id] = { enabled: enabledOf(p.id), options, credentials }
    }

    const res = await saveWeatherConfig({
      // 注意：draft.order 是 reactive 数组（Proxy），必须拷成普通数组再传
      providerOrder: [...draft.order],
      preferredProvider: draft.preferredProvider,
      providers,
      requestTimeout: draft.timeoutSec * 1000,
      cacheDuration: draft.cacheTtl,
    })

    if (res.ok) {
      ElMessage.success('设置已保存')
      emit('saved')
      visible.value = false
    } else {
      ElMessage.error(`保存失败：${res.message}`)
    }
  } catch (err) {
    ElMessage.error(`保存失败：${(err as Error).message}`)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.loading {
  padding: 40px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 0.85rem;
}

.settings-layout {
  display: flex;
  gap: 16px;
  height: 100%;
}

.provider-list {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;

  .list-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .list-desc {
    margin: 4px 0 10px;
    font-size: 0.7rem;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }

  /* 首选数据源：与下方优先级列表用分割线区隔 */
  .preferred-block {
    .preferred-select {
      width: 100%;
      margin-top: 6px;
    }

    .list-desc {
      margin-bottom: 0;
    }
  }

  .list-divider-block {
    margin: 12px 0;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .provider-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 9px 10px;
    border-radius: 8px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 0.15s;

    &:hover {
      background: var(--el-fill-color-light);
    }

    &.active {
      background: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary-light-7);
    }

    &.disabled {
      opacity: 0.5;
    }

    .item-main {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;

      .item-index {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        font-size: 0.68rem;
        color: var(--el-text-color-secondary);
        background: var(--el-fill-color);
        flex-shrink: 0;
      }

      .item-info {
        min-width: 0;

        .item-name {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.8rem;
          color: var(--el-text-color-primary);
          white-space: nowrap;
        }

        .item-caps {
          font-size: 0.68rem;
          color: var(--el-text-color-secondary);
        }
      }
    }

    .item-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }
  }

  .list-divider {
    flex: 1;
  }

  .global-settings {
    padding-top: 12px;
    border-top: 1px solid var(--el-border-color-lighter);

    .gs-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;

      .gs-label {
        font-size: 0.76rem;
        color: var(--el-text-color-regular);
      }

      .gs-control {
        width: 110px;
      }
    }
  }
}

.settings-body {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding-right: 4px;

  .body-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    .head-name {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }

  .probe-result {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 8px 12px;
    margin-bottom: 12px;
    border-radius: 8px;
    font-size: 0.76rem;
    line-height: 1.5;

    &.ok {
      color: var(--el-color-success);
      background: var(--el-color-success-light-9);
    }

    &.fail {
      color: var(--el-color-danger);
      background: var(--el-color-danger-light-9);
    }
  }

  .body-empty {
    padding: 40px;
    text-align: center;
    font-size: 0.82rem;
    color: var(--el-text-color-secondary);
  }
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .footer-tip {
    font-size: 0.7rem;
    color: var(--el-text-color-secondary);
  }

  .footer-btns {
    display: flex;
    gap: 8px;
  }
}
</style>
