/**
 * Piper 本地离线 TTS 模块（sherpa-onnx 推理 + worker_threads）
 * ------------------------------------------------------------------
 * 与 Kokoro 共用同一套 sherpa-onnx 引擎与通用合成 Worker（public/worker/sherpa-tts.cjs），
 * 区别仅在于传给 Worker 的模型内层配置是 `model.vits`（而非 `model.kokoro`）。
 * Piper 是 VITS 架构，中文音素化依赖 espeak-ng-data：优先用 Piper 模型目录自带的，
 * 否则回退到 Kokoro 模型目录里的 espeak-ng-data（两者同一套音素器，免额外下载）。
 *
 * 职责：
 * - 模型目录解析与校验（默认 userData/tts-models/piper，作为统一模型库根目录，子文件夹各为一个 Piper 模型；自动扫描聚合所有模型）
 * - 合成走通用 Worker（public/worker/sherpa-tts.cjs）：generate 是同步阻塞调用，不能在主进程跑
 * - IPC：tts:piper:status / get-voices / is-available / synthesize / stop / choose-model-dir
 *
 * ⚠️ 改动本文件后必须重启 Electron；sherpa-tts.cjs 是独立 CJS，不参与 vite 打包。
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { app, dialog, ipcMain } from 'electron';
import log from 'electron-log';
import { sherpaTtsWorkerPath, appRoot } from '../variables.ts';

// ============ 模型目录与文件校验 ============

/** Piper 默认模型目录：userData/tts-models/piper（统一模型库根目录，子文件夹各为一个 Piper 模型） */
function defaultModelDir(): string {
  return path.join(app.getPath('userData'), 'tts-models', 'piper');
}

/** Kokoro 默认模型目录（用于回退 espeak-ng-data，Piper 与其共用音素器） */
function kokoroDefaultDir(): string {
  return path.join(app.getPath('userData'), 'tts-models', 'kokoro-multi-lang-v1_1');
}

/** 解析渲染端传入的目录（空/无效时回退默认目录） */
function resolveModelDir(explicit?: string): string {
  if (explicit && path.isAbsolute(explicit)) return explicit;
  return defaultModelDir();
}

/** Piper VITS 所需文件集 */
interface PiperPaths {
  model: string;
  tokens: string;
  /** espeak-ng-data 目录（音素化必需，可来自 Piper 目录或 Kokoro 目录） */
  dataDir: string;
  sid: number;
  /** 推理参数 fidelity：优先取自模型 onnx.json 的 inference，否则回退 sherpa-onnx 默认 */
  lengthScale: number;
  noiseScale: number;
  noiseScaleW: number;
}

/** 扫描目录，找到 Piper 模型主文件（*.onnx，且同目录存在 *.onnx.json + tokens.txt）；文件名不限，兼容所有 Piper 模型 */
function findPiperModelFile(dir: string): string | null {
  try {
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.onnx'));
    for (const f of files) {
      const onnx = path.join(dir, f);
      const json = onnx.replace(/\.onnx$/i, '.onnx.json');
      const tokens = path.join(dir, 'tokens.txt');
      if (fs.existsSync(json) && fs.existsSync(tokens)) return onnx;
    }
  } catch {
    // 目录不可读等，静默
  }
  return null;
}

/** Piper 模型 onnx.json 元数据（用于动态生成音色表） */
interface PiperModelConfig {
  numSpeakers?: number;
  speakerIdMap?: Record<string, number>;
  language?: { code?: string; name_native?: string };
  dataset?: string;
  inference?: { noise_scale?: number; length_scale?: number; noise_w?: number };
}

/** 读取模型同目录的 onnx.json；缺失或损坏返回 null */
function readPiperConfig(modelPath: string): PiperModelConfig | null {
  try {
    const jsonPath = modelPath.replace(/\.onnx$/i, '.onnx.json');
    if (!fs.existsSync(jsonPath)) return null;
    return JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as PiperModelConfig;
  } catch {
    return null;
  }
}

/** 校验目录内必需文件：模型 onnx + tokens.txt / espeak-ng-data（可回退 Kokoro） */
function resolvePiperPaths(dir: string): PiperPaths | null {
  try {
    const model = findPiperModelFile(dir);
    if (!model) return null;
    const tokens = path.join(dir, 'tokens.txt');
    if (!fs.existsSync(tokens)) return null;
    // espeak-ng-data：优先 Piper 目录自带，否则回退 Kokoro 默认目录
    let dataDir = path.join(dir, 'espeak-ng-data');
    if (!fs.existsSync(dataDir)) {
      dataDir = path.join(kokoroDefaultDir(), 'espeak-ng-data');
    }
    if (!fs.existsSync(dataDir)) return null;
    // 推理参数 fidelity：优先用模型 onnx.json 的 inference，否则回退 sherpa-onnx 默认
    // （huayan 的 0.667/1.0/0.8 与默认一致，行为不变；其它调过音色的模型会真正生效）
    const inf = readPiperConfig(model)?.inference;
    return {
      model,
      tokens,
      dataDir,
      sid: 0,
      lengthScale: inf?.length_scale ?? 1.0,
      noiseScale: inf?.noise_scale ?? 0.667,
      noiseScaleW: inf?.noise_w ?? 0.8,
    };
  } catch (err) {
    log.warn('[piper-tts] resolvePiperPaths failed:', err);
    return null;
  }
}

/** 只校验模型文件（onnx + tokens），用于「是否已导入模型目录」判定 */
function findPiperDir(base: string): string | null {
  if (hasPiperModel(base)) return base;
  try {
    const entries = fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const e of entries) {
      const sub = path.join(base, e.name);
      if (hasPiperModel(sub)) return sub;
    }
  } catch {
    // 目录不存在等，静默
  }
  return null;
}

/** 目录是否包含 Piper 模型核心文件（任意 *.onnx + 同目录 onnx.json + tokens.txt） */
function hasPiperModel(dir: string): boolean {
  return !!findPiperModelFile(dir);
}

// ============ 音色表（由模型 onnx.json 动态生成，兼容所有 Piper 模型） ============

/**
 * 主进程返回给渲染端的 Piper 音色元信息，形状对齐 RawSherpaVoice
 * （用 description 而非 name；PiperProvider.mapVoices 会按 description 渲染）。
 */
export interface PiperVoiceMeta {
  sid: number;
  description: string;
  lang: string;
  gender?: 'female' | 'male' | 'neutral';
  /** 所属模型在库中的稳定标识（由子文件夹名生成，跨会话一致），用于多模型下区分具体模型 */
  modelKey: string;
  /** 所属模型目录绝对路径（合成时据此加载对应 onnx） */
  modelDir: string;
}

/** 单模型音色（聚合前，不含 modelKey/modelDir） */
type PiperVoiceBase = Omit<PiperVoiceMeta, 'modelKey' | 'modelDir'>;

/** BCP47 规范化：Piper 的 language.code 形如 zh_CN / en_US，统一转连字符 */
function normalizeLang(code?: string): string {
  if (!code) return 'unknown';
  return code.replace(/_/g, '-');
}

/**
 * 按模型 onnx.json 动态生成音色表，兼容任意 Piper 模型：
 * - speaker_id_map 非空 → 每个命名说话人一个音色（key → sid）
 * - num_speakers > 1   → 按 sid 0..N-1 展开
 * - 否则               → 单音色 sid=0（已知 huayan 标为中文女声，其余留空由 UI 可选）
 */
function buildPiperVoices(dir: string): PiperVoiceBase[] {
  const model = findPiperModelFile(dir);
  const cfg = model ? readPiperConfig(model) : null;
  const lang = normalizeLang(cfg?.language?.code);
  const dataset = cfg?.dataset || 'Piper';

  // 多说话人命名（speaker_id_map.key → sid）
  if (cfg?.speakerIdMap && Object.keys(cfg.speakerIdMap).length > 0) {
    return Object.entries(cfg.speakerIdMap).map(([spkName, sid]) => ({
      sid,
      description: `${spkName}（${dataset}）`,
      lang,
      gender: 'neutral',
    }));
  }

  const num = cfg?.numSpeakers && cfg.numSpeakers > 0 ? cfg.numSpeakers : 1;
  if (num > 1) {
    return Array.from({ length: num }, (_, sid) => ({
      sid,
      description: `${dataset} #${sid}`,
      lang,
      gender: 'neutral',
    }));
  }

  const isHuayan = dataset.toLowerCase().includes('huayan');
  return [
    {
      sid: 0,
      description: isHuayan ? '华嫣 中文女声' : `${dataset} 默认音色`,
      lang,
      gender: isHuayan ? 'female' : undefined,
    },
  ];
}

/** 稳定 slug：文件夹名 → 小写、非单词字符转连字符，供 voice 名与缓存键使用 */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'model'
  );
}

/** 库中的一个合法 Piper 模型目录 */
interface PiperModelEntry {
  /** 稳定标识（来自子文件夹名），跨会话一致 */
  key: string;
  /** 模型目录绝对路径 */
  dir: string;
  /** onnx 主文件路径 */
  model: string;
  /** 模型元数据（可能为空，如缺失 onnx.json） */
  config: PiperModelConfig | null;
}

/**
 * 扫描模型库根目录，找出所有合法的 Piper 模型目录（自身 + 一层子目录，深度 ≤ 2）。
 * 一个目录命中模型即不再向下钻（一个目录对应一个模型）。
 */
function scanPiperModels(root: string): PiperModelEntry[] {
  const entries: PiperModelEntry[] = [];
  const seen = new Set<string>();
  const consider = (dir: string): boolean => {
    const model = findPiperModelFile(dir);
    if (!model) return false;
    const key = slugify(path.basename(dir));
    if (seen.has(key)) return true; // 同名目录去重，保留首次出现
    seen.add(key);
    entries.push({ key, dir, model, config: readPiperConfig(model) });
    return true;
  };
  if (!fs.existsSync(root)) return entries;
  consider(root);
  try {
    for (const e of fs.readdirSync(root, { withFileTypes: true })) {
      if (e.isDirectory()) consider(path.join(root, e.name));
    }
  } catch {
    // 忽略遍历异常
  }
  return entries;
}

/**
 * 扫描库根目录下所有 Piper 模型，聚合全部音色（每个音色带所属 modelKey + modelDir）。
 * 兼容「单模型目录」（根自身即模型）与「多模型库」（各子文件夹一个模型）两种形态。
 */
function buildAllPiperVoices(root: string): PiperVoiceMeta[] {
  const out: PiperVoiceMeta[] = [];
  for (const m of scanPiperModels(root)) {
    for (const v of buildPiperVoices(m.dir)) {
      out.push({ ...v, modelKey: m.key, modelDir: m.dir });
    }
  }
  return out;
}

// ============ 合成 Worker 宿主 ============

interface SynthResult {
  wavPath: string;
  sampleRate: number;
  durationMs: number;
}

/** WAV 输出临时目录（每次合成清掉过旧的残留文件） */
function wavTmpDir(): string {
  const dir = path.join(os.tmpdir(), 'jianli-tts');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupOldWavs(keepName: string): void {
  try {
    const dir = wavTmpDir();
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.wav') && f !== keepName) {
        fs.unlinkSync(path.join(dir, f));
      }
    }
  } catch {
    // 清理失败不影响合成
  }
}

class PiperSynthHost {
  private worker: Worker | null = null;
  /** 防并发：模型加载中的 Promise，二次 ensure 直接复用 */
  private loading: Promise<void> | null = null;
  private seq = 0;
  private pending = new Map<number, { resolve: (v: SynthResult) => void; reject: (e: Error) => void }>();

  private failAll(err: Error): void {
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
    this.worker = null;
  }

  /** 懒创建 worker（模型加载约需数秒，常驻复用避免每次朗读重新加载） */
  private ensure(paths: PiperPaths): Promise<void> {
    if (this.worker) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = this.createWorker(paths);
    return this.loading.finally(() => {
      this.loading = null;
    });
  }

  private createWorker(paths: PiperPaths): Promise<void> {
    return new Promise((resolve, reject) => {
      let sherpaModulePath: string;
      try {
        // 以项目根（打包后 resources/app）为解析基准，worker 内用同一入口路径 require
        sherpaModulePath = createRequire(path.join(appRoot, 'package.json')).resolve('sherpa-onnx-node');
      } catch {
        reject(new Error('未找到 sherpa-onnx-node 依赖，请先安装：pnpm add sherpa-onnx-node sherpa-onnx-win-x64'));
        return;
      }
      // 与 sherpa-tts.cjs 约定：workerData.model 为内层 model 配置（vits / kokoro…）
      const vitsConfig = {
        model: paths.model,
        tokens: paths.tokens,
        dataDir: paths.dataDir,
        sid: paths.sid,
        lengthScale: paths.lengthScale,
        noiseScale: paths.noiseScale,
        noiseScaleW: paths.noiseScaleW,
      };
      const worker = new Worker(sherpaTtsWorkerPath, {
        workerData: {
          sherpaModulePath,
          model: { vits: vitsConfig, numThreads: 2, provider: 'cpu' },
        },
      });
      const cleanupStartup = () => {
        worker.off('message', onMessage);
        worker.off('exit', onExit);
        worker.off('error', onError);
      };
      const onMessage = (msg: any) => {
        if (msg?.type === 'ready') {
          cleanupStartup();
          this.worker = worker;
          resolve();
        } else if (msg?.type === 'load-error') {
          cleanupStartup();
          reject(new Error(`Piper 模型加载失败: ${msg.error}`));
        }
      };
      const onExit = () => {
        cleanupStartup();
        reject(new Error('Piper 合成线程启动失败'));
      };
      const onError = (err: Error) => {
        cleanupStartup();
        reject(err);
      };
      worker.on('message', onMessage);
      worker.on('error', onError);
      worker.on('exit', onExit);
      // ready 之后走常驻处理器：result 结果分发 + 崩溃/异常退出兜底
      worker.on('message', (msg: any) => {
        if (msg?.type !== 'result') return;
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.success) {
          p.resolve({ wavPath: msg.wavPath, sampleRate: msg.sampleRate, durationMs: msg.durationMs });
        } else {
          p.reject(new Error(msg.error || 'Piper 合成失败'));
        }
      });
      worker.on('error', (err) => this.failAll(err));
      worker.on('exit', () => {
        if (this.worker === worker) this.failAll(new Error('Piper 合成线程已退出'));
      });
    });
  }

  async synthesize(paths: PiperPaths, text: string, sid: number, speed: number): Promise<SynthResult & { url: string }> {
    await this.ensure(paths);
    const id = ++this.seq;
    const outPath = path.join(wavTmpDir(), `piper-${id}.wav`);
    const result = await new Promise<SynthResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ id, text, sid, speed, outPath });
    });
    cleanupOldWavs(path.basename(outPath));
    return { ...result, url: pathToFileURL(result.wavPath).href };
  }

  /** 立即终止 worker：generate 是同步调用无法中途打断，只能 terminate（下次合成会重新加载模型） */
  stop(): void {
    const w = this.worker;
    this.worker = null;
    this.failAll(new Error('已取消'));
    if (w) {
      w.terminate().catch(() => {});
    }
  }
}

/** 按 modelDir 缓存的 Piper 合成宿主注册表：每个模型各持一个常驻 worker，互不干扰 */
class PiperSynthHub {
  private hosts = new Map<string, PiperSynthHost>();

  /** 取（或懒创建）某模型目录对应的合成宿主 */
  getOrCreate(modelDir: string): PiperSynthHost {
    let h = this.hosts.get(modelDir);
    if (!h) {
      h = new PiperSynthHost();
      this.hosts.set(modelDir, h);
    }
    return h;
  }

  /** 终止所有 worker（停止朗读时调用；下次合成会按模型重新加载） */
  stopAll(): void {
    for (const h of this.hosts.values()) h.stop();
    this.hosts.clear();
  }
}

const synthHub = new PiperSynthHub();

// ============ IPC 注册（由 tts.ts initTTS 调用） ============

export function initPiperTTS() {
  log.info('Initializing Piper TTS module...');

  // 状态查询：模型库根目录下已识别的模型数量 + 可用（含 espeak-ng-data）数量
  ipcMain.handle('tts:piper:status', (_event, modelDir?: string) => {
    const base = resolveModelDir(modelDir);
    const models = scanPiperModels(base);
    const ready = models.filter((m) => !!resolvePiperPaths(m.dir));
    return {
      installed: ready.length > 0,
      modelCount: models.length,
      readyCount: ready.length,
      dir: base,
      defaultDir: defaultModelDir(),
    };
  });

  // 音色列表（扫描模型库根目录，聚合所有 Piper 模型的音色，每个带 modelKey + modelDir）
  ipcMain.handle('tts:piper:get-voices', (_event, modelDir?: string): PiperVoiceMeta[] => {
    return buildAllPiperVoices(resolveModelDir(modelDir));
  });

  // 可用性：模型库中存在至少一个模型文件 + espeak-ng-data 齐备
  ipcMain.handle('tts:piper:is-available', (_event, modelDir?: string): boolean => {
    return scanPiperModels(resolveModelDir(modelDir)).some((m) => !!resolvePiperPaths(m.dir));
  });

  // 选择模型库目录：弹目录选择框并校验（自身或任一子目录）至少含一个 Piper 模型，成功返回该根目录（渲染端持久化）
  // 注意：espeak-ng-data（音素化必需）不在此处强校验，留到合成阶段再判断，
  // 否则用户只下载了 Piper 模型包（不含 espeak-ng-data）却未装 Kokoro 时，导入会永远失败。
  ipcMain.handle('tts:piper:choose-model-dir', async (): Promise<{ success: boolean; dir?: string; canceled?: boolean; error?: string }> => {
    const res = await dialog.showOpenDialog({
      title: '选择 Piper 模型库目录（可包含多个子文件夹，每个子文件夹一个 Piper 模型）',
      properties: ['openDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return { success: false, canceled: true };
    const dir = res.filePaths[0];
    // 校验：所选目录（自身或任一子目录）下至少识别到一个 Piper 模型
    if (scanPiperModels(dir).length === 0) {
      return {
        success: false,
        error: '所选目录未识别到任何 Piper 模型（需要含 *.onnx / 同目录 *.onnx.json / tokens.txt，可直接选包含它们的文件夹或其父目录）',
      };
    }
    return { success: true, dir };
  });

  // 合成：返回 file:// URL 供渲染端 <audio> 播放
  ipcMain.handle(
    'tts:piper:synthesize',
    async (
      _event,
      text: string,
      options: { sid?: number; speed?: number; modelDir?: string } = {}
    ): Promise<{ success: boolean; url?: string; durationMs?: number; error?: string }> => {
      try {
        // options.modelDir 为具体模型目录（由 Provider 从 voice.name 解析得到）；缺省回退库根
        const base = options.modelDir && path.isAbsolute(options.modelDir)
          ? options.modelDir
          : resolveModelDir(options.modelDir);
        const dir = findPiperDir(base);
        if (!dir) {
          return { success: false, error: 'Piper 模型未安装，请先下载并导入模型目录' };
        }
        const paths = resolvePiperPaths(dir);
        if (!paths) {
          return { success: false, error: '缺少 espeak-ng-data：请放入 Piper 目录或安装 Kokoro 模型' };
        }
        const result = await synthHub.getOrCreate(dir).synthesize(paths, text, options.sid || 0, options.speed || 1);
        return { success: true, url: result.url, durationMs: result.durationMs };
      } catch (err: any) {
        log.error('[piper-tts] synthesize failed:', err);
        return { success: false, error: err?.message || 'Piper 合成失败' };
      }
    }
  );

  // 停止：终止所有模型对应的 worker（同步推理无法软中断）
  ipcMain.handle('tts:piper:stop', async (): Promise<{ success: boolean }> => {
    synthHub.stopAll();
    return { success: true };
  });

  log.info('Piper TTS module initialized successfully');
}
