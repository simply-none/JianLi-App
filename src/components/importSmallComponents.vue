<template>
  <div class="import-sc" v-if="props.modeName">
    <el-image v-if="!computedBackgroundColorPriority" class="mode-bg" :src="computedImg" fit="cover"></el-image>
    <div class="mode-bg" v-else :style="{
      backgroundColor: computedColor, 
    }"></div>
    <DraggableContainer style="width: 0; height: 0; position: unset;">
      <template v-for="comps in currentSmallComps" :key="comps.name">
        <component :is="comps.comp" :data="modeData[comps.name]" :themetData="modeData[props.modeName]"
          @rightClick="e => rightClick(e, comps.name)" @update="e => updatePosition(e, comps.name)"></component>
      </template>
    </DraggableContainer>
    <styleDrawer ref="styleDrawerRef" @update="updateDataFn"></styleDrawer>
    <widgetDrawer ref="widgetDrawerRef" @update="updateDataFn"></widgetDrawer>
  </div>
</template>

<script setup>
import { ref, toRaw, watch, computed } from 'vue'
import { storeToRefs } from 'pinia';
import useGlobalSetting from '@/store/useGlobalSetting';
import useSmallComponentsOps from '@/store/useSmallComponentsOps';
import RestBg from '@/assets/codeBackgroundDefault.png'

import styleDrawer from '@/components/styleDrawer.vue';
import widgetDrawer from '@/components/widgetDrawer.vue';
import { DraggableContainer } from 'vue3-draggable-resizable'
import 'vue3-draggable-resizable/dist/Vue3DraggableResizable.css'

const props = defineProps({
  // 模式名称
  modeName: {
    type: String,
    default: 'empty',
  },
})

const widgetDrawerRef = ref()
const styleDrawerRef = ref()

const { homeModeC, curStatusC } = storeToRefs(useGlobalSetting());
const { setHomeMode } = useGlobalSetting();
const homeModeCc = ref(JSON.parse(JSON.stringify(homeModeC.value || {})))
const modeData = ref({})

console.log(homeModeC.value, curStatusC.value, 'homeModeC')

const useSmallComponentsOpsStore = useSmallComponentsOps()
const { smallComponentsC, defaultSmallComponentC } = storeToRefs(useSmallComponentsOpsStore);

const currentSmallComps = computed(() => {
  let smallComps = defaultSmallComponentC.value[props.modeName]
  if (modeData.value[props.modeName] && modeData.value[props.modeName]['basic'] && modeData.value[props.modeName]['basic']['smallComps']) {
    smallComps = modeData.value[props.modeName]['basic']['smallComps'] || []
  }
  return smallComps.map(item => {
    return {
      name: item.name,
      comp: toRaw(smallComponentsC.value[item.name]?.comp) || 'div',
    }
  })
})

watch(() => homeModeC.value[curStatusC.value.value], (n, o) => {
  console.log(n, o, 'homeModeC', curStatusC.value.value)
  homeModeCc.value = JSON.parse(JSON.stringify(homeModeC.value || {}))
  const md = (homeModeCc.value[curStatusC.value.value].mode || {})[homeModeCc.value[curStatusC.value.value].value] || {}
  console.log(md, 'md')
  modeData.value = md
}, { immediate: true, deep: true })

const computedBackgroundColorPriority = computed(() => {
  if (modeData.value[props.modeName] && modeData.value[props.modeName]['basic'] && modeData.value[props.modeName]['basic']['backgroundPriority']) {
    return modeData.value[props.modeName]['basic'].backgroundPriority == 1
  } 
  return false
})

const computedImg = computed(() => {
  if (modeData.value[props.modeName] && modeData.value[props.modeName]['basic'] && modeData.value[props.modeName]['basic']['backgroundImage']) {
    return 'jlocal:///' + modeData.value[props.modeName]['basic'].backgroundImage
  }
  return RestBg
})

const computedColor = computed(() => {
  if (modeData.value[props.modeName] && modeData.value[props.modeName]['basic'] && modeData.value[props.modeName]['basic']['backgroundColor']) {
    return modeData.value[props.modeName]['basic'].backgroundColor
  } 
  return '#000'
})

const contextmenuFn = (event) => {
  if (typeof modeData.value[props.modeName] === 'object' && modeData.value[props.modeName]['basic']) {
    widgetDrawerRef.value.open(modeData.value[props.modeName]['basic'], props.modeName, 'basic')
    return true;
  }
  widgetDrawerRef.value.open({}, props.modeName, 'basic')
}

function updatePosition(e, name) {
  updateDataFn({
    el: 'position',
    data: e,
  }, name)
}

function updateDataFn(e, name) {
  console.log(e, name, 'updateDataFn')
  // modeData.value[name]判断是否是对象
  if (typeof modeData.value[name] === 'object') {
    modeData.value[name][e.el] = e.data
  } else {
    modeData.value[name] = {
      [e.el]: toRaw(e.data),
    }
  }
  if (!homeModeCc.value[curStatusC.value.value].mode) {
    homeModeCc.value[curStatusC.value.value].mode = {}
  }
  homeModeCc.value[curStatusC.value.value].mode[homeModeCc.value.value] = modeData.value
  console.log(homeModeCc.value[curStatusC.value.value].mode, homeModeCc.value[curStatusC.value.value].value, name, 'ces es ces')

  if (!homeModeCc.value[curStatusC.value.value].mode[homeModeCc.value[curStatusC.value.value].value]) {
    homeModeCc.value[curStatusC.value.value].mode[homeModeCc.value[curStatusC.value.value].value] = {};
  }
  if (!homeModeCc.value[curStatusC.value.value].mode[homeModeCc.value[curStatusC.value.value].value][name]) {
    homeModeCc.value[curStatusC.value.value].mode[homeModeCc.value[curStatusC.value.value].value][name] = {};
  }
  delete homeModeCc.value[curStatusC.value.value].mode[homeModeCc.value[curStatusC.value.value].value][name].undefined;
  delete homeModeCc.value[curStatusC.value.value].mode.undefined;
  console.warn(toRaw(homeModeCc.value), 'ces')
  setHomeMode(toRaw(homeModeCc.value))
}

function rightClick(e, name) {
  if (typeof modeData.value[name] === 'object' && modeData.value[name][e.el]) {
    styleDrawerRef.value.open(modeData.value[name][e.el], name, e.el)
    return true;
  }
  styleDrawerRef.value.open(e.data, name, e.el)

}

defineExpose({
  contextmenuFn,
})
</script>

<style lang="scss" scoped>
.import-sc {
  width: 100%;
  height: 100%;
}

.mode-bg {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: -1;
}
</style>