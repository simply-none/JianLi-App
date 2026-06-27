<template>
  <div class="layout-flip">
    <div class="theme-switch" @click.stop="$emit('cycle-theme')">
      <div class="switch-icon">◉</div>
    </div>

    <div class="status-section">
      <div class="status-indicator">
        <div class="status-dot"></div>
      </div>
      <div class="status-info">
        <div class="status-label">{{ statusLabel }}</div>
      </div>
    </div>

    <div class="countdown-section">
      <FlipCountdown :countdown="countdown" />
    </div>
  </div>
</template>

<script setup lang="ts">
import FlipCountdown from '../components/FlipCountdown.vue'

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
.layout-flip {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5em;
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

  .status-section {
    display: flex;
    align-items: center;
    gap: 0.5em;
    flex-shrink: 0;

    .status-indicator {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-app-region: drag;

      .status-dot {
        width: 1em;
        height: 1em;
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
      align-items: center;

      .status-label {
        font-size: 1.2em;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
        color: var(--skin-text-primary);
      }
    }
  }

  .countdown-section {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    min-height: 0;
    padding: 0.5em 0;
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
