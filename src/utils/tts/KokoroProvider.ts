import type { ITTSProvider, TTSOptions, VoiceInfo } from './types';
import { getStoreAsync } from '@/utils/common';

/**
 * Kokoro 本地离线 TTS 提供商实现
 * 通过 IPC 调用主进程 sherpa-onnx（worker_threads）合成 WAV，再用 <audio> 播放。
 * 语音包模型目录在主进程校验，渲染端仅负责持久化用户选择的目录。
 */
export class KokoroProvider implements ITTSProvider {
  readonly type = 'kokoro' as const;

  /** 当前播放中的音频（stop 时暂停） */
  private audio: HTMLAudioElement | null = null;
  /** 是否有合成请求在途（决定 stop 是否要终止 worker） */
  private synthInFlight = false;
  /** 已持久化的模型目录缓存：null = 未读取过 / 无配置 */
  private cachedModelDir: string | null | undefined = undefined;

  /** 渲染端 store key：用户导入的模型目录 */
  static readonly MODEL_DIR_STORE_KEY = 'tts_kokoro_model_dir';

  /** 读取（并缓存）用户导入的模型目录，未配置返回 undefined（主进程回退默认目录） */
  private async resolveModelDir(): Promise<string | undefined> {
    if (this.cachedModelDir === undefined) {
      try {
        const v = await getStoreAsync(KokoroProvider.MODEL_DIR_STORE_KEY);
        this.cachedModelDir = typeof v === 'string' && v ? v : null;
      } catch {
        this.cachedModelDir = null;
      }
    }
    return this.cachedModelDir || undefined;
  }

  /** 导入新目录后调用，刷新缓存 */
  invalidateModelDirCache(): void {
    this.cachedModelDir = undefined;
  }

  /** 解析说话人 ID：优先 options.sid；兼容 "kokoro:35" 形式的 voice 名 */
  private resolveSid(options: TTSOptions): number {
    if (typeof options.sid === 'number') return options.sid;
    if (options.voice && options.voice.startsWith('kokoro:')) {
      const n = parseInt(options.voice.slice(7), 10);
      if (!Number.isNaN(n)) return n;
    }
    return 0;
  }

  /**
   * 朗读文本
   * @param text 要朗读的文本
   * @param options TTS 配置选项（sid / voice 可选音色，rate 映射为 speed）
   * @returns Promise，播放完成后 resolve
   */
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    const sid = this.resolveSid(options);
    const speed = options.rate && options.rate > 0 ? options.rate : 1;
    const modelDir = await this.resolveModelDir();

    this.synthInFlight = true;
    let res: { success: boolean; url?: string; error?: string };
    try {
      res = await window.ipcRenderer.tts.kokoro.synthesize(text, { sid, speed, modelDir });
    } finally {
      this.synthInFlight = false;
    }
    if (!res.success || !res.url) {
      throw new Error(res.error || 'Kokoro 合成失败');
    }
    await this.playUrl(res.url);
  }

  /** 播放主进程合成的 WAV 文件（file:// URL），播放结束/出错时收尾 */
  private playUrl(url: string): Promise<void> {
    this.stopPlayback();
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      this.audio = audio;
      const settle = (err?: Error) => {
        if (this.audio === audio) this.audio = null;
        err ? reject(err) : resolve();
      };
      audio.onended = () => settle();
      audio.onerror = () => settle(new Error('Kokoro 音频播放失败'));
      audio.play().catch((err) => settle(err instanceof Error ? err : new Error(String(err))));
    });
  }

  private stopPlayback(): void {
    if (this.audio) {
      try {
        this.audio.pause();
      } catch (err) {
        console.error('暂停 Kokoro 音频失败:', err);
      }
      this.audio = null;
    }
  }

  /**
   * 停止当前朗读：立即暂停音频；若合成仍在途则终止 worker
   * （generate 是同步调用无法软中断；worker 被终止后下次合成需重新加载模型）
   */
  stop(): void {
    this.stopPlayback();
    if (this.synthInFlight) {
      try {
        window.ipcRenderer.tts.kokoro.stop();
      } catch (err) {
        console.error('停止 Kokoro 合成失败:', err);
      }
    }
  }

  /**
   * 获取可用的语音列表（未安装模型返回空数组）
   * @returns 语音信息数组（name 为 "kokoro:<sid>" 形式）
   */
  async getVoices(): Promise<VoiceInfo[]> {
    const modelDir = await this.resolveModelDir();
    try {
      const list = await window.ipcRenderer.tts.kokoro.getVoices(modelDir);
      return (list || []).map((v) => ({
        name: `kokoro:${v.sid}`,
        lang: v.lang,
        default: false,
        localService: true,
        description: v.name,
        gender: v.gender,
      }));
    } catch {
      return [];
    }
  }

  /**
   * 检测 Kokoro 是否可用（模型包已安装且文件完整）
   * @returns 是否可用
   */
  async isAvailable(): Promise<boolean> {
    const modelDir = await this.resolveModelDir();
    try {
      return await window.ipcRenderer.tts.kokoro.isAvailable(modelDir);
    } catch {
      return false;
    }
  }
}
