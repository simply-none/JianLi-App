<template>
  <draggableContainer v-bind="computedPosition" @update="updateFn">
    <div data-el="1" class="item" @contextmenu.stop="contextmenuFn">
      <div class="tip-top">
        <div class="tip-title">事件提醒</div>
        <div class="tip-handle">
          <el-button color="#3883fa" dark plain @click="tipAll">一键提醒</el-button>
          <!-- 停止提醒 -->
          <el-button color="#c9b967" dark plain @click="stopAllTip">停止所有提醒</el-button>
        </div>
      </div>
      <!-- 当前所有的提醒 -->
      <div class="tip-box">
        <div class="tip-item" v-for="tipItem in tipTypeC">
          <div class="tip-type">{{ getType(tipItem.type) }}</div>
          <div class="tip-type" :title="'下一次提醒时间: ' + ((nextTime[tipItem.type] || {}).nextTime || '--')">{{ (nextTime[tipItem.type] || {}).nextTime || '--' }}</div>
          <div class="tip-handle">
            <el-button size="small" plain color="#3883fa" dark @click="tip(tipItem)">提醒</el-button>
            <!-- 终止提醒 -->
            <el-button size="small" plain color="#c9b967" dark @click="stopTip(tipItem)">终止提醒</el-button>
          </div>
        </div>
      </div>
    </div>
  </draggableContainer>
</template>

<script setup lang="ts">

import useGlobalSetting from '@/store/useGlobalSetting';

import draggableContainer from '@/components/draggableContainer.vue';

import { ref, reactive, watch, computed, toRaw, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import UploadVue from '@/components/upload.vue';
import useCacheSetStore from '@/store/useCacheSet'
import { send, sendSync } from '@/utils/common';
import { ElMessage } from 'element-plus';
import useTips from '@/store/useTips';
import { sysNotify, appNotify } from "@/utils/notify";

const { tipType, tipTypeC, tipTypeOps, tipTypeOpsC } = storeToRefs(useTips());
const { setTipType, setTipTypeOps } = useTips();

const tipTypeCc = ref(tipTypeC.value)
watch(() => tipTypeC.value, (newVal) => {
  tipTypeCc.value = newVal
  console.log(tipTypeCc.value)
}, {
  deep: true,
})
const tipTypeOpsCc = ref(tipTypeOpsC.value)
watch(() => tipTypeOpsC.value, (newVal) => {
  tipTypeOpsCc.value = newVal
  console.log(tipTypeOpsCc.value)
}, {
  deep: true,
})

const props = defineProps({
  data: {
    type: Object,
    default: () => {
      return {};
    }
  },
  // 主题数据
  themetData: {
    type: Object,
    default: () => {
      return {};
    }
  }
})

const emit = defineEmits(['rightClick', 'update'])
const initPosition = {
  x: 0,
  y: 0,
  width: 200,
  height: 200,
}

const computedPosition = computed({
  get() {
    const p = JSON.parse(JSON.stringify(props.data || { position: initPosition }))
    console.warn(p, 'p')
    return p.position || initPosition;
  },
  set() { }
})

const tipAll = () => {
  tipTypeCc.value.forEach(item => {
    send('start-job', {
      type: item.type,
      gap: Number(item.gap) * Number(item.unit),
    })
  })
}
let nextTime = ref<ObjectType>({})
window.ipcRenderer.on('job-start-tip', (event, arg) => {
  console.log(arg, 'job-end-tip')
  let nt = arg.time + arg.gap
  nextTime.value[arg.type] = {
    type: arg.type,
    nextTime: new Date(nt).toLocaleString(),
  }
})
const stopAllTip = () => {
  nextTime.value = {}
  tipTypeCc.value.forEach(item => {
    send('stop-job', {
      type: item.type,
    })
  })
}
const tip = (item: ObjectType) => {
  send('start-job', {
    type: item.type,
    gap: Number(item.gap) * Number(item.unit),
  })
}
// 终止提醒
const stopTip = (item: ObjectType) => {
  nextTime.value[item.type] = {}
  send('stop-job', {
    type: item.type,
  })
}

const curUnit = (unit: number) => {
  console.log(unit, 'unit')
  if (unit == 60 * 1000) {
    return '分钟'
  } else if (unit == 60 * 60 * 1000) {
    return '小时'
  } else if (unit == 1000) {
    return '秒'
  }
}
const getType = (type: string) => {
  return tipTypeOpsCc.value.find(i => i.value == type)?.label
}

const { homeModeOpsC, curStatusC } = storeToRefs(useGlobalSetting());

function updateFn(position: ObjectType) {
  console.log(position, 'position')
  computedPosition.value = {
    ...toRaw(computedPosition.value || {}),
    ...toRaw(position || {}),
  }
  console.log(computedPosition.value, 'computedPosition')
  emit('update', {
    ...toRaw(computedPosition.value || {}),
    ...toRaw(position || {}),
  })
}

function contextmenuFn(event: PointerEvent | ObjectType) {
  console.log(event, 'contextmenuFn')
  const target = event.target;
  if (!target) return;
  // 获取target所有的data-*属性
  const data = target.dataset;
  // 获取target所有的css样式
  const style = {
    ...window.getComputedStyle(target)
  }
  // 排除style中键为数字的属性
  for (let key in style) {
    if (typeof key == 'number') {
      if (!isNaN(key)) {
        delete style[key];
      }
    }
  }
  console.log(data, 'data')
  console.log(style, 'style', Object.keys(style))

  emit('rightClick', {
    el: data.el,
    data: style,
  })
}

</script>

<style lang="scss" scoped>
.item {
  display: flex;
  flex-direction: column;
  justify-content: center;
  backdrop-filter: blur(6px);
  padding: 12px 24px;
  color: #878787;
}

.tip-top {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
}
.tip-box {
    padding: 24px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.tip-item {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
}
.tip-type {
    width: 5em;
}
</style>