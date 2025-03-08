// 节流函数
export function throttle(fn: Function, delay: number) {
  let timer: null | number | NodeJS.Timeout = null;
  return function (this: any, ...args: any[]) {
    if (timer) {
      return;
    }
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

// 防抖函数
export function debounce(fn: Function, delay: number) {
  let timer: null | number | NodeJS.Timeout = null;
  return function (this: any,...args: any[]) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };  
}
