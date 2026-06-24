# Electron 开机自启动修复方案

## 问题分析

### 当前实现方式
项目当前使用 `auto-launch` 第三方库实现开机自启动功能，代码位于 `electron/main/module/mainWindow.ts`。该库通过直接修改 Windows 注册表的 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 来添加自启动项。

### 问题原因
1. **杀毒软件拦截**：`auto-launch` 直接修改注册表的方式容易被杀毒软件（如 360、腾讯电脑管家等）视为恶意行为并拦截
2. **权限问题**：当应用以管理员身份运行时，普通用户权限无法写入注册表
3. **UAC 弹窗**：即使自启动设置成功，开机时可能会弹出 UAC 用户账户控制对话框

## 解决方案

采用**多重方案**确保自启动功能可靠：

### 方案一：使用 Electron 内置 API（首选）
Electron 提供了 `app.setLoginItemSettings()` API，在 Windows 上会通过创建快捷方式到启动文件夹来实现自启动，比直接修改注册表更安全。

### 方案二：创建启动文件夹快捷方式（备用）
直接在用户启动文件夹 `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup` 创建应用快捷方式。

### 方案三：使用任务计划程序（备选）
通过 Windows 任务计划程序创建自启动任务，这种方式更不容易被杀毒软件拦截。

## 实施计划

### 文件修改清单

| 文件路径 | 修改内容 |
|---------|---------|
| `electron/main/module/mainWindow.ts` | 重写自启动逻辑，实现多重方案 |
| `electron/main/module/autoStartup.ts` | 新增自启动模块，封装各种自启动方案 |

### 实施步骤

#### 步骤 1：创建自启动模块
创建 `electron/main/module/autoStartup.ts`，封装三种自启动方案：

```typescript
// 方案一：Electron 内置 API
function setLoginItemSettings(isStartup: boolean): boolean

// 方案二：创建启动文件夹快捷方式
function createStartupShortcut(isStartup: boolean): boolean

// 方案三：任务计划程序
function createTaskScheduler(isStartup: boolean): boolean
```

#### 步骤 2：修改 mainWindow.ts
- 删除 `auto-launch` 相关代码
- 导入新的自启动模块
- 修改 `isSetStartup` 函数，按优先级依次尝试各种方案

#### 步骤 3：完善错误处理和日志
- 添加详细的错误日志
- 在设置失败时提供用户提示
- 保存自启动状态到配置文件

### 技术细节

#### Windows 启动文件夹路径
- 用户启动文件夹：`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`
- 系统启动文件夹：`C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp`

#### 任务计划程序命令
```
schtasks /create /tn "渐离App" /tr "\"C:\Path\To\App.exe\"" /sc onstart /f
schtasks /delete /tn "渐离App" /f
```

#### 快捷方式创建方法
使用 `fs` 模块创建 `.lnk` 文件，或通过 PowerShell 命令创建：
```
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('...'); ..."
```

## 风险评估

| 风险 | 等级 | 应对措施 |
|-----|------|---------|
| 杀毒软件仍可能拦截 | 中 | 提供多种方案备选，设置失败时提示用户手动添加 |
| 权限不足 | 低 | 优先使用用户级启动文件夹，避免需要管理员权限的操作 |
| 跨平台兼容性 | 低 | 针对 Windows、macOS、Linux 分别处理 |

## 验证方案

1. 在安装了主流杀毒软件（360、腾讯电脑管家、Windows Defender）的环境中测试
2. 测试普通用户和管理员权限下的自启动设置
3. 重启系统验证自启动是否生效
4. 测试自启动设置的启用/禁用功能
