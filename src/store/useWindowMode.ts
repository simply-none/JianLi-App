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

  const showQuickNoteWindow = ref();
  const showQuickNoteWindowC = computed(() => showQuickNoteWindow.value);
  function setShowQuickNoteWindow(value: boolean) {
    showQuickNoteWindow.value = value;
    setStore("showQuickNoteWindow", value);
  }

  const quickNoteWindowConfig = ref({
    position: 'bottom-right',
    width: 600,
    height: 400,
    gap: 30,
    x: 0,
    y: 0,
    skin: 'white',
    layout: 'minimal',
  });

  watch(showQuickNoteWindow, (newValue) => {
    if (newValue == true) {
      console.log("打开快速记录小窗口", quickNoteWindowConfig.value);
      send("open-new-window", "quickNote", quickNoteWindowConfig.value);
    } else {
      send("close-new-window", "quickNote");
    }
  });

  const showTodoWindow = ref();
  const showTodoWindowC = computed(() => showTodoWindow.value);
  function setShowTodoWindow(value: boolean) {
    showTodoWindow.value = value;
    setStore("showTodoWindow", value);
  }

  const todoWindowConfig = ref({
    position: 'bottom-right',
    width: 400,
    height: 500,
    gap: 30,
    x: 0,
    y: 0,
    skin: 'white',
  });

  watch(showTodoWindow, (newValue) => {
    if (newValue == true) {
      console.log("打开待办小窗口", todoWindowConfig.value);
      send("open-new-window", "todoMiniWindow", todoWindowConfig.value);
    } else {
      send("close-new-window", "todoMiniWindow");
    }
  });

  const showThemeConversationMiniWindow = ref();
  const showThemeConversationMiniWindowC = computed(() => showThemeConversationMiniWindow.value);
  function setShowThemeConversationMiniWindow(value: boolean) {
    showThemeConversationMiniWindow.value = value;
    setStore("showThemeConversationMiniWindow", value);
  }

  const themeConversationMiniWindowConfig = ref({
    position: 'bottom-right',
    width: 600,
    height: 700,
    gap: 30,
    x: 0,
    y: 0,
    skin: 'white',
  });

  watch(showThemeConversationMiniWindow, (newValue) => {
    if (newValue == true) {
      console.log("打开主题对话小窗口", themeConversationMiniWindowConfig.value);
      send("open-new-window", "themeConversationMini", themeConversationMiniWindowConfig.value);
    } else {
      send("close-new-window", "themeConversationMini");
    }
  });

  // ============ 记账小窗口 ============
  const showAccountingMiniWindow = ref();
  const showAccountingMiniWindowC = computed(() => showAccountingMiniWindow.value);
  function setShowAccountingMiniWindow(value: boolean) {
    showAccountingMiniWindow.value = value;
    setStore("showAccountingMiniWindow", value);
  }

  const accountingMiniWindowConfig = ref({
    position: 'bottom-right',
    width: 360,
    height: 520,
    gap: 30,
    x: 0,
    y: 0,
    skin: 'white',
  });

  watch(showAccountingMiniWindow, (newValue) => {
    if (newValue == true) {
      console.log("打开记账小窗口", accountingMiniWindowConfig.value);
      send("open-new-window", "accountingMini", accountingMiniWindowConfig.value);
    } else {
      send("close-new-window", "accountingMini");
    }
  });

  watch(accountingMiniWindowConfig, (newVal) => {
    send('sync-data-to-other-window', {
      accountingMiniWindowConfig: toRaw(newVal),
    });
  }, { deep: true });

  watch(pomodoroMiniWindowConfig, (newVal) => {
    send('sync-data-to-other-window', {
      pomodoroMiniWindowConfig: toRaw(newVal),
    });
  }, { deep: true });

  watch(quickNoteWindowConfig, (newVal) => {
    send('sync-data-to-other-window', {
      quickNoteWindowConfig: toRaw(newVal),
    });
  }, { deep: true });

  watch(themeConversationMiniWindowConfig, (newVal) => {
    send('sync-data-to-other-window', {
      themeConversationMiniWindowConfig: toRaw(newVal),
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
      {
        field: "showQuickNoteWindow",
        default: false,
        map: showQuickNoteWindow,
      },
      {
        field: "showTodoWindow",
        default: false,
        map: showTodoWindow,
      },
      {
        field: "showThemeConversationMiniWindow",
        default: false,
        map: showThemeConversationMiniWindow,
      },
      {
        field: "showAccountingMiniWindow",
        default: false,
        map: showAccountingMiniWindow,
      },
    ];

    const migrateOldConfig = () => {
      const oldPomodoroConfig = getStore("pomodoroMiniWindowConfig");
      if (oldPomodoroConfig) {
        // 仅当新键不存在时才迁移，避免覆盖用户已保存的新配置
        const newConfig = getStore("window-mode:pomodoro");
        if (!newConfig) {
          setStore("window-mode:pomodoro", oldPomodoroConfig);
        }
        // 迁移完成后清除旧键，避免反复迁移导致旧值反复覆盖新值
        setStore("pomodoroMiniWindowConfig", null);
      }
      const oldNotebookConfig = getStore("miniNotebookWindowConfig");
      if (oldNotebookConfig) {
        const newConfig = getStore("window-mode:notebook");
        if (!newConfig) {
          setStore("window-mode:notebook", oldNotebookConfig);
        }
        setStore("miniNotebookWindowConfig", null);
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
      {
        field: "window-mode:quickNote",
        default: {
          position: 'bottom-right',
          width: 600,
          height: 400,
          gap: 30,
          x: 0,
          y: 0,
          skin: 'white',
          layout: 'minimal',
        },
        map: quickNoteWindowConfig,
      },
      {
        field: "window-mode:todoMiniWindow",
        default: {
          position: 'bottom-right',
          width: 400,
          height: 500,
          gap: 30,
          x: 0,
          y: 0,
          skin: 'white',
        },
        map: todoWindowConfig,
      },
      {
        field: "window-mode:themeConversationMini",
        default: {
          position: 'bottom-right',
          width: 600,
          height: 700,
          gap: 30,
          x: 0,
          y: 0,
          skin: 'white',
        },
        map: themeConversationMiniWindowConfig,
      },
      {
        field: "window-mode:accountingMini",
        default: {
          position: 'bottom-right',
          width: 360,
          height: 520,
          gap: 30,
          x: 0,
          y: 0,
          skin: 'white',
        },
        map: accountingMiniWindowConfig,
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
      if (arg?.quickNoteWindowConfig) {
        const newConfig = arg.quickNoteWindowConfig;
        const currentConfig = quickNoteWindowConfig.value;
        if (JSON.stringify(newConfig) !== JSON.stringify(currentConfig)) {
          quickNoteWindowConfig.value = { ...currentConfig, ...newConfig };
        }
      }
      if (arg?.themeConversationMiniWindowConfig) {
        const newConfig = arg.themeConversationMiniWindowConfig;
        const currentConfig = themeConversationMiniWindowConfig.value;
        if (JSON.stringify(newConfig) !== JSON.stringify(currentConfig)) {
          themeConversationMiniWindowConfig.value = { ...currentConfig, ...newConfig };
        }
      }
      if (arg?.accountingMiniWindowConfig) {
        const newConfig = arg.accountingMiniWindowConfig;
        const currentConfig = accountingMiniWindowConfig.value;
        if (JSON.stringify(newConfig) !== JSON.stringify(currentConfig)) {
          accountingMiniWindowConfig.value = { ...currentConfig, ...newConfig };
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
    showQuickNoteWindow,
    showQuickNoteWindowC,
    setShowQuickNoteWindow,
    quickNoteWindowConfig,
    showTodoWindow,
    showTodoWindowC,
    setShowTodoWindow,
    todoWindowConfig,
    showThemeConversationMiniWindow,
    showThemeConversationMiniWindowC,
    setShowThemeConversationMiniWindow,
    themeConversationMiniWindowConfig,
    showAccountingMiniWindow,
    showAccountingMiniWindowC,
    setShowAccountingMiniWindow,
    accountingMiniWindowConfig,
    $reset,
  };
});
