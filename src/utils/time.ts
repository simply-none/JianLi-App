export const timeUnit = {
  h: {
    label: '时',
    times: 60 * 60 * 1000,
  },
  m: {
    label: '分',
    times: 60 * 1000,
  },
  s: {
    label: '秒',
    times: 1 * 1000,
  },
}

// 使用moment格式化一个日期，获取一个对象：包括年、月、日、时、分、秒的key
export function formatDate(date0: string | Date) {
  let date = new Date(date0);
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();
  let hour = date.getHours();
  let minute = date.getMinutes();
  let second = date.getSeconds();

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateStr: `${year}-${padTo2Digits(month)}-${padTo2Digits(day)}`
  };
}

// 确保数字保留2位格式
function padTo2Digits(num: number): string {
  return num.toString().padStart(2, '0');
}

// 根据传入的日期，获取当月日期范围
export function getMonthRange(date0: string | Date) {
  let date = new Date(date0);
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();

  // 获取当月第一天和最后一天
  let firstDayOfMonth = new Date(year, month - 1, 1);
  let lastDayOfMonth = new Date(year, month, 0);

  // 格式化日期为2位格式
  let formattedMonth = padTo2Digits(month);
  let formattedFirstDay = padTo2Digits(formatDate(firstDayOfMonth).day);
  let formattedLastDay = padTo2Digits(formatDate(lastDayOfMonth).day);

  return {
    firstDay: `${year}-${formattedMonth}-${formattedFirstDay}`,
    lastDay: `${year}-${formattedMonth}-${formattedLastDay}`
  };
}



// 根据对象的createTime字符串字段对数组进行分类
export function groupByDate<T extends { createTime: string }>(items: T[]): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  
  for (const item of items) {
    // 确保createTime是有效的日期字符串
    const date = new Date(item.createTime);
    if (isNaN(date.getTime())) {
      continue; // 跳过无效的日期
    }
    
    const year = date.getFullYear();
    const month = padTo2Digits(date.getMonth() + 1);
    const day = padTo2Digits(date.getDate());
    const dateKey = `${year}-${month}-${day}`;
    
    if (!result[dateKey]) {
      result[dateKey] = [];
    }
    result[dateKey].push(item);
  }
  
  return result;
}
