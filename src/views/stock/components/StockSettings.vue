<template>
  <el-drawer
    v-model="visible"
    title="股票设置"
    direction="rtl"
    size="540px"
    @open="onOpen"
  >
    <div class="settings-layout">
      <!-- 左侧分栏导航 -->
      <el-tabs v-model="activePane" tab-position="left" class="settings-tabs">
        <el-tab-pane label="API Key" name="key" />
        <el-tab-pane label="缓存时间" name="cache" />
      </el-tabs>

      <!-- 右侧表单区 -->
      <div class="settings-body">
        <!-- 分栏一：API Key（单独保存） -->
        <div v-show="activePane === 'key'" class="pane">
          <div class="pane-title">TickFlow API Key</div>
          <p class="pane-desc">
            股票查询依赖 TickFlow 接口服务，请填写 API Key。Key 会加密后保存到本地数据库，仅本机可用。
          </p>
          <a class="doc-link" @click="openDocs">如何获取 API Key？查看 TickFlow 文档 ↗</a>

          <div class="key-form">
            <el-input
              v-model="apiKey"
              type="password"
              show-password
              placeholder="粘贴你的 TickFlow API Key"
              :disabled="savingKey"
              @keyup.enter="saveKey"
            />
            <div class="pane-actions">
              <span v-if="keyError" class="err">{{ keyError }}</span>
              <el-button
                type="primary"
                size="small"
                :loading="savingKey"
                :disabled="!apiKey.trim()"
                @click="saveKey"
              >
                保存 API Key
              </el-button>
            </div>
          </div>
        </div>

        <!-- 分栏二：缓存时间（单独保存） -->
        <div v-show="activePane === 'cache'" class="pane">
          <div class="pane-title">接口缓存时间</div>
          <p class="pane-desc">
            此处设置的缓存时间仅作用于<strong>之后新请求</strong>的数据；已缓存的数据不会因改动而被强制刷新或重新分析，
            其过期时间维持原值，直到自然过期后按新时间重新回源。
          </p>

          <div v-if="draft && Object.keys(draft).length > 0" class="cache-groups">
            <div v-for="grp in groups" :key="grp.key" class="grp">
              <div class="grp-title">{{ grp.label }}</div>
              <div v-for="ch in grp.channels" :key="ch" class="row">
                <span class="ep" :title="ch">{{ channelLabel(ch) }}</span>
                <div class="ctrl">
                  <el-input-number
                    v-model="draft[ch].value"
                    :min="0"
                    :controls="false"
                    size="small"
                    class="num"
                  />
                  <el-select v-model="draft[ch].unit" size="small" class="unit">
                    <el-option label="秒" value="s" />
                    <el-option label="分" value="m" />
                    <el-option label="时" value="h" />
                    <el-option label="天" value="d" />
                  </el-select>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="cache-empty">加载中…</div>

          <div class="pane-actions">
            <span v-if="cacheError" class="err">{{ cacheError }}</span>
            <el-button
              type="primary"
              size="small"
              :loading="savingCache"
              @click="saveCache"
            >
              保存缓存设置
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getCacheTtl, setCacheTtl, getApiKey, setApiKey } from '../api'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

/** 双向绑定可见性（支持 v-model） */
const visible = ref(props.modelValue)
watch(
  () => props.modelValue,
  (v) => (visible.value = v),
)
watch(visible, (v) => emit('update:modelValue', v))

/** 当前选中的分栏 */
const activePane = ref('key')

/* ---------- 分栏一：API Key ---------- */
const apiKey = ref('')
const savingKey = ref(false)
const keyError = ref('')

async function openDocs() {
  try {
    await window.ipcRenderer.handlePromise('open-external-url', {
      url: 'https://docs.tickflow.org',
    })
  } catch {
    // 打开失败静默处理
  }
}

async function saveKey() {
  const key = apiKey.value.trim()
  if (!key) return
  savingKey.value = true
  keyError.value = ''
  try {
    await setApiKey(key)
    ElMessage.success('API Key 已保存')
  } catch (e) {
    keyError.value = (e as { message?: string })?.message || '保存失败，请重试'
  } finally {
    savingKey.value = false
  }
}

/* ---------- 分栏二：缓存时间 ---------- */
const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

/** 通道 → 友好标签（接口说明） */
const LABELS: Record<string, string> = {
  'stock:getQuotes': '实时行情（单标的）',
  'stock:getQuotesBatch': '实时行情（批量）',
  'stock:getDepth': '市场深度（单标的）',
  'stock:getDepthBatch': '市场深度（批量）',
  'stock:getIntraday': '当日分钟 K 线（单标的）',
  'stock:getIntradayBatch': '当日分钟 K 线（批量）',
  'stock:getKlines': '历史 K 线（单标的）',
  'stock:getKlinesBatch': '历史 K 线（批量）',
  'stock:getInstruments': '标的元数据（单查）',
  'stock:getInstrumentsBatch': '标的元数据（批量）',
  'stock:getExchanges': '交易所列表',
  'stock:getExchangeInstruments': '交易所标的列表',
  'stock:getUniverses': '标的池列表（行业分类）',
  'stock:getUniverseDetail': '标的池详情',
}

/** 分组展示 */
const groups = [
  { key: 'realtime', label: '实时行情 / 市场深度', channels: [
    'stock:getQuotes', 'stock:getQuotesBatch', 'stock:getDepth', 'stock:getDepthBatch',
  ] },
  { key: 'intraday', label: '当日分钟 K 线', channels: [
    'stock:getIntraday', 'stock:getIntradayBatch',
  ] },
  { key: 'kline', label: '历史 K 线', channels: [
    'stock:getKlines', 'stock:getKlinesBatch',
  ] },
  { key: 'instrument', label: '标的元数据', channels: [
    'stock:getInstruments', 'stock:getInstrumentsBatch',
  ] },
  { key: 'exchange', label: '交易所 / 标的池', channels: [
    'stock:getExchanges', 'stock:getExchangeInstruments', 'stock:getUniverses', 'stock:getUniverseDetail',
  ] },
]

function channelLabel(ch: string): string {
  return LABELS[ch] || ch
}

/** 毫秒 → { value, unit }（优先选能得到整数的较大单位） */
function msToDraft(ms: number): { value: number; unit: string } {
  if (ms % UNIT_MS.d === 0) return { value: ms / UNIT_MS.d, unit: 'd' }
  if (ms % UNIT_MS.h === 0) return { value: ms / UNIT_MS.h, unit: 'h' }
  if (ms % UNIT_MS.m === 0) return { value: ms / UNIT_MS.m, unit: 'm' }
  return { value: Math.round(ms / UNIT_MS.s), unit: 's' }
}

/** 编辑草稿：通道 → { value, unit } */
const draft = reactive<Record<string, { value: number; unit: string }>>({})
const savingCache = ref(false)
const cacheError = ref('')

async function onOpen() {
  // API Key 栏：读取当前 key（仅回填展示，便于用户确认已配置）
  try {
    apiKey.value = await getApiKey()
  } catch {
    apiKey.value = ''
  }
  // 缓存栏：读取当前配置
  try {
    const cfg = await getCacheTtl()
    const all = { ...cfg.defaults, ...cfg.overrides }
    for (const ch of Object.keys(all)) {
      draft[ch] = msToDraft(all[ch])
    }
  } catch (e) {
    ElMessage.error((e as { message?: string })?.message || '读取缓存配置失败')
  }
}

async function saveCache() {
  savingCache.value = true
  try {
    // 仅提交用户实际修改过（与默认值不同）的通道，保持覆盖表精简
    const cfg = await getCacheTtl()
    const overrides: Record<string, number> = {}
    for (const [ch, d] of Object.entries(draft)) {
      const ms = (d.value || 0) * (UNIT_MS[d.unit] || 1000)
      const def = cfg.defaults[ch]
      if (typeof def === 'number' && ms !== def) overrides[ch] = ms
    }
    await setCacheTtl(overrides)
    ElMessage.success('缓存设置已保存')
  } catch (e) {
    ElMessage.error((e as { message?: string })?.message || '保存失败')
  } finally {
    savingCache.value = false
  }
}
</script>

<style scoped lang="scss">
.settings-layout {
  display: flex;
  align-items: stretch;
  height: 100%;

  .settings-tabs {
    flex: 0 0 140px;
    border-right: 1px solid var(--border-subtle);
    margin-right: 16px;
  }

  .settings-body {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding-right: 4px;

    .pane {
      .pane-title {
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: 10px;
      }

      .pane-desc {
        margin: 0 0 10px;
        font-size: 0.82rem;
        line-height: 1.5;
        color: var(--text-muted);
      }

      .doc-link {
        display: inline-block;
        margin-bottom: 16px;
        font-size: 0.82rem;
        color: var(--color-primary);
        cursor: pointer;
        user-select: none;

        &:hover {
          text-decoration: underline;
        }
      }

      .key-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 360px;
      }

      .pane-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 16px;

        .err {
          font-size: 0.82rem;
          color: #e63946;
        }
      }
    }

    .cache-groups {
      margin-top: 4px;

      .grp {
        margin-bottom: 16px;

        .grp-title {
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--color-primary);
          margin-bottom: 8px;
          padding-left: 8px;
          border-left: 3px solid var(--color-primary);
        }

        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 5px 8px;
          border-radius: 6px;

          &:hover {
            background: var(--bg-hover, rgba(0, 0, 0, 0.04));
          }

          .ep {
            font-size: 0.82rem;
            color: var(--text-secondary, var(--text-primary));
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 280px;
          }

          .ctrl {
            display: flex;
            align-items: center;
            gap: 6px;

            .num {
              width: 96px;
            }
            .unit {
              width: 72px;
            }
          }
        }
      }
    }

    .cache-empty {
      color: var(--text-muted);
      font-size: 0.85rem;
      padding: 8px 0;
    }
  }
}
</style>
