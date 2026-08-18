import { onBeforeUnmount, onMounted } from "vue";
import { storeToRefs } from "pinia";
import useGlobalSetting from "@/store/useGlobalSetting";
import { useWorkOrRest } from "@/hooks/useWorkOrReset";
import electronConfig from '../../electron-builder.json5'
import { send, getWindowConfig } from "@/utils/common";

/**
 * 该hook用于在app.vue中，不同打开窗口
 */
export default function useOpenWindow() {
  const href = window.location.href;
  // 针对 hash 路由：截图选框层 / 贴图钉屏窗口以 "#/screenshotSelect"、"#/sticker" 形式加载
  const hash = window.location.hash || '';

  // 是否是番茄钟窗口
  const isPomodoro = href.includes('isSecondWindow=true');

  // 是否为「辅助窗口」：截图选框层、贴图钉屏等。这些窗口复用 App.vue 外壳，
  // 但只是临时/浮动窗口，不应触发「应用启动」的工作/休息初始化逻辑
  // （否则每次截图/钉屏都会误报「人为破坏应用运行机制」并重置番茄钟计时）。
  const isAuxWindow =
    hash.includes('screenshotSelect') || hash.includes('sticker');

  const { globalFontC, globalFontENC } = storeToRefs(useGlobalSetting());
  const { startApp, registerGlobalListener, unregisterGlobalListener } = useWorkOrRest();

  // 主窗口的打开
  function openMainWindow () {
    console.log('openMainWindow', getWindowConfig('pomodoro'));
    send('open-new-window', 'pomodoro', getWindowConfig('pomodoro'))
    document.documentElement.style.setProperty('--jianli-global-font', globalFontC.value)
    document.documentElement.style.setProperty('--jianli-global-font-EN', globalFontENC.value)
    startApp();
    registerGlobalListener();
  }

  // 关闭主窗口
  function closeMainWindow () {
    unregisterGlobalListener();
  }

  // 番茄钟窗口的打开
  function openPomodoroWindow () {
  }

  onMounted(() => {
    // 原来是首页出现标题的 bug 在这？额
    // document.title = electronConfig.productName;
    // 如果是番茄钟窗口
    if (isPomodoro) {
      openPomodoroWindow();
      return;
    }
    // 辅助窗口（截图选框层 / 贴图钉屏）：不运行应用启动逻辑，直接挂载对应路由
    if (isAuxWindow) {
      return;
    }
    openMainWindow();
  })

  onBeforeUnmount(() => {
    // 番茄钟窗口 / 辅助窗口：跳过主窗口的清理逻辑
    if (isPomodoro || isAuxWindow) {
      return;
    }
    closeMainWindow();
  })
}