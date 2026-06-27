<template>
  <div class="flip-countdown">
    <!-- 时:分:秒 分组 -->
    <div class="flip-group">
      <div class="flip-unit">
        <FlipCard :digit="digits[0]" :prevDigit="prevDigits[0]" :flipping="flipping[0]" />
      </div>
      <div class="flip-unit">
        <FlipCard :digit="digits[1]" :prevDigit="prevDigits[1]" :flipping="flipping[1]" />
      </div>
    </div>

    <div class="flip-colon">
      <span></span>
      <span></span>
    </div>

    <div class="flip-group">
      <div class="flip-unit">
        <FlipCard :digit="digits[2]" :prevDigit="prevDigits[2]" :flipping="flipping[2]" />
      </div>
      <div class="flip-unit">
        <FlipCard :digit="digits[3]" :prevDigit="prevDigits[3]" :flipping="flipping[3]" />
      </div>
    </div>

    <div class="flip-colon">
      <span></span>
      <span></span>
    </div>

    <div class="flip-group">
      <div class="flip-unit">
        <FlipCard :digit="digits[4]" :prevDigit="prevDigits[4]" :flipping="flipping[4]" />
      </div>
      <div class="flip-unit">
        <FlipCard :digit="digits[5]" :prevDigit="prevDigits[5]" :flipping="flipping[5]" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import FlipCard from './FlipCard.vue'

const props = defineProps<{
  countdown: string
}>()

const digits = ref(['0', '0', '0', '0', '0', '0'])
const prevDigits = ref(['0', '0', '0', '0', '0', '0'])
const flipping = ref([false, false, false, false, false, false])

const parseCountdown = (str: string): string[] => {
  const parts = str.split(':')
  const result: string[] = []
  for (const part of parts) {
    result.push(part[0] || '0')
    result.push(part[1] || '0')
  }
  while (result.length < 6) {
    result.unshift('0')
  }
  return result.slice(-6)
}

watch(() => props.countdown, (newVal) => {
  const newDigits = parseCountdown(newVal)

  for (let i = 0; i < 6; i++) {
    if (newDigits[i] !== digits.value[i]) {
      flipping.value[i] = true
      setTimeout(() => {
        flipping.value[i] = false
      }, 600)
    }
  }

  prevDigits.value = [...digits.value]
  digits.value = newDigits
}, { immediate: true })
</script>

<style lang="scss" scoped>
.flip-countdown {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.15em;
}

.flip-group {
  display: flex;
  gap: 0.12em;
}

.flip-unit {
  width: 1.6em;
  height: 2.4em;
  perspective: 200px;
}

.flip-colon {
  display: flex;
  flex-direction: column;
  gap: 0.55em;
  margin: 0 0.08em;

  span {
    width: 0.22em;
    height: 0.22em;
    border-radius: 50%;
    background: var(--skin-dot);
    box-shadow: 0 0 4px var(--skin-dot-glow);
  }
}
</style>
