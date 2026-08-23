import { ref, computed, onMounted } from 'vue';
import { defineStore } from 'pinia';
import { setStore } from "../utils/common";
import { initPiniaStatus, type defaultField } from "@/utils/store";
// 桥接：番茄钟时间线统一由主进程持有（见 usePomodoroRuntime）。
// 旧组件（home 各主题等）仍引用本 store 的 nextWorkTime/nextRestTime，
// 这里直接从运行时派生，确保永远不会显示「过去的时间」。
import usePomodoroRuntime from "./usePomodoroRuntime";

const useWorkOrRestStore = defineStore('workOrRest', () => {
  // 旧字段仍保留，供 useGlobalSetting 快照/兼容（不再参与时间计算）
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

  // 番茄钟运行时（由 reminder-state-change 事件驱动写入）
  const runtime = usePomodoroRuntime();
  const nextStateTimeC = computed(() => runtime.nextStateTime);

  // 统一返回主进程下发的权威「下次切换」时间；旧组件按 curStatus 自行选择展示其一。
  const formatNext = (t: number | null) =>
    t ? new Date(t).toLocaleString('zh', { hour12: false }) : '--';

  const nextWorkTime = computed(() => formatNext(nextStateTimeC.value))
  const nextRestTime = computed(() => formatNext(nextStateTimeC.value))

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
