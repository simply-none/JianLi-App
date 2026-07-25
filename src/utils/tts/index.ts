import type { ITTSProvider, TTSManagerConfig, TTSOptions, TTSProviderType, VoiceInfo } from './types';
import { SystemTTSProvider } from './SystemTTSProvider';
import { WebTTSProvider } from './WebTTSProvider';

/**
 * TTS 管理器
 * 统一管理多种 TTS 提供商，支持动态切换和自动降级
 */
export class TTSManager {
  /** 系统 TTS 提供商 */
  private systemProvider: ITTSProvider;
  /** Web TTS 提供商 */
  private webProvider: ITTSProvider;
  /** 当前使用的提供商类型 */
  private currentProviderType: TTSProviderType;
  /** 配置 */
  private config: Required<TTSManagerConfig>;
  /** 当前正在朗读的 promise */
  private currentSpeakPromise: Promise<void> | null = null;

  constructor(config: TTSManagerConfig = {}) {
    this.systemProvider = new SystemTTSProvider();
    this.webProvider = new WebTTSProvider();
    this.config = {
      defaultProvider: config.defaultProvider || 'system',
      autoFallback: config.autoFallback !== false,
    };
    this.currentProviderType = this.config.defaultProvider;
  }

  /**
   * 获取指定类型的提供商
   * @param type 提供商类型
   * @returns TTS 提供商
   */
  private getProviderByType(type: TTSProviderType): ITTSProvider {
    switch (type) {
      case 'system':
        return this.systemProvider;
      case 'web':
        return this.webProvider;
      default:
        return this.systemProvider;
    }
  }

  /**
   * 获取当前提供商
   * @returns 当前使用的 TTS 提供商
   */
  private getCurrentProvider(): ITTSProvider {
    return this.getProviderByType(this.currentProviderType);
  }

  /**
   * 切换 TTS 提供商
   * @param type 提供商类型
   */
  setProvider(type: TTSProviderType): void {
    this.stop();
    this.currentProviderType = type;
  }

  /**
   * 获取当前提供商类型
   * @returns 当前提供商类型
   */
  getProviderType(): TTSProviderType {
    return this.currentProviderType;
  }

  /**
   * 朗读文本
   * @param text 要朗读的文本
   * @param options TTS 配置选项
   * @returns Promise，朗读完成后 resolve
   */
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    this.stop();

    const provider = this.getCurrentProvider();

    try {
      this.currentSpeakPromise = provider.speak(text, options);
      await this.currentSpeakPromise;
    } catch (err) {
      // 如果当前是系统方案且启用了自动降级，则尝试 Web 方案
      if (
        this.currentProviderType === 'system' &&
        this.config.autoFallback
      ) {
        console.warn('系统 TTS 失败，尝试降级到 Web TTS:', err);
        try {
          this.currentSpeakPromise = this.webProvider.speak(text, options);
          await this.currentSpeakPromise;
        } catch (fallbackErr) {
          throw new Error(`所有 TTS 方案均失败: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`);
        }
      } else {
        throw err;
      }
    } finally {
      this.currentSpeakPromise = null;
    }
  }

  /**
   * 停止当前朗读
   */
  stop(): void {
    this.getCurrentProvider().stop();
    this.currentSpeakPromise = null;
  }

  /**
   * 获取可用的语音列表
   * @returns 语音信息数组
   */
  async getVoices(): Promise<VoiceInfo[]> {
    const provider = this.getCurrentProvider();
    return await provider.getVoices();
  }

  /**
   * 获取所有提供商的语音列表
   * @returns 包含提供商类型和语音列表的对象
   */
  async getAllVoices(): Promise<Record<TTSProviderType, VoiceInfo[]>> {
    const [systemVoices, webVoices] = await Promise.all([
      this.systemProvider.getVoices().catch(() => []),
      this.webProvider.getVoices().catch(() => []),
    ]);
    return {
      system: systemVoices,
      web: webVoices,
    };
  }

  /**
   * 检测各提供商是否可用
   * @returns 包含可用性状态的对象
   */
  async checkAvailability(): Promise<Record<TTSProviderType, boolean>> {
    const [systemAvailable, webAvailable] = await Promise.all([
      this.systemProvider.isAvailable().catch(() => false),
      this.webProvider.isAvailable().catch(() => true),
    ]);
    return {
      system: systemAvailable,
      web: webAvailable,
    };
  }

  /**
   * 初始化并检测默认提供商可用性
   * 如果默认的系统方案不可用且启用了自动降级，则尝试其他方案
   */
  async initialize(): Promise<void> {
    const availability = await this.checkAvailability();

    if (!availability[this.currentProviderType]) {
      if (this.config.autoFallback) {
        // 按优先级尝试降级：系统 -> Web -> 系统
        const fallbackOrder: TTSProviderType[] = ['web', 'system'];
        
        for (const fallbackType of fallbackOrder) {
          if (fallbackType !== this.currentProviderType && availability[fallbackType]) {
            console.info(`TTS: ${this.currentProviderType} 不可用，自动切换到 ${fallbackType}`);
            this.currentProviderType = fallbackType;
            break;
          }
        }
      } else {
        console.warn(`TTS: ${this.currentProviderType} 不可用，自动降级已禁用`);
      }
    }
  }
}

// 导出单例实例
let ttsManagerInstance: TTSManager | null = null;

/**
 * 获取 TTS 管理器单例
 * @param config 可选的配置参数（仅首次调用时生效）
 * @returns TTS 管理器实例
 */
export function getTTSManager(config?: TTSManagerConfig): TTSManager {
  if (!ttsManagerInstance) {
    ttsManagerInstance = new TTSManager(config);
  }
  return ttsManagerInstance;
}

export type { ITTSProvider, TTSOptions, TTSProviderType, VoiceInfo, TTSManagerConfig };
export { SystemTTSProvider, WebTTSProvider };
