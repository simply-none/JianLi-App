<template>
  <draggableContainer v-bind="computedPosition" @update="updateFn">
    <div class="item" v-if="currentStateKey === 'rest'" @contextmenu.stop="contextmenuFn" data-el="1">
      <div class="label">
        下次工作时间
      </div>
      <div class="value">
        {{ nextWorkTimeText }}
      </div>
      <div class="value">
        倒计时：{{ toNextWorkTime }}
      </div>
    </div>
    <div class="item" v-else-if="currentStateKey === 'work'" @contextmenu.stop="contextmenuFn" data-el="1">
      <div class="label">
        下次休息时间
      </div>
      <div class="value">
        {{ nextRestTimeText }}
      </div>
      <div class="value">
        倒计时：{{ toNextRestTime }}
      </div>
    </div>
  </draggableContainer>

</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted, toRaw } from 'vue';
import { storeToRefs } from 'pinia';

import useTipsRuntime from '@/store/useTipsRuntime';

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
    const p = JSON.parse(JSON.stringify(props.data || { position: initPosition }))
    console.warn(p, 'p')
    return p.position || initPosition;
  },
  set() { }
})

const timer = ref(null);
const toNextWorkTime = ref('00:00:00');
const toNextRestTime = ref('00:00:00');

const { currentStateKey, nextStateTime } = storeToRefs(useTipsRuntime());

const nextWorkTimeText = computed(() => formatTime(nextStateTime.value));
const nextRestTimeText = computed(() => formatTime(nextStateTime.value));

onMounted(() => {
  timer.value = setInterval(() => {
    toNextRestTime.value = countDown(nextStateTime.value);
    toNextWorkTime.value = countDown(nextStateTime.value);
  }, 1000);
});

onUnmounted(() => {
  clearInterval(timer.value);
});

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

// 写一个倒计时函数，用来计算当前时间距离下次工作时间的时间差，格式是00:00:00
function countDown(time) {
  if (!time) return '00:00:00';
  const now = (new Date()).getTime();
  const diff = (new Date(time)).getTime() - now;
  if (diff < 0) return '00:00:00';
  let h = Math.floor(diff / 1000 / 60 / 60);
  let m = Math.floor((diff / 1000 / 60) % 60);
  let s = Math.floor((diff / 1000) % 60);
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
}

// 把下次切换时间戳格式化为「HH:mm」展示
function formatTime(time) {
  if (!time) return '--:--';
  return new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
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
.item {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  backdrop-filter: blur(6px);
  padding: 12px 24px;
  background: #c5c5c51c;

  .label {
    font-size: 24px;
    color: gray;
  }

  .value {
    font-size: 28px;
    font-weight: 900;
    color: #696969;
  }
}
</style>