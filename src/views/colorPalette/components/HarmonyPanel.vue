<template>
  <div class="harmony-panel">
    <div class="type-group">
      <button
        v-for="(meta, key) in HARMONY_META"
        :key="key"
        class="type-btn"
        :class="{ 'is-active': store.harmonyType === key }"
        :title="meta.desc"
        @click="store.harmonyType = key as HarmonyType"
      >
        {{ meta.label }}
      </button>
    </div>
    <p class="type-desc">{{ HARMONY_META[store.harmonyType].desc }}</p>

    <!-- 生成的配色 -->
    <div class="swatch-row">
      <button
        v-for="(c, i) in store.harmonyColors"
        :key="i"
        class="swatch"
        :style="{ '--c': c }"
        :title="`点击设为基准色 · ${c}`"
        @click="store.setBaseFromHex(c)"
      />
    </div>

    <div class="actions">
      <button class="random" @click="store.randomizeBase()">
        <LucideIcon name="Shuffle" :size="14" />
        随机基准色
      </button>
      <button class="add-all" @click="addAll">
        <LucideIcon name="Plus" :size="14" />
        全部加入工作区
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue'
import { HARMONY_META, type HarmonyType } from '../types'
import useColorPalette from '../useColorPalette'

const store = useColorPalette()

function addAll() {
  store.harmonyColors.forEach((c) => store.addSwatch(c))
}
</script>

<style scoped lang="scss">
.harmony-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.type-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  .type-btn {
    padding: 5px 10px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    background: var(--bg-card);
    color: var(--text-secondary);
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.15s;
    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    &.is-active {
      background: var(--color-primary-light);
      color: var(--color-primary-solid);
      border-color: var(--color-primary);
      font-weight: 600;
    }
  }
}
.type-desc {
  margin: 0;
  font-size: 0.76rem;
  color: var(--text-muted);
}
  .swatch-row {
  display: flex;
  gap: 6px;
  .swatch {
    flex: 1;
    height: 44px;
    border-radius: var(--radius-btn);
    border: 1px solid var(--border-subtle);
    cursor: pointer;
    transition: transform 0.12s;
    position: relative;
    background-image: conic-gradient(#cfcfcf 90deg, #f3f3f3 0 180deg, #cfcfcf 0 270deg, #f3f3f3 0);
    background-size: 12px 12px;
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: var(--c);
    }
    &:hover {
      transform: translateY(-2px);
    }
  }
}
.add-all {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-btn);
  background: var(--color-primary-light);
  color: var(--color-primary-solid);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  &:hover {
    background: var(--color-primary-hover);
  }
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  .random {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    background: var(--bg-card);
    color: var(--text-secondary);
    font-size: 0.8rem;
    cursor: pointer;
    &:hover {
      background: var(--bg-hover);
      color: var(--color-primary);
    }
  }
}
</style>
