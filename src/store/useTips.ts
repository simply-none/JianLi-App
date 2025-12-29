import { computed, onMounted, onUnmounted, ref, toRaw, unref } from "vue";
import { defineStore, storeToRefs } from "pinia";
import { getStore, sendSync, setStore } from "../utils/common";
import { initPiniaStatus, type defaultField } from "@/utils/store";
import { ElMessage } from "element-plus";
import { sysNotify, appNotify } from "@/utils/notify";

export default defineStore("tips", () => {
  // 提醒类型: 喝水、走动、闭眼、上厕所以及自定义提醒类型，属性包括：提醒时间间隔、提醒类型等
  const tipType = ref<ObjectType[]>([])
  const tipTypeC = computed(() => tipType.value)
  function setTipType(val: ObjectType | ObjectType[]) {
    let value = toRaw(unref(val))
    console.log(value, 'setTipType')
    if (Array.isArray(value)) {
      tipType.value = value
    } else {
      // 判断是否已经存在，如果存在则不添加
      let find = tipType.value.findIndex(item => item.type == value.type)
      if (find != -1) {
        tipType.value[find] = value
      } else {
        tipType.value.push(value)
      }
    }
    let newValue = toRaw(unref(tipType))
    console.log(newValue, 'newValue setTipType')
    setStore("tipType", newValue);
  }

  // 提醒类型选项
  const tipTypeOps = ref<ObjectType[]>([])
  const tipTypeOpsC = computed(() => tipTypeOps.value)
  function setTipTypeOps(val: ObjectType | ObjectType[]) {
    let value = toRaw(unref(val))
    if (Array.isArray(value)) {
      tipTypeOps.value = value
    } else {
      // 判断是否已经存在，如果存在则不添加
      let find = tipTypeOps.value.findIndex(item => item.label == value.label)
      if (find != -1) {
        tipTypeOps.value[find] = value
      } else {
        tipTypeOps.value.push(value)
      }
    }
    let newValue = toRaw(unref(tipTypeOps))
    setStore("tipTypeOps", newValue);
  }

  // pinia状态初始化
  function init() {
    // 布尔值变量
    const boolVars: defaultField[] = [
    ]
    // 数字值变量
    const numberVars: defaultField[] = [
    ]
    // 字符串值变量
    const stringVars: defaultField[] = [
    ]
    // 颜色值变量
    const colorVars: defaultField[] = [
    ]
    // 字体值变量
    const fontVars: defaultField[] = [
    ]

    // 对象值变量
    const objectVars: defaultField[] = [
      { field: 'tipType', default: [], map: tipType },
      {
        field: 'tipTypeOps',
        default: [
          // 喝水
          { label: '喝水', value: 'drink' },
          // 起身走动
          { label: '走动', value: 'walk' },
          // 闭眼
          { label: '闭眼', value: 'closeEyes' },
          // 上厕所
          { label: '上厕所', value: 'toilet' },
        ],
        map: tipTypeOps
      },
    ]

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
    console.error('usetips')

    initPiniaStatus(allVars);
  }

  let nextTime = ref<ObjectType>({})
  const setNextTime = (type?: string, val?: ObjectType) => {
    if (!type) {
      nextTime.value = {}
      return;
    }
    nextTime.value[type] = val
  }
  const getType = (type: string) => {
    return tipTypeOpsC.value.find(i => i.value == type)?.label
  }
  const jobStartTipFn = (event: Electron.IpcRendererEvent, arg: any) => {
    console.log(arg, 'job-end-tip')
    let nt = arg.time + arg.gap
    nextTime.value[arg.type] = {
      type: arg.type,
      nextTime: new Date(nt).toLocaleString(),
    }
  }
  const jobEndTipFn = (event: Electron.IpcRendererEvent, arg: any) => {
    console.log(arg, 'job-end-tip')
    let nextTime = arg.time + arg.gap
    ElMessage({
      message: `【${getType(arg.type)}】提醒，下次将在 ${new Date(nextTime).toLocaleString()} 执行`,
      type: 'success',
      duration: 1000 * 60,
    })
    sysNotify(getType(arg.type) + '提醒', `【${getType(arg.type)}】提醒，下次将在 ${new Date(nextTime).toLocaleString()} 执行`, '')
  }

  function $reset() {
    init()
  }

  onMounted(() => {
    init()
    window.ipcRenderer.on('job-start-tip', jobStartTipFn)
    window.ipcRenderer.on('job-end-tip', jobEndTipFn)
  })

  onUnmounted(() => {
    window.ipcRenderer.off('job-start-tip', jobStartTipFn)
    window.ipcRenderer.off('job-end-tip', jobEndTipFn)
  })

  return {
    // 变量
    tipType,
    tipTypeC,
    tipTypeOps,
    tipTypeOpsC,
    nextTime,
    // 方法
    setTipType,
    setTipTypeOps,
    setNextTime,
    // 其他 
    $reset,
  };
});