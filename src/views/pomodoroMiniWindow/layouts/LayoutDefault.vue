<template>
  <div class="layout-default">
    <div class="top-section">
      <div class="status-section">
        <div class="status-indicator">
          <div class="status-dot"></div>
        </div>
        <div class="status-info">
          <div class="status-label">{{ statusLabel }}</div>
          <div class="status-subtitle">{{ statusSubtitle }}</div>
        </div>
      </div>
      <div class="theme-switch" @click.stop="$emit('cycle-theme')">
        <div class="switch-icon">&#9673;</div>
      </div>
    </div>

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
.layout-default {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.5em;

  .top-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .status-section {
    display: flex;
    align-items: center;
    gap: 1em;
    flex-shrink: 0;

    .status-indicator {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-app-region: drag;

      .status-dot {
        width: 1.35em;
        height: 1.35em;
        min-width: 8px;
        min-height: 8px;
        border-radius: 50%;
        animation: pulse 2s infinite;
        background: var(--skin-dot);
        box-shadow: 0 0 0.8em var(--skin-dot-glow);
      }
    }

    .status-info {
      display: flex;
      flex-direction: column;
      gap: 0.2em;
      min-width: 0;
      overflow: hidden;

      .status-label {
        font-size: 1.75em;
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--skin-text-primary);
      }

      .status-subtitle {
        font-size: 1.3em;
        color: var(--skin-text-secondary);
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }

  .theme-switch {
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

  .countdown-section {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    min-height: 0;

    .countdown-value {
      font-size: clamp(16px, 8vmin, 36px);
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
    align-items: center;
    gap: 0.5em;
    flex-shrink: 0;

    .progress-bar {
      flex: 1;
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
      font-size: 1.35em;
      font-weight: 600;
      color: var(--skin-text-secondary);
      flex-shrink: 0;
      white-space: nowrap;
    }
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
  }
}
</style>
