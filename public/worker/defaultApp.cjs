// // workerjs 采集系统信息，必须使用cjs模块，同时引用workerjs文件的路径必须正确
const { parentPort, workerData } = require('worker_threads');
const { exec } = require('child_process');
const colors = require('colors')
const path = require('path')

async function monitoringLoop1(exten) {
  // 改进的注册表查询命令（兼容Win10/Win11）
      let ext = exten || workerData.config?.ext;
      const cmd = `reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\${ext}\\UserChoiceLatest\\ProgId" /v ProgId`
      exec(cmd, (err, stdout) => {
        // console.log(err, 'err')
        if (err) {
          parentPort.postMessage({
            path: '',
            ext: ext,
          });
          return;
        }

        const progId = stdout.match(/ProgId\s+REG_SZ\s+(.+)/)?.[1]
        // console.log(colors.bgBlack(progId), 'progId')
        if (!progId) {
          parentPort.postMessage({
            path: '',
            ext: ext,
          });
          return;
        }

        // 二次查询获取执行命令
        exec(`reg query "HKEY_CLASSES_ROOT\\${progId}\\shell\\open\\command"`, (err, cmdStdout) => {
          // console.log(cmdStdout, 'cmdStdout')
          const exePath = extractAppPath(cmdStdout)
          // console.log(colors.bgBlue(exePath), 'exePath')
          parentPort.postMessage({
            path: exePath ? path.normalize(exePath.replace(/"/g, '')) : null,
            ext: ext
          });
        })
      })
  
}

function extractAppPath(registryString) {
  // 匹配双引号内的完整路径
  const pathMatch = registryString.match(/"([^"]+\.exe)"/i);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1].replace(/\\/g, '/'); // 统一路径分隔符
  }

  // 备用匹配：非贪婪匹配直到.exe
  const fallbackMatch = registryString.match(/([a-z]:[^"]+?\.exe)/i);
  return fallbackMatch ? fallbackMatch[1] : null;
}

parentPort.on('message', async (message) => {
  // console.log('收到消息:', message, workerData)
  switch (message.type) {
    case 'start':
      // 立即开始第一次采集
      monitoringLoop1(message.ext);
      break;
    case 'update-config':
      break;
  }
});