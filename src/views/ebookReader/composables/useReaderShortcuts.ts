/**
 * 阅读器通用键盘快捷键 composable（TXT / EPUB / PDF 三格式复用）
 *
 * 统一处理「按键 → 意图」的转交与三道闸：
 *   1. IME 安全（isComposing / keyCode 229）不触发；
 *   2. 输入类元素（input/textarea/select/contenteditable）上不触发——
 *      修复「搜索框/笔记弹窗里按左右键打字会连带翻页」的缺陷；
 *   3. Space 例外：按钮/链接聚焦时 Space 是激活键，让位给默认行为。
 *
 * 按键表：←/→、PgUp/PgDn（翻页）；Space / Shift+Space（下/上一页，翻页模式下）；
 * Home/End（跳书首/书尾）；Ctrl+= / Ctrl+- / Ctrl+0（缩放或字号，handler 提供才生效）。
 */
import { onMounted, onUnmounted } from 'vue';

export interface ReaderShortcutHandlers {
  /** 上一页 */
  prev: () => void;
  /** 下一页 */
  next: () => void;
  /** 跳到书首（Home），不提供则不响应 Home */
  jumpStart?: () => void;
  /** 跳到书尾（End），不提供则不响应 End */
  jumpEnd?: () => void;
  /** 放大（Ctrl+=，PDF 为缩放、EPUB 为增大字号），不提供则不响应 */
  zoomIn?: () => void;
  /** 缩小（Ctrl+-） */
  zoomOut?: () => void;
  /** 复位（Ctrl+0，PDF 复位适应方式；EPUB 不提供） */
  zoomReset?: () => void;
}

export interface ReaderShortcutOptions {
  /** Space 是否翻页：滚动模式下返回 false 保留原生滚动（每次按键实时求值） */
  spaceAsNext?: () => boolean;
}

export function useReaderShortcuts(
  handlers: ReaderShortcutHandlers,
  options?: ReaderShortcutOptions
) {
  /** 输入类元素判定：这些元素上的一切快捷键都不触发 */
  function isTypingTarget(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (t.isContentEditable) return true;
    // Space 会激活按钮/链接，避免「翻页 + 按钮触发」双重行为
    if (tag === 'BUTTON' || tag === 'A' || t.getAttribute('role') === 'button') return true;
    return false;
  }

  function onKeydown(e: KeyboardEvent) {
    // IME 组合中不处理（中文输入法选字时的按键必须让位）
    if (e.isComposing || e.keyCode === 229) return;
    const t = e.target as HTMLElement | null;
    const tag = t?.tagName || '';
    // 输入框内仅放行 Ctrl 组合之外的一切按键（不翻页不缩放）
    const typing =
      !!t &&
      (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable);
    if (typing) return;

    // Ctrl/Cmd 组合：缩放（PDF）/ 字号（EPUB）
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '=' || e.key === '+') {
        if (handlers.zoomIn) {
          e.preventDefault();
          handlers.zoomIn();
        }
        return;
      }
      if (e.key === '-') {
        if (handlers.zoomOut) {
          e.preventDefault();
          handlers.zoomOut();
        }
        return;
      }
      if (e.key === '0') {
        if (handlers.zoomReset) {
          e.preventDefault();
          handlers.zoomReset();
        }
        return;
      }
      return;
    }
    if (e.altKey) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        handlers.prev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        handlers.next();
        break;
      case 'PageUp':
        e.preventDefault();
        handlers.prev();
        break;
      case 'PageDown':
        e.preventDefault();
        handlers.next();
        break;
      case 'Home':
        if (handlers.jumpStart) {
          e.preventDefault();
          handlers.jumpStart();
        }
        break;
      case 'End':
        if (handlers.jumpEnd) {
          e.preventDefault();
          handlers.jumpEnd();
        }
        break;
      case ' ':
      case 'Spacebar': {
        // 滚动模式下 Space 保留原生滚动语义
        if (options?.spaceAsNext && !options.spaceAsNext()) return;
        e.preventDefault();
        if (e.shiftKey) handlers.prev();
        else handlers.next();
        break;
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown));
  onUnmounted(() => window.removeEventListener('keydown', onKeydown));

  return { onKeydown };
}
