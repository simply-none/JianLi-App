<template>
  <div class="news-reader">
    <!-- 顶部导航 -->
    <div class="top-nav">
      <div class="nav-brand">
        <LucideIcon name="Newspaper" :size="24" />
        <span>今日资讯</span>
      </div>
      <div class="nav-time">{{ currentDate }}</div>
    </div>

    <!-- 主要内容 -->
    <div class="main-content">
      <div class="news-layout">
        <!-- 左侧时间卡片 -->
        <div class="time-card">
          <div class="time-display">{{ currentTime }}</div>
          <div class="date-display">{{ currentDateShort }}</div>
          <div class="weekday">{{ weekday }}</div>
        </div>

        <!-- 右侧状态卡片 -->
        <div class="news-section">
          <div class="section-header">
            <LucideIcon name="Timer" :size="20" />
            <span>番茄钟状态</span>
          </div>
          <div class="status-card" :class="curStatusC.value">
            <div class="status-header">
              <span class="status-label">{{ curStatusC.value === 'work' ? '专注中' : '休息中' }}</span>
              <span class="status-time">{{ displayTime }}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            </div>
            <div class="status-info">
              <span>工作时长: {{ workTimeGap }}分钟</span>
              <span>休息时长: {{ restTimeGap }}分钟</span>
            </div>
          </div>
        </div>

        <!-- 底部热点新闻 -->
        <div class="hot-topics">
          <div class="topic-header">
            <LucideIcon name="TrendingUp" :size="18" />
            <span>效率提示</span>
          </div>
          <div class="topic-list">
            <div class="topic-item">
              <span class="topic-rank">01</span>
              <span class="topic-text">{{ tipText }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import LucideIcon from '@/components/LucideIcon.vue';
import useGlobalSetting from '@/store/useGlobalSetting';
import useWorkOrRestStore from '@/store/useWorkOrReset';

const { curStatusC } = storeToRefs(useGlobalSetting());
const { nextRestTime, nextWorkTime, workTimeGapUnit, restTimeGapUnit } = storeToRefs(useWorkOrRestStore());

const currentTime = ref('');
const currentDate = ref('');
const currentDateShort = ref('');
const weekday = ref('');
const displayTime = ref('00:00:00');
const progress = ref(0);

const workTimeGap = computed(() => workTimeGapUnit.value);
const restTimeGap = computed(() => restTimeGapUnit.value);

const tips = [
  '保持专注，一次只做一件事',
  '适当休息，提高工作效率',
  '番茄工作法，效率提升50%',
  '合理规划时间，避免拖延',
  '专注25分钟，休息5分钟',
];

const tipText = computed(() => {
  const index = Math.floor(Date.now() / 60000) % tips.length;
  return tips[index];
});

let timer = null;

onMounted(() => {
  updateTime();
  timer = setInterval(() => {
    updateTime();
    updateCountdown();
  }, 1000);
});

onUnmounted(() => {
  clearInterval(timer);
});

function updateTime() {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  currentDate.value = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  currentDateShort.value = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  weekday.value = weekdays[now.getDay()];
}

function updateCountdown() {
  if (curStatusC.value.value === 'work') {
    displayTime.value = countDown(nextRestTime.value);
    const total = workTimeGapUnit.value * 60 * 1000;
    const remaining = (new Date(nextRestTime.value)).getTime() - (new Date()).getTime();
    progress.value = Math.max(0, Math.min(100, (1 - remaining / total) * 100));
  } else {
    displayTime.value = countDown(nextWorkTime.value);
    const total = restTimeGapUnit.value * 60 * 1000;
    const remaining = (new Date(nextWorkTime.value)).getTime() - (new Date()).getTime();
    progress.value = Math.max(0, Math.min(100, (1 - remaining / total) * 100));
  }
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
.news-reader {
  width: 100%;
  height: 100%;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  user-select: none;
}

.top-nav {
  height: 60px;
  background: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 40px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  .nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 20px;
    font-weight: 600;
    color: #333;
  }

  .nav-time {
    font-size: 14px;
    color: #666;
  }
}

.main-content {
  flex: 1;
  padding: 40px;
  overflow: auto;
}

.news-layout {
  max-width: 900px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 280px 1fr;
  grid-template-rows: auto auto;
  gap: 24px;
}

.time-card {
  grid-row: span 2;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 40px 30px;
  color: #fff;
  text-align: center;

  .time-display {
    font-size: 56px;
    font-weight: 200;
    font-feature-settings: 'tnum';
    margin-bottom: 20px;
  }

  .date-display {
    font-size: 18px;
    opacity: 0.9;
    margin-bottom: 8px;
  }

  .weekday {
    font-size: 14px;
    opacity: 0.7;
  }
}

.news-section {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 600;
    color: #333;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #eee;
  }
}

.status-card {
  .status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .status-label {
      font-size: 14px;
      font-weight: 500;
      padding: 4px 12px;
      border-radius: 4px;

      .status-card.work & {
        background: rgba(255, 107, 107, 0.1);
        color: #ff6b6b;
      }

      .status-card.rest & {
        background: rgba(81, 207, 102, 0.1);
        color: #51cf66;
      }
    }

    .status-time {
      font-size: 32px;
      font-weight: 300;
      color: #333;
      font-feature-settings: 'tnum';
    }
  }

  .progress-bar {
    height: 8px;
    background: #eee;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 16px;

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border-radius: 4px;
      transition: width 0.3s;
    }
  }

  .status-info {
    display: flex;
    gap: 24px;
    font-size: 13px;
    color: #666;
  }
}

.hot-topics {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  grid-column: span 2;

  .topic-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 600;
    color: #333;
    margin-bottom: 16px;
  }

  .topic-list {
    .topic-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;

      &:last-child {
        border-bottom: none;
      }

      .topic-rank {
        font-size: 20px;
        font-weight: 700;
        color: #667eea;
        min-width: 30px;
      }

      .topic-text {
        font-size: 15px;
        color: #333;
      }
    }
  }
}
</style>