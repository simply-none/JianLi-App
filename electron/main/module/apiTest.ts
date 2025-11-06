import { BrowserWindow, ipcMain } from "electron";
import axios from "axios";
import puppeteer, { Locator, LocatorEvent } from 'puppeteer';
import colors from "colors";
import { win } from "./mainWindow.ts";
import { Worker } from "worker_threads";
import { systemInfoWorkerPath } from "../variables.ts";
import fs from 'fs';
import { queryByConditions, upsertData } from "../utils/sql.ts";
import { tableName } from "./store.ts";
import { myDb } from "./sql.ts";

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

  // puppeteer 可进行的操作
  /**
   * 1. 打开新页面：browser.newPage()
   * 2. 页面导航：page.goto(url)
   * 2. 元素定位：page.locator(selector)
   *    2.1 元素点击：locator.click()
   *    2.2 元素输入：locator.fill(text)
   *    2.3 元素获取文本：locator.textContent()
   *    2.4 元素悬停：locator.hover()
   *    2.5 元素滚动：locator.scroll({ scrollTop: 1000, scrollLeft: 0 })
   *    2.6 等待元素可见：locator.wait()
   *    2.7 元素过滤：locator.filter(callback)
   *    2.8 元素转JS：locator.map(callback).wait()
   *    2.9 返回elementHandle：(await locator.waitHandle()).click()
   *    2.10 元素定位配置：locatorsetEnsureElementIsInTheViewport(true),setVisibility('visible'),setWaitForEnabled(true),setWaitForStableBoundingBox(true)
   *    2.11 元素定位超时：locator.setTimeout(timeout)
   * 3. 等待元素在DOM中可用：page.waitForSelector(selector)
   * 4. 无需等待查询（已知元素存在）：page.$(selector)单个，page.$$(selector)所有，
   * 5. 监听网络请求：page.on('request', request => {}),page.on('response', response => {})
   */
  ipcMain.on("spider-test", async (e, obj: ObjectType) => {
    console.log(obj);
    // 接口测试，发送接口请求
    const browser = await puppeteer.launch({
      headless: obj.headless || false,
      slowMo: obj.slowMo || 50,
      timeout: obj.timeout || 300000,
      executablePath: obj.executablePath || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    });
    const page: puppeteer.Page = await browser.newPage();

    // 监听网络请求
    page.on('request', request => {
      // console.log('Request:', request.url());
      // win.webContents.send("spider-test:request", request.url());
    });
    // 监听网络响应
    page.on('response', async (response: puppeteer.HTTPResponse) => {
      let headers = response.headers();
      if (!headers['content-type']?.includes('application/json')) {
        return;
      }

      console.log('Response:', response.url(), colors.bgGreen(response.headers()['content-type'] || ''));
      // 判断类型是否是json
      

      let res = {
        url: response.url(),
        status: response.status(),
        headers: headers,
        body: await response.json(),
      }

      
      // win.webContents.send("spider-test:response", JSON.stringify(res, null, 2));
      // 异步写入文件
      // try {
      //   // 文件名取末尾20个字符作为文件名，如果不是数字则替换为下划线
      //   let filename = response.url().substring(response.url().length - 20).replace(/[^\w]/g, '_');
      //   fs.writeFileSync('./spider-test/' + filename + '.json', JSON.stringify(res, null, 2));
      // } catch (error) {
      //   console.error(colors.bgRed('写入文件失败：'), error);
      // }

    });

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

    // 等待3秒钟
    await delay(3000);

    // 截图和PDF生成
    await queryByConditions({
      db: myDb.db,
      tableName,
      conditions: {
        key: "fileCachePath",
      },
      callback: async (err, data) => {
        if (err) {
          console.log(err, "------err");
        } else {
          let path  =
            data.length > 0 ? data[0].value : '';
          path = path.replace(/\\/g, '/');
          
          await page.screenshot({
            path: `${path}/hn-${Date.now()}.png`
          });
          await page.pdf({
            path: path + '/hn-' + Date.now() + '.pdf',
          });
        }
      },
    });
    

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

    // console.log(colors.bgBlue(JSON.stringify(searchResults, null, 2)));

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

// 延时函数
function delay(time) {
   return new Promise(function(resolve) { 
       setTimeout(resolve, time)
   });
}
 