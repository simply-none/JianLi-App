<template>
  <draggableContainer>
    <div class="item" v-if="curStatusC.value === 'rest'">
      <div class="label">
        下次工作时间
      </div>
      <div class="value">
        {{ nextWorkTime }}
      </div>
      <div class="value">
        倒计时：{{ toNextWorkTime }}
      </div>
    </div>
    <div class="item" v-else-if="curStatusC.value === 'work'">
      <div class="label">
        下次休息时间
      </div>
      <div class="value">
        {{ nextRestTime }}
      </div>
      <div class="value">
        倒计时：{{ toNextRestTime }}
      </div>
    </div>
  </draggableContainer>

</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';

import useGlobalSetting from '@/store/useGlobalSetting';
import useWorkOrRestStore from '@/store/useWorkOrReset';

import draggableContainer from '@/components/draggableContainer.vue';
import smallComponentsOps from '@/store/smallComponentsOps';

const smallComponentsOpsStore = smallComponentsOps()
const { setDistanceToNextStatusComponentProps } = smallComponentsOpsStore
const { distanceToNextStatusComponentPropsC } = storeToRefs(smallComponentsOpsStore);

const distanceToNextStatusComponentPropsCc = ref(JSON.parse(JSON.stringify(distanceToNextStatusComponentPropsC.value || {})))
watch(() => distanceToNextStatusComponentPropsC.value, (n) => {
  distanceToNextStatusComponentPropsCc.value = JSON.parse(JSON.stringify(n || {}))
}, {
  immediate: true,
  deep: true,
})

const timer = ref(null);
const toNextWorkTime = ref('00:00:00');
const toNextRestTime = ref('00:00:00');

const {
  nextRestTime,
  nextWorkTime,
} = storeToRefs(useWorkOrRestStore());
const { homeModeOpsC, curStatusC } = storeToRefs(useGlobalSetting());

onMounted(() => {
  timer.value = setInterval(() => {
    if (curStatusC.value.value === 'work') {
      console.log(countDown(nextRestTime.value), 'countDown', nextRestTime.value)
      toNextRestTime.value = countDown(nextRestTime.value);
    } else if (curStatusC.value.value === 'rest') {
      console.log(countDown(nextWorkTime.value), 'countDown', nextWorkTime.value)
      toNextWorkTime.value = countDown(nextWorkTime.value);
    }
  }, 1000);
});

onUnmounted(() => {
  clearInterval(timer.value);
});

function updateFn(position) {
  distanceToNextStatusComponentPropsCc.value = {
    ...distanceToNextStatusComponentPropsCc.value,
    position,
  }
  setDistanceToNextStatusComponentProps(distanceToNextStatusComponentPropsCc.value)
}

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