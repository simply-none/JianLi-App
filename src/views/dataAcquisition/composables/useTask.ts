/**
 * 数据获取模块 - 任务运行 composable
 * ------------------------------------------------------------------
 * 职责：
 * 1. 任务 CRUD（scraper_tasks 表）
 * 2. 任务启动（run 正式 / test 试运行）与取消
 * 3. 全局单例订阅主进程 scraper:task-progress / scraper:task-result 推送，
 *    多组件共用同一份运行状态（runningMap / 日志）
 */
import { ref, computed } from 'vue'
import { deepClone } from '@/utils/deepClone'
import type { ScrapeConfig, ScrapeProgress, ScrapeTaskResult } from '../types'
import { saveTask, listTasks, deleteTask } from '../db'
import type { TaskItem } from '../types'

/** 运行中任务的实时状态 */
export interface RunningState {
  /** 任务 id */
  taskId: string;
  /** 任务名 */
  taskName: string;
  /** 运行模式：run / test */
  mode: 'run' | 'test';
  /** 当前状态 */
  status: 'running' | 'done' | 'error' | 'stopped';
  /** 当前页码 */
  page: number;
  /** 已采集记录数 */
  recordCount: number;
  /** 阶段描述 */
  phase: string;
  /** 日志行（倒序，最新在前） */
  logs: string[];
  /** 开始时间戳 */
  startedAt: number;
}

/* ------------------------------------------------------------------ */
/* 全局单例推送订阅（模块级，多组件共享）                                  */
/* ------------------------------------------------------------------ */

/** 订阅标记（防重复注册） */
let subscribed = false
/** 进度处理器集合 */
const progressHandlers = new Set<(p: ScrapeProgress) => void>()
/** 结果处理器集合 */
const resultHandlers = new Set<(r: ScrapeTaskResult) => void>()

/**
 * 确保主进程推送已订阅（首次调用时注册，之后幂等返回）
 */
function ensureSubscribed(): void {
  if (subscribed) return
  subscribed = true
  window.ipcRenderer.on('scraper:task-progress', (_event: any, progress: ScrapeProgress) => {
    progressHandlers.forEach((fn) => fn(progress))
  })
  window.ipcRenderer.on('scraper:task-result', (_event: any, result: ScrapeTaskResult) => {
    resultHandlers.forEach((fn) => fn(result))
  })
}

/* ------------------------------------------------------------------ */
/* 任务运行 composable                                                  */
/* ------------------------------------------------------------------ */

/**
 * 任务运行状态与操作
 * @returns 任务列表、运行状态、CRUD/运行/取消方法
 */
export function useTask() {
  ensureSubscribed()

  /** 任务列表 */
  const tasks = ref<TaskItem[]>([])
  /** 运行中任务表（taskId → 状态） */
  const runningMap = ref<Record<string, RunningState>>({})
  /** 是否存在运行中的任务 */
  const hasRunning = computed(() => Object.values(runningMap.value).some((r) => r.status === 'running'))

  /**
   * 刷新任务列表（按更新时间倒序）
   * @throws 写库失败时由调用方捕获提示
   */
  async function refreshTasks(): Promise<void> {
    tasks.value = await listTasks()
  }

  /**
   * 保存任务（按 name 幂等）并刷新列表
   * @param config 完整任务配置
   * @returns 任务 id
   * @throws 写库失败时抛出（调用方 ElMessage 提示）
   */
  async function persistTask(config: ScrapeConfig): Promise<number> {
    const id = await saveTask(config)
    await refreshTasks()
    return id
  }

  /**
   * 删除任务并刷新列表
   * @param id 任务 id
   * @throws 写库失败时抛出
   */
  async function removeTask(id: number): Promise<void> {
    await deleteTask(id)
    await refreshTasks()
  }

  /**
   * 启动采集任务（进度经 onProgress 回调实时更新 runningMap）
   * @param config 任务配置
   * @param mode run 正式 / test 试运行
   * @returns Promise<ScrapeTaskResult>（任务完成/失败时 resolve）
   */
  function runTask(config: ScrapeConfig, mode: 'run' | 'test'): Promise<ScrapeTaskResult> {
    const taskId = `t${Date.now()}${Math.floor(Math.random() * 1000)}`
    const state: RunningState = {
      taskId,
      taskName: config.name || '未命名任务',
      mode,
      status: 'running',
      page: 0,
      recordCount: 0,
      phase: '提交中',
      logs: [],
      startedAt: Date.now(),
    }
    runningMap.value = { ...runningMap.value, [taskId]: state }

    return new Promise<ScrapeTaskResult>((resolve) => {
      const onProgress = (p: ScrapeProgress) => {
        if (p.taskId !== taskId) return
        const cur = runningMap.value[taskId]
        if (!cur) return
        cur.status = p.status
        cur.page = p.page
        cur.recordCount = p.recordCount
        cur.phase = p.phase || cur.phase
        if (p.log) {
          cur.logs.unshift(`[${p.phase || p.status}] ${p.log}`)
          if (cur.logs.length > 100) cur.logs.length = 100
        }
      }
      const onResult = (r: ScrapeTaskResult) => {
        if (r.taskId !== taskId) return
        progressHandlers.delete(onProgress)
        resultHandlers.delete(onResult)
        const cur = runningMap.value[taskId]
        if (cur) {
          // 成败均保留终态与全部过程日志，供结果区回看排查
          cur.status = r.success ? 'done' : r.reason === '任务已手动停止' ? 'stopped' : 'error'
          cur.recordCount = r.records?.length ?? cur.recordCount
          cur.page = Math.max(cur.page, r.pages || 0)
          cur.phase = r.success
            ? `采集完成：${r.records.length} 条 / ${r.pages} 页，耗时 ${(r.elapsed / 1000).toFixed(1)} 秒`
            : r.reason || '失败'
          cur.logs.unshift(
            r.success
              ? `[完成] 采集成功：${r.records.length} 条 / ${r.pages} 页，耗时 ${(r.elapsed / 1000).toFixed(1)} 秒`
              : `[失败] ${r.reason || '未知原因'}`
          )
          if (cur.logs.length > 100) cur.logs.length = 100
        }
        // 仅清理过多历史终态（保留最近 20 条），当前终态不删除
        const entries = Object.values(runningMap.value)
          .filter((s) => s.status !== 'running')
          .sort((a, b) => a.startedAt - b.startedAt)
        if (entries.length > 20) {
          const toRemove = entries.slice(0, entries.length - 20)
          const map = { ...runningMap.value }
          toRemove.forEach((s) => delete map[s.taskId])
          runningMap.value = map
        }
        resolve(r)
      }
      progressHandlers.add(onProgress)
      resultHandlers.add(onResult)
      // 配置可能是 Vue reactive Proxy，直接传 IPC 会因结构化克隆失败
      // （An object could not be cloned），先深拷贝为纯数据再提交
      const plainConfig = deepClone(config)
      window.ipcRenderer.scraper
        .runTask({ taskId, config: plainConfig, mode })
        .then((res) => {
          if (!res?.success) {
            // 提交失败：立即回填错误结果
            onResult({
              taskId,
              success: false,
              reason: res?.error || '任务提交失败',
              url: '',
              title: '',
              records: [],
              pages: 0,
              elapsed: 0,
              networkCount: 0,
            })
          }
        })
        .catch((err) => {
          onResult({
            taskId,
            success: false,
            reason: (err as Error)?.message || '任务提交异常',
            url: '',
            title: '',
            records: [],
            pages: 0,
            elapsed: 0,
            networkCount: 0,
          })
        })
    })
  }

  /**
   * 请求取消任务
   * @param taskId 任务 id
   */
  async function stopTask(taskId: string): Promise<void> {
    await window.ipcRenderer.scraper.stopTask(taskId)
  }

  return {
    tasks,
    runningMap,
    hasRunning,
    refreshTasks,
    persistTask,
    removeTask,
    runTask,
    stopTask,
  }
}
