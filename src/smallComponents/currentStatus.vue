<template>
  <draggableContainer v-bind="currentStatusComponentPropsCc.position" @update="updateFn">
    <div class="item">
      <div class="label">
        当前状态
      </div>
      <div class="value">
        {{ curStatusC.label }}
      </div>
    </div>
  </draggableContainer>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';

import useGlobalSetting from '@/store/useGlobalSetting';

import draggableContainer from '@/components/draggableContainer.vue';
import smallComponentsOps from '@/store/smallComponentsOps';

const { homeModeOpsC, curStatusC } = storeToRefs(useGlobalSetting());
const smallComponentsOpsStore = smallComponentsOps()
const { setCurrentStatusComponentProps } = smallComponentsOpsStore
const { currentStatusComponentPropsC } = storeToRefs(smallComponentsOpsStore);

const currentStatusComponentPropsCc = ref(JSON.parse(JSON.stringify(currentStatusComponentPropsC.value || {})))
watch(() => currentStatusComponentPropsC.value, (n) => {
  currentStatusComponentPropsCc.value = JSON.parse(JSON.stringify(n || {}))
}, {
  immediate: true,
  deep: true,
})

function updateFn(position) {
  currentStatusComponentPropsCc.value = {
    ...currentStatusComponentPropsCc.value,
    position,
  }
  setCurrentStatusComponentProps(currentStatusComponentPropsCc.value)
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