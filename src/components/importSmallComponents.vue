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

const { homeModeC, curStatusC, isIdleNow } = storeToRefs(useGlobalSetting());
const { setHomeMode } = useGlobalSetting();
const homeModeCc = ref(JSON.parse(JSON.stringify(homeModeC.value || {})))
const modeData = ref({})
// 空闲（免打扰）时段内改用 homeMode 的 idle 皮肤方案；否则沿用当前番茄钟状态（work/rest/lock/screen）
const activeHomeModeKey = computed(() => isIdleNow.value ? 'idle' : (curStatusC.value?.value || 'work'));

// 新建缺省 homeMode 条目的默认值（与 store 中 originHomeModeOps[0] 对齐）
const originHomeModeValue = (homeModeC.value && Object.values(homeModeC.value)[0]?.value) || '1'

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

watch(() => homeModeC.value[activeHomeModeKey.value] || {}, (n, o) => {
  homeModeCc.value = JSON.parse(JSON.stringify(homeModeC.value || {}))
  const curKey = activeHomeModeKey.value
  const curEntry = homeModeCc.value[curKey] || {}
  // 状态 key 缺失时安全降级为空布局，不崩
  const md = (curEntry.mode || {})[curEntry.value] || {}
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
  // 确保当前状态 key 在 homeModeCc 中存在（双保险，理论上已被 alignHomeModeKeys 补齐）
  const curKey = activeHomeModeKey.value
  if (!homeModeCc.value[curKey]) {
    homeModeCc.value[curKey] = { value: originHomeModeValue, mode: {} }
  }
  const curEntry = homeModeCc.value[curKey]
  // modeData.value[name]判断是否是对象
  if (typeof modeData.value[name] === 'object') {
    modeData.value[name][e.el] = e.data
  } else {
    modeData.value[name] = {
      [e.el]: toRaw(e.data),
    }
  }
  if (!curEntry.mode) {
    curEntry.mode = {}
  }
  curEntry.mode[curEntry.value] = modeData.value

  if (!curEntry.mode[curEntry.value]) {
    curEntry.mode[curEntry.value] = {};
  }
  if (!curEntry.mode[curEntry.value][name]) {
    curEntry.mode[curEntry.value][name] = {};
  }
  delete curEntry.mode[curEntry.value][name].undefined;
  delete homeModeCc.value[curKey].mode.undefined;
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