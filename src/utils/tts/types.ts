/**
 * TTS 提供商类型
 * - system: 系统 TTS（say 库）
 * - web: Web Speech API（渲染进程）
 * - kokoro: Kokoro 本地离线模型（sherpa-onnx + worker_threads，需安装模型包）
 * - piper: Piper 本地离线模型（sherpa-onnx VITS，复用 Kokoro 引擎，需安装中文模型）
 * - vits: 中文 VITS 本地离线模型（sherpa-onnx VITS，独立于 Piper，说话人数导入时探测，需导入模型）
 */
export type TTSProviderType = 'system' | 'web' | 'kokoro' | 'piper' | 'vits';

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
  /** 多说话人模型的说话人 ID（Kokoro 专用，0-102） */
  sid?: number;
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
 * TTS 朗读过程中的边界事件（逐字/逐句回调，用于电子书跟读高亮）
 */
export interface TTSBoundaryEvent {
  /** 当前朗读文本中的字符起始索引（相对本次 speak 传入的 text） */
  charIndex: number;
  /** 当前朗读片段的字符长度（'word' 边界时有效，可用于精确定位片段尾部） */
  charLength?: number;
  /** 边界类型：'word' 逐词 / 'sentence' 逐句（取决于引擎支持，Web Speech 多为 'word'） */
  name?: 'word' | 'sentence';
}

/**
 * TTS 朗读回调处理器：用于电子书「逐字/逐句高亮跟读」与播放控制。
 * 全部字段可选，向后兼容旧调用方（不传则退化为仅「完成回调」的朗读）。
 */
export interface TTSHandlers {
  /** 一段文本开始朗读时触发（charIndex 为起始位置，通常为 0） */
  onStart?: (e: { charIndex: number }) => void;
  /** 朗读到达某个边界（逐字/逐句）时触发，用于高亮跟随 */
  onBoundary?: (e: TTSBoundaryEvent) => void;
  /** 一段文本朗读完成时触发（无论是自然结束还是被 stop 中断，均只触发一次） */
  onEnd?: () => void;
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
   * @param handlers 朗读回调处理器（边界高亮/播放控制，可选，向后兼容）
   * @returns Promise，朗读完成后 resolve
   */
  speak(text: string, options?: TTSOptions, handlers?: TTSHandlers): Promise<void>;
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
