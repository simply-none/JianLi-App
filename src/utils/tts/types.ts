/**
 * TTS 提供商类型
 */
export type TTSProviderType = 'system' | 'web';

/**
 * TTS 配置选项接口
 */
export interface TTSOptions {
  /** 语速，范围 0.5-2，默认 1 */
  rate?: number;
  /** 音调，范围 0-2，默认 1 */
  pitch?: number;
  /** 音量，范围 0-1，默认 1 */
  volume?: number;
  /** 语音名称，可选 */
  voice?: string;
  /** 语言代码，如 'zh-CN' */
  lang?: string;
}

/**
 * 语音信息接口
 */
export interface VoiceInfo {
  /** 语音名称 */
  name: string;
  /** 语音语言 */
  lang: string;
  /** 是否为默认语音 */
  default: boolean;
  /** 是否为本地服务 */
  localService: boolean;
  /** 语音描述 */
  description?: string;
  /** 性别 */
  gender?: 'male' | 'female' | 'neutral';
}

/**
 * TTS 提供商接口
 */
export interface ITTSProvider {
  /** 提供商类型 */
  readonly type: TTSProviderType;
  /**
   * 朗读文本
   * @param text 要朗读的文本
   * @param options TTS 配置选项
   * @returns Promise，朗读完成后 resolve
   */
  speak(text: string, options?: TTSOptions): Promise<void>;
  /**
   * 停止当前朗读
   */
  stop(): void;
  /**
   * 获取可用的语音列表
   * @returns 语音信息数组
   */
  getVoices(): Promise<VoiceInfo[]>;
  /**
   * 检测当前提供商是否可用
   * @returns 是否可用
   */
  isAvailable(): Promise<boolean>;
}

/**
 * TTS 管理器配置接口
 */
export interface TTSManagerConfig {
  /** 默认使用的提供商类型 */
  defaultProvider?: TTSProviderType;
  /** 是否在系统方案不可用时自动降级到 Web 方案 */
  autoFallback?: boolean;
}
