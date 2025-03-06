import { computed, onMounted, ref, toRaw } from "vue";
import { defineStore, storeToRefs } from "pinia";
import { getStore, sendSync, setStore } from "../utils/common";
import { initPiniaStatus, type defaultField } from "@/utils/store";

export default defineStore("resource-manage", () => {
  // 图片资源对象
  const imageResource = ref();
  const imageResourceC = computed(() => imageResource.value);

  function setImageResource(value: ObjectType) {
    // 新增资源，并更新到本地存储
    imageResource.value.push(value);
    // 保存资源到系统中
    sendSync("save-file", {
      type: "image",
      resource: value,
    });
    setStore("imageResource", imageResource.value);
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
    
    // 方法

    // 其他 
    $reset,
  };
});