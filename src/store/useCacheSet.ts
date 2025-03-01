import { computed, onMounted, ref } from "vue";
import type { Ref } from "vue";
import { defineStore, storeToRefs } from "pinia";
import { getStore, sendSync, setStore } from "../utils/common";

type defaultField = {
  field: string,
  default: any,
  map: Ref<any>,
  initFn?: Function,
}

export interface CommonOps {
  label?: string;
  value?: string;
}

export type CommonObj = {
  [key: string]: any
}

export default defineStore("cache-set", () => {
  // 文件存储目录
  const fileCachePath = ref()
  const fileCachePathC = computed(() => fileCachePath.value)
  function setFileCachePath(value: string) {
    fileCachePath.value = value;
    setStore("fileCachePath", value); 
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
      { field: 'fileCachePath', default: '', map: fileCachePath },
    ]
    // 颜色值变量
    const colorVars: defaultField[] = [
    ]
    // 字体值变量
    const fontVars: defaultField[] = [
    ]

    // 对象值变量
    const objectVars: defaultField[] = [
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
    allVars.forEach((item) => {
      const { field, default: defaultValue, map } = item;
      if (!item.initFn) {
        assignDefaultValue(field, defaultValue, map);
      } else {
        item.initFn(field, defaultValue, map)
      }
      
    })
  }

  // 变量默认值赋值操作：
  // 1. 先从store中获取数据
  // 2. 如果store中没有数据，则从默认值中获取数据
  // 3. 将数据赋值给该变量
  function assignDefaultValue<T>(key: string, defaultValue: T, map: Ref<any>): void {
    const storeValue = getStore(key);
    map.value = storeValue || defaultValue;
    if (storeValue === undefined) {
      setStore(key, defaultValue);
    }
  }

  function $reset() {
    init()
  }

  onMounted(() => {
    init()
  })

  return {
    // 变量
    fileCachePath,
    fileCachePathC,
    // 方法
    setFileCachePath,
    // 其他 
    $reset,
  };
});