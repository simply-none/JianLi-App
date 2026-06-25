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

async function getSystemSummary() {
  try {
    const [os, cpu, mem, diskLayout, graphics, networkInterfaces] = await Promise.all([
      si.osInfo(),
      si.cpu(),
      si.mem(),
      si.diskLayout(),
      si.graphics(),
      si.networkInterfaces(),
    ]);
    
    parentPort.postMessage({
      type: 'summary',
      data: {
        os: {
          platform: os.platform,
          distro: os.distro,
          release: os.release,
          arch: os.arch,
          hostname: os.hostname,
        },
        cpu: {
          brand: cpu.brand,
          cores: cpu.cores,
          physicalCores: cpu.physicalCores,
          speed: cpu.speed,
          speedMax: cpu.speedMax,
          manufacturer: cpu.manufacturer,
        },
        memory: {
          total: mem.total,
          used: mem.used,
          free: mem.free,
          swaptotal: mem.swaptotal,
        },
        disks: diskLayout.map(d => ({
          device: d.device,
          type: d.type,
          name: d.name,
          size: d.size,
          vendor: d.vendor,
        })),
        graphics: {
          controllers: (graphics.controllers || []).map(g => ({
            model: g.model,
            vram: g.vram,
            vendor: g.vendor,
          })),
          displays: (graphics.displays || []).map(d => ({
            model: d.model,
            resolution: `${d.resolutionx}x${d.resolutiony}`,
            refreshRate: d.refreshRate,
          })),
        },
        network: networkInterfaces
          .filter(n => n.ip4 && n.type !== 'virtual')
          .map(n => ({
            iface: n.iface,
            ip4: n.ip4,
            mac: n.mac,
            type: n.type,
          })),
      },
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error('获取系统摘要失败:', error);
    parentPort.postMessage({
      type: 'summary',
      data: {},
      time: new Date().toISOString(),
    });
  }
}

async function getExtendedInfo() {
  try {
    const tasks = [];
    
    if (typeof si.bios === 'function') tasks.push(si.bios());
    else tasks.push(Promise.resolve({}));
    
    if (typeof si.baseboard === 'function') tasks.push(si.baseboard());
    else tasks.push(Promise.resolve({}));
    
    if (typeof si.battery === 'function') tasks.push(si.battery());
    else tasks.push(Promise.resolve([]));
    
    if (typeof si.audio === 'function') tasks.push(si.audio());
    else tasks.push(Promise.resolve([]));
    
    if (typeof si.bluetoothDevices === 'function') tasks.push(si.bluetoothDevices());
    else tasks.push(Promise.resolve([]));
    
    if (typeof si.usb === 'function') tasks.push(si.usb());
    else tasks.push(Promise.resolve([]));
    
    if (typeof si.printer === 'function') tasks.push(si.printer());
    else tasks.push(Promise.resolve([]));
    
    if (typeof si.dockerInfo === 'function') tasks.push(si.dockerInfo());
    else tasks.push(Promise.resolve({}));
    
    if (typeof si.versions === 'function') tasks.push(si.versions());
    else tasks.push(Promise.resolve({}));
    
    if (typeof si.users === 'function') tasks.push(si.users());
    else tasks.push(Promise.resolve([]));

    const results = await Promise.allSettled(tasks);

    const [bios, baseboard, battery, audio, bluetooth, usb, printer, docker, versions, users] = results;

    parentPort.postMessage({
      type: 'extended',
      data: {
        bios: bios.status === 'fulfilled' ? bios.value : {},
        baseboard: baseboard.status === 'fulfilled' ? baseboard.value : {},
        battery: battery.status === 'fulfilled' ? battery.value : [],
        audio: audio.status === 'fulfilled' ? audio.value : [],
        bluetooth: bluetooth.status === 'fulfilled' ? bluetooth.value : [],
        usb: usb.status === 'fulfilled' ? usb.value : [],
        printer: printer.status === 'fulfilled' ? printer.value : [],
        docker: docker.status === 'fulfilled' ? docker.value : {},
        versions: versions.status === 'fulfilled' ? versions.value : {},
        users: users.status === 'fulfilled' ? users.value : [],
      },
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error('获取扩展信息失败:', error);
    parentPort.postMessage({
      type: 'extended',
      data: {},
      time: new Date().toISOString(),
    });
  }
}

parentPort.on('message', async (message) => {
  switch (message.type) {
    case 'summary':
      getSystemSummary();
      break;
    case 'extended':
      getExtendedInfo();
      break;
    case 'static':
      getSystemStaticData();
      break;
    case 'start':
      if (!isMonitoring) {
        isMonitoring = true;
        monitoringLoop1();
      }
      parentPort.postMessage({
        type: 'monitoring-started',
      });
      break;
    case 'stop':
      isMonitoring = false;
      monitoringLoop1Stop();
      parentPort.postMessage({
        type: 'monitoring-stopped'
      });
      break;
    case 'update-config':
      break;
  }
});