<template>
  <div class="life-indices">
    <div class="section-title">
      <LucideIcon name="HeartPulse" :size="15" />
      <span>生活指数</span>
      <span v-if="source" class="source-tag">数据来源：{{ source }}</span>
    </div>

    <div class="indices-grid">
      <div v-for="item in indices" :key="item.name" class="index-card glass-card">
        <div class="index-head">
          <LucideIcon :name="getIcon(item.name)" :size="18" :stroke-width="1.8" />
          <span class="index-name">{{ item.name }}</span>
          <span class="index-level">{{ item.level || '--' }}</span>
        </div>
        <p class="index-tip">{{ item.tip || '暂无建议' }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue'
import type { WeatherIndex } from '../types'
import { LIFE_INDEX_ICON_MAP, LIFE_INDEX_FALLBACK_ICON } from '../constants'

/** 组件 Props */
defineProps<{
  /** 生活指数列表 */
  indices: WeatherIndex[]
  /** 数据来源站名称（可选，展示在标题右侧） */
  source?: string
}>()

/**
 * 根据指数名称取对应 Lucide 图标名（未命中回退到兜底图标）
 * @param name 指数名称（如「穿衣」「洗车」）
 * @returns Lucide 图标名
 */
function getIcon(name: string): string {
  return LIFE_INDEX_ICON_MAP[name] || LIFE_INDEX_FALLBACK_ICON
}
</script>

<style scoped lang="scss">
.life-indices {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);

  .source-tag {
    margin-left: auto;
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.55);
  }
}

.indices-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.index-card {
  padding: 12px 14px;

  .index-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;

    .index-name {
      font-size: 0.85rem;
      color: #fff;
    }

    .index-level {
      margin-left: auto;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.72rem;
      color: #fff;
      background: rgba(255, 255, 255, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  }

  .index-tip {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.72);
  }
}
</style>
