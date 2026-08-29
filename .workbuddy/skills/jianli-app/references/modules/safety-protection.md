# 安全防护 (safetyProtection)

## 职责
密码/敏感信息的安全防护面板：对加密存储的密码做解密查看等安全操作，密钥相关加解密由主进程 `crypto.ts` 完成，不暴露明文到渲染端。

## 关键文件
- `src/views/safetyProtection/index.vue`（行 339 `sendSync('decrypt-pwd', {text: enc})`）
- store：`src/store/useSafetyProtection.ts`
- 主进程：`electron/main/module/crypto.ts`（`encrypt-pwd` 行 138、`decrypt-pwd` 行 164、`compare-pwd` 行 192，均为 `ipcMain.on`）

## 路由
- `RouteNames.SAFETY_PROTECTION` → path `/safetyProtection`

## 用到的 IPC 通道
- `decrypt-pwd`（渲染→主，`sendSync`，`{text}`）→ 解密后返回明文
- 同模块能力还可能用 `encrypt-pwd` / `compare-pwd`（`crypto.ts`，加密/校验），扩展时按需在渲染端调用

## 复用 / 集成点
- 加解密全部在主进程完成，渲染端只传密文、收明文，遵循「密钥不落地渲染端」的安全约定。
- 命令面板 REGISTRY 可跳转。

## 特有坑 / 注意
- `decrypt-pwd` 是**同步**通道（`ipcMain.on` + `sendSync`），会阻塞渲染线程，仅对小数据量密码使用；大批量解密应改用异步 `handle`。
- `crypto.ts` 的三个通道均为 `ipcMain.on`（非 `handle`），返回靠 `event.reply` 或 `sendSync` 回值，调用方必须用 `sendSync` 才能拿到返回值。
- 切勿在渲染端 `import` 任何加密库直接解密钥，主进程是唯一信任边界。
