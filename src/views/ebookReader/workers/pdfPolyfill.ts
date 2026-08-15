/**
 * pdf.js v6 依赖的较新原生方法 polyfill（用于兼容 Electron 36 自带的 Chromium 134）
 *
 * 1) Uint8Array.prototype.toHex() / fromBase64() 等
 *    需 Chromium 140+（toHex 于 Chrome 140 / Firefox 133 / Safari 18.2 引入）。
 *    Chromium 134 缺失 → PDF worker 抛 “n.toHex is not a function”。
 *
 * 2) Map.prototype.getOrInsertComputed() / WeakMap.prototype.getOrInsertComputed()
 *    需 Chromium 145+（Chrome 145 / Firefox 144 / Safari 26.2 才支持）。
 *    Chromium 134 缺失 → 主线程抛 “...getOrInsertComputed is not a function”
 *    （pdf.js 在 getOptionalContentConfig / render 时调用）。
 *
 * 这里在 PDF 主线程与 worker 启动前补上最小实现，仅在原生缺失时生效，不影响新浏览器。
 */

function defineIfMissing(target: any, name: string, fn: (...args: any[]) => any): void {
  if (typeof target?.[name] !== 'function') {
    target[name] = fn;
  }
}

function ensureUint8ArrayPolyfill(): void {
  const proto: any = Uint8Array.prototype;

  // 实例方法：toHex() -> 小写十六进制字符串（pdf.js 实际调用点）
  defineIfMissing(proto, 'toHex', function (this: Uint8Array): string {
    let s = '';
    for (let i = 0; i < this.length; i++) {
      s += this[i].toString(16).padStart(2, '0');
    }
    return s;
  });

  // 实例方法：toBase64()
  defineIfMissing(proto, 'toBase64', function (this: Uint8Array): string {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < this.length; i += chunk) {
      binary += String.fromCharCode.apply(null, this.subarray(i, i + chunk) as unknown as number[]);
    }
    return btoa(binary);
  });

  // 实例方法：setFromHex(hex)
  defineIfMissing(proto, 'setFromHex', function (this: Uint8Array, hex: string): Uint8Array {
    const clean = hex.replace(/[^0-9a-fA-F]/g, '');
    const len = Math.min(this.length, clean.length / 2);
    for (let i = 0; i < len; i++) {
      this[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return this;
  });

  // 静态方法：fromBase64(str)（pdf.js 实际调用点）
  defineIfMissing(Uint8Array, 'fromBase64', function (str: string): Uint8Array {
    const binary = atob(str);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  });

  // 静态方法：fromHex(hex)
  defineIfMissing(Uint8Array, 'fromHex', function (hex: string): Uint8Array {
    const clean = hex.replace(/[^0-9a-fA-F]/g, '');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return out;
  });
}

ensureUint8ArrayPolyfill();

/** Map / WeakMap.getOrInsertComputed：Chromium 145+ 才有，Chromium 134 缺失 */
function ensureCollectionPolyfill(): void {
  defineIfMissing(Map.prototype, 'getOrInsertComputed', function (
    this: Map<any, any>,
    key: any,
    callback: (k: any) => any,
  ): any {
    if (!this.has(key)) {
      this.set(key, callback(key));
    }
    return this.get(key);
  });

  defineIfMissing(WeakMap.prototype, 'getOrInsertComputed', function (
    this: WeakMap<any, any>,
    key: any,
    callback: (k: any) => any,
  ): any {
    if (!this.has(key)) {
      this.set(key, callback(key));
    }
    return this.get(key);
  });
}

ensureCollectionPolyfill();

export {};
