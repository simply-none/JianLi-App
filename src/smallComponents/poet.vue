<template>
  <draggableContainer v-bind="computedPosition" @update="updateFn">
    <div class="content-show" v-if="showContent && !showContent.error" @contextmenu.stop="contextmenuFn" data-el="1">
      <div class="content-inner" v-if="showContent.author" data-el="2">
        <div class="rhythmic">{{ showContent.rhythmic }}</div>
        <div class="author">{{ showContent.author }}</div>
        <div class="content">
          <div v-for="paragraphs in showContent.paragraphs" :key="paragraphs">
            {{ paragraphs }}
          </div>
        </div>
      </div>
      <div class="content-inner" v-if="showContent.name" data-el="3">
        <div class="author">{{ showContent.name }}</div>
        <div class="content">
          <div>
            {{ showContent.description || showContent.long_desc || '' }}
          </div>
        </div>
      </div>
      <div class="content-toggle">
        <el-button type="primary" @click="toNext">下一个</el-button>
      </div>
    </div>
  </draggableContainer>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted, toRaw } from 'vue';
import { storeToRefs } from 'pinia';

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

const showContent = ref({ error: true });

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

function toNext() {
  const poetData = window.ipcRenderer.sendSync('poet-data')
  showContent.value = poetData || { error: true }
  console.log('poetData', poetData);
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

onMounted(() => {
  toNext()
})

</script>

<style lang="scss" scoped>
.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-height: 160px;
  padding: 12px 24px;
}

.content-show {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.content-toggle {
  text-align: center;
  margin: 20px;

  .el-button {
    backdrop-filter: blur(6px);
    color: #696969;
    background: #d9d9d9;
    border-color: #cfcfcf;
  }
}

.content-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  backdrop-filter: blur(6px);
  overflow: auto;
  background: #c5c5c51c;

  /*隐藏垂直滚动条*/
  &::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
}
</style>