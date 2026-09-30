/**
 * 思维导图 —— 全局快捷键（挂在 window 上，随页面挂载 / 卸载）。
 *
 * 设计上只做「按键 → 意图」的映射，不写任何业务策略：
 *   删除要不要弹确认、没有选中节点时怎么办 —— 这些都在 useMindActions 里，
 *   否则工具条按钮与快捷键会各有一套行为（本项目最忌讳的就是这种不一致）。
 *
 * 三条必须守住的规则，少一条都会出「莫名其妙」的毛病：
 * 1. **输入法安全**：组合期间的按键（isComposing / keyCode 229）一律放行，
 *    否则中文选词的 Enter、数字选字的数字键都会变成建节点 / 删节点。
 * 2. **不抢输入框**：焦点在 INPUT / TEXTAREA / SELECT / contenteditable 上时直接返回，
 *    否则工具条里改文档名一个 Backspace 就把选中节点删了。
 * 3. **内联编辑优先**：editingId 非空时整体让位（编辑框自己 `@keydown.stop`，
 *    这里的判断是双保险，防止事件从别的路径漏上来）。
 *
 * 绑定列表必须与 constants.SHORTCUT_HINTS 保持一致（帮助弹窗直接渲染那份文案）。
 */

import type { NavDirection } from '../utils/tree'
import { useMindDoc } from './useMindDoc'
import { useMindSearch } from './useMindSearch'

export interface MindShortcutHandlers {
  /** Ctrl/Cmd + S：保存 */
  save: () => void
  /** Ctrl/Cmd + 0：适应画布 */
  fit: () => void
  /** Delete / Backspace：删除选中节点（含确认策略，由调用方提供） */
  remove: () => void
}

/** 焦点是否落在可输入元素上（这类元素里的按键属于用户输入，不是快捷键） */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function useMindShortcuts(handlers: MindShortcutHandlers) {
  const mind = useMindDoc()
  // 撤销 / 重做 / 搜索都是「纯状态操作、没有确认策略」，直接在这里调；
  // 只有 删除 / 保存 / 适应画布 这些需要与工具条共享策略的才走 handlers。
  const search = useMindSearch()

  /** 折叠 / 展开选中节点 */
  function foldSelection() {
    const id = mind.selectedId.value
    if (!id) return
    mind.toggleFold(id)
  }

  function move(dir: NavDirection) {
    mind.moveSelection(dir)
  }

  function onKeydown(event: KeyboardEvent) {
    // 规则 1：输入法组合中
    if (event.isComposing || event.keyCode === 229) return
    // 规则 3：正在内联编辑
    if (mind.editingId.value) return
    // 规则 2：焦点在输入控件上
    if (isTypingTarget(event.target)) return

    const mod = event.ctrlKey || event.metaKey

    // ---- 带修饰键：只认领自己那几个，其余放行给应用 / 浏览器 ----
    if (mod) {
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        handlers.save()
        return
      }
      if (key === '0') {
        event.preventDefault()
        handlers.fit()
        return
      }
      if (key === 'a') {
        event.preventDefault()
        mind.toggleFoldAll()
        return
      }
      if (key === 'z') {
        // Shift 决定方向：Ctrl+Z 撤销、Ctrl+Shift+Z 重做
        event.preventDefault()
        if (event.shiftKey) mind.redo()
        else mind.undo()
        return
      }
      if (key === 'y') {
        event.preventDefault()
        mind.redo()
        return
      }
      if (key === 'f') {
        event.preventDefault()
        search.toggle()
        return
      }
      return
    }
    if (event.altKey) return

    switch (event.key) {
      case 'Tab':
        event.preventDefault()
        mind.addChild()
        return
      case 'Enter':
        event.preventDefault()
        mind.addSibling()
        return
      case 'F2': {
        event.preventDefault()
        const id = mind.selectedId.value
        if (id) mind.beginEdit(id)
        return
      }
      case 'Delete':
      case 'Backspace':
        event.preventDefault()
        handlers.remove()
        return
      case ' ':
      case 'Spacebar':
        event.preventDefault()
        foldSelection()
        return
      case 'ArrowUp':
        event.preventDefault()
        move('prev')
        return
      case 'ArrowDown':
        event.preventDefault()
        move('next')
        return
      case 'ArrowLeft':
        event.preventDefault()
        move('parent')
        return
      case 'ArrowRight':
        event.preventDefault()
        move('firstChild')
        return
      default:
        return
    }
  }

  function attach() {
    window.addEventListener('keydown', onKeydown)
  }

  function detach() {
    window.removeEventListener('keydown', onKeydown)
  }

  return { attach, detach }
}
