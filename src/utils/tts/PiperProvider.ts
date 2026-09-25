import { SherpaOnnxProvider, type RawSherpaVoice } from './SherpaOnnxProvider';
import type { TTSOptions, VoiceInfo } from './types';

/**
 * Piper 本地离线 TTS 提供商（sherpa-onnx VITS，复用 Kokoro 引擎与 Worker）。
 * 支持统一「模型库目录」：库根下每个子文件夹为一个 Piper 模型，主进程自动扫描并聚合所有音色。
 * 音色名格式：piper:<modelKey>:<sid>（多模型下不撞车），合成时据此解析具体模型目录。
 */
export class PiperProvider extends SherpaOnnxProvider {
  /** 渲染端 store key：用户选择的 Piper 模型库根目录 */
  static readonly MODEL_DIR_STORE_KEY = 'tts_piper_model_dir';

  /** voice.name → 所属模型目录（多模型聚合后区分具体模型） */
  private voiceModelDirs = new Map<string, string>();

  constructor() {
    super({
      type: 'piper',
      namespace: 'piper',
      storeKey: PiperProvider.MODEL_DIR_STORE_KEY,
      voicePrefix: 'piper',
      mapVoices: (raw: any[]): RawSherpaVoice[] =>
        (raw || []).map((v) => ({
          sid: v.sid,
          description: v.description,
          lang: v.lang,
          gender: v.gender,
          modelKey: v.modelKey,
          modelDir: v.modelDir,
        })),
    });
  }

  /** 覆盖基类：聚合列表每个音色带 modelKey，voice 名 = piper:<modelKey>:<sid>；同时登记 name → modelDir */
  async getVoices(): Promise<VoiceInfo[]> {
    const modelDir = await this.resolveModelDir();
    try {
      const list = await this.api.getVoices(modelDir);
      const raw = this.mapVoices(list || []);
      this.voiceModelDirs.clear();
      return raw.map((v) => {
        const name = v.modelKey ? `${this.voicePrefix}:${v.modelKey}:${v.sid}` : `${this.voicePrefix}:${v.sid}`;
        if (v.modelDir) this.voiceModelDirs.set(name, v.modelDir);
        return {
          name,
          lang: v.lang,
          default: false,
          localService: true,
          description: v.description,
          gender: v.gender,
        } as VoiceInfo;
      });
    } catch {
      return [];
    }
  }

  /** 覆盖基类：voice 名形如 piper:<modelKey>:<sid>，取末段作为 sid */
  protected resolveSid(options: TTSOptions): number {
    if (typeof options.sid === 'number') return options.sid;
    if (options.voice && options.voice.startsWith(`${this.voicePrefix}:`)) {
      const rest = options.voice.slice(this.voicePrefix.length + 1);
      const sidStr = rest.includes(':') ? rest.slice(rest.lastIndexOf(':') + 1) : rest;
      const n = parseInt(sidStr, 10);
      if (!Number.isNaN(n)) return n;
    }
    return 0;
  }

  /** 覆盖基类：多模型下从 voice.name 解析具体模型目录，再走对应 worker 合成 */
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    const modelDir = (options.voice && this.voiceModelDirs.get(options.voice)) || (await this.resolveModelDir()) || undefined;
    await this.synthAndPlay(text, options, modelDir);
  }
}
