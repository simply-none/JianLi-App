<template>
  <div class="music-player-theme">
    <!-- 背景层 -->
    <div class="bg-layer">
      <div class="bg-image" :style="{ background: currentSong.coverBg }"></div>
      <div class="bg-mask"></div>
    </div>

    <!-- 顶部栏 -->
    <div class="top-bar">
      <div class="top-left">
        <button class="back-btn">
          <LucideIcon name="ChevronLeft" :size="20" />
        </button>
        <div class="song-mini-info">
          <div class="song-name">{{ currentSong.name }}</div>
          <div class="singer-name">{{ currentSong.singer }} · {{ currentSong.album }}</div>
        </div>
      </div>
      <div class="top-right">
        <button class="icon-btn">
          <LucideIcon name="Share2" :size="18" />
        </button>
        <button class="icon-btn">
          <LucideIcon name="MoreHorizontal" :size="20" />
        </button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-area">
      <!-- 左侧：专辑封面 -->
      <div class="cover-section">
        <div class="disc-outer" :class="{ playing: isPlaying }">
          <div class="disc-inner" :style="{ background: currentSong.coverBg }">
            <div class="disc-center"></div>
          </div>
        </div>
        <div class="song-info-mobile">
          <h2 class="song-title">{{ currentSong.name }}</h2>
          <p class="song-artist">{{ currentSong.singer }}</p>
        </div>
      </div>

      <!-- 右侧：歌词区 -->
      <div class="lyrics-section">
        <div class="lyrics-header">
          <span class="lyrics-title">歌词</span>
          <span class="lyrics-album">{{ currentSong.album }}</span>
        </div>
        <div class="lyrics-scroll" ref="lyricsScrollRef">
          <div class="lyrics-list">
            <div
              v-for="(line, index) in lyricsLines"
              :key="index"
              class="lyric-line"
              :class="{ active: currentLyricIndex === index }"
            >
              {{ line }}
            </div>
          </div>
        </div>
        <div class="focus-info">
          <div class="focus-badge" :class="curStatusC.value">
            {{ curStatusC.value === 'work' ? '专注模式' : '休息模式' }}
          </div>
          <div class="focus-time">
            <span class="label">剩余</span>
            <span class="time">{{ displayTime }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部播放控制栏 -->
    <div class="player-bar">
      <div class="progress-area">
        <span class="time-text">{{ formatTime(simulatedTime) }}</span>
        <div class="progress-track" @click="seekProgress">
          <div class="progress-fill" :style="{ width: simulatedProgress + '%' }"></div>
          <div class="progress-thumb" :style="{ left: simulatedProgress + '%' }"></div>
        </div>
        <span class="time-text">{{ formatTime(currentSong.durationSec) }}</span>
      </div>

      <div class="controls-area">
        <div class="controls-left">
          <button class="ctrl-btn">
            <LucideIcon name="ListMusic" :size="18" />
          </button>
        </div>

        <div class="controls-center">
          <button class="ctrl-btn">
            <LucideIcon name="Shuffle" :size="18" />
          </button>
          <button class="ctrl-btn" @click="prevSong">
            <LucideIcon name="SkipBack" :size="24" />
          </button>
          <button class="ctrl-btn play-btn" @click="togglePlay">
            <LucideIcon :name="isPlaying ? 'Pause' : 'Play'" :size="28" />
          </button>
          <button class="ctrl-btn" @click="nextSong">
            <LucideIcon name="SkipForward" :size="24" />
          </button>
          <button class="ctrl-btn">
            <LucideIcon name="Repeat" :size="18" />
          </button>
        </div>

        <div class="controls-right">
          <button class="ctrl-btn">
            <LucideIcon name="Volume2" :size="18" />
          </button>
          <div class="volume-bar">
            <div class="volume-fill" style="width: 70%"></div>
          </div>
          <button class="ctrl-btn">
            <LucideIcon name="Maximize2" :size="18" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import LucideIcon from '@/components/LucideIcon.vue';
import useGlobalSetting from '@/store/useGlobalSetting';
import useWorkOrRestStore from '@/store/useWorkOrReset';

const { curStatusC } = storeToRefs(useGlobalSetting());
const { nextRestTime, nextWorkTime, workTimeGapUnit, restTimeGapUnit } = storeToRefs(useWorkOrRestStore());

const displayTime = ref('00:00');
const progress = ref(0);
const currentSongIndex = ref(0);
const isPlaying = ref(true);
const simulatedTime = ref(0);
const currentLyricIndex = ref(0);
const lyricsScrollRef = ref(null);

const songs = [
  {
    name: '晴天',
    singer: '周杰伦',
    album: '叶惠美',
    duration: '4:29',
    durationSec: 269,
    coverBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    name: '七里香',
    singer: '周杰伦',
    album: '七里香',
    duration: '4:59',
    durationSec: 299,
    coverBg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  {
    name: '稻香',
    singer: '周杰伦',
    album: '魔杰座',
    duration: '3:43',
    durationSec: 223,
    coverBg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  },
  {
    name: '青花瓷',
    singer: '周杰伦',
    album: '我很忙',
    duration: '3:58',
    durationSec: 238,
    coverBg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
  {
    name: '夜曲',
    singer: '周杰伦',
    album: '十一月的萧邦',
    duration: '3:48',
    durationSec: 228,
    coverBg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  },
];

const currentSong = computed(() => songs[currentSongIndex.value]);

const simulatedProgress = computed(() => {
  if (!currentSong.value.durationSec) return 0;
  return Math.min(100, (simulatedTime.value / currentSong.value.durationSec) * 100);
});

const lyricsLines = computed(() => {
  const base = [
    '故事的小黄花',
    '从出生那年就飘着',
    '童年的荡秋千',
    '随记忆一直晃到现在',
    'Re So So Si Do Si La',
    'So La Si Si Si Si La Si La So',
    '吹着前奏望着天空',
    '我想起花瓣试着掉落',
    '为你翘课的那一天',
    '花落的那一天',
    '教室的那一间',
    '我怎么看不见',
    '消失的下雨天',
    '我好想再淋一遍',
    '没想到失去的勇气我还留着',
    '好想再问一遍',
    '你会等待还是离开',
  ];
  return base;
});

const totalTime = computed(() => {
  const minutes = curStatusC.value.value === 'work' ? workTimeGapUnit.value : restTimeGapUnit.value;
  return `${minutes}:00`;
});

let playTimer = null;
let pomodoroTimer = null;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
}

function togglePlay() {
  isPlaying.value = !isPlaying.value;
}

function prevSong() {
  currentSongIndex.value = (currentSongIndex.value - 1 + songs.length) % songs.length;
  simulatedTime.value = 0;
  currentLyricIndex.value = 0;
}

function nextSong() {
  currentSongIndex.value = (currentSongIndex.value + 1) % songs.length;
  simulatedTime.value = 0;
  currentLyricIndex.value = 0;
}

function seekProgress(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  simulatedTime.value = percent * currentSong.value.durationSec;
}

function updatePlayback() {
  if (!isPlaying.value) return;

  simulatedTime.value += 1;

  const totalLines = lyricsLines.value.length;
  const lineDuration = currentSong.value.durationSec / (totalLines + 2);
  const newIndex = Math.min(totalLines - 1, Math.floor(simulatedTime.value / lineDuration));
  if (newIndex !== currentLyricIndex.value) {
    currentLyricIndex.value = newIndex;
    nextTick(() => {
      if (lyricsScrollRef.value) {
        const activeLine = lyricsScrollRef.value.querySelector('.lyric-line.active');
        if (activeLine) {
          activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }

  if (simulatedTime.value >= currentSong.value.durationSec) {
    nextSong();
  }
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
  if (diff < 0) return '00:00';
  const m = Math.floor(diff / 1000 / 60);
  const s = Math.floor((diff / 1000) % 60);
  return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
}

onMounted(() => {
  updateCountdown();
  updatePlayback();
  playTimer = setInterval(updatePlayback, 1000);
  pomodoroTimer = setInterval(updateCountdown, 1000);
});

onUnmounted(() => {
  if (playTimer) clearInterval(playTimer);
  if (pomodoroTimer) clearInterval(pomodoroTimer);
});
</script>

<style lang="scss" scoped>
.music-player-theme {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  user-select: none;
  display: flex;
  flex-direction: column;
}

/* 背景层 */
.bg-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  overflow: hidden;

  .bg-image {
    position: absolute;
    top: -50px;
    left: -50px;
    right: -50px;
    bottom: -50px;
    filter: blur(40px);
    transform: scale(1.1);
    transition: all 1s ease;
  }

  .bg-mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.5) 100%);
  }
}

/* 顶部栏 */
.top-bar {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: relative;
  z-index: 10;
  flex-shrink: 0;

  .top-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .back-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    }

    .song-mini-info {
      .song-name {
        font-size: 15px;
        font-weight: 500;
        margin-bottom: 2px;
      }

      .singer-name {
        font-size: 12px;
        opacity: 0.7;
      }
    }
  }

  .top-right {
    display: flex;
    align-items: center;
    gap: 8px;

    .icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    }
  }
}

/* 主内容区 */
.main-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 80px;
  padding: 20px 60px;
  position: relative;
  z-index: 1;
  overflow: hidden;
}

/* 封面区 */
.cover-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;

  .disc-outer {
    width: 360px;
    height: 360px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);

    &.playing {
      animation: disc-rotate 20s linear infinite;
    }

    .disc-inner {
      width: 280px;
      height: 280px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;

      .disc-center {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: #1a1a1a;
        border: 4px solid rgba(255, 255, 255, 0.1);
      }
    }
  }

  .song-info-mobile {
    text-align: center;

    .song-title {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 8px 0;
    }

    .song-artist {
      font-size: 14px;
      opacity: 0.7;
      margin: 0;
    }
  }
}

@keyframes disc-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 歌词区 */
.lyrics-section {
  width: 380px;
  max-height: 500px;
  display: flex;
  flex-direction: column;

  .lyrics-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 24px;
    flex-shrink: 0;

    .lyrics-title {
      font-size: 16px;
      font-weight: 500;
    }

    .lyrics-album {
      font-size: 13px;
      opacity: 0.6;
    }
  }

  .lyrics-scroll {
    flex: 1;
    overflow-y: auto;
    margin-bottom: 20px;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
    }

    .lyrics-list {
      padding: 20px 0;

      .lyric-line {
        padding: 10px 0;
        font-size: 14px;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.5);
        transition: all 0.3s ease;

        &.active {
          color: #fff;
          font-size: 16px;
          font-weight: 500;
          transform: scale(1.02);
          transform-origin: left center;
        }
      }
    }
  }

  .focus-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    flex-shrink: 0;

    .focus-badge {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;

      &.work {
        background: rgba(49, 194, 124, 0.2);
        color: #31c27c;
      }

      &.rest {
        background: rgba(255, 193, 7, 0.2);
        color: #ffc107;
      }
    }

    .focus-time {
      display: flex;
      align-items: center;
      gap: 10px;

      .label {
        font-size: 12px;
        opacity: 0.6;
      }

      .time {
        font-size: 18px;
        font-weight: 500;
        font-feature-settings: 'tnum';
      }
    }
  }
}

/* 底部播放控制栏 */
.player-bar {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 24px 16px;
  position: relative;
  z-index: 10;
  flex-shrink: 0;

  .progress-area {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;

    .time-text {
      font-size: 12px;
      opacity: 0.6;
      font-feature-settings: 'tnum';
      min-width: 40px;
      text-align: center;
    }

    .progress-track {
      flex: 1;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      position: relative;
      cursor: pointer;

      &:hover {
        .progress-thumb {
          opacity: 1;
        }
      }

      .progress-fill {
        height: 100%;
        background: #31c27c;
        border-radius: 2px;
        transition: width 0.1s linear;
      }

      .progress-thumb {
        width: 12px;
        height: 12px;
        background: #fff;
        border-radius: 50%;
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        opacity: 0;
        transition: opacity 0.2s;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
    }
  }

  .controls-area {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .controls-left,
    .controls-right {
      width: 180px;
      display: flex;
      align-items: center;
      gap: 12px;

      .ctrl-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;

        &:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }
      }

      .volume-bar {
        width: 80px;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        overflow: hidden;

        .volume-fill {
          height: 100%;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 2px;
        }
      }
    }

    .controls-left {
      justify-content: flex-start;
    }

    .controls-right {
      justify-content: flex-end;
    }

    .controls-center {
      display: flex;
      align-items: center;
      gap: 24px;

      .ctrl-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: transparent;
        border: none;
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;

        &:hover {
          transform: scale(1.1);
        }

        &.play-btn {
          width: 56px;
          height: 56px;
          background: #31c27c;

          &:hover {
            background: #2db86e;
            transform: scale(1.05);
          }
        }
      }
    }
  }
}
</style>
