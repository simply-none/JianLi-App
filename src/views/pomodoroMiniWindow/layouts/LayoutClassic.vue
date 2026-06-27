<template>
  <div class="layout-classic">
    <div class="theme-switch" @click.stop="$emit('cycle-theme')">
      <div class="switch-icon">◉</div>
    </div>

    <div class="header-title">{{ statusLabel }}</div>

    <div class="countdown-section">
      <div class="countdown-value">{{ countdown }}</div>
    </div>

    <div class="progress-section">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <div class="progress-text">{{ Math.round(progress) }}%</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  status: string
  countdown: string
  progress: number
  statusLabel: string
  statusSubtitle: string
}>()

defineEmits<{
  (e: 'cycle-theme'): void
}>()
</script>

<style lang="scss" scoped>
.layout-classic {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 0.3em;
  position: relative;

  .theme-switch {
    position: absolute;
    top: 4%;
    right: 5%;
    width: 1.8em;
    height: 1.8em;
    min-width: 14px;
    min-height: 14px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.25s ease;
    background: var(--skin-btn-bg);
    border: 1px solid var(--skin-border);

    &:hover {
      transform: scale(1.15);
      background: var(--skin-btn-hover);
      box-shadow: 0 0 0.8em var(--skin-dot-glow);
    }

    .switch-icon {
      font-size: 0.8em;
      color: var(--skin-dot);
      line-height: 1;
    }
  }

  .header-title {
    text-align: center;
    font-size: 1.4em;
    font-weight: 600;
    color: var(--skin-text-secondary);
    flex-shrink: 0;
    padding-top: 0.3em;
  }

  .countdown-section {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 0;

    .countdown-value {
      font-size: clamp(18px, 9vmin, 38px);
      font-weight: 900;
      font-family: 'SF Mono', Monaco, 'Consolas', monospace;
      color: var(--skin-text-primary);
      text-shadow: 0 0.1em 0.3em var(--skin-dot-glow);
      line-height: 1;
      white-space: nowrap;
    }
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3em;
    flex-shrink: 0;
    width: 100%;

    .progress-bar {
      width: 100%;
      height: clamp(9px, 2vmin, 12px);
      min-height: 9px;
      background: var(--skin-progress-bg);
      border-radius: 0.3em;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        border-radius: 0.3em;
        transition: width 1s ease;
        background: var(--skin-progress-fill);
      }
    }

    .progress-text {
      font-size: 1.2em;
      font-weight: 600;
      color: var(--skin-text-secondary);
      white-space: nowrap;
    }
  }
}
</style>
