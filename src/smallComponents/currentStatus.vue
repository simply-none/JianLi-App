<template>
  <draggableContainer v-bind="computedPosition" @update="updateFn">
    <div data-el="1" class="item" @contextmenu.stop="contextmenuFn">
      <div class="label">
        当前状态
      </div>
      <div class="value">
        {{ currentEnabled ? curStatusC.label : '番茄钟已关闭' }}
      </div>
    </div>
  </draggableContainer>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted, toRaw } from 'vue';
import { storeToRefs } from 'pinia';

import useGlobalSetting from '@/store/useGlobalSetting';
import useNewReminder from '@/store/useNewReminder';

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

const { homeModeOpsC, curStatusC } = storeToRefs(useGlobalSetting());
// 番茄钟总开关：enabled=1 开启时显示当前状态；enabled=0 关闭时显示「番茄钟已关闭」
const reminderStore = useNewReminder();
const { remindersC } = storeToRefs(reminderStore);
const currentEnabled = computed(() => {
  const p = remindersC.value.find((r) => r.id === 'pomodoro');
  return p ? p.enabled === 1 : true;
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