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
  return function (this: any, ...args: any[]) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// 是否是对象，包括数组、对象
export function isObjectOrArray(obj: any) {
  // 优化一下上述代码
  const typeArr = ["[object Object]", "[object Array]"];
  return typeArr.includes(Object.prototype.toString.call(obj));
}

// 是否是对象
export function isObject(obj: any) {
  return Object.prototype.toString.call(obj) === "[object Object]";
}

// 判断两个对象是否含有相同的字段
export function isSameKey(obj1: any, obj2: any) {
  const obj1Keys = Object.keys(obj1);
  const obj2Keys = Object.keys(obj2);
  return obj1Keys.every((key) => obj2Keys.includes(key));
}

// 是否是数组
export function isArray(obj: any) {
  return Object.prototype.toString.call(obj) === "[object Array]";
}

// 比较新旧两个对象（数组或对象），如果旧对象中有新对象中没有的字段，则添加到新对象中
export function getCompositeObj(oldObj: any, newObj: any) {
  const isObjectType = isObject(oldObj);
  // 如果是对象类型
  if (!isObjectType) {
    return {
      obj: newObj,
      isSame: true,
    };
  }
  const isSame = isSameKey(oldObj, newObj);
  // 如果新旧对象的字段相同，则返回新对象
  if (isSame) {
    return {
      obj: newObj,
      isSame: true,
    };
  }
  // 否则，将旧对象中的字段添加到新对象中
  return {
    obj: {
      ...oldObj,
      ...newObj,
    },
    isSame: false,
  };
}

// 新旧两个对象数组的字段增加
export function getCompositeObjArr(
  oldArr: any,
  newArr: any,
  key: string = "id"
) {
  let isSame = true;
  const isArrayType = isArray(oldArr);
  // 如果不数组类型
  if (!isArrayType) {
    return newArr;
  }
  // 遍历旧数组，进行每项的字段比较
  const newOldCopy = oldArr.map((item: any) => {
    const newItem = newArr.find((newItem: any) => newItem[key] === item[key]);
    // 如果新数组中没有，则返回旧数组中的项
    if (!newItem) {
      return item;
    }
    // 否则，参照getCompositeObj函数进行字段比较
    const { obj, isSame: isSm } = getCompositeObj(item, newItem);
    isSame = isSm
    return obj;
  });
  return {
    arr: newOldCopy,
    isSame,
  };
}
