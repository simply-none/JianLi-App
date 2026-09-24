import { computed, onMounted, ref } from "vue";
import { defineStore, storeToRefs } from "pinia";
import { getStore, sendSync, setStoreAsync } from "../utils/common";
import { initPiniaStatus, type defaultField } from "@/utils/store";

export default defineStore("cache-set", () => {
  // 文件存储目录
  const fileCachePath = ref()
  const fileCachePathC = computed(() => fileCachePath.value)
  function setFileCachePath(value: string) {
    fileCachePath.value = value;
    setStoreAsync("fileCachePath", value); 
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
    fileCachePath,
    fileCachePathC,
    // 方法
    setFileCachePath,
    // 其他 
    $reset,
  };
});