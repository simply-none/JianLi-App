import { computed, onMounted, ref, watch, toRaw } from "vue";
import { defineStore, storeToRefs } from "pinia";
import { getStore, sendSync, setStore, send, sendMany, getWindowConfig } from "../utils/common";
import { initPiniaStatus, type defaultField } from "@/utils/store";

export default defineStore("window-mode", () => {
  const showPomodoroMiniWindow = ref();
  const showPomodoroMiniWindowC = computed(() => showPomodoroMiniWindow.value);
  function setShowPomodoroMiniWindow(value: boolean) {
    showPomodoroMiniWindow.value = value;
    setStore("showPomodoroMiniWindow", value);
  }

  const pomodoroMiniWindowConfig = ref({
    position: 'bottom-right',
    width: 108,
    height: 81,
    gap: 30,
    x: 0,
    y: 0,
    skin: 'white',
    layout: 'default',
  });

  watch(showPomodoroMiniWindow, (newValue) => {
    if (newValue == true) {
      console.log("打开番茄钟小窗口", pomodoroMiniWindowConfig.value);
      send("open-new-window", "pomodoro", pomodoroMiniWindowConfig.value);
    } else {
      send("close-new-window", "pomodoro");
    }
  });

  const showMiniNotebookWindow = ref();
  const showMiniNotebookWindowC = computed(() => showMiniNotebookWindow.value);
  function setShowMiniNotebookWindow(value: boolean) {
    showMiniNotebookWindow.value = value;
    setStore("showMiniNotebookWindow", value);
  }

  const miniNotebookWindowConfig = ref({
    position: 'bottom-right',
    width: 800,
    height: 600,
    gap: 30,
    x: 0,
    y: 0,
  });

  watch(showMiniNotebookWindow, (newValue) => {
    if (newValue == true) {
      sendMany("open-new-window", "notebook", miniNotebookWindowConfig.value);
    } else {
      send("close-new-window", "notebook");
    }
  });

  watch(pomodoroMiniWindowConfig, (newVal) => {
    send('sync-data-to-other-window', {
      pomodoroMiniWindowConfig: toRaw(newVal),
    });
  }, { deep: true });

  function init() {
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

    const migrateOldConfig = () => {
      const oldPomodoroConfig = getStore("pomodoroMiniWindowConfig");
      if (oldPomodoroConfig) {
        setStore("window-mode:pomodoro", oldPomodoroConfig);
      }
      const oldNotebookConfig = getStore("miniNotebookWindowConfig");
      if (oldNotebookConfig) {
        setStore("window-mode:notebook", oldNotebookConfig);
      }
    };

    migrateOldConfig();

    const objectVars: defaultField[] = [
      {
        field: "window-mode:pomodoro",
        default: {
          position: 'bottom-right',
          width: 108,
          height: 81,
          gap: 30,
          x: 0,
          y: 0,
          skin: 'white',
          layout: 'default',
        },
        map: pomodoroMiniWindowConfig,
      },
      {
        field: "window-mode:notebook",
        default: {
          position: 'bottom-right',
          width: 800,
          height: 600,
          gap: 30,
          x: 0,
          y: 0,
        },
        map: miniNotebookWindowConfig,
      },
    ];

    const allVars: defaultField[] = [
      ...boolVars,
      ...objectVars,
    ];

    initPiniaStatus(allVars);

    window.ipcRenderer?.on('sync-data-to-other-window', (_event: any, arg: any) => {
      if (arg?.pomodoroMiniWindowConfig) {
        const newConfig = arg.pomodoroMiniWindowConfig;
        const currentConfig = pomodoroMiniWindowConfig.value;
        if (JSON.stringify(newConfig) !== JSON.stringify(currentConfig)) {
          pomodoroMiniWindowConfig.value = { ...currentConfig, ...newConfig };
        }
      }
    });
  }

  function $reset() {
    init();
  }

  onMounted(() => {
    init();
  });

  return {
    showPomodoroMiniWindow,
    showPomodoroMiniWindowC,
    setShowPomodoroMiniWindow,
    pomodoroMiniWindowConfig,
    showMiniNotebookWindow,
    showMiniNotebookWindowC,
    setShowMiniNotebookWindow,
    miniNotebookWindowConfig,
    $reset,
  };
});
