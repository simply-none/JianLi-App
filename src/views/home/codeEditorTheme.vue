<template>
  <div class="code-editor-theme">
    <!-- 主布局：活动栏 + 中间区域 -->
    <div class="main-layout">
      <!-- 左侧活动栏 -->
      <div class="activity-bar">
        <div class="activity-icons">
          <div class="activity-icon active" title="Explorer">
            <LucideIcon name="Files" :size="22" />
          </div>
          <div class="activity-icon" title="Search">
            <LucideIcon name="Search" :size="22" />
          </div>
          <div class="activity-icon" title="Extensions">
            <LucideIcon name="Puzzle" :size="22" />
          </div>
          <div class="activity-icon" title="Debug">
            <LucideIcon name="Bug" :size="22" />
          </div>
          <div class="activity-icon" title="Settings">
            <LucideIcon name="Settings" :size="22" />
          </div>
        </div>
      </div>

      <!-- 左侧文件资源管理器 -->
      <div class="sidebar">
        <div class="sidebar-header">
          <span>EXPLORER</span>
        </div>
        <div class="folder-tree">
          <div class="folder open">
            <LucideIcon name="FolderOpen" :size="16" />
            <span>src</span>
          </div>
          <div class="folder-item active">
            <LucideIcon name="FileCode" :size="16" />
            <span>pomodoro.ts</span>
          </div>
          <div class="folder-item">
            <LucideIcon name="FileJson" :size="16" />
            <span>config.json</span>
          </div>
          <div class="folder-item">
            <LucideIcon name="FileText" :size="16" />
            <span>README.md</span>
          </div>
        </div>
      </div>

      <!-- 中间主区域 -->
      <div class="editor-container">
        <!-- 顶部标签栏 -->
        <div class="tab-bar">
          <div class="tabs">
            <div class="tab active">
              <LucideIcon name="FileCode" :size="14" />
              <span>pomodoro.ts</span>
              <span class="tab-close">
                <LucideIcon name="X" :size="12" />
              </span>
            </div>
            <div class="tab">
              <LucideIcon name="FileJson" :size="14" />
              <span>config.json</span>
              <span class="tab-close">
                <LucideIcon name="X" :size="12" />
              </span>
            </div>
          </div>
          <div class="tab-actions">
            <div class="pomodoro-badge" :class="curStatusC.value">
              <LucideIcon name="Timer" :size="12" />
              <span>{{ curStatusC.value === 'work' ? '专注' : '休息' }}</span>
              <span class="badge-time">{{ displayTime }}</span>
            </div>
          </div>
        </div>

        <!-- 编辑器主体 -->
        <div class="editor-main">
          <div class="editor-scroll">
            <div class="editor-content">
              <!-- 行号 -->
              <div class="line-numbers">
                <div class="line-number">1</div>
                <div class="line-number">2</div>
                <div class="line-number">3</div>
                <div class="line-number">4</div>
                <div class="line-number">5</div>
                <div class="line-number">6</div>
                <div class="line-number">7</div>
                <div class="line-number">8</div>
                <div class="line-number">9</div>
                <div class="line-number">10</div>
                <div class="line-number">11</div>
                <div class="line-number">12</div>
                <div class="line-number">13</div>
                <div class="line-number">14</div>
                <div class="line-number">15</div>
                <div class="line-number">16</div>
              </div>
              <!-- 代码内容 -->
              <div class="code-area">
                <div class="code-line">
                  <span class="comment">/**</span>
                </div>
                <div class="code-line">
                  <span class="comment"> * Pomodoro Timer Configuration</span>
                </div>
                <div class="code-line">
                  <span class="comment"> * 番茄钟计时器配置</span>
                </div>
                <div class="code-line">
                  <span class="comment"> */</span>
                </div>
                <div class="code-line empty"></div>
                <div class="code-line">
                  <span class="keyword">export interface</span>
                  <span class="class-name"> PomodoroConfig</span>
                  <span class="punctuation"> {</span>
                </div>
                <div class="code-line">
                  <span class="property">  status</span>
                  <span class="punctuation">:</span>
                  <span class="type">'work'</span>
                  <span class="operator"> |</span>
                  <span class="type">'rest'</span>
                  <span class="punctuation">;</span>
                </div>
                <div class="code-line">
                  <span class="property">  remainingTime</span>
                  <span class="punctuation">:</span>
                  <span class="type"> string</span>
                  <span class="operator">;</span>
                </div>
                <div class="code-line">
                  <span class="property">  progress</span>
                  <span class="punctuation">:</span>
                  <span class="type"> number</span>
                  <span class="punctuation">;</span>
                  <span class="comment"> // {{ Math.round(progress) }}%</span>
                </div>
                <div class="code-line empty"></div>
                <div class="code-line">
                  <span class="comment">// Current Status: {{ curStatusC.value.value }}</span>
                </div>
                <div class="code-line">
                  <span class="keyword">const</span>
                  <span class="variable"> timer</span>
                  <span class="operator"> = </span>
                  <span class="string">'{{ displayTime }}'</span>
                  <span class="punctuation">;</span>
                </div>
                <div class="code-line">
                  <span class="keyword">const</span>
                  <span class="variable"> workDuration</span>
                  <span class="operator"> = </span>
                  <span class="number">{{ workTimeGapUnit }}</span>
                  <span class="punctuation">;</span>
                  <span class="comment"> // minutes</span>
                </div>
                <div class="code-line">
                  <span class="keyword">const</span>
                  <span class="variable"> restDuration</span>
                  <span class="operator"> = </span>
                  <span class="number">{{ restTimeGapUnit }}</span>
                  <span class="punctuation">;</span>
                  <span class="comment"> // minutes</span>
                </div>
                <div class="code-line">
                  <span class="punctuation">}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部面板 -->
        <div class="panel">
          <div class="panel-tabs">
            <div class="panel-tab active">
              <LucideIcon name="Terminal" :size="14" />
              <span>TERMINAL</span>
            </div>
            <div class="panel-tab">
              <LucideIcon name="AlertCircle" :size="14" />
              <span>PROBLEMS</span>
            </div>
            <div class="panel-tab">
              <LucideIcon name="Output" :size="14" />
              <span>OUTPUT</span>
            </div>
          </div>
          <div class="panel-content">
            <div class="terminal-output">
              <div class="terminal-line">
                <span class="prompt">~/pomodoro</span>
                <span class="command"> npm run dev</span>
              </div>
              <div class="terminal-line">
                <span class="info">> pomodoro@1.0.0 dev</span>
              </div>
              <div class="terminal-line success">
                <span>VITE</span>
                <span class="text"> v5.0.0  ready in 234 ms</span>
              </div>
              <div class="terminal-line">
                <span class="info">➜  Local:</span>
                <span class="text"> http://localhost:5173/</span>
              </div>
              <div class="terminal-line empty"></div>
              <div class="terminal-line highlight">
                <LucideIcon name="Timer" :size="12" />
                <span class="text">🍅 {{ curStatusC.value === 'work' ? '专注模式' : '休息模式' }}</span>
                <span class="text"> | 剩余: {{ displayTime }}</span>
                <span class="text"> | 进度: {{ Math.round(progress) }}%</span>
              </div>
              <div class="terminal-line empty"></div>
              <div class="terminal-line">
                <span class="prompt">~/pomodoro</span>
                <span class="command cursor"> █</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="status-bar">
      <div class="status-left">
        <span class="status-item">
          <LucideIcon name="GitBranch" :size="12" />
          main
        </span>
        <span class="status-item" :class="curStatusC.value">
          <LucideIcon name="Circle" :size="8" fill="currentColor" />
          {{ curStatusC.value === 'work' ? 'Working' : 'Resting' }}
        </span>
        <span class="status-item">
          <LucideIcon name="Check" :size="12" />
          0
        </span>
      </div>
      <div class="status-right">
        <span class="status-item">Ln 1, Col 1</span>
        <span class="status-item">Spaces: 2</span>
        <span class="status-item">UTF-8</span>
        <span class="status-item">TypeScript Vue</span>
        <span class="status-item">{{ Math.round(progress) }}%</span>
        <span class="status-item">{{ currentTime }}</span>
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
$bg-dark: #1e1e1e;
$bg-sidebar: #252526;
$bg-tab: #2d2d2d;
$bg-activity: #333333;
$text-primary: #cccccc;
$text-secondary: #858585;
$accent: #007acc;
$success: #89d185;
$warning: #dcdcaa;

.code-editor-theme {
  width: 100%;
  height: 100%;
  background: $bg-dark;
  display: flex;
  flex-direction: column;
  user-select: none;
  font-family: 'SF Mono', 'Fira Code', Consolas, 'Courier New', monospace;
  color: $text-primary;
}

/* 主布局：活动栏 + 中间区域 */
.main-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 活动栏 */
.activity-bar {
  width: 48px;
  background: $bg-activity;
  display: flex;
  flex-direction: column;
  padding-top: 8px;

  .activity-icons {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .activity-icon {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: $text-secondary;
      cursor: pointer;
      position: relative;
      transition: color 0.15s;

      &:hover {
        color: $text-primary;
      }

      &.active {
        color: $text-primary;

        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 2px;
          background: $text-primary;
        }
      }
    }
  }
}

/* 侧边栏（文件资源管理器） */
.sidebar {
  width: 220px;
  background: $bg-sidebar;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.05);

  .sidebar-header {
    display: flex;
    align-items: center;
    padding: 12px 16px 8px;
    font-size: 11px;
    font-weight: 600;
    color: $text-secondary;
    letter-spacing: 0.5px;
  }

  .folder-tree {
    .folder {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      font-size: 13px;
      color: $text-primary;
      cursor: pointer;

      &.open {
        background: rgba(255, 255, 255, 0.05);
      }

      &:hover {
        background: rgba(255, 255, 255, 0.08);
      }
    }

    .folder-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px 6px 32px;
      font-size: 13px;
      color: $text-secondary;
      cursor: pointer;

      &.active {
        background: rgba(0, 122, 204, 0.4);
        color: $text-primary;
      }

      &:hover:not(.active) {
        background: rgba(255, 255, 255, 0.05);
        color: $text-primary;
      }
    }
  }
}

/* 编辑器容器 */
.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 标签栏 */
.tab-bar {
  height: 35px;
  background: $bg-tab;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  .tabs {
    display: flex;
    height: 100%;

    .tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 16px;
      font-size: 13px;
      color: $text-secondary;
      cursor: pointer;
      border-right: 1px solid rgba(255, 255, 255, 0.05);
      position: relative;

      &.active {
        background: $bg-dark;
        color: $text-primary;

        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: $accent;
        }
      }

      &:hover:not(.active) {
        background: rgba(255, 255, 255, 0.05);
        color: $text-primary;
      }

      .tab-close {
        opacity: 0;
        margin-left: 4px;
        padding: 2px;
        border-radius: 4px;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      }

      &:hover .tab-close {
        opacity: 1;
      }
    }
  }

  .tab-actions {
    display: flex;
    align-items: center;
    padding-right: 12px;

    .pomodoro-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;

      &.work {
        background: rgba(255, 107, 107, 0.2);
        color: #ff6b6b;
      }

      &.rest {
        background: rgba(81, 207, 102, 0.2);
        color: #51cf66;
      }

      .badge-time {
        font-feature-settings: 'tnum';
        font-family: 'SF Mono', monospace;
      }
    }
  }
}

/* 编辑器主体 */
.editor-main {
  flex: 1;
  overflow: hidden;
  background: $bg-dark;

  .editor-scroll {
    height: 100%;
    overflow: auto;
  }

  .editor-content {
    display: flex;
    min-height: 100%;
    line-height: 1.6;

    .line-numbers {
      padding: 12px 16px;
      text-align: right;
      color: $text-secondary;
      font-size: 13px;
      user-select: none;
      border-right: 1px solid rgba(255, 255, 255, 0.05);
      background: rgba(0, 0, 0, 0.2);

      .line-number {
        min-width: 30px;
      }
    }

    .code-area {
      flex: 1;
      padding: 12px 20px;

      .code-line {
        white-space: pre;
        font-size: 13px;

        &.empty {
          height: 20.8px;
        }

        .comment {
          color: #6a9955;
        }

        .keyword {
          color: #569cd6;
        }

        .class-name {
          color: #4ec9b0;
        }

        .property {
          color: #9cdcfe;
        }

        .type {
          color: #4ec9b0;
        }

        .variable {
          color: #9cdcfe;
        }

        .string {
          color: #ce9178;
        }

        .number {
          color: #b5cea8;
        }

        .punctuation {
          color: #d4d4d4;
        }

        .operator {
          color: #d4d4d4;
        }
      }
    }
  }
}

/* 底部面板 */
.panel {
  height: 180px;
  background: $bg-sidebar;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;

  .panel-tabs {
    display: flex;
    gap: 2px;
    padding: 0 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);

    .panel-tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      font-size: 12px;
      color: $text-secondary;
      cursor: pointer;

      &.active {
        color: $text-primary;
        border-bottom: 1px solid $accent;
        margin-bottom: -1px;
      }

      &:hover:not(.active) {
        color: $text-primary;
      }
    }
  }

  .panel-content {
    flex: 1;
    overflow: auto;
    padding: 8px 12px;

    .terminal-output {
      font-size: 13px;

      .terminal-line {
        display: flex;
        align-items: center;
        gap: 4px;
        line-height: 1.6;

        &.empty {
          height: 16px;
        }

        .prompt {
          color: $success;
        }

        .command {
          color: #9cdcfe;
        }

        .info {
          color: $text-secondary;
        }

        .text {
          color: $text-primary;
        }

        .success {
          color: $success;
        }

        &.highlight {
          padding: 4px 8px;
          background: rgba(255, 107, 107, 0.1);
          border-radius: 4px;
          color: #ff6b6b;
          gap: 8px;
        }

        .cursor {
          animation: blink 1s infinite;
        }
      }
    }
  }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* 状态栏 */
.status-bar {
  height: 24px;
  background: $accent;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8px;
  font-size: 12px;
  color: #fff;

  .status-left,
  .status-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 4px;
    opacity: 0.9;

    &:hover {
      opacity: 1;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.1);
    }

    &.work {
      background: rgba(255, 107, 107, 0.8);
    }

    &.rest {
      background: rgba(81, 207, 102, 0.8);
    }
  }
}
</style>
