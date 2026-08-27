import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import useTipsRuntime from '@/store/useTipsRuntime';
import useNewReminder from '@/store/useNewReminder';
import useGlobalSetting from '@/store/useGlobalSetting';

/**
 * 番茄钟统一状态组合式函数
 * ------------------------------------------------------------------
 * 汇总「工作 / 休息 / 强制锁屏 / 空闲（免打扰） / 番茄钟已关闭」五态，
 * 供首页各主题组件统一展示，避免各自只识别 work/rest 导致锁屏 / 空闲 / 关闭态丢失。
 *
 * 判定优先级（与 src/smallComponents/currentStatus.vue 一致）：
 *   1) 番茄钟总开关 enabled=0      → disabled（番茄钟已关闭）
 *   2) 空闲（免打扰）时段 isIdleNow → idle（空闲中）
 *   3) 当前状态 currentStateKey：
 *        - 'lock' → 强制锁屏
 *        - 'rest' / 'work' → 对应运行态
 *
 * 权威源取 useTipsRuntime（currentStateKey / stateLabel，A/B 通道都更新），
 * 而非仅 channel A 写入的 curStatus，规避启动时状态不一致（锁屏被误判为工作等）。
 */
export type PomodoroStateKey = 'work' | 'rest' | 'lock' | 'idle' | 'disabled';

export interface PomodoroStatus {
  /** 归一化状态 key，可直接用于 :class 绑定 */
  key: PomodoroStateKey;
  /** 默认中文展示文案 */
  label: string;
  /** 是否空闲（免打扰）中 */
  idle: boolean;
  /** 番茄钟是否关闭 */
  disabled: boolean;
  /** 是否强制锁屏 */
  locked: boolean;
}

export function usePomodoroStatus() {
  const runtime = useTipsRuntime();
  const reminderStore = useNewReminder();
  const globalStore = useGlobalSetting();
  const { remindersC } = storeToRefs(reminderStore);
  const { isIdleNow } = storeToRefs(globalStore);

  // 番茄钟总开关：enabled=1 开启；enabled=0 关闭（虚拟状态「番茄钟已关闭」）
  const enabled = computed(() => {
    const pomodoro: any = remindersC.value.find((r: any) => r.id === 'pomodoro');
    return pomodoro ? pomodoro.enabled === 1 : true;
  });

  const status = computed<PomodoroStatus>(() => {
    // 1) 番茄钟已关闭：优先级最高，覆盖一切运行态
    if (!enabled.value) {
      return { key: 'disabled', label: '番茄钟已关闭', idle: false, disabled: true, locked: false };
    }
    // 2) 空闲（免打扰）时段：展示「空闲中」替代运行态文案
    if (isIdleNow.value) {
      return { key: 'idle', label: '空闲中（免打扰时段）', idle: true, disabled: false, locked: false };
    }
    // 3) 强制锁屏（注入的非序列状态）
    const key = runtime.currentStateKey;
    if (key === 'lock') {
      return { key: 'lock', label: '强制锁屏', idle: false, disabled: false, locked: true };
    }
    // 4) 休息 / 工作（权威源 currentStateKey / stateLabel，两通道都更新）
    if (key === 'rest') {
      return { key: 'rest', label: runtime.stateLabel || '正在休息', idle: false, disabled: false, locked: false };
    }
    // 5) 兜底：工作
    return { key: 'work', label: runtime.stateLabel || '正在工作', idle: false, disabled: false, locked: false };
  });

  return { status, enabled, isIdleNow };
}

export default usePomodoroStatus;
