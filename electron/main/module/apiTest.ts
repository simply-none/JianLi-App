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
    let data: string[] = ['']
    console.log(colors.bgMagenta(JSON.stringify(obj)));
    const { steps, commonParams } = obj;
    console.log(colors.bgCyan(JSON.stringify(steps)))
    console.log(colors.bgCyan(JSON.stringify(commonParams)))
    // 接口测试，发送接口请求

    let browser: puppeteer.Browser;
    // 使用当前打开的浏览器，需要通过快捷方式打开，同时快捷方式需要配置：
    // edge: "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=10853    --user-data-dir="C:\Users\风起\AppData\Local\Microsoft\Edge\User Data"
    // chorme: "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=10853

    if (commonParams.useCurrentBrowser || !commonParams.executablePath) {
      let browserCfg = await axios.get(commonParams.browserURL + '/json/version');
      console.log(colors.bgMagenta(JSON.stringify(browserCfg.data)));

      browser = await puppeteer.connect({
        browserWSEndpoint: browserCfg.data.webSocketDebuggerUrl,
      });
    } else {
      browser = await puppeteer.launch({
        headless: commonParams.headless || false,
        slowMo: commonParams.slowMo || 50,
        timeout: commonParams.timeout || 300000,
        executablePath: commonParams.executablePath,
      });
    }

    let page: puppeteer.Page;



    // 监听网络请求
    // page.on('request', request => {
    //   // console.log('Request:', request.url());
    //   // win.webContents.send("spider-test:request", request.url());
    // });
    // // 监听网络响应
    // page.on('response', async (response: puppeteer.HTTPResponse) => {
    //   let headers = response.headers();
    //   if (!headers['content-type']?.includes('application/json')) {
    //     return;
    //   }

    //   console.log('Response:', response.url(), colors.bgGreen(response.headers()['content-type'] || ''));
    //   // 判断类型是否是json


    //   let res = {
    //     url: response.url(),
    //     status: response.status(),
    //     headers: headers,
    //     body: await response.json(),
    //   }


    //   // win.webContents.send("spider-test:response", JSON.stringify(res, null, 2));
    //   // 异步写入文件
    //   // try {
    //   //   // 文件名取末尾20个字符作为文件名，如果不是数字则替换为下划线
    //   //   let filename = response.url().substring(response.url().length - 20).replace(/[^\w]/g, '_');
    //   //   fs.writeFileSync('./spider-test/' + filename + '.json', JSON.stringify(res, null, 2));
    //   // } catch (error) {
    //   //   console.error(colors.bgRed('写入文件失败：'), error);
    //   // }

    // });


    // steps: 步骤
    if (data.length > 0) {
      for (let item of data) {
        console.log(item)
        if (Array.isArray(steps) && steps.length > 0) {
          for (let stepa of steps) {
            console.log(stepa)
            let step = stepa.data || stepa;

            let handleType = step.handleType
            // SWITCH CASE 语句
            switch (handleType) {
              case 'newPage':
                console.log('newPage')
                page = await browser.newPage();
                await page.setViewport({ width: commonParams.width || 1080, height: commonParams.height || 1024 });
                break;
              case 'closePage':
                await page.close();
                break;
              case 'close':
                if (commonParams.useCurrentBrowser) {
                  await browser.disconnect();
                  await browser.newPage();
                } else {
                  await browser.close();
                }
                break;
              case 'goto':
                await page.goto(step.url);
                if (data.length > 1) {
                  await delay(3000)
                }
                break;
              case 'locator':
                await locatorStep(step, page, item);
                break;
              case 'request':
                page.on('request', request => {
                  console.log('Request:', request.url());
                });
                break;
              case 'response':
                page.on('response', response => {
                  console.log('Response:', response.url());
                });
                break;
              case 'wait':
                await delay(step.waitTime || 1000);
                break;
              case 'evaluate':
                await page.evaluate(selector => {
                  eval(step.js)
                }, step.selector);
                break;
              case 'getData':
                let searchResults;
                if (step.dataKey) {
                  let nodes = await page.$$(step.dataKey);
                  let nodeTexts = await Promise.all(nodes.map(async node => {
                    return await node.evaluate(node => node.textContent)
                  }));
                  console.log(nodeTexts);
                  // 存入便于循环
                  data = nodeTexts;
                  console.log(data, 'data')
                  searchResults = await page.evaluate((nodeTexts) => {
                    return {
                      // 获取页面标题
                      title: document.title,
                      // 获取主要搜索结果区域
                      mainContent: nodeTexts,
                      // 获取当前URL
                      url: window.location.href,
                    };
                  }, nodeTexts);
                } else {
                  searchResults = await page.evaluate(() => {
                    return {
                      // 获取页面标题
                      title: document.title,
                      // 获取主要搜索结果区域
                      mainContent: document.body.innerHTML,
                      // 获取当前URL
                      url: window.location.href,
                    };
                  });
                }

                win.webContents.send("spider-test:getData", searchResults);
                break;
              default:
                console.log(colors.bgRed('未处理的操作类型：'), step.handleType);
                break;
            }
          }
        }
      }
    }


    // // 截图和PDF生成
    // await queryByConditions({
    //   db: myDb.db,
    //   tableName,
    //   conditions: {
    //     key: "fileCachePath",
    //   },
    //   callback: async (err, data) => {
    //     if (err) {
    //       console.log(err, "------err");
    //     } else {
    //       let path  =
    //         data.length > 0 ? data[0].value : '';
    //       path = path.replace(/\\/g, '/');

    //       await page.screenshot({
    //         path: `${path}/hn-${Date.now()}.png`
    //       });
    //       await page.pdf({
    //         path: path + '/hn-' + Date.now() + '.pdf',
    //       });
    //     }
    //   },
    // });
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

// 定位元素并操作
async function locatorStep(mystep: ObjectType, page: any, item: string) {
  let locator = await page.waitForSelector(mystep.selector);

  if (!mystep.elementSteps || mystep.elementSteps.length === 0) {
    return;
  }

  for (const step of mystep.elementSteps) {
    switch (step.action) {
      case 'click':
        await page.evaluate((selector) => {
          (document.querySelector(selector) as HTMLElement).click();
        }, mystep.selector);
        break;
      case 'fill':
        await page.locator(mystep.selector).fill(item || step.value);
        break;
      case 'hover':
        await locator.hover();
        break;
      case 'scroll':
        await locator.scroll({ scrollTop: step.scrollTop || 300, scrollLeft: step.scrollLeft || 300 });
        break;
      case 'wait':
        await delay(step.value || 1000);
        break;
      default:
        console.log(colors.bgRed('未处理的操作类型：'), step.handleType);
        break;
    }
  }
}



// 延时函数
function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  });
}
