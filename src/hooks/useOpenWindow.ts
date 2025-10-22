import { onBeforeUnmount, onMounted } from "vue";
import { storeToRefs } from "pinia";
import useGlobalSetting from "@/store/useGlobalSetting";
import { useWorkOrRest } from "@/hooks/useWorkOrReset";
import electronConfig from '../../electron-builder.json5'
import { send } from "@/utils/common";

/**
 * 该hook用于在app.vue中，不同打开窗口
 */
export default function useOpenWindow() {
  const href = window.location.href;

  // 是否是番茄钟窗口
  const isPomodoro = href.includes('isSecondWindow=true');

  const { globalFontC, globalFontENC } = storeToRefs(useGlobalSetting());
  const { startApp, registerGlobalListener, unregisterGlobalListener } = useWorkOrRest();

  // 主窗口的打开
  function openMainWindow () {
    send('open-new-window', 'second')
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
    // 通用的内容
    document.title = electronConfig.productName;
    // 如果是番茄钟窗口
    if (isPomodoro) {
      openPomodoroWindow();
      return; 
    }
    openMainWindow();
  })

  onBeforeUnmount(() => {
    // 如果是番茄钟窗口
    if (isPomodoro) {
      return;
    }
    closeMainWindow();
  })
}