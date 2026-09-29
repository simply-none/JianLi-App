/**
 * 天气模块 - 配置读写与凭据加密
 * ------------------------------------------------------------------
 * 存储位置：SQLite 基础表 basic_info，key = `weatherConfig`
 *
 * 凭据安全：
 * - 敏感字段（configSchema 中 secret: true）不落明文，统一打包为
 *   VaultEnvelope（AES-256-GCM + PBKDF2，密钥来自 vault/deviceKey.ts）
 *   存于配置对象的 __secret 字段；
 * - 与 stock.ts 的 stockVault 完全同一套加密路径与存储位置；
 * - 对外暴露的 getConfigForUi() 只回传 { configured, preview }，绝不回传明文。
 *
 * 注：vault/crypto.ts 注释中的「密文绝不进入 SQLite」是针对 twoFactor /
 * passwordVault 的文件保险库；stock 已确立 basic_info 这条合法路径，此处沿用。
 */

import { queryByConditions, upsertData } from '../../utils/sql.ts';
import { myDb } from '../newSql.ts';
import { tableName as basicInfoTable } from '../store.ts';
import { encryptVault, decryptVault, type VaultEnvelope } from '../vault/crypto.ts';
import { getDeviceMasterKey } from '../vault/deviceKey.ts';
import { maskSecret } from './normalize.ts';
import { PROVIDER_CAPABILITIES } from './capability.ts';
import { getAllProviders } from '../weatherProviders.ts';
import type {
  ProviderConfigField,
  ProviderId,
  ProviderRuntimeConfig,
  ProviderSummary,
  SecretStatus,
  WeatherConfigForUi,
  WeatherModuleConfig,
} from './types.ts';

/** 配置在 basic_info 中的存储键 */
const CONFIG_DB_KEY = 'weatherConfig';

/** 默认配置：和风 → Open-Meteo → 爬虫兜底 */
export const DEFAULT_WEATHER_CONFIG: WeatherModuleConfig = {
  providerOrder: ['qweather', 'openMeteo', 'crawler'],
  providers: {
    qweather: { enabled: true, options: {}, credentials: {} },
    openMeteo: { enabled: true, options: {}, credentials: {} },
    crawler: { enabled: true, options: {}, credentials: {} },
  },
  requestTimeout: 15000,
  cacheDuration: 2 * 60 * 60 * 1000,
};

/* ===================== 基础表读写 ===================== */

/** 查询基础表某 key 的 value（已 JSON.parse），不存在返回 null */
function queryBasicInfoValue(key: string): Promise<any | null> {
  return new Promise((resolve) => {
    queryByConditions({
      db: myDb.db,
      tableName: basicInfoTable,
      conditions: { key },
      callback: (err, rows) => {
        if (err || !rows || rows.length === 0) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(rows[0].value));
        } catch {
          resolve(rows[0].value);
        }
      },
    });
  });
}

/** 写入基础表（value 以 JSON 字符串存储，与项目现有约定一致） */
function upsertBasicInfo(key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    upsertData({
      db: myDb.db,
      tableName: basicInfoTable,
      data: { key, value: JSON.stringify(value) },
      config: { primaryKey: 'key' },
      callback: (err) => (err ? reject(err) : resolve()),
    });
  });
}

/* ===================== 敏感字段拆分 ===================== */

/**
 * 按 Provider 的 configSchema 定义判断某字段是否敏感
 * @param id Provider 标识
 * @param key 字段键
 */
function isSecretField(id: ProviderId, key: string): boolean {
  const provider = getAllProviders().find((p) => p.id === id);
  return !!provider?.configSchema.find((f) => f.key === key)?.secret;
}

/**
 * 把配置拆成「非敏感部分」与「敏感明文映射」
 * @param cfg 完整配置（含明文凭据）
 * @returns plain = 可平铺落库的部分；secret = { `id.key`: 明文 }
 */
export function splitSecrets(cfg: WeatherModuleConfig): {
  plain: Omit<WeatherModuleConfig, 'providers'> & {
    providers: Partial<Record<ProviderId, { enabled: boolean; options?: Record<string, string> }>>;
  };
  secret: Record<string, string>;
} {
  const plain: any = {
    providerOrder: cfg.providerOrder,
    providers: {},
    requestTimeout: cfg.requestTimeout,
    cacheDuration: cfg.cacheDuration,
  };
  const secret: Record<string, string> = {};

  for (const [id, userCfg] of Object.entries(cfg.providers) as [ProviderId, any][]) {
    if (!userCfg) continue;
    // 非敏感项落到 options，敏感项抽到 secret
    const options: Record<string, string> = { ...(userCfg.options || {}) };
    plain.providers[id] = { enabled: !!userCfg.enabled, options };

    for (const [k, v] of Object.entries(userCfg.credentials || {})) {
      if (isSecretField(id, k)) {
        if (v) secret[`${id}.${k}`] = String(v);
      } else {
        // schema 未标 secret 的凭据字段按普通选项落库
        options[k] = String(v);
      }
    }
  }
  return { plain, secret };
}

/**
 * 把「非敏感部分 + 解密后的敏感映射」合并回完整配置
 * @param plain 落库的非敏感部分
 * @param secret 解密后的 { `id.key`: 明文 }
 */
export function mergeSecrets(plain: any, secret: Record<string, string>): WeatherModuleConfig {
  const cfg: WeatherModuleConfig = {
    providerOrder: Array.isArray(plain?.providerOrder) && plain.providerOrder.length
      ? plain.providerOrder
      : [...DEFAULT_WEATHER_CONFIG.providerOrder],
    providers: {},
    requestTimeout: Number(plain?.requestTimeout) || DEFAULT_WEATHER_CONFIG.requestTimeout,
    cacheDuration: Number(plain?.cacheDuration) || DEFAULT_WEATHER_CONFIG.cacheDuration,
  };

  // 先铺默认（保证新接入的 provider 有默认开关状态）
  for (const [id, def] of Object.entries(DEFAULT_WEATHER_CONFIG.providers)) {
    cfg.providers[id as ProviderId] = { enabled: !!def?.enabled, options: {}, credentials: {} };
  }
  // 再覆盖用户配置
  for (const [id, userCfg] of Object.entries(plain?.providers || {}) as [ProviderId, any][]) {
    cfg.providers[id] = {
      enabled: !!userCfg?.enabled,
      options: { ...(userCfg?.options || {}) },
      credentials: {},
    };
  }
  // 敏感字段回填
  for (const [fullKey, value] of Object.entries(secret)) {
    const dot = fullKey.indexOf('.');
    if (dot < 0) continue;
    const id = fullKey.slice(0, dot) as ProviderId;
    const key = fullKey.slice(dot + 1);
    if (!cfg.providers[id]) cfg.providers[id] = { enabled: false, options: {}, credentials: {} };
    (cfg.providers[id]!.credentials ??= {})[key] = value;
  }
  // 补齐 order 中缺失的 provider
  for (const id of Object.keys(cfg.providers) as ProviderId[]) {
    if (!cfg.providerOrder.includes(id)) cfg.providerOrder.push(id);
  }
  return cfg;
}

/* ===================== 对外 API ===================== */

/**
 * 读取完整配置（含已解密凭据），仅主进程内部使用
 */
export async function loadWeatherConfig(): Promise<WeatherModuleConfig> {
  const raw = await queryBasicInfoValue(CONFIG_DB_KEY);
  if (!raw) return structuredClone(DEFAULT_WEATHER_CONFIG);

  let secret: Record<string, string> = {};
  if (raw.__secret && typeof raw.__secret === 'object' && 'ct' in raw.__secret) {
    try {
      secret = decryptVault<Record<string, string>>(
        raw.__secret as VaultEnvelope,
        getDeviceMasterKey()
      )[0] ?? {};
    } catch {
      // GCM 认证失败（设备密钥不匹配 / 信封损坏）→ 视为未配置凭据，不阻断读取
      console.warn('[weather] 凭据解密失败，视为未配置');
      secret = {};
    }
  }
  return mergeSecrets(raw, secret);
}

/**
 * 保存配置（敏感字段自动加密）
 * @param cfg 完整配置（含明文凭据）
 */
export async function saveWeatherConfig(cfg: WeatherModuleConfig): Promise<void> {
  const { plain, secret } = splitSecrets(cfg);
  const envelope = Object.keys(secret).length
    ? encryptVault<Record<string, string>>([secret], getDeviceMasterKey())
    : null;
  await upsertBasicInfo(CONFIG_DB_KEY, { ...plain, __secret: envelope });
}

/**
 * 生成运行期配置（凭据已解密），供 adapter 使用
 * @param id Provider 标识
 * @param cfg 完整配置
 */
export function toRuntimeConfig(id: ProviderId, cfg: WeatherModuleConfig): ProviderRuntimeConfig {
  const userCfg = cfg.providers[id];
  return {
    options: { ...(userCfg?.options || {}) },
    credentials: { ...(userCfg?.credentials || {}) },
    timeout: cfg.requestTimeout,
    forceRefresh: false,
  };
}

/**
 * 判断某 Provider 的必填配置项是否已填齐
 * @param id Provider 标识
 * @param cfg 完整配置
 */
export function isProviderConfigured(id: ProviderId, cfg: WeatherModuleConfig): boolean {
  const provider = getAllProviders().find((p) => p.id === id);
  if (!provider) return false;
  if (provider.zeroConfig) return true;

  const userCfg = cfg.providers[id];
  if (!userCfg) return false;
  const bag = { ...(userCfg.credentials || {}), ...(userCfg.options || {}) };

  for (const field of provider.configSchema) {
    if (!field.required) continue;
    if (!isFieldActive(field, bag)) continue;
    if (!bag[field.key]) return false;
  }
  return true;
}

/**
 * 判断条件字段当前是否生效（when 条件满足）
 * @param field 字段定义
 * @param bag 当前值集合
 */
function isFieldActive(field: ProviderConfigField, bag: Record<string, string>): boolean {
  if (!field.when) return true;
  return Object.entries(field.when).every(([k, v]) => bag[k] === v);
}

/**
 * 汇总全部 Provider 的展示快照（配置页用）
 */
export async function getProviderSummaries(): Promise<ProviderSummary[]> {
  const cfg = await loadWeatherConfig();
  return getAllProviders().map((p) => ({
    id: p.id,
    label: p.label,
    zeroConfig: p.zeroConfig,
    capabilities: p.capabilities.length ? p.capabilities : (PROVIDER_CAPABILITIES[p.id] ?? []),
    configured: isProviderConfigured(p.id, cfg),
    enabled: !!cfg.providers[p.id]?.enabled,
    configSchema: p.configSchema,
  }));
}

/**
 * 生成脱敏配置（配置页读取，绝不含明文凭据）
 */
export async function getConfigForUi(): Promise<WeatherConfigForUi> {
  const cfg = await loadWeatherConfig();
  const providers: WeatherConfigForUi['providers'] = {};
  const secretStatus: Record<string, SecretStatus> = {};

  for (const [id, userCfg] of Object.entries(cfg.providers) as [ProviderId, any][]) {
    if (!userCfg) continue;
    providers[id] = { enabled: !!userCfg.enabled, options: { ...(userCfg.options || {}) } };
    for (const [k, v] of Object.entries(userCfg.credentials || {})) {
      if (!isSecretField(id, k)) continue;
      secretStatus[`${id}.${k}`] = { configured: !!v, preview: maskSecret(v as string) };
    }
  }

  return {
    providerOrder: cfg.providerOrder,
    providers,
    requestTimeout: cfg.requestTimeout,
    cacheDuration: cfg.cacheDuration,
    secretStatus,
    availableProviders: await getProviderSummaries(),
  };
}
