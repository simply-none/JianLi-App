// Kokoro TTS 合成 Worker（独立 CJS 文件，不参与 vite 打包）
// ------------------------------------------------------------------
// 为什么放 worker 线程：sherpa-onnx 的 OfflineTts.generate 是同步阻塞调用，
// 长文本会占用数百 ms ~ 数秒 CPU，放主进程会冻结整个应用（窗口/IPC 全卡）。
//
// 与主进程 tts-kokoro.ts 的约定：
// - 启动参数 workerData：{ sherpaModulePath, numThreads, debug, kokoro: { model, voices, tokens, dataDir?, lexicon?, dictDir? } }
// - 模型加载完成（或失败）postMessage 一条：{ type: 'ready' } / { type: 'load-error', error }
// - 合成请求：{ id, text, sid, speed, outPath }
// - 合成结果：{ type: 'result', id, success, wavPath?, durationMs?, error? }
//
// ⚠️ 依赖 sherpa-onnx-node / sherpa-onnx-win-x64（npm 依赖，需先安装）。
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const { createRequire } = require('module');

// sherpa-onnx-node 的入口路径由主进程 require.resolve 后传入（pnpm symlink 结构下
// 以 worker 文件自身位置解析可能失败，以主进程解析结果为基准最稳）。
const req = createRequire(workerData.sherpaModulePath);
const sherpa = req('sherpa-onnx-node');

const kokoro = workerData.kokoro || {};
// kokoro 子配置字段与 sherpa-onnx-node types.js OfflineTtsKokoroModelConfig 对齐：
// { model, voices, tokens, dataDir, lengthScale?, lexicon?, lang? }（v1.13.8 无 dictDir，勿传）
const kokoroConfig = {
  model: kokoro.model,
  voices: kokoro.voices,
  tokens: kokoro.tokens,
};
if (kokoro.dataDir) kokoroConfig.dataDir = kokoro.dataDir;
if (kokoro.lexicon) kokoroConfig.lexicon = kokoro.lexicon;

let tts = null;
try {
  // ⚠️ 顶层键是 `model`（v1.13.x addon API），不是旧 WASM 示例的 `modelConfig`；
  // numThreads/provider/debug 也在 model 内层。键名错误时 C++ 层全部字段为空，
  // 会抛 "Please check your config!"。
  tts = new sherpa.OfflineTts({
    model: {
      kokoro: kokoroConfig,
      debug: workerData.debug ? true : false,
      numThreads: workerData.numThreads || 2,
      provider: 'cpu',
    },
    maxNumSentences: 1,
  });
  parentPort.postMessage({ type: 'ready' });
} catch (err) {
  parentPort.postMessage({ type: 'load-error', error: String((err && err.message) || err) });
  process.exit(1);
}

/** Float32 采样写为 16bit PCM WAV（Kokoro 输出 24kHz mono） */
function writeWavFile(samples, sampleRate, outPath) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    let s = samples[i];
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    pcm.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(outPath, Buffer.concat([header, pcm]));
}

parentPort.on('message', (msg) => {
  if (!tts || !msg || typeof msg.id !== 'number') return;
  try {
    // enableExternalBuffer: false —— Electron >= 21 禁用 V8 external buffer（官方 FAQ），
    // 不传会抛 "External buffers are not allowed"；false 时 addon 改用拷贝返回 samples
    const audio = tts.generate({ text: msg.text, sid: msg.sid || 0, speed: msg.speed || 1, enableExternalBuffer: false });
    writeWavFile(audio.samples, audio.sampleRate, msg.outPath);
    parentPort.postMessage({
      type: 'result',
      id: msg.id,
      success: true,
      wavPath: msg.outPath,
      sampleRate: audio.sampleRate,
      durationMs: Math.round((audio.samples.length / audio.sampleRate) * 1000),
    });
  } catch (err) {
    parentPort.postMessage({ type: 'result', id: msg.id, success: false, error: String((err && err.message) || err) });
  }
});
