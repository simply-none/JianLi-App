<template>
  <draggableContainer v-bind="poetComponentPropsCc.position" @update="updateFn">
    <div class="content-show" v-if="showContent && !showContent.error">
      <div class="content-inner" v-if="showContent.author">
        <div class="rhythmic">{{ showContent.rhythmic }}</div>
        <div class="author">{{ showContent.author }}</div>
        <div class="content">
          <div v-for="paragraphs in showContent.paragraphs" :key="paragraphs">
            {{ paragraphs }}
          </div>
        </div>
      </div>
      <div class="content-inner" v-if="showContent.name">
        <div class="author">{{ showContent.name }}</div>
        <div class="content">
          <div>
            {{ showContent.description }}
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
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';

import draggableContainer from '@/components/draggableContainer.vue';
import smallComponentsOps from '@/store/smallComponentsOps';

const smallComponentsOpsStore = smallComponentsOps()
const { setPoetComponentProps } = smallComponentsOpsStore
const { poetComponentPropsC } = storeToRefs(smallComponentsOpsStore);

const poetComponentPropsCc = ref(JSON.parse(JSON.stringify(poetComponentPropsC.value || {})))
watch(() => poetComponentPropsC.value, (n) => {
  poetComponentPropsCc.value = JSON.parse(JSON.stringify(n || {}))
}, {
  immediate: true,
  deep: true,
})
const showContent = ref({ error: true });

function updateFn(position) {
  poetComponentPropsCc.value = {
    ...poetComponentPropsCc.value,
    position,
  }
  setPoetComponentProps(poetComponentPropsCc.value)
}

function toNext() {
  const poetData = window.ipcRenderer.sendSync('poet-data')
  showContent.value = poetData || { error: true }
  console.log('poetData', poetData);
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