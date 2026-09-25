/**
 * 中文 VITS 本地离线 TTS 模块（sherpa-onnx 推理 + worker_threads）
 * ------------------------------------------------------------------
 * 复用 Kokoro/Piper 的通用合成 Worker（public/worker/sherpa-tts.cjs），
 * 区别仅在于传给 Worker 的模型内层配置是 `model.vits`，且【不含 espeak-ng-data】。
 * VITS 中文模型（vits-zh-* 系列）不依赖 espeak 音素器，靠 tokens.txt + 可选 lexicon.txt；
 * 模型文件结构为 <model>.onnx + tokens.txt（可选 lexicon.txt），没有 Piper 式的 onnx.json。
 *
 * 说话人数不内置映射表：导入模型目录时由主进程临时加载模型读取 tts.numSpeakers 探测，
 * 缓存到 userData/tts-models/vits-meta/<key>.json；扫描/聚合时直接读缓存、不重复加载。
 *
 * 职责：
 * - 模型目录解析与校验（默认 userData/tts-models/vits，作为统一模型库根目录，子文件夹各为一个 VITS 模型）
 * - 导入时探测说话人数并缓存；扫描聚合所有模型的占位说话人（vits:<modelKey>:<sid>）
 * - 合成走通用 Worker（model.vits 内层配置，lexicon 可选透传）
 * - IPC：tts:vits:status / get-voices / is-available / choose-model-dir / synthesize / stop
 *
 * ⚠️ 改动本文件后必须重启 Electron；sherpa-tts.cjs 是独立 CJS，不参与 vite 打包。
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { app, dialog, ipcMain } from 'electron';
import log from 'electron-log';
import { sherpaTtsWorkerPath, appRoot } from '../variables.ts';

// ============ 模型目录与文件校验 ============

/** VITS 默认模型库根目录：userData/tts-models/vits */
function defaultModelDir(): string {
  return path.join(app.getPath('userData'), 'tts-models', 'vits');
}

/** 说话人数探测缓存目录：userData/tts-models/vits-meta（<key>.json → { numSpeakers }） */
function metaDir(): string {
  return path.join(app.getPath('userData'), 'tts-models', 'vits-meta');
}

/** 解析渲染端传入的目录（空/无效时回退默认目录） */
function resolveModelDir(explicit?: string): string {
  if (explicit && path.isAbsolute(explicit)) return explicit;
  return defaultModelDir();
}

/** VITS 所需文件集（numSpeakers 由导入时探测并缓存，缺失按 1 兜底） */
interface VitsPaths {
  model: string;
  tokens: string;
  /** 可选 lexicon：数字/日期规整用，目录内 lexicon*.txt 逗号拼接 */
  lexicon?: string;
  numSpeakers: number;
}

/** 扫描目录，找到 VITS 模型主文件（*.onnx，且同目录存在 tokens.txt）；不要求 onnx.json */
function findVitsModelFile(dir: string): string | null {
  try {
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.onnx'));
    for (const f of files) {
      const onnx = path.join(dir, f);
      const tokens = path.join(dir, 'tokens.txt');
      if (fs.existsSync(tokens)) return onnx;
    }
  } catch {
    // 目录不可读等，静默
  }
  return null;
}

/** 目录是否包含 VITS 模型核心文件（*.onnx + 同目录 tokens.txt） */
function hasVitsModel(dir: string): boolean {
  return !!findVitsModelFile(dir);
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

/** 读取某模型 key 的说话人数缓存（缺失返回 0，上层按 1 兜底） */
function readCachedSpeakers(key: string): number {
  try {
    const p = path.join(metaDir(), `${key}.json`);
    if (!fs.existsSync(p)) return 0;
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return typeof data?.numSpeakers === 'number' && data.numSpeakers > 0 ? data.numSpeakers : 0;
  } catch {
    return 0;
  }
}

/** 写入某模型 key 的说话人数缓存 */
function writeCachedSpeakers(key: string, numSpeakers: number): void {
  try {
    fs.mkdirSync(metaDir(), { recursive: true });
    fs.writeFileSync(path.join(metaDir(), `${key}.json`), JSON.stringify({ numSpeakers }, 'utf-8'));
  } catch (err) {
    log.warn('[vits-tts] 缓存说话人数失败:', err);
  }
}

/** 解析目录内 VITS 模型路径集（model + tokens + 可选 lexicon + 缓存说话人数） */
function resolveVitsPaths(dir: string, key: string): VitsPaths | null {
  try {
    const model = findVitsModelFile(dir);
    if (!model) return null;
    const tokens = path.join(dir, 'tokens.txt');
    if (!fs.existsSync(tokens)) return null;
    // 可选 lexicon：目录内 lexicon*.txt（逗号分隔拼接）
    const lexiconFiles = fs
      .readdirSync(dir)
      .filter((f) => /^lexicon.*\.txt$/i.test(f))
      .map((f) => path.join(dir, f));
    return {
      model,
      tokens,
      lexicon: lexiconFiles.length ? lexiconFiles.join(',') : undefined,
      numSpeakers: readCachedSpeakers(key) || 1,
    };
  } catch (err) {
    log.warn('[vits-tts] resolveVitsPaths failed:', err);
    return null;
  }
}

// ============ 音色表（由导入时探测的说话人数动态生成，兼容所有 VITS 模型） ============

/** 主进程返回给渲染端的 VITS 音色元信息，形状对齐 RawSherpaVoice */
export interface VitsVoiceMeta {
  sid: number;
  description: string;
  lang: string;
  gender?: 'female' | 'male' | 'neutral';
  /** 所属模型在库中的稳定标识（由子文件夹名生成），用于多模型下区分具体模型 */
  modelKey: string;
  /** 所属模型目录绝对路径（合成时据此加载对应 onnx） */
  modelDir: string;
}

/** 单模型音色（聚合前，不含 modelKey/modelDir） */
type VitsVoiceBase = Omit<VitsVoiceMeta, 'modelKey' | 'modelDir'>;

/**
 * 按导入时探测的说话人数（缓存）生成某模型的占位音色表。
 * VITS 不提供说话人名字，统一用「说话人 #N」占位；语言默认 zh-CN（本 Provider 面向中文 VITS）。
 */
function buildVitsVoices(dir: string, key: string): VitsVoiceBase[] {
  const num = readCachedSpeakers(key) || 1;
  return Array.from({ length: num }, (_, sid) => ({
    sid,
    description: `说话人 #${sid}`,
    lang: 'zh-CN',
    gender: 'neutral',
  }));
}

/** 库中的一个合法 VITS 模型目录 */
interface VitsModelEntry {
  /** 稳定标识（来自子文件夹名），跨会话一致 */
  key: string;
  /** 模型目录绝对路径 */
  dir: string;
  /** onnx 主文件路径 */
  model: string;
}

/**
 * 扫描模型库根目录，找出所有合法的 VITS 模型目录（自身 + 一层子目录，深度 ≤ 2）。
 * 一个目录命中模型即不再向下钻（一个目录对应一个模型）。
 */
function scanVitsModels(root: string): VitsModelEntry[] {
  const entries: VitsModelEntry[] = [];
  const seen = new Set<string>();
  const consider = (dir: string): boolean => {
    const model = findVitsModelFile(dir);
    if (!model) return false;
    const key = slugify(path.basename(dir));
    if (seen.has(key)) return true; // 同名目录去重，保留首次出现
    seen.add(key);
    entries.push({ key, dir, model });
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

/** 扫描库根目录下所有 VITS 模型，聚合全部音色（每个音色带所属 modelKey + modelDir） */
function buildAllVitsVoices(root: string): VitsVoiceMeta[] {
  const out: VitsVoiceMeta[] = [];
  for (const m of scanVitsModels(root)) {
    for (const v of buildVitsVoices(m.dir, m.key)) {
      out.push({ ...v, modelKey: m.key, modelDir: m.dir });
    }
  }
  return out;
}

// ============ 说话人数探测（导入时加载模型读 tts.numSpeakers） ============

/**
 * 探测某 VITS 模型的说话人数：临时加载模型（数秒）→ 读 ready 消息里的 numSpeakers → 立即终止 worker。
 * 失败/超时一律兜底返回 1，不影响导入流程。
 */
function probeNumSpeakers(model: string, tokens: string, lexicon?: string): Promise<number> {
  return new Promise((resolve) => {
    let sherpaModulePath: string;
    try {
      sherpaModulePath = createRequire(path.join(appRoot, 'package.json')).resolve('sherpa-onnx-node');
    } catch {
      resolve(1);
      return;
    }
    const vitsConfig = {
      model,
      tokens,
      lexicon,
      noiseScale: 0.667,
      noiseScaleW: 0.8,
      lengthScale: 1.0,
    };
    let worker: Worker;
    try {
      worker = new Worker(sherpaTtsWorkerPath, {
        workerData: { sherpaModulePath, model: { vits: vitsConfig, numThreads: 2, provider: 'cpu' } },
      });
    } catch {
      resolve(1);
      return;
    }
    let settled = false;
    const finish = (n: number) => {
      if (settled) return;
      settled = true;
      try {
        worker.terminate().catch(() => {});
      } catch {
        // 忽略终止异常
      }
      resolve(n);
    };
    // 兜底超时（15s）：防止某些模型加载异常卡死整条导入
    const timer = setTimeout(() => finish(1), 15000);
    worker.on('message', (msg: any) => {
      if (msg?.type === 'ready') {
        clearTimeout(timer);
        finish(typeof msg.numSpeakers === 'number' && msg.numSpeakers > 0 ? msg.numSpeakers : 1);
      } else if (msg?.type === 'load-error') {
        clearTimeout(timer);
        log.warn('[vits-tts] 探测模型加载失败:', msg.error);
        finish(1);
      }
    });
    worker.on('error', () => {
      clearTimeout(timer);
      finish(1);
    });
    worker.on('exit', () => {
      clearTimeout(timer);
      finish(1);
    });
  });
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

class VitsSynthHost {
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
  private ensure(paths: VitsPaths): Promise<void> {
    if (this.worker) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = this.createWorker(paths);
    return this.loading.finally(() => {
      this.loading = null;
    });
  }

  private createWorker(paths: VitsPaths): Promise<void> {
    return new Promise((resolve, reject) => {
      let sherpaModulePath: string;
      try {
        // 以项目根（打包后 resources/app）为解析基准，worker 内用同一入口路径 require
        sherpaModulePath = createRequire(path.join(appRoot, 'package.json')).resolve('sherpa-onnx-node');
      } catch {
        reject(new Error('未找到 sherpa-onnx-node 依赖，请先安装：pnpm add sherpa-onnx-node sherpa-onnx-win-x64'));
        return;
      }
      // 与 sherpa-tts.cjs 约定：workerData.model 为内层 model 配置（vits）
      const vitsConfig = {
        model: paths.model,
        tokens: paths.tokens,
        lexicon: paths.lexicon,
        noiseScale: 0.667,
        noiseScaleW: 0.8,
        lengthScale: 1.0,
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
          reject(new Error(`VITS 模型加载失败: ${msg.error}`));
        }
      };
      const onExit = () => {
        cleanupStartup();
        reject(new Error('VITS 合成线程启动失败'));
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
          p.reject(new Error(msg.error || 'VITS 合成失败'));
        }
      });
      worker.on('error', (err) => this.failAll(err));
      worker.on('exit', () => {
        if (this.worker === worker) this.failAll(new Error('VITS 合成线程已退出'));
      });
    });
  }

  async synthesize(paths: VitsPaths, text: string, sid: number, speed: number): Promise<SynthResult & { url: string }> {
    await this.ensure(paths);
    const id = ++this.seq;
    const outPath = path.join(wavTmpDir(), `vits-${id}.wav`);
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

/** 按 modelDir 缓存的 VITS 合成宿主注册表：每个模型各持一个常驻 worker，互不干扰 */
class VitsSynthHub {
  private hosts = new Map<string, VitsSynthHost>();

  /** 取（或懒创建）某模型目录对应的合成宿主 */
  getOrCreate(modelDir: string): VitsSynthHost {
    let h = this.hosts.get(modelDir);
    if (!h) {
      h = new VitsSynthHost();
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

const synthHub = new VitsSynthHub();

// ============ IPC 注册（由 tts.ts initTTS 调用） ============

export function initVitsTTS() {
  log.info('Initializing VITS TTS module...');

  // 状态查询：模型库根目录下已识别的模型数量 + 总说话人数（含缓存）
  ipcMain.handle('tts:vits:status', (_event, modelDir?: string) => {
    const base = resolveModelDir(modelDir);
    const models = scanVitsModels(base);
    const speakerCount = models.reduce((sum, m) => sum + (readCachedSpeakers(m.key) || 1), 0);
    return {
      installed: models.length > 0,
      modelCount: models.length,
      speakerCount,
      dir: base,
      defaultDir: defaultModelDir(),
    };
  });

  // 音色列表（扫描模型库根目录，聚合所有 VITS 模型的占位说话人，每个带 modelKey + modelDir）
  ipcMain.handle('tts:vits:get-voices', (_event, modelDir?: string): VitsVoiceMeta[] => {
    return buildAllVitsVoices(resolveModelDir(modelDir));
  });

  // 可用性：模型库中存在至少一个模型文件（onnx + tokens）
  ipcMain.handle('tts:vits:is-available', (_event, modelDir?: string): boolean => {
    return scanVitsModels(resolveModelDir(modelDir)).length > 0;
  });

  // 选择模型库目录：弹目录选择框并校验（自身或任一子目录）至少含一个 VITS 模型；
  // 成功后在主进程【逐个加载模型探测说话人数】并写入缓存（说话人数不内置映射表）。
  ipcMain.handle(
    'tts:vits:choose-model-dir',
    async (): Promise<{ success: boolean; dir?: string; modelCount?: number; speakerCount?: number; canceled?: boolean; error?: string }> => {
      const res = await dialog.showOpenDialog({
        title: '选择 VITS 模型库目录（可包含多个子文件夹，每个子文件夹一个 VITS 模型）',
        properties: ['openDirectory'],
      });
      if (res.canceled || !res.filePaths[0]) return { success: false, canceled: true };
      const dir = res.filePaths[0];
      // 校验：所选目录（自身或任一子目录）下至少识别到一个 VITS 模型
      const models = scanVitsModels(dir);
      if (models.length === 0) {
        return {
          success: false,
          error: '所选目录未识别到任何 VITS 模型（需要含 *.onnx + 同目录 tokens.txt，可直接选包含它们的文件夹或其父目录）',
        };
      }
      // 逐个探测说话人数并写缓存（首次加载较耗时，用户预期内）
      let totalSpeakers = 0;
      for (const m of models) {
        const model = findVitsModelFile(m.dir);
        const tokens = path.join(m.dir, 'tokens.txt');
        if (!model || !fs.existsSync(tokens)) {
          writeCachedSpeakers(m.key, 1);
          totalSpeakers += 1;
          continue;
        }
        const lexiconFiles = fs
          .readdirSync(m.dir)
          .filter((f) => /^lexicon.*\.txt$/i.test(f))
          .map((f) => path.join(m.dir, f));
        const n = await probeNumSpeakers(model, tokens, lexiconFiles.join(','));
        writeCachedSpeakers(m.key, n);
        totalSpeakers += n;
      }
      return { success: true, dir, modelCount: models.length, speakerCount: totalSpeakers };
    }
  );

  // 合成：返回 file:// URL 供渲染端 <audio> 播放
  ipcMain.handle(
    'tts:vits:synthesize',
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
        const dir = findVitsDir(base);
        if (!dir) {
          return { success: false, error: 'VITS 模型未安装，请先下载并导入模型目录' };
        }
        const key = slugify(path.basename(dir));
        const paths = resolveVitsPaths(dir, key);
        if (!paths) {
          return { success: false, error: 'VITS 模型文件校验失败（缺少 onnx 或 tokens.txt）' };
        }
        const result = await synthHub.getOrCreate(dir).synthesize(paths, text, options.sid || 0, options.speed || 1);
        return { success: true, url: result.url, durationMs: result.durationMs };
      } catch (err: any) {
        log.error('[vits-tts] synthesize failed:', err);
        return { success: false, error: err?.message || 'VITS 合成失败' };
      }
    }
  );

  // 停止：终止所有模型对应的 worker（同步推理无法软中断）
  ipcMain.handle('tts:vits:stop', async (): Promise<{ success: boolean }> => {
    synthHub.stopAll();
    return { success: true };
  });

  log.info('VITS TTS module initialized successfully');
}

/** 在目录（或其一级子目录）中寻找合法模型目录——兼容解压后多一层包目录的情况 */
function findVitsDir(base: string): string | null {
  if (hasVitsModel(base)) return base;
  try {
    const entries = fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const e of entries) {
      const sub = path.join(base, e.name);
      if (hasVitsModel(sub)) return sub;
    }
  } catch {
    // 目录不存在等，静默
  }
  return null;
}
