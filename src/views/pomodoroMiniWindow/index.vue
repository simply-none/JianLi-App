<template>
  <div class="pomodoroMiniWindow">
    <div class="move">
      <div class="move-left" @mousemove="enableMouseClickThroughFn"></div>
      <div class="move-right" @mousemove="disableMouseClickThroughFn"></div>
    </div>
    <div class="drag"></div>
    <div class="tip">
      <div class="tip-status" v-if="curStatusC.value">
        <template v-if="curStatusC.value == 'work'">
          <div class="work"></div>
        </template>
        <template v-else-if="curStatusC.value == 'rest'">
          <div class="rest"></div>
        </template>
      </div>
      <div class="tip-label">
        倒计时
      </div>
    </div>
    <div class="value">{{ nextDiffTime }}</div>
  </div>
</template>

<script setup>
import { onMounted, ref, onBeforeUnmount } from 'vue';
import moment from 'moment';
import { throttle } from '@/utils/index';
const curStatusC = ref()
const nextTime = ref()
const nextDiffTime = ref()

window.ipcRenderer.on('sync-data-to-other-window', (event, arg) => {
  console.log(arg)
  if (Object.prototype.toString.call(arg) === '[object Object]') {
    curStatusC.value = arg.curStatus
    // 判断是否是work还是rest
    if (arg.curStatus.value === 'work') {
      nextTime.value = moment(arg.startWorkTime + arg.workTimeGapUnit * arg.workTimeGap).format('YYYY-MM-DD HH:mm:ss')
    } else {
      nextTime.value = moment(arg.closeWorkTime + arg.restTimeGapUnit * arg.restTimeGap).format('YYYY-MM-DD HH:mm:ss')
    }

    // 倒计时，当前时间和下一次时间的差值
    countDown()
  }
})

// 将定时器抽离成函数
function countDown() {
  let timer = setInterval(() => {
    const now = moment()
    const next = moment(nextTime.value)
    const diff = next.diff(now)
    const diffTime = moment.duration(diff)

    const diffHours = diffTime.hours() < 10 ? '0' + diffTime.hours() : diffTime.hours()
    const diffMinutes = diffTime.minutes() < 10 ? '0' + diffTime.minutes() : diffTime.minutes()
    const diffSeconds = diffTime.seconds() < 10 ? '0' + diffTime.seconds() : diffTime.seconds()

    nextDiffTime.value = diffHours + ':' + diffMinutes + ':' + diffSeconds
    // 如果时间小于0，就停止定时器
    if (diff <= 0) {
      clearInterval(timer)
    }
  }, 1000) // 1秒执行一次
}

// 鼠标移入移出
const enableMouseClickThroughFn = () => {
  // throttle(() => {
  window.ipcRenderer.send('enable-mouse-click-through', 'second')
  // }, 100)

}
const disableMouseClickThroughFn = () => {
  // throttle(() => {
  window.ipcRenderer.send('disable-mouse-click-through', 'second')
  // }, 100)
}

onMounted(() => {
})
</script>

<style lang="scss" scoped>
.pomodoroMiniWindow {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 0 12px 12px 12px;
  background: #e6e6e68e;
}

.drag {
  width: 100%;
  height: 12px;
  -webkit-app-region: drag;
  cursor: pointer;
}

.move {
  width: 100%;
  height: 12px;
  display: flex;
  justify-content: space-around;

  &-left {
    width: 9px;
    height: 9px;
    background: #a8a8a83f;
  }

  &-right {
    width: 9px;
    height: 9px;
    background: #a8a8a83f;
  }
}

.label {
  font-size: 18px;
  font-weight: 500;
  color: #333;
  pointer-events: none;
}

.value {
  font-size: 20px;
  font-weight: 900;
  color: #333;
  pointer-events: none;
}

.tip {
  display: flex;
  align-items: center;

  &-label {
    font-size: 16px;
    font-weight: 500;
    color: #333;
  }

  &-status {
    margin-right: 12px;
    display: flex;
    align-items: center;
  }

  .work,
  .rest {
    // 实现一个小圆点
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .work {
    background: #00ff00;
  }

  .rest {
    background: #ff0000;
  }
}
</style>