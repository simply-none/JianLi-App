import { h, type VNode } from 'vue';
import { ElMessage } from 'element-plus';

/**
 * 通用「保存/导出成功」消息提示（可复用公共内容）。
 * ------------------------------------------------------------------
 * - 顶部居中展示（ElMessage 默认 top-center），默认持续 5 秒。
 * - 文件路径以蓝色可点击样式呈现；点击路径会跳到系统资源管理器
 *   并选中该文件（复用现有 IPC）。
 * - 样式自注入，避免散落到各业务组件，便于后续其它模块统一调用。
 */

/** 顶部消息提示默认持续时间（毫秒） */
export const FILE_NOTIFY_DURATION = 5000;

let styleInjected = false;
function ensureStyle() {
  if (styleInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.setAttribute('data-file-notify', '');
  style.textContent = `
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
 * 复用主进程已有的 open-file-in-assets-manager 通道（windows: explorer /select），
 * 无需新增主进程 IPC；失败静默忽略。
 */
export function revealInExplorer(filePath?: string) {
  if (!filePath) return;
  try {
    window.ipcRenderer.send('open-file-in-assets-manager', { path: filePath });
  } catch {
    /* 渲染进程无权限时忽略 */
  }
}

export interface FileNotifyOptions {
  /** 通知标题，默认「保存成功」 */
  title?: string;
  /** 通知正文（不含文件路径时也会展示） */
  message?: string;
  /** 保存后的文件绝对路径；存在时渲染为蓝色可点击路径 */
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

  const children: (string | VNode)[] = [];
  children.push(h('span', { class: 'file-notify-title' }, title));
  if (message) children.push(message + (filePath ? '：' : ''));
  if (filePath) {
    children.push(
      h(
        'span',
        {
          class: 'file-notify-path',
          title: filePath,
          onClick: (e: MouseEvent) => {
            e.stopPropagation();
            revealInExplorer(filePath);
          },
        },
        filePath,
      ),
    );
  }

  ElMessage({
    type: 'success',
    message: () => h('span', { class: 'file-notify-msg' }, children),
    duration,
    placement: 'top',
    showClose: true,
    offset: 20,
  });
}
