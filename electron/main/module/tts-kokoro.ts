/**
 * Kokoro 本地离线 TTS 模块（sherpa-onnx 推理 + worker_threads）
 * ------------------------------------------------------------------
 * 与上次失败实现的根因差异：Kokoro onnx 只认音素序列，文本→音素（G2P）必须由
 * 完整管线（misaki/lexicon/espeak-ng-data）完成——上次自写 178-token 词表 +
 * onnxruntime 裸跑导致合成失败。本模块改用 sherpa-onnx（G2P 内置 C++ 层），
 * 模型包使用官方 tarball（kokoro-multi-lang-v1_1，自带 tokens/lexicon/
 * espeak-ng-data/dict），不裸跑 onnx、不手写 tokenizer。
 *
 * 职责：
 * - 模型目录解析与校验（默认 userData/tts-models，支持渲染端导入自选目录，持久化在渲染端 store）
 * - 合成走独立 Worker（public/worker/kokoro.cjs）：generate 是同步阻塞调用，不能在主进程跑
 * - IPC：tts:kokoro:status / get-voices / is-available / synthesize / stop / choose-model-dir
 *
 * ⚠️ 改动本文件后必须重启 Electron；kokoro.cjs 是独立 CJS，不参与 vite 打包。
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { app, dialog, ipcMain } from 'electron';
import log from 'electron-log';
import { kokoroWorkerPath, appRoot } from '../variables.ts';

// ============ 模型目录与文件校验 ============

/** 默认模型目录：userData/tts-models/kokoro-multi-lang-v1_1 */
function defaultModelDir(): string {
  return path.join(app.getPath('userData'), 'tts-models', 'kokoro-multi-lang-v1_1');
}

/** 解析渲染端传入的目录（空/无效时回退默认目录） */
function resolveModelDir(explicit?: string): string {
  if (explicit && path.isAbsolute(explicit)) return explicit;
  return defaultModelDir();
}

/** sherpa-onnx kokoro 配置所需文件集（v1.13.x：model/voices/tokens/dataDir/lexicon，无 dictDir） */
interface KokoroPaths {
  model: string;
  voices: string;
  tokens: string;
  dataDir: string;
  lexicon?: string;
}

/** 校验目录内必需文件：model.onnx / voices.bin / tokens.txt / espeak-ng-data/ */
function resolveKokoroPaths(dir: string): KokoroPaths | null {
  try {
    const model = path.join(dir, 'model.onnx');
    const voices = path.join(dir, 'voices.bin');
    const tokens = path.join(dir, 'tokens.txt');
    const dataDir = path.join(dir, 'espeak-ng-data');
    if (!fs.existsSync(model) || !fs.existsSync(voices) || !fs.existsSync(tokens) || !fs.existsSync(dataDir)) {
      return null;
    }
    // lexicon*.txt 可能有多个（lexicon-zh.txt / lexicon-us-en.txt），sherpa 接受逗号分隔
    const lexiconFiles = fs
      .readdirSync(dir)
      .filter((f) => /^lexicon.*\.txt$/i.test(f))
      .map((f) => path.join(dir, f));
    return {
      model,
      voices,
      tokens,
      dataDir,
      lexicon: lexiconFiles.length ? lexiconFiles.join(',') : undefined,
    };
  } catch (err) {
    log.warn('[kokoro-tts] resolveKokoroPaths failed:', err);
    return null;
  }
}

/** 在目录（或其一级子目录）中寻找合法模型目录——兼容 tar.bz2 解压后多一层包目录的情况 */
function findKokoroDir(base: string): string | null {
  if (resolveKokoroPaths(base)) return base;
  try {
    const entries = fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const e of entries) {
      const sub = path.join(base, e.name);
      if (resolveKokoroPaths(sub)) return sub;
    }
  } catch {
    // 目录不存在等，静默
  }
  return null;
}

// ============ 音色表（kokoro-multi-lang-v1_1，共 103 个说话人） ============

export interface KokoroVoiceMeta {
  sid: number;
  name: string;
  gender: 'female' | 'male';
  lang: string;
}

/**
 * sid 分组（sherpa-onnx 官方文档口径）：
 *   0-1    美式女声（af）
 *   2      英式女声（bf）
 *   3-57   中文女声（zf，55 个）
 *   58-102 中文男声（zm，45 个）
 * 具体音色名以试听为准，v1 管理页不做主观命名。
 */
function buildKokoroVoices(): KokoroVoiceMeta[] {
  const voices: KokoroVoiceMeta[] = [
    { sid: 0, name: '美式女声 01', gender: 'female', lang: 'en-US' },
    { sid: 1, name: '美式女声 02', gender: 'female', lang: 'en-US' },
    { sid: 2, name: '英式女声 01', gender: 'female', lang: 'en-GB' },
  ];
  for (let sid = 3; sid <= 57; sid++) {
    voices.push({ sid, name: `中文女声 ${String(sid - 2).padStart(2, '0')}`, gender: 'female', lang: 'zh-CN' });
  }
  for (let sid = 58; sid <= 102; sid++) {
    voices.push({ sid, name: `中文男声 ${String(sid - 57).padStart(2, '0')}`, gender: 'male', lang: 'zh-CN' });
  }
  return voices;
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

class KokoroSynthHost {
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
  private ensure(paths: KokoroPaths): Promise<void> {
    if (this.worker) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = this.createWorker(paths);
    return this.loading.finally(() => {
      this.loading = null;
    });
  }

  private createWorker(paths: KokoroPaths): Promise<void> {
    return new Promise((resolve, reject) => {
      let sherpaModulePath: string;
      try {
        // 以项目根（打包后 resources/app）为解析基准，worker 内用同一入口路径 require
        sherpaModulePath = createRequire(path.join(appRoot, 'package.json')).resolve('sherpa-onnx-node');
      } catch {
        reject(new Error('未找到 sherpa-onnx-node 依赖，请先安装：pnpm add sherpa-onnx-node sherpa-onnx-win-x64'));
        return;
      }
      const worker = new Worker(kokoroWorkerPath, {
        workerData: {
          sherpaModulePath,
          numThreads: 2,
          debug: false,
          kokoro: paths,
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
          reject(new Error(`Kokoro 模型加载失败: ${msg.error}`));
        }
      };
      const onExit = () => {
        cleanupStartup();
        reject(new Error('Kokoro 合成线程启动失败'));
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
          p.reject(new Error(msg.error || 'Kokoro 合成失败'));
        }
      });
      worker.on('error', (err) => this.failAll(err));
      worker.on('exit', () => {
        if (this.worker === worker) this.failAll(new Error('Kokoro 合成线程已退出'));
      });
    });
  }

  async synthesize(paths: KokoroPaths, text: string, sid: number, speed: number): Promise<SynthResult & { url: string }> {
    await this.ensure(paths);
    const id = ++this.seq;
    const outPath = path.join(wavTmpDir(), `kokoro-${id}.wav`);
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

const synthHost = new KokoroSynthHost();

// ============ IPC 注册（由 tts.ts initTTS 调用） ============

export function initKokoroTTS() {
  log.info('Initializing Kokoro TTS module...');

  // 状态查询（管理页 v1 用）：installed + 实际生效目录 + 默认目录
  ipcMain.handle('tts:kokoro:status', (_event, modelDir?: string) => {
    const base = resolveModelDir(modelDir);
    const dir = findKokoroDir(base);
    return {
      installed: !!dir,
      dir: dir || base,
      defaultDir: defaultModelDir(),
    };
  });

  // 音色列表（未安装返回空数组）
  ipcMain.handle('tts:kokoro:get-voices', (_event, modelDir?: string): KokoroVoiceMeta[] => {
    const dir = findKokoroDir(resolveModelDir(modelDir));
    return dir ? buildKokoroVoices() : [];
  });

  // 可用性
  ipcMain.handle('tts:kokoro:is-available', (_event, modelDir?: string): boolean => {
    return !!findKokoroDir(resolveModelDir(modelDir));
  });

  // 选择模型目录：弹目录选择框并校验必需文件，成功返回实际模型目录（渲染端持久化）
  ipcMain.handle('tts:kokoro:choose-model-dir', async (): Promise<{ success: boolean; dir?: string; canceled?: boolean; error?: string }> => {
    const res = await dialog.showOpenDialog({
      title: '选择 Kokoro 模型目录（解压后的 kokoro-multi-lang-v1_1 文件夹）',
      properties: ['openDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return { success: false, canceled: true };
    const dir = findKokoroDir(res.filePaths[0]);
    if (!dir) {
      return {
        success: false,
        error: '所选目录缺少模型文件（需要 model.onnx / voices.bin / tokens.txt / espeak-ng-data）',
      };
    }
    return { success: true, dir };
  });

  // 合成：返回 file:// URL 供渲染端 <audio> 播放
  ipcMain.handle(
    'tts:kokoro:synthesize',
    async (
      _event,
      text: string,
      options: { sid?: number; speed?: number; modelDir?: string } = {}
    ): Promise<{ success: boolean; url?: string; durationMs?: number; error?: string }> => {
      try {
        const dir = findKokoroDir(resolveModelDir(options.modelDir));
        if (!dir) {
          return { success: false, error: 'Kokoro 模型未安装，请先下载并导入模型目录' };
        }
        const paths = resolveKokoroPaths(dir);
        if (!paths) return { success: false, error: 'Kokoro 模型文件校验失败' };
        const result = await synthHost.synthesize(paths, text, options.sid || 0, options.speed || 1);
        return { success: true, url: result.url, durationMs: result.durationMs };
      } catch (err: any) {
        log.error('[kokoro-tts] synthesize failed:', err);
        return { success: false, error: err?.message || 'Kokoro 合成失败' };
      }
    }
  );

  // 停止：终止 worker（同步推理无法软中断）
  ipcMain.handle('tts:kokoro:stop', async (): Promise<{ success: boolean }> => {
    synthHost.stop();
    return { success: true };
  });

  log.info('Kokoro TTS module initialized successfully');
}
