import { h, type VNode } from 'vue';
import { ElMessage } from 'element-plus';

/**
 * 通用「保存/导出成功」消息提示（可复用公共内容）。
 * ------------------------------------------------------------------
 * - 顶部居中展示（ElMessage 默认 top-center），默认持续 5 秒。
 * - 文件路径以蓝色可点击样式呈现；**整条提示都是点击热区**，
 *   点击后跳到系统资源管理器并选中该文件（复用现有 IPC）。
 * - 样式自注入，避免散落到各业务组件，便于后续其它模块统一调用。
 *
 * ⚠️ 为什么用「事件委托」而不是给 VNode 挂 onClick：
 *   ElMessage 的内容被塞进 `.el-message__content`（一个 <p>），而提示自身还有
 *   11×15 的内边距、左边图标、右边关闭按钮。若把 onClick 只挂在路径 <span> 上，
 *   用户点在标题 / 行尾空白 / 提示内边距上都会「毫无反应」——
 *   而用户的心智模型是「点这条提示 → 跳过去」，于是就会判定「功能坏了」。
 *   委托到 document（捕获阶段）后，整条提示（含内边距）都能响应，
 *   也不再依赖 Element Plus 内部的插槽/DOM 结构。
 */

/** 顶部消息提示默认持续时间（毫秒） */
export const FILE_NOTIFY_DURATION = 5000;

let styleInjected = false;
function ensureStyle() {
  if (styleInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.setAttribute('data-file-notify', '');
  style.textContent = `
.file-notify-message {
  /* 整条提示可点，给出明确的可点击反馈 */
  cursor: pointer;
}
.file-notify-message .el-message__closeBtn {
  cursor: pointer;
}
.file-notify-path {
  color: #2563eb !important;
  cursor: pointer;
  text-decoration: underline;
  word-break: break-all;
}
.file-notify-path:hover {
  color: #1d4ed8 !important;
}
.file-notify-title {
  font-weight: 600;
  margin-right: 4px;
}
`;
  document.head.appendChild(style);
  styleInjected = true;
}

/**
 * 在系统资源管理器中定位并选中文件。
 * 复用主进程已有的 open-file-in-assets-manager 通道（主进程内部走 Electron 原生
 * `shell.showItemInFolder`，跨平台、原生支持中文路径）；无需新增主进程 IPC。
 * 失败在主进程打日志，渲染端静默忽略（无权限场景）。
 */
export function revealInExplorer(filePath?: string) {
  if (!filePath) return;
  try {
    window.ipcRenderer.send('open-file-in-assets-manager', { path: filePath });
  } catch {
    /* 渲染进程无权限时忽略 */
  }
}

/**
 * 一次性安装「点提示 → 定位文件」的事件委托（捕获阶段）。
 * 用捕获阶段是为了不受上层元素的 stopPropagation 影响。
 */
let delegateInstalled = false;
function ensureDelegate() {
  if (delegateInstalled || typeof document === 'undefined') return;
  document.addEventListener(
    'click',
    (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function') return;
      // 点关闭按钮只关闭，不跳转
      if (target.closest('.el-message__closeBtn')) return;
      const box = target.closest('.file-notify-message');
      if (!box) return;
      const path = box.querySelector('.file-notify-path')?.getAttribute('data-path');
      if (path) revealInExplorer(path);
    },
    true,
  );
  delegateInstalled = true;
}

export interface FileNotifyOptions {
  /** 通知标题，默认「保存成功」 */
  title?: string;
  /** 通知正文（不含文件路径时也会展示） */
  message?: string;
  /** 保存后的文件绝对路径；存在时整条提示可点击，并在其中渲染蓝色路径文本 */
  filePath?: string;
  /** 持续时间（毫秒），默认 5 秒 */
  duration?: number;
}

/**
 * 顶部居中消息提示：保存成功后告知用户文件位置，并支持一键在资源管理器打开。
 * @example
 *   fileNotify({ title: '二维码已保存', filePath: res.path });
 */
export function fileNotify(opts: FileNotifyOptions) {
  const {
    title = '保存成功',
    message,
    filePath,
    duration = FILE_NOTIFY_DURATION,
  } = opts;
  ensureStyle();
  if (filePath) ensureDelegate();

  const children: (string | VNode)[] = [];
  children.push(h('span', { class: 'file-notify-title' }, title));
  if (message) children.push(message + (filePath ? '：' : ''));
  if (filePath) {
    // data-path 供上面的委托监听读取（避免闭包挂在 VNode 上，见文件头说明）
    children.push(h('span', { class: 'file-notify-path', 'data-path': filePath }, filePath));
  }

  ElMessage({
    type: 'success',
    message: () => h('span', { class: 'file-notify-msg' }, children),
    // 整条提示的可点击样式与委托命中标记
    customClass: filePath ? 'file-notify-message' : undefined,
    duration,
    placement: 'top',
    showClose: true,
    offset: 20,
  });
}
