/**
 * 通用深拷贝工具
 * ------------------------------------------------------------------
 * 使用场景：Vue reactive / ref 的 Proxy 对象在 Electron IPC 传输时，
 * V8 序列化器会因 Proxy 抛出 "An object could not be cloned"，
 * 需先深拷贝为纯数据再走 IPC。
 *
 * 注意：不用 JSON.parse(JSON.stringify()) —— 其会丢失 Date/RegExp/Map/Set
 * 类型、无法处理循环引用，本函数按类型逐层重建，类型信息完整保留。
 */

/**
 * 深拷贝任意数据（支持 Proxy 透传读取，产出纯对象树）
 * @param value 待拷贝的任意值（基本类型原样返回；函数按引用返回）
 * @returns 与原值结构相同的纯数据副本
 * @throws {RangeError} 存在循环引用时抛出（递归深度超限）
 */
export function deepClone<T>(value: T): T {
  // 基本类型（string/number/boolean/null/undefined/symbol/bigint）与函数直接返回
  if (value === null || typeof value !== "object") {
    return value;
  }
  // 日期：按时间戳重建
  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as T;
  }
  // 正则：保留源与标志位
  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags) as unknown as T;
  }
  // 数组：逐项递归
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T;
  }
  // Map：键值分别递归
  if (value instanceof Map) {
    const result = new Map();
    value.forEach((v, k) => {
      result.set(deepClone(k), deepClone(v));
    });
    return result as unknown as T;
  }
  // Set：逐项递归
  if (value instanceof Set) {
    const result = new Set();
    value.forEach((v) => {
      result.add(deepClone(v));
    });
    return result as unknown as T;
  }
  // 普通对象（含 Vue reactive Proxy）：读取自有键逐层重建，
  // Proxy 的属性访问会透传到目标对象，因此可安全读取并产出纯对象
  const result: Record<string, any> = {};
  for (const key of Object.keys(value as unknown as Record<string, any>)) {
    result[key] = deepClone((value as unknown as Record<string, any>)[key]);
  }
  return result as T;
}
