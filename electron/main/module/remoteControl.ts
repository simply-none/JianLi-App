/**
 * 手机遥控 PC 模块（P3-3，2026-09-19）
 *
 * 复用 syncModule 的 47124 数据面（registerDataRoute 注入 /remote/*，不新开端口）。
 * 手机端「遥控 PC」页发出白名单指令，主进程经 PowerShell / rundll32 落到系统层：
 * 第一批（主面板）：
 *   - page-prev / page-next / screen-black / screen-white : SendKeys（作用于前台窗口，PPT/浏览器/阅读器通用）
 *   - media-play / media-prev / media-next / media-stop / vol-up / vol-down / vol-mute
 *       : keybd_event 虚拟媒体键（SendKeys 不支持 VK_MEDIA_*，P/Invoke 内联）
 *   - lock : rundll32 user32.dll,LockWorkStation
 * 第二批（「更多命令」抽屉，2026-09-22）：
 *   - presentation-start / presentation-end : keybd_event VK_F5 / VK_ESCAPE（PPT 开始/结束放映）
 *   - show-desktop / alt-tab / alt-f4 : keybd_event 组合键（Win+D / Alt+Tab / Alt+F4）
 *   - key-up / key-down / key-left / key-right : keybd_event 方向键
 *   - monitor-off : WM_SYSCOMMAND + SC_MONITORPOWER 关闭显示器（任意输入唤醒）
 *   - clipboard-text : body.arg 文本 → Electron clipboard（手机 → PC 剪贴板，上限 3000 字）
 *   - open-url : body.arg 链接 → shell.openExternal（仅 http/https，防协议注入）
 *
 * 安全模型（v1）：4 位配对码。手机 `POST /remote/pair` → PC 弹系统对话框显示 4 位码
 * （**码不进 HTTP 响应**，只有坐在电脑前的人能看到）→ 手机 `POST /remote/pair/confirm`
 * 提交码 → PC 校验通过后下发配对 token（手机持久化，之后每条命令带 token 头）。
 * 命令集硬编码白名单，无任意代码执行面；token 持久化在 basic_info(remote_pair_token)，
 * PC 端可在「遥控」重新生成（旧 token 作废）。
 */

import { execFile, spawn } from 'node:child_process'
import { clipboard, dialog, shell } from 'electron'
import { registerDataRoute } from './sync/syncModule.ts'
import { queryByConditions, upsertData } from '../utils/sql.ts'
import { myDb } from './newSql.ts'
import { tableName as basicInfoTable } from './store.ts'

const PAIR_TOKEN_KEY = 'remote_pair_token'
const CODE_TTL_MS = 10 * 60 * 1000

/** 当前待确认的配对码（内存态；PC 重启即失效，重新申请即可） */
let pendingCode: { code: string; expires: number } | null = null
let cachedToken: string | null = null

/** 读 basic_info 值（JSON.parse 容错，与 stock.ts 同款口径） */
function queryBasicInfoValue(key: string): Promise<unknown | null> {
  return new Promise((resolve) => {
    queryByConditions({
      db: myDb.db,
      tableName: basicInfoTable,
      conditions: { key },
      callback: (err, rows) => {
        if (err || !rows || rows.length === 0) {
          resolve(null)
          return
        }
        try {
          resolve(JSON.parse(rows[0].value))
        } catch {
          resolve(rows[0].value)
        }
      },
    })
  })
}

function upsertBasicInfo(key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    upsertData({
      db: myDb.db,
      tableName: basicInfoTable,
      data: { key, value: JSON.stringify(value) },
      config: { primaryKey: 'key' },
      callback: (err) => (err ? reject(err) : resolve()),
    })
  })
}

/** 配对 token（懒生成 + 内存缓存；重新生成即踢掉旧手机） */
async function ensureToken(): Promise<string> {
  if (cachedToken) return cachedToken
  const stored = await queryBasicInfoValue(PAIR_TOKEN_KEY)
  if (typeof stored === 'string' && stored.length >= 16) {
    cachedToken = stored
    return cachedToken
  }
  cachedToken = crypto.randomUUID().replace(/-/g, '')
  await upsertBasicInfo(PAIR_TOKEN_KEY, cachedToken)
  return cachedToken
}

/** 重置配对（生成新 token 作废旧手机；由「重新配对」命令触发） */
async function rotateToken(): Promise<string> {
  cachedToken = crypto.randomUUID().replace(/-/g, '')
  await upsertBasicInfo(PAIR_TOKEN_KEY, cachedToken)
  return cachedToken
}

/** 读请求体（JSON，上限 4KB 防滥用） */
function readBody(req: import('node:http').IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = ''
    let over = false
    req.on('data', (c: Buffer) => {
      raw += c.toString('utf8')
      if (raw.length > 4096) over = true
    })
    req.on('end', () => {
      if (over) return resolve({})
      try {
        resolve(JSON.parse(raw || '{}'))
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

function json(res: import('node:http').ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

/** 演示翻页/黑屏：SendKeys 作用于前台窗口（PGUP/PGDN/b；PPT 与主流阅读器/浏览器通用） */
function sendKeys(keys: string): Promise<void> {
  return new Promise((resolve, reject) => {
    spawn(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keys}')`,
      ],
      { windowsHide: true, timeout: 8000 },
    )
      .on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`SendKeys exit ${code}`))))
      .on('error', reject)
  })
}

/** keybd_event P/Invoke 前缀（每次 spawn 都要重新 Add-Type，进程不共享） */
const KB_ADDTYPE =
  `Add-Type -Namespace Jl -Name Kb -MemberDefinition '[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);'`

/** 单键按下+抬起：keybd_event P/Invoke（VK_MEDIA_*=0xB0..0xB3，VK_VOLUME_*=0xAD..0xAF，
 *  另复用于 F5/Esc/方向键等非媒体虚拟键——SendKeys 表达不了它们） */
function mediaKey(vk: number): Promise<void> {
  return new Promise((resolve, reject) => {
    spawn(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `${KB_ADDTYPE}; [Jl.Kb]::keybd_event(${vk},0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 40; [Jl.Kb]::keybd_event(${vk},0,2,[UIntPtr]::Zero)`,
      ],
      { windowsHide: true, timeout: 8000 },
    )
      .on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`mediaKey exit ${code}`))))
      .on('error', reject)
  })
}

/** 组合键（Win+D / Alt+Tab / Alt+F4）：keybd_event 依次按下、再逆序抬起 */
function keyCombo(vks: number[]): Promise<void> {
  const down = vks
    .map((vk) => `[Jl.Kb]::keybd_event(${vk},0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 30`)
    .join('; ')
  const up = [...vks]
    .reverse()
    .map((vk) => `[Jl.Kb]::keybd_event(${vk},0,2,[UIntPtr]::Zero)`)
    .join('; ')
  return new Promise((resolve, reject) => {
    spawn(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', `${KB_ADDTYPE}; ${down}; ${up}`],
      { windowsHide: true, timeout: 8000 },
    )
      .on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`keyCombo exit ${code}`))))
      .on('error', reject)
  })
}

/** 关闭显示器：WM_SYSCOMMAND(0x0112) + SC_MONITORPOWER(0xF170, lParam=2)，任意输入唤醒 */
function monitorOff(): Promise<void> {
  const u32 =
    `Add-Type -Namespace Jl -Name U32 -MemberDefinition '[DllImport("user32.dll")] public static extern System.IntPtr SendMessage(System.IntPtr hWnd, uint Msg, System.IntPtr wParam, System.IntPtr lParam);'`
  return new Promise((resolve, reject) => {
    spawn(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `${u32}; [Jl.U32]::SendMessage([IntPtr]0xFFFF, [IntPtr]0x0112, [IntPtr]0xF170, [IntPtr]2)`,
      ],
      { windowsHide: true, timeout: 8000 },
    )
      .on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`monitorOff exit ${code}`))))
      .on('error', reject)
  })
}

/** 手机文本 → PC 剪贴板（随后 PC 上 Ctrl+V 粘贴；上限 3000 字防滥用） */
function clipboardText(text: string): void {
  const value = text.slice(0, 3000)
  if (!value.trim()) throw new Error('文本为空')
  clipboard.writeText(value)
}

/** 让 PC 打开网址（仅 http/https，防任意协议注入） */
async function openUrl(url: string): Promise<void> {
  const u = url.trim()
  if (!/^https?:\/\/\S+$/i.test(u)) throw new Error('仅支持 http/https 链接')
  await shell.openExternal(u)
}

/** 锁屏 */
function lockWorkStation(): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('rundll32.exe', ['user32.dll,LockWorkStation'], { timeout: 5000 }, (err) =>
      err ? reject(err) : resolve(),
    )
  })
}

/** 命令白名单（键 → 执行器；不在表内一律 400）。
 *  第二批命令的参数经 body.arg 传入（clipboard-text = 文本 / open-url = 链接） */
const COMMANDS: Record<string, (arg: string) => Promise<void>> = {
  'page-prev': () => sendKeys('{PGUP}'),
  'page-next': () => sendKeys('{PGDN}'),
  'screen-black': () => sendKeys('b'),
  'screen-white': () => sendKeys('w'), // PPT 白屏（与黑屏 b 成对）
  'media-play': () => mediaKey(0xb3), // VK_MEDIA_PLAY_PAUSE
  'media-prev': () => mediaKey(0xb1), // VK_MEDIA_PREV_TRACK
  'media-next': () => mediaKey(0xb0), // VK_MEDIA_NEXT_TRACK
  'media-stop': () => mediaKey(0xb2), // VK_MEDIA_STOP
  'vol-up': () => mediaKey(0xaf), // VK_VOLUME_UP
  'vol-down': () => mediaKey(0xae), // VK_VOLUME_DOWN
  'vol-mute': () => mediaKey(0xad), // VK_VOLUME_MUTE
  'presentation-start': () => mediaKey(0x74), // VK_F5 开始放映
  'presentation-end': () => mediaKey(0x1b), // VK_ESCAPE 结束放映
  'show-desktop': () => keyCombo([0x5b, 0x44]), // Win + D
  'alt-tab': () => keyCombo([0x12, 0x09]), // Alt + Tab 切换窗口
  'alt-f4': () => keyCombo([0x12, 0x73]), // Alt + F4 关闭当前窗口
  'key-up': () => mediaKey(0x26), // VK_UP
  'key-down': () => mediaKey(0x28), // VK_DOWN
  'key-left': () => mediaKey(0x25), // VK_LEFT
  'key-right': () => mediaKey(0x27), // VK_RIGHT
  'monitor-off': () => monitorOff(), // 关闭显示器
  'clipboard-text': async (arg) => clipboardText(arg), // body.arg = 文本
  'open-url': (arg) => openUrl(arg), // body.arg = http(s) 链接
  lock: lockWorkStation,
}

export function initRemoteControl(): void {
  // 能力探测（无需配对）：告诉手机本机是 PC、支持遥控
  registerDataRoute('GET', '/remote/ping', async (_req, res) => {
    json(res, { ok: true, role: 'pc', commands: Object.keys(COMMANDS) })
  })

  // 重新配对（旧 token 作废）——需携带旧 token（或首次为空），防任何人恶意踢掉配对
  registerDataRoute('POST', '/remote/rotate', async (req, res) => {
    const token = await ensureToken()
    if (req.headers['x-remote-token'] && req.headers['x-remote-token'] !== token) {
      json(res, { ok: false, error: 'token 不匹配' }, 403)
      return
    }
    await rotateToken()
    json(res, { ok: true })
  })

  // 申请配对：生成 4 位码 + PC 弹框展示（码不进响应——只有坐在电脑前的人能看到）
  // ⚠️ 前缀更长的 /remote/pair/confirm 必须先注册（registerDataRoute 按前缀命中、先注册先匹配）
  registerDataRoute('POST', '/remote/pair/confirm', async (req, res) => {
    const body = await readBody(req)
    const code = String(body.code ?? '').trim()
    const now = Date.now()
    if (!pendingCode || pendingCode.expires < now || pendingCode.code !== code) {
      json(res, { ok: false, error: '配对码无效或已过期，请在 PC 上重新获取' }, 403)
      return
    }
    pendingCode = null // 一次性
    const token = await ensureToken()
    json(res, { ok: true, token })
  })

  registerDataRoute('POST', '/remote/pair', async (_req, res) => {
    if (process.platform !== 'win32') {
      json(res, { ok: false, error: '仅支持 Windows' }, 400)
      return
    }
    const code = String(Math.floor(1000 + Math.random() * 9000))
    pendingCode = { code, expires: Date.now() + CODE_TTL_MS }
    // 弹框展示配对码（非阻塞；用户点确定只是关掉弹框，码在有效期内仍可用）
    dialog
      .showMessageBox({
        type: 'info',
        title: '渐离App · 遥控配对',
        message: `遥控配对码：${code}`,
        detail: '请在手机端的「遥控 PC」页输入此码（10 分钟内有效）。非本人操作请直接忽略。',
        buttons: ['知道了'],
        noLink: true,
      })
      .catch(() => {})
    json(res, { ok: true, ttlMinutes: 10 })
  })

  // 命令执行（需 token 头）
  registerDataRoute('POST', '/remote/cmd', async (req, res) => {
    const token = await ensureToken()
    if (req.headers['x-remote-token'] !== token) {
      json(res, { ok: false, error: '未配对或 token 已失效' }, 403)
      return
    }
    const body = await readBody(req)
    const cmd = String(body.cmd ?? '')
    const arg = typeof body.arg === 'string' ? body.arg : ''
    const fn = COMMANDS[cmd]
    if (!fn) {
      json(res, { ok: false, error: `未知命令：${cmd}` }, 400)
      return
    }
    try {
      await fn(arg)
      json(res, { ok: true })
    } catch (e) {
      json(res, { ok: false, error: String((e as Error).message ?? e) }, 500)
    }
  })

  console.log('[remoteControl] /remote/* routes registered (pair + cmd whitelist)')
}
