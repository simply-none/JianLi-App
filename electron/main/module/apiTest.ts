import { BrowserWindow, ipcMain } from "electron";
import axios from "axios";
import puppeteer, { Locator, LocatorEvent } from 'puppeteer';
import colors from "colors";
import { win } from "./mainWindow.ts";
import { Worker } from "worker_threads";
import { systemInfoWorkerPath } from "../variables.ts";

export function initApiTest() {
  ipcMain.on("api-test", (e, obj: any) => {
    console.log(obj);
    // 接口测试，发送接口请求
    axios({
      url: obj.url,
      method: obj.method,
      data: obj.data,
      headers: obj.headers,
      params: obj.params,
    }).then(res => {
      console.log(colors.bgBlue(JSON.stringify(res.data, null, 2)));
      win.webContents.send("api-test", res.data);
    }).catch(err => {
      console.log(err);
      win.webContents.send("api-test", err);
    })
  });

  // 爬虫测试
  // 接下来的计划：
  // 页面自动化参数完全可配置
  // 请求接口数据
  ipcMain.on("spider-test", async (e, obj: ObjectType) => {
    console.log(obj);
    // 接口测试，发送接口请求
    const browser = await puppeteer.launch({
      headless: obj.headless || false,
      slowMo: obj.slowMo || 50,
      timeout: obj.timeout || 300000,
      executablePath: obj.executablePath || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    });
    const page = await browser.newPage();

    // Navigate the page to a URL.
    await page.goto(obj.url || 'https://cn.bing.com/');

    // Set screen size.
    await page.setViewport({ width: obj.width || 1080, height: obj.height || 1024 });

    // Type into search box using accessible input name.
    await page.locator(obj.searchBoxSelector || '.sb_form_q').fill(obj.searchText || '天气');

    // 获取到元素点击不生效一直在等待，需要通过js语句进行点击，而不是通过puppeteer的click方法
    await page.evaluate((selector) => {
      (document.querySelector(selector) as HTMLElement).click();
    }, obj.searchButtonSelector || '.search');

    await page.waitForSelector(obj.searchResultSelector || '.b_respl')

    // 获取搜索结果页面内容
    const searchResults = await page.evaluate(() => {
      return {
        // 获取页面标题
        title: document.title,
        // 获取主要搜索结果区域
        mainContent: document.body.innerHTML,
        // 获取当前URL
        url: window.location.href,
      };
    });

    console.log(colors.bgBlue(JSON.stringify(searchResults, null, 2)));

    win.webContents.send("spider-test", searchResults);

    await browser.close();
  });

  // system-info
  let trafficWorker;

  ipcMain.on('system-info', async (e, userConfig: ObjectType = { type: 'start' }) => {
    console.log(userConfig.type, '系统信息监控配置');
    win.webContents.send('system-info', { type: 'start-pre', data: systemInfoWorkerPath });

    if (trafficWorker) {
      trafficWorker.terminate();
    }

    const defaultConfig = {
      samplingInterval: 1000,
      burstDuration: 10000,
      quietSamplingInterval: 5000
    };

    const finalConfig = { ...defaultConfig, ...userConfig };

    // credentials?: RequestCredentials;
    // name?: string;
    // type?: WorkerType;
    trafficWorker = new Worker(systemInfoWorkerPath, {
      workerData: { config: finalConfig }
    });

    // 发送消息给Worker
    trafficWorker.postMessage({ type: userConfig.type || 'start' });
    
    // 处理Worker消息
    trafficWorker.on('message', (data) => {
      if (win && !win.isDestroyed()) {
        console.log(Date.now(), data.type)
        win.webContents.send('system-info', data);
      }
    });

    trafficWorker.on('error', (error) => {
      console.error('Worker error:', error);
    });

    trafficWorker.on('exit', (code) => {
      if (code !== 0) {
        console.log('Worker stopped with exit code:', code);
      }
    });
  })

  // system-info static
  let trafficWorkerStatic;

  ipcMain.on('system-info-static', async (e, userConfig: ObjectType = { type: 'start' }) => {
    console.log(userConfig.type, '系统信息监控配置static');
    win.webContents.send('system-info-static', { type: 'start-pre', data: systemInfoWorkerPath });

    if (trafficWorkerStatic) {
      trafficWorkerStatic.terminate();
    }

    const defaultConfig = {
      samplingInterval: 1000,
      burstDuration: 10000,
      quietSamplingInterval: 5000
    };

    const finalConfig = { ...defaultConfig, ...userConfig };

    // credentials?: RequestCredentials;
    // name?: string;
    // type?: WorkerType;
    trafficWorkerStatic = new Worker(systemInfoWorkerPath, {
      workerData: { config: finalConfig }
    });

    // 发送消息给Worker
    trafficWorkerStatic.postMessage({ type: userConfig.type || 'start' });
    
    // 处理Worker消息
    trafficWorkerStatic.on('message', (data) => {
      if (win && !win.isDestroyed()) {
        console.log(colors.bgBlue(data.type), data.type)
        win.webContents.send('system-info-static', data);
      }
    });

    trafficWorkerStatic.on('error', (error) => {
      console.error('Worker error:', error);
    });

    trafficWorkerStatic.on('exit', (code) => {
      if (code !== 0) {
        console.log('Worker stopped with exit code:', code);
      }
    });
  })
}
