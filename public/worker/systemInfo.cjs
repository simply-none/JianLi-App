// // workerjs 采集系统信息，必须使用cjs模块，同时引用workerjs文件的路径必须正确
const { parentPort, workerData } = require('worker_threads');
const si = require('systeminformation');

let isMonitoring = false;
let ovserveId = null;

async function monitoringLoop1() {
  // 属性/嵌套属性列表
  let valuesObject = {
    // audio: 'id,name,status,type',
    // bios: 'releaseDate,serial,vendor,version',
    // cpu: 'brand,cache,cores,family,manufacturer,speed,speedMax,speedMin',
    cpuCurrentSpeed: 'avg,max,min',
    networkStats: 'iface,rx_bytes,rx_sec,rx_dropped,tx_bytes,tx_sec,tx_dropped',
  }

  function callback(data) {
    // console.log('callback:', data);
    parentPort.postMessage({
      type: 'system-data',
      data: data,
      time: new Date().toISOString(),
    });
  }

  // 监听之前的监听器如果有，则先停止
  if (ovserveId) {
    clearInterval(ovserveId);
    ovserveId = null;
    return;
  }

  ovserveId = si.observe(valuesObject, 1000, callback);
  
}

async function monitoringLoop1Stop() {
  if (ovserveId) {
    clearInterval(ovserveId);
    ovserveId = null;
  }
}

async function getSystemStaticData() {
  try {
    si.getStaticData((data) => {
      parentPort.postMessage({
        type: 'static',
        data: data,
        time: new Date().toISOString(),
      });
    })
  } catch (error) {
    console.error('数据收集错误:', error);
  }
}

parentPort.on('message', async (message) => {
  // console.log('收到消息:', message, workerData, monitor)
  switch (message.type) {
    // 获取静态数据，不需要实时监控
    case 'static':
      getSystemStaticData();
      break;
    case 'start':
      if (!isMonitoring) {
        isMonitoring = true;
        // 立即开始第一次采集
        monitoringLoop1();
      }

      parentPort.postMessage({
        type: 'monitoring-started',
      });
      break;

    case 'stop':
      // 停止监控
      isMonitoring = false;
      // 停止监控循环
      monitoringLoop1Stop();

      parentPort.postMessage({
        type: 'monitoring-stopped'
      });
      break;

    case 'update-config':
      break;
  }
});