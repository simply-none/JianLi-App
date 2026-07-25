import type { ITTSProvider, TTSOptions, VoiceInfo } from './types';

/**
 * System TTS 提供商实现
 * 通过 IPC 调用 Electron 主进程的 say 库
 */
export class SystemTTSProvider implements ITTSProvider {
  readonly type = 'system' as const;

  /**
   * 朗读文本
   * @param text 要朗读的文本
   * @param options TTS 配置选项
   * @returns Promise，朗读完成后 resolve
   */
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    try {
      const result = await window.ipcRenderer.tts.speak(text, options);
      if (!result.success) {
        throw new Error(result.error || '系统 TTS 朗读失败');
      }
    } catch (err) {
      throw new Error(`系统 TTS 调用失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * 停止当前朗读
   */
  stop(): void {
    try {
      window.ipcRenderer.tts.stop();
    } catch (err) {
      console.error('停止系统 TTS 失败:', err);
    }
  }

  /**
   * 获取可用的语音列表
   * @returns 语音信息数组
   */
  async getVoices(): Promise<VoiceInfo[]> {
    try {
      const voiceNames = await window.ipcRenderer.tts.system.getVoices();
      // say 库返回的是语音名称字符串数组
      return voiceNames.map((name: string) => ({
        name,
        lang: 'zh-CN', // 系统默认中文
        default: false,
        localService: true,
      }));
    } catch {
      return [];
    }
  }

  /**
   * 检测系统 TTS 是否可用
   * @returns 是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await window.ipcRenderer.tts.system.isAvailable();
    } catch {
      return false;
    }
  }
}
