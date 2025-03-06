import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { storeToRefs, defineStore } from 'pinia';
import { getStore, sendSync, setStore } from "../utils/common";
import { initPiniaStatus, type defaultField } from "@/utils/store";

const useWorkOrRestStore = defineStore('workOrRest', () => {
  const closeWorkTime = ref()
  const startWorkTime = ref();
  const workTimeGap = ref();
  const restTimeGap = ref();
  const workTimeGapUnit = ref();
  const restTimeGapUnit = ref();
  // 获取上述6个变量的getters
  const closeWorkTimeC = computed(() => closeWorkTime.value)
  const startWorkTimeC = computed(() => startWorkTime.value)
  const workTimeGapC = computed(() => workTimeGap.value)
  const restTimeGapC = computed(() => restTimeGap.value)
  const workTimeGapUnitC = computed(() => workTimeGapUnit.value)
  const restTimeGapUnitC = computed(() => restTimeGapUnit.value)
  // 计算式
  const nextWorkTime = computed(() => {
    let next = 0
    if (startWorkTimeC.value >= closeWorkTimeC.value) {
      // 当前正在工作
      next = Number(startWorkTimeC.value) + Number(workTimeGapC.value) * Number(workTimeGapUnitC.value) + Number(restTimeGapC.value) * Number(restTimeGapUnitC.value)
    } else {
      // 当前正在休息
      next = Number(closeWorkTimeC.value) + Number(restTimeGapC.value) * Number(restTimeGapUnitC.value)
    }
    return new Date(Number(next)).toLocaleString('zh', {
      hour12: false,
    })
  })

  const nextRestTime = computed(() => {
    let next = 0
    if (startWorkTimeC.value >= closeWorkTimeC.value) {
      // 当前正在工作
      next = Number(startWorkTimeC.value) + Number(workTimeGapC.value) * Number(workTimeGapUnitC.value)
    } else {
      // 当前正在休息
      next = Number(closeWorkTimeC.value) + Number(restTimeGapC.value) * Number(restTimeGapUnitC.value) + Number(workTimeGapC.value) * Number(workTimeGapUnitC.value)
    }
    return new Date(Number(next)).toLocaleString('zh', {
      hour12: false,
    })
  })

  // 修改变量
  function setCloseWorkTime(value: number) {
    closeWorkTime.value = value;
    setStore("closeWorkTime", value); 
  }
  function setStartWorkTime(value: number) {
    startWorkTime.value = value;
    setStore("startWorkTime", value); 
  }

  function setWorkTimeGap(value: number) {
    workTimeGap.value = value;
    setStore("workTimeGap", value);  
  }
  function setRestTimeGap(value: number) {
    restTimeGap.value = value;
    setStore("restTimeGap", value); 
  }
  function setWorkTimeGapUnit(value: number) {
    workTimeGapUnit.value = value;
    setStore("workTimeGapUnit", value); 
  }
  function setRestTimeGapUnit(value: number) {
    restTimeGapUnit.value = value;
    setStore("restTimeGapUnit", value); 
  }


  // pinia状态初始化
  function init() {
    // 布尔值变量
    const boolVars: defaultField[] = []
    // 数字值变量
    const numberVars = [
      { field: 'closeWorkTime', default: Date.now(), map: closeWorkTime },
      { field: 'startWorkTime', default: Date.now(), map: startWorkTime },
      { field: 'workTimeGap', default: 35, map: workTimeGap },
      { field: 'restTimeGap', default: 5, map: restTimeGap },
      { field: 'workTimeGapUnit', default: 60 * 1000, map: workTimeGapUnit },
      { field:'restTimeGapUnit', default: 60 * 1000, map: restTimeGapUnit },
    ]
    // 字符串值变量
    const stringVars: defaultField[] = []
    // 颜色值变量
    const colorVars: defaultField[] = []
    // 字体值变量
    const fontVars: defaultField[] = []
    // 对象值变量
    const objectVars: defaultField[] = []

    // 所有的变量集合
    const allVars: defaultField[] = [
      ...boolVars,
      ...numberVars,
      ...stringVars,
      ...colorVars,
      ...fontVars,
      ...objectVars,
    ]

    // 默认值赋值
    initPiniaStatus(allVars);
  }

  function $reset() {
    init()
  }

  onMounted(() => {
    init()
  })

  return {
    // state
    workTimeGap,
    restTimeGap,
    workTimeGapUnit,
    restTimeGapUnit,
    closeWorkTime,
    startWorkTime,
    // 计算式
    nextWorkTime,
    nextRestTime,
    // actions
    setWorkTimeGap,
    setRestTimeGap,
    setWorkTimeGapUnit,
    setRestTimeGapUnit,
    setCloseWorkTime,
    setStartWorkTime,
    // getters
    workTimeGapC,
    restTimeGapC,
    workTimeGapUnitC,
    restTimeGapUnitC,
    closeWorkTimeC,
    startWorkTimeC,

  }
})

export default useWorkOrRestStore
