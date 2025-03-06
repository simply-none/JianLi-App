// 状态初始化

import type { Ref } from "vue";
import { getStore, setStore } from "./common";

export type defaultField = {
  field: string;
  default: any;
  map: Ref<any>;
  initFn?: (key: string, defaultValue: any, map: Ref<any>) => void;
};

/**
 * @param allVars 示例
 * [
 *   // 字符串值变量
 *   { field: 'fileCachePath', default: '', map: fileCachePath },
 *   // 布尔值变量
 *   { field: 'isShowSetting', default: false, map: isShowSetting },
 *   // 数字值变量
 *   { field: 'workTime', default: 25, map: workTime },
 *   // 颜色值变量
 *   { field: 'workColor', default: '#000000', map: workColor },
 *   // 字体值变量
 *   { field: 'workFont', default: '微软雅黑', map: workFont },
 *   // 对象值变量，包括对象、数组等所有对象
 *   { field: 'workFontObj', default: {}, map: workFontObj },
 * ]
 */
export function initPiniaStatus(allVars: defaultField[] = []) {
  allVars.forEach((item) => {
    const { field, default: defaultValue, map, initFn } = item;
    if (!initFn) {
      assignDefaultValue(field, defaultValue, map);
    } else {
      initFn(field, defaultValue, map);
    }
  });
}

// 变量默认值赋值操作：
// 1. 先从store中获取数据
// 2. 如果store中没有数据，则从默认值中获取数据
// 3. 将数据赋值给该变量
function assignDefaultValue<T>(
  key: string,
  defaultValue: T,
  map: Ref<any>
): void {
  const storeValue = getStore(key);
  map.value = storeValue || defaultValue;
  if (storeValue === undefined) {
    setStore(key, defaultValue);
  }
}
