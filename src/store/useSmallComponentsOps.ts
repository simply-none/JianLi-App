import { computed, onMounted, ref, watch } from "vue";
import { defineStore, storeToRefs } from "pinia";

import bigDateTime from '@/smallComponents/bigDateTime.vue'
import currentStatus from '@/smallComponents/currentStatus.vue';
import distanceToNextStatus from '@/smallComponents/distanceToNextStatus.vue';
import poet from '@/smallComponents/poet.vue';
import tips from '@/smallComponents/tips.vue'

import { getStore, sendSync, setStore, send } from "../utils/common";
import { initPiniaStatus, type defaultField } from "@/utils/store";

// 小组件 选项/属性
export default defineStore("small-components-ops", () => {
  // 组件列表选项
  const smallComponents = ref({
    bigDateTime: {
      name: 'bigDateTime',
      comp: bigDateTime,
      label: '大日期时间',
    },
    currentStatus: {
      name: 'currentStatus',
      comp: currentStatus,
      label: '当前状态',
    },
    distanceToNextStatus: {
      name: 'distanceToNextStatus',
      comp: distanceToNextStatus,
      label: '距离下次状态切换',
    },
    poet: {
      name: 'poet',
      comp: poet,
      label: '古诗',
    },
    tips: {
      name: 'tips',
      comp: tips,
      label: '事件提醒'
    }
  })
  const smallComponentsC = computed(() => smallComponents.value);

  // 模式的默认组件
  const defaultSmallComponent = ref({
    // 空模式
    empty: [],
    showImage: [
      { name: 'bigDateTime' },
    ],
    translucentPoemDisplay: [
      { name: 'tips' },
      { name: 'poet' },
      { name: 'currentStatus' },
      { name: 'distanceToNextStatus' }, 
    ],
    custom: [],
  });
  const defaultSmallComponentC = computed(() => defaultSmallComponent.value);

  // 古诗小组件 属性
  const poetComponentProps = ref();
  const poetComponentPropsC = computed(() => poetComponentProps.value);
  function setPoetComponentProps(value: ObjectType) {
    poetComponentProps.value = value;
    setStore("poetComponentProps", value);
  }

  // 当前状态小组件 属性
  const currentStatusComponentProps = ref();
  const currentStatusComponentPropsC = computed(
    () => currentStatusComponentProps.value
  );
  function setCurrentStatusComponentProps(value: ObjectType) {
    currentStatusComponentProps.value = value;
    setStore("currentStatusComponentProps", value);
  }

  // 距离下次状态切换的时间小组件 属性
  const distanceToNextStatusComponentProps = ref();
  const distanceToNextStatusComponentPropsC = computed(
    () => distanceToNextStatusComponentProps.value
  );
  function setDistanceToNextStatusComponentProps(value: ObjectType) {
    distanceToNextStatusComponentProps.value = value;
    setStore("distanceToNextStatusComponentProps", value);
  }

  // 大日期时间小组件 属性
  const largeDateTimeComponentProps = ref();
  const largeDateTimeComponentPropsC = computed(
    () => largeDateTimeComponentProps.value
  );
  function setLargeDateTimeComponentProps(value: ObjectType) {
    largeDateTimeComponentProps.value = value;
    setStore("largeDateTimeComponentProps", value);
  }

  // pinia状态初始化
  function init() {
    // 布尔值变量
    const boolVars: defaultField[] = [];
    // 数字值变量
    const numberVars: defaultField[] = [];
    // 字符串值变量
    const stringVars: defaultField[] = [];
    // 颜色值变量
    const colorVars: defaultField[] = [];
    // 字体值变量
    const fontVars: defaultField[] = [];

    // 对象值变量
    const objectVars: defaultField[] = [
      {
        field: "poetComponentProps",
        default: {
          position: {
            x: 100,
            y: 100,
            w: 300,
            h: 300,
          },
        },
        map: poetComponentProps,
      },
      {
        field: "currentStatusComponentProps",
        default: {
          position: {
            x: 100,
            y: 100,
            w: 300,
            h: 300,
          },
        },
        map: currentStatusComponentProps,
      },
      {
        field: "distanceToNextStatusComponentProps",
        default: {
          position: {
            x: 100,
            y: 100,
            w: 300,
            h: 300,
          },
        },
        map: distanceToNextStatusComponentProps,
      },
      {
        field: "largeDateTimeComponentProps",
        default: {
          position: {
            x: 100,
            y: 100,
            w: 300,
            h: 300,
          },
        },
        map: largeDateTimeComponentProps,
      },
    ];

    // 所有的变量集合
    const allVars: defaultField[] = [
      ...boolVars,
      ...numberVars,
      ...stringVars,
      ...colorVars,
      ...fontVars,
      ...objectVars,
    ];

    // 默认值赋值
    initPiniaStatus(allVars);
  }

  function $reset() {
    init();
  }

  onMounted(() => {
    init();
  });

  return {
    // 变量
    poetComponentProps,
    poetComponentPropsC,
    currentStatusComponentProps,
    currentStatusComponentPropsC,
    distanceToNextStatusComponentProps,
    distanceToNextStatusComponentPropsC,
    largeDateTimeComponentProps,
    largeDateTimeComponentPropsC,
    smallComponents,
    smallComponentsC,
    defaultSmallComponent,
    defaultSmallComponentC,
    // 方法
    setPoetComponentProps,
    setCurrentStatusComponentProps,
    setDistanceToNextStatusComponentProps,
    setLargeDateTimeComponentProps,
    // 其他
    $reset,
  };
});
