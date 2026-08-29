<template>
  <div class="weather-skeleton">
    <!-- 主卡骨架 -->
    <div class="skeleton-card glass-card hero-block">
      <div class="sk-circle"></div>
      <div class="hero-lines">
        <div class="sk-line wide"></div>
        <div class="sk-line large"></div>
        <div class="sk-line medium"></div>
      </div>
    </div>

    <!-- 详情网格骨架 -->
    <div class="detail-grid">
      <div v-for="i in 6" :key="i" class="skeleton-card glass-card detail-block">
        <div class="sk-square"></div>
        <div class="detail-lines">
          <div class="sk-line short"></div>
          <div class="sk-line medium"></div>
        </div>
      </div>
    </div>

    <!-- 预报骨架 -->
    <div class="skeleton-card glass-card forecast-block">
      <div v-for="i in 4" :key="i" class="sk-line long"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 纯展示型骨架屏组件，无逻辑
</script>

<style scoped lang="scss">
.weather-skeleton {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.skeleton-card {
  padding: 22px;
}

// 骨架占位闪烁动效
.sk-line,
.sk-circle,
.sk-square {
  position: relative;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.14);
  border-radius: 8px;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.18),
      transparent
    );
    animation: shimmer 1.4s infinite;
  }
}

.sk-line {
  height: 14px;
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }

  &.wide { width: 40%; }
  &.large { width: 60%; height: 32px; }
  &.medium { width: 28%; }
  &.short { width: 45%; margin-bottom: 6px; }
  &.long { width: 100%; }
}

.sk-circle {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sk-square {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  flex-shrink: 0;
}

.hero-block {
  display: flex;
  align-items: center;
  gap: 28px;
}

.hero-lines {
  flex: 1;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.detail-block {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
}

.detail-lines {
  flex: 1;
}

.forecast-block {
  .sk-line {
    height: 18px;
  }
}

// 微光扫过动效
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
