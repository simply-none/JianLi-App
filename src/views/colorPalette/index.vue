<template>
  <div class="color-palette-page">
    <!-- 页头 -->
    <header class="page-head">
      <div class="title-wrap">
        <LucideIcon name="Palette" :size="22" class="title-icon" />
        <div>
          <h1 class="title">调色板工具</h1>
          <p class="subtitle">取色 · 配色方案 · 渐变 · 智能命名 · 对比度 · 色盲模拟 · 导出与保存</p>
        </div>
      </div>
    </header>

    <!-- 面板栅格 -->
    <div class="grid">
      <!-- 取色（含画布 / 滑块 / 数值） -->
      <section class="panel picker-panel">
        <h2 class="panel-title">取色</h2>
        <ColorCanvas />
        <ColorSliders />
        <ColorValueInputs />
      </section>

      <!-- 配色方案 -->
      <section class="panel">
        <h2 class="panel-title">配色方案</h2>
        <HarmonyPanel />
      </section>

      <!-- 渐变生成器 -->
      <section class="panel">
        <h2 class="panel-title">渐变生成器</h2>
        <GradientPanel />
      </section>

      <!-- 颜色命名 -->
      <section class="panel">
        <h2 class="panel-title">颜色命名</h2>
        <ColorNamePanel />
      </section>

      <!-- 工作区 -->
      <section class="panel">
        <h2 class="panel-title">工作区</h2>
        <SwatchList />
      </section>

      <!-- 对比度 -->
      <section class="panel">
        <h2 class="panel-title">对比度检查 (WCAG)</h2>
        <ContrastChecker />
      </section>

      <!-- 色盲模拟 -->
      <section class="panel">
        <h2 class="panel-title">色盲模拟</h2>
        <ColorBlindSim />
      </section>

      <!-- 导出 -->
      <section class="panel">
        <h2 class="panel-title">导出主题皮肤</h2>
        <ExportPanel />
      </section>

      <!-- 收藏与保存 -->
      <section class="panel span-2">
        <h2 class="panel-title">收藏与保存（数据库）</h2>
        <SavedPalettePanel />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import ColorCanvas from './components/ColorCanvas.vue'
import ColorSliders from './components/ColorSliders.vue'
import ColorValueInputs from './components/ColorValueInputs.vue'
import HarmonyPanel from './components/HarmonyPanel.vue'
import GradientPanel from './components/GradientPanel.vue'
import ColorNamePanel from './components/ColorNamePanel.vue'
import SwatchList from './components/SwatchList.vue'
import ContrastChecker from './components/ContrastChecker.vue'
import ColorBlindSim from './components/ColorBlindSim.vue'
import ExportPanel from './components/ExportPanel.vue'
import SavedPalettePanel from './components/SavedPalettePanel.vue'
import useColorPalette from './useColorPalette'

const store = useColorPalette()

onMounted(() => {
  store.init()
})
</script>

<style scoped lang="scss">
.color-palette-page {
  padding: 18px;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}
.page-head {
  margin-bottom: 16px;
  .title-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
    .title-icon {
      color: var(--color-primary);
    }
    .title {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .subtitle {
      margin: 2px 0 0;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
  }
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
  align-items: start;
}
.panel {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 14px;
  &.span-2 {
    grid-column: 1 / -1;
  }
  .panel-title {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 700;
    color: var(--text-primary);
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-subtle);
  }
  // 取色面板内部子模块间距
  &.picker-panel {
    gap: 14px;
  }
}

// 窄屏下 span-2 退化为单列
@media (max-width: 720px) {
  .panel.span-2 {
    grid-column: auto;
  }
}
</style>
