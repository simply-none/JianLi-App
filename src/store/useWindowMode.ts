import { computed, onMounted, ref, watch } from "vue";
import { defineStore, storeToRefs } from "pinia";
import { getStore, sendSync, setStore, send, sendMany } from "../utils/common";
import { initPiniaStatus, type defaultField } from "@/utils/store";

export default defineStore("window-mode", () => {
  const showPomodoroMiniWindow = ref();
  const showPomodoroMiniWindowC = computed(() => showPomodoroMiniWindow.value);
  function setShowPomodoroMiniWindow(value: boolean) {
    showPomodoroMiniWindow.value = value;
    setStore("showPomodoroMiniWindow", value);
  }

  watch(showPomodoroMiniWindow, (newValue, oldValue) => {
    if (newValue == true) {
      send("open-new-window", "second");
    } else {
      send("close-new-window", "second");
    }
  });

  // 笔记本小窗口
  const showMiniNotebookWindow = ref();
  const showMiniNotebookWindowC = computed(() => showMiniNotebookWindow.value);
  function setShowMiniNotebookWindow(value: boolean) {
    showMiniNotebookWindow.value = value;
    setStore("showMiniNotebookWindow", value);
  }
  watch(showMiniNotebookWindow, (newValue, oldValue) => {
    if (newValue == true) {
      sendMany("open-new-window", "miniNotebook", {
        width: 800,
        height: 600,
        x: 100,
        y: 100,
      });
    } else {
      send("close-new-window", "miniNotebook");
    }
  });

  // pinia状态初始化
  function init() {
    // 布尔值变量
    const boolVars: defaultField[] = [
      {
        field: "showPomodoroMiniWindow",
        default: false,
        map: showPomodoroMiniWindow,
      },
      {
        field: "showMiniNotebookWindow",
        default: false,
        map: showMiniNotebookWindow,
      },
    ];
    // 数字值变量
    const numberVars: defaultField[] = [];
    // 字符串值变量
    const stringVars: defaultField[] = [];
    // 颜色值变量
    const colorVars: defaultField[] = [];
    // 字体值变量
    const fontVars: defaultField[] = [];

    // 对象值变量
    const objectVars: defaultField[] = [];

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
    showPomodoroMiniWindow,
    showPomodoroMiniWindowC,
    // 方法
    setShowPomodoroMiniWindow,
    // 变量
    showMiniNotebookWindow,
    showMiniNotebookWindowC,
    // 方法
    setShowMiniNotebookWindow,
    // 其他
    $reset,
  };
});
