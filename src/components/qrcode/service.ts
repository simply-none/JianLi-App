/**
 * 二维码命令式服务（L2 复用入口）
 * ------------------------------------------------------------------
 * 其它业务模块（如名片、Wi-Fi 分享、习惯打卡）只需：
 *   import { showQrCode } from '@/components/qrcode/service';
 *   showQrCode({ content: '...', title: '分享 Wi-Fi' });
 * 即可弹出一个自带「下载/复制/存文本」的二维码对话框，无需在模板里挂组件。
 *
 * 实现：用 createApp 把 QrCodeDialog 挂到一个临时容器，
 * 由于 QrCodeDialog 依赖 el-dialog，这里单独 app.use(ElementPlus)。
 * 容器插入 body，关闭时自动卸载并清理 DOM。
 */
import { createApp, type App } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import QrCodeDialog from './QrCodeDialog.vue';
import type { QrStyleOptions } from '@/utils/qrcode';

export interface ShowQrCodeOptions {
  /** 二维码原始文本（必填） */
  content: string;
  /** 弹窗标题 */
  title?: string;
  /** 视觉样式 */
  styleOptions?: QrStyleOptions | null;
  /** 建议文件名（不含扩展名） */
  defaultName?: string;
  /** 像素尺寸 */
  size?: number;
}

export interface QrCodeHandle {
  /** 关闭并卸载弹窗 */
  close: () => void;
  /** 对应的 Vue 应用实例 */
  app: App;
}

/**
 * 命令式弹出二维码对话框。
 * @returns 句柄（含 close()）
 */
export function showQrCode(options: ShowQrCodeOptions): QrCodeHandle {
  const host = document.createElement('div');
  host.className = 'qr-code-service-host';
  document.body.appendChild(host);

  const unmount = () => {
    app.unmount();
    host.remove();
  };

  const app = createApp(QrCodeDialog, {
    modelValue: true,
    content: options.content,
    title: options.title ?? '二维码',
    styleOptions: options.styleOptions ?? null,
    defaultName: options.defaultName ?? 'qrcode',
    size: options.size ?? 320,
    // Vue3：通过 onXxx 形式的 props 注册事件监听，替代已废弃的 $on
    'onUpdate:modelValue': (v: boolean) => {
      if (v === false) unmount();
    },
  });
  app.use(ElementPlus);
  app.mount(host);

  return {
    app,
    close: unmount,
  };
}
