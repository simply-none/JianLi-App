<template>
  <div class="name-panel">
    <!-- 当前基准色大块展示 -->
    <div class="show" :style="{ '--c': store.baseHex }">
      <span class="chip">{{ store.baseHex.toUpperCase() }}</span>
    </div>

    <div class="info">
      <div class="name-row">
        <span class="name">{{ name.name }}</span>
        <button class="btn" title="复制颜色名" @click="copyName">
          <LucideIcon name="Copy" :size="13" />
        </button>
      </div>
      <div class="sub">
        最接近命名色：{{ name.hex.toUpperCase() }} · 偏差 {{ Math.round(name.distance) }}
        <span v-if="name.distance < 1" class="exact">（精确匹配）</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { nearestColorName } from '../colorMath'
import { copyText } from '../clipboard'
import useColorPalette from '../useColorPalette'

const store = useColorPalette()

/** 当前基准色的最近命名色（随基准色实时变化） */
const name = computed(() => nearestColorName(store.baseHex))

function copyName() {
  copyText(name.value.name, '颜色名称')
}
</script>

<style scoped lang="scss">
.name-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.show {
  height: 90px;
  border-radius: var(--radius-card);
  border: 1px solid var(--border-subtle);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 8px;
  position: relative;
  background-image: conic-gradient(#cfcfcf 90deg, #f3f3f3 0 180deg, #cfcfcf 0 270deg, #f3f3f3 0);
  background-size: 14px 14px;
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--c);
  }
  .chip {
    position: relative;
    z-index: 1;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    background: rgba(0, 0, 0, 0.35);
    color: #fff;
    padding: 2px 8px;
    border-radius: 8px;
  }
}
.info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  .name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    .name {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
      text-transform: capitalize;
    }
    .btn {
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      background: var(--bg-card);
      color: var(--text-secondary);
      cursor: pointer;
      &:hover {
        background: var(--bg-hover);
        color: var(--color-primary);
      }
    }
  }
  .sub {
    font-size: 0.74rem;
    color: var(--text-muted);
    .exact {
      color: var(--color-success);
      font-weight: 600;
    }
  }
}
</style>
