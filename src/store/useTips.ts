import { computed, onMounted, ref, toRaw, unref } from "vue";
import { defineStore, storeToRefs } from "pinia";
import { getStore, sendSync, setStore } from "../utils/common";
import { initPiniaStatus, type defaultField } from "@/utils/store";

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

  function $reset() {
    init()
  }

  onMounted(() => {
    init()
  })

  return {
    // 变量
    tipType,
    tipTypeC,
    tipTypeOps,
    tipTypeOpsC,
    // 方法
    setTipType,
    setTipTypeOps,
    // 其他 
    $reset,
  };
});