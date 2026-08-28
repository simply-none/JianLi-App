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

  const showClipboardWindow = ref();
  const showClipboardWindowC = computed(() => showClipboardWindow.value);
  function setShowClipboardWindow(value: boolean) {
    showClipboardWindow.value = value;
    setStore("showClipboardWindow", value);
  }

  const clipboardWindowConfig = ref({
    position: 'bottom-right',
    width: 520,
    height: 560,
    gap: 30,
    x: 0,
    y: 0,
    skin: 'white',
    layout: 'list',
  });

  watch(showClipboardWindow, (newValue) => {
    if (newValue == true) {
      send("open-new-window", "clipboardMiniWindow", clipboardWindowConfig.value);
    } else {
      send("close-new-window", "clipboardMiniWindow");
    }
  });

  // ============ 习惯打卡小窗 ============
  const showHabitWindow = ref();
  const showHabitWindowC = computed(() => showHabitWindow.value);
  function setShowHabitWindow(value: boolean) {
    showHabitWindow.value = value;
    setStore("showHabitWindow", value);
  }

  /**
   * 打开打卡小窗（供提醒触发 / 通知点击复用）。
   * 已开启时上面的 watch 不会触发（值未变化），这里直接下发一次
   * open-new-window —— createOtherWindow 命中已存在窗口时会直接 show/focus。
   */
  function openHabitWindow() {
    if (showHabitWindow.value === true) {
      send("open-new-window", "habitMiniWindow", habitWindowConfig.value);
      return;
    }
    showHabitWindow.value = true;
    setStore("showHabitWindow", true);
  }

  const habitWindowConfig = ref({
    position: 'bottom-right',
    width: 420,
    height: 520,
    gap: 30,
    x: 0,
    y: 0,
    skin: 'white',
    // 关键：createOtherWindow 在 !ops.mouseEvents 时会 setIgnoreMouseEvents(true,{forward:true})
    // 进入鼠标穿透态，那样面板既点不动也拖不动（穿透只转发 mousemove，不转发 mousedown）。
    // 打卡面板是常驻捕获态，不开穿透，所以必须显式带上。
    mouseEvents: true,
  });

  watch(showHabitWindow, (newValue) => {
    if (newValue == true) {
      send("open-new-window", "habitMiniWindow", habitWindowConfig.value);
    } else {
      // 用 hide 而不是 close：窗口留着复用，下次唤出直接 show，不用重建
      send("hide-new-window", "habitMiniWindow");
    }
  });

  // ============ 命令面板小窗 ============
  const showCommandPaletteWindow = ref();
  const showCommandPaletteWindowC = computed(() => showCommandPaletteWindow.value);
  function setShowCommandPaletteWindow(value: boolean) {
    showCommandPaletteWindow.value = value;
    setStore("showCommandPaletteWindow", value);
  }

  const commandPaletteWindowConfig = ref({
    position: 'center-top',
    width: 640,
    height: 460,
    gap: 30,
    x: 0,
    y: 0,
    skin: 'white',
  });

  watch(showCommandPaletteWindow, (newValue) => {
    if (newValue == true) {
      send("open-new-window", "commandPaletteMiniWindow", commandPaletteWindowConfig.value);
    } else {
      send("close-new-window", "commandPaletteMiniWindow");
    }
  });

  watch(commandPaletteWindowConfig, (newVal) => {
    send('sync-data-to-other-window', {
      commandPaletteWindowConfig: toRaw(newVal),
    });
  }, { deep: true });

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

  // ============ 股票小窗口 ============
  const showStockMiniWindow = ref();
  const showStockMiniWindowC = computed(() => showStockMiniWindow.value);
  function setShowStockMiniWindow(value: boolean) {
    showStockMiniWindow.value = value;
    setStore("showStockMiniWindow", value);
  }

  const stockMiniWindowConfig = ref({
    position: 'bottom-right',
    width: 360,
    height: 560,
    gap: 30,
    x: 0,
    y: 0,
    skin: 'white',
    symbol: '',
  });

  watch(showStockMiniWindow, (newValue) => {
    if (newValue == true) {
      console.log("打开股票小窗口", stockMiniWindowConfig.value);
      send("open-new-window", "stockMini", stockMiniWindowConfig.value);
    } else {
      send("close-new-window", "stockMini");
    }
  });

  watch(stockMiniWindowConfig, (newVal) => {
    send('sync-data-to-other-window', {
      stockMiniWindowConfig: toRaw(newVal),
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
      {
        field: "showStockMiniWindow",
        default: false,
        map: showStockMiniWindow,
      },
      {
        field: "showCommandPaletteWindow",
        default: false,
        map: showCommandPaletteWindow,
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
        field: "window-mode:clipboardMiniWindow",
        default: {
          position: 'bottom-right',
          width: 520,
          height: 560,
          gap: 30,
          x: 0,
          y: 0,
          skin: 'white',
          layout: 'list',
        },
        map: clipboardWindowConfig,
      },
      {
        field: "window-mode:habitMiniWindow",
        default: {
          position: 'bottom-right',
          width: 420,
          height: 520,
          gap: 30,
          x: 0,
          y: 0,
          skin: 'white',
          // 见上方说明：必须显式开启鼠标事件，否则窗口进入穿透态
          mouseEvents: true,
        },
        map: habitWindowConfig,
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
      {
        field: "window-mode:stockMini",
        default: {
          position: 'bottom-right',
          width: 360,
          height: 560,
          gap: 30,
          x: 0,
          y: 0,
          skin: 'white',
          symbol: '',
        },
        map: stockMiniWindowConfig,
      },
      {
        field: "window-mode:commandPaletteMiniWindow",
        default: {
          position: 'center-top',
          width: 640,
          height: 460,
          gap: 30,
          x: 0,
          y: 0,
          skin: 'white',
        },
        map: commandPaletteWindowConfig,
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
      if (arg?.stockMiniWindowConfig) {
        const newConfig = arg.stockMiniWindowConfig;
        const currentConfig = stockMiniWindowConfig.value;
        if (JSON.stringify(newConfig) !== JSON.stringify(currentConfig)) {
          stockMiniWindowConfig.value = { ...currentConfig, ...newConfig };
        }
      }
      // 剪贴板面板被拖动后，主进程会广播新坐标，这里同步到设置页
      if (arg?.clipboardWindowConfig) {
        const newConfig = arg.clipboardWindowConfig;
        const currentConfig = clipboardWindowConfig.value;
        if (JSON.stringify(newConfig) !== JSON.stringify(currentConfig)) {
          clipboardWindowConfig.value = { ...currentConfig, ...newConfig };
        }
      }
      if (arg?.commandPaletteWindowConfig) {
        const newConfig = arg.commandPaletteWindowConfig;
        const currentConfig = commandPaletteWindowConfig.value;
        if (JSON.stringify(newConfig) !== JSON.stringify(currentConfig)) {
          commandPaletteWindowConfig.value = { ...currentConfig, ...newConfig };
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
    showClipboardWindow,
    showClipboardWindowC,
    setShowClipboardWindow,
    clipboardWindowConfig,
    showHabitWindow,
    showHabitWindowC,
    setShowHabitWindow,
    openHabitWindow,
    habitWindowConfig,
    showThemeConversationMiniWindow,
    showThemeConversationMiniWindowC,
    setShowThemeConversationMiniWindow,
    themeConversationMiniWindowConfig,
    showAccountingMiniWindow,
    showAccountingMiniWindowC,
    setShowAccountingMiniWindow,
    accountingMiniWindowConfig,
    showStockMiniWindow,
    showStockMiniWindowC,
    setShowStockMiniWindow,
    stockMiniWindowConfig,
    showCommandPaletteWindow,
    showCommandPaletteWindowC,
    setShowCommandPaletteWindow,
    commandPaletteWindowConfig,
    $reset,
  };
});
