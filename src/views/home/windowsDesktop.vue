<template>
  <div class="windows-desktop">
    <!-- 桌面背景 -->
    <div class="desktop-bg"></div>

    <!-- 桌面图标 -->
    <div class="desktop-icons">
      <div class="desktop-icon">
        <div class="icon-wrap">
          <LucideIcon name="Monitor" :size="40" />
        </div>
        <span class="icon-label">此电脑</span>
      </div>
      <div class="desktop-icon">
        <div class="icon-wrap">
          <LucideIcon name="Trash2" :size="36" />
        </div>
        <span class="icon-label">回收站</span>
      </div>
      <div class="desktop-icon">
        <div class="icon-wrap">
          <LucideIcon name="FolderOpen" :size="36" />
        </div>
        <span class="icon-label">文档</span>
      </div>
    </div>

    <!-- 番茄钟应用窗口 -->
    <div class="app-window">
      <div class="window-titlebar">
        <div class="titlebar-left">
          <div class="window-icon">
            <LucideIcon name="Timer" :size="16" />
          </div>
          <span class="window-title">番茄钟</span>
        </div>
        <div class="titlebar-right">
          <button class="titlebar-btn minimize">
            <LucideIcon name="Minus" :size="12" />
          </button>
          <button class="titlebar-btn maximize">
            <LucideIcon name="Square" :size="12" />
          </button>
          <button class="titlebar-btn close">
            <LucideIcon name="X" :size="14" />
          </button>
        </div>
      </div>
      <div class="window-content">
        <div class="pomodoro-display">
          <div class="status-row">
            <span class="status-label" :class="curStatusC.value">
              {{ curStatusC.value === 'work' ? '专注中' : '休息中' }}
            </span>
            <span class="round-info">第 3 轮</span>
          </div>
          <div class="time-display">{{ displayTime }}</div>
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            </div>
            <span class="progress-percent">{{ Math.round(progress) }}%</span>
          </div>
          <div class="control-btns">
            <button class="ctrl-btn">
              <LucideIcon name="SkipBack" :size="18" />
            </button>
            <button class="ctrl-btn primary">
              <LucideIcon :name="curStatusC.value === 'work' ? 'Pause' : 'Play'" :size="20" />
            </button>
            <button class="ctrl-btn">
              <LucideIcon name="SkipForward" :size="18" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部任务栏 -->
    <div class="taskbar">
      <div class="taskbar-left">
        <div class="taskbar-btn start-btn">
          <LucideIcon name="LayoutGrid" :size="20" />
        </div>
        <div class="taskbar-btn">
          <LucideIcon name="Search" :size="18" />
        </div>
        <div class="taskbar-btn">
          <LucideIcon name="LayoutDashboard" :size="18" />
        </div>
      </div>

      <div class="taskbar-center">
        <div class="taskbar-app">
          <LucideIcon name="Folder" :size="20" />
        </div>
        <div class="taskbar-app">
          <LucideIcon name="Globe" :size="20" />
        </div>
        <div class="taskbar-app active">
          <LucideIcon name="Timer" :size="20" />
          <span class="app-indicator"></span>
        </div>
        <div class="taskbar-app">
          <LucideIcon name="Settings" :size="20" />
        </div>
        <div class="taskbar-app">
          <LucideIcon name="ShoppingBag" :size="20" />
        </div>
      </div>

      <div class="taskbar-right">
        <div class="tray-icons">
          <div class="tray-item">
            <LucideIcon name="Sun" :size="14" />
            <span>26°</span>
          </div>
          <div class="tray-item">
            <LucideIcon name="Wifi" :size="14" />
          </div>
          <div class="tray-item">
            <LucideIcon name="Volume2" :size="14" />
          </div>
          <div class="tray-item">
            <LucideIcon name="BatteryMedium" :size="14" />
          </div>
        </div>
        <div class="tray-clock">
          <div class="clock-time">{{ currentTime }}</div>
          <div class="clock-date">{{ currentDate }}</div>
        </div>
        <div class="show-desktop"></div>
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
const { nextRestTime, nextWorkTime, workTimeGapUnit, restTimeGapUnit } = storeToRefs(useWorkOrRestStore());

const currentTime = ref('');
const currentDate = ref('');
const displayTime = ref('00:00:00');
const progress = ref(0);

let timer = null;

onMounted(() => {
  updateTime();
  updateCountdown();
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
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  currentDate.value = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

function updateCountdown() {
  if (curStatusC.value.value === 'work') {
    displayTime.value = countDown(nextRestTime.value);
    const total = workTimeGapUnit.value * 60 * 1000;
    const remaining = new Date(nextRestTime.value).getTime() - new Date().getTime();
    progress.value = Math.max(0, Math.min(100, (1 - remaining / total) * 100));
  } else {
    displayTime.value = countDown(nextWorkTime.value);
    const total = restTimeGapUnit.value * 60 * 1000;
    const remaining = new Date(nextWorkTime.value).getTime() - new Date().getTime();
    progress.value = Math.max(0, Math.min(100, (1 - remaining / total) * 100));
  }
}

function countDown(time) {
  const now = new Date().getTime();
  const diff = new Date(time).getTime() - now;
  if (diff < 0) return '00:00:00';
  const h = Math.floor(diff / 1000 / 60 / 60);
  const m = Math.floor((diff / 1000 / 60) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
}
</script>

<style lang="scss" scoped>
.windows-desktop {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  user-select: none;
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* 桌面背景 */
.desktop-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(ellipse at 30% 20%, rgba(99, 179, 237, 0.4) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 80%, rgba(138, 99, 237, 0.3) 0%, transparent 50%),
    linear-gradient(135deg, #0078d4 0%, #005a9e 50%, #1e3a5f 100%);
  z-index: 0;
}

/* 桌面图标 */
.desktop-icons {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;

  .desktop-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 80px;
    padding: 8px 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .icon-wrap {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
      margin-bottom: 4px;
    }

    .icon-label {
      font-size: 12px;
      color: #fff;
      text-align: center;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      line-height: 1.3;
    }
  }
}

/* 应用窗口 */
.app-window {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -55%);
  width: 380px;
  background: #f3f3f3;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  z-index: 20;

  .window-titlebar {
    height: 36px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #e0e0e0;

    .titlebar-left {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-left: 12px;

      .window-icon {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #0078d4;
      }

      .window-title {
        font-size: 12px;
        color: #333;
        font-weight: 500;
      }
    }

    .titlebar-right {
      display: flex;
      height: 100%;

      .titlebar-btn {
        width: 46px;
        height: 100%;
        border: none;
        background: transparent;
        color: #666;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;

        &:hover {
          background: #e5e5e5;
        }

        &.close:hover {
          background: #e81123;
          color: #fff;
        }
      }
    }
  }

  .window-content {
    padding: 24px;
    background: #fff;

    .pomodoro-display {
      text-align: center;

      .status-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 16px;

        .status-label {
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;

          &.work {
            background: rgba(0, 120, 212, 0.1);
            color: #0078d4;
          }

          &.rest {
            background: rgba(16, 185, 129, 0.1);
            color: #10b981;
          }
        }

        .round-info {
          font-size: 12px;
          color: #999;
        }
      }

      .time-display {
        font-size: 56px;
        font-weight: 300;
        color: #333;
        font-feature-settings: 'tnum';
        letter-spacing: 2px;
        margin-bottom: 20px;
      }

      .progress-container {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 24px;

        .progress-bar {
          flex: 1;
          height: 6px;
          background: #e5e5e5;
          border-radius: 3px;
          overflow: hidden;

          .progress-fill {
            height: 100%;
            background: #0078d4;
            border-radius: 3px;
            transition: width 0.3s;
          }
        }

        .progress-percent {
          font-size: 12px;
          color: #999;
          min-width: 32px;
          text-align: right;
          font-feature-settings: 'tnum';
        }
      }

      .control-btns {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;

        .ctrl-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: #f0f0f0;
          color: #666;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;

          &:hover {
            background: #e5e5e5;
            color: #333;
          }

          &.primary {
            width: 52px;
            height: 52px;
            background: #0078d4;
            color: #fff;

            &:hover {
              background: #005a9e;
            }
          }
        }
      }
    }
  }
}

/* 任务栏 */
.taskbar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 48px;
  background: rgba(32, 32, 32, 0.85);
  backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  z-index: 100;
  border-top: 1px solid rgba(255, 255, 255, 0.08);

  .taskbar-left {
    display: flex;
    align-items: center;
    gap: 2px;
    width: 120px;

    .taskbar-btn {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      &.start-btn {
        color: #4cc2ff;
      }
    }
  }

  .taskbar-center {
    display: flex;
    align-items: center;
    gap: 2px;

    .taskbar-app {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      cursor: pointer;
      position: relative;
      transition: background 0.15s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      &.active {
        background: rgba(255, 255, 255, 0.15);

        .app-indicator {
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 16px;
          height: 3px;
          background: #4cc2ff;
          border-radius: 2px;
        }
      }
    }
  }

  .taskbar-right {
    display: flex;
    align-items: center;
    gap: 4px;

    .tray-icons {
      display: flex;
      align-items: center;
      gap: 4px;

      .tray-item {
        height: 32px;
        padding: 0 6px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 4px;
        color: #fff;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.15s;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      }
    }

    .tray-clock {
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      text-align: right;
      transition: background 0.15s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .clock-time {
        font-size: 12px;
        color: #fff;
        font-feature-settings: 'tnum';
        line-height: 1.2;
      }

      .clock-date {
        font-size: 11px;
        color: #ccc;
        line-height: 1.2;
        margin-top: 2px;
      }
    }

    .show-desktop {
      width: 4px;
      height: 100%;
      border-left: 1px solid rgba(255, 255, 255, 0.2);
      cursor: pointer;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }
  }
}
</style>
