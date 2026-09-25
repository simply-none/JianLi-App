import type { ITTSProvider, TTSHandlers, TTSOptions, VoiceInfo } from './types';

/**
 * Web Speech API TTS 提供商实现
 * 使用浏览器原生的 speechSynthesis API
 *
 * 唯一原生支持逐字/逐句边界（onboundary）的引擎，是电子书「跟读高亮」的推荐引擎。
 */
export class WebTTSProvider implements ITTSProvider {
  readonly type = 'web' as const;

  /**
   * 朗读文本
   * @param text 要朗读的文本
   * @param options TTS 配置选项
   * @param handlers 朗读回调处理器（边界高亮/播放控制，可选）
   * @returns Promise，朗读完成后 resolve
   */
  speak(text: string, options: TTSOptions = {}, handlers?: TTSHandlers): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('Web Speech API 不可用'));
        return;
      }

      try {
        // 先停止当前朗读
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // 应用配置
        if (options.rate !== undefined) {
          utterance.rate = options.rate;
        }
        if (options.pitch !== undefined) {
          utterance.pitch = options.pitch;
        }
        if (options.volume !== undefined) {
          utterance.volume = options.volume;
        }
        if (options.lang) {
          utterance.lang = options.lang;
        }
        if (options.voice) {
          const voices = window.speechSynthesis.getVoices();
          const matchedVoice = voices.find(v => v.name === options.voice);
          if (matchedVoice) {
            utterance.voice = matchedVoice;
          }
        }

        // 边界回调仅一次结算，避免 onend / onerror 重复触发
        let settled = false;
        const finish = (ok: boolean, err?: Error) => {
          if (settled) return;
          settled = true;
          handlers?.onEnd?.();
          if (ok) {
            resolve();
          } else {
            reject(err as Error);
          }
        };

        utterance.onstart = () => {
          handlers?.onStart?.({ charIndex: 0 });
        };
        // 逐字/逐句边界：Web Speech API 原生支持，用于电子书跟读高亮
        utterance.onboundary = (event: SpeechSynthesisEvent) => {
          handlers?.onBoundary?.({
            charIndex: event.charIndex,
            charLength: event.charLength,
            name: event.name === 'sentence' ? 'sentence' : 'word',
          });
        };
        utterance.onend = () => finish(true);
        utterance.onerror = (event) => {
          // 忽略 interrupted / canceled（通常是由 stop() 主动中断导致，视为正常结束）
          if (event.error !== 'interrupted' && event.error !== 'canceled') {
            finish(false, new Error(`TTS 错误: ${event.error}`));
          } else {
            finish(true);
          }
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 停止当前朗读
   */
  stop(): void {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * 获取可用的语音列表
   * @returns 语音信息数组
   */
  async getVoices(): Promise<VoiceInfo[]> {
    if (!window.speechSynthesis) {
      return [];
    }

    // 某些浏览器需要等待 voiceschanged 事件
    return new Promise((resolve) => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices.map(v => ({
          name: v.name,
          lang: v.lang,
          default: v.default,
          localService: v.localService,
        })));
      } else {
        // 等待语音列表加载
        const handleVoicesChanged = () => {
          const updatedVoices = window.speechSynthesis.getVoices();
          resolve(updatedVoices.map(v => ({
            name: v.name,
            lang: v.lang,
            default: v.default,
            localService: v.localService,
          })));
          window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        };
        window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);

        // 超时保护
        setTimeout(() => {
          const timeoutVoices = window.speechSynthesis.getVoices();
          resolve(timeoutVoices.map(v => ({
            name: v.name,
            lang: v.lang,
            default: v.default,
            localService: v.localService,
          })));
          window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        }, 2000);
      }
    });
  }

  /**
   * 检测 Web TTS 是否可用
   * @returns 是否可用
   */
  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
}
