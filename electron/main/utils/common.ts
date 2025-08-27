import fs from 'node:fs'
import path from 'node:path';

export function readFileList(dir, whiteExt = [], ignoreFolder = []) {
  let filesList = []
  let files = fs.readdirSync(dir);
  files.forEach(function (item, index) {
    if (ignoreFolder.includes(item)) return;
    let stat = fs.statSync(dir + item);
    if (stat.isDirectory()) {
      // console.log('检测到文件夹：' + dir + item);
      //递归读取文件
      readFileList(dir + item + "/", filesList)
    } else {
      if (whiteExt.includes(path.extname(dir + item))) {
        // console.log('检测到白名单文件，路径为：' + dir + item);
        filesList.push(dir + item);
      }
    }
  })
  return filesList
}

export function readJsonFileContent(url) {
  try {
    const data = fs.readFileSync(url, 'utf8');

    const content = JSON.parse(data);
    // 判断是否是数组
    if (Array.isArray(content)) {
      // 随机读取数组中的一项
      return content[Math.floor(Math.random() * content.length)]
    }
    return { error: true }
  } catch (err) {
    return { error: true }
  }
}

// 获取对象数组下的所有对象属性
export function getObjectKeys(objArr: ObjectType[] | ObjectType) {
  if (!Array.isArray(objArr)) objArr = [objArr]
  const keys = []
  objArr.forEach(obj => {
    keys.push(...Object.keys(obj))
  })
  // 去重不排序
  return [...new Set(keys)]
}

// 将一个对象数组[{ key: value: JSON.string()}]，转换为{ key: JSON.parse(value) }
export function objectArrayToObject(objArr: ObjectType[]) {
  const obj = {}
  objArr.forEach(item => {
    obj[item.key] = JSON.parse(item.value)
  })
  return obj
}
