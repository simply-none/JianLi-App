<template>
  <div class="small-window" :class="statusClass">
    <div class="window-content">
      <div class="status-section">
        <div class="status-icon">
          <component :is="statusIcon" />
        </div>
        <div class="status-info">
          <div class="status-label">{{ statusLabel }}</div>
          <div class="next-time">{{ nextTimeLabel }}：{{ nextTimeValue }}</div>
        </div>
      </div>

      <div class="progress-section">
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: progressPercent + '%' }"
          ></div>
        </div>
        <div class="progress-text">{{ Math.round(progressPercent) }}%</div>
      </div>

      <div class="countdown-section">
        <div class="countdown-label">{{ countdownLabel }}</div>
        <div class="countdown-value">{{ countdownValue }}</div>
      </div>
    </div>

    <div class="setting-btn" @click="toSetting">
      <Setting />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import useWorkOrResetStore from '@/store/useWorkOrReset';
import { storeToRefs } from 'pinia';
import { Setting, Timer, Coffee } from '@element-plus/icons-vue';

const router = useRouter();
const timer = ref(null);

const {
  nextRestTime,
  nextWorkTime,
  startWorkTime,
  closeWorkTime,
  curStatus,
} = storeToRefs(useWorkOrResetStore());

const statusIcon = computed(() => {
  return curStatus.value === 'work' ? Timer : Coffee;
});

const statusClass = computed(() => {
  return curStatus.value === 'work' ? 'status-work' : 'status-rest';
});

const statusLabel = computed(() => {
  return curStatus.value === 'work' ? '工作中' : '休息中';
});

const nextTimeLabel = computed(() => {
  return curStatus.value === 'work' ? '下次休息' : '下次工作';
});

const nextTimeValue = computed(() => {
  const time = curStatus.value === 'work' ? nextRestTime.value : nextWorkTime.value;
  if (!time) return '--:--';
  return new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
});

const countdownLabel = computed(() => {
  return curStatus.value === 'work' ? '距离休息' : '距离工作';
});

const countdownValue = ref('00:00:00');

const progressPercent = computed(() => {
  const now = new Date().getTime();
  const status = curStatus.value;
  
  if (status === 'work') {
    const start = startWorkTime.value ? new Date(startWorkTime.value).getTime() : now;
    const end = nextRestTime.value ? new Date(nextRestTime.value).getTime() : now;
    const total = end - start;
    const current = now - start;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, (current / total) * 100));
  } else {
    const start = closeWorkTime.value ? new Date(closeWorkTime.value).getTime() : now;
    const end = nextWorkTime.value ? new Date(nextWorkTime.value).getTime() : now;
    const total = end - start;
    const current = now - start;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, (current / total) * 100));
  }
});

function countDown(time) {
  const now = new Date().getTime();
  const diff = new Date(time).getTime() - now;
  if (diff < 0) return '00:00:00';
  const h = Math.floor(diff / 1000 / 60 / 60);
  const m = Math.floor((diff / 1000 / 60) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateCountdown() {
  if (curStatus.value === 'work') {
    countdownValue.value = countDown(nextRestTime.value);
  } else {
    countdownValue.value = countDown(nextWorkTime.value);
  }
}

onMounted(() => {
  updateCountdown();
  timer.value = setInterval(updateCountdown, 1000);
});

onUnmounted(() => {
  if (timer.value) {
    clearInterval(timer.value);
  }
});

function toSetting() {
  router.push('/setting');
}
</script>

<style lang="scss" scoped>
.small-window {
  width: 280px;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  padding: 20px;
  box-sizing: border-box;
  border-radius: 16px;
  transition: all 0.5s ease;
  -webkit-app-region: drag;
  position: relative;
  overflow: hidden;

  &.status-work {
    background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
    
    .status-icon {
      background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
    }
    
    .status-label {
      color: #2e7d32;
    }
    
    .progress-fill {
      background: linear-gradient(90deg, #4caf50 0%, #66bb6a 100%);
    }
    
    .countdown-value {
      color: #2e7d32;
    }
  }

  &.status-rest {
    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
    
    .status-icon {
      background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
    }
    
    .status-label {
      color: #1565c0;
    }
    
    .progress-fill {
      background: linear-gradient(90deg, #2196f3 0%, #42a5f5 100%);
    }
    
    .countdown-value {
      color: #1565c0;
    }
  }
}

.window-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 1;
}

.status-section {
  display: flex;
  align-items: center;
  gap: 12px;
  
  .status-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease;
    
    &:hover {
      transform: scale(1.05);
    }
    
    .el-icon {
      font-size: 24px;
      color: #fff;
    }
  }
  
  .status-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    
    .status-label {
      font-size: 18px;
      font-weight: 700;
    }
    
    .next-time {
      font-size: 13px;
      color: #666;
    }
  }
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 10px;
  
  .progress-bar {
    flex: 1;
    height: 8px;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 4px;
    overflow: hidden;
    
    .progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 1s ease;
    }
  }
  
  .progress-text {
    font-size: 12px;
    font-weight: 600;
    color: #666;
    min-width: 36px;
    text-align: right;
  }
}

.countdown-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  
  .countdown-label {
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  
  .countdown-value {
    font-size: 36px;
    font-weight: 900;
    font-family: 'SF Mono', Monaco, 'Consolas', monospace;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
}

.setting-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.8);
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  .el-icon {
    font-size: 18px;
    color: #666;
  }
}
</style>
