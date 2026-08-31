/**
 * 二维码能力层 —— 桶文件（barrel）。
 * 任意业务模块只需 `import { renderQr, decodeQr, buildPayload, ... } from '@/utils/qrcode'`
 * 即可复用完整能力，无需关心 qr-code-styling / jsqr 的接入细节。
 */
export * from './types';
export * from './encoding';
export * from './payload';
export * from './parse';
export * from './presets';
export * from './shapes';
export * from './engine';
export * from './decode';
export * from './history';
export * from './ipc';
export * from './naming';
