/**
 * 天气模块 - Provider 调度与降级链
 * ------------------------------------------------------------------
 * 职责（单一）：
 * 1. 按用户配置的 providerOrder 解析出「本次可尝试的链路」；
 * 2. 依次调用各 provider.fetch()，命中即返回；
 * 3. 记录每条链路的成败与耗时到 `_trace`，供调试面板与来源标识展示；
 * 4. 提供单次请求的超时保护（不依赖 provider 自身实现）。
 *
 * 降级语义：
 * - 未启用 / 必填配置未填齐 的 provider 直接跳过，但仍写入 trace（标记为 skipped）；
 * - 任一 provider 抛错或超时 → 记 trace → 继续下一个；
 * - 全部失败 → 返回 null（由调用方决定是否报错给渲染端）。
 */

import { getProvider } from '../weatherProviders.ts';
import { loadWeatherConfig, toRuntimeConfig, isProviderConfigured } from './config.ts';
import { isUsableWeatherData } from './normalize.ts';
import { lookupCityCoords } from './data/cnCities.ts';
import type { CityRef, ProviderId, ProviderTrace, WeatherData, WeatherModuleConfig } from './types.ts';

/** 跳过原因文案 */
const SKIP_DISABLED = '未启用';
const SKIP_UNCONFIGURED = '未配置凭据';

/**
 * 给 Promise 套上限时保护
 * @param task 待执行的异步任务
 * @param ms 超时毫秒数（<=0 表示不限制）
 * @param label 超时错误中的标识
 */
export function withTimeout<T>(task: Promise<T>, ms: number, label: string): Promise<T> {
  if (!ms || ms <= 0) return task;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} 请求超时（${ms}ms）`)), ms);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** 链路中的一个候选节点 */
interface ChainEntry {
  /** Provider 标识 */
  id: ProviderId;
  /** 展示名 */
  label: string;
  /** 是否可尝试（启用且配置齐全） */
  usable: boolean;
  /** 不可尝试时的原因 */
  skipReason?: string;
}

/**
 * 按「首选数据源 + 优先级」解析本次请求的候选链路
 *
 * 顺序规则：
 * 1. 若配置了 preferredProvider 且该源**可用**（启用 + 凭据齐全），把它提到
 *    「可用节点序列」的最前；
 * 2. 若首选源存在但**不可用**（未启用 / 未配置凭据 / 未注册），**忽略首选**，
 *    完全按 providerOrder 顺序执行（此时首选源仍会在原位被标为 skipped）；
 * 3. 各**可用**源之间的相对顺序除首选外保持不变。
 *
 * ⚠️ 重排只在「可用节点」之间做，不可用节点的位置固定不动 —— 因为
 * fetchWithFallback 是「先一次性记录全部不可用节点（按链序）→ 再循环可用节点」，
 * 若连不可用节点一起重排，会让 trace 里 skipped 节点的展示顺序偏离用户在列表里
 * 看到的 providerOrder（实际请求顺序不受影响，但轨迹看起来会「跳序」）。
 *
 * ⚠️ 首选源只是「提高尝试优先级」，不改变降级语义：它请求失败（报错 / 超时 /
 * 数据不完整）后，fetchWithFallback 的循环会继续走后续源。
 *
 * @param cfg 完整配置（含已解密凭据）
 * @returns 候选节点数组（含被跳过的节点，便于 trace 展示全貌）
 */
export function resolveChain(cfg: WeatherModuleConfig): ChainEntry[] {
  let chain: ChainEntry[] = [];
  const seen = new Set<ProviderId>();

  for (const id of cfg.providerOrder) {
    if (seen.has(id)) continue;
    seen.add(id);

    const provider = getProvider(id);
    if (!provider) continue;

    const userCfg = cfg.providers[id];
    if (!userCfg?.enabled) {
      chain.push({ id, label: provider.label, usable: false, skipReason: SKIP_DISABLED });
      continue;
    }
    if (!isProviderConfigured(id, cfg)) {
      chain.push({ id, label: provider.label, usable: false, skipReason: SKIP_UNCONFIGURED });
      continue;
    }
    chain.push({ id, label: provider.label, usable: true });
  }

  // 首选数据源：仅在「已注册且可用」时提到「可用段」最前；否则忽略（保持原顺序）
  const preferred = cfg.preferredProvider;
  if (preferred) {
    const order = chain.filter((e) => e.usable);
    const idx = order.findIndex((e) => e.id === preferred);
    // idx === 0 表示它本就是首个可用源，重排无意义（保持原样，不扰动不可用节点位置）
    if (idx > 0) {
      const [hit] = order.splice(idx, 1);
      order.unshift(hit);
      // 把重排后的可用序列按序回填到原链的可用位置上，不可用节点原地不动
      let cursor = 0;
      chain = chain.map((e) => (e.usable ? order[cursor++] : e));
    }
  }

  return chain;
}

/** 降级执行的最终结果 */
export interface FallbackResult {
  /** 成功的天气数据（全链路失败时为 null） */
  data: WeatherData | null;
  /** 本次请求的完整轨迹（含被跳过的节点） */
  trace: ProviderTrace[];
  /** 实际命中的数据源（data 为 null 时 undefined） */
  providerId?: ProviderId;
}

/**
 * 按降级链依次请求天气
 *
 * @param city 城市名（中文）
 * @param forceRefresh 是否强制刷新（透传给 provider，仅作语义提示）
 * @param onlyId 仅使用指定 provider（不降级），用于「指定数据源」调试或预览
 * @param cityRef 城市消歧提示（渲染端选定候选后回传），有则 provider 优先按它定位
 * @returns 结果数据 + 完整轨迹
 */
export async function fetchWithFallback(
  city: string,
  forceRefresh = false,
  onlyId?: ProviderId,
  cityRef?: CityRef
): Promise<FallbackResult> {
  const cfg = await loadWeatherConfig();
  let chain = resolveChain(cfg);

  // 指定单一数据源：不降级，仅尝试该源
  if (onlyId) {
    const entry = chain.find((e) => e.id === onlyId);
    chain = entry ? [entry] : [];
  }

  const trace: ProviderTrace[] = [];
  // 先记录被跳过的节点，保持 trace 顺序与用户配置一致
  for (const entry of chain.filter((e) => !e.usable)) {
    trace.push({
      id: entry.id,
      label: entry.label,
      ok: false,
      ms: 0,
      error: entry.skipReason,
    });
  }

  // 本地坐标表统一解析一次（供需要经纬度的源复用，避免各自重复计算）
  const coords = lookupCityCoords(city, cityRef);

  for (const entry of chain.filter((e) => e.usable)) {
    const provider = getProvider(entry.id);
    if (!provider) continue;

    const started = Date.now();
    try {
      const runtime = { ...toRuntimeConfig(entry.id, cfg), forceRefresh, cityRef, __coords: coords };
      const raw = await withTimeout(
        provider.fetch(city, runtime),
        cfg.requestTimeout,
        provider.label
      );

      // 宽松校验：只要基础字段基本可用就采信
      if (!isUsableWeatherData(raw)) {
        throw new Error('返回数据不完整');
      }

      const data: WeatherData = {
        ...raw,
        source: raw.source || provider.label,
        updateTime: Date.now(),
      };
      trace.push({ id: entry.id, label: entry.label, ok: true, ms: Date.now() - started });

      // 轨迹挂到数据上，供渲染端来源标识与调试面板读取
      const used = trace.find((t) => t.ok);
      data._trace = trace;

      return { data, trace, providerId: used?.id };
    } catch (error) {
      trace.push({
        id: entry.id,
        label: entry.label,
        ok: false,
        ms: Date.now() - started,
        error: (error as Error)?.message || String(error),
      });
    }
  }

  return { data: null, trace };
}

/**
 * 仅对指定 provider 做连通性自检（配置页「测试连接」）
 * @param id Provider 标识
 * @param draft 草稿运行期配置（可用表单未保存的值）
 */
export async function probeProvider(
  id: ProviderId,
  draft: { options?: Record<string, string>; credentials?: Record<string, string>; timeout?: number }
): Promise<{ ok: boolean; message: string }> {
  const provider = getProvider(id);
  if (!provider) return { ok: false, message: `未找到数据源 ${id}` };
  if (typeof provider.probe !== 'function') {
    return { ok: true, message: `${provider.label} 无需自检` };
  }
  try {
    return await withTimeout(
      provider.probe({
        options: { ...(draft.options || {}) },
        credentials: { ...(draft.credentials || {}) },
        timeout: draft.timeout || 15000,
        forceRefresh: true,
      }),
      (draft.timeout || 15000) + 5000,
      `${provider.label} 自检`
    );
  } catch (error) {
    return { ok: false, message: (error as Error)?.message || String(error) };
  }
}
