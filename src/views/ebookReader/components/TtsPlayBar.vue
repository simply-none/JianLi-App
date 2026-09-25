<template>
  <transition name="tts-bar-fade">
    <div v-if="hasAdapter" class="tts-play-bar">
      <!-- 当前章节 / 队列内进度 -->
      <div class="tts-progress" :title="'本章进度 ' + (sectionProgress * 100).toFixed(0) + '%'">
        <div class="tts-progress-fill" :style="{ width: (sectionProgress * 100).toFixed(2) + '%' }"></div>
      </div>

      <div class="tts-bar-row">
        <!-- 状态 / 引擎提示 -->
        <div class="tts-meta">
          <LucideIcon name="Volume2" :size="15" class="tts-meta-icon" />
          <span class="tts-meta-text">{{ metaText }}</span>
        </div>

        <!-- 控制按钮 -->
        <div class="tts-controls">
          <button class="tts-btn" title="上一句" @click="prev">
            <LucideIcon name="SkipBack" :size="18" />
          </button>
          <button class="tts-btn tts-btn-main" :title="isPlaying ? '暂停' : '开始朗读'" @click="toggle">
            <LucideIcon :name="isPlaying ? 'Pause' : 'Play'" :size="20" />
          </button>
          <button class="tts-btn" title="停止" @click="stop">
            <LucideIcon name="Square" :size="18" />
          </button>
          <button class="tts-btn" title="下一句" @click="next">
            <LucideIcon name="SkipForward" :size="18" />
          </button>
        </div>

        <!-- 语速调节：点击循环预设档位 -->
        <div class="tts-rate" title="点击切换语速">
          <button class="tts-btn" @click="cycleRate">
            <LucideIcon name="Gauge" :size="16" />
          </button>
          <span class="tts-rate-text">{{ rate.toFixed(2) }}x</span>
        </div>
      </div>

      <!-- 当前朗读片段 / 错误提示 -->
      <div v-if="error" class="tts-error" :title="error">⚠ {{ error }}</div>
      <div v-else-if="currentSentenceText" class="tts-snippet" :title="currentSentenceText">
        {{ currentSentenceText }}
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { useBookTts } from '../composables/useBookTts';

const tts = useBookTts();
const {
  status,
  rate,
  sectionProgress,
  currentSentenceText,
  error,
  supportsBoundary,
  providerType,
  isLoading,
  hasAdapter,
  isPlaying,
} = tts;

/** 语速预设档位（点击循环） */
const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

function labelOf(p: string): string {
  switch (p) {
    case 'web':
      return 'Web 语音';
    case 'system':
      return '系统语音';
    case 'kokoro':
      return 'Kokoro';
    case 'piper':
      return 'Piper';
    case 'vits':
      return 'VITS';
    default:
      return p || '默认';
  }
}

const metaText = computed(() => {
  if (error.value) return '朗读出错';
  if (isLoading.value) return '准备中…';
  if (isPlaying.value) {
    return supportsBoundary.value ? '朗读中 · 逐字高亮' : '朗读中 · 整句高亮';
  }
  if (status.value === 'paused') return '已暂停';
  return providerType.value ? `就绪 · ${labelOf(providerType.value)}` : '就绪';
});

function cycleRate(): void {
  const idx = RATES.findIndex((r) => Math.abs(r - rate.value) < 0.001);
  const next = RATES[(idx + 1) % RATES.length];
  tts.setRate(next);
}

function toggle(): void {
  tts.toggle();
}
function stop(): void {
  tts.stop();
}
function prev(): void {
  tts.prev();
}
function next(): void {
  tts.next();
}
</script>

<style scoped>
/* 浮动朗读控制条：深色半透明卡片，适配浅色/深色阅读底色 */
.tts-play-bar {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  z-index: 1500;
  width: min(560px, calc(100vw - 48px));
  background: rgba(32, 33, 40, 0.86);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.28);
  padding: 10px 14px 11px;
  color: #ececf1;
  font-size: 13px;
  user-select: none;
}

.tts-progress {
  height: 3px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.14);
  overflow: hidden;
  margin-bottom: 9px;
}
.tts-progress-fill {
  height: 100%;
  background: var(--color-primary, #6c5ce7);
  transition: width 0.2s ease;
}

.tts-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tts-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
}
.tts-meta-icon {
  color: var(--color-primary, #6c5ce7);
  flex: 0 0 auto;
}
.tts-meta-text {
  color: #b9b9c6;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tts-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.tts-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.08);
  color: #ececf1;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
}
.tts-btn:hover {
  background: rgba(255, 255, 255, 0.18);
}
.tts-btn:active {
  transform: scale(0.94);
}
.tts-btn-main {
  width: 40px;
  height: 40px;
  background: var(--color-primary, #6c5ce7);
  color: #fff;
}
.tts-btn-main:hover {
  background: var(--color-primary, #6c5ce7);
  filter: brightness(1.08);
}

.tts-rate {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}
.tts-rate-text {
  font-size: 12px;
  color: #cfcfda;
  min-width: 34px;
  text-align: center;
}

.tts-snippet {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #d7d7e0;
  max-height: 38px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: normal;
}
.tts-error {
  margin-top: 8px;
  font-size: 12px;
  color: #ff9a8b;
}

.tts-bar-fade-enter-active,
.tts-bar-fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.tts-bar-fade-enter-from,
.tts-bar-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
