<template>
  <div class="app-header">
    <!-- 左侧：返回按钮 + 页面标题 -->
    <div class="header-left">
      <button
        class="back-btn"
        :class="{ 'is-hidden': hideBack }"
        @click="back"
        title="返回主页"
      >
        <svg
          class="back-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <span class="page-title">{{ title }}</span>
    </div>

    <!-- 右侧：应用信息 -->
    <div class="header-right">
      <div class="app-badge">
        <span class="app-logo">渐</span>
        <div class="app-info">
          <span class="app-name">渐离 App</span>
          <span class="version-tag">v{{ pkg.version }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import pkg from '../../package.json'

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  hideBack: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['back'])

function back () {
  emit('back')
}
</script>

<style lang="scss" scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  user-select: none;
}

/* ---------- 左侧 ---------- */
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.05);
  color: #555;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, transform 0.15s;
  flex-shrink: 0;

  .back-icon {
    width: 16px;
    height: 16px;
    transition: transform 0.2s;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.10);
    color: #222;

    .back-icon {
      transform: translateX(-2px);
    }
  }

  &:active {
    background: rgba(0, 0, 0, 0.16);
    transform: scale(0.95);
  }

  &.is-hidden {
    visibility: hidden;
    pointer-events: none;
  }
}

.page-title {
  font-size: 1.18rem;
  font-weight: 650;
  color: #1a1a1a;
  letter-spacing: 0.01em;
  line-height: 1.3;
}

/* ---------- 右侧 ---------- */
.header-right {
  display: flex;
  align-items: center;
}

.app-badge {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 12px 4px 4px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.04);
  transition: background 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.07);
  }
}

.app-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
}

.app-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.app-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: #374151;
  line-height: 1.2;
}

.version-tag {
  font-size: 0.7rem;
  font-weight: 500;
  color: #9ca3af;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
</style>