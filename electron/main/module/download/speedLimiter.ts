/**
 * 全局限速器（令牌桶算法，主进程）
 * ------------------------------------------------------------------
 * 所有下载任务共享一个限速器实例；maxSpeed 通过 getter 动态读取，
 * 设置面板修改限速后立即生效，无需重建。
 * maxSpeed = 0 表示不限速（take 直接返回）。
 */
export class SpeedLimiter {
  /** 当前可用令牌（字节） */
  private tokens = 0;
  /** 上次补充令牌的时间戳（ms） */
  private lastRefill = Date.now();
  /** 动态读取限速值的 getter（B/s，0 表示不限） */
  private getSpeed: () => number;

  /**
   * @param getSpeed 必填，返回当前限速（B/s）的函数，0 表示不限速
   */
  constructor(getSpeed: () => number) {
    this.getSpeed = getSpeed;
  }

  /**
   * 申请消耗 n 字节令牌；不足时等待令牌补充后返回
   * @param n 必填，本次要消耗的字节数
   * @returns Promise，拿到令牌后 resolve
   */
  async take(n: number): Promise<void> {
    const speed = this.getSpeed();
    // 不限速直接放行
    if (!speed || speed <= 0) return;
    // 死循环等待令牌；每次最多等 1s，避免长时间挂起
    for (;;) {
      const now = Date.now();
      // 按流逝时间补充令牌，桶容量 = 1 秒的量（允许 1s 突发）
      this.tokens = Math.min(speed, this.tokens + ((now - this.lastRefill) / 1000) * speed);
      this.lastRefill = now;
      if (this.tokens >= n) {
        this.tokens -= n;
        return;
      }
      // 计算还差多少毫秒，至少睡 20ms 防止忙等
      const needMs = ((n - this.tokens) / speed) * 1000;
      await new Promise((r) => setTimeout(r, Math.min(Math.max(needMs, 20), 1000)));
    }
  }
}
