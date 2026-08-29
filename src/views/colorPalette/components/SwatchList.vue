<template>
  <div class="swatch-list">
    <div class="head">
      <span class="count">工作区（{{ store.swatches.length }}）</span>
      <div class="head-actions">
        <button class="mini" title="加入当前色" @click="store.addSwatch()">
          <LucideIcon name="Plus" :size="13" />
        </button>
        <button class="mini" title="清空" :disabled="!store.swatches.length" @click="store.clearSwatches()">
          <LucideIcon name="Trash2" :size="13" />
        </button>
      </div>
    </div>

    <div v-if="!store.swatches.length" class="empty">点击「+」或配色方案的「全部加入」来收集颜色</div>

    <div v-else class="grid">
      <div v-for="(c, i) in store.swatches" :key="i" class="item" :style="{ background: c }">
        <span class="hex">{{ c }}</span>
        <div class="ops">
          <button class="op" title="复制" @click="copy(c)">
            <LucideIcon name="Copy" :size="13" />
          </button>
          <button class="op" title="移除" @click="store.removeSwatch(i)">
            <LucideIcon name="X" :size="13" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue'
import { copyText } from '../clipboard'
import useColorPalette from '../useColorPalette'

const store = useColorPalette()

function copy(c: string) {
  copyText(c, '颜色')
}
</script>

<style scoped lang="scss">
.swatch-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  .count {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .head-actions {
    display: flex;
    gap: 6px;
    .mini {
      width: 26px;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-btn);
      background: var(--bg-card);
      color: var(--text-secondary);
      cursor: pointer;
      &:hover:not(:disabled) {
        background: var(--bg-hover);
        color: var(--color-primary);
      }
      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }
  }
}
.empty {
  font-size: 0.76rem;
  color: var(--text-muted);
  padding: 14px;
  text-align: center;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-card);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 8px;
}
.item {
  position: relative;
  height: 64px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--border-subtle);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 6px;
  overflow: hidden;
  .hex {
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
    background: rgba(0, 0, 0, 0.35);
    color: #fff;
    padding: 1px 6px;
    border-radius: 8px;
  }
  .ops {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
    .op {
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.45);
      color: #fff;
      cursor: pointer;
      &:hover {
        background: rgba(0, 0, 0, 0.7);
      }
    }
  }
  &:hover .ops {
    opacity: 1;
  }
}
</style>
