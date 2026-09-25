# 语音朗读 (ttsTest)

## 职责
TTS（语音合成）设置/体验页：选择默认提供商（系统 TTS / Web API / Kokoro / Piper）、调整语速与音色、朗读预览与试听，配置可复用为其它页面（天气播报、提醒等）的默认朗读设置。

## 关键文件
- `src/views/ttsTest/index.vue`（左侧设置面板：提供商单选 / 语速滑块 / 语音下拉 / Kokoro 与 Piper 本地模型管理；右侧预览：文本朗读、播放/停止/A·B 对比、可用语音网格；调用点 `ttsManager.speak` / `ttsManager.stop` / `previewVoice`）
  - **选择模型统一**：左侧「语音提供商」卡片与右侧「可用语音」的 系统/Web/Kokoro/Piper 标签共用同一个 `currentProvider` 数据源——点标签即等同于切换供应商。切换供应商后，「可用语音」网格与「朗读参数·语音」下拉自动切到该供应商的语音列表，且选中语音（`selectedVoice`）重置为该供应商「默认」，保证网格高亮与朗读参数下拉同源（同一 `selectedVoice`）。A/B 对比测试（`testDefault`）通过 `suppressProviderSync` 抑制切换副作用，测完恢复用户原选音。
  - **持久化**：选中的供应商（`tts_provider`）与语音（`tts_voice`）经 `getStoreAsync`/`setStoreAsync` 存入 `basic_info` 表；`switchProvider` 写供应商，`watch(selectedVoice)` 写语音（网格点击与下拉改动都覆盖）。`onMounted` 启动时读取并还原：供应商做白名单校验后回退默认，语音仅当属于当前供应商时才应用（防跨供应商串音）；还原阶段用 `suppressProviderSync` 屏蔽切供应商的「清空选音 / 重复加载」副作用。Kokoro / Piper 各自的模型目录分别存于 `tts_kokoro_model_dir` / `tts_piper_model_dir`。
- TTS 管理器：`src/utils/tts/index.ts`（`TTSManager`）、`SystemTTSProvider.ts`、`WebTTSProvider.ts`、`SherpaOnnxProvider.ts`（Kokoro / Piper 共用的基类：模型目录缓存、`synthesize`→`<audio>` 播放、`getVoices`/`isAvailable` 转发 IPC）、`KokoroProvider.ts`、`PiperProvider.ts`、`types.ts`（`TTSProviderType` 含 `'system'|'web'|'kokoro'|'piper'`）
- 主进程：`electron/main/module/tts.ts`（聚合注册 `initKokoroTTS` / `initPiperTTS`）、`tts-kokoro.ts`（Kokoro：sherpa-onnx `model.kokoro`）、`tts-piper.ts`（Piper：sherpa-onnx VITS `model.vits`，espeak-ng-data 优先用自身目录、否则回退 Kokoro 目录；**音色表按模型 onnx.json 的 num_speakers / speaker_id_map 动态生成，兼容任意 Piper 模型，不再写死 huayan 单音色**；**推理参数 length_scale / noise_scale / noise_w 从 onnx.json 的 inference 透传进 `vitsConfig`**，缺失回退 sherpa 默认 1.0/0.667/0.8；**统一模型库根目录（默认 userData/tts-models/piper），`scanPiperModels` 自动扫描根自身+一层子目录聚合所有合法 Piper 模型，`buildAllPiperVoices` 把各模型音色打平（每个带 modelKey+modelDir）；多模型各持一个常驻 worker（PiperSynthHub 按 modelDir 缓存），synthesize 按 voice 名解析出的具体模型目录加载对应 onnx**）、两者共用 `public/worker/sherpa-tts.cjs` 通用合成 Worker
- preload：`electron/preload/index.ts` 暴露 `window.ipcRenderer.tts.*`（含 `kokoro` / `piper` 两个对称子命名空间，各 6 个方法）

## 路由
- `RouteNames.TTS_TEST` → path `/ttsTest`

## 用到的 IPC 通道（经 preload `tts.*` 命名空间，非 `send/sendSync`）
- `tts:speak(text, options)`、`tts:stop()`、`tts:get-voices()`、`tts:is-available()`
- `tts:system:speak` / `tts:system:stop` / `tts:system:get-voices` / `tts:system:is-available`
- `tts:kokoro:status` / `tts:kokoro:get-voices` / `tts:kokoro:is-available` / `tts:kokoro:choose-model-dir` / `tts:kokoro:synthesize` / `tts:kokoro:stop`
- `tts:piper:status` / `tts:piper:get-voices` / `tts:piper:is-available` / `tts:piper:choose-model-dir` / `tts:piper:synthesize` / `tts:piper:stop`（与 kokoro 对称；Piper 为 sherpa-onnx VITS，espeak-ng-data 复用 Kokoro 目录）
- 渲染端通过 `TTSManager`（src/utils/tts）调用，底层即 `window.ipcRenderer.tts.*`（preload 转 `ipcRenderer.invoke('tts:*')`）

## 复用 / 集成点
- `TTSManager` 统一多提供商 + 自动降级，其它需要朗读的模块（如天气播报、提醒）应复用它，不要各自直连通道。
- 命令面板 REGISTRY 可跳转。

## 特有坑 / 注意
- 本模块走 preload 的 `tts.*` 命名空间（约定：TTS 经 `tts.*`、电子书经 `ebook.*`、剪贴板经 `clipboard.*`），不要改用 `send('tts:speak', ...)` 裸调。
- `tts:speak` 返回 `{success, error?}`，系统 TTS 不可用时由 `TTSManager` 自动降级到 Web TTS，但 Web TTS 依赖浏览器引擎，需在渲染进程环境可用。
- 多次 `speak` 会排队/打断，调用 `stop` 释放资源，避免并发朗读叠加。
- Piper 导入「统一模型库根目录」：`tts_piper_model_dir` 现指向**库根目录**（默认 userData/tts-models/piper），库根下每个子文件夹即一个 Piper 模型；`scanPiperModels` 扫描根自身+一层子目录找出所有合法模型目录，`buildAllPiperVoices` 聚合所有音色。`findPiperModelFile` 仍扫描任意 `*.onnx`+同目录 `*.onnx.json`+`tokens.txt`；`buildPiperVoices(dir)` 读 onnx.json 动态生成语音列表（多说话人自动展开 N 个，语种标签取自模型）。**语音名格式 `piper:<modelKey>:<sid>`**（modelKey 由模型子文件夹名 slug 生成），`PiperProvider` 据此解析具体 modelDir 走对应 worker 合成；`mapVoices` 已按 `RawSherpaVoice`（description/lang/gender/modelKey/modelDir）对齐，主进程须返回 `description` 而非 `name`，否则卡片描述为空。导入时选「模型库目录」即可，往里丢模型文件夹无需逐个导入。
