<template>
  <div class="pomodoroMiniWindow">
    <div class="close" @click="hideWindow">
      <el-icon><CircleCloseFilled style="color: #e3e3e3;"/></el-icon>
    </div>
    <div class="tip-box">
      <div class="tip-item" v-for="(jobItem, index) in jobTips" @click="jobDone(jobItem, index)">
        <div class="show-icon" v-if="jobItem.iconType == 'image'">
          <el-image :src="jobItem.icon">
            <template #error>
              <div>图片加载失败</div>
              <div>{{ '图标' }}</div>
            </template>
          </el-image>
        </div>
        <div v-else-if="jobItem.icon" class="show-icon" v-html="jobItem.icon"></div>
        <div v-else class="show-icon">
          <el-avatar> {{ jobItem.label.slice(0, 1) }} </el-avatar>
        </div>

        <div class="tip-name">{{ jobItem.label }}</div>
        <div class="tip-next-time">{{ nextTime(jobItem.endTipTime) }}</div>
      </div>
    </div>
    <div class="tip">
      <!-- <pre>{{ JSON.stringify(sysData, null, 2) }}</pre> -->
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, onBeforeUnmount, computed } from 'vue';
import { CircleCloseFilled } from '@element-plus/icons-vue'
import moment from 'moment';
import { throttle } from '@/utils/index';
import { ElMessage } from 'element-plus';
const curStatusC = ref({})
const nextDiffTime = ref()
const sysData = ref({})
const jobTips = ref([])
const allTips = ref([])
const getJobTips = () => {
  let tips = []

  for (const key in sysData.value) {
    if (key.startsWith('job-tip:')) {
      let find = sysData.value['tipTypeOps'].find(i => i.value == sysData.value[key].type)
      // 找到allTips中，是否有未完成的任务
      let isUnFinish = allTips.value.some(i => i.type == sysData.value[key].type && !i.done)
      console.log(isUnFinish, allTips.value, allTips.value.filter(i => i.type == sysData.value[key].type), 'isUnFinish')
      if (!isUnFinish && allTips.value.length > 0) continue
      tips.push({
        ...sysData.value[key],
        icon: find?.icon,
        iconType: find?.iconType,
        label: find?.label,
      })
    }
  }

  return tips
}

const jobDone = (jobItem, index) => {
  jobTips.value.splice(index, 1)
  console.log(jobItem, 'jobDone')
  let findIndex = allTips.value.findIndex(i => i.type == jobItem.type && i.endTipTime == jobItem.endTipTime)
  if (findIndex != -1) {
    allTips.value.splice(findIndex, 1, {
      ...jobItem,
      done: true,
    })
  }
  


  // 完成任务
  ElMessage({
    message: '已完成' + jobItem.type,
    type: 'success',
    duration: 2000,
  })
  // 查看alltips中，是否全部的都已经完成
  let findAllDone = allTips.value.every(i => i.done)
  if (findAllDone) {
    hideWindow()
  }
}

const nextTime = (time) => {
  return moment(time).format('HH:mm')
}

window.ipcRenderer.on('sync-data-to-other-window', (event, arg) => {
  console.log(arg, 'MY PomodoroMiniWindow')

  try {
    if (Object.prototype.toString.call(arg) === '[object Object]') {
      sysData.value = {
        ...sysData.value,
        ...(arg || {}),
      }
      let tips = getJobTips()
      jobTips.value = tips
      allTips.value.push(...tips)
      console.log(tips, allTips.value, 'allTips')


    }
  } catch (e) {
    console.error(e, 'e')
  }
})

// 隐藏窗口
const hideWindow = () => {
  window.ipcRenderer.send('hide-new-window', 'jobTipWindow')
}

onMounted(() => {
})
</script>

<style lang="scss">
:root {
  --jianli-global-font: "";
  --jianli-global-font-EN: "";
}

html,
body,
button,
input {
  font-family: var(--jianli-global-font-EN), var(--jianli-global-font);
}
</style>

<style lang="scss" scoped>
.pomodoroMiniWindow {
  position: relative;
  overflow: auto;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 0 12px 12px 12px;
  background: #e6e6e68e;
}

.close {
  position: absolute;
  top: 0;
  right: 0;
  cursor: pointer;
  z-index: 1;
  padding: 12px;
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

  &-box {
    display: flex;
    width: 100%;
    height: 100%;
    flex-direction: row;
    align-items: center;
    justify-content: space-evenly;
    gap: 12px;
  }

  &-item {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

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
  &-name {
    font-weight: 600;
    color: #333;
  }
  &-next-time {
    color: #8f8f8f;
    font-size: 0.8em;
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

.show-icon {
  width: 36px;
  height: 36px;
  overflow: hidden;
  padding: 6px;

  &>* {
    width: 100%;
    height: 100%;
    display: flex;
    border-radius: 50%;
  }
}
</style>