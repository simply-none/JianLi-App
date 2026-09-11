// 右键菜单注册表写入 Worker：主线程把规划好的 RegOp 列表发来，这里用 execFile 异步执行，
// 不阻塞主线程（消除注册导致的鼠标/窗口卡顿）。必须用 cjs（与 defaultApp.cjs / systemInfo.cjs 同源）。
const { parentPort } = require('worker_threads');
const { execFile } = require('child_process');

// 非 worker 上下文（被误当普通脚本执行）直接退出
if (!parentPort) {
  process.exit(0);
}

parentPort.on('message', (ops) => {
  if (!Array.isArray(ops) || ops.length === 0) {
    parentPort.postMessage('done');
    return;
  }
  let i = 0;
  const runNext = () => {
    if (i >= ops.length) {
      parentPort.postMessage('done');
      return;
    }
    const op = ops[i++];
    // 逐条执行，保留原始顺序（cleanupLegacy 的删除必须先于 registerCommandLeaf 的写入）；
    // execFile 异步，主线程事件循环在等待期间继续转动，但本 worker 线程本身也不影响渲染/主进程。
    execFile(op.cmd, op.args, { windowsHide: true, stdio: 'ignore' }, (err) => {
      if (err) {
        // `reg delete` 删掉「不存在的键」是 cleanupLegacy 清理旧残留的正常结果（返回“系统找不到指定的注册表项/值”），
        // 不算错误，静默忽略；其余命令（reg add / powershell）失败才记录，避免刷屏式假警报。
        if (op.cmd === 'reg' && op.args[0] === 'delete') return runNext();
        console.error('[shellMenuWorker] op failed:', op.cmd, op.args, err && err.message);
      }
      runNext();
    });
  };
  runNext();
});
