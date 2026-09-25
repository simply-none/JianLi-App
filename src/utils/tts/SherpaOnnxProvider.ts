import type { ITTSProvider, TTSOptions, VoiceInfo, TTSProviderType } from './types';
import { getStoreAsync } from '@/utils/common';

/** 主进程返回的原始语音元信息（sid + 展示字段），name 由基类统一加前缀 */
export interface RawSherpaVoice {
  sid: number;
  description: string;
  lang: string;
  gender?: 'male' | 'female' | 'neutral';
  /** Piper/VITS 多模型下：所属模型标识（voice 名格式 piper|vits:<modelKey>:<sid>） */
  modelKey?: string;
  /** Piper/VITS 多模型下：所属模型目录绝对路径（合成时据此加载对应 onnx） */
  modelDir?: string;
}

export interface SherpaOnnxConfig {
  /** 提供商类型，如 'kokoro' / 'piper' / 'vits' */
  type: TTSProviderType;
  /** window.ipcRenderer.tts[namespace] 子对象名 */
  namespace: 'kokoro' | 'piper' | 'vits';
  /** 渲染端持久化的模型目录 store key */
  storeKey: string;
  /** 语音名前缀，用于从 options.voice 解析 sid（"prefix:<sid>"） */
  voicePrefix: string;
  /** 把主进程返回的原始语音元信息映射为 RawSherpaVoice[]（name → description 等字段统一） */
  mapVoices: (raw: any[]) => RawSherpaVoice[];
}

/**
 * Sherpa-Onnx 系离线 TTS 提供商基类（Kokoro / Piper 共用）
 * 仅负责：模型目录缓存、合成→<audio> 播放、stop、getVoices/isAvailable 转发 IPC。
 * 具体音色表与 sid 解析由各子类通过 config 定制。
 */
export class SherpaOnnxProvider implements ITTSProvider {
  readonly type: TTSProviderType;
  private readonly ns: 'kokoro' | 'piper' | 'vits';
  private readonly storeKey: string;
  private readonly voicePrefix: string;
  protected readonly mapVoices: (raw: any[]) => RawSherpaVoice[];

  private audio: HTMLAudioElement | null = null;
  private synthInFlight = false;
  /** 已持久化的模型目录缓存：undefined = 未读取过 */
  protected cachedModelDir: string | null | undefined = undefined;

  constructor(config: SherpaOnnxConfig) {
    this.type = config.type;
    this.ns = config.namespace;
    this.storeKey = config.storeKey;
    this.voicePrefix = config.voicePrefix;
    this.mapVoices = config.mapVoices;
  }

  /** 取对应 IPC 子对象（kokoro / piper） */
  protected get api(): any {
    return (window.ipcRenderer.tts as any)[this.ns];
  }

  /** 读取（并缓存）用户导入的模型目录，未配置返回 undefined（主进程回退默认目录） */
  protected async resolveModelDir(): Promise<string | undefined> {
    if (this.cachedModelDir === undefined) {
      try {
        const v = await getStoreAsync(this.storeKey);
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

  /** 解析说话人 ID：优先 options.sid；兼容 "prefix:<sid>" 形式的 voice 名 */
  protected resolveSid(options: TTSOptions): number {
    if (typeof options.sid === 'number') return options.sid;
    if (options.voice && options.voice.startsWith(`${this.voicePrefix}:`)) {
      const n = parseInt(options.voice.slice(this.voicePrefix.length + 1), 10);
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
    const modelDir = await this.resolveModelDir();
    await this.synthAndPlay(text, options, modelDir);
  }

  /**
   * 合成并播放（供子类覆盖 speak 时复用，如 Piper 多模型按 voice 选择具体模型目录）
   * @param modelDir 模型目录（绝对路径）；多模型时由子类解析具体模型目录传入
   */
  protected async synthAndPlay(text: string, options: TTSOptions, modelDir: string | undefined): Promise<void> {
    const sid = this.resolveSid(options);
    const speed = options.rate && options.rate > 0 ? options.rate : 1;

    this.synthInFlight = true;
    let res: { success: boolean; url?: string; error?: string };
    try {
      res = await this.api.synthesize(text, { sid, speed, modelDir });
    } finally {
      this.synthInFlight = false;
    }
    if (!res.success || !res.url) {
      throw new Error(res.error || `${this.voicePrefix} 合成失败`);
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
      audio.onerror = () => settle(new Error(`${this.voicePrefix} 音频播放失败`));
      audio.play().catch((err) => settle(err instanceof Error ? err : new Error(String(err))));
    });
  }

  private stopPlayback(): void {
    if (this.audio) {
      try {
        this.audio.pause();
      } catch (err) {
        console.error(`暂停 ${this.voicePrefix} 音频失败:`, err);
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
        this.api.stop();
      } catch (err) {
        console.error(`停止 ${this.voicePrefix} 合成失败:`, err);
      }
    }
  }

  /**
   * 获取可用的语音列表（未安装模型返回空数组）
   * @returns 语音信息数组（name 为 "prefix:<sid>" 形式）
   */
  async getVoices(): Promise<VoiceInfo[]> {
    const modelDir = await this.resolveModelDir();
    try {
      const list = await this.api.getVoices(modelDir);
      return (this.mapVoices(list || [])).map((v) => ({
        name: `${this.voicePrefix}:${v.sid}`,
        lang: v.lang,
        default: false,
        localService: true,
        description: v.description,
        gender: v.gender,
      }));
    } catch {
      return [];
    }
  }

  /**
   * 检测是否可用（模型包已安装且文件完整）
   * @returns 是否可用
   */
  async isAvailable(): Promise<boolean> {
    const modelDir = await this.resolveModelDir();
    try {
      return await this.api.isAvailable(modelDir);
    } catch {
      return false;
    }
  }
}
