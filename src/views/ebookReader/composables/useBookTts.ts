/**
 * useBookTts —— 电子书 TTS 朗读调度层（模块级单例）
 *
 * 职责：作为「播放器」统一驱动朗读，与具体格式（EPUB / TXT）解耦。
 *   - 状态机：idle / playing / paused
 *   - 句子队列循环：逐句调用 TTSManager.speak，并透传边界回调（onBoundary）给适配器做跟读高亮
 *   - 复用已持久化的 TTS 设置（basic_info 的 tts_provider / tts_voice / tts_rate），电子书不另设配置
 *   - 断点续读：每句落库到 localStorage（按 bookKey），下次进入同一本书按播放可在停顿处继续
 *
 * 适配器（useEpubTts / useTxtTts）只负责「取文本 + 高亮 + 翻页跟随 + 断点定位」，
 * 朗读引擎与循环由本层统一掌控，从而保证 EPUB / TXT 两套体验一致。
 *
 * 重要约束（与项目红线一致）：仅在渲染进程侧工作，不触碰主进程、不新增依赖。
 */
import { ref, computed, type Ref } from 'vue';
import { getTTSManager } from '@/utils/tts';
import type { TTSManager } from '@/utils/tts';
import type { TTSBoundaryEvent, TTSHandlers, TTSOptions, TTSProviderType } from '@/utils/tts/types';
import { getStoreAsync, setStoreAsync } from '@/utils/common';

/** 朗读状态机 */
export type TtsStatus = 'idle' | 'playing' | 'paused';

/** 单句朗读单元：text 必填，其余字段由适配器私有承载（cfi / 偏移等） */
export interface TtsSentence {
  /** 该句纯文本（用于朗读与展示） */
  text: string;
  /** 适配器私有字段容器（如 cfiRange、globalStart 等） */
  [key: string]: any;
}

/**
 * 格式适配器接口：把「取文本 / 高亮 / 翻页跟随 / 断点」的具体实现下放到 EPUB / TXT。
 */
export interface TtsAdapter {
  /** 稳定书籍标识（contentHash 优先，回退 filePath），用于断点续读 key */
  readonly bookKey: string;
  /** 格式标识，仅 'epub' | 'txt'（用于判断断点是否同源） */
  readonly format: 'epub' | 'txt';
  /** 构建从「当前阅读位置」开始的朗读队列；epub 为当前章节，txt 为整本 */
  buildQueue(): Promise<TtsSentence[]> | TtsSentence[];
  /** 某句开始朗读：句子级高亮（所有引擎均生效） */
  onSentenceStart(index: number, sentence: TtsSentence): void;
  /** 边界回调：逐字/逐句高亮（仅 Web 等支持边界的引擎触发；默认无操作） */
  onBoundary?(index: number, sentence: TtsSentence, e: TTSBoundaryEvent): void;
  /** 清除全部 TTS 高亮（停止 / 卸载时） */
  clearHighlight(): void;
  /** 朗读某句前确保其在视口内（翻页 / 滚动跟随），可异步（epub 需等待 displayed） */
  ensureVisible?(index: number, sentence: TtsSentence): Promise<void> | void;
  /** 是否还有后续队列（epub 的下一章节）；txt 恒为 false */
  hasNextQueue?(): boolean;
  /** 推进到下一队列并返回新句子数组（epub 翻到下一章并提取） */
  nextQueue?(): Promise<TtsSentence[]> | TtsSentence[];
  /** 断点恢复：返回起始句子下标（适配器据 bp 重建队列并定位）；非异步时直接返回 number */
  restoreFromBreakpoint?(bp: string): Promise<number> | number;
  /** 清理（移除监听等） */
  dispose?(): void;
}

/** localStorage 断点结构 */
interface TtsBreakpoint {
  bookKey: string;
  format: 'epub' | 'txt';
  /** 定位串：epub=起始 CFI，txt=起始全局字符偏移 */
  bp: string;
  /** 句子在当章队列中的下标（用于续读定位） */
  index: number;
  updatedAt: number;
}

function bpKey(): string {
  return 'tts-bp';
}

function loadBreakpoint(): TtsBreakpoint | null {
  try {
    const raw = localStorage.getItem(bpKey());
    if (!raw) return null;
    const obj = JSON.parse(raw) as TtsBreakpoint;
    if (!obj || !obj.bookKey || !obj.format) return null;
    return obj;
  } catch {
    return null;
  }
}

function saveBreakpoint(obj: TtsBreakpoint): void {
  try {
    localStorage.setItem(bpKey(), JSON.stringify(obj));
  } catch {
    /* localStorage 不可用时忽略，断点续读降级为不可用 */
  }
}

function clearBreakpoint(): void {
  try {
    localStorage.removeItem(bpKey());
  } catch {
    /* ignore */
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 单例实现。模块级只创建一次，EpubReader / TxtReader 共用同一实例（同一时刻仅一个挂载）。
 */
function createBookTts() {
  // ===== 响应式状态 =====
  const status: Ref<TtsStatus> = ref('idle');
  const rate: Ref<number> = ref(1);
  /** 当前章节（当前队列）内进度（0-1），用于进度条 */
  const sectionProgress: Ref<number> = ref(0);
  /** 跨章节累计已朗读句数（用于「第 N 句」标签） */
  const globalIndex: Ref<number> = ref(0);
  /** 当前正在朗读的句子文本（用于播放条展示片段） */
  const currentSentenceText: Ref<string> = ref('');
  /** 错误信息（朗读失败等） */
  const error: Ref<string> = ref('');
  /** 当前引擎是否支持逐字边界（Web 为 true），用于 UI 提示与调试 */
  const supportsBoundary: Ref<boolean> = ref(false);
  /** 当前引擎类型 */
  const providerType: Ref<TTSProviderType | ''> = ref('');
  /** 是否正在准备（加载章节文本 / 翻页中） */
  const isLoading: Ref<boolean> = ref(false);

  // ===== 内部可变量 =====
  let manager: TTSManager | null = null;
  let adapter: TtsAdapter | null = null;
  let currentQueue: TtsSentence[] = [];
  let currentQueueIndex = 0;
  let runToken = 0;
  let resumeCharOffset = 0; // 暂停后从句中某字符续读（Web 切片朗读）
  let lastBoundaryIndex = 0; // 最近一次边界字符索引（用于暂停续读点）
  let currentVoice: string | undefined = undefined;
  let configLoaded = false;
  let lang = 'zh-CN';

  const isPlaying = computed(() => status.value === 'playing');
  const isPaused = computed(() => status.value === 'paused');
  const isIdle = computed(() => status.value === 'idle');
  const hasAdapter = computed(() => adapter !== null);

  function ensureManager(): TTSManager {
    if (!manager) {
      manager = getTTSManager({ defaultProvider: 'web', autoFallback: true });
    }
    return manager;
  }

  async function ensureConfig(): Promise<void> {
    if (configLoaded) return;
    configLoaded = true;
    const m = ensureManager();
    try {
      const savedProvider = (await getStoreAsync('tts_provider')) as TTSProviderType | null;
      const savedVoice = (await getStoreAsync('tts_voice')) as string | null;
      const savedRate = await getStoreAsync('tts_rate');
      if (savedProvider) {
        m.setProvider(savedProvider);
      }
      if (savedVoice) {
        currentVoice = savedVoice;
      }
      if (savedRate != null && !isNaN(Number(savedRate))) {
        rate.value = Number(savedRate);
      }
      providerType.value = m.getProviderType();
      supportsBoundary.value = m.getProviderType() === 'web';
    } catch (err) {
      console.warn('读取 TTS 设置失败，使用默认值', err);
    }
  }

  function buildOptions(): TTSOptions {
    return {
      rate: rate.value,
      lang,
      voice: currentVoice,
    };
  }

  function makeHandlers(sentence: TtsSentence, index: number, offset: number): TTSHandlers {
    return {
      onStart: () => {
        currentSentenceText.value = sentence.text;
      },
      onBoundary: (e: TTSBoundaryEvent) => {
        if (status.value !== 'playing') return;
        const adjIndex = (e.charIndex || 0) + offset;
        lastBoundaryIndex = adjIndex;
        adapter?.onBoundary?.(index, sentence, { ...e, charIndex: adjIndex });
      },
      onEnd: () => {
        /* 管理器内部已处理结算，这里无需动作 */
      },
    };
  }

  async function runLoop(initialQueue: TtsSentence[], startIndex: number): Promise<void> {
    const myToken = ++runToken;
    const m = ensureManager();
    status.value = 'playing';
    isLoading.value = false;
    error.value = '';

    let queue = initialQueue;
    let i = startIndex;
    while (i < queue.length) {
      if (myToken !== runToken) return; // 被 stop / 新的 runLoop 取代
      if (status.value === 'paused') break;

      const sentence = queue[i];
      try {
        const ev = adapter?.ensureVisible?.(i, sentence);
        if (ev && typeof (ev as Promise<void>).then === 'function') {
          isLoading.value = true;
          await ev;
          isLoading.value = false;
        }
      } catch (err) {
        console.warn('TTS 翻页/定位失败', err);
      }
      if (myToken !== runToken) return;

      adapter?.onSentenceStart(i, sentence);
      currentQueue = queue;
      currentQueueIndex = i;
      currentSentenceText.value = sentence.text;
      globalIndex.value += 1;
      sectionProgress.value = queue.length > 0 ? (i + 1) / queue.length : 0;

      const offset = resumeCharOffset;
      resumeCharOffset = 0;
      const spokenText = offset > 0 && offset < sentence.text.length ? sentence.text.slice(offset) : sentence.text;

      try {
        await m.speak(spokenText, buildOptions(), makeHandlers(sentence, i, offset));
      } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
        console.error('TTS 朗读失败', err);
        finishAll();
        return;
      }
      if (myToken !== runToken) return;

      // 落库断点（句级），便于跨会话续读
      try {
        saveBreakpoint({
          bookKey: adapter?.bookKey ?? '',
          format: adapter?.format ?? 'txt',
          bp: adapter ? adapterOnBreakpoint(i, sentence) : '',
          index: i,
          updatedAt: Date.now(),
        });
      } catch {
        /* ignore */
      }

      i += 1;
      // 当前队列耗尽且存在后续队列（epub 下一章）则续接
      if (i >= queue.length && adapter?.hasNextQueue?.()) {
        try {
          const next = await adapter.nextQueue!();
          queue = next;
          i = 0;
        } catch (err) {
          console.warn('TTS 加载下一章节失败', err);
          finishAll();
          return;
        }
      }
      // 句间极短间隔：规避 Chromium 连续 utterance 偶发丢字
      await sleep(15);
    }

    if (i >= queue.length) {
      finishAll();
    }
  }

  /** 取断点定位串（委托适配器），失败返回空串 */
  function adapterOnBreakpoint(index: number, sentence: TtsSentence): string {
    // 适配器可在 sentence 上附带 bp 字段；否则由适配器提供 getBreakpoint（这里用 sentence.bp 即可）
    return typeof sentence.bp === 'string' ? sentence.bp : '';
  }

  function finishAll(): void {
    runToken++; // 终止任何残留循环
    status.value = 'idle';
    isLoading.value = false;
    sectionProgress.value = 1;
    clearBreakpoint();
    adapter?.clearHighlight();
  }

  // ===== 对外动作 =====

  async function play(): Promise<void> {
    if (!adapter) return;
    if (status.value === 'paused') {
      resume();
      return;
    }
    if (status.value === 'playing') return;

    await ensureConfig();
    providerType.value = ensureManager().getProviderType();
    supportsBoundary.value = providerType.value === 'web';

    const m = ensureManager();
    const bp = loadBreakpoint();
    let startIndex = 0;
    if (bp && bp.bookKey === adapter.bookKey && bp.format === adapter.format) {
      try {
        const restored = await adapter.restoreFromBreakpoint?.(bp.bp);
        if (typeof restored === 'number') startIndex = restored;
      } catch (err) {
        console.warn('TTS 断点恢复失败，从当前位置开始', err);
        startIndex = 0;
      }
      // 消费断点后清除，避免二次误用（重新播放时再逐句续写）
      clearBreakpoint();
    }

    const queue = await adapter.buildQueue();
    if (!queue || queue.length === 0) {
      error.value = '没有可朗读的内容';
      return;
    }
    globalIndex.value = 0;
    await runLoop(queue, startIndex);
  }

  function resume(): void {
    if (status.value !== 'paused' || !adapter) return;
    const queue = currentQueue;
    if (!queue || queue.length === 0) {
      play();
      return;
    }
    void runLoop(queue, currentQueueIndex);
  }

  function pause(): void {
    if (status.value !== 'playing') return;
    status.value = 'paused';
    resumeCharOffset = lastBoundaryIndex; // 从句中上次边界处续读
    ensureManager().stop();
    // 保留句子级高亮，仅清空逐字高亮（下一句开始时会重建）
  }

  function stop(): void {
    runToken++; // 取消任何运行中的循环
    ensureManager()?.stop();
    status.value = 'idle';
    isLoading.value = false;
    resumeCharOffset = 0;
    lastBoundaryIndex = 0;
    currentQueue = [];
    currentQueueIndex = 0;
    globalIndex.value = 0;
    sectionProgress.value = 0;
    clearBreakpoint();
    adapter?.clearHighlight();
  }

  function toggle(): void {
    if (status.value === 'playing') pause();
    else play();
  }

  async function next(): Promise<void> {
    if (!adapter) return;
    ensureManager().stop();
    runToken++; // 取消当前循环
    if (status.value === 'idle') {
      // 未在播放：从下一句开始播放
      await play();
      return;
    }
    let queue = currentQueue;
    let i = currentQueueIndex + 1;
    if (!queue || i >= queue.length) {
      if (adapter.hasNextQueue?.()) {
        try {
          queue = await adapter.nextQueue!();
          i = 0;
        } catch {
          stop();
          return;
        }
        currentQueue = queue;
      } else {
        stop();
        return;
      }
    }
    resumeCharOffset = 0;
    await runLoop(queue, i);
  }

  function prev(): void {
    if (!adapter) return;
    ensureManager().stop();
    runToken++;
    if (status.value === 'idle') {
      void play();
      return;
    }
    let i = currentQueueIndex - 1;
    if (i < 0) i = 0; // 章内首句：重播当前句（跨章回退超出 v1 范围）
    resumeCharOffset = 0;
    void runLoop(currentQueue, i);
  }

  function setRate(r: number): void {
    const clamped = Math.max(0.5, Math.min(2, r));
    rate.value = clamped;
    void setStoreAsync('tts_rate', String(clamped));
  }

  function registerAdapter(a: TtsAdapter): void {
    if (adapter && adapter !== a) {
      // 切书：停止旧朗读并清高亮
      stop();
    }
    adapter = a;
  }

  function unregisterAdapter(a: TtsAdapter): void {
    if (adapter === a) {
      stop();
      adapter = null;
    }
  }

  return {
    // 状态
    status,
    rate,
    sectionProgress,
    globalIndex,
    currentSentenceText,
    error,
    supportsBoundary,
    providerType,
    isLoading,
    // 计算
    isPlaying,
    isPaused,
    isIdle,
    hasAdapter,
    // 动作
    play,
    pause,
    resume,
    stop,
    toggle,
    next,
    prev,
    setRate,
    registerAdapter,
    unregisterAdapter,
  };
}

// 模块级单例
let singleton: ReturnType<typeof createBookTts> | null = null;

export function useBookTts() {
  if (!singleton) {
    singleton = createBookTts();
  }
  return singleton;
}

export type BookTts = ReturnType<typeof createBookTts>;
