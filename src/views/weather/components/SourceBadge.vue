<template>
  <div class="source-badge">
    <div class="badge-main" :title="tooltip">
      <LucideIcon :name="icon" :size="13" :stroke-width="1.8" />
      <span class="badge-label">{{ data.source || '未知来源' }}</span>
      <span v-if="degraded" class="badge-warn">
        <LucideIcon name="TriangleAlert" :size="11" :stroke-width="1.8" />
        已降级
      </span>
    </div>

    <!-- 降级轨迹（仅在发生降级或用户悬停时展开） -->
    <div v-if="showTrace" class="badge-trace">
      <div v-for="t in trace" :key="t.id" class="trace-item" :class="{ ok: t.ok, fail: !t.ok }">
        <LucideIcon :name="t.ok ? 'CircleCheck' : 'CircleX'" :size="11" :stroke-width="1.9" />
        <span class="trace-label">{{ t.label }}</span>
        <span class="trace-meta">{{ t.ok ? `${t.ms}ms` : t.error || '失败' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import type { WeatherData } from '../types'

/** 组件 Props */
const props = defineProps<{
  /** 天气数据（读取 source 与 _trace） */
  data: WeatherData
  /** 是否展开降级轨迹 */
  showTrace?: boolean
}>()

/** 轨迹列表 */
const trace = computed(() => props.data._trace ?? [])

/** 本次命中的数据源 */
const usedId = computed(() => trace.value.find((t) => t.ok)?.id)

/** 是否发生过降级（有失败的前置数据源） */
const degraded = computed(() => {
  const useIdx = trace.value.findIndex((t) => t.ok)
  if (useIdx <= 0) return false
  return trace.value.slice(0, useIdx).some((t) => !t.ok)
})

/** 来源图标：按 provider 区分 */
const icon = computed(() => {
  switch (usedId.value) {
    case 'qweather': return 'CloudSun'
    case 'openMeteo': return 'Globe'
    // 中国天气网（接口）：纯 HTTP 取得，用 Satellite 区别于爬虫的 MonitorCloud
    case 'cnweather': return 'Satellite'
    case 'crawler': return 'MonitorCloud'
    default: return 'Cloud'
  }
})

/** 悬停提示：完整链路摘要 */
const tooltip = computed(() => {
  if (!trace.value.length) return props.data.source || ''
  return trace.value
    .map((t) => `${t.label}: ${t.ok ? `成功 ${t.ms}ms` : t.error || '失败'}`)
    .join('\n')
})
</script>

<style scoped lang="scss">
.source-badge {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.72rem;

  .badge-main {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    align-self: flex-start;
    padding: 3px 10px;
    border-radius: 999px;
    color: var(--glass-text-secondary);
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    cursor: default;

    .badge-label {
      font-weight: 500;
    }

    .badge-warn {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-left: 4px;
      padding-left: 7px;
      border-left: 1px solid var(--glass-border);
      /* 降级警告暖色：与图表高温线 / 日照条同口径 */
      color: var(--glass-warm);
    }
  }

  .badge-trace {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.18);

    .trace-item {
      display: flex;
      align-items: center;
      gap: 6px;

      &.ok {
        color: #9fe6b0;
      }
      &.fail {
        color: var(--glass-text-muted);
      }

      .trace-label {
        min-width: 90px;
      }

      .trace-meta {
        color: var(--glass-text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}
</style>
