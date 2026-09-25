// Sherpa-Onnx TTS 合成 Worker（独立 CJS，不参与 vite 打包）
// ------------------------------------------------------------------
// 为什么放 worker 线程：sherpa-onnx 的 OfflineTts.generate 是同步阻塞调用，
// 长文本会占用数百 ms ~ 数秒 CPU，放主进程会冻结整个应用（窗口/IPC 全卡）。
//
// 通用化：本 worker 不再专属于 Kokoro，而是通过 workerData.model 接收「内层 model 配置」，
// 由主进程按模型类型拼好（kokoro / vits / matcha…），这里只负责
//   new sherpa.OfflineTts({ model: workerData.model, maxNumSentences: 1 })
// 然后合成并写出 WAV。Kokoro 与 Piper 共用同一套引擎与 WAV 逻辑。
//
// 与主进程 tts-*.ts 的约定：
// - 启动参数 workerData：{ sherpaModulePath, model }
//     model 即传给 OfflineTts 的 model 内层对象，例如：
//       kokoro: { kokoro: { model, voices, tokens, dataDir?, lexicon? }, numThreads, provider }
//       vits:   { vits:   { model, tokens, dataDir, sid, lengthScale }, numThreads, provider }
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

// workerData.model 即内层 model 配置（kokoro/vits/...），直接交给 OfflineTts
const ttsModel = workerData.model || {};

let tts = null;
try {
  // ⚠️ 顶层键是 `model`（v1.13.x addon API）；numThreads/provider 在 model 内层。
  // 键名错误时 C++ 层全部字段为空，会抛 "Please check your config!"。
  tts = new sherpa.OfflineTts({
    model: ttsModel,
    maxNumSentences: 1,
  });
  // 附加 numSpeakers：导入 VITS 模型时主进程可据此探测说话人数（Piper/Kokoro 忽略该字段，向后兼容）
  parentPort.postMessage({ type: 'ready', numSpeakers: tts.numSpeakers });
} catch (err) {
  parentPort.postMessage({ type: 'load-error', error: String((err && err.message) || err) });
  process.exit(1);
}

/** Float32 采样写为 16bit PCM WAV */
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
