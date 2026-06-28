<template>
  <div class="motivational-quote">
    <div class="quote-container">
      <div class="quote-decoration">❝</div>
      <div class="quote-content">
        <div class="time-display">{{ currentTime }}</div>
        <div class="quote-text">{{ currentQuote }}</div>
        <div class="quote-author">— {{ currentAuthor }}</div>
      </div>
      <div class="status-card" :class="curStatusC.value">
        <LucideIcon :name="curStatusC.value === 'work' ? 'Coffee' : 'Sun'" :size="24" />
        <div class="status-info">
          <div class="status-label">{{ curStatusC.value === 'work' ? '专注中' : '休息中' }}</div>
          <div class="status-time">{{ displayTime }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import LucideIcon from '@/components/LucideIcon.vue';
import useGlobalSetting from '@/store/useGlobalSetting';
import useWorkOrRestStore from '@/store/useWorkOrReset';

const { curStatusC } = storeToRefs(useGlobalSetting());
const { nextRestTime, nextWorkTime } = storeToRefs(useWorkOrRestStore());

const currentTime = ref('');
const displayTime = ref('00:00:00');

const quotes = [
  { text: '坚持是成功的秘诀，专注是效率的源泉', author: '番茄工作法' },
  { text: '把大目标分解成小任务，一步一步来', author: '时间管理' },
  { text: '休息是为了更好地工作，保持节奏', author: '效率法则' },
  { text: '每一次专注都是一次成长', author: '自我提升' },
  { text: '保持专注，拒绝拖延', author: '行动力' },
  { text: '时间是最公平的资源，用好每一分钟', author: '时间哲学' },
];

const currentQuote = ref(quotes[0].text);
const currentAuthor = ref(quotes[0].author);

let timer = null;
let quoteTimer = null;

onMounted(() => {
  updateTime();
  timer = setInterval(() => {
    updateTime();
    updateCountdown();
  }, 1000);
  // 每60秒更换一条名言
  quoteTimer = setInterval(changeQuote, 60000);
});

onUnmounted(() => {
  clearInterval(timer);
  clearInterval(quoteTimer);
});

function updateTime() {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function updateCountdown() {
  if (curStatusC.value.value === 'work') {
    displayTime.value = countDown(nextRestTime.value);
  } else {
    displayTime.value = countDown(nextWorkTime.value);
  }
}

function changeQuote() {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  currentQuote.value = quotes[randomIndex].text;
  currentAuthor.value = quotes[randomIndex].author;
}

function countDown(time) {
  const now = (new Date()).getTime();
  const diff = (new Date(time)).getTime() - now;
  if (diff < 0) return '00:00:00';
  const h = Math.floor(diff / 1000 / 60 / 60);
  const m = Math.floor((diff / 1000 / 60) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
}
</script>

<style lang="scss" scoped>
.motivational-quote {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
}

.quote-container {
  text-align: center;
  color: #fff;
  max-width: 800px;
  padding: 40px;
}

.quote-decoration {
  font-size: 80px;
  color: rgba(255, 255, 255, 0.2);
  margin-bottom: -40px;
}

.quote-content {
  margin-bottom: 40px;

  .time-display {
    font-size: 72px;
    font-weight: 200;
    letter-spacing: -2px;
    margin-bottom: 30px;
    opacity: 0.9;
  }

  .quote-text {
    font-size: 28px;
    font-weight: 400;
    line-height: 1.6;
    margin-bottom: 20px;
    font-style: italic;
    opacity: 0.95;
  }

  .quote-author {
    font-size: 16px;
    opacity: 0.6;
    letter-spacing: 2px;
  }
}

.status-card {
  display: inline-flex;
  align-items: center;
  gap: 16px;
  padding: 16px 28px;
  border-radius: 50px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);

  &.work {
    color: #ff6b6b;
    border: 1px solid rgba(255, 107, 107, 0.3);
  }

  &.rest {
    color: #51cf66;
    border: 1px solid rgba(81, 207, 102, 0.3);
  }

  .status-info {
    text-align: left;

    .status-label {
      font-size: 14px;
      font-weight: 500;
    }

    .status-time {
      font-size: 20px;
      font-weight: 600;
      font-feature-settings: 'tnum';
    }
  }
}
</style>