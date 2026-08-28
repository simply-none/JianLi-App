import { computed, onMounted, ref, toRaw, watchEffect } from "vue";
import type { Ref } from "vue";
import { defineStore, storeToRefs } from "pinia";
import { basicInfoTable, getStore, send, sendSync, setPomodoroStatus, setStore } from "../utils/common";
import moment from "moment";
import usePomodoroDisplay from "@/store/usePomodoroDisplay";
import useTipsRuntime from "@/store/useTipsRuntime";
import useNewReminder from "@/store/useNewReminder";
import { isInIdlePeriod } from "@/utils/idleTime";
import { initPiniaStatus, type defaultField } from "@/utils/store";

export const prefix = 'curStatusInfo'

// 空闲（免打扰）时段全局判定：基于番茄钟提醒的 idleTime 配置 + 每秒刷新的时钟，
// 空闲边界（开始/结束）即时切换。模块级单例，全应用仅一个定时器。
const idleNow = ref(Date.now());
let idleClockStarted = false;
function startIdleClock() {
  if (idleClockStarted) return;
  idleClockStarted = true;
  setInterval(() => { idleNow.value = Date.now(); }, 1000);
}

export type StatusMode = "work" | "rest" | "screen" | "lock" | "idle";

interface Status {
  label?: string;
  value?: StatusMode;
}

interface CommonOps {
  label?: string;
  value?: string;
}

interface HomeModeOps {
  label?: string;
  value?: string;
  primaryColor?: string;
  secondaryColor?: string;
  opacity?: number;
  newField?: string;
  // 样式
  style?: ObjectType;
  // 小组件
  widgets?: ObjectType[];
}

export default defineStore("global-setting", () => {
  const { startWorkTimeC, closeWorkTimeC, workTimeGapC, workTimeGapUnitC, restTimeGapC, restTimeGapUnitC } = storeToRefs(usePomodoroDisplay());
  // 番茄钟运行时：当前状态由主进程 authority 下发，避免旧锚点失效导致判定错误
  const tipsRuntime = useTipsRuntime();
  // 当前的状态
  const curStatus = ref<Status>({});
  const curStatusC = computed(() => curStatus.value);
  // 空闲（免打扰）判定：当前时间落在番茄钟提醒配置的 idleTime 时段内；
  // 渲染端统一按此判定（确定性），并兼容主进程下发的 runtime.idle 事件。
  const reminderStoreIdle = useNewReminder();
  const { remindersC: idleRemindersC } = storeToRefs(reminderStoreIdle);
  const isIdleNow = computed(() => {
    const p: any = idleRemindersC.value.find((r: any) => r.id === "pomodoro");
    return isInIdlePeriod(p?.idleTime, new Date(idleNow.value));
  });
  startIdleClock();
  function setCurStatus(status?: Status, record = true, startTime?: number) {
    if (!status) {
      const key = tipsRuntime.currentStateKey;
      curStatus.value =
        key === 'rest'
          ? {
              label: "正在休息",
              value: "rest",
            }
          : {
              label: "正在工作",
              value: "work",
            };
      // 仅 record=true 时落库；补偿/刷新路径传 false，只更新展示不写 pomodoro_status
      if (record) cacheCurStatusInfo(curStatus.value, startTime);
      else setStore("curStatus", curStatus.value);
      return true;
    }
    curStatus.value = status;
    setStore("curStatus", status);
    // record=false（启动补偿 / 续跑 / 刷新当前时间）时只更新内存状态，不写 pomodoro_status，避免碎片记录
    if (record) cacheCurStatusInfo(status, startTime);
  }

  function cacheCurStatusInfo(status: Status, startTime?: number) {
    const current = moment().format("YYYY-MM-DD");
    let curDate = getStore(`${prefix}`)
    let storeValue = []
    if (!curDate) {
      curDate = []
    } else if (Array.isArray(curDate)) {
      const find = curDate.find((item: any) => item === current)
      if (find) {
        storeValue = getStore(`${prefix}_${current}`)
        curDate = curDate.filter((item: any) => item != current)
      }
    }
    // 记录起点优先用主进程下发的「真实进入时刻」startTime：
    // 1) 消除渲染端 moment() 的时钟漂移；
    // 2) 按开始时刻把记录归到正确的那一天（避免跨午夜错归档）。
    // startTime 缺省（极低概率的兜底路径）时回退到当前时刻。
    const recordTs = startTime && !isNaN(Number(startTime)) ? Number(startTime) : Date.now();
    const recordMoment = moment(recordTs);
    // 番茄钟记录统一走 newSql.ts（new-sql:record-pomodoro），主进程带去重，防主窗口/小窗双写
    setPomodoroStatus({
      ...status,
      date: recordMoment.format("YYYY-MM-DD"),
      dateTime: recordMoment.format("YYYY-MM-DD HH:mm:ss"),
      mode: import.meta.env.MODE,
    }).catch(err => {
      console.error(err, 'setPomodoroStatus error')
    })
    setStore("curStatus", status);
  }

  // 强制解锁屏幕限制（即可以玩电脑）
  const forceWorkTimes = ref();
  const todayForceWorkTimes = ref();
  const forceWorkTimesC = computed(() => forceWorkTimes.value);
  const todayForceWorkTimesC = computed(() => todayForceWorkTimes.value);

  function setForceWorkTimes(value: number) {
    forceWorkTimes.value = value;
    setStore("forceWorkTimes", value);
  }

  function setTodayForceWorkTimes(value: number) {
    if (typeof value !== "number") value = 0;
    const t = {
      today: moment().format("YYYY/MM/DD"),
      times: value,
    };
    todayForceWorkTimes.value = t;
    setStore("todayForceWorkTimes", t);
  }

  // 是否开机启动
  const isStartup = ref();
  const isStartupC = computed(() => isStartup.value);

  function setIsStartup(value: boolean) {
    isStartup.value = value;
    setStore("isStartup", value);
    send("set-startup", value);
  }

  // 侧边栏 / 顶部栏 可见性
  const sidebarVisible = ref();
  const topbarVisible = ref();
  const sidebarVisibleC = computed(() => sidebarVisible.value);
  const topbarVisibleC = computed(() => topbarVisible.value);

  function setSidebarVisible(value: boolean) {
    sidebarVisible.value = value;
    setStore("sidebarVisible", value);
  }

  function setTopbarVisible(value: boolean) {
    topbarVisible.value = value;
    setStore("topbarVisible", value);
  }

  // 系统样式布局设置
  // 应用内颜色
  const appInnerColor = ref();
  // 应用背景颜色
  const appBgColor = ref();
  // 应用全局字体
  const globalFont = ref();
  const globalFontOps = ref<CommonOps[]>([]);
  const appInnerColorC = computed(() => appInnerColor.value);
  const appBgColorC = computed(() => appBgColor.value);
  const globalFontC = computed(() => globalFont.value);
  const globalFontOpsC = computed(() => globalFontOps.value);
  // 应用全局字体-英文
  const globalFontEN = ref();
  const globalFontENC = computed(() => globalFontEN.value);

  function setAppInnerColor(value: string) {
    appInnerColor.value = value;
    setStore("appInnerColor", value);
  }

  function setAppBgColor(value: string) {
    appBgColor.value = value;
    setStore("appBgColor", value);
  }

  function setGlobalFont(value: string) {
    globalFont.value = value;
    setStore("globalFont", value);
    document.documentElement.style.setProperty("--jianli-global-font", value);
  }

  function setGlobalFontEN(value: string) {
    globalFontEN.value = value;
    setStore("globalFontEN", value);
    document.documentElement.style.setProperty("--jianli-global-font-EN", value);
  }

  function setGlobalFontOps(value: CommonOps[]) {
    globalFontOps.value = value;
    console.log(value, "value");
    setStore("globalFontOps", value);
  }

  // 应用强制锁定（即休息时）设置存储思路：
  // 1. 包含多套方案
  // 2. 每套方案包含一种或多种属性
  const homeMode = ref<Record<string, ObjectType>>({
    work: {},
    rest: {},
    screen: {},
    lock: {},
    idle: {}, // 与内置状态集合对齐：避免副本缺 idle 导致写入丢失、重启回落默认第一项
  });
  // homeMode 是否已从库载入真实数据（含已配 mode）。
  // 用于守卫 alignHomeModeKeys 的写库：启动早期（init 尚未完成）禁止写库，
  // 避免空壳覆盖 store 清空番茄钟状态主页模式的小组件配置。见 2026-08-28 修复。
  const homeModeLoaded = ref(false);
  const homeModeOps = ref<ObjectType[]>([]);
  const homeModeC = computed(() => homeMode.value);
  const homeModeOpsC = computed(() => homeModeOps.value);

  function setHomeMode(value: Record<StatusMode, ObjectType>) {
    homeMode.value = value;
    setStore("homeMode", value);
  }

  function setHomeModeOps(value: ObjectType[]) {
    homeModeOps.value = value;
    setStore("homeModeOps", value);
  }

  // 内置状态 key 集合：番茄钟 work/rest/lock + 历史遗留 screen（全屏/锁屏态）。
  // 这些 key 在 homeMode 中必须永远存在，缺失会触发 watch 取值崩溃。
  const BUILTIN_STATUS_KEYS = ["work", "rest", "screen", "lock", "idle"];

  /**
   * 将 homeMode 的 key 集合与番茄钟 states / 当前运行状态对齐：
   *  - 传入的 key（如番茄钟 states 的 key 数组）缺失时，用默认皮肤配置补齐；
   *  - 内置 key（work/rest/screen/lock）即使不在传入集合中也强制保留，绝不删除；
   *  - 用户自定义的、不在内置集合但已存在于 homeMode 的 key 同样保留（不丢已配皮肤）。
   * 这是「homeMode 动态取番茄钟对应 status」的核心：番茄钟 states 变动时调用本函数，
   * homeMode 的 key 自动跟随，且永不缺键。
   */
  // 取番茄钟（多状态提醒）当前 states 的 key 集合，用于对齐 homeMode 的自定义状态 key
  function getPomodoroStateKeys(): string[] {
    const p: any = reminderStoreIdle.reminders.find(
      (r: any) => r.id === "pomodoro" && r.mode === "stateful"
    );
    return Array.isArray(p?.states) ? p.states.map((s: any) => s.key).filter(Boolean) : [];
  }
  function alignHomeModeKeys(statusKeys: string[] = []) {
    const keys = Array.isArray(statusKeys) ? statusKeys : [];
    const defaultEntry = homeModeOps.value[0] || {};
    // 保证补齐/创建的 entry 始终带 mode 字段（空对象也算兜底），
    // 否则 changeHomeMode 读取 homeMode[key].mode[value] 会因 mode 为 undefined 抛错
    // （如历史遗留的空壳 lock:{} 被保留后，点击强制锁屏模式即崩溃）。
    const withMode = (entry: ObjectType) => ({ mode: {}, ...entry });
    const next: Record<string, ObjectType> = {};
    // 1. 内置 key 永远保留（不足则补默认）
    for (const k of BUILTIN_STATUS_KEYS) {
      next[k] = withMode(homeMode.value[k] || { ...defaultEntry });
    }
    // 2. 传入的 key（番茄钟 states）补齐
    for (const k of keys) {
      if (!k) continue;
      next[k] = withMode(homeMode.value[k] || { ...defaultEntry });
    }
    // 3. 保留 homeMode 中已存在、但既非内置也未被传入的自定义 key（不丢用户配置）
    for (const k of Object.keys(homeMode.value)) {
      if (!(k in next)) next[k] = homeMode.value[k];
    }
    homeMode.value = next;
    // 守卫：仅在 homeMode 已从库载入真实数据后才写库，避免应用启动早期空壳覆盖 store，
    // 清空已持久化的 mode（番茄钟状态主页模式小组件）。见 2026-08-28 修复。
    if (homeModeLoaded.value) {
      setStore("homeMode", next);
    }
  }

  // pinia状态初始化
  function init() {
    // 布尔值变量
    const boolVars = [
      { field: "isStartup", default: false, map: isStartup },
      { field: "sidebarVisible", default: true, map: sidebarVisible },
      { field: "topbarVisible", default: true, map: topbarVisible },
    ];
    // 数字值变量
    const numberVars = [
      { field: "forceWorkTimes", default: 3, map: forceWorkTimes },
    ];
    // 字符串值变量
    const stringVars: defaultField[] = [];
    // 颜色值变量
    const colorVars = [
      { field: "appInnerColor", default: "#ffffff", map: appInnerColor },
      { field: "appBgColor", default: "#d4d4d4", map: appBgColor },
    ];
    // 字体值变量
    const fontVars = [
      { field: "globalFont", default: "", map: globalFont },
      { field: "globalFontEN", default: "", map: globalFontEN },
    ];

    const originHomeModeOps: HomeModeOps[] = [
      {
        label: "模拟Windows更新",
        value: "1",
        primaryColor: "#000000",
        secondaryColor: "#ffffff",
        opacity: 0.8,
      },
      {
        label: "极简时钟",
        value: "4",
        primaryColor: "#ffffff",
        secondaryColor: "#0a0a0a",
        opacity: 0.9,
      },
      {
        label: "GitHub主题",
        value: "5",
        primaryColor: "#c9d1d9",
        secondaryColor: "#0d1117",
        opacity: 0.95,
      },
      {
        label: "励志名言",
        value: "6",
        primaryColor: "#ffffff",
        secondaryColor: "#2c3e50",
        opacity: 0.9,
      },
      {
        label: "终端主题",
        value: "7",
        primaryColor: "#00ff00",
        secondaryColor: "#1e1e1e",
        opacity: 0.95,
      },
      {
        label: "音乐播放器",
        value: "8",
        primaryColor: "#ffffff",
        secondaryColor: "#1a1a2e",
        opacity: 0.85,
      },
      {
        label: "Windows桌面",
        value: "9",
        primaryColor: "#ffffff",
        secondaryColor: "#0078d4",
        opacity: 0.9,
      },
      {
        label: "macOS桌面",
        value: "10",
        primaryColor: "#ffffff",
        secondaryColor: "#1c1c1e",
        opacity: 0.9,
      },
      {
        label: "新闻阅读",
        value: "11",
        primaryColor: "#333333",
        secondaryColor: "#f5f5f5",
        opacity: 0.9,
      },
      {
        label: "代码编辑",
        value: "12",
        primaryColor: "#d4d4d4",
        secondaryColor: "#1e1e1e",
        opacity: 0.95,
      },
      {
        label: "搜索引擎",
        value: "13",
        primaryColor: "#333333",
        secondaryColor: "#ffffff",
        opacity: 0.85,
      },
      {
        label: "诗词首页",
        value: "14",
        primaryColor: "#f0ebe3",
        secondaryColor: "#2c2f33",
        opacity: 0.92,
      },
      {
        label: "自定义",
        value: "3",
        primaryColor: "#000000",
        secondaryColor: "#ffffff",
        opacity: 0.8,
      },
    ];
    // 对象值变量
    const objectVars = [
      {
        field: "curStatus",
        default: {
          label: "正在工作",
          value: "work",
          // 匹配当前主页的模式
          mode: "",
        },
        map: curStatus,
      },
      {
        field: "todayForceWorkTimes",
        default: {
          today: moment().format("YYYY/MM/DD"),
          times: 0,
        },
        map: todayForceWorkTimes,
        initFn: initTodayForceWorkTimes,
      },
      {
        field: "globalFontOps",
        default: [
          { label: "系统字体", value: "initial" },
        ],
        map: globalFontOps,
      },
      {
        field: "homeMode",
        // 内置状态集合（番茄钟 work/rest/lock + 历史遗留 screen 全屏态）一律预置，
        // 保证 homeMode[key] 永远存在，杜绝「缺 lock 键 → watch 取值 undefined 崩溃」。
        default: {
          work: originHomeModeOps[0],
          rest: originHomeModeOps[0],
          screen: originHomeModeOps[0],
          lock: originHomeModeOps[0],
          idle: originHomeModeOps[0],
        },
        map: homeMode,
      },
      {
        field: "homeModeOps",
        default: originHomeModeOps,
        map: homeModeOps,
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

    // 默认值赋值（从库载入 homeMode 真实数据，含已配 mode）
    initPiniaStatus(allVars);
    // 标记 homeMode 已从库载入，此后 alignHomeModeKeys 方可安全写库
    homeModeLoaded.value = true;
    // 初始化后对齐 homeMode 的 key 集合（内置 + 番茄钟自定义状态），
    // 此时写库安全（基于已载入数据）。states 变化仍由 usePomodoroDisplay 的 watch 再次对齐。
    alignHomeModeKeys(getPomodoroStateKeys());
  }

  // 当天时间判断，初始化
  function initTodayForceWorkTimes<T>(
    key: string,
    defaultValue: T,
    map: Ref<any>
  ): void {
    const storeValue = getStore(key);
    const today = moment().format("YYYY/MM/DD");

    if (
      storeValue == undefined ||
      storeValue == null ||
      today !== storeValue.today
    ) {
      map.value = defaultValue;
      setStore(key, defaultValue);
    } else {
      map.value = storeValue;
    }
  }

  function $reset() {
    init();
  }

  onMounted(() => {
    init();
  });

  // 监听上面所有状态的变化，打开番茄钟小窗口同步数据
  watchEffect(() => {
    console.log(curStatus.value, "curStatus.value");
    console.log(forceWorkTimes.value, "forceWorkTimes.value");
    console.log(todayForceWorkTimes.value, "todayForceWorkTimes.value");
    send('sync-data-to-other-window', {
      curStatus: toRaw(curStatus.value),
      startWorkTime: toRaw(startWorkTimeC.value),
      closeWorkTime: toRaw(closeWorkTimeC.value),
      workTimeGap: toRaw(workTimeGapC.value),
      workTimeGapUnit: toRaw(workTimeGapUnitC.value),
      restTimeGap: toRaw(restTimeGapC.value),
      restTimeGapUnit: toRaw(restTimeGapUnitC.value),
    }) 
  })

  return {
    // 变量
    curStatus,
    forceWorkTimes,
    todayForceWorkTimes,
    isStartup,
    sidebarVisible,
    topbarVisible,
    appInnerColor,
    appBgColor,
    globalFont,
    globalFontEN,
    globalFontOps,
    homeMode,
    homeModeOps,
    // 方法
    setCurStatus,
    setForceWorkTimes,
    setTodayForceWorkTimes,
    setIsStartup,
    setSidebarVisible,
    setTopbarVisible,
    setAppInnerColor,
    setAppBgColor,
    setGlobalFont,
    setGlobalFontEN,
    setGlobalFontOps,
    setHomeMode,
    setHomeModeOps,
    alignHomeModeKeys,
    // getters
    curStatusC,
    isIdleNow,
    forceWorkTimesC,
    todayForceWorkTimesC,
    isStartupC,
    sidebarVisibleC,
    topbarVisibleC,
    appInnerColorC,
    appBgColorC,
    globalFontC,
    globalFontENC,
    globalFontOpsC,
    homeModeC,
    homeModeOpsC,
    // 其他
    $reset,
  };
});
