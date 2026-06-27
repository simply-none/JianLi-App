<template>
  <div class="layout-circle">
    <div class="theme-switch" @click.stop="$emit('cycle-theme')">
      <div class="switch-icon">&#9673;</div>
    </div>

    <div class="countdown-section" :style="{ '--progress-rotate': progress * 3.6 + 'deg' }">
      <div class="circle-wrapper">
        <div class="circle-bg"></div>
        <div class="circle-progress"></div>
        <div class="countdown-value">{{ countdown }}</div>
      </div>
    </div>

    <div class="progress-section">
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
.layout-circle {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4em;
  position: relative;

  .theme-switch {
    position: absolute;
    top: 4%;
    right: 5%;
    width: 1.6em;
    height: 1.6em;
    min-width: 12px;
    min-height: 12px;
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
      font-size: 0.7em;
      color: var(--skin-dot);
      line-height: 1;
    }
  }

  .countdown-section {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    min-height: 0;

    .circle-wrapper {
      position: relative;
      width: 70%;
      height: 70%;
      max-width: 70px;
      max-height: 70px;
      display: flex;
      align-items: center;
      justify-content: center;

      .circle-bg {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 0.2em solid var(--skin-progress-bg);
        box-sizing: border-box;
      }

      .circle-progress {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 0.2em solid transparent;
        border-top-color: var(--skin-dot);
        transform: rotate(var(--progress-rotate, 0deg));
        box-sizing: border-box;
        transition: transform 1s ease;
        filter: drop-shadow(0 0 0.3em var(--skin-dot-glow));
      }

      .countdown-value {
        font-size: clamp(10px, 4.5vmin, 18px);
        font-weight: 800;
        font-family: 'SF Mono', Monaco, 'Consolas', monospace;
        color: var(--skin-text-primary);
        text-shadow: 0 0.1em 0.2em var(--skin-dot-glow);
        line-height: 1;
        white-space: nowrap;
        z-index: 1;
      }
    }
  }

  .progress-section {
    display: flex;
    justify-content: center;
    flex-shrink: 0;

    .progress-text {
      font-size: 1.4em;
      font-weight: 700;
      color: var(--skin-text-secondary);
    }
  }
}
</style>
