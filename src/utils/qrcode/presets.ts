/**
 * 二维码样式预设（L1 能力层的一部分，供 UI 复用）。
 * 每个预设是一份 QrStyleOptions，可直接传给 engine.renderQr。
 */
import type { QrStyleOptions, QrGradient } from './types';

export interface QrStylePreset {
  id: string;
  /** 展示名 */
  label: string;
  /** 强调色（用于 UI 预览标识，非二维码本身色） */
  accent: string;
  style: QrStyleOptions;
}

export const QR_STYLE_PRESETS: QrStylePreset[] = [
  {
    id: 'classic',
    label: '经典黑',
    accent: '#1f2329',
    style: {
      dotsType: 'rounded',
      dotsColor: '#1f2329',
      cornersSquareType: 'extra-rounded',
      cornersSquareColor: '#1f2329',
      cornersDotType: 'square',
      cornersDotColor: '#1f2329',
      background: '#ffffff',
      errorCorrectionLevel: 'M',
      margin: 8,
    },
  },
  {
    id: 'tech-blue',
    label: '科技蓝',
    accent: '#2563eb',
    style: {
      dotsType: 'classy-rounded',
      dotsColor: '#2563eb',
      cornersSquareType: 'extra-rounded',
      cornersSquareColor: '#1d4ed8',
      cornersDotType: 'square',
      cornersDotColor: '#1d4ed8',
      background: '#f5f8ff',
      errorCorrectionLevel: 'M',
      margin: 8,
    },
  },
  {
    id: 'china-red',
    label: '中国红',
    accent: '#e11d48',
    style: {
      dotsType: 'rounded',
      dotsColor: '#e11d48',
      cornersSquareType: 'square',
      cornersSquareColor: '#be123c',
      cornersDotType: 'square',
      cornersDotColor: '#be123c',
      background: '#fff5f7',
      errorCorrectionLevel: 'M',
      margin: 8,
    },
  },
  {
    id: 'forest-green',
    label: '森林绿',
    accent: '#16a34a',
    style: {
      dotsType: 'dots',
      dotsColor: '#15803d',
      cornersSquareType: 'dot',
      cornersSquareColor: '#166534',
      cornersDotType: 'dot',
      cornersDotColor: '#166534',
      background: '#f0fdf4',
      errorCorrectionLevel: 'M',
      margin: 8,
    },
  },
  {
    id: 'sunset-orange',
    label: '柔橙',
    accent: '#ea580c',
    style: {
      dotsType: 'classy',
      dotsColor: '#ea580c',
      cornersSquareType: 'extra-rounded',
      cornersSquareColor: '#c2410c',
      cornersDotType: 'square',
      cornersDotColor: '#c2410c',
      background: '#fff7ed',
      errorCorrectionLevel: 'M',
      margin: 8,
    },
  },
  {
    id: 'grape-purple',
    label: '渐变紫',
    accent: '#7c3aed',
    style: {
      dotsType: 'rounded',
      dotsGradient: {
        gradientType: 'linear',
        rotation: 45,
        colorStops: [
          { offset: 0, color: '#7c3aed' },
          { offset: 1, color: '#db2777' },
        ],
      },
      cornersSquareType: 'extra-rounded',
      cornersSquareColor: '#6d28d9',
      cornersDotType: 'square',
      cornersDotColor: '#6d28d9',
      background: '#faf5ff',
      errorCorrectionLevel: 'M',
      margin: 8,
    },
  },
  {
    id: 'ocean-teal',
    label: '海洋青',
    accent: '#0d9488',
    style: {
      dotsType: 'classy-rounded',
      dotsColor: '#0f766e',
      cornersSquareType: 'extra-rounded',
      cornersSquareColor: '#115e59',
      cornersDotType: 'square',
      cornersDotColor: '#115e59',
      background: '#f0fdfa',
      errorCorrectionLevel: 'M',
      margin: 8,
    },
  },
  {
    id: 'mono-dark',
    label: '暗夜',
    accent: '#0f172a',
    style: {
      dotsType: 'square',
      dotsColor: '#0f172a',
      cornersSquareType: 'square',
      cornersSquareColor: '#0f172a',
      cornersDotType: 'square',
      cornersDotColor: '#0f172a',
      background: '#e2e8f0',
      errorCorrectionLevel: 'M',
      margin: 8,
    },
  },
];

/** 按 id 获取预设 */
export function getPreset(id: string): QrStylePreset | undefined {
  return QR_STYLE_PRESETS.find((p) => p.id === id);
}

/**
 * 常用普通颜色（前景色 / 背景色快速选取色板）。
 * 兼容浅色主题，覆盖黑/白/红/橙/黄/绿/青/蓝/紫/粉/灰等通用色。
 */
export const QR_COMMON_COLORS: string[] = [
  '#000000',
  '#1f2329',
  '#ffffff',
  '#e11d48',
  '#f43f5e',
  '#f59e0b',
  '#facc15',
  '#16a34a',
  '#0d9488',
  '#2563eb',
  '#7c3aed',
  '#ec4899',
  '#64748b',
];

/** 渐变预设（前景色 / 背景色渐变快速套用） */
export interface QrGradientPreset {
  id: string;
  label: string;
  gradient: QrGradient;
}

export const QR_GRADIENT_PRESETS: QrGradientPreset[] = [
  {
    id: 'blue-purple',
    label: '蓝紫',
    gradient: {
      gradientType: 'linear',
      rotation: 45,
      colorStops: [
        { offset: 0, color: '#2563eb' },
        { offset: 1, color: '#7c3aed' },
      ],
    },
  },
  {
    id: 'sunset',
    label: '落日',
    gradient: {
      gradientType: 'linear',
      rotation: 45,
      colorStops: [
        { offset: 0, color: '#f59e0b' },
        { offset: 1, color: '#e11d48' },
      ],
    },
  },
  {
    id: 'ocean',
    label: '海洋',
    gradient: {
      gradientType: 'linear',
      rotation: 135,
      colorStops: [
        { offset: 0, color: '#0d9488' },
        { offset: 1, color: '#2563eb' },
      ],
    },
  },
  {
    id: 'rainbow',
    label: '彩虹',
    gradient: {
      gradientType: 'linear',
      rotation: 90,
      colorStops: [
        { offset: 0, color: '#ef4444' },
        { offset: 0.5, color: '#f59e0b' },
        { offset: 1, color: '#2563eb' },
      ],
    },
  },
];
