// 小窗设置页的功能逻辑层：开关 / 应用 / 配置写入 / 自定义弹窗。
// 原先 7 个小窗各自一套 if-else 与独立函数，这里收敛为「按 key 索引 + 统一写入」，
// 行为与原实现逐条对齐：本地副本与 store 同步写入，再经 setStore 落到 window-mode:{storeKey}。
import { computed, ref, toRaw, watch } from 'vue'
import type { Ref } from 'vue'
import { storeToRefs } from 'pinia'
import useWindowMode from '@/store/useWindowMode'
import { setStore } from '@/utils/common'
import { GAP_OPTIONS, WINDOW_SECTIONS, type WindowConfig, type WindowKey } from '../config/windowSections'

/** 自定义弹窗支持的配置项 */
export type CustomFieldType = 'position' | 'size' | 'gap'

export function useWindowModeSetting() {
  const store = useWindowMode()
  const refs = storeToRefs(store) as Record<string, Ref<any>>

  // —— store 侧映射表 ——
  const storeConfigMap: Record<WindowKey, Ref<any>> = {
    pomodoro: refs.pomodoroMiniWindowConfig,
    notebook: refs.miniNotebookWindowConfig,
    quickNote: refs.quickNoteWindowConfig,
    todo: refs.todoWindowConfig,
    themeConversation: refs.themeConversationMiniWindowConfig,
    accounting: refs.accountingMiniWindowConfig,
    stock: refs.stockMiniWindowConfig,
    clipboard: refs.clipboardWindowConfig,
  }

  const showSetterMap: Record<WindowKey, (val: boolean) => void> = {
    pomodoro: store.setShowPomodoroMiniWindow,
    notebook: store.setShowMiniNotebookWindow,
    quickNote: store.setShowQuickNoteWindow,
    todo: store.setShowTodoWindow,
    themeConversation: store.setShowThemeConversationMiniWindow,
    accounting: store.setShowAccountingMiniWindow,
    stock: store.setShowStockMiniWindow,
    clipboard: store.setShowClipboardWindow,
  }

  const storeVisibleMap: Record<WindowKey, Ref<any>> = {
    pomodoro: refs.showPomodoroMiniWindowC,
    notebook: refs.showMiniNotebookWindowC,
    quickNote: refs.showQuickNoteWindowC,
    todo: refs.showTodoWindowC,
    themeConversation: refs.showThemeConversationMiniWindowC,
    accounting: refs.showAccountingMiniWindowC,
    stock: refs.showStockMiniWindowC,
    clipboard: refs.showClipboardWindowC,
  }

  // —— 页面侧本地副本：store 变化时同步，避免直接改 store 引起连锁更新 ——
  const configMap = {} as Record<WindowKey, Ref<WindowConfig>>
  const shownMap = {} as Record<WindowKey, Ref<boolean>>

  WINDOW_SECTIONS.forEach(({ key }) => {
    const storeConfig = storeConfigMap[key]
    const localConfig = ref<WindowConfig>({ ...storeConfig.value })
    watch(storeConfig, (val) => {
      localConfig.value = { ...val }
    })
    configMap[key] = localConfig

    const storeVisible = storeVisibleMap[key]
    const shown = ref(!!storeVisible.value)
    watch(storeVisible, (val) => {
      shown.value = !!val
    })
    shownMap[key] = shown
  })

  /** 统一写入：本地副本 + store config + 落库（三个动作与原实现一致） */
  function patch(key: WindowKey, data: Partial<WindowConfig>) {
    const section = WINDOW_SECTIONS.find((s) => s.key === key)
    if (!section) return
    const localConfig = configMap[key]
    const storeConfig = storeConfigMap[key]
    localConfig.value = { ...localConfig.value, ...data }
    storeConfig.value = { ...storeConfig.value, ...data }
    setStore(`window-mode:${section.storeKey}`, { ...storeConfig.value })
  }

  function setPosition(key: WindowKey, value: string) {
    patch(key, { position: value })
  }

  function setSize(key: WindowKey, width: number, height: number) {
    patch(key, { width, height })
  }

  function setGap(key: WindowKey, gap: number) {
    patch(key, { gap })
  }

  function setSkin(key: WindowKey, skin: string) {
    patch(key, { skin })
  }

  function setLayout(key: WindowKey, layout: string) {
    patch(key, { layout })
  }

  function setVisible(key: WindowKey, val: boolean) {
    showSetterMap[key](toRaw(val))
  }

  /** 应用：已开启的窗口先关再开（300ms），让新配置生效；未开启则直接打开 */
  function applyWindow(key: WindowKey) {
    if (shownMap[key].value) {
      setVisible(key, false)
      setTimeout(() => setVisible(key, true), 300)
    } else {
      setVisible(key, true)
    }
  }

  // —— 自定义配置弹窗 ——
  const showModal = ref(false)
  const modalType = ref<CustomFieldType>('position')
  const modalTarget = ref<WindowKey>('pomodoro')
  const customPosition = ref({ x: 0, y: 0 })
  const customSize = ref({ width: 0, height: 0 })
  const customGap = ref(30)

  const modalTitle = computed(
    () =>
      ({ position: '自定义位置', size: '自定义尺寸', gap: '自定义间隙' })[modalType.value]
  )

  /**
   * 各小窗当前是否为「自定义值」，用于按钮上展示实际数值。
   * 判定规则与原实现一致：位置为 custom、尺寸不在预设内、间隙不在预设内。
   */
  const customDisplay = computed(() => {
    const result = {} as Record<WindowKey, { position: string; size: string; gap: string }>
    WINDOW_SECTIONS.forEach((section) => {
      const config = configMap[section.key].value
      const isPresetSize = section.sizeOptions.some(
        (s) => s.width === config.width && s.height === config.height
      )
      result[section.key] = {
        position: config.position === 'custom' ? `(${config.x || 0}, ${config.y || 0})` : '',
        size: isPresetSize ? '' : `${config.width || 0}×${config.height || 0}`,
        gap: GAP_OPTIONS.includes(config.gap) ? '' : `${config.gap || 0}px`,
      }
    })
    return result
  })

  function openCustomModal(key: WindowKey, type: CustomFieldType) {
    modalTarget.value = key
    modalType.value = type
    const config = configMap[key].value
    if (type === 'position') {
      customPosition.value = { x: 0, y: 0 }
    } else if (type === 'size') {
      customSize.value = { width: config.width, height: config.height }
    } else {
      customGap.value = config.gap
    }
    showModal.value = true
  }

  function closeModal() {
    showModal.value = false
  }

  /**
   * 提交自定义值：校验通过才写入（校验不通过时只关闭不写入，与原实现一致）。
   * 数值由弹窗收集后传入，弹窗本身不关心目标窗口是哪个。
   */
  function submitCustom(payload: {
    type: CustomFieldType
    x?: number
    y?: number
    width?: number
    height?: number
    gap?: number
  }) {
    const key = modalTarget.value
    if (payload.type === 'position') {
      if ((payload.x ?? -1) >= 0 && (payload.y ?? -1) >= 0) {
        patch(key, { position: 'custom', x: payload.x as number, y: payload.y as number })
      }
    } else if (payload.type === 'size') {
      if ((payload.width ?? 0) > 0 && (payload.height ?? 0) > 0) {
        patch(key, { width: payload.width as number, height: payload.height as number })
      }
    } else if ((payload.gap ?? -1) >= 0) {
      patch(key, { gap: payload.gap as number })
    }
    closeModal()
  }

  return {
    configMap,
    shownMap,
    setPosition,
    setSize,
    setGap,
    setSkin,
    setLayout,
    setVisible,
    applyWindow,
    showModal,
    modalType,
    modalTarget,
    modalTitle,
    customPosition,
    customSize,
    customGap,
    customDisplay,
    openCustomModal,
    closeModal,
    submitCustom,
  }
}
