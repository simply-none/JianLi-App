/**
 * 编码工具：解决 qr-code-styling / qrcode-generator 中文乱码问题。
 * ------------------------------------------------------------------
 * qrcode-generator 默认对字符串按 `charCodeAt(i) & 0xff` 取字节，
 * 中文等多字节字符会被截断成乱码。标准二维码扫描器（手机等）按 UTF-8
 * 解析字节，因此这里先把文本转成「UTF-8 字节串」（每个字符 codePoint
 * 落在 0-255），喂给库后即等价于「以 UTF-8 编码的二维码」。
 */

/** 文本 → UTF-8 字节串（供生成时喂给二维码库） */
export function toUtf8Data(text: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // 代理对（emoji / 生僻字）
      const next = text.charCodeAt(++i);
      code = 0x10000 + ((code & 0x3ff) << 10) + (next & 0x3ff);
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return String.fromCharCode(...bytes);
}

/**
 * 原始字节数组（0-255）按 UTF-8 解码为文本。
 * 这是 `toUtf8Data` 的精确逆操作：生成时把「文本 → UTF-8 字节串」喂给库，
 * 识别时 jsQR 读回的是原始字节数组（result.binaryData），这里一次性还原文本。
 * 注意：jsQR 的 result.data 本身已是 UTF-8 解码后的字符串，不要再二次解码。
 */
export function bytesToUtf8(bytes: ArrayLike<number>): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes as Array<number>));
  }
  // 兜底：手写 UTF-8 解码（无 TextDecoder 环境）
  let out = '';
  let i = 0;
  const n = bytes.length;
  while (i < n) {
    const b = bytes[i];
    if (b < 0x80) {
      out += String.fromCharCode(b);
      i += 1;
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if (b < 0xf0) {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f),
      );
      i += 3;
    } else {
      const cp =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      out += String.fromCodePoint(cp);
      i += 4;
    }
  }
  return out;
}

/** 估算文本实际 UTF-8 字节长度（用于容量校验） */
export function calcByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  return toUtf8Data(text).length;
}

/**
 * 二维码字节容量表（byte 模式，按 UTF-8 字节数）。
 * 数据来自 QR Code 标准，用于估算版本与模块数。
 * 下标即版本号（index 0 占位不用）。
 */
const CAPACITY_BYTES: Record<'L' | 'M' | 'Q' | 'H', number[]> = {
  L: [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425, 458, 520, 586, 644, 718, 792, 858, 929, 1003, 1079, 1154, 1232, 1310, 1391, 1473, 1557, 1643, 1729, 1817, 1917, 1976, 2061, 2151, 2245, 2343, 2445, 2549],
  M: [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 259, 296, 342, 368, 419, 460, 504, 560, 624, 666, 711, 779, 857, 911, 997, 1059, 1125, 1190, 1264, 1370, 1452, 1538, 1628, 1700, 1782, 1862, 1946, 2022, 2102, 2216],
  Q: [0, 11, 20, 32, 46, 60, 74, 86, 108, 130, 151, 177, 203, 241, 258, 292, 322, 364, 394, 442, 482, 509, 565, 611, 661, 715, 751, 805, 868, 908, 982, 1030, 1112, 1168, 1228, 1283, 1351, 1423, 1499, 1571, 1647],
  H: [0, 7, 14, 24, 34, 44, 58, 64, 84, 98, 119, 137, 155, 177, 194, 220, 250, 280, 310, 338, 382, 403, 439, 461, 511, 535, 593, 625, 658, 698, 742, 790, 842, 898, 958, 983, 1051, 1093, 1132, 1192, 1262],
};

/**
 * 粗略估算所需二维码版本（1-40），用于超容量提示。
 * 采用容错 L（最大字节容量）作为宽松上限，仅作提示，非精确算法。
 */
export function estimateVersion(byteLength: number): number {
  const table = CAPACITY_BYTES.L;
  for (let v = 1; v <= 40; v++) {
    if (byteLength <= (table[v] ?? Infinity)) return v;
  }
  return -1; // 超出上限
}

/**
 * 估算二维码模块数（码点数量，例如 21×21）。
 * 模块数 = 21 + 4 × (版本 - 1)，版本由「UTF-8 字节长度 + 容错级别」查标准容量表得到。
 * 返回 -1 表示超出最大容量（V40 仍放不下）。
 *
 * 说明：qr-code-styling 不暴露强制版本/模块数接口，这里用标准容量表反推，
 * 与库内部实际选型一致，可作为「码点数量」的只读展示值。
 */
export function estimateModuleCount(
  byteLength: number,
  ecc: 'L' | 'M' | 'Q' | 'H' = 'M',
): number {
  if (byteLength <= 0) return 21;
  const table = CAPACITY_BYTES[ecc] ?? CAPACITY_BYTES.M;
  for (let v = 1; v <= 40; v++) {
    if (byteLength <= (table[v] ?? -1)) return 21 + 4 * (v - 1);
  }
  return -1;
}
