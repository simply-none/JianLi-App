import { onBeforeUnmount, onMounted } from 'vue'

export interface PaletteKeyHandlers {
  onEscape: () => void
  onMoveDown: () => void
  onMoveUp: () => void
  onEnter: () => void
  /**
   * 退格键：返回 true 表示已处理（会 preventDefault）。
   * 用于「输入只剩一个作用域前缀时，一次退格清掉整个前缀」。
   */
  onBackspace?: (value: string) => boolean
}

/**
 * 键盘监听统一挂在 document 上，而不是输入框。
 * 原因：点击结果项后输入框会失焦，挂在输入框上的方向键 / Enter / Esc 会全部失效。
 */
export function usePaletteKeyboard(handlers: PaletteKeyHandlers) {
  function onKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        handlers.onEscape()
        break
      case 'ArrowDown':
        e.preventDefault()
        handlers.onMoveDown()
        break
      case 'ArrowUp':
        e.preventDefault()
        handlers.onMoveUp()
        break
      case 'Enter':
        e.preventDefault()
        handlers.onEnter()
        break
      case 'Backspace':
        // 其余情况放行给输入框，让它正常删字符
        if (handlers.onBackspace?.((e.target as HTMLInputElement)?.value ?? '')) {
          e.preventDefault()
        }
        break
      default:
        break
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
  })
}
