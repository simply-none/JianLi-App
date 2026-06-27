<template>
  <div class="layout-compact">
    <div class="theme-switch" @click.stop="$emit('cycle-theme')">
      <div class="switch-icon">&#9673;</div>
    </div>

    <div class="left-section">
      <div class="status-section">
        <div class="status-indicator">
          <div class="status-dot"></div>
        </div>
        <div class="status-info">
          <div class="status-label">{{ statusLabel }}</div>
        </div>
      </div>

      <div class="countdown-section">
        <div class="countdown-value">{{ countdown }}</div>
      </div>
    </div>

    <div class="progress-section">
      <div class="progress-bar-wrapper">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ height: progress + '%' }"></div>
        </div>
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
.layout-compact {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.4em;
  position: relative;
  padding: 0 0.3em;
  box-sizing: border-box;

  .theme-switch {
    position: absolute;
    top: 4%;
    right: 5%;
    width: 1.4em;
    height: 1.4em;
    min-width: 10px;
    min-height: 10px;
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
      box-shadow: 0 0 0.6em var(--skin-dot-glow);
    }

    .switch-icon {
      font-size: 0.6em;
      color: var(--skin-dot);
      line-height: 1;
    }
  }

  .left-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.2em;
    min-width: 0;
  }

  .status-section {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.3em;

    .status-indicator {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-app-region: drag;

      .status-dot {
        width: 0.9em;
        height: 0.9em;
        min-width: 6px;
        min-height: 6px;
        border-radius: 50%;
        animation: pulse 2s infinite;
        background: var(--skin-dot);
        box-shadow: 0 0 0.6em var(--skin-dot-glow);
      }
    }

    .status-info {
      display: flex;
      flex-direction: row;
      align-items: center;

      .status-label {
        font-size: 1.1em;
        font-weight: 700;
        color: var(--skin-text-primary);
        line-height: 1.2;
        white-space: nowrap;
      }
    }
  }

  .countdown-section {
    display: flex;
    justify-content: flex-start;
    align-items: center;

    .countdown-value {
      font-size: clamp(12px, 5.5vmin, 24px);
      font-weight: 900;
      font-family: 'SF Mono', Monaco, 'Consolas', monospace;
      color: var(--skin-text-primary);
      text-shadow: 0 0.1em 0.2em var(--skin-dot-glow);
      line-height: 1;
      white-space: nowrap;
    }
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2em;
    flex-shrink: 0;

    .progress-bar-wrapper {
      display: flex;
      align-items: center;
      height: 80%;
    }

    .progress-bar {
      width: 0.5em;
      height: 100%;
      min-height: 20px;
      background: var(--skin-progress-bg);
      border-radius: 0.25em;
      overflow: hidden;
      display: flex;
      align-items: flex-end;

      .progress-fill {
        width: 100%;
        border-radius: 0.25em;
        transition: height 1s ease;
        background: var(--skin-dot);
        box-shadow: 0 0 0.4em var(--skin-dot-glow);
      }
    }

    .progress-text {
      font-size: 0.9em;
      font-weight: 600;
      color: var(--skin-text-secondary);
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
    transform: scale(1.15);
    opacity: 0.8;
  }
}
</style>
