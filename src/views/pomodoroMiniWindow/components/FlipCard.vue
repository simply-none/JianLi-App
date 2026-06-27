<template>
  <div class="flip-card">
    <div class="flip-layer before" :class="{ flipping: flipping }">
      <div class="flip-up">
        <div class="flip-shadow up"></div>
        <div class="flip-inn">{{ digit }}</div>
      </div>
      <div class="flip-down">
        <div class="flip-shadow down"></div>
        <div class="flip-inn">{{ digit }}</div>
      </div>
    </div>
    <div class="flip-layer active" :class="{ flipping: flipping }">
      <div class="flip-up">
        <div class="flip-shadow up"></div>
        <div class="flip-inn">{{ digit }}</div>
      </div>
      <div class="flip-down">
        <div class="flip-shadow down"></div>
        <div class="flip-inn">{{ digit }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  digit: string
  prevDigit: string
  flipping: boolean
}>()
</script>

<style lang="scss" scoped>
.flip-card {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 0.25em;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  background: var(--skin-bg);

  .flip-layer {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;

    &.before {
      z-index: 2;
    }

    &.active {
      z-index: 1;
    }

    &.flipping {
      &.before {
        z-index: 3;

        .flip-up {
          animation: flipTop 0.6s ease-in-out forwards;
        }
      }

      &.active {
        z-index: 4;

        .flip-down {
          animation: flipBottom 0.6s ease-in-out forwards;
        }
      }
    }
  }

  .flip-up {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 50%;
    overflow: hidden;
    transform-origin: 50% 100%;
    background: linear-gradient(180deg,
      rgba(255, 255, 255, 0.08) 0%,
      rgba(0, 0, 0, 0.08) 100%
    );
    border-radius: 0.25em 0.25em 0 0;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 2px;
      background: rgba(0, 0, 0, 0.25);
    }
  }

  .flip-down {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 50%;
    overflow: hidden;
    transform-origin: 50% 0%;
    background: linear-gradient(180deg,
      rgba(0, 0, 0, 0.12) 0%,
      rgba(255, 255, 255, 0.05) 100%
    );
    border-radius: 0 0 0.25em 0.25em;
  }

  .flip-layer.active .flip-down {
    transform: rotateX(90deg);
  }

  .flip-shadow {
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 2;
    opacity: 0;
    pointer-events: none;

    &.up {
      background: linear-gradient(to bottom,
        rgba(0, 0, 0, 0.08) 0%,
        rgba(0, 0, 0, 0.5) 100%
      );
    }

    &.down {
      background: linear-gradient(to bottom,
        rgba(0, 0, 0, 0.5) 0%,
        rgba(0, 0, 0, 0.08) 100%
      );
    }
  }

  .flip-inn {
    position: absolute;
    left: 0;
    width: 100%;
    height: 200%;
    color: var(--skin-text-primary);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    text-align: center;
    font-size: 1.8em;
    font-weight: 900;
    font-family: 'SF Mono', Monaco, 'Consolas', monospace;
    line-height: 1.15;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border-radius: 0.25em;
  }

  .flip-up .flip-inn {
    top: 0;
  }

  .flip-down .flip-inn {
    bottom: 0;
  }
}

@keyframes flipTop {
  0% {
    transform: rotateX(0deg);
  }
  100% {
    transform: rotateX(-90deg);
  }
}

@keyframes flipBottom {
  0% {
    transform: rotateX(90deg);
  }
  100% {
    transform: rotateX(0deg);
  }
}
</style>
