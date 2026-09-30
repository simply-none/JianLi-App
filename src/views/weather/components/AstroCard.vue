<template>
  <div class="astro-card-wrap">
    <div class="section-title">
      <LucideIcon name="Sunrise" :size="15" />
      <span>日出日落</span>
    </div>

    <div class="astro-card glass-card">
      <!-- 日出 -->
      <div class="astro-item">
        <div class="astro-icon sunrise">
          <LucideIcon name="Sunrise" :size="20" :stroke-width="1.7" />
        </div>
        <div class="astro-info">
          <div class="astro-label">日出</div>
          <div class="astro-value">{{ astro.sunrise || '--:--' }}</div>
        </div>
      </div>

      <!-- 日照进度弧 -->
      <div class="daylight">
        <div class="daylight-track">
          <div class="daylight-fill" :style="{ width: daylightPercent + '%' }"></div>
        </div>
        <div class="daylight-hint">{{ daylightHint }}</div>
      </div>

      <!-- 日落 -->
      <div class="astro-item">
        <div class="astro-icon sunset">
          <LucideIcon name="Sunset" :size="20" :stroke-width="1.7" />
        </div>
        <div class="astro-info">
          <div class="astro-label">日落</div>
          <div class="astro-value">{{ astro.sunset || '--:--' }}</div>
        </div>
      </div>

      <!-- 月相 -->
      <div v-if="astro.moonPhase" class="astro-item moon">
        <div class="astro-icon moon">
          <LucideIcon name="MoonStar" :size="20" :stroke-width="1.7" />
        </div>
        <div class="astro-info">
          <div class="astro-label">月相</div>
          <div class="astro-value">{{ astro.moonPhase }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import type { AstroInfo } from '../types'

/** 组件 Props */
const props = defineProps<{
  /** 日出日落与月相 */
  astro: AstroInfo
}>()

/**
 * 把 HH:mm 转为当天分钟数
 * @param hm 时间文本
 * @returns 分钟数，无法解析时返回 null
 */
function toMinutes(hm?: string): number | null {
  const m = (hm || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return parseInt(m[1]) * 60 + parseInt(m[2])
}

/** 白天已过去的百分比（日出前为 0，日落后为 100） */
const daylightPercent = computed(() => {
  const sunrise = toMinutes(props.astro.sunrise)
  const sunset = toMinutes(props.astro.sunset)
  if (sunrise == null || sunset == null || sunset <= sunrise) return 0

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  if (nowMin <= sunrise) return 0
  if (nowMin >= sunset) return 100
  return Math.round(((nowMin - sunrise) / (sunset - sunrise)) * 100)
})

/** 日照进度提示文案 */
const daylightHint = computed(() => {
  const p = daylightPercent.value
  if (p <= 0) return '天还没亮'
  if (p >= 100) return '太阳已落山'
  return `白天已过去 ${p}%`
})
</script>

<style scoped lang="scss">
.astro-card-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--glass-text-primary);
}

.astro-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;

  .astro-item {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;

    .astro-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--glass-bg);
      color: var(--glass-text-primary);
    }

    .astro-info {
      .astro-label {
        font-size: 0.7rem;
        color: var(--glass-text-secondary);
      }
      .astro-value {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--glass-text-primary);
      }
    }
  }

  .daylight {
    flex: 1;
    min-width: 80px;

    .daylight-track {
      height: 5px;
      border-radius: 3px;
      background: var(--glass-bg);
      overflow: hidden;

      .daylight-fill {
        height: 100%;
        border-radius: 3px;
        background: linear-gradient(90deg, #ffd57c 0%, #ff9d5c 100%);
        transition: width 0.4s;
      }
    }

    .daylight-hint {
      margin-top: 5px;
      font-size: 0.68rem;
      color: var(--glass-text-muted);
      text-align: center;
    }
  }
}
</style>
