/**
 * 思维导图 —— 视图意图（画布层的轻量一次性信号 + 弹窗开关）。
 *
 * 存在的意义：把「什么时候该重新适应画布 / 定位到某个节点 / 打开节点属性」
 * 这类**视图层意图**从状态层里摘出来。树的状态（useMindDoc）只关心结构，
 * 本不该知道画布要不要 fitView。
 *
 * fitView / 定位又必须等节点重排完才有意义 —— 于是用「请求 → 消费」的一次性信号：
 *
 *   打开文档 / 新建文档 / 切换布局  →  requestFit()
 *   搜索命中 / 跳转到某节点        →  requestFocus(id)
 *   MindCanvas 在完成重排的那次同步 →  consumeFit() / consumeFocus()
 *
 * ⚠️ 不能改成「每次 revision 变化都 fitView」：那样每敲一个字、每加一个节点
 * 画布都会重新居中，用户正在看的位置会被不断拽走。
 *
 * ⚠️ `focusToken` 是**计数器**：`MindCanvas` 用它和 `revision` 拼成一个监听键，
 *    这样「树没变但只是要定位」（例如命中一个本来就可见的节点）也能触发同步。
 *    如果只监听 `revision`，这种定位会静默不生效。
 */

import { ref } from 'vue'

/** 待消费的「适应画布」请求（模块级单例，与文档状态同生命周期） */
const pendingFit = ref(false)
/** 待消费的「定位到某节点」请求 */
const pendingFocusId = ref('')
/** 定位请求计数器：值变化即代表「有新的一次定位诉求」 */
const focusToken = ref(0)
/** 当前打开「节点属性」弹窗的节点 id（空串 = 关闭） */
const nodePanelId = ref('')

export function useMindView() {
  /* ------------------------------------------------------------ 适应画布 */

  /** 请求下一次重排后适应画布 */
  function requestFit() {
    pendingFit.value = true
  }

  /** 取出并清除请求；返回本次是否需要适应画布 */
  function consumeFit(): boolean {
    if (!pendingFit.value) return false
    pendingFit.value = false
    return true
  }

  /* -------------------------------------------------------------- 定位 */

  /** 请求把画布移到某个节点（搜索跳转 / 定位用） */
  function requestFocus(id: string) {
    if (!id) return
    pendingFocusId.value = id
    focusToken.value += 1
  }

  /** 取出并清除待定位节点 */
  function consumeFocus(): string | undefined {
    const id = pendingFocusId.value
    if (!id) return undefined
    pendingFocusId.value = ''
    return id
  }

  /* ---------------------------------------------------------- 节点属性 */

  /** 打开某个节点的属性弹窗（备注 / 分支色） */
  function openNodePanel(id: string) {
    if (id) nodePanelId.value = id
  }

  function closeNodePanel() {
    if (nodePanelId.value) nodePanelId.value = ''
  }

  return {
    focusToken,
    nodePanelId,
    requestFit,
    consumeFit,
    requestFocus,
    consumeFocus,
    openNodePanel,
    closeNodePanel,
  }
}
