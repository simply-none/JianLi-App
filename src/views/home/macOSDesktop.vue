<template>
  <div class="macos-desktop">
    <!-- 桌面背景 -->
    <div class="desktop-bg"></div>

    <!-- 顶部菜单栏 -->
    <div class="menu-bar">
      <div class="menu-left">
        <span class="apple-logo">
          <LucideIcon name="Apple" :size="15" />
        </span>
        <span class="menu-item active">访达</span>
        <span class="menu-item">文件</span>
        <span class="menu-item">编辑</span>
        <span class="menu-item">显示</span>
        <span class="menu-item">前往</span>
        <span class="menu-item">窗口</span>
        <span class="menu-item">帮助</span>
      </div>
      <div class="menu-right">
        <span class="menu-icon">
          <LucideIcon name="BatteryMedium" :size="14" />
        </span>
        <span class="menu-icon">
          <LucideIcon name="Wifi" :size="14" />
        </span>
        <span class="menu-icon">
          <LucideIcon name="Search" :size="14" />
        </span>
        <span class="menu-icon">
          <LucideIcon name="SlidersHorizontal" :size="14" />
        </span>
        <span class="time">{{ currentTime }}</span>
      </div>
    </div>

    <!-- 桌面图标（右侧） -->
    <div class="desktop-icons">
      <div class="desktop-icon">
        <div class="icon-wrap">
          <LucideIcon name="Monitor" :size="48" />
        </div>
        <span class="icon-label">Macintosh HD</span>
      </div>
      <div class="desktop-icon">
        <div class="icon-wrap folder-icon">
          <LucideIcon name="Folder" :size="44" />
        </div>
        <span class="icon-label">文档</span>
      </div>
      <div class="desktop-icon">
        <div class="icon-wrap trash-icon">
          <LucideIcon name="Trash2" :size="40" />
        </div>
        <span class="icon-label">废纸篓</span>
      </div>
    </div>

    <!-- 番茄钟应用窗口 -->
    <div class="app-window">
      <div class="window-titlebar">
        <div class="traffic-lights">
          <span class="traffic-light close"></span>
          <span class="traffic-light minimize"></span>
          <span class="traffic-light maximize"></span>
        </div>
        <div class="window-title">番茄钟</div>
        <div class="titlebar-placeholder"></div>
      </div>
      <div class="window-content">
        <div class="pomodoro-display">
          <div class="status-row">
            <span class="status-badge" :class="curStatusC.value">
              {{ curStatusC.value === 'work' ? '专注中' : '休息中' }}
            </span>
            <span class="round-text">第 3 轮</span>
          </div>
          <div class="time-display">{{ displayTime }}</div>
          <div class="progress-wrapper">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            </div>
            <span class="progress-text">{{ Math.round(progress) }}%</span>
          </div>
          <div class="action-btns">
            <button class="action-btn">
              <LucideIcon name="SkipBack" :size="16" />
            </button>
            <button class="action-btn primary">
              <LucideIcon :name="curStatusC.value === 'work' ? 'Pause' : 'Play'" :size="18" />
            </button>
            <button class="action-btn">
              <LucideIcon name="SkipForward" :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部 Dock -->
    <div class="dock">
      <div class="dock-item">
        <div class="dock-icon finder-icon">
          <LucideIcon name="Smile" :size="28" />
        </div>
        <span class="dock-label">访达</span>
      </div>
      <div class="dock-item">
        <div class="dock-icon launchpad-icon">
          <LucideIcon name="LayoutGrid" :size="26" />
        </div>
        <span class="dock-label">启动台</span>
      </div>
      <div class="dock-item">
        <div class="dock-icon safari-icon">
          <LucideIcon name="Compass" :size="28" />
        </div>
        <span class="dock-label">Safari</span>
      </div>
      <div class="dock-item">
        <div class="dock-icon notes-icon">
          <LucideIcon name="StickyNote" :size="26" />
        </div>
        <span class="dock-label">备忘录</span>
      </div>
      <div class="dock-item">
        <div class="dock-icon photos-icon">
          <LucideIcon name="Image" :size="26" />
        </div>
        <span class="dock-label">照片</span>
      </div>
      <div class="dock-item">
        <div class="dock-icon music-icon">
          <LucideIcon name="Music" :size="26" />
        </div>
        <span class="dock-label">音乐</span>
      </div>
      <div class="dock-item active">
        <div class="dock-icon pomodoro-icon">
          <LucideIcon name="Timer" :size="28" />
        </div>
        <span class="dock-label">番茄钟</span>
        <span class="dock-indicator"></span>
      </div>
      <div class="dock-item">
        <div class="dock-icon settings-icon">
          <LucideIcon name="Settings" :size="26" />
        </div>
        <span class="dock-label">系统设置</span>
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
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
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
.macos-desktop {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', Roboto, sans-serif;
  color: #fff;
}

/* 桌面背景 */
.desktop-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(ellipse at 20% 30%, rgba(120, 119, 198, 0.5) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
    linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
  z-index: 0;
}

/* 顶部菜单栏 */
.menu-bar {
  height: 28px;
  background: rgba(30, 30, 30, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 500;
  position: relative;
  z-index: 100;

  .menu-left {
    display: flex;
    align-items: center;
    gap: 14px;

    .apple-logo {
      display: flex;
      align-items: center;
    }

    .menu-item {
      cursor: default;

      &.active {
        font-weight: 600;
      }
    }
  }

  .menu-right {
    display: flex;
    align-items: center;
    gap: 14px;

    .menu-icon {
      display: flex;
      align-items: center;
      cursor: default;
    }

    .time {
      font-weight: 500;
    }
  }
}

/* 桌面图标（右侧） */
.desktop-icons {
  position: absolute;
  top: 48px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 10;

  .desktop-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 80px;
    padding: 8px 4px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .icon-wrap {
      width: 56px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 4px;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));

      &.folder-icon {
        color: #60a5fa;
      }

      &.trash-icon {
        color: #a0a0a0;
      }
    }

    .icon-label {
      font-size: 12px;
      color: #fff;
      text-align: center;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
      line-height: 1.3;
    }
  }
}

/* 应用窗口 */
.app-window {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-55%, -55%);
  width: 380px;
  background: rgba(40, 40, 42, 0.85);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  z-index: 20;
  border: 1px solid rgba(255, 255, 255, 0.1);

  .window-titlebar {
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(50, 50, 52, 0.6);

    .traffic-lights {
      display: flex;
      gap: 8px;

      .traffic-light {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        cursor: pointer;

        &.close {
          background: #ff5f57;
        }

        &.minimize {
          background: #febc2e;
        }

        &.maximize {
          background: #28c840;
        }
      }
    }

    .window-title {
      font-size: 13px;
      font-weight: 500;
      color: #e0e0e0;
    }

    .titlebar-placeholder {
      width: 52px;
    }
  }

  .window-content {
    padding: 28px 24px 24px;

    .pomodoro-display {
      text-align: center;

      .status-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 16px;

        .status-badge {
          padding: 4px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;

          &.work {
            background: rgba(255, 107, 107, 0.2);
            color: #ff6b6b;
          }

          &.rest {
            background: rgba(81, 207, 102, 0.2);
            color: #51cf66;
          }
        }

        .round-text {
          font-size: 12px;
          color: #999;
        }
      }

      .time-display {
        font-size: 52px;
        font-weight: 200;
        color: #fff;
        font-feature-settings: 'tnum';
        letter-spacing: 2px;
        margin-bottom: 20px;
      }

      .progress-wrapper {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 24px;

        .progress-bar {
          flex: 1;
          height: 5px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
          overflow: hidden;

          .progress-fill {
            height: 100%;
            background: #007aff;
            border-radius: 3px;
            transition: width 0.3s;
          }
        }

        .progress-text {
          font-size: 11px;
          color: #888;
          min-width: 30px;
          text-align: right;
          font-feature-settings: 'tnum';
        }
      }

      .action-btns {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;

        .action-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: #ccc;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;

          &:hover {
            background: rgba(255, 255, 255, 0.15);
            color: #fff;
          }

          &.primary {
            width: 50px;
            height: 50px;
            background: #007aff;
            color: #fff;

            &:hover {
              background: #0066d6;
            }
          }
        }
      }
    }
  }
}

/* 底部 Dock */
.dock {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 18px;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 6px 10px 8px;
  z-index: 100;
  border: 1px solid rgba(255, 255, 255, 0.15);

  .dock-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    position: relative;
    transition: transform 0.2s ease;

    &:hover {
      transform: translateY(-8px) scale(1.15);
      transform-origin: bottom center;
    }

    &.active {
      transform: translateY(-4px);

      .dock-indicator {
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        width: 4px;
        height: 4px;
        background: #fff;
        border-radius: 50%;
      }
    }

    .dock-icon {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.95);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);

      &.finder-icon {
        color: #4facfe;
        background: linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%);
      }

      &.launchpad-icon {
        color: #fff;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      &.safari-icon {
        color: #fff;
        background: linear-gradient(180deg, #60a5fa 0%, #2563eb 100%);
      }

      &.notes-icon {
        color: #f59e0b;
        background: linear-gradient(180deg, #fef3c7 0%, #fde68a 100%);
      }

      &.photos-icon {
        color: #fff;
        background: linear-gradient(135deg, #f472b6 0%, #fb923c 50%, #fbbf24 100%);
      }

      &.music-icon {
        color: #fff;
        background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
      }

      &.pomodoro-icon {
        color: #fff;
        background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
      }

      &.settings-icon {
        color: #6b7280;
        background: linear-gradient(180deg, #e5e7eb 0%, #d1d5db 100%);
      }
    }

    .dock-label {
      position: absolute;
      top: -28px;
      font-size: 11px;
      color: #fff;
      background: rgba(0, 0, 0, 0.7);
      padding: 3px 8px;
      border-radius: 4px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s;
    }

    &:hover .dock-label {
      opacity: 1;
    }
  }
}
</style>
