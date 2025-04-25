<template>
  <draggableContainer v-bind="computedPosition" @update="updateFn">
    <div class="home-rest2-text" @contextmenu.stop="contextmenuFn">
      <div class="home-rest2-text-item" v-for="(tItem, tIndex) in (toNextTime || '00:00:00').split(':')" :key="tItem">
        <div data-el="1" class="home-rest2-text-number" :style="{
          ...(props.data[1] || {}),
        }">{{ tItem }}</div>
        <div data-el="2" class="home-rest2-text-split" :style="{
          ...(props.data[2] || {}),
        }" v-if="(toNextTime || '00:00:00').split(':').length != tIndex + 1">:
        </div>
      </div>
    </div>
  </draggableContainer>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted, toRaw } from 'vue';
import { storeToRefs } from 'pinia';

import useGlobalSetting from '@/store/useGlobalSetting';
import useWorkOrRestStore from '@/store/useWorkOrReset';
import moment from 'moment';

import draggableContainer from '@/components/draggableContainer.vue';

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
    const p = JSON.parse(JSON.stringify(props.themetData || { position: initPosition }))
    console.warn(p, 'p')
    return p.position || initPosition;
  },
  set() { }
})

const timer = ref(null);
const toNextTime = ref('00:00:00');
const percentage = ref(1);

const {
  nextRestTime,
  nextWorkTime,
} = storeToRefs(useWorkOrRestStore());
const { homeModeOpsC, curStatusC } = storeToRefs(useGlobalSetting());

function updateFn(position) {
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

onMounted(() => {
  timer.value = setInterval(() => {
    if (curStatusC.value.value === 'work') {
      // console.log(countDown(nextRestTime.value), 'countDown', nextRestTime.value)
      toNextTime.value = countDown(nextRestTime.value);
    } else if (curStatusC.value.value === 'rest') {
      // console.log(countDown(nextWorkTime.value), 'countDown', nextWorkTime.value)
      toNextTime.value = countDown(nextWorkTime.value);
      let isAdd = 1
      if (percentage.value < 60) {
        isAdd = Math.random() > 0.6 ? percentage.value + 1 : percentage.value;
      } else {
        isAdd = Math.random() > percentage.value * 0.01 ? percentage.value + 1 : percentage.value;
      }
      percentage.value = isAdd > 97 ? 97 : isAdd;
    } else if (curStatusC.value.value == 'screen') {
      // 展示时钟
      toNextTime.value = moment().format('HH:mm:ss');
    }
  }, 1000);
});

onUnmounted(() => {
  clearInterval(timer.value);
});

function toggleComponent(status) {
  switch (status) {
    case 'work':
      return 'work'
    case 'rest':
      return 'rest'
  }
}

watch(() => curStatusC.value.value, () => {
  // console.log(curStatusC.value, 'curStatusC')
  percentage.value = 1;
  // 首页展示组件模式变更
  toggleComponent(curStatusC.value.value)
}, { immediate: true, deep: true })

// 写一个倒计时函数，用来计算当前时间距离下次工作时间的时间差，格式是00:00:00
function countDown(time) {
  const now = (new Date()).getTime();
  const diff = (new Date(time)).getTime() - now;
  if (diff < 0) return '00:00:00';
  let h = Math.floor(diff / 1000 / 60 / 60);
  let m = Math.floor((diff / 1000 / 60) % 60);
  let s = Math.floor((diff / 1000) % 60);
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
}

function contextmenuFn(event) {
  const target = event.target;
  // 获取target所有的data-*属性
  const data = target.dataset;
  // 获取target所有的css样式
  const style = {
    ...window.getComputedStyle(target)
  }
  // 排除style中键为数字的属性
  for (let key in style) {
    if (!isNaN(key)) {
      delete style[key];
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
.home-rest2-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 10px 20px;
  color: #6b686845;
  display: flex;
}

.home-rest2-text-item {
  display: flex;
}

.home-rest2-text-number {
  text-align: center;
  width: 1em;
  margin: 0 0.2em;
}

.home-rest2-text-number,
.home-rest2-text-split {
  font-size: 200px;
}
</style>