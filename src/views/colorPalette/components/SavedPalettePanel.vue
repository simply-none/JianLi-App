<template>
  <div class="saved-panel">
    <!-- 保存当前工作区为命名色板 -->
    <div class="save-box">
      <input v-model="name" class="name-input" placeholder="色板名称（重名覆盖）" @keyup.enter="doSave" />
      <button class="save-btn" :disabled="!canSave" @click="doSave">
        <LucideIcon name="Save" :size="14" />
        保存
      </button>
    </div>

    <!-- 已保存色板列表 -->
    <div v-if="!store.savedPalettes.length" class="empty">暂无保存的色板</div>
    <div v-else class="list">
      <div v-for="p in store.savedPalettes" :key="p.key" class="palette-item">
        <div class="meta">
          <span class="pname">{{ p.name }}</span>
          <div class="pcolors">
            <span
              v-for="(c, i) in parsed(p.colors)"
              :key="i"
              class="pdot"
              :style="{ background: c }"
              :title="c"
            />
          </div>
        </div>
        <div class="ops">
          <button class="op" title="载入到工作区" @click="load(p)">
            <LucideIcon name="Download" :size="14" />
          </button>
          <button class="op danger" title="删除" @click="del(p.key)">
            <LucideIcon name="Trash2" :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- 快速收藏的单色 -->
    <div class="fav-section">
      <div class="fav-head">
        <span>快速收藏</span>
        <button class="op" title="收藏当前色" @click="store.addFavorite(store.baseHex)">
          <LucideIcon name="Plus" :size="14" />
        </button>
      </div>
      <div v-if="!store.favorites.length" class="empty sm">点击 + 收藏当前色</div>
      <div v-else class="fav-grid">
        <div
          v-for="f in store.favorites"
          :key="f.key"
          class="fav-dot"
          :style="{ background: f.hex }"
          :title="`${f.hex} · 点击复制`"
          @click="copy(f.hex)"
          @contextmenu.prevent="store.removeFavorite(f.key)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import { copyText } from '../clipboard'
import type { SavedPalette } from '../types'
import useColorPalette from '../useColorPalette'

const store = useColorPalette()

const name = ref('')

const canSave = computed(() => name.value.trim().length > 0 && store.swatches.length > 0)

function parsed(colors: string): string[] {
  try {
    const arr = JSON.parse(colors)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

async function doSave() {
  if (!canSave.value) return
  await store.savePalette(name.value.trim(), store.swatches)
  ElMessage.success(`已保存「${name.value.trim()}」`)
  name.value = ''
}

function load(p: SavedPalette) {
  const arr = parsed(p.colors)
  if (arr.length) {
    store.swatches = arr
    ElMessage.success(`已载入「${p.name}」`)
  }
}

async function del(key: string) {
  await store.deletePalette(key)
}

function copy(hex: string) {
  copyText(hex, '收藏色')
}
</script>

<style scoped lang="scss">
.saved-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.save-box {
  display: flex;
  gap: 8px;
  .name-input {
    flex: 1;
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    background: var(--bg-base);
    color: var(--text-primary);
    font-size: 0.8rem;
    outline: none;
    &:focus {
      border-color: var(--color-primary);
    }
  }
  .save-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 12px;
    height: 32px;
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-btn);
    background: var(--color-primary-light);
    color: var(--color-primary-solid);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    &:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }
    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }
}
.empty {
  font-size: 0.76rem;
  color: var(--text-muted);
  padding: 12px;
  text-align: center;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-card);
  &.sm {
    padding: 8px;
  }
}
.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.palette-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  background: var(--bg-card);
  .meta {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
    .pname {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    .pcolors {
      display: flex;
      gap: 3px;
      .pdot {
        width: 16px;
        height: 16px;
        border-radius: 4px;
        border: 1px solid var(--border-subtle);
      }
    }
  }
  .ops {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
    .op {
      width: 26px;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-btn);
      background: var(--bg-base);
      color: var(--text-secondary);
      cursor: pointer;
      &:hover {
        background: var(--bg-hover);
        color: var(--color-primary);
      }
      &.danger:hover {
        color: var(--color-error);
        border-color: var(--color-error);
      }
    }
  }
}
.fav-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--border-subtle);
  padding-top: 10px;
  .fav-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-secondary);
    .op {
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
      &:hover {
        background: var(--bg-hover);
        color: var(--color-primary);
      }
    }
  }
  .fav-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(26px, 1fr));
    gap: 6px;
    .fav-dot {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      cursor: pointer;
      &:hover {
        transform: scale(1.08);
      }
    }
  }
}
</style>
