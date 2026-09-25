import { SherpaOnnxProvider, type RawSherpaVoice } from './SherpaOnnxProvider';

/**
 * Kokoro 本地离线 TTS 提供商（sherpa-onnx + worker_threads）。
 * 复用 SherpaOnnxProvider 基类；Kokoro 音色表由主进程 kokoro-multi-lang-v1_1 决定（103 说话人）。
 */
export class KokoroProvider extends SherpaOnnxProvider {
  /** 渲染端 store key：用户导入的模型目录 */
  static readonly MODEL_DIR_STORE_KEY = 'tts_kokoro_model_dir';

  constructor() {
    super({
      type: 'kokoro',
      namespace: 'kokoro',
      storeKey: KokoroProvider.MODEL_DIR_STORE_KEY,
      voicePrefix: 'kokoro',
      mapVoices: (raw: any[]): RawSherpaVoice[] =>
        raw.map((v: any) => ({ sid: v.sid, description: v.name, lang: v.lang, gender: v.gender })),
    });
  }
}
