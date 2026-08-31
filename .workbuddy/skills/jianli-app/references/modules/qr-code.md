# 二维码能力层 (qr-code)

## 职责
「渐离App」内置的**可复用二维码公共能力层**，供任意业务模块（二维码页、习惯打卡、名片、Wi-Fi 分享等）调用，**不锁死在单个页面**。

分层：
- **L1 能力层**（`src/utils/qrcode/`，纯函数无 UI）— 生成 / 识别 / 编码 / 拼装 / 历史读写 / IPC 封装。
- **L2 复用 UI**（全局组件）— `QrCodeView` / `QrCodeDialog` / `QrDropZone` + `showQrCode()` 命令式服务。
- **L3 页面**（`src/views/qrCode/`）— 四 Tab（生成 / 批量 / 识别 / 历史）+ 动态表单 + 样式选择 + 全局 store。

能力覆盖：
- **生成**：纯文本 / 网址 / Wi-Fi / 联系人(vCard) / 邮件 / 短信 / 电话 / 地理位置 / 日历事件 共 9 种内容类型，支持圆点样式、定位角样式、背景、logo、渐变。
- **识别**：从图片（拖拽 / 选择 / File / ImageData / dataURL）解码，多尺度重试提升定位成功率。
- **持久化**：全局统一的 `qr_history`（历史）与 `qr_template`（模板）两张表，`source` 列区分来源。
- **导出**：保存 PNG / 保存文本 / 批量 ZIP / 复制到剪贴板（均经主进程原生对话框，渲染端不碰磁盘）。

## 关键文件
### L1 能力层（已落地，`src/utils/qrcode/`，纯函数无 UI）
- `types.ts` —— 全部公共类型（`QrPayloadType` / `QrPayload` 九态联合 / `QrStyleOptions` / `QrHistoryRecord` / `QrTemplate` / `QrRenderResult` / `QrDecodeResult`）。
- `encoding.ts` —— **中文 UTF-8 修正**：`toUtf8Data` / `bytesToUtf8`；`calcByteLength`、`estimateVersion`、`estimateModuleCount(byteLength, ecc)`（=21+4×(v-1)，用于「码点数量」只读展示）。
- `payload.ts` —— 9 种内容的拼装（`buildText/buildUrl/buildWifi/buildContact/buildEmail/buildSms/buildTel/buildGeo/buildEvent` + 统一 `buildPayload`）。
- `parse.ts` —— 反向反解析（`detectType` / `parsePayload`，尽力而为还原为 `QrPayload`）。
- `engine.ts` —— **唯一接触 `qr-code-styling`** 的文件；动态 `import('qr-code-styling')` + `.default ?? mod` 防御 UMD，喂库前必做 `toUtf8Data`；导出 `renderQr(opts) => { dataUrl, raw }`。
  - `shape` 字段 → 联动码点(`dotsType`)+码眼(`cornersSquareType`/`cornersDotType`)；码点/码眼/背景均支持纯色或渐变(`*Gradient`)。
  - **Logo 合成（右下角/形状/投影）**：qr-code-styling 原生仅支持居中 Logo，故引擎先渲染无 Logo 二维码，再用 canvas 2D 二次合成 `composeLogo`：居中时铺同色圆角底模拟 `hideBackgroundDots`，右下角直接贴；支持 square/rounded/circle 裁切 + 边框投影。
- `decode.ts` —— **唯一接触 `jsqr`** 的文件；`decodeQr(source)` 支持多种图片来源 + 1x/2x/3x/4x 多尺度重试。**关键坑**：`jsqr` 的 `result.data` 本身已是 UTF-8 解码后的字符串（`decodeByte` 内部用 `decodeURIComponent`），识别端**直接用它**，绝不可再对结果跑 `bytesToUtf8`/`fromUtf8Data` 二次解码（否则中文变 `Kգ…` 这类乱码）；仅当 `result.data` 为空才回退用 `result.binaryData` + `bytesToUtf8` 手动解。
- `shapes.ts` —— 码点/码眼形状映射：`QR_SHAPE_OPTIONS`（6 种原生形状：方正/圆角/粗圆角/粗圆形/优雅/优雅圆角，因库不支持菱形/星形等故仅保留原生）、`applyShape`（选形状即联动码点+码眼）、`resolveShapeKey`（反推已选形状，供预设套用后高亮）。
- `presets.ts` —— 8 套样式预设（`QR_STYLE_PRESETS` + `getPreset`）；`QR_COMMON_COLORS`（常用色板）；`QR_GRADIENT_PRESETS`（渐变预设）。
- `history.ts` —— 历史 / 模板读写（`addQrHistory/getQrHistory/deleteQrHistory/clearQrHistory/saveQrTemplate/getQrTemplates/deleteQrTemplate`），走 newSql 三件套，表结构由主进程建好。
- `ipc.ts` —— 渲染端 4 条 IPC 封装（`saveQrImage/saveQrText/saveQrZip/copyQrImage`）。
- `index.ts` —— 桶文件，业务方 `import { renderQr, decodeQr, buildPayload, ... } from '@/utils/qrcode'`。

### 主进程（已落地）
- `electron/main/module/qrcode.ts` —— 4 条 IPC：`qr:save-image` / `qr:save-text` / `qr:save-zip` / `qr:copy-image`；`initQrCode()` 用 `ensureTableExists` **安全建表**（带 `key` 主键 TEXT + `source` 列），**不走危险的 `new-sql:execute`**。
- `electron/main/index.ts` —— 已 `import { initQrCode }` 并在 `createWindow()` 末尾 `await initQrCode()`。
- ⚠️ 改主进程后**必须重启 Electron**。

### L2 复用 UI（已落地，全局组件）
- `src/components/qrcode/QrCodeView.vue` —— 渲染核心：把「内容 + 样式」渲染成二维码 PNG（异步/加载/错误态），`expose getDataUrl()` 供保存/复制/打包；任意模块 `<QrCodeView :content="..." />` 复用。
- `src/components/qrcode/QrDropZone.vue` —— 识别拖拽区：拖拽 / 点击选图 → `decodeQr`（多尺度重试），内联复制/打开；`v-model:result` 暴露结果。
- `src/components/qrcode/QrCodeDialog.vue` —— 弹窗（包 `AppDialog`）：`QrCodeView` + 下载/复制/存文本 三动作；模板内 `<QrCodeDialog v-model="visible" :content="..." />`。
- `src/components/qrcode/service.ts` —— `showQrCode({ content, title, styleOptions, defaultName })` 命令式挂载（createApp + ElementPlus），供其它模块不挂模板也能弹二维码；返回 `{ close }`。

### L3 页面（已落地，`src/views/qrCode/`）
- `index.vue` —— 容器：`LayoutVue` + 通用 `TopTabs` 四 Tab（生成/批量/识别/历史），`flex:1 + min-height:0` 撑满，主题 token 不硬编码。
- `tabs/generate/index.vue` —— 9 种内容动态表单 → 实时预览 → 下载/复制/存历史；容量估算（超容量提示）。
- `tabs/batch/index.vue` —— 多行文本批量生成 → 缩略图网格 → 打包 ZIP / 全部存历史。
- `tabs/scan/index.vue` —— 复用 `QrDropZone` 识别。
- `tabs/history/index.vue` —— 全局统一 `qr_history`，按 `source` 过滤（本模块/全部），预览/复制/删除/清空。
- `components/StylePicker.vue` —— 样式选择器，三段式：**Logo**（上传/形状/尺寸/位置[中间·右下角]/边框投影）、**码点码眼**（前景色[普通色+渐变]/背景色/形状网格[6 原生]/码内眼色/码外眼色/码点数量只读）、**其他设置**（码边距/容错率百分比）。
- `components/ColorField.vue` —— 颜色字段原子组件（纯色取色器+常用色板 / 渐变委托 GradientEditor）。
- `components/GradientEditor.vue` —— 渐变编辑器（线性/径向、角度、多色标增删、渐变预设套用）。
- `config/payloadForms.ts` —— 9 种内容表单 schema（`QR_FORMS` / `getForm` / `buildFromForm`）。
- `src/store/useQrCode.ts` —— 全局 store：`QR_SOURCE='qrCode'`、`currentStyle`（持久化 `qr-code:style`）、`historyRefreshToken`（历史刷新信号）。

## 路由 / 入口（已登记）
- `src/router/index.ts` —— `RouteNames.QR_CODE = "qrCode"` → `/qrCode`。
- `src/layout/index.vue` —— 「效率工具」组 `names` 加 `qrCode`（侧边栏入口）。
- `src/utils/index.ts` —— `iconMap.qrCode = 'QrCode'`。
- `src/views/routeSetting/index.vue` —— 「效率工具」组 `names` 加 `qrCode`（可见开关）。
- `src/components/LucideIcon.vue` —— `nameMap` 补 `QrCode / ScanQrCode / ScanLine / Contact / Grid2x2 / Mail`（均已在 `@lucide/vue` 验证存在）。
- 遵循 `SKILL.md` 红线 8：侧边栏 + 显隐开关同步登记。

## 用到的 IPC 通道
| 通道 | 方向 | 用途 |
|---|---|---|
| `qr:save-image` | 渲染→主 | 保存二维码 PNG（原生对话框 + 写文件） |
| `qr:save-text` | 渲染→主 | 保存二维码原始文本（TXT） |
| `qr:save-zip` | 渲染→主 | 批量打包多张二维码为 ZIP |
| `qr:copy-image` | 渲染→主 | 复制二维码图片到系统剪贴板 |
| `new-sql:query` / `upsert` / `delete` | 渲染→主 | 历史 / 模板读写（经 `history.ts`） |

## 复用 / 集成点
- **第三方库**：`qr-code-styling@1.9.2`（生成，UMD）、`jsqr@1.4.0`（识别，UMD）。用户已手动安装。两者均无 ESM 入口，靠 Vite CJS interop + 动态 `import()` + `.default ?? mod` 防御。
- **UTF-8 坑**：生成前 `toUtf8Data`、识别后 `fromUtf8Data`，二者配对，保证中文扫码不乱码（标准手机扫描器按 UTF-8 解析字节）。
- **进程边界**：生成（需 DOM/Canvas）在渲染端；保存 / 复制 / 打包（需磁盘 / 剪贴板）在主进程。**渲染端严禁 `import('electron')`**。
- **历史来源**：任意模块调用 `addQrHistory({ source: '<自己的来源标识>', ... })`；`getQrHistory({ source })` 可按来源筛。页面统一记、`source` 区分。

## 特有坑 / 注意
- **中文乱码**：务必走 `engine.renderQr`（已内置 `toUtf8Data`），不要直接用裸 `qr-code-styling` 喂中文原文。
- **UMD 导入**：`jsqr` 导出既是函数又带 `.default`，`mod.default ?? mod` 防御；若 Vite 预打包报 `require is not defined`，回退 `jsqr-es6`（同 API 的 ESM 分发）。
- **ECC 与 logo**：带 logo 时建议容错 ≥ M，否则可能扫不出。
- **表结构**：`qr_history` / `qr_template` 由主进程 `initQrCode` 建；渲染端 `history.ts` 只读写，不触发自动建表，避免破表。

## 待办 / 未落地（后续阶段）
- 跨模块接入示例：在名片 / Wi-Fi 分享 / 习惯打卡中调用 `showQrCode()`，写入 `source` 区分。
- E2E 验证：真机扫码中文、批量导出 ZIP、跨模块写入 `source` 筛选。
- 模板（qr_template）在页面侧的创建/选用 UI 尚未做（能力层已就绪）。
