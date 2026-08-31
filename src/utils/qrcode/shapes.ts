/**
 * 二维码码点 / 码眼形状映射（L1 能力层）
 * ------------------------------------------------------------------
 * 需求要求「码点码眼（两者一起）」选择一种形状即同时作用于码点与定位角。
 * qr-code-styling 原生仅支持 6 种码点形状、3 种码眼方块、2 种码眼圆点，
 * 其余形状（菱形/星形等）库不支持，按约定仅保留这 6 种原生形状。
 *
 * 每个选项用 QrDotType 作为唯一 key（复用原生类型，避免引入新枚举），
 * 并携带该形状对应的 cornersSquare / cornersDot 类型，实现「一起变」。
 */
import type {
  QrDotType,
  QrCornersSquareType,
  QrCornersDotType,
  QrStyleOptions,
} from './types';

export interface QrShapeOption {
  /** 形状 key（复用 6 个原生码点类型） */
  key: QrDotType;
  /** 展示名 */
  label: string;
  /** 码点形状 */
  dot: QrDotType;
  /** 码眼方块形状 */
  cornerSquare: QrCornersSquareType;
  /** 码眼圆心形状 */
  cornerDot: QrCornersDotType;
}

/** 支持的 6 种原生形状（按需求筛选后保留） */
export const QR_SHAPE_OPTIONS: QrShapeOption[] = [
  { key: 'square', label: '方正', dot: 'square', cornerSquare: 'square', cornerDot: 'square' },
  { key: 'rounded', label: '圆角', dot: 'rounded', cornerSquare: 'extra-rounded', cornerDot: 'square' },
  { key: 'extra-rounded', label: '粗圆角', dot: 'extra-rounded', cornerSquare: 'extra-rounded', cornerDot: 'square' },
  { key: 'dots', label: '粗圆形', dot: 'dots', cornerSquare: 'dot', cornerDot: 'dot' },
  { key: 'classy', label: '优雅', dot: 'classy', cornerSquare: 'square', cornerDot: 'square' },
  { key: 'classy-rounded', label: '优雅圆角', dot: 'classy-rounded', cornerSquare: 'extra-rounded', cornerDot: 'square' },
];

/** 按 key 取形状选项 */
export function getShapeOption(key?: string): QrShapeOption | undefined {
  return QR_SHAPE_OPTIONS.find((o) => o.key === key);
}

/**
 * 套用某形状到样式：同时写入 shape + 码点/码眼类型。
 * 码内/外眼颜色保持各自独立（由 cornersDotColor / cornersSquareColor 控制）。
 */
export function applyShape(style: QrStyleOptions, key: QrDotType): QrStyleOptions {
  const opt = getShapeOption(key);
  if (!opt) return style;
  return {
    ...style,
    shape: key,
    dotsType: opt.dot,
    cornersSquareType: opt.cornerSquare,
    cornersDotType: opt.cornerDot,
  };
}

/**
 * 根据当前样式反推已选形状（用于预设套用后让形状选择器高亮）。
 * 仅当码点/码眼类型与某选项完全匹配时返回该 key，否则 undefined（显示为「自定义」）。
 */
export function resolveShapeKey(style: QrStyleOptions): QrDotType | undefined {
  return QR_SHAPE_OPTIONS.find(
    (o) =>
      o.dot === (style.dotsType ?? 'rounded') &&
      o.cornerSquare === (style.cornersSquareType ?? 'extra-rounded') &&
      o.cornerDot === (style.cornersDotType ?? 'square'),
  )?.key;
}
