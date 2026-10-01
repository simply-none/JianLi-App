/**
 * 思维导图 —— 视图意图（画布层的轻量一次性信号 + 浮层开关）。
 *
 * 存在的意义：把「什么时候该重新适应画布 / 定位到某个节点 / 打开节点属性 / 弹出节点右键菜单」
 * 这类**视图层意图**从状态层里摘出来。树的状态（useMindDoc）只关心结构，
 * 本不该知道画布要不要 fitView、菜单浮在哪个像素上。
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

import { MINIMAP_STORAGE_KEY, OPEN_DOC_STORE_KEY } from '../constants'
import type { MindMenuAnchor } from '../types'

/** 待消费的「适应画布」请求（模块级单例，与文档状态同生命周期） */
const pendingFit = ref(false)
/** 待消费的「定位到某节点」请求 */
const pendingFocusId = ref('')
/** 定位请求计数器：值变化即代表「有新的一次定位诉求」 */
const focusToken = ref(0)
/** 当前打开「节点属性」弹窗的节点 id（空串 = 关闭） */
const nodePanelId = ref('')
/** 当前打开右键菜单的节点 id（空串 = 关闭） */
const menuNodeId = ref('')
/** 右键菜单的视口坐标（相对 window，`position: fixed` 用） */
const menuX = ref(0)
const menuY = ref(0)

/**
 * **分支聚焦**：把某棵子树当作整张图来渲染（空串 = 全图）。
 *
 * ⚠️ 这是**视图状态，不落库**：聚焦只是「换个看法」，不是文档内容。
 *    保存的 JSON 完全不变，重开文档自动回到全图 —— 与 `selectedId` 同级。
 *    因此它也**不进撤销栈**（撤销栈管的是树）。
 */
const focusRootId = ref('')

/** 左侧大纲面板是否展开（同样是视图状态，不落库） */
const outlineOpen = ref(false)
/**
 * 大纲里正在**行内改名**的那一行（空串 = 没有）。
 *
 * ⚠️ 刻意**不复用 `useMindDoc.editingId`**：那个 id 会让画布上的 `MindNode` 同时
 *    渲染内联编辑器 —— 于是「在大纲里改一个字」会连带把画布上的节点也变成输入框，
 *    两处输入框抢同一份草稿。大纲用的是自己的 `<input>`（提交走 `renameNode`），
 *    状态也必须是自己的。
 */
const outlineEditingId = ref('')

/**
 * MiniMap 是否展开 —— **持久化到 localStorage**（不是数据库）。
 * 理由见 `constants.MINIMAP_STORAGE_KEY`：这是本机 UI 偏好，不是文档内容。
 * 初始值在这里同步读一次；读不到就按「默认关闭」处理（大图默认关闭由画布判断）。
 */
function readMinimapPref(): boolean {
  try {
    return window.localStorage.getItem(MINIMAP_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
const minimapOpen = ref(readMinimapPref())

/**
 * **待打开文档**的一次性信号（命令面板「打开指定导图」用）。
 *
 * ⚠️ 为什么光有一个模块级 ref 不够：命令面板跑在**独立小窗**里
 *    （`commandPalette/index.vue`，自己的 JS 运行时、不共享模块单例），
 *    在小窗里写 `pendingOpenId` 主窗口根本看不到。
 *    所以真实的传递链路是**三段**：
 *      ① 小窗把 id 写进主进程的 electron-store（`get-store` / `set-store` 是现成通道，
 *         两个窗口读写同一份）→ ② 小窗发 `palette-navigate` 让主窗口切到导图页
 *         → ③ 导图页挂载时把 id 从 store 取回来并 `openDoc`。
 *    **零主进程改动**，也不需要新增 IPC。
 *
 * 模块级 ref 仍然保留：同窗口路径（例如将来把面板内嵌进主窗口）
 * 走 ref 更直接，两条路径在 `consumeOpen()` 里统一收口。
 */
const pendingOpenId = ref<number | undefined>(undefined)

/**
 * 读主进程 store 里的待打开 id。
 *
 * ⚠️ 全程 `globalThis.window?` 可选链 + try/catch：本文件会被纯逻辑单测
 *    （Node 直载真实 TS）require，那里没有 `window` —— 不能让它抛错。
 *    拿不到就当作「没有待打开文档」，与「主进程通道偶发失败」是同一个降级方向。
 */
function readOpenDocStore(): number | undefined {
  try {
    const ipc = (globalThis as unknown as { window?: { ipcRenderer?: { sendSync?: (channel: string, ...args: unknown[]) => unknown } } }).window?.ipcRenderer
    const raw = ipc?.sendSync?.('get-store', OPEN_DOC_STORE_KEY)
    const id = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(id) && id > 0) return id
  } catch {
    /* 非 Electron 环境 / 通道不可用：忽略 */
  }
  return undefined
}

/** 清掉 store 里的待打开 id（写成空串而不是删键：get-store 对不存在的键也返回空） */
function clearOpenDocStore() {
  try {
    const ipc = (globalThis as unknown as { window?: { ipcRenderer?: { sendSync?: (channel: string, ...args: unknown[]) => unknown } } }).window?.ipcRenderer
    ipc?.sendSync?.('set-store', OPEN_DOC_STORE_KEY, '')
  } catch {
    /* 同上 */
  }
}

/**
 * 右键菜单的**节点锚点**：节点卡片自身的视口矩形（`MindNode.vue` 在右键时顺手量好）。
 *
 * 为什么菜单要额外知道「节点在哪」：光标只是落在节点里的某个随机角落，
 * 用它当翻转基准 ⇒ 同一个节点在左上角右键和在右下角右键会得到差出整个菜单尺寸的落点。
 * 有了锚点矩形，翻转时就能贴着**节点的边缘**展开（下放不下 ⇒ 菜单下缘贴节点上缘），
 * 而不是贴着光标。
 *
 * 拿不到时（键盘 Menu 键、`currentTarget` 异常等）保持 undefined，
 * 由 `MindNodeMenu.place()` 退回「以光标为基准」的旧行为。
 */
const menuAnchor = ref<MindMenuAnchor>()

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

  /* ---------------------------------------------------------- 右键菜单 */

  /**
   * 在鼠标位置打开某个节点的操作菜单。
   *
   * ⚠️ 坐标存的是**视口坐标**（`clientX / clientY`），菜单用 `position: fixed` 定位 ——
   *    不能存画布坐标：画布会平移缩放，存画布坐标就得在打开时反算一次变换，
   *    而菜单本身又跟着视口走，两套坐标混用必然错位。
   *
   * 同一个节点重复右键（换个位置）也要能生效 ⇒ 不能像 `openNodePanel` 那样
   * 「同 id 就短路」，坐标必须每次覆盖。
   *
   * @param anchor 节点卡片自身的视口矩形（可选）。翻转时贴它展开，见 `menuAnchor` 的说明。
   */
  function openNodeMenu(id: string, x: number, y: number, anchor?: MindMenuAnchor) {
    if (!id) return
    menuNodeId.value = id
    menuX.value = x
    menuY.value = y
    menuAnchor.value = anchor
  }

  function closeNodeMenu() {
    if (menuNodeId.value) menuNodeId.value = ''
  }

  /* -------------------------------------------------------- 分支聚焦 */

  /**
   * 聚焦到某棵子树（把它当作整张图渲染）。
   *
   * @param id 目标节点；传根节点等同于「退出聚焦」（聚焦整张图没有意义）
   *
   * 进入 / 退出都请求一次 `fitView`：聚焦前后内容范围差别极大（可能从一整棵树
   * 缩到两三个节点），不重适应的话用户会对着空画布发愣 ——
   * 这与「打开/新建/切布局」需要 re-fit 是同一个道理。
   */
  function enterFocus(id: string) {
    if (!id || id === focusRootId.value) return
    focusRootId.value = id
    requestFit()
  }

  function exitFocus() {
    if (!focusRootId.value) return
    focusRootId.value = ''
    requestFit()
  }

  /* ---------------------------------------------------------- 大纲 */

  function toggleOutline() {
    outlineOpen.value = !outlineOpen.value
    // 收起面板时顺手结束行内编辑：留着 editingId 会让「下次展开」时突然冒出一个输入框
    if (!outlineOpen.value) outlineEditingId.value = ''
  }

  /** 开始 / 结束大纲行内改名（同一时刻只允许一行） */
  function beginOutlineEdit(id: string) {
    outlineEditingId.value = id
  }

  function endOutlineEdit() {
    if (outlineEditingId.value) outlineEditingId.value = ''
  }

  /* -------------------------------------------------------- MiniMap */

  function setMinimapOpen(value: boolean) {
    minimapOpen.value = value
    try {
      window.localStorage.setItem(MINIMAP_STORAGE_KEY, value ? '1' : '0')
    } catch {
      /* 隐私模式 / 存储被禁：只当本次会话生效，不打断功能 */
    }
  }

  function toggleMinimap() {
    setMinimapOpen(!minimapOpen.value)
  }

  /* -------------------------------------------------- 待打开文档信号 */

  /**
   * 请求「载入某份导图」。
   *
   * 同时写进模块级 ref（同窗口）与主进程 store（跨窗口，见 `OPEN_DOC_STORE_KEY`）——
   * 两条路径都写，是因为调用方（命令面板）不知道自己跑在哪个窗口里，
   * 而两种写法的代价都近乎为零，读的一侧只要认「先 ref 后 store」即可。
   */
  function requestOpen(id: number) {
    if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) return
    pendingOpenId.value = id
    try {
      const ipc = (globalThis as unknown as { window?: { ipcRenderer?: { sendSync?: (channel: string, ...args: unknown[]) => unknown } } }).window?.ipcRenderer
      ipc?.sendSync?.('set-store', OPEN_DOC_STORE_KEY, String(id))
    } catch {
      /* 非 Electron 环境：只当同窗口路径生效 */
    }
  }

  /**
   * 取出并清除待打开 id —— **一次性**语义，取完即空，连开两次不会重入。
   *
   * 取值顺序：「先 ref，后 store」。同一窗口里两条都可能有值（requestOpen 两边都写），
   * 此时 ref 是更新的那个；只在跨窗口时 ref 才为空、需要落到 store。
   * 只要取到了就**两边都清**，避免残留一个 id 让「下次进入导图页莫名切了文档」。
   */
  function consumeOpen(): number | undefined {
    const fromRef = typeof pendingOpenId.value === 'number' ? pendingOpenId.value : undefined
    pendingOpenId.value = undefined
    const id = fromRef ?? readOpenDocStore()
    if (typeof id === 'number') clearOpenDocStore()
    return id
  }

  return {
    focusToken,
    nodePanelId,
    menuNodeId,
    menuX,
    menuY,
    menuAnchor,
    focusRootId,
    outlineOpen,
    outlineEditingId,
    minimapOpen,
    pendingOpenId,
    requestFit,
    consumeFit,
    requestFocus,
    consumeFocus,
    openNodePanel,
    closeNodePanel,
    openNodeMenu,
    closeNodeMenu,
    enterFocus,
    exitFocus,
    toggleOutline,
    beginOutlineEdit,
    endOutlineEdit,
    setMinimapOpen,
    toggleMinimap,
    requestOpen,
    consumeOpen,
  }
}
