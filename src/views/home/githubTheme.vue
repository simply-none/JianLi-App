<template>
  <div class="github-theme">
    <header class="github-header">
      <div class="header-content">
        <div class="header-left">
          <svg class="github-logo" height="24" viewBox="0 0 16 16" width="24" fill="#fff">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
          </svg>
          <nav class="header-nav">
            <a href="#" class="nav-link" @click.prevent>Pull requests</a>
            <a href="#" class="nav-link" @click.prevent>Issues</a>
            <a href="#" class="nav-link" @click.prevent>Marketplace</a>
            <a href="#" class="nav-link" @click.prevent>Explore</a>
          </nav>
        </div>
        <div class="header-center">
          <div class="search-box">
            <LucideIcon name="Search" :size="14" />
            <input type="text" placeholder="Search or jump to..." class="search-input" />
            <span class="search-kbd">/</span>
          </div>
        </div>
        <div class="header-right">
          <LucideIcon name="Plus" :size="20" class="header-icon" />
          <LucideIcon name="Bell" :size="20" class="header-icon" />
          <div class="user-avatar">
            <span class="avatar-letter">U</span>
          </div>
        </div>
      </div>
    </header>

    <main class="github-main">
      <div class="main-container">
        <aside class="left-sidebar">
          <div class="sidebar-section">
            <div class="section-header">
              <span class="section-title">Top repositories</span>
              <button class="btn-new">New</button>
            </div>
            <div class="repo-list">
              <div class="repo-item">
                <LucideIcon name="BookOpenText" :size="16" class="repo-icon" />
                <span class="repo-name">pomodoro-app</span>
              </div>
              <div class="repo-item">
                <LucideIcon name="BookOpenText" :size="16" class="repo-icon" />
                <span class="repo-name">focus-timer</span>
              </div>
              <div class="repo-item">
                <LucideIcon name="BookOpenText" :size="16" class="repo-icon" />
                <span class="repo-name">productivity-tools</span>
              </div>
              <div class="repo-item">
                <LucideIcon name="BookOpenText" :size="16" class="repo-icon" />
                <span class="repo-name">task-manager</span>
              </div>
            </div>
            <a href="#" class="show-more" @click.prevent>Show more</a>
          </div>

          <div class="sidebar-section">
            <div class="section-header">
              <span class="section-title">Recent activity</span>
            </div>
            <div class="activity-feed-small">
              <div class="activity-small-item">
                <LucideIcon name="GitBranch" :size="14" />
                <span>pushed to main</span>
              </div>
              <div class="activity-small-item">
                <LucideIcon name="MessageSquare" :size="14" />
                <span>opened PR #42</span>
              </div>
              <div class="activity-small-item">
                <LucideIcon name="Star" :size="14" />
                <span>starred vuejs/vue</span>
              </div>
            </div>
          </div>
        </aside>

        <section class="main-feed">
          <div class="feed-tabs">
            <button class="feed-tab active">For you</button>
            <button class="feed-tab">Following</button>
          </div>

          <div class="feed-list">
            <div class="feed-item">
              <div class="feed-item-header">
                <div class="feed-user">
                  <div class="user-avatar small">
                    <span class="avatar-letter">D</span>
                  </div>
                  <div class="user-info">
                    <span class="user-name">dev-team</span>
                    <span class="feed-action">pushed to</span>
                    <span class="repo-link">pomodoro-app/main</span>
                  </div>
                </div>
                <span class="feed-time">2 hours ago</span>
              </div>
              <div class="feed-item-body">
                <div class="commit-box">
                  <div class="commit-hash">a1b2c3d</div>
                  <div class="commit-message">feat: add focus timer functionality</div>
                </div>
                <div class="commit-stats">
                  <span class="stat-add">+248</span>
                  <span class="stat-del">-156</span>
                  <span class="stat-files">3 files changed</span>
                </div>
              </div>
            </div>

            <div class="feed-item">
              <div class="feed-item-header">
                <div class="feed-user">
                  <div class="user-avatar small">
                    <span class="avatar-letter">O</span>
                  </div>
                  <div class="user-info">
                    <span class="user-name">open-source</span>
                    <span class="feed-action">starred</span>
                    <span class="repo-link">pomodoro-app</span>
                  </div>
                </div>
                <span class="feed-time">5 hours ago</span>
              </div>
              <div class="feed-item-body">
                <div class="starred-repo">
                  <div class="starred-repo-header">
                    <LucideIcon name="BookOpenText" :size="16" />
                    <span class="starred-repo-name">user/pomodoro-app</span>
                  </div>
                  <p class="starred-repo-desc">番茄工作法应用 - 提升你的专注力和效率</p>
                  <div class="starred-repo-stats">
                    <span class="stat-lang">
                      <span class="lang-dot" style="background: #e34c26;"></span>
                      JavaScript
                    </span>
                    <span class="stat-item">
                      <LucideIcon name="Star" :size="12" />
                      1.2k
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="feed-item">
              <div class="feed-item-header">
                <div class="feed-user">
                  <div class="user-avatar small">
                    <span class="avatar-letter">P</span>
                  </div>
                  <div class="user-info">
                    <span class="user-name">product-bot</span>
                    <span class="feed-action">opened issue in</span>
                    <span class="repo-link">pomodoro-app</span>
                  </div>
                </div>
                <span class="feed-time">1 day ago</span>
              </div>
              <div class="feed-item-body">
                <div class="issue-box">
                  <div class="issue-title">
                    <LucideIcon name="CircleDot" :size="16" class="issue-icon" />
                    <span>Add dark mode support #42</span>
                  </div>
                  <p class="issue-body">建议添加深色模式支持，方便夜间使用...</p>
                  <div class="issue-labels">
                    <span class="label" style="background: #0e8a16; color: #fff;">enhancement</span>
                    <span class="label" style="background: #1d76db; color: #fff;">good first issue</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="feed-item">
              <div class="feed-item-header">
                <div class="feed-user">
                  <div class="user-avatar small">
                    <span class="avatar-letter">R</span>
                  </div>
                  <div class="user-info">
                    <span class="user-name">release-bot</span>
                    <span class="feed-action">released</span>
                    <span class="repo-link">v1.2.0</span>
                  </div>
                </div>
                <span class="feed-time">2 days ago</span>
              </div>
              <div class="feed-item-body">
                <div class="release-box">
                  <div class="release-header">
                    <LucideIcon name="Tag" :size="16" />
                    <span class="release-tag">v1.2.0</span>
                    <span class="release-latest">Latest</span>
                  </div>
                  <div class="release-notes">
                    <p>• 新增番茄钟倒计时功能</p>
                    <p>• 优化界面布局</p>
                    <p>• 修复若干Bug</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside class="right-sidebar">
          <div class="pomodoro-card" :class="curStatusC.value">
            <div class="pomodoro-header">
              <LucideIcon name="Timer" :size="16" />
              <span class="pomodoro-title">Pomodoro</span>
              <span class="pomodoro-badge">{{ curStatusC.value === 'work' ? 'Focus' : 'Break' }}</span>
            </div>
            <div class="pomodoro-time">{{ displayTime }}</div>
            <div class="pomodoro-progress">
              <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            </div>
            <div class="pomodoro-info">
              <span>{{ completedCycles }} cycles today</span>
              <span>{{ focusMinutes }} min focused</span>
            </div>
          </div>

          <div class="sidebar-section">
            <div class="section-header">
              <span class="section-title">Explore repositories</span>
            </div>
            <div class="explore-list">
              <div class="explore-item">
                <div class="explore-repo-header">
                  <LucideIcon name="BookOpenText" :size="14" />
                  <span class="explore-repo-name">vuejs/vue</span>
                </div>
                <p class="explore-repo-desc">Vue.js is a progressive framework</p>
                <div class="explore-repo-stats">
                  <span class="stat-lang">
                    <span class="lang-dot" style="background: #41b883;"></span>
                    Vue
                  </span>
                  <span class="stat-item">
                    <LucideIcon name="Star" :size="12" />
                    205k
                  </span>
                </div>
              </div>
              <div class="explore-item">
                <div class="explore-repo-header">
                  <LucideIcon name="BookOpenText" :size="14" />
                  <span class="explore-repo-name">electron/electron</span>
                </div>
                <p class="explore-repo-desc">Build cross-platform desktop apps</p>
                <div class="explore-repo-stats">
                  <span class="stat-lang">
                    <span class="lang-dot" style="background: #3178c6;"></span>
                    TypeScript
                  </span>
                  <span class="stat-item">
                    <LucideIcon name="Star" :size="12" />
                    112k
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="sidebar-section">
            <div class="section-header">
              <span class="section-title">Trending</span>
            </div>
            <div class="trending-list">
              <div class="trending-item">
                <span class="trending-num">1</span>
                <div class="trending-info">
                  <span class="trending-repo">pomodoro-app</span>
                  <span class="trending-stars">+120 stars today</span>
                </div>
              </div>
              <div class="trending-item">
                <span class="trending-num">2</span>
                <div class="trending-info">
                  <span class="trending-repo">focus-timer</span>
                  <span class="trending-stars">+89 stars today</span>
                </div>
              </div>
              <div class="trending-item">
                <span class="trending-num">3</span>
                <div class="trending-info">
                  <span class="trending-repo">productivity</span>
                  <span class="trending-stars">+67 stars today</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>

    <footer class="github-footer">
      <div class="footer-content">
        <div class="footer-links">
          <a href="#" class="footer-link" @click.prevent>Terms</a>
          <a href="#" class="footer-link" @click.prevent>Privacy</a>
          <a href="#" class="footer-link" @click.prevent>Security</a>
          <a href="#" class="footer-link" @click.prevent>Status</a>
          <a href="#" class="footer-link" @click.prevent>Docs</a>
          <a href="#" class="footer-link" @click.prevent>Contact</a>
        </div>
        <div class="footer-right">
          <svg class="footer-logo" height="20" viewBox="0 0 16 16" width="20" fill="#8b949e">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
          </svg>
          <span class="footer-copyright">© 2024 GitHub, Inc.</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import LucideIcon from '@/components/LucideIcon.vue';
import useGlobalSetting from '@/store/useGlobalSetting';
import useWorkOrRestStore from '@/store/useWorkOrReset';

const { curStatusC } = storeToRefs(useGlobalSetting());
const { nextRestTime, nextWorkTime, workTimeGap, restTimeGap, workTimeGapUnit, restTimeGapUnit } = storeToRefs(useWorkOrRestStore());

const displayTime = ref('00:00');
const progress = ref(0);

const completedCycles = ref(Math.floor(Math.random() * 5) + 3);
const focusMinutes = ref(Math.floor(Math.random() * 90) + 30);

let timer = null;

onMounted(() => {
  updateCountdown();
  timer = setInterval(updateCountdown, 1000);
});

onUnmounted(() => {
  clearInterval(timer);
});

function updateCountdown() {
  let targetTime;
  let totalDuration;
  
  if (curStatusC.value.value === 'work') {
    targetTime = nextRestTime.value;
    totalDuration = workTimeGap.value * workTimeGapUnit.value;
  } else {
    targetTime = nextWorkTime.value;
    totalDuration = restTimeGap.value * restTimeGapUnit.value;
  }
  
  displayTime.value = countDown(targetTime);
  
  const now = new Date().getTime();
  const target = new Date(targetTime).getTime();
  const diff = target - now;
  
  if (diff > 0 && totalDuration > 0) {
    progress.value = Math.max(0, Math.min(100, ((totalDuration - diff) / totalDuration) * 100));
  } else {
    progress.value = 100;
  }
}

function countDown(time) {
  const now = new Date().getTime();
  const diff = new Date(time).getTime() - now;
  if (diff < 0) return '00:00';
  const m = Math.floor((diff / 1000 / 60) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
}
</script>

<style lang="scss" scoped>
.github-theme {
  width: 100%;
  height: 100%;
  background: #0d1117;
  display: flex;
  flex-direction: column;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
}

.github-header {
  background: #161b22;
  border-bottom: 1px solid #30363d;
  padding: 8px 16px;
  position: sticky;
  top: 0;
  z-index: 100;

  .header-content {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .github-logo {
      cursor: pointer;
      transition: opacity 0.2s;

      &:hover {
        opacity: 0.8;
      }
    }

    .header-nav {
      display: flex;
      gap: 16px;

      .nav-link {
        color: #f0f6fc;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        transition: color 0.2s;

        &:hover {
          color: rgba(255, 255, 255, 0.7);
        }
      }
    }
  }

  .header-center {
    flex: 1;
    max-width: 320px;

    .search-box {
      display: flex;
      align-items: center;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 5px 12px;
      transition: border-color 0.2s;

      &:focus-within {
        border-color: #58a6ff;
        box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
      }

      .search-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #c9d1d9;
        font-size: 14px;
        margin-left: 8px;

        &::placeholder {
          color: #8b949e;
        }
      }

      .search-kbd {
        color: #8b949e;
        font-size: 12px;
        padding: 2px 6px;
        border: 1px solid #30363d;
        border-radius: 4px;
        font-family: monospace;
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;

    .header-icon {
      color: #f0f6fc;
      cursor: pointer;
      transition: color 0.2s;

      &:hover {
        color: rgba(255, 255, 255, 0.7);
      }
    }

    .user-avatar {
      width: 20px;
      height: 20px;
      background: linear-gradient(135deg, #58a6ff, #1f6feb);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      cursor: pointer;
      font-size: 10px;
      font-weight: 600;
    }
  }
}

.github-main {
  flex: 1;
  overflow-y: auto;

  .main-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px 16px;
    display: grid;
    grid-template-columns: 220px 1fr 320px;
    gap: 24px;
  }
}

.left-sidebar {
  .sidebar-section {
    margin-bottom: 24px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #f0f6fc;
    }

    .btn-new {
      background: #238636;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;

      &:hover {
        background: #2ea043;
      }
    }
  }

  .repo-list {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .repo-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      cursor: pointer;

      &:hover .repo-name {
        color: #58a6ff;
      }

      .repo-icon {
        color: #8b949e;
        flex-shrink: 0;
      }

      .repo-name {
        font-size: 13px;
        color: #c9d1d9;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color 0.2s;
      }
    }
  }

  .show-more {
    font-size: 12px;
    color: #8b949e;
    text-decoration: none;
    display: inline-block;
    margin-top: 8px;

    &:hover {
      color: #58a6ff;
    }
  }

  .activity-feed-small {
    .activity-small-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      font-size: 12px;
      color: #8b949e;

      svg {
        color: #58a6ff;
      }
    }
  }
}

.main-feed {
  .feed-tabs {
    display: flex;
    gap: 24px;
    border-bottom: 1px solid #30363d;
    margin-bottom: 24px;

    .feed-tab {
      background: none;
      border: none;
      padding: 12px 0;
      font-size: 14px;
      font-weight: 500;
      color: #8b949e;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;

      &.active {
        color: #f0f6fc;
        border-bottom-color: #f78166;
        font-weight: 600;
      }

      &:hover:not(.active) {
        color: #c9d1d9;
      }
    }
  }

  .feed-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .feed-item {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    overflow: hidden;

    .feed-item-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 16px;
      padding-bottom: 12px;

      .feed-user {
        display: flex;
        align-items: flex-start;
        gap: 10px;

        .user-avatar.small {
          width: 32px;
          height: 32px;
          flex-shrink: 0;

          .avatar-letter {
            font-size: 14px;
          }
        }

        .user-info {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          font-size: 14px;

          .user-name {
            color: #f0f6fc;
            font-weight: 600;
          }

          .feed-action {
            color: #8b949e;
          }

          .repo-link {
            color: #58a6ff;
            font-weight: 500;
            cursor: pointer;

            &:hover {
              text-decoration: underline;
            }
          }
        }
      }

      .feed-time {
        font-size: 12px;
        color: #8b949e;
        flex-shrink: 0;
      }
    }

    .feed-item-body {
      padding: 0 16px 16px;
      padding-left: 58px;
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #58a6ff, #1f6feb);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
    }
  }

  .commit-box {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 12px;

    .commit-hash {
      font-family: monospace;
      font-size: 12px;
      color: #58a6ff;
      margin-bottom: 6px;
    }

    .commit-message {
      font-size: 14px;
      color: #f0f6fc;
      margin: 0;
    }
  }

  .commit-stats {
    margin-top: 10px;
    display: flex;
    gap: 12px;
    font-size: 12px;

    .stat-add {
      color: #3fb950;
      font-weight: 500;
    }

    .stat-del {
      color: #f85149;
      font-weight: 500;
    }

    .stat-files {
      color: #8b949e;
    }
  }

  .starred-repo {
    .starred-repo-header {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #58a6ff;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 600;
    }

    .starred-repo-desc {
      font-size: 13px;
      color: #8b949e;
      margin: 0 0 10px;
      line-height: 1.4;
    }

    .starred-repo-stats {
      display: flex;
      gap: 16px;
      font-size: 12px;

      .stat-lang,
      .stat-item {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #8b949e;

        .lang-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
      }
    }
  }

  .issue-box {
    .issue-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;

      .issue-icon {
        color: #3fb950;
      }

      span {
        font-size: 14px;
        color: #f0f6fc;
        font-weight: 500;
      }
    }

    .issue-body {
      font-size: 13px;
      color: #8b949e;
      margin: 0 0 10px;
    }

    .issue-labels {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;

      .label {
        padding: 2px 8px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 500;
      }
    }
  }

  .release-box {
    .release-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      color: #58a6ff;

      .release-tag {
        font-size: 14px;
        font-weight: 600;
      }

      .release-latest {
        background: #238636;
        color: #fff;
        padding: 2px 8px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 500;
      }
    }

    .release-notes {
      p {
        font-size: 13px;
        color: #c9d1d9;
        margin: 4px 0;
      }
    }
  }
}

.right-sidebar {
  .pomodoro-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 24px;

    .pomodoro-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      color: #c9d1d9;

      .pomodoro-title {
        font-size: 14px;
        font-weight: 600;
        flex: 1;
      }

      .pomodoro-badge {
        padding: 2px 8px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 500;
      }
    }

    .pomodoro-time {
      font-size: 36px;
      font-weight: 200;
      font-feature-settings: 'tnum';
      margin-bottom: 12px;
      text-align: center;
      letter-spacing: 1px;
    }

    .pomodoro-progress {
      height: 4px;
      background: #30363d;
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 12px;

      .progress-fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.3s ease;
      }
    }

    .pomodoro-info {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #8b949e;
    }

    &.work {
      .pomodoro-header {
        color: #f85149;
      }
      .pomodoro-badge {
        background: rgba(248, 81, 73, 0.15);
        color: #f85149;
      }
      .pomodoro-time {
        color: #f85149;
      }
      .progress-fill {
        background: #f85149;
      }
    }

    &.rest {
      .pomodoro-header {
        color: #3fb950;
      }
      .pomodoro-badge {
        background: rgba(63, 185, 80, 0.15);
        color: #3fb950;
      }
      .pomodoro-time {
        color: #3fb950;
      }
      .progress-fill {
        background: #3fb950;
      }
    }
  }

  .sidebar-section {
    margin-bottom: 24px;
  }

  .section-header {
    margin-bottom: 12px;

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #f0f6fc;
    }
  }

  .explore-list {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .explore-item {
      .explore-repo-header {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #58a6ff;
        margin-bottom: 6px;
        font-size: 13px;
        font-weight: 600;
      }

      .explore-repo-desc {
        font-size: 12px;
        color: #8b949e;
        margin: 0 0 8px;
        line-height: 1.4;
      }

      .explore-repo-stats {
        display: flex;
        gap: 12px;
        font-size: 12px;

        .stat-lang,
        .stat-item {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #8b949e;

          .lang-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
          }
        }
      }
    }
  }

  .trending-list {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .trending-item {
      display: flex;
      align-items: center;
      gap: 12px;

      .trending-num {
        width: 20px;
        font-size: 14px;
        font-weight: 600;
        color: #8b949e;
        text-align: center;
      }

      .trending-info {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .trending-repo {
          font-size: 13px;
          color: #c9d1d9;
          font-weight: 500;
        }

        .trending-stars {
          font-size: 12px;
          color: #8b949e;
        }
      }
    }
  }
}

.github-footer {
  background: #0d1117;
  border-top: 1px solid #30363d;
  padding: 16px;

  .footer-content {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-links {
    display: flex;
    gap: 16px;

    .footer-link {
      color: #58a6ff;
      font-size: 12px;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .footer-right {
    display: flex;
    align-items: center;
    gap: 8px;

    .footer-logo {
      flex-shrink: 0;
    }

    .footer-copyright {
      color: #8b949e;
      font-size: 12px;
    }
  }
}

@media (max-width: 1200px) {
  .github-main {
    .main-container {
      grid-template-columns: 1fr 300px;

      .left-sidebar {
        display: none;
      }
    }
  }
}

@media (max-width: 800px) {
  .github-main {
    .main-container {
      grid-template-columns: 1fr;

      .right-sidebar {
        order: -1;
      }
    }
  }
}
</style>