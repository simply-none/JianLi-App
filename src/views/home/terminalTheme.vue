<template>
  <div class="terminal-theme">
    <div class="terminal-header">
      <div class="header-left">
        <div class="window-controls">
          <button class="control-btn close" title="关闭" @click.stop>
            <LucideIcon name="X" :size="12" />
          </button>
          <button class="control-btn minimize" title="最小化" @click.stop>
            <LucideIcon name="Minus" :size="12" />
          </button>
          <button class="control-btn maximize" title="最大化" @click.stop>
            <LucideIcon name="Square" :size="12" />
          </button>
        </div>
        <div class="terminal-tabs">
          <div class="tab active">
            <LucideIcon name="Terminal" :size="12" />
            <span>pomodoro</span>
            <button class="tab-close" @click.stop title="关闭标签">
              <LucideIcon name="X" :size="10" />
            </button>
          </div>
          <div class="tab">
            <LucideIcon name="Folder" :size="12" />
            <span>projects</span>
            <button class="tab-close" @click.stop title="关闭标签">
              <LucideIcon name="X" :size="10" />
            </button>
          </div>
          <button class="tab-add" title="新建标签" @click.stop>
            <LucideIcon name="Plus" :size="12" />
          </button>
        </div>
      </div>
      <div class="header-right">
        <button class="header-btn" title="搜索">
          <LucideIcon name="Search" :size="14" />
        </button>
        <button class="header-btn" title="设置">
          <LucideIcon name="Settings" :size="14" />
        </button>
        <span class="shell-info">zsh</span>
        <span class="divider">|</span>
        <span class="user-info">user@pomodoro</span>
      </div>
    </div>
    <div class="terminal-container" ref="terminalRef">
      <div class="terminal-output" ref="outputRef">
        <div class="boot-message">
          <div class="boot-line">Welcome to Pomodoro Terminal v1.0.0</div>
          <div class="boot-line">System initialized successfully...</div>
          <div class="boot-line">Loading environment variables...</div>
          <div class="boot-line">Starting pomodoro service...</div>
          <div class="boot-line success">[OK] All services running</div>
        </div>

        <div v-for="(item, index) in commandHistory" :key="index" class="command-item">
          <div class="command-input">
            <span class="prompt">{{ item.prompt }}</span>
            <span class="command">{{ item.command }}</span>
          </div>
          <div v-if="item.output" class="command-output">
            <div v-for="(line, lineIndex) in item.output" :key="lineIndex" class="output-line">
              <span v-if="line.type === 'success'" class="text-success">{{ line.text }}</span>
              <span v-else-if="line.type === 'error'" class="text-error">{{ line.text }}</span>
              <span v-else-if="line.type === 'warning'" class="text-warning">{{ line.text }}</span>
              <span v-else-if="line.type === 'info'" class="text-info">{{ line.text }}</span>
              <span v-else-if="line.type === 'highlight'" class="text-highlight">{{ line.text }}</span>
              <span v-else>{{ line.text }}</span>
            </div>
          </div>
        </div>

        <div class="pomodoro-section">
          <div class="command-input">
            <span class="prompt">➜</span>
            <span class="command">cat /proc/pomodoro/status</span>
          </div>
          <div class="command-output">
            <div class="output-line">
              <span class="text-info">------------------- POMODORO STATUS -------------------</span>
            </div>
            <div class="output-line">
              <span class="text-highlight">STATUS:</span>
              <span :class="curStatusC.value === 'work' ? 'text-error' : 'text-success'">{{ curStatusC.value === 'work' ? 'WORKING' : 'RESTING' }}</span>
            </div>
            <div class="output-line">
              <span class="text-highlight">REMAINING:</span>
              <span class="text-success">{{ displayTime }}</span>
            </div>
            <div class="output-line">
              <span class="text-highlight">PROGRESS:</span>
              <span>{{ progressBar }}</span>
              <span class="text-info">({{ Math.round(progress) }}%)</span>
            </div>
            <div class="output-line">
              <span class="text-highlight">CURRENT_TIME:</span>
              <span>{{ currentTime }}</span>
            </div>
            <div class="output-line">
              <span class="text-info">-----------------------------------------------------</span>
            </div>
          </div>
        </div>
      </div>

      <div class="terminal-input-line">
        <span class="prompt">➜</span>
        <span class="path">~</span>
        <input type="text" class="input-field" ref="inputRef" v-model="currentInput" @keydown.enter="executeCommand" />
        <span class="cursor">█</span>
      </div>
    </div>
  </div>
</template>

<script setup>import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import LucideIcon from '@/components/LucideIcon.vue';
import useGlobalSetting from '@/store/useGlobalSetting';
import useWorkOrRestStore from '@/store/useWorkOrReset';
const terminalRef = ref(null);
const outputRef = ref(null);
const inputRef = ref(null);
const { curStatusC } = storeToRefs(useGlobalSetting());
const { nextRestTime, nextWorkTime, workTimeGap, restTimeGap, workTimeGapUnit, restTimeGapUnit } = storeToRefs(useWorkOrRestStore());
const currentTime = ref('');
const displayTime = ref('00:00:00');
const progress = ref(0);
const currentInput = ref('');
const commandHistory = ref([]);
const commands = [
 {
 command: 'ls -la ~/projects',
 output: [
 { text: 'total 24', type: 'info' },
 { text: 'drwxr-xr-x  4 user  staff   128 Jun 28 10:30 .', type: '' },
 { text: 'drwxr-xr-x  3 user  staff    96 Jun 28 09:00 ..', type: '' },
 { text: 'drwxr-xr-x  8 user  staff   256 Jun 28 11:45 pomodoro-app', type: 'highlight' },
 { text: 'drwxr-xr-x  6 user  staff   192 Jun 28 10:00 focus-timer', type: 'highlight' },
 { text: '-rw-r--r--  1 user  staff  1024 Jun 28 08:00 README.md', type: '' },
 ],
 },
 {
 command: 'git status',
 output: [
 { text: 'On branch main', type: 'info' },
 { text: 'Your branch is up to date with \'origin/main\'.', type: '' },
 { text: '', type: '' },
 { text: 'Changes not staged for commit:', type: 'warning' },
 { text: '  (use "git add <file>..." to update what will be committed)', type: '' },
 { text: '        modified:   src/views/home/terminalTheme.vue', type: '' },
 { text: '', type: '' },
 { text: 'Untracked files:', type: 'error' },
 { text: '  (use "git add <file>..." to include in what will be committed)', type: '' },
 { text: '        .trae/documents/terminal_theme_refactor_plan.md', type: '' },
 { text: '', type: '' },
 { text: 'no changes added to commit (use "git add" and/or "git commit")', type: '' },
 ],
 },
 {
 command: 'npm run build 2>&1 | head -20',
 output: [
 { text: '', type: '' },
 { text: '> pomodoro-app@1.0.0 build', type: 'success' },
 { text: '> vite build', type: '' },
 { text: '', type: '' },
 { text: 'vite v6.5.0 building for production...', type: 'info' },
 { text: '✓ 64 modules transformed.', type: 'success' },
 { text: '✓ built in 2.34s', type: 'success' },
 { text: '', type: '' },
 { text: 'dist/index.html                 0.51 kB', type: '' },
 { text: 'dist/assets/index-abc123.js    45.23 kB', type: '' },
 { text: 'dist/assets/index-def456.css    8.76 kB', type: '' },
 { text: '', type: '' },
 ],
 },
 {
 command: 'neofetch --config off',
 output: [
 { text: 'OS: macOS 14.5 arm64', type: 'info' },
 { text: 'Host: MacBook Pro M2 Pro', type: '' },
 { text: 'Kernel: 23.5.0', type: '' },
 { text: 'Uptime: 2h 30m', type: '' },
 { text: 'Packages: 120 (brew)', type: '' },
 { text: 'Shell: zsh 5.9', type: 'highlight' },
 { text: 'Resolution: 2560x1600', type: '' },
 { text: 'Terminal: Pomodoro Terminal', type: 'success' },
 { text: 'CPU: Apple M2 Pro (10)', type: '' },
 { text: 'GPU: Apple M2 Pro', type: '' },
 { text: 'Memory: 4096MiB / 16384MiB', type: '' },
 ],
 },
 {
 command: 'date',
 output: [
 { text: 'Fri Jun 28 14:30:45 CST 2024', type: '' },
 ],
 },
 {
 command: 'ps aux | grep -i pomodoro',
 output: [
 { text: 'user    12345   0.0  0.1  42000  16384   ??  S    12:00PM   0:05.23 pomodoro-app', type: 'success' },
 { text: 'user    12346   0.0  0.0  40960   8192   ??  S    12:00PM   0:00.01 pomodoro-service', type: 'success' },
 ],
 },
 {
 command: 'curl -s http://localhost:3000/api/health',
 output: [
 { text: '{ "status": "ok", "uptime": "2h30m", "version": "1.0.0" }', type: 'success' },
 ],
 },
 {
 command: 'tail -f /var/log/pomodoro.log | head -10',
 output: [
 { text: '[INFO] 2024-06-28 12:00:00 - Pomodoro service started', type: 'info' },
 { text: '[INFO] 2024-06-28 12:25:00 - Work session started', type: 'success' },
 { text: '[INFO] 2024-06-28 12:30:00 - Rest session started', type: '' },
 { text: '[INFO] 2024-06-28 12:35:00 - Work session started', type: 'success' },
 { text: '[INFO] 2024-06-28 13:00:00 - Rest session started', type: '' },
 { text: '[INFO] 2024-06-28 13:05:00 - Work session started', type: 'success' },
 { text: '[INFO] 2024-06-28 13:30:00 - Rest session started', type: '' },
 { text: '[INFO] 2024-06-28 13:35:00 - Work session started', type: 'success' },
 { text: '[INFO] 2024-06-28 14:00:00 - Rest session started', type: '' },
 { text: '[INFO] 2024-06-28 14:05:00 - Work session started', type: 'success' },
 ],
 },
 {
 command: 'node -v && npm -v',
 output: [
 { text: 'v20.14.0', type: 'highlight' },
 { text: '10.7.0', type: 'highlight' },
 ],
 },
 {
 command: 'df -h /',
 output: [
 { text: 'Filesystem      Size   Used  Avail Capacity iused      ifree %iused  Mounted on', type: 'info' },
 { text: '/dev/disk3s1s1  466Gi   89Gi  377Gi    20% 1742284 18446744073709337523    0%   /', type: '' },
 ],
 },
 {
 command: 'whoami && hostname',
 output: [
 { text: 'user', type: 'highlight' },
 { text: 'macbook-pro.local', type: '' },
 ],
 },
 {
 command: 'echo $PATH | tr ":" "\n" | head -10',
 output: [
 { text: '/usr/local/bin', type: 'success' },
 { text: '/usr/bin', type: '' },
 { text: '/bin', type: '' },
 { text: '/usr/sbin', type: '' },
 { text: '/sbin', type: '' },
 { text: '/opt/homebrew/bin', type: 'highlight' },
 { text: '/opt/homebrew/sbin', type: '' },
 { text: '/Users/user/.npm-global/bin', type: '' },
 { text: '/Users/user/.local/bin', type: '' },
 { text: '/Applications/Visual Studio Code.app/Contents/Resources/app/bin', type: '' },
 ],
 },
 {
 command: 'wc -l src/views/home/*.vue',
 output: [
 { text: '    200 src/views/home/custom.vue', type: '' },
 { text: '    150 src/views/home/default.vue', type: '' },
 { text: '    550 src/views/home/githubTheme.vue', type: 'highlight' },
 { text: '    250 src/views/home/macos.vue', type: '' },
 { text: '    180 src/views/home/minimalClock.vue', type: '' },
 { text: '    200 src/views/home/motivationalQuote.vue', type: '' },
 { text: '    533 src/views/home/terminalTheme.vue', type: 'highlight' },
 { text: '    180 src/views/home/windowsUpdate.vue', type: '' },
 { text: '   2213 total', type: 'success' },
 ],
 },
 {
 command: 'git log --oneline -5',
 output: [
 { text: 'a1b2c3d (HEAD -> main) feat: refactor terminal theme', type: 'highlight' },
 { text: 'd4e5f6g feat: add github theme mode', type: '' },
 { text: 'h7i8j9k fix: update protocol handler', type: '' },
 { text: 'l0m1n2o feat: add color utilities', type: '' },
 { text: 'p3q4r5s init: project setup', type: '' },
 ],
 },
 {
 command: 'cat package.json | grep -A 10 "\"scripts\""',
 output: [
 { text: '  "scripts": {', type: '' },
 { text: '    "dev": "vite",', type: 'success' },
 { text: '    "build": "vite build",', type: '' },
 { text: '    "preview": "vite preview",', type: '' },
 { text: '    "typecheck": "tsc --noEmit",', type: '' },
 { text: '    "lint": "eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts"', type: '' },
 { text: '  },', type: '' },
 ],
 },
 {
 command: 'env | grep -i POMODORO',
 output: [
 { text: 'POMODORO_WORK_TIME=25', type: 'success' },
 { text: 'POMODORO_REST_TIME=5', type: 'success' },
 { text: 'POMODORO_LONG_REST=15', type: '' },
 { text: 'POMODORO_CYCLES=4', type: '' },
 ],
 },
 {
 command: 'ping -c 4 localhost',
 output: [
 { text: 'PING localhost (127.0.0.1): 56 data bytes', type: '' },
 { text: '64 bytes from 127.0.0.1: icmp_seq=0 ttl=64 time=0.032 ms', type: 'success' },
 { text: '64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.028 ms', type: 'success' },
 { text: '64 bytes from 127.0.0.1: icmp_seq=2 ttl=64 time=0.030 ms', type: 'success' },
 { text: '64 bytes from 127.0.0.1: icmp_seq=3 ttl=64 time=0.029 ms', type: 'success' },
 { text: '', type: '' },
 { text: '--- localhost ping statistics ---', type: 'info' },
 { text: '4 packets transmitted, 4 packets received, 0.0% packet loss', type: 'success' },
 { text: 'round-trip min/avg/max/stddev = 0.028/0.030/0.032/0.002 ms', type: '' },
 ],
 },
];
const progressBar = computed(() => {
 const filled = Math.round(progress.value);
 const empty = 50 - filled / 2;
 return `[${'='.repeat(Math.floor(filled / 2))}${'>'.repeat(filled % 2)}${' '.repeat(empty)}]`;
});
let timer = null;
let commandTimer = null;
let currentCommandIndex = 0;
onMounted(() => {
 updateTime();
 updateCountdown();
 timer = setInterval(() => {
 updateTime();
 updateCountdown();
 }, 1000);
 startCommandSimulation();
});
onUnmounted(() => {
 clearInterval(timer);
 clearInterval(commandTimer);
});
function updateTime() {
 const now = new Date();
 currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
function updateCountdown() {
 let targetTime;
 let totalDuration;
 if (curStatusC.value.value === 'work') {
 targetTime = nextRestTime.value;
 totalDuration = workTimeGap.value * workTimeGapUnit.value;
 }
 else {
 targetTime = nextWorkTime.value;
 totalDuration = restTimeGap.value * restTimeGapUnit.value;
 }
 displayTime.value = countDown(targetTime);
 const now = new Date().getTime();
 const target = new Date(targetTime).getTime();
 const diff = target - now;
 if (diff > 0 && totalDuration > 0) {
 progress.value = Math.max(0, Math.min(100, ((totalDuration - diff) / totalDuration) * 100));
 }
 else {
 progress.value = 100;
 }
}
function countDown(time) {
 const now = new Date().getTime();
 const diff = new Date(time).getTime() - now;
 if (diff < 0)
 return '00:00:00';
 const h = Math.floor(diff / 1000 / 60 / 60);
 const m = Math.floor((diff / 1000 / 60) % 60);
 const s = Math.floor((diff / 1000) % 60);
 return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
}
function startCommandSimulation() {
 commands.forEach((cmd) => {
 commandHistory.value.push({
 prompt: '➜',
 command: cmd.command,
 output: cmd.output,
 });
 });
 currentCommandIndex = commands.length;
 scrollToBottom();
}
function executeCommand() {
 const cmd = currentInput.value.trim();
 if (!cmd)
 return;
 let output = [];
 switch (cmd.toLowerCase()) {
 case 'help':
 output = [
 { text: 'Available commands:', type: 'info' },
 { text: ' help - Show this help message', type: '' },
 { text: ' clear - Clear terminal', type: '' },
 { text: ' date - Show current date', type: '' },
 { text: ' time - Show current time', type: '' },
 { text: ' status - Show pomodoro status', type: 'success' },
 { text: ' ls - List directory contents', type: '' },
 { text: ' uptime - Show system uptime', type: '' },
 { text: ' neofetch - Show system info', type: '' },
 ];
 break;
 case 'clear':
 commandHistory.value = [];
 currentInput.value = '';
 return;
 case 'date':
 output = [{ text: new Date().toLocaleDateString('zh-CN'), type: '' }];
 break;
 case 'time':
 output = [{ text: currentTime.value, type: '' }];
 break;
 case 'status':
 output = [
 { text: `Status: ${curStatusC.value.value === 'work' ? 'WORKING' : 'RESTING'}`, type: curStatusC.value.value === 'work' ? 'error' : 'success' },
 { text: `Remaining: ${displayTime.value}`, type: 'success' },
 { text: `Progress: ${Math.round(progress.value)}%`, type: '' },
 ];
 break;
 case 'ls':
 output = [
 { text: 'pomodoro-app/', type: 'highlight' },
 { text: 'focus-timer/', type: 'highlight' },
 { text: 'README.md', type: '' },
 { text: 'package.json', type: '' },
 ];
 break;
 case 'uptime':
 output = [{ text: 'Pomodoro Terminal running since start', type: 'info' }];
 break;
 case 'neofetch':
 output = [
 { text: 'OS: Pomodoro OS v1.0', type: 'info' },
 { text: 'Shell: zsh', type: '' },
 { text: 'Terminal: Pomodoro Terminal', type: 'success' },
 { text: 'Status: ' + (curStatusC.value.value === 'work' ? 'WORKING' : 'RESTING'), type: curStatusC.value.value === 'work' ? 'error' : 'success' },
 ];
 break;
 default:
 output = [{ text: `Command not found: ${cmd}`, type: 'error' }];
 }
 commandHistory.value.push({
 prompt: '➜',
 command: cmd,
 output,
 });
 currentInput.value = '';
 scrollToBottom();
}
function scrollToBottom() {
 nextTick(() => {
 if (outputRef.value) {
 outputRef.value.scrollTop = outputRef.value.scrollHeight;
 }
 });
}
</script>

<style lang="scss" scoped>
.terminal-theme {
  width: 100%;
  height: 100%;
  background: #0d1117;
  display: flex;
  flex-direction: column;
  user-select: none;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', 'Monaco', monospace;
  overflow: hidden;
}

.terminal-header {
  height: 36px;
  background: #21262d;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .window-controls {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .control-btn {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;

    &.close {
      background: #ff5f57;
      color: rgba(0, 0, 0, 0.6);

      &:hover {
        background: #ff3b30;
      }
    }

    &.minimize {
      background: #ffbd2e;
      color: rgba(0, 0, 0, 0.6);

      &:hover {
        background: #ffc107;
      }
    }

    &.maximize {
      background: #28ca42;
      color: rgba(0, 0, 0, 0.6);

      &:hover {
        background: #4caf50;
      }
    }
  }

  .terminal-tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    background: #161b22;
    padding: 4px;
    border-radius: 6px;

    .tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      color: #8b949e;
      background: transparent;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      &.active {
        background: #30363d;
        color: #c9d1d9;

        .tab-close {
          opacity: 1;
        }
      }

      .tab-close {
        opacity: 0;
        border: none;
        background: transparent;
        color: #8b949e;
        cursor: pointer;
        padding: 2px;
        border-radius: 3px;
        transition: all 0.2s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
      }
    }

    .tab-add {
      border: none;
      background: transparent;
      color: #8b949e;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #fff;
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #8b949e;

    .header-btn {
      border: none;
      background: transparent;
      color: #8b949e;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #fff;
      }
    }

    .shell-info {
      color: #58a6ff;
    }

    .user-info {
      color: #3fb950;
    }

    .divider {
      color: #30363d;
    }
  }
}

.terminal-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
}

.terminal-output {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: #c9d1d9;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #161b22;
  }

  &::-webkit-scrollbar-thumb {
    background: #30363d;
    border-radius: 4px;

    &:hover {
      background: #484f58;
    }
  }
}

.boot-message {
  margin-bottom: 24px;
  padding-left: 4px;

  .boot-line {
    color: #8b949e;
    margin-bottom: 4px;

    &.success {
      color: #3fb950;
    }
  }
}

.command-item {
  margin-bottom: 12px;
}

.command-input {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;

  .prompt {
    color: #f78166;
    font-weight: 600;
  }

  .command {
    color: #58a6ff;
  }
}

.command-output {
  padding-left: 24px;
  white-space: pre-wrap;
}

.output-line {
  margin-bottom: 2px;
}

.text-success {
  color: #3fb950;
}

.text-error {
  color: #f85149;
}

.text-warning {
  color: #d29922;
}

.text-info {
  color: #8b949e;
}

.text-highlight {
  color: #58a6ff;
}

.pomodoro-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed #30363d;
}

.terminal-input-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #30363d;
  margin-top: 8px;

  .prompt {
    color: #f78166;
    font-weight: 600;
    flex-shrink: 0;
  }

  .path {
    color: #58a6ff;
    flex-shrink: 0;
  }

  .input-field {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #c9d1d9;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.5;
  }

  .cursor {
    color: #58a6ff;
    animation: blink 1s infinite;
    flex-shrink: 0;
  }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>