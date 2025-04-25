<template>
  <div class="home-rest2" @contextmenu="contextmenuFn">
    <el-image :src="computedImg" fit="cover"></el-image>
    <DraggableContainer style="width: 0; height: 0; position: unset;">
      <bigDateTime :data="modeData.bigDateTime" :themetData="modeData.showImage"  @rightClick="e => rightClick(e, 'bigDateTime')" @update="e => updatePosition(e, 'showImage')"></bigDateTime>
    </DraggableContainer>
  </div>
  <styleDrawer ref="styleDrawerRef" :data="styleData" :widget="widgetName" @update="updateDataFn"></styleDrawer>
  <widgetDrawer ref="widgetDrawerRef" :data="widgetData" :widget="widgetName" @update="updateDataFn"></widgetDrawer>
</template>

<script setup>
import { ref, toRaw, watch, computed } from 'vue'
import { storeToRefs } from 'pinia';
import useGlobalSetting from '@/store/useGlobalSetting';
import RestBg from '@/assets/codeBackgroundDefault.png'
import bigDateTime from '@/smallComponents/bigDateTime.vue'
import styleDrawer from '@/components/styleDrawer.vue';
import widgetDrawer from '@/components/widgetDrawer.vue';
import Vue3DraggableResizable, { DraggableContainer } from 'vue3-draggable-resizable'
import 'vue3-draggable-resizable/dist/Vue3DraggableResizable.css'

const widgetDrawerRef = ref()
const styleDrawerRef = ref()
const styleData = ref({})
const widgetData = ref({})
const widgetName = ref('')

const { homeModeC, curStatusC } = storeToRefs(useGlobalSetting());
const { setHomeMode } = useGlobalSetting();
const homeModeCc = ref(JSON.parse(JSON.stringify(homeModeC.value || {})))
const modeData = ref({})

console.log(homeModeC.value, curStatusC.value, 'homeModeC')

watch(() => homeModeC.value[curStatusC.value.value], (n, o) => {
  console.log(n, o, 'homeModeC', curStatusC.value.value)
  homeModeCc.value = JSON.parse(JSON.stringify(homeModeC.value || {}))
  const md = (homeModeCc.value[curStatusC.value.value].mode || {})[homeModeCc.value[curStatusC.value.value].value] || {}
  console.log(md, 'md')
  modeData.value = md
}, { immediate: true, deep: true })

const computedImg = computed(() => {
  if (modeData.value['showImage'] && modeData.value['showImage']['basic'] && modeData.value['showImage']['basic']['backgroundImage']) {
    return 'jlocal:///' + modeData.value['showImage']['basic'].backgroundImage
  }
  return RestBg
})

const contextmenuFn = (event) => {
  if (typeof modeData.value['showImage'] === 'object' && modeData.value['showImage']['basic']) {
    widgetDrawerRef.value.open(modeData.value['showImage']['basic'], 'showImage', 'basic')
    return true;
  }
  widgetDrawerRef.value.open({
    backgroundImage: '',
  }, 'showImage', 'basic')
}

function updatePosition (e, name) {
  updateDataFn({
    el: 'position',
    data: e,
  }, name)
}

function updateDataFn (e, name) {
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

function rightClick (e, name) {
  if (typeof modeData.value[name] === 'object' && modeData.value[name][e.el]) {
    styleDrawerRef.value.open(modeData.value[name][e.el], name, e.el)
    return true;
  }
  styleDrawerRef.value.open(e.data, name, e.el)

}
</script>

<style lang="scss" scoped>
.home-rest2 {
  width: 100%;
  height: 100%;
  position: relative;

  .el-image {
    width: 100%;
    height: 100%;
    position: relative;
    z-index: -1;
  }

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
}
</style>