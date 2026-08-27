<template>
  <div class="search-engine">
    <!-- 顶部导航栏 -->
    <div class="top-nav">
      <div class="nav-left">
        <span class="nav-link">新闻</span>
        <span class="nav-link">hao123</span>
        <span class="nav-link">地图</span>
        <span class="nav-link">贴吧</span>
        <span class="nav-link">视频</span>
        <span class="nav-link">图片</span>
        <span class="nav-link">网盘</span>
        <span class="nav-link more">更多 »</span>
      </div>
      <div class="nav-right">
        <div class="pomodoro-status" :class="status.key">
          <LucideIcon name="Timer" :size="14" />
          <span class="status-text">{{ displayTime }}</span>
        </div>
        <span class="nav-link">设置</span>
        <span class="nav-link login-btn">登录</span>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- Logo 区域 -->
      <div class="logo-area">
        <div class="logo">
        </div>
      </div>

      <!-- 搜索框区域 -->
      <div class="search-wrap">
        <div class="search-box">
          <div class="search-input-wrap">
            <LucideIcon name="Search" :size="18" class="search-icon" />
            <input
              type="text"
              class="search-input"
              :placeholder="searchPlaceholder"
              readonly
            />
            <div class="search-suggestion">
              <div class="suggestion-item">
                <LucideIcon name="Clock" :size="14" />
                <span>番茄钟工作时间设置</span>
              </div>
              <div class="suggestion-item">
                <LucideIcon name="Clock" :size="14" />
                <span>番茄工作法是什么</span>
              </div>
              <div class="suggestion-item">
                <LucideIcon name="TrendingUp" :size="14" />
                <span>如何提高专注力</span>
              </div>
            </div>
          </div>
          <button class="search-btn">百度一下</button>
        </div>
      </div>

      <!-- 快捷入口 -->
      <div class="quick-entries">
        <div class="entry-item">
          <LucideIcon name="Newspaper" :size="18" />
          <span>新闻资讯</span>
        </div>
        <div class="entry-item">
          <LucideIcon name="CloudSun" :size="18" />
          <span>天气预报</span>
        </div>
        <div class="entry-item">
          <LucideIcon name="MapPin" :size="18" />
          <span>地图导航</span>
        </div>
        <div class="entry-item">
          <LucideIcon name="Video" :size="18" />
          <span>视频</span>
        </div>
        <div class="entry-item">
          <LucideIcon name="Music" :size="18" />
          <span>音乐</span>
        </div>
        <div class="entry-item pomodoro-entry" :class="status.key">
          <LucideIcon name="Timer" :size="18" />
          <span>番茄钟</span>
        </div>
      </div>
    </div>

    <!-- 底部版权 -->
    <div class="footer">
      <div class="footer-links">
        <span>设为首页</span>
        <span>关于番茄搜索</span>
        <span>用户协议</span>
        <span>隐私政策</span>
        <span>帮助中心</span>
        <span>意见反馈</span>
      </div>
      <div class="copyright">
        © 2024 Pomodoro Search &nbsp;|&nbsp; 番茄一下，你就知道 &nbsp;|&nbsp; 京ICP证000000号
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import LucideIcon from '@/components/LucideIcon.vue';
import usePomodoroStatus from '@/store/usePomodoroStatus';
import useWorkOrRestStore from '@/store/usePomodoroDisplay';

const { status } = usePomodoroStatus();
const { nextRestTime, nextWorkTime, workTimeGapUnit, restTimeGapUnit } = storeToRefs(useWorkOrRestStore());

// 番茄钟统一状态文案（工作/休息/强制锁屏/空闲/已关闭）
const statusText = computed(() => {
  switch (status.value.key) {
    case 'work': return '专注中';
    case 'rest': return '休息中';
    case 'lock': return '强制锁屏';
    case 'idle': return '空闲中';
    case 'disabled': return '番茄钟已关闭';
    default: return '专注中';
  }
});

const displayTime = ref('00:00:00');
const progress = ref(0);

const searchPlaceholder = computed(() => {
  // 非运行态不展示「剩余」倒计时
  const running = status.value.key === 'work' || status.value.key === 'rest';
  return running ? `搜索一下  ·  ${statusText} 剩余 ${displayTime.value}` : `搜索一下  ·  ${statusText}`;
});

let timer = null;

onMounted(() => {
  updateCountdown();
  timer = setInterval(updateCountdown, 1000);
});

onUnmounted(() => {
  clearInterval(timer);
});

function updateCountdown() {
  // 非运行态（锁屏/空闲/已关闭）不展示倒计时
  if (status.value.key === 'work') {
    displayTime.value = countDown(nextRestTime.value);
    const total = workTimeGapUnit.value * 60 * 1000;
    const remaining = new Date(nextRestTime.value).getTime() - new Date().getTime();
    progress.value = Math.max(0, Math.min(100, (1 - remaining / total) * 100));
  } else if (status.value.key === 'rest') {
    displayTime.value = countDown(nextWorkTime.value);
    const total = restTimeGapUnit.value * 60 * 1000;
    const remaining = new Date(nextWorkTime.value).getTime() - new Date().getTime();
    progress.value = Math.max(0, Math.min(100, (1 - remaining / total) * 100));
  } else {
    displayTime.value = '--:--:--';
    progress.value = 0;
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
.search-engine {
  width: 100%;
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  user-select: none;
  font-family: Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* 顶部导航栏 */
.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 24px;
  font-size: 13px;

  .nav-left,
  .nav-right {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .nav-link {
    color: #222;
    cursor: pointer;
    transition: color 0.15s;

    &:hover {
      color: #4e6ef2;
    }

    &.more {
      color: #626675;
    }

    &.login-btn {
      background: #4e6ef2;
      color: #fff;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 500;

      &:hover {
        background: #4662d9;
        color: #fff;
      }
    }
  }

  .pomodoro-status {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 14px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &.work {
      background: rgba(255, 107, 107, 0.1);
      color: #ff6b6b;
    }

    &.rest {
      background: rgba(16, 185, 129, 0.1);
      color: #10b981;
    }

    // 空闲 / 锁屏 / 已关闭：中性灰
    &.idle,
    &.lock,
    &.disabled {
      background: rgba(108, 117, 125, 0.12);
      color: #6c757d;
    }

    .status-text {
      font-family: 'SF Mono', Consolas, monospace;
      font-feature-settings: 'tnum';
    }

    &:hover {
      transform: translateY(-1px);
    }
  }
}

/* 主内容区 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120px;
}

/* Logo 区域 */
.logo-area {
  margin-bottom: 28px;

  .logo {
    display: flex;
    align-items: baseline;
    justify-content: center;

    .logo-text {
      font-size: 64px;
      font-weight: 700;
      color: #4e6ef2;
      letter-spacing: 2px;
      font-family: Arial, sans-serif;
    }
  }
}

/* 搜索框区域 */
.search-wrap {
  width: 100%;
  max-width: 640px;
  margin-bottom: 32px;
}

.search-box {
  display: flex;
  width: 100%;

  .search-input-wrap {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    border: 2px solid #c4c7ce;
    border-right: none;
    border-radius: 10px 0 0 10px;
    padding: 0 16px;
    transition: border-color 0.2s;

    &:focus-within {
      border-color: #4e6ef2;

      .search-suggestion {
        display: block;
      }
    }

    .search-icon {
      color: #9195a3;
      margin-right: 10px;
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
      border: none;
      outline: none;
      padding: 12px 0;
      font-size: 16px;
      background: transparent;
      color: #222;

      &::placeholder {
        color: #9195a3;
        font-size: 15px;
      }
    }

    .search-suggestion {
      display: none;
      position: absolute;
      top: 100%;
      left: -2px;
      right: -2px;
      background: #fff;
      border: 2px solid #4e6ef2;
      border-top: none;
      border-radius: 0 0 10px 10px;
      padding: 8px 0;
      z-index: 10;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);

      .suggestion-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        font-size: 14px;
        color: #333;
        cursor: pointer;

        &:hover {
          background: #f5f5f6;
        }

        svg {
          color: #9195a3;
        }
      }
    }
  }

  .search-btn {
    padding: 0 32px;
    background: #4e6ef2;
    color: #fff;
    border: none;
    border-radius: 0 10px 10px 0;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: #4662d9;
    }
  }
}

/* 快捷入口 */
.quick-entries {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-top: 48px;

  .entry-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: #626675;
    transition: all 0.2s;

    svg {
      width: 36px;
      height: 36px;
      padding: 10px;
      background: #f5f5f6;
      border-radius: 10px;
      transition: all 0.2s;
    }

    span {
      font-size: 12px;
    }

    &:hover {
      color: #4e6ef2;

      svg {
        background: #eef1fa;
        color: #4e6ef2;
      }
    }

    &.pomodoro-entry {
      &.work svg {
        color: #ff6b6b;
        background: rgba(255, 107, 107, 0.1);
      }

      &.rest svg {
        color: #10b981;
        background: rgba(16, 185, 129, 0.1);
      }

      // 空闲 / 锁屏 / 已关闭：中性灰
      &.idle svg,
      &.lock svg,
      &.disabled svg {
        color: #6c757d;
        background: rgba(108, 117, 125, 0.12);
      }
    }
  }
}

/* 底部版权 */
.footer {
  text-align: center;
  padding: 24px;

  .footer-links {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin-bottom: 12px;

    span {
      font-size: 12px;
      color: #9195a3;
      cursor: pointer;

      &:hover {
        color: #4e6ef2;
      }
    }
  }

  .copyright {
    font-size: 11px;
    color: #bbb;
  }
}
</style>
