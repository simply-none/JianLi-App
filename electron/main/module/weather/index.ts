/**
 * 天气模块 - 主进程入口（IPC 注册 + 内存缓存）
 * ------------------------------------------------------------------
 * 通道契约：
 * 【保持兼容，渲染端旧代码零改动】
 * - get-weather（invoke，{city, forceRefresh?}）→ WeatherData | null | { error }
 * - get-weather-broadcast（on，cityName）→ 广播 get-weather-broadcast-reply
 *
 * 【本期新增】
 * - weather:get-config（invoke）→ WeatherConfigForUi（脱敏，绝不含明文凭据）
 * - weather:save-config（invoke，WeatherConfigForUi 的可写子集）→ { ok, message }
 * - weather:probe-provider（invoke，{ id, options, credentials, timeout }）→ { ok, message }
 * - weather:available-providers（invoke）→ ProviderSummary[]
 *
 * 缓存策略：
 * - 内存缓存 key = `${providerId}:${city}`，命中任一 provider 均复用；
 * - 另存一份「城市 → 最近一次成功结果」，让同一城市切换数据源时优先回显；
 * - 时长取配置项 cacheDuration（默认 2h），forceRefresh 跳过。
 */

import { ipcMain } from 'electron';
import colors from 'colors';
import { win } from '../mainWindow.ts';
import { fetchWithFallback, probeProvider } from './registry.ts';
import {
  getConfigForUi,
  getProviderSummaries,
  loadWeatherConfig,
  saveWeatherConfig,
  DEFAULT_WEATHER_CONFIG,
} from './config.ts';
import type { ProviderId, WeatherData, WeatherModuleConfig } from './types.ts';

/** 天气缓存容器：键为 `${providerId}:${城市名小写}` */
const WEATHER_CACHE: Record<string, { data: WeatherData; timestamp: number }> = {};

/** 最近一次成功的城市缓存：键为城市名小写（用于跨数据源回显） */
const CITY_LAST: Record<string, { data: WeatherData; timestamp: number }> = {};

/**
 * 取天气（带内存缓存 + 降级）
 * @param cityName 城市名
 * @param forceRefresh 是否强制刷新
 * @param onlyId 指定单一数据源（不降级）
 * @returns 成功返回天气数据，失败返回 null
 */
async function getWeather(
  cityName: string,
  forceRefresh = false,
  onlyId?: ProviderId
): Promise<WeatherData | null> {
  const cityKey = String(cityName || '').toLowerCase();
  if (!cityKey) return null;

  const cfg = await loadWeatherConfig();
  const ttl = cfg.cacheDuration || DEFAULT_WEATHER_CONFIG.cacheDuration;

  // 指定数据源时按其自身缓存；否则查该城市的任意命中缓存
  if (!forceRefresh) {
    if (onlyId) {
      const hit = WEATHER_CACHE[`${onlyId}:${cityKey}`];
      if (hit && Date.now() - hit.timestamp < ttl) {
        console.log(colors.gray(`[weather] 命中缓存(${onlyId}): ${cityName}`));
        return hit.data;
      }
      // 同城市曾由其它源成功过，且未禁用该源时，直接复用（省一次网络）
      const last = CITY_LAST[cityKey];
      if (last && Date.now() - last.timestamp < ttl && last.data._trace?.some((t) => t.id === onlyId && t.ok)) {
        return last.data;
      }
    } else {
      const last = CITY_LAST[cityKey];
      if (last && Date.now() - last.timestamp < ttl) {
        console.log(colors.gray(`[weather] 命中缓存: ${cityName}`));
        return last.data;
      }
    }
  }

  const { data, trace, providerId } = await fetchWithFallback(cityName, forceRefresh, onlyId);

  if (!data) {
    const detail = trace.map((t) => `${t.label}(${t.error || '失败'})`).join(' → ');
    console.error(colors.red(`[weather] 全部数据源失败: ${cityName} | ${detail}`));
    return null;
  }

  WEATHER_CACHE[`${providerId}:${cityKey}`] = { data, timestamp: Date.now() };
  CITY_LAST[cityKey] = { data, timestamp: Date.now() };
  console.log(colors.bgGreen(`[weather] 获取成功: ${cityName} ← ${data.source}`));
  return data;
}

/**
 * 注册天气模块 IPC 通道
 */
export function initWeather() {
  /* ---------- 兼容通道 ---------- */

  ipcMain.handle(
    'get-weather',
    async (_event, params: { city: string; forceRefresh?: boolean; providerId?: ProviderId } | string) => {
      try {
        const cityName = typeof params === 'string' ? params : params?.city;
        const forceRefresh = typeof params === 'object' ? !!params?.forceRefresh : false;
        const onlyId = typeof params === 'object' ? params?.providerId : undefined;
        if (!cityName) return { error: '缺少城市名' };
        return await getWeather(cityName, forceRefresh, onlyId);
      } catch (error) {
        console.error('[weather] get-weather 失败:', error);
        return { error: (error as Error).message };
      }
    }
  );

  ipcMain.on('get-weather-broadcast', async (_event, cityName: string) => {
    try {
      const result = await getWeather(cityName);
      if (win && !win.isDestroyed()) {
        win.webContents.send('get-weather-broadcast-reply', result);
      }
    } catch (error) {
      console.error('[weather] 广播失败:', error);
    }
  });

  /* ---------- 配置管理通道 ---------- */

  /** 读取脱敏配置（含可用数据源快照） */
  ipcMain.handle('weather:get-config', async () => {
    try {
      return await getConfigForUi();
    } catch (error) {
      console.error('[weather] get-config 失败:', error);
      return { error: (error as Error).message };
    }
  });

  /**
   * 保存配置
   * 入参为脱敏结构 + 新增的明文凭据（credentials 仅含本次用户新填的字段，
   * 未填的字段沿用库中已有值，避免脱敏回显被迫「重填」）。
   */
  ipcMain.handle(
    'weather:save-config',
    async (
      _event,
      payload: {
        providerOrder?: ProviderId[];
        providers?: Record<string, { enabled?: boolean; options?: Record<string, string>; credentials?: Record<string, string> }>;
        requestTimeout?: number;
        cacheDuration?: number;
      }
    ) => {
      try {
        const current = await loadWeatherConfig();
        const next: WeatherModuleConfig = {
          providerOrder: payload?.providerOrder?.length ? payload.providerOrder : current.providerOrder,
          providers: { ...current.providers },
          requestTimeout: Number(payload?.requestTimeout) || current.requestTimeout,
          cacheDuration: Number(payload?.cacheDuration) || current.cacheDuration,
        };

        for (const [id, patch] of Object.entries(payload?.providers || {}) as [ProviderId, any][]) {
          const prev = next.providers[id] || { enabled: false, options: {}, credentials: {} };
          const options = { ...(prev.options || {}), ...(patch?.options || {}) };
          const credentials = { ...(prev.credentials || {}) };

          for (const [k, v] of Object.entries(patch?.credentials || {})) {
            // 空串表示「保持原值」（脱敏回显），显式 null 表示清空
            if (v === '') continue;
            if (v === null) delete credentials[k];
            else credentials[k] = String(v);
          }
          next.providers[id] = {
            enabled: patch?.enabled ?? prev.enabled,
            options,
            credentials,
          };
        }

        await saveWeatherConfig(next);
        // 配置变更后清缓存，保证下一次请求立刻按新链路执行
        for (const key of Object.keys(WEATHER_CACHE)) delete WEATHER_CACHE[key];
        for (const key of Object.keys(CITY_LAST)) delete CITY_LAST[key];

        return { ok: true, message: '已保存' };
      } catch (error) {
        console.error('[weather] save-config 失败:', error);
        return { ok: false, message: (error as Error).message };
      }
    }
  );

  /** 测试单个数据源连通性（可用未保存的草稿凭据） */
  ipcMain.handle(
    'weather:probe-provider',
    async (
      _event,
      payload: { id: ProviderId; options?: Record<string, string>; credentials?: Record<string, string>; timeout?: number }
    ) => {
      try {
        return await probeProvider(payload.id, {
          options: payload?.options,
          credentials: payload?.credentials,
          timeout: payload?.timeout,
        });
      } catch (error) {
        return { ok: false, message: (error as Error).message };
      }
    }
  );

  /** 可用数据源快照 */
  ipcMain.handle('weather:available-providers', async () => {
    try {
      return await getProviderSummaries();
    } catch (error) {
      console.error('[weather] available-providers 失败:', error);
      return [];
    }
  });
}

/** 供其他主进程模块（如托盘、通知）主动清缓存用 */
export function clearWeatherCache(): void {
  for (const key of Object.keys(WEATHER_CACHE)) delete WEATHER_CACHE[key];
  for (const key of Object.keys(CITY_LAST)) delete CITY_LAST[key];
}
