# 语音合成测试 (ttsTest)

## 职责
TTS（语音合成）调试/体验页：选择提供商（系统 TTS / Web TTS）、朗读文本、停止、切换音色与语速，验证语音能力。

## 关键文件
- `src/views/ttsTest/index.vue`（调用点：行 241 `ttsManager.speak`、254 `ttsManager.stop`、293/311 朗读预览）
- TTS 管理器：`src/utils/tts/index.ts`（`TTSManager`）、`SystemTTSProvider.ts`、`WebTTSProvider.ts`、`types.ts`
- 主进程：`electron/main/module/tts.ts`（`tts:get-voices` 129、`tts:speak` 138、`tts:stop` 148、`tts:is-available` 158，及 `tts:system:*` 系列 87–117）
- preload：`electron/preload/index.ts` 暴露 `window.ipcRenderer.tts.*`

## 路由
- `RouteNames.TTS_TEST` → path `/ttsTest`

## 用到的 IPC 通道（经 preload `tts.*` 命名空间，非 `send/sendSync`）
- `tts:speak(text, options)`、`tts:stop()`、`tts:get-voices()`、`tts:is-available()`
- `tts:system:speak` / `tts:system:stop` / `tts:system:get-voices` / `tts:system:is-available`
- 渲染端通过 `TTSManager`（src/utils/tts）调用，底层即 `window.ipcRenderer.tts.*`（preload 转 `ipcRenderer.invoke('tts:*')`）

## 复用 / 集成点
- `TTSManager` 统一多提供商 + 自动降级，其它需要朗读的模块（如天气播报、提醒）应复用它，不要各自直连通道。
- 命令面板 REGISTRY 可跳转。

## 特有坑 / 注意
- 本模块走 preload 的 `tts.*` 命名空间（约定：TTS 经 `tts.*`、电子书经 `ebook.*`、剪贴板经 `clipboard.*`），不要改用 `send('tts:speak', ...)` 裸调。
- `tts:speak` 返回 `{success, error?}`，系统 TTS 不可用时由 `TTSManager` 自动降级到 Web TTS，但 Web TTS 依赖浏览器引擎，需在渲染进程环境可用。
- 多次 `speak` 会排队/打断，调用 `stop` 释放资源，避免并发朗读叠加。
